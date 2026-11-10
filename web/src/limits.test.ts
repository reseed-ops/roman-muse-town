// Public limits on the hosted town (Task 61): sustained requests and
// unique-key floods stay bounded and the town stays usable.

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { forgetReadyTowns, townSchemaName, type PgTownDb } from "../../server/src/storage.pg";
import { createFlightGate, createWindowLimiter, clientAddress } from "./limits";
import { createPairingDesk, PairingFull } from "./pairing";
import { createSlateKeeper, SlatesFull } from "./slates";
import { createTownServer, type TownAction, type TownServer } from "./server";

const onPostgres = process.env.TOWN_DIALECT === "postgres";
const key = (n: number) => `limits-key-${String(n).padStart(8, "0")}-aaaa-bbbb`;

describe("the limiters are bounded themselves", () => {
  test("a window limiter refuses past its max, expires, and never grows past maxKeys", () => {
    let t = 0;
    const lim = createWindowLimiter({ max: 2, windowMs: 1000, maxKeys: 100, now: () => t });
    expect([lim.take("a"), lim.take("a"), lim.take("a")]).toEqual([true, true, false]);
    t = 1001;
    expect(lim.take("a")).toBe(true);
    for (let i = 0; i < 5000; i++) lim.take(`k${i}`);
    expect(lim.size()).toBeLessThanOrEqual(100);
  });
  test("a flight gate counts per key and overall, and a release is safe twice", () => {
    const gate = createFlightGate({ perKey: 1, total: 2 });
    const a = gate.enter("a")!;
    expect(gate.enter("a")).toBeNull();
    const b = gate.enter("b")!;
    expect(gate.enter("c")).toBeNull();
    a();
    a();
    b();
    expect(gate.active()).toBe(0);
  });
  test("X-Real-IP counts only behind a trusted proxy", () => {
    const req = new Request("http://t/", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(clientAddress(req, "1.1.1.1", false)).toBe("1.1.1.1");
    expect(clientAddress(req, "1.1.1.1", true)).toBe("9.9.9.9");
  });
  test("the pairing desk and the slate keeper refuse past their caps", () => {
    const desk = createPairingDesk({ maxCodes: 2 });
    desk.mint(key(1));
    desk.mint(key(2));
    expect(() => desk.mint(key(3))).toThrow(PairingFull);
    expect(() => desk.mint(key(1))).not.toThrow(); // replacing its own code is not growth
    const slates = createSlateKeeper({ maxFaces: 2 });
    slates.faceFor("a");
    slates.faceFor("b");
    expect(() => slates.faceFor("c")).toThrow(SlatesFull);
    expect(() => slates.faceFor("a")).not.toThrow();
  });
});

describe.skipIf(!onPostgres)("the hosted town under load", () => {
  let client: { close(): Promise<void> };
  let db: PgTownDb;
  const make = (extra: Partial<Parameters<typeof createTownServer>[0]> = {}) =>
    createTownServer({ db, actions: actions!, directorToken: "d", blobSecret: "s", distDir: null, ...extra });
  let actions: Record<string, TownAction> | undefined;

  beforeAll(async () => {
    mock.module("@hatch/space-sdk", () => ({ z, defineAction: (definition: unknown) => definition }));
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const pglite = new PGlite();
    client = pglite;
    db = drizzle(pglite) as unknown as PgTownDb;
    actions = (await import("../../server/src/actions")).Actions as unknown as Record<string, TownAction>;
    forgetReadyTowns();
  });
  afterAll(async () => { await client?.close(); });

  const call = (s: TownServer, token: string, action: string, args: Record<string, unknown> = {}, headers: Record<string, string> = {}, ip = "10.0.0.1") =>
    s.fetch(new Request("http://town.test/actions", { method: "POST", headers: { "content-type": "application/json", [VISITOR_TOKEN_HEADER]: token, ...headers }, body: JSON.stringify({ action, args }) }), ip);
  const schemas = async () => {
    const result = (await db.execute(sql`SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name ~ '^town_[0-9a-f]{24}$'`)) as unknown;
    const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { n: number }[];
    return Number(rows[0]?.n);
  };

  test("a flood of unique keys from one address makes only a few towns, and a returning town is still let in", async () => {
    const s = make({ limits: { newTownsPerAddressPerHour: 3 }, retentionDays: 0 });
    const before = await schemas();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await call(s, key(i), "getState", {}, {}, "198.51.100.1")).status);
    expect(statuses.filter((x) => x === 200).length).toBe(3);
    expect(statuses.filter((x) => x === 429).length).toBe(9);
    expect(await schemas()).toBe(before + 3);
    // Another address is not held up by the flooder, and a town made earlier still answers.
    expect((await call(s, key(100), "getState", {}, {}, "198.51.100.2")).status).toBe(200);
    expect((await call(s, key(0), "getState", {}, {}, "198.51.100.1")).status).toBe(200);
    // Retry-After tells a client when to come back.
    const refused = await call(s, key(50), "getState", {}, {}, "198.51.100.1");
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  test("the town-wide creation rate and the town cap hold across many addresses", async () => {
    const s = make({ limits: { newTownsPerMinute: 2 }, retentionDays: 0 });
    const out: number[] = [];
    for (let i = 0; i < 5; i++) out.push((await call(s, key(200 + i), "getState", {}, {}, `192.0.2.${i}`)).status);
    expect(out.filter((x) => x === 200).length).toBe(2);
    const capped = make({ limits: { maxTowns: 1 }, retentionDays: 0 });
    expect((await call(capped, key(300), "getState", {}, {}, "192.0.2.50")).status).toBe(503);
  });

  test("a forged X-Real-IP does not dodge the limit unless a proxy is trusted", async () => {
    const s = make({ limits: { newTownsPerAddressPerHour: 1 }, retentionDays: 0 });
    const out: number[] = [];
    for (let i = 0; i < 4; i++) out.push((await call(s, key(400 + i), "getState", {}, { "x-real-ip": `203.0.113.${i}` }, "198.51.100.9")).status);
    expect(out).toEqual([200, 429, 429, 429]);
  });

  test("sustained requests from one town, and from one address, are refused past the per-minute limits", async () => {
    const s = make({ limits: { actionsPerTown: 5, actionsPerAddress: 8 }, retentionDays: 0 });
    const town: number[] = [];
    for (let i = 0; i < 7; i++) town.push((await call(s, key(500), "getState", {}, {}, "198.51.100.30")).status);
    expect(town.filter((x) => x === 200).length).toBe(5);
    const addr: number[] = [];
    for (let i = 0; i < 6; i++) addr.push((await call(s, key(510 + i), "getState", {}, {}, "198.51.100.30")).status);
    // 5 were spent above, so only 3 more from this address, whatever the town.
    expect(addr.filter((x) => x === 429).length).toBeGreaterThanOrEqual(3);
  });

  test("heavy actions are limited harder, and a full image store refuses a postcard", async () => {
    const s = make({ limits: { heavyPerTown: 1 }, retentionDays: 0, blobQuotaBytes: 1000 });
    const image = btoa("x".repeat(2000));
    const first = await call(s, key(600), "addPostcard", { image_base64: image, caption: "A", date_label: "d", weather: "w" });
    expect(first.status).toBe(500); // the quota: 1,000 bytes cannot hold a 2,000-byte image
    const second = await call(s, key(600), "addPostcard", { image_base64: image, caption: "A", date_label: "d", weather: "w" });
    expect(second.status).toBe(429);
    const state = (await (await call(s, key(600), "getState")).json()) as any;
    expect(JSON.stringify(state)).not.toContain("postcards/");
  });

  test("held reads are bounded per town: past the cap a read answers at once", async () => {
    const s = make({ limits: { heldPerTown: 1 }, retentionDays: 0 });
    const t = key(700);
    const held = () => s.fetch(new Request("http://town.test/bridge/directions?since=0&wait=2", { headers: { authorization: `Bearer ${t}` } }), "10.1.1.1");
    const slow = held();
    await Bun.sleep(300);
    const started = Date.now();
    const quick = await held();
    expect(quick.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(1000);
    expect((await slow).status).toBe(200);
  });

  test("pairing codes are limited per town", async () => {
    const s = make({ limits: { pairMintsPerTown: 2 }, retentionDays: 0 });
    const mint = () => s.fetch(new Request("http://town.test/bridge/pair", { method: "POST", headers: { authorization: `Bearer ${key(800)}` } }), "10.2.2.2");
    expect([(await mint()).status, (await mint()).status, (await mint()).status]).toEqual([200, 200, 429]);
  });

  test("/stats is cached briefly", async () => {
    const s = make({ statsCacheMs: 60_000, retentionDays: 0 });
    const read = async () => ((await (await s.fetch(new Request("http://town.test/stats?format=json"))).json()) as any).townsInAll;
    const first = await read();
    await call(s, key(900), "getState", {}, {}, "10.3.3.3");
    expect(await read()).toBe(first);
  });

  test("the retention reaper drops a town unseen past the period, keeps a recent one, and a returning visitor starts afresh", async () => {
    const s = make({ retentionDays: 30 });
    const old = key(1000);
    const recent = key(1001);
    await call(s, old, "getState", {}, {}, "10.4.4.1");
    await call(s, recent, "getState", {}, {}, "10.4.4.2");
    await s.keeper.touch(townSchemaName(old));
    await s.keeper.touch(townSchemaName(recent));
    await db.execute(sql`UPDATE public.town_seen SET seen_at = now() - interval '60 days' WHERE schema_name = ${townSchemaName(old)}`);
    expect(await s.keeper.reap()).toBe(1);
    const names = (await db.execute(sql`SELECT schema_name FROM information_schema.schemata`)) as any;
    const all = JSON.stringify(Array.isArray(names) ? names : names.rows);
    expect(all).not.toContain(townSchemaName(old));
    expect(all).toContain(townSchemaName(recent));
    forgetReadyTowns();
    expect((await call(s, old, "getState", {}, {}, "10.4.4.1")).status).toBe(200);
    // Retention 0 keeps everything.
    expect(await make({ retentionDays: 0 }).keeper.reap()).toBe(0);
  });
});
