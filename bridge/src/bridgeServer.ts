/**
 * The director face over HTTPS (Task 7): the two endpoints the town
 * client calls out to during a visit, both gated by the per-
 * installation token the owner sets in the service's environment
 * (BRIDGE_TOKEN) and in the town's visit settings.
 *
 *   POST /bridge/snapshot          BridgeSnapshotRequest -> BridgeSnapshotResponse
 *   GET  /bridge/directions?since=N                      -> BridgePullResponse
 *   POST /bridge/leaving                                 -> {"ok":true}  (Task 33)
 *
 * The token rides as `Authorization: Bearer <token>`; it is compared
 * in constant time over digests, so neither its length nor its bytes
 * leak through timing. A missing or wrong token is refused with a
 * bare 401 and one log line that never carries the value. TLS is the
 * host's (Railway terminates HTTPS in front of the service); this
 * process speaks plain HTTP on PORT, bound to every interface so the
 * platform can reach it.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { SlateFace } from "./slateFace.js";

export const DEFAULT_BRIDGE_PORT = 8790;
const MAX_BODY_BYTES = 2_000_000;

export type BridgeServerOptions = {
  face: SlateFace;
  token: string;
  port?: number;
  host?: string;
  /** The town's origin for CORS; "*" lets any origin try (the token still gates). */
  allowOrigin?: string;
  log?: (line: string) => void;
};

export type BridgeServerHandle = { port: number; close: () => Promise<void> };

const digest = (s: string): Buffer => createHash("sha256").update(s, "utf8").digest();

/** Constant-time over equal-length digests: no early exit on length or bytes. */
export function tokenMatches(presented: string | null, expected: string): boolean {
  if (presented === null || expected.length === 0) return false;
  return timingSafeEqual(digest(presented), digest(expected));
}

/** The bearer token out of an Authorization header, or null. */
export function bearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string") return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(value);
  return m ? m[1]! : null;
}

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

export function startBridgeServer(opts: BridgeServerOptions): Promise<BridgeServerHandle> {
  const { face, token } = opts;
  const log = opts.log ?? ((line: string) => console.log(line));
  const allowOrigin = opts.allowOrigin ?? "*";
  const send = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": allowOrigin,
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
      // The preflight carries no token (browsers send none); it learns
      // only which headers the real request may carry.
      if (method === "OPTIONS") return send(res, 204, {});
      if (path !== "/bridge/snapshot" && path !== "/bridge/directions" && path !== "/bridge/leaving") return send(res, 404, { error: "no such route" });
      const presented = bearerToken(req.headers.authorization);
      if (!tokenMatches(presented, token)) {
        log(`refused ${method} ${path}: ${presented === null ? "no token" : "wrong token"}`);
        return send(res, 401, { error: "refused" });
      }
      if (method === "POST" && path === "/bridge/snapshot") {
        const raw: unknown = JSON.parse(await readBody(req));
        const out = face.intake(raw);
        return out.ok ? send(res, 200, out) : send(res, 400, out);
      }
      if (method === "POST" && path === "/bridge/leaving") {
        // The town tab is closing (Task 33): ends after a grace unless it reports again.
        face.leaving();
        return send(res, 200, { ok: true });
      }
      if (method === "GET" && path === "/bridge/directions") {
        const since = Number(url.searchParams.get("since") ?? 0) || 0;
        return send(res, 200, face.pull(since));
      }
      return send(res, 405, { error: "method not allowed" });
    } catch (error) {
      return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? DEFAULT_BRIDGE_PORT, opts.host ?? "0.0.0.0", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : (opts.port ?? DEFAULT_BRIDGE_PORT);
      resolve({ port, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}
