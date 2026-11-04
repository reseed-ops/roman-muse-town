/**
 * The director seam's local dev harness (Task 4, Nov 2026): a tiny
 * localhost HTTP service over visitHarnessStore. Nothing phones home;
 * there are no accounts; it holds one slate in memory and forgets it
 * when the visit closes or the client goes quiet.
 *
 * Run it beside the town:
 *
 *     bun run harness/visitHarness.ts            # http://localhost:8787
 *     VISIT_HARNESS_PORT=9000 bun run harness/visitHarness.ts
 *
 * Point the town at it (the client reads, in order, a ?harness= query
 * parameter, then localStorage "muse-town-visit-harness", defaulting to
 * http://localhost:8787), then open a visit from the town menu or ask
 * the harness to (POST /visit/begin).
 *
 * The seam, as HTTP (JSON both ways, CORS open for the town's origin):
 *
 *   CLIENT face
 *     POST /visit/sync        ClientSyncRequest -> ClientSyncResponse
 *
 *   DIRECTOR face
 *     GET  /visit/state       VisitStateView + { clientSeenAt, stale }
 *     GET  /visit/inbox?since=N        VisitMail[] with seq > N
 *     GET  /visit/frame[?id=N]         one VisitFrame (latest by default), 404 if none
 *     POST /visit/direct      a raw direction -> { ok, id } | { ok:false, error }
 *     POST /visit/composing   { on: boolean }
 *     POST /visit/begin       ask the client to open a visit on its next beat
 *     POST /visit/end         ask the client to end the visit on its next beat
 *     GET  /visit/pack        DirectorPack
 *     PUT  /visit/pack        { text } -> DirectorPack
 *
 * A curl walk-through (the Gate 0 proof: a non-agent process reads
 * state and enqueues one direction):
 *
 *     curl -s localhost:8787/visit/state
 *     curl -s -X POST localhost:8787/visit/direct -H 'content-type: application/json' \
 *          -d '{"kind":"speak","text":"There you are."}'
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  clientSync,
  directorBegin,
  directorComposing,
  directorEnd,
  directorEnqueue,
  directorFrame,
  directorInbox,
  directorState,
  emptyStore,
  putPack,
  type HarnessStore,
} from "./visitHarnessStore";
import type { ClientSyncRequest } from "../shared/visitProtocol";
import { validateFrameDataUrl } from "../client/src/visitFrames";

export const DEFAULT_HARNESS_PORT = 8787;
const MAX_BODY_BYTES = 2_000_000;

export type HarnessHandle = { port: number; close: () => Promise<void>; store: () => HarnessStore };

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

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}

/** Start the harness. `now` is injectable for tests. */
export function startHarness(opts: { port?: number; now?: () => number; log?: (line: string) => void } = {}): Promise<HarnessHandle> {
  let store = emptyStore();
  const now = opts.now ?? (() => Date.now());
  const log = opts.log ?? ((line: string) => console.log(line));
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;
      const method = req.method ?? "GET";
      if (method === "OPTIONS") return send(res, 204, {});
      if (method === "POST" && path === "/visit/sync") {
        const body = JSON.parse(await readBody(req)) as ClientSyncRequest;
        if (!body || typeof body !== "object" || !body.state) return send(res, 400, { error: "a sync carries state" });
        // Frames are validated at the seam: a real JPEG head, the byte cap.
        const newFrames = (Array.isArray(body.newFrames) ? body.newFrames : []).filter((f) => validateFrameDataUrl(f?.dataUrl).ok);
        const out = clientSync(store, { ...body, newFrames, inbox: Array.isArray(body.inbox) ? body.inbox : [], enactedThrough: Number(body.enactedThrough) || 0 }, now());
        store = out.store;
        return send(res, 200, out.response);
      }
      if (method === "GET" && path === "/visit/state") {
        const out = directorState(store, now());
        store = out.store;
        return send(res, 200, out.view);
      }
      if (method === "GET" && path === "/visit/inbox") {
        const since = Number(url.searchParams.get("since") ?? 0) || 0;
        const out = directorInbox(store, since, now());
        store = out.store;
        return send(res, 200, out.mail);
      }
      if (method === "GET" && path === "/visit/frame") {
        const idParam = url.searchParams.get("id");
        const out = directorFrame(store, idParam === null ? null : Number(idParam), now());
        store = out.store;
        return out.frame ? send(res, 200, out.frame) : send(res, 404, { error: "no frame" });
      }
      if (method === "POST" && path === "/visit/direct") {
        const raw: unknown = JSON.parse(await readBody(req));
        const out = directorEnqueue(store, raw, now());
        store = out.store;
        if (!out.result.ok) return send(res, 400, { ok: false, error: out.result.error });
        log(`direction #${out.id}: ${JSON.stringify(out.result.direction)}`);
        return send(res, 200, { ok: true, id: out.id });
      }
      if (method === "POST" && path === "/visit/composing") {
        const body = JSON.parse(await readBody(req)) as { on?: unknown };
        store = directorComposing(store, body?.on === true, now());
        return send(res, 200, { ok: true, composing: store.composing });
      }
      if (method === "POST" && path === "/visit/begin") {
        store = directorBegin(store, now());
        return send(res, 200, { ok: true });
      }
      if (method === "POST" && path === "/visit/end") {
        store = directorEnd(store, now());
        return send(res, 200, { ok: true });
      }
      if (method === "GET" && path === "/visit/pack") return send(res, 200, store.pack);
      if (method === "PUT" && path === "/visit/pack") {
        const body = JSON.parse(await readBody(req)) as { text?: unknown };
        if (typeof body?.text !== "string") return send(res, 400, { error: "a pack is { text }" });
        store = putPack(store, body.text, now());
        return send(res, 200, store.pack);
      }
      return send(res, 404, { error: "no such route" });
    } catch (error) {
      return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? DEFAULT_HARNESS_PORT, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : (opts.port ?? DEFAULT_HARNESS_PORT);
      resolve({
        port,
        store: () => store,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

const isMain = typeof process !== "undefined" && process.argv[1]?.endsWith("visitHarness.ts");
if (isMain) {
  const port = Number(process.env.VISIT_HARNESS_PORT) || DEFAULT_HARNESS_PORT;
  void startHarness({ port }).then((h) => console.log(`visit harness listening on http://localhost:${h.port}`));
}
