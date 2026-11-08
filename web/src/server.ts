// The town on the web (Task 8): the plain HTTP transport the space
// runtime provides on the artifact line. One Bun server that
//
//   - serves the built client (client/dist via web/build.ts), index.html
//     and the service worker uncached, hashed files immutable;
//   - answers POST /actions, the one route the client's action proxy
//     calls: { action, args } in, { result, invalidate } out. Every call
//     carries the visitor's token, names that visitor's town and nothing
//     else (storage.pg.ts: search_path plus the town's advisory lock,
//     inside one transaction per request), and seeds the town on the
//     first call it ever makes;
//   - answers the two bridge routes with the visitor's token as bearer,
//     feeding that visitor's slate face (web/src/slates.ts), so the
//     client's Task 7 bridge leg works against its own origin unchanged;
//   - keeps the director door: the locked visit actions
//     (server/src/visitActions.ts) are admitted only with the service's
//     DIRECTOR_TOKEN beside the visitor's token, and refused quietly
//     (as an unknown action) otherwise;
//   - serves postcard images from the visitor's schema through signed
//     paths (web/src/blobStore.ts).
//
// No token is ever logged. Errors are answered as JSON with a status the
// client's retry layer reads.

import { resolve } from "node:path";
import type { z } from "zod";
import type { SlateFace } from "../../shared/slateFace";
import { DIRECTOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { postgresStorage, ensureTown, townSchemaName, withTown, type PgTownDb } from "../../server/src/storage.pg";
import { isDoorAction, type DoorDefinition } from "../../server/src/visitActions";
import { createBlobStore, readBlob, verifyBlobPath, BLOB_PATH_PREFIX } from "./blobStore";
import { createSlateKeeper, type SlateKeeper } from "./slates";
import { readVisitorToken, tokenMatches } from "./tokens";
import { createPairingDesk, type PairingDesk } from "./pairing";

export interface TownAction {
  request: z.ZodType;
  response: z.ZodType;
  handler(ctx: unknown, args: unknown): Promise<unknown>;
}

export interface TownServerOptions {
  db: PgTownDb;
  /** The town's actions (server/src/actions.ts). */
  actions: Record<string, TownAction>;
  /** The director door (server/src/visitActions.ts); none, no door. */
  door?: Record<string, DoorDefinition<z.ZodType, z.ZodType>>;
  /** Without it the door is shut: every door call reads as unknown. */
  directorToken: string | null;
  /** Signs the postcard paths. */
  blobSecret: string;
  /** The built client to serve; null serves no files (tests). */
  distDir: string | null;
  log?: (line: string) => void;
  now?: () => number;
  snapshotLapseMs?: number;
  /** Request body cap; the largest action (a postcard) is about 1.2 MB. */
  maxBodyBytes?: number;
}

export interface TownServer {
  fetch(req: Request): Promise<Response>;
  slates: SlateKeeper;
  pairing: PairingDesk;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

const HASHED_FILE = /-[0-9a-z]{8,}\.[a-z0-9]+$/i;

export function createTownServer(opts: TownServerOptions): TownServer {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? (() => Date.now());
  const maxBody = opts.maxBodyBytes ?? 2 * 1024 * 1024;
  const slates = createSlateKeeper({ now, ...(opts.snapshotLapseMs !== undefined ? { lapseMs: opts.snapshotLapseMs } : {}) });
  const door = opts.door ?? {};
  const pairing = createPairingDesk({ now });
  const dist = opts.distDir ? resolve(opts.distDir) : null;

  const readJson = async (req: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> => {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > maxBody) return { ok: false, response: json(413, { error: "too large" }) };
    let text: string;
    try {
      text = await req.text();
    } catch {
      return { ok: false, response: json(400, { error: "unreadable body" }) };
    }
    if (text.length > maxBody) return { ok: false, response: json(413, { error: "too large" }) };
    try {
      return { ok: true, body: text ? JSON.parse(text) : null };
    } catch {
      return { ok: false, response: json(400, { error: "invalid JSON" }) };
    }
  };

  const unknownAction = () => json(404, { error: "unknown action" });

  async function actionsRoute(req: Request): Promise<Response> {
    if (req.method !== "POST") return json(405, { error: "method not allowed" });
    const visitorToken = readVisitorToken(req);
    if (!visitorToken) return json(401, { error: "a visitor token is required" });
    const parsed = await readJson(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body as { action?: unknown; args?: unknown } | null;
    const action = body && typeof body === "object" && typeof body.action === "string" ? body.action : null;
    if (!action) return json(400, { error: "an action name is required" });
    const args = body?.args ?? {};
    const schemaName = townSchemaName(visitorToken);

    if (isDoorAction(action)) {
      const definition = door[action];
      if (!definition || !opts.directorToken || !tokenMatches(req.headers.get(DIRECTOR_TOKEN_HEADER), opts.directorToken)) {
        log(`refused door ${action}: ${definition ? (opts.directorToken ? "wrong director token" : "no door") : "no door"}`);
        return unknownAction();
      }
      const request = definition.request.safeParse(args);
      if (!request.success) return json(400, { error: "invalid arguments" });
      const face: SlateFace = slates.faceFor(schemaName);
      try {
        const result = await definition.handler(face, request.data);
        return json(200, { result: definition.response.parse(result), invalidate: false });
      } catch (error) {
        log(`door ${action} failed: ${error instanceof Error ? error.message : String(error)}`);
        return json(500, { error: "the door could not answer" });
      }
    }

    const definition = Object.prototype.hasOwnProperty.call(opts.actions, action) ? opts.actions[action] : undefined;
    if (!definition) return unknownAction();
    const request = definition.request.safeParse(args);
    if (!request.success) return json(400, { error: "invalid arguments" });
    try {
      await ensureTown(opts.db, schemaName);
      let invalidate = false;
      const result = await withTown(opts.db, schemaName, (tx) =>
        definition.handler(
          {
            db: () => tx,
            blobs: createBlobStore(tx, schemaName, opts.blobSecret),
            invalidateQueries: () => {
              invalidate = true;
            },
            inference: {
              async complete() {
                // The client asks for a local reply (Task 1); the chat
                // action falls back to its scripted line otherwise.
                throw new Error("The hosted town has no server-side voice.");
              },
            },
            storage: postgresStorage,
          },
          request.data,
        ),
      );
      const checked = definition.response.safeParse(result);
      if (!checked.success) {
        log(`action ${action} answered an invalid shape`);
        return json(500, { error: "the town answered an invalid shape" });
      }
      return json(200, { result: checked.data, invalidate });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`action ${action} failed: ${message}`);
      return json(500, { error: message });
    }
  }

  async function bridgeRoute(req: Request, url: URL): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    const visitorToken = readVisitorToken(req);
    if (!visitorToken) {
      log(`refused ${req.method} ${url.pathname}: no visitor token`);
      return json(401, { error: "refused" });
    }
    if (url.pathname === "/bridge/pair") {
      // Connect my Muse (Task 29): a single-use code for this town, which
      // only the hosted bridge (with the director token) can redeem.
      if (req.method !== "POST") return json(405, { error: "method not allowed" });
      return json(200, pairing.mint(visitorToken));
    }
    const face = slates.faceFor(townSchemaName(visitorToken));
    if (url.pathname === "/bridge/snapshot") {
      if (req.method !== "POST") return json(405, { error: "method not allowed" });
      const parsed = await readJson(req);
      if (!parsed.ok) return parsed.response;
      const result = face.intake(parsed.body);
      return result.ok ? json(200, result) : json(400, result);
    }
    if (url.pathname === "/bridge/directions") {
      if (req.method !== "GET") return json(405, { error: "method not allowed" });
      const since = Number(url.searchParams.get("since") ?? "0");
      return json(200, face.pull(Number.isFinite(since) ? since : 0));
    }
    return json(404, { error: "not found" });
  }

  // The other half of pairing (Task 29): the bridge trades a code for
  // the visitor key it names. Director token only; without it the route
  // does not exist, the same quiet refusal as the door's.
  async function pairRedeemRoute(req: Request): Promise<Response> {
    if (req.method !== "POST" || !opts.directorToken || !tokenMatches(req.headers.get(DIRECTOR_TOKEN_HEADER), opts.directorToken)) {
      return json(404, { error: "not found" });
    }
    const parsed = await readJson(req);
    if (!parsed.ok) return parsed.response;
    const code = (parsed.body as { code?: unknown } | null)?.code;
    const out = pairing.redeem(code);
    if (out.ok) {
      log("pair: a code was redeemed");
      return json(200, { visitorToken: out.visitorToken });
    }
    if (out.reason === "locked") {
      log("pair: redeem locked after repeated misses");
      return json(429, { error: "too many attempts; wait a minute" });
    }
    return json(404, { error: "no such code" });
  }

  async function blobRoute(req: Request, url: URL): Promise<Response> {
    if (req.method !== "GET") return json(405, { error: "method not allowed" });
    const named = verifyBlobPath(opts.blobSecret, url);
    if (!named) return json(404, { error: "not found" });
    const blob = await withTown(opts.db, named.schemaName, (tx) => readBlob(tx, named.key));
    if (!blob) return json(404, { error: "not found" });
    return new Response(blob.bytes, { status: 200, headers: { "content-type": blob.contentType, "cache-control": "private, max-age=31536000, immutable" } });
  }

  async function staticRoute(req: Request, url: URL): Promise<Response> {
    if (!dist) return json(404, { error: "not found" });
    if (req.method !== "GET" && req.method !== "HEAD") return json(405, { error: "method not allowed" });
    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return json(404, { error: "not found" });
    }
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const path = resolve(dist, relative);
    if (path !== dist && !path.startsWith(`${dist}/`)) return json(404, { error: "not found" });
    const file = Bun.file(path);
    if (!(await file.exists())) return json(404, { error: "not found" });
    const immutable = HASHED_FILE.test(relative) || relative.startsWith("assets/");
    const headers: Record<string, string> = {
      "content-type": file.type || "application/octet-stream",
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    };
    if (relative === "sw.js") headers["service-worker-allowed"] = "/";
    return new Response(req.method === "HEAD" ? null : file, { status: 200, headers });
  }

  return {
    slates,
    pairing,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/actions") return actionsRoute(req);
      if (url.pathname === "/director/pair-redeem") return pairRedeemRoute(req);
      if (url.pathname.startsWith("/bridge/")) return bridgeRoute(req, url);
      if (url.pathname.startsWith(BLOB_PATH_PREFIX)) return blobRoute(req, url);
      if (url.pathname === "/healthz") return json(200, { ok: true });
      return staticRoute(req, url);
    },
  };
}
