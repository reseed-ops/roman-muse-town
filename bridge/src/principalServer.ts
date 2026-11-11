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
 * With the principal token, `claim=1` renews a claim she already holds at
 * the start and at the answer, while her last real wake is under 10 minutes
 * old (Task 67); it never takes one, and the marker token can never claim.
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
 * The waiting marker carries only numbers, times and flags (a line's sequence
 * number and time, the composing flag, the visit id, a revision, the newest
 * line number and when the bridge saw it), never text. It is still a sign of when the
 * owner is in his town, so it is not public: it answers to either
 * token, and the lesser one can read nothing else.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { bearerToken, tokenMatches } from "./bridgeServer.js";
import type { PrincipalDesk } from "./principal.js";
import { createPairLimiter, type PairLimits } from "./pairLimiter.js";
import { createAttemptWindow, createSampledLog, createStreamWriter, credentialKey } from "./streamGuard.js";

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
 *  from idling it out (and renews a claim she holds, with claim=1, within the desk's
 *  heartbeat bound); a stream ends after STREAM_MAX_MS, and its credential is looked
 *  at again every STREAM_RECHECK_MS (Task 67); the watcher reconnects. */
export const STREAM_HEARTBEAT_MS = 15_000;
export const STREAM_MAX_MS = 10 * 60 * 1000;
/** Open streams per desk and in all. The oldest of a desk's own class is closed past its cap:
 *  claim holders (the principal token, a paired token) and read-only observers (the marker
 *  token) are counted and evicted separately, so an observer can never push a holder off. */
export const STREAMS_PER_DESK = 3;
export const MARKER_STREAMS_PER_DESK = 1;
export const STREAMS_TOTAL = 64;
/** A stream's credential is checked again this often, so a revoked or expired one ends within it. */
export const STREAM_RECHECK_MS = 60_000;
/** A stream with more than this unsent is cut; one that stays full this long is cut too. */
export const STREAM_MAX_BUFFER = 64 * 1024;
export const STREAM_STALL_MS = 30_000;
/** Stream connection attempts per source address and per credential, per minute. */
export const EVENT_ATTEMPTS = { perSource: 30, perCredential: 20, windowMs: 60_000 };
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
  streamRecheckMs?: number;
  streamsTotal?: number;
  streamStallMs?: number;
  streamMaxBuffer?: number;
  /** Overrides for the stream-attempt limits (tests). */
  eventAttempts?: Partial<typeof EVENT_ATTEMPTS>;
  /** Overrides for the failed-auth limits on the principal routes (tests). */
  authLimits?: Partial<PairLimits>;
  log?: (line: string) => void;
};

