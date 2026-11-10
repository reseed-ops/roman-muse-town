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
import { BRIDGE_HOLD_S, DIRECTOR_TOKEN_HEADER } from "../../shared/visitProtocol";

/** Read actions whose answers carry a digest, answered 304 when unchanged (Task 41). */
const DIGEST_ACTIONS = new Set(["getState"]);

/** How often a held read looks for news. */
const HOLD_LOOK_MS = 250;
import { postgresStorage, ensureTown, isTownReady, townExists, townSchemaName, withTown, type PgTownDb } from "../../server/src/storage.pg";
import { isDoorAction, type DoorDefinition } from "../../server/src/visitActions";
import { createBlobStore, readBlob, verifyBlobPath, BLOB_BROWSER_MAX_AGE_S, BLOB_PATH_PREFIX } from "./blobStore";
import { createSlateKeeper, SlatesFull, type SlateKeeper } from "./slates";
import { readVisitorToken, tokenMatches } from "./tokens";
import { createPairingDesk, PairingFull, type PairingDesk } from "./pairing";
import { createFlightGate, createWindowLimiter, clientAddress } from "./limits";
import { createPairingState, type PairingState } from "./pairingState";
import { createTownKeeper, type TownKeeper } from "./townKeeper";
import { PG_MIGRATIONS } from "../../server/src/pgMigrations";
import { createTallies, formatTallies, type Tallies } from "./tallies";

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
  /** Trust X-Real-IP as the caller's address (only behind a proxy that sets it; Task 61). */
  trustProxy?: boolean;
  /** Overrides for the public limits (Task 61); the defaults are in DEFAULT_LIMITS. */
  limits?: Partial<TownLimits>;
  /** Reads the town's closeness rank inside a town transaction (Task 62; actions.ts readAffectionRank); none, every town reads as rank 0. */
  readRank?: (ctx: { db: () => unknown }) => Promise<number>;
  /** Bytes of images one town may hold (default blobStore.ts TOWN_BLOB_QUOTA_BYTES). */
  blobQuotaBytes?: number;
  /** How long the /stats report is reused, ms (default 30 s). */
  statsCacheMs?: number;
  /** Days an untouched town is kept before it is dropped; 0 keeps every town (townKeeper.ts). */
  retentionDays?: number;
}

/** What the public town allows, per minute unless named (Task 61). */
export interface TownLimits {
  /** Actions per town per minute (the client's own polling is far below it). */
  actionsPerTown: number;
  /** Actions per caller address per minute (many towns may share one address). */
  actionsPerAddress: number;
  /** Heavy actions (postcards, saves) per town per minute. */
  heavyPerTown: number;
  /** New towns one address may make per hour, and all addresses together per minute. */
  newTownsPerAddressPerHour: number;
  newTownsPerMinute: number;
  /** Towns that may exist at all; creation stops beyond it. */
  maxTowns: number;
  /** Actions running at once, per town and in all. */
  actionsInFlightPerTown: number;
  actionsInFlight: number;
  /** Held reads open at once, per town and in all. */
  heldPerTown: number;
  heldTotal: number;
  /** Bridge calls (snapshot, leaving, directions) per town per minute. */
  bridgePerTown: number;
  /** Pairing codes one town may ask for in ten minutes. */
  pairMintsPerTown: number;
}

export const DEFAULT_LIMITS: TownLimits = {
  actionsPerTown: 240,
  actionsPerAddress: 900,
  heavyPerTown: 12,
  newTownsPerAddressPerHour: 12,
  newTownsPerMinute: 60,
  maxTowns: 50_000,
  actionsInFlightPerTown: 4,
  actionsInFlight: 64,
  heldPerTown: 2,
  heldTotal: 300,
  bridgePerTown: 240,
  pairMintsPerTown: 6,
};

/** Actions that move images or whole saves: limited harder. */
const HEAVY_ACTIONS = new Set(["addPostcard", "restoreSave", "exportSave"]);

const tooMany = (what: string, retryAfterS = 30): Response =>
  json(429, { error: `${what}; wait a moment and try again` }, { "retry-after": String(retryAfterS) });

