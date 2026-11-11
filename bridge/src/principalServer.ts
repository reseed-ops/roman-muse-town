/**
 * The principal channel over HTTPS (Task 22): the bridge's only public
 * face on the town channel, for exactly one caller, the owner's chat
 * Muse. Railway terminates TLS; this process speaks plain HTTP on PORT.
 *
 *   POST /principal/wake     PrincipalCall -> PrincipalSlate   (PRINCIPAL_TOKEN)
 *   GET  /principal/waiting                -> WaitingMarker    (PRINCIPAL_TOKEN, or the
 *                                                               read-only PRINCIPAL_MARKER_TOKEN)
 *   GET  /principal/events                 -> text/event-stream (Task 66; same tokens as /waiting)
 *   GET  /healthz                          -> {"ok":true}      (no token; says nothing else)
 *
 * The waiting marker also long-polls (the watcher contract, Nov 7):
 * `GET /principal/waiting?after=<seq>&wait=<s>` holds the answer until a
 * line past `after` waits, the composing flag turns over, or `wait`
 * seconds pass (capped at WAIT_MAX_S), then answers the marker as ever.
 * With the principal token, `claim=1` also keeps (or takes) her claim at
 * the start and at the answer, so a watcher looping on it holds the
 * visit without a wake; the marker token can never claim.
 *
 * Many towns (Task 29): besides the owner's token, a paired token
 * (tenants.ts) opens the same two routes for its own town's desk only,
 * and `POST /pair {"code"}` trades a town's pairing code for such a
 * token. Neither the owner's marker token nor any other token reaches a
 * paired town.
 *
 * The token rides as `Authorization: Bearer <token>`, compared in
 * constant time over digests (bridgeServer.ts). A refused call gets a
 * bare 401 and one log line that never carries the value. Rotating the
 * PRINCIPAL_TOKEN variable restarts the service with the new value; the
 * old one is refused from then on, and nothing else changes.
 *
 * The waiting marker carries only a line's sequence number, its time
 * and the composing flag, never text. It is still a sign of when the
 * owner is in his town, so it is not public: it answers to either
 * token, and the lesser one can read nothing else.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { bearerToken, tokenMatches } from "./bridgeServer.js";
import type { PrincipalDesk } from "./principal.js";
import { createPairLimiter, type PairLimits } from "./pairLimiter.js";

const MAX_BODY_BYTES = 64_000;
export { DEFAULT_PAIR_LIMITS } from "./pairLimiter.js";

/** The caller's address: the proxy's X-Real-IP only when a trusted proxy
 *  is configured (TRUST_PROXY, or Railway's own environment; see
 *  pairLimiter.ts); X-Forwarded-For is never read, since a caller can
 *  write anything there. Otherwise the socket's own address. The overall
 *  limits in the pair limiter bound a caller who forges the header anyway. */
export function callerAddress(req: IncomingMessage, trustProxy = false): string {
  if (trustProxy) {
    const real = req.headers["x-real-ip"];
    const value = (Array.isArray(real) ? real[real.length - 1] : real)?.trim();
    if (value && value.length <= 64) return value;
  }
  return req.socket.remoteAddress || "unknown";
}
export const WAIT_MAX_S = 25;
/** Task 66: the push channel. A comment line every STREAM_HEARTBEAT_MS keeps proxies
 *  from idling it out (and keeps the claim, with claim=1); a stream ends after
 *  STREAM_MAX_MS so the token is re-checked, and the watcher reconnects. */
export const STREAM_HEARTBEAT_MS = 15_000;
export const STREAM_MAX_MS = 10 * 60 * 1000;
/** Open streams per desk and in all; the oldest of a desk's is closed past its cap. */
export const STREAMS_PER_DESK = 3;
export const STREAMS_TOTAL = 64;
const WAIT_LOOK_MS = 250;

export type PairOutcome = { ok: true; principalToken: string } | { ok: false; status: number; error: string };

export type PrincipalServerOptions = {
  /** The owner's desk and token; without a token only paired towns are served. */
  desk: PrincipalDesk | null;
  token: string | null;
  /** A paired town's desk for a presented token, or null (Task 29). */
  resolve?: (presented: string | null) => PrincipalDesk | null | Promise<PrincipalDesk | null>;
  /** Trade a pairing code for a paired token (Task 29); absent, POST /pair is 404. */
  pair?: (code: unknown) => Promise<PairOutcome>;
  markerToken?: string | null;
  port?: number;
  host?: string;
  /** Read X-Real-IP as the caller's address (a trusted proxy fronts this server). */
  trustProxy?: boolean;
  /** Overrides for the pairing limits (tests). */
  pairLimits?: Partial<PairLimits>;
  /** Overrides for the push channel's timings (tests). */
  streamHeartbeatMs?: number;
  streamMaxMs?: number;
  log?: (line: string) => void;
};

