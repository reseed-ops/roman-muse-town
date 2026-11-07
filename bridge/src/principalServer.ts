/**
 * The principal channel over HTTPS (Task 22): the bridge's only public
 * face on the town channel, for exactly one caller, the owner's chat
 * Muse. Railway terminates TLS; this process speaks plain HTTP on PORT.
 *
 *   POST /principal/wake     PrincipalCall -> PrincipalSlate   (PRINCIPAL_TOKEN)
 *   GET  /principal/waiting                -> WaitingMarker    (PRINCIPAL_TOKEN, or the
 *                                                               read-only PRINCIPAL_MARKER_TOKEN)
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

const MAX_BODY_BYTES = 64_000;
export const WAIT_MAX_S = 25;
const WAIT_LOOK_MS = 250;

export type PrincipalServerOptions = {
  desk: PrincipalDesk;
  token: string;
  markerToken?: string | null;
  port?: number;
  host?: string;
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
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;
      const method = req.method ?? "GET";
      if (method === "OPTIONS") return send(res, 204, {});
      if (path === "/healthz" && method === "GET") return send(res, 200, { ok: true });
      if (path !== "/principal/wake" && path !== "/principal/waiting") return send(res, 404, { error: "no such route" });
      const presented = bearerToken(req.headers.authorization);
      const principal = tokenMatches(presented, token);
      const marker = !principal && markerToken !== null && path === "/principal/waiting" && tokenMatches(presented, markerToken);
      if (!principal && !marker) {
        log(`principal: refused ${method} ${path}: ${presented === null ? "no token" : "wrong token"}`);
        return send(res, 401, { error: "refused" });
      }
      if (path === "/principal/waiting") {
        if (method !== "GET") return send(res, 405, { error: "method not allowed" });
        const claim = principal && url.searchParams.get("claim") === "1";
        const waitS = Math.min(WAIT_MAX_S, Math.max(0, Number(url.searchParams.get("wait") ?? 0) || 0));
        const afterRaw = url.searchParams.get("after");
        const after = afterRaw !== null && Number.isFinite(Number(afterRaw)) ? Number(afterRaw) : null;
        if (claim) desk.keepClaim();
        if (waitS > 0) {
          const first = desk.marker();
          const deadline = Date.now() + waitS * 1000;
          let gone = false;
          res.on("close", () => {
            gone = true;
          });
          const changed = () => {
            const m = desk.marker();
            return (m.waiting && m.seq !== null && (after === null || m.seq > after)) || m.composing !== first.composing;
          };
          while (!gone && Date.now() < deadline && !changed()) await new Promise((r) => setTimeout(r, WAIT_LOOK_MS));
          if (gone) return;
          if (claim) desk.keepClaim();
        }
        return send(res, 200, desk.marker());
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
      const out = await desk.wake(raw);
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