export interface TownServer {
  /** `socketAddress` is the connection's own address (Bun's requestIP); see trustProxy. */
  fetch(req: Request, socketAddress?: string): Promise<Response>;
  slates: SlateKeeper;
  pairing: PairingDesk;
  tallies: Tallies;
  keeper: TownKeeper;
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
  const tallies = createTallies(opts.db, log);
  const pairingState: PairingState = createPairingState(opts.db);
  const keeper = createTownKeeper(opts.db, { now, log, ...(opts.retentionDays !== undefined ? { retentionDays: opts.retentionDays } : {}) });
  const lim: TownLimits = { ...DEFAULT_LIMITS, ...opts.limits };
  const minute = 60_000;
  const townActions = createWindowLimiter({ max: lim.actionsPerTown, windowMs: minute, now });
  const addressActions = createWindowLimiter({ max: lim.actionsPerAddress, windowMs: minute, now });
  const heavyActions = createWindowLimiter({ max: lim.heavyPerTown, windowMs: minute, now });
  const newTownsByAddress = createWindowLimiter({ max: lim.newTownsPerAddressPerHour, windowMs: 60 * minute, now });
  const newTownsAll = createWindowLimiter({ max: lim.newTownsPerMinute, windowMs: minute, maxKeys: 1, now });
  const bridgeCalls = createWindowLimiter({ max: lim.bridgePerTown, windowMs: minute, now });
  const bridgeByAddress = createWindowLimiter({ max: lim.actionsPerAddress, windowMs: minute, now });
  const pairMints = createWindowLimiter({ max: lim.pairMintsPerTown, windowMs: 10 * minute, now });
  const actionFlight = createFlightGate({ perKey: lim.actionsInFlightPerTown, total: lim.actionsInFlight });
  const heldFlight = createFlightGate({ perKey: lim.heldPerTown, total: lim.heldTotal });
  const trustProxy = opts.trustProxy ?? false;
  // The reaper: at start (after a minute, off the boot path), then daily.
  if (opts.retentionDays !== 0 && opts.distDir !== null) {
    const run = () => void keeper.reap().catch((error) => log(`reap failed: ${error instanceof Error ? error.message : String(error)}`));
    setTimeout(run, minute).unref?.();
    setInterval(run, 24 * 60 * minute).unref?.();
  }
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

  // The town's own rank for a visitor, for the director door (Task 62):
  // read from the town's database, kept 15 s so a director's 2 s reads do
  // not each cost a query, and 0 for a town that does not exist yet (the
  // door never creates one).
  const ranks = new Map<string, { at: number; rank: number }>();
  async function rankFor(schemaName: string): Promise<number> {
    if (!opts.readRank) return 0;
    const hit = ranks.get(schemaName);
    if (hit && now() - hit.at < 15_000) return hit.rank;
    let rank = 0;
    try {
      if (isTownReady(schemaName) || (await townExists(opts.db, schemaName))) {
        rank = await withTown(opts.db, schemaName, (tx) => opts.readRank!({ db: () => tx }));
        rank = Number.isInteger(rank) ? Math.max(0, Math.min(10, rank)) : 0;
      }
    } catch (error) {
      log(`rank read failed: ${error instanceof Error ? error.message : String(error)}`);
      rank = 0;
    }
    if (ranks.size > 2000) ranks.clear();
    ranks.set(schemaName, { at: now(), rank });
    return rank;
  }