export type PrincipalServerHandle = { port: number; close: () => Promise<void> };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function startPrincipalServer(opts: PrincipalServerOptions): Promise<PrincipalServerHandle> {
  const { desk, token } = opts;
  const markerToken = opts.markerToken || null;
  const log = opts.log ?? ((line: string) => console.log(line));
  const trustProxy = opts.trustProxy ?? false;
  const pairLimiter = createPairLimiter(opts.pairLimits ?? {});
  const send = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-max-age": "600",
    });
    res.end(JSON.stringify(body));
  };
  const heartbeatMs = opts.streamHeartbeatMs ?? STREAM_HEARTBEAT_MS;
  const streamMaxMs = opts.streamMaxMs ?? STREAM_MAX_MS;
  const streams = new Map<PrincipalDesk, Set<() => void>>();
  let streamCount = 0;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;
      const method = req.method ?? "GET";
      if (method === "OPTIONS") return send(res, 204, {});
      if (path === "/healthz" && method === "GET") return send(res, 200, { ok: true });
      if (path === "/pair" && opts.pair) {
        // The town asks this before it offers Connect my Muse, so a town
        // never shows a pairing step this bridge cannot complete.
        if (method === "GET") return send(res, 200, { pairing: true });
        if (method !== "POST") return send(res, 405, { error: "method not allowed" });
        let raw: unknown = null;
        try {
          raw = JSON.parse((await readBody(req)) || "null");
        } catch {
          return send(res, 400, { error: "the body is not JSON" });
        }
        const who = callerAddress(req, trustProxy);
        // The slot is reserved here, before the upstream call, and settled after.
        const slot = pairLimiter.reserve(who);
        if (!slot.ok) {
          log(`pair: a caller was refused (${slot.reason})`);
          return send(res, 429, { error: "too many pairing attempts from here; wait a few minutes and make a new code in the town" });
        }
        let out: PairOutcome;
        try {
          out = await opts.pair((raw as { code?: unknown } | null)?.code);
        } catch (error) {
          slot.settle("release");
          throw error;
        }
        slot.settle(out.ok ? "success" : out.status === 404 ? "miss" : "release");
        return out.ok ? send(res, 200, { principalToken: out.principalToken }) : send(res, out.status, { error: out.error });
      }
      if (path !== "/principal/wake" && path !== "/principal/waiting" && path !== "/principal/events") return send(res, 404, { error: "no such route" });
      const presented = bearerToken(req.headers.authorization);
      const owner = token !== null && desk !== null && tokenMatches(presented, token);
      const marker = !owner && markerToken !== null && desk !== null && (path === "/principal/waiting" || path === "/principal/events") && tokenMatches(presented, markerToken);
      const paired = !owner && !marker && opts.resolve ? await opts.resolve(presented) : null;
      const principal = owner || paired !== null;
      const d = (paired ?? desk)!;
      if (!principal && !marker) {
        log(`principal: refused ${method} ${path}: ${presented === null ? "no token" : "wrong token"}`);
        return send(res, 401, { error: "refused" });
      }
      if (path === "/principal/events") {
        // Task 66: the box subscribes (outbound), the bridge pushes the marker down
        // the open response. The marker only: a line's number, time and the
        // composing flag, never text; the watcher then makes the usual wake call.
        if (method !== "GET") return send(res, 405, { error: "method not allowed" });
        if (streamCount >= STREAMS_TOTAL) return send(res, 503, { error: "too many open streams" });
        const claim = principal && url.searchParams.get("claim") === "1";
        let mine = streams.get(d);
        if (!mine) streams.set(d, (mine = new Set()));
        while (mine.size >= STREAMS_PER_DESK) [...mine][0]!();
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-store",
          connection: "keep-alive",
          "x-accel-buffering": "no",
          "access-control-allow-origin": "*",
        });
        let closed = false;
        let unsubscribe = () => {};
        let beat: ReturnType<typeof setInterval> | null = null;
        let ttl: ReturnType<typeof setTimeout> | null = null;
        const stop = () => {
          if (closed) return;
          closed = true;
          unsubscribe();
          if (beat) clearInterval(beat);
          if (ttl) clearTimeout(ttl);
          mine!.delete(stop);
          streamCount -= 1;
          res.end();
          log(`principal events: a stream closed (${streamCount} open)`);
        };
        streamCount += 1;
        mine.add(stop);
        req.on("close", stop);
        res.write("retry: 3000\n\n");
        if (claim) d.keepClaim();
        unsubscribe = d.subscribe((m) => {
          if (!closed) res.write(`event: marker\ndata: ${JSON.stringify(m)}\n\n`);
        });
        beat = setInterval(() => {
          if (closed) return;
          if (claim) d.keepClaim();
          res.write(": keepalive\n\n");
        }, heartbeatMs);
        ttl = setTimeout(stop, streamMaxMs);
        log(`principal events: a stream opened${claim ? " (keeps the claim)" : ""} (${streamCount} open)`);
        return;
      }
      if (path === "/principal/waiting") {
        if (method !== "GET") return send(res, 405, { error: "method not allowed" });
        const claim = principal && url.searchParams.get("claim") === "1";
        const waitS = Math.min(WAIT_MAX_S, Math.max(0, Number(url.searchParams.get("wait") ?? 0) || 0));
        const afterRaw = url.searchParams.get("after");
        const after = afterRaw !== null && Number.isFinite(Number(afterRaw)) ? Number(afterRaw) : null;
        if (claim) d.keepClaim();
        if (waitS > 0) {
          const first = d.marker();
          const deadline = Date.now() + waitS * 1000;
          let gone = false;
          res.on("close", () => {
            gone = true;
          });
          const changed = () => {
            const m = d.marker();
            return (m.waiting && m.seq !== null && (after === null || m.seq > after)) || m.composing !== first.composing;
          };
          while (!gone && Date.now() < deadline && !changed()) await new Promise((r) => setTimeout(r, WAIT_LOOK_MS));
          if (gone) return;
          if (claim) d.keepClaim();
        }
        return send(res, 200, d.marker());
      }
      if (method !== "POST") return send(res, 405, { error: "method not allowed" });
      const text = await readBody(req);
      let raw: unknown = {};
      if (text.trim()) {
        try {
          raw = JSON.parse(text);
        } catch {
          return send(res, 400, { error: "the body is not JSON" });
        }
      }
      const out = await d.wake(raw);
      return out.ok ? send(res, 200, out.slate) : send(res, 400, { error: out.error });
    } catch (error) {
      return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? 8790, opts.host ?? "0.0.0.0", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : (opts.port ?? 8790);
      resolve({ port, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}