export type PrincipalServerHandle = { port: number; close: () => Promise<void>; /** Open streams, and the desks that hold any (an empty desk entry is deleted). */ streams: () => { open: number; desks: number } };

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
  // Task 67: the same limiter, for failed auth (and bounded upstream lookups) on the principal routes.
  const authLimiter = createPairLimiter(opts.authLimits ?? {});
  const attempts = { ...EVENT_ATTEMPTS, ...opts.eventAttempts };
  const bySource = createAttemptWindow(attempts.perSource, attempts.windowMs);
  const byCredential = createAttemptWindow(attempts.perCredential, attempts.windowMs);
  const sampled = createSampledLog(log);
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
  const recheckMs = opts.streamRecheckMs ?? STREAM_RECHECK_MS;
  const streams = new Map<PrincipalDesk, { holders: Set<() => void>; observers: Set<() => void> }>();
  type Auth = { principal: boolean; d: PrincipalDesk };
  /** Who this token is for this route: the owner, the read-only marker token, or a paired town. */
  const staticAuth = (presented: string | null, path: string): Auth | null => {
    if (token !== null && desk !== null && tokenMatches(presented, token)) return { principal: true, d: desk };
    const readsMarker = path === "/principal/waiting" || path === "/principal/events";
    if (readsMarker && markerToken !== null && desk !== null && tokenMatches(presented, markerToken)) return { principal: false, d: desk };
    return null;
  };
  const pairedAuth = async (presented: string | null): Promise<Auth | null> => {
    const d = opts.resolve ? await opts.resolve(presented) : null;
    return d ? { principal: true, d } : null;
  };
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
      let auth = staticAuth(presented, path);
      if (!auth) {
        // Not a static token: the lookup (a paired token's HMAC and generation check) and every
        // failure are bounded per address and overall by the pairing limiter (Task 67).
        const slot = authLimiter.reserve(callerAddress(req, trustProxy));
        if (!slot.ok) {
          sampled("auth-limit", `principal: a caller was refused (${slot.reason})`);
          return send(res, 429, { error: "too many refused attempts from here; wait a few minutes" });
        }
        try {
          auth = await pairedAuth(presented);
        } catch (error) {
          slot.settle("release");
          throw error;
        }
        slot.settle(auth ? "release" : "miss");
      }
      if (!auth) {
        sampled("refused", `principal: refused ${method} ${path}: ${presented === null ? "no token" : "wrong token"}`);
        return send(res, 401, { error: "refused" });
      }
      const { principal, d } = auth;
      if (path === "/principal/events") {
        // Task 66: the box subscribes (outbound), the bridge pushes the marker down
        // the open response. The marker only: numbers, times and flags, never text;
        // the watcher then makes the usual wake call.
        if (method !== "GET") return send(res, 405, { error: "method not allowed" });
        if (!bySource.hit(callerAddress(req, trustProxy)) || !byCredential.hit(credentialKey(presented ?? ""))) {
          sampled("events-rate", "principal events: a stream attempt was refused (too many attempts)");
          return send(res, 429, { error: "too many stream attempts; slow down" });
        }
        const claim = principal && url.searchParams.get("claim") === "1";
        let group = streams.get(d);
        if (!group) streams.set(d, (group = { holders: new Set(), observers: new Set() }));
        const mine = principal ? group.holders : group.observers;
        const cap = principal ? STREAMS_PER_DESK : MARKER_STREAMS_PER_DESK;
        // The total cap counts what eviction frees: a desk's own reconnect replaces its oldest.
        if (streamCount - (mine.size >= cap ? mine.size - cap + 1 : 0) >= (opts.streamsTotal ?? STREAMS_TOTAL)) {
          if (!group.holders.size && !group.observers.size) streams.delete(d);
          sampled("events-full", "principal events: a stream was refused (all slots taken)");
          return send(res, 503, { error: "too many open streams" });
        }
        while (mine.size >= cap) [...mine][0]!();
        // Task 68: evicting the lone stream empties the group and deletes its map entry; put it
        // back, so the cap keeps counting the replacement and no further stream can coexist.
        if (streams.get(d) !== group) streams.set(d, group);
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
        let recheck: ReturnType<typeof setInterval> | null = null;
        let writer: ReturnType<typeof createStreamWriter> | null = null;
        const stop = (why = "closed", destroy = false) => {
          if (closed) return;
          closed = true;
          writer?.close();
          unsubscribe();
          if (beat) clearInterval(beat);
          if (ttl) clearTimeout(ttl);
          if (recheck) clearInterval(recheck);
          mine.delete(stop);
          if (!group!.holders.size && !group!.observers.size && streams.get(d) === group) streams.delete(d);
          streamCount -= 1;
          // A cut reader is destroyed, not politely ended: ending flushes queued bytes into a
          // socket that cannot drain and would keep the transport after its slot is freed.
          if (destroy) res.destroy();
          else res.end();
          log(`principal events: a stream ${why} (${streamCount} open)`);
        };
        writer = createStreamWriter(res, {
          maxBuffer: opts.streamMaxBuffer ?? STREAM_MAX_BUFFER,
          stallMs: opts.streamStallMs ?? STREAM_STALL_MS,
          abandon: (reason) => stop(reason === "buffer" ? "was cut: its reader fell behind" : "was cut: its reader stalled", true),
        });
        streamCount += 1;
        mine.add(stop);
        req.on("close", () => stop());
        res.write("retry: 3000\n\n");
        if (claim) d.keepClaim();
        let first = true;
        let timedSeq = 0;
        unsubscribe = d.subscribe((m) => {
          if (closed) return;
          // Metadata-only timing: logged when the marker is actually handed to the socket (a marker
          // held back by a full socket logs when it drains; one coalesced away never logs). This is
          // not client receipt.
          let onWrite: (() => void) | undefined;
          if (!first && m.latestSeq > 0 && m.latestSeq !== timedSeq && m.lastLineAt !== null) {
            timedSeq = m.latestSeq;
            const seq = m.latestSeq;
            const sawAt = m.lastLineAt;
            onWrite = () => log(`principal events: line ${seq} handed to the socket ${Math.max(0, Date.now() - sawAt)} ms after the bridge first observed it (not client receipt)`);
          }
          first = false;
          writer?.marker(`event: marker\ndata: ${JSON.stringify(m)}\n\n`, onWrite);
        });
        beat = setInterval(() => {
          if (closed) return;
          if (claim) d.keepClaim();
          d.refresh();
          writer?.comment(": keepalive\n\n");
          writer?.check();
        }, heartbeatMs);
        // Revocation (Task 67): the credential is looked at again each recheck; a revoked,
        // expired or rotated one ends the stream (and so its claim renewals) within that.
        let checking = false;
        recheck = setInterval(() => {
          if (closed || checking) return;
          checking = true;
          void (async () => {
            try {
              const now = staticAuth(presented, path) ?? (await pairedAuth(presented));
              if (!now || now.d !== d || now.principal !== principal) stop("ended: its credential no longer holds");
            } catch {
              stop("ended: its credential could not be checked");
            } finally {
              checking = false;
            }
          })();
        }, recheckMs);
        ttl = setTimeout(() => stop("ended (time is up; the watcher reconnects)"), streamMaxMs);
        log(`principal events: a stream opened${claim ? " (keeps her claim while she is on duty)" : ""} (${streamCount} open)`);
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
      resolve({ port, close: () => new Promise((done) => { server.closeAllConnections?.(); server.close(() => done()); }), streams: () => ({ open: streamCount, desks: streams.size }) });
    });
  });
}