  async function actionsRoute(req: Request, address: string): Promise<Response> {
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

    // Public limits (Task 61), before any database work. A door call is
    // the director's own and is not counted against a visitor's town.
    if (!isDoorAction(action)) {
      if (!addressActions.take(address)) return tooMany("too many requests from here");
      if (!townActions.take(schemaName)) return tooMany("too many requests from this town");
      if (HEAVY_ACTIONS.has(action) && !heavyActions.take(schemaName)) return tooMany("too many saves or postcards in a short time", 60);
    }

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
        const result = await definition.handler(face, request.data, { rank: await rankFor(schemaName), pairingGeneration: await pairingState.generation(schemaName) });
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
    const release = actionFlight.enter(schemaName);
    if (!release) return json(503, { error: "The town is busy; try again in a moment." }, { "retry-after": "5" });
    try {
      // Admission (Task 61): a returning town is let in; a new one has to
      // pass the creation limits first, so a flood of unique keys cannot
      // make schemas without bound.
      if (!isTownReady(schemaName) && !(await townExists(opts.db, schemaName))) {
        if (!newTownsByAddress.take(address)) return tooMany("too many new towns from here", 600);
        if (!newTownsAll.take("all")) return tooMany("many new towns are arriving; try again shortly", 60);
        if ((await keeper.townCount()) >= lim.maxTowns) return json(503, { error: "The town is not taking new visitors just now." }, { "retry-after": "600" });
      }
      // A town whose every migration ran just now was created just now (Task 52).
      const ran = await ensureTown(opts.db, schemaName);
      if (ran > 0 && ran === PG_MIGRATIONS.length) await tallies.bump("town-created");
      void keeper.touch(schemaName);
      let invalidate = false;
      const result = await withTown(opts.db, schemaName, (tx) =>
        definition.handler(
          {
            db: () => tx,
            blobs: createBlobStore(tx, schemaName, opts.blobSecret, opts.blobQuotaBytes, now),
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
      const payload = { result: checked.data, invalidate };
      if (DIGEST_ACTIONS.has(action)) {
        // Unchanged answers (Task 41, after Musebook's seen=<digest>): the
        // town's state read carries a digest of itself; asked again with
        // the same digest, it answers 304 and sends nothing.
        const text = JSON.stringify(payload);
        const tag = `"${Bun.hash(text).toString(36)}"`;
        if (req.headers.get("if-none-match") === tag) return new Response(null, { status: 304, headers: { etag: tag, "cache-control": "no-store" } });
        return new Response(text, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", etag: tag } });
      }
      return json(200, payload);
    } catch (error) {
      // The detail stays in the log; the browser gets a plain answer and
      // a reference that finds the log line, never the exception itself.
      const message = error instanceof Error ? error.message : String(error);
      const ref = crypto.randomUUID().slice(0, 8);
      log(`action ${action} failed [${ref}]: ${message}`);
      return json(500, { error: `The town could not finish that. Try again in a moment (ref ${ref}).` });
    } finally {
      release();
    }
  }

  async function bridgeRoute(req: Request, url: URL, address: string): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    const visitorToken = readVisitorToken(req);
    if (!visitorToken) {
      log(`refused ${req.method} ${url.pathname}: no visitor token`);
      return json(401, { error: "refused" });
    }
    if (!bridgeByAddress.take(address)) return tooMany("too many requests from here");
    if (!bridgeCalls.take(townSchemaName(visitorToken))) return tooMany("too many requests from this town");
    if (url.pathname === "/bridge/pair") {
      // Connect my Muse (Task 29): a single-use code for this town, which
      // only the hosted bridge (with the director token) can redeem.
      if (req.method !== "POST") return json(405, { error: "method not allowed" });
      if (!pairMints.take(townSchemaName(visitorToken))) return tooMany("too many pairing codes asked for", 300);
      let minted: ReturnType<PairingDesk["mint"]>;
      try {
        minted = pairing.mint(visitorToken);
      } catch (error) {
        if (error instanceof PairingFull) return json(503, { error: "Pairing is busy; try again in a few minutes." }, { "retry-after": "300" });
        throw error;
      }
      await tallies.bump("pair-minted");
      return json(200, minted);
    }
    if (url.pathname === "/bridge/disconnect") {
      // Disconnect my Muse (Task 63): from the visitor's own, authenticated
      // town, every principal token made so far stops working.
      if (req.method !== "POST") return json(405, { error: "method not allowed" });
      const generation = await pairingState.bump(townSchemaName(visitorToken));
      pairing.forget(visitorToken);
      log("pair: a town disconnected its Muse");
      return json(200, { ok: true, generation });
    }
    let face: SlateFace;
    try {
      face = slates.faceFor(townSchemaName(visitorToken));
    } catch (error) {
      if (error instanceof SlatesFull) return json(503, { error: "Too many visits are open; try again shortly." }, { "retry-after": "60" });
      throw error;
    }
    if (url.pathname === "/bridge/snapshot") {
      if (req.method !== "POST") return json(405, { error: "method not allowed" });
      const parsed = await readJson(req);
      if (!parsed.ok) return parsed.response;
      const result = face.intake(parsed.body);
      return result.ok ? json(200, result) : json(400, result);
    }
    if (url.pathname === "/bridge/leaving") {
      // The tab is closing or navigating away (Task 33): the visit ends
      // after a short grace unless it reports again (a reload does).
      if (req.method !== "POST") return json(405, { error: "method not allowed" });
      face.leaving();
      return json(200, { ok: true });
    }
    if (url.pathname === "/bridge/directions") {
      if (req.method !== "GET") return json(405, { error: "method not allowed" });
      const sinceRaw = Number(url.searchParams.get("since") ?? "0");
      const since = Number.isFinite(sinceRaw) ? sinceRaw : 0;
      // A held read (Task 41): wait up to BRIDGE_HOLD_S for news, then answer as ever.
      const waitS = Math.min(BRIDGE_HOLD_S, Math.max(0, Number(url.searchParams.get("wait") ?? 0) || 0));
      const composingParam = url.searchParams.get("composing");
      const composingHeld = composingParam === null ? undefined : composingParam === "1";
      if (waitS > 0) {
        // Held reads are bounded (Task 61): a town holds a couple, the
        // service a few hundred; a held read over the line answers now.
        const releaseHold = heldFlight.enter(townSchemaName(visitorToken));
        if (releaseHold) {
          try {
            const deadline = now() + waitS * 1000;
            while (!face.hasNews(since, composingHeld) && now() < deadline && !req.signal.aborted) await Bun.sleep(HOLD_LOOK_MS);
          } finally {
            releaseHold();
          }
          if (req.signal.aborted) return json(499, { error: "gone" });
        }
      }
      return json(200, face.pull(since));
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
      // Pairing again retires every earlier token: the generation moves on,
      // and the new token is sealed with it (Task 63).
      let generation: number;
      try {
        generation = await pairingState.bump(townSchemaName(out.visitorToken));
      } catch (error) {
        // Fail closed: a token that could not retire the old ones is not handed out.
        log(`pair: generation could not be moved: ${error instanceof Error ? error.message : String(error)}`);
        return json(503, { error: "the town could not finish pairing; make a new code and try again" });
      }
      log("pair: a code was redeemed");
      await tallies.bump("pair-redeemed");
      return json(200, { visitorToken: out.visitorToken, generation });
    }
    if (out.reason === "locked") {
      log("pair: redeem locked after repeated misses");
      return json(429, { error: "too many attempts; wait a minute" });
    }
    return json(404, { error: "no such code" });
  }

  async function blobRoute(req: Request, url: URL): Promise<Response> {
    if (req.method !== "GET") return json(405, { error: "method not allowed" });
    const named = verifyBlobPath(opts.blobSecret, url, now());
    if (!named) return json(404, { error: "not found" });
    const blob = await withTown(opts.db, named.schemaName, (tx) => readBlob(tx, named.key));
    if (!blob) return json(404, { error: "not found" });
    return new Response(blob.bytes, { status: 200, headers: { "content-type": blob.contentType, "cache-control": `private, max-age=${BLOB_BROWSER_MAX_AGE_S}` } });
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

  // The anonymous counts (Task 52), plain text for the owner's browser.
  // The report is cached for half a minute (Task 61): it counts schemas.
  let cachedReport: { at: number; report: Awaited<ReturnType<Tallies["report"]>> } | null = null;
  async function statsRoute(req: Request): Promise<Response> {
    if (req.method !== "GET") return json(405, { error: "method not allowed" });
    try {
      if (!cachedReport || now() - cachedReport.at >= (opts.statsCacheMs ?? 30_000)) cachedReport = { at: now(), report: await tallies.report() };
      const report = cachedReport.report;
      if (new URL(req.url).searchParams.get("format") === "json") return json(200, report);
      return new Response(formatTallies(report), { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    } catch (error) {
      log(`stats failed: ${error instanceof Error ? error.message : String(error)}`);
      return json(500, { error: "the counts could not be read" });
    }
  }

  return {
    slates,
    pairing,
    tallies,
    keeper,
    async fetch(req, socketAddress) {
      const url = new URL(req.url);
      const address = clientAddress(req, socketAddress, trustProxy);
      if (url.pathname === "/actions") return actionsRoute(req, address);
      if (url.pathname === "/director/pair-redeem") return pairRedeemRoute(req);
      if (url.pathname.startsWith("/bridge/")) return bridgeRoute(req, url, address);
      if (url.pathname.startsWith(BLOB_PATH_PREFIX)) return blobRoute(req, url);
      if (url.pathname === "/healthz") return json(200, { ok: true });
      if (url.pathname === "/stats") return statsRoute(req);
      return staticRoute(req, url);
    },
  };
}
