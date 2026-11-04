// The action layer on Postgres (Task 8). Run as its own process:
//
//     TOWN_DIALECT=postgres bun test server/src/postgres.test.ts
//
// (bun run test:pg). The dialect is chosen once per process when schema.ts
// loads, so these tests skip themselves in the SQLite run. The database
// is pglite, Postgres compiled to WebAssembly, in memory; one instance
// serves every test, and each test gets its own town (its own schema),
// which is also the production shape.

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig as pgTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { getTableConfig as sqliteTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import * as pgSchema from "./schema.pg";
import * as sqliteSchema from "./schema.sqlite";
import { PG_MIGRATIONS } from "./pgMigrations";
import { PRUNED_RECEIPTS_KEPT } from "./retrySafe";
import { ensureTown, forgetReadyTowns, postgresStorage, townSchemaName, withTown, type PgTownDb } from "./storage.pg";
import type { TownDb } from "./storage";

const onPostgres = process.env.TOWN_DIALECT === "postgres";

describe("the Postgres schema mirrors the SQLite schema", () => {
  const describeColumns = (table: SQLiteTable | PgTable) =>
    Object.fromEntries(Object.entries(getTableColumns(table)).map(([key, column]) => [key, {
      name: column.name,
      dataType: column.dataType,
      notNull: column.notNull,
      primary: column.primary,
      default: column.default,
      hasDefaultFn: typeof column.defaultFn === "function",
    }]));

  test("same tables, same columns, same nullability, same defaults", () => {
    expect(Object.keys(pgSchema).sort()).toEqual(Object.keys(sqliteSchema).sort());
    for (const key of Object.keys(sqliteSchema) as (keyof typeof sqliteSchema)[]) {
      const sqlite = sqliteSchema[key];
      const pg = pgSchema[key];
      expect(getTableName(pg)).toBe(getTableName(sqlite));
      expect(describeColumns(pg)).toEqual(describeColumns(sqlite));
    }
  });

  test("same indexes", () => {
    const indexNames = (config: { indexes: { config: { name?: string } }[] }) => config.indexes.map((index) => index.config.name).sort();
    for (const key of Object.keys(sqliteSchema) as (keyof typeof sqliteSchema)[]) {
      expect(indexNames(pgTableConfig(pgSchema[key]))).toEqual(indexNames(sqliteTableConfig(sqliteSchema[key])));
    }
  });
});

describe.skipIf(!onPostgres)("the town on Postgres", () => {
  type TestAction = { request: z.ZodType; response: z.ZodType; handler(ctx: unknown, args: unknown): Promise<unknown> };
  let client: { close(): Promise<void>; query(sql: string): Promise<unknown>; exec(sql: string): Promise<unknown> };
  let db: PgTownDb;
  let actions: Record<string, TestAction>;
  let invalidations = 0;
  const blobs = { getUrl: async (key: string) => `https://blobs.test/${key}`, put: async () => {}, delete: async () => {} };

  beforeAll(async () => {
    mock.module("@hatch/space-sdk", () => ({ z, defineAction: (definition: unknown) => definition }));
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const pglite = new PGlite();
    client = pglite;
    db = drizzle(pglite) as unknown as PgTownDb;
    actions = (await import("./actions")).Actions as unknown as Record<string, TestAction>;
  });
  afterAll(async () => { await client?.close(); });
  beforeEach(() => forgetReadyTowns());

  let towns = 0;
  /** A fresh visitor: a new token, a new schema, the migrations run. */
  async function newTown(): Promise<string> {
    const schemaName = townSchemaName(`visitor-${++towns}-${Date.now()}`);
    expect(await ensureTown(db, schemaName)).toBe(PG_MIGRATIONS.length);
    expect(await ensureTown(db, schemaName)).toBe(0);
    return schemaName;
  }
  const ctxFor = (tx: TownDb) => ({ db: () => tx, invalidateQueries: () => { invalidations++; }, blobs, storage: postgresStorage });
  async function call(town: string, name: string, args: Record<string, unknown> = {}): Promise<any> {
    const action = actions[name]!;
    const result = await withTown(db, town, (tx) => action.handler(ctxFor(tx), action.request.parse(args)));
    action.response.parse(result);
    return result;
  }
  /** Every table of a town, with dates blanked (seed times differ). */
  async function dump(town: string): Promise<Record<string, unknown[]>> {
    return withTown(db, town, async (tx) => {
      const out: Record<string, unknown[]> = {};
      for (const table of Object.values(pgSchema)) {
        const rows = await tx.select().from(table as unknown as typeof sqliteSchema.journal);
        out[getTableName(table)] = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? "<date>" : value])));
      }
      return out;
    });
  }
  const sum = (dump: Record<string, unknown[]>) => Object.values(dump).reduce((n, rows) => n + rows.length, 0);

  test("the migration builds exactly what the schema declares", async () => {
    const town = await newTown();
    const columns = (await client.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = '${town}' ORDER BY table_name, ordinal_position`)) as { rows: { table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }[] };
    const byTable = new Map<string, typeof columns.rows>();
    for (const row of columns.rows) byTable.set(row.table_name, [...(byTable.get(row.table_name) ?? []), row]);
    expect([...byTable.keys()].sort()).toEqual([...Object.values(pgSchema).map(getTableName), "town_migrations", "town_blobs"].sort());
    for (const table of Object.values(pgSchema)) {
      const live = byTable.get(getTableName(table))!;
      for (const column of Object.values(getTableColumns(table))) {
        const found = live.find((row) => row.column_name === column.name);
        expect(found, `${getTableName(table)}.${column.name}`).toBeDefined();
        expect(found!.is_nullable).toBe(column.notNull ? "NO" : "YES");
        const sqlType = column.getSQLType();
        expect(found!.data_type).toBe(sqlType === "serial" ? "integer" : sqlType);
        if (column.default !== undefined) expect(found!.column_default).toContain(String(column.default));
      }
      expect(live).toHaveLength(Object.keys(getTableColumns(table)).length);
    }
    const indexes = (await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname = '${town}' AND indexname LIKE 'catches_%_idx'`)) as { rows: { indexname: string }[] };
    expect(indexes.rows.map((row) => row.indexname).sort()).toEqual(["catches_inventory_idx", "catches_released_idx", "catches_species_idx"]);
  });

  test("a first visit seeds a fresh town, and the town plays", async () => {
    const town = await newTown();
    const fresh = await call(town, "getState");
    expect(fresh.bond.bond).toBe(0);
    expect(fresh.found).toEqual([]);
    expect(fresh.board.entries).toEqual([]);
    // The client seeds the template town on its first load, through
    // these four actions; the facts and the seed ledger seed on getState.
    for (const seed of ["seedBoard", "seedLetter", "seedFestivals", "seedGoals"]) await call(town, seed);
    const state = await call(town, "getState");
    expect(state.board.entries.length).toBeGreaterThan(0);
    expect(state.letters.length).toBeGreaterThan(0);
    expect(state.goals.entries.length).toBeGreaterThan(0);

    const found = await call(town, "markFound", { collectibleId: "pointy-hat", request_id: "00000000-0000-4000-8000-00000000aaaa" });
    expect(found.found).toEqual(["pointy-hat"]);
    const again = await call(town, "markFound", { collectibleId: "pointy-hat", request_id: "00000000-0000-4000-8000-00000000aaaa" });
    expect(again.found).toEqual(["pointy-hat"]);
    await expect(call(town, "markQuestDone", { questId: "q", request_id: "00000000-0000-4000-8000-00000000aaaa" })).rejects.toThrow("different action");

    const purse = await call(town, "awardOnce", { key: "test", amount: 100, request_id: crypto.randomUUID() });
    expect(purse.purse.denarii).toBeGreaterThanOrEqual(100);
    const seeds = await call(town, "buySeeds", { request_id: crypto.randomUUID() });
    expect(seeds.purse.seeds).toBeGreaterThan(0);
    const planted = await call(town, "plantGarden", { request_id: crypto.randomUUID() });
    expect(planted.garden.planted_on).not.toBeNull();
    const watered = await call(town, "waterGarden", { request_id: crypto.randomUUID() });
    expect(watered.garden.water_days).toBe(1);

    await call(town, "recordCatch", { fish_id: "perch", request_id: crypto.randomUUID() });
    await call(town, "recordCatch", { fish_id: "perch", request_id: crypto.randomUUID() });
    const before = (await call(town, "getState")).purse.denarii;
    const sold = await call(town, "sellFish", { request_id: crypto.randomUUID() });
    expect(sold.fish.filter((fish: { sold: boolean }) => fish.sold)).toHaveLength(2);
    expect(sold.purse.denarii).toBeGreaterThan(before);

    const earned = await call(town, "earnAffection", { reason: "walk", request_id: crypto.randomUUID() });
    expect(earned.capped).toBe(false);

    const journal = await call(town, "addJournalEntry", { text: "A quiet evening by the tree." });
    expect(journal.journal.map((entry: { text: string }) => entry.text)).toContain("A quiet evening by the tree.");
    expect(Number.isFinite(Date.parse(journal.journal[0].created_at))).toBe(true);
    expect(Number.isFinite(Date.parse(journal.tree.planted_at))).toBe(true);

    const chat = await call(town, "chatWithMuse", {
      message: "I planted the garden today",
      local_reply: true,
      context: { weather: "clear", night: false, tree_stage: "sapling", found_count: 1, board_as_of: "", unread_letters: 0 },
    });
    expect(typeof chat).toBe("object");
  });

  test("two visitors never see each other's town", async () => {
    const a = await newTown();
    const b = await newTown();
    const c = await newTown();
    await call(a, "getState");
    await call(b, "getState");
    await call(c, "getState");
    const freshB = await dump(b);
    expect(freshB).toEqual(await dump(c));
    expect(sum(freshB)).toBeGreaterThan(0);

    // A plays hard: every family of table the actions write.
    await call(a, "markFound", { collectibleId: "garden-key" });
    await call(a, "awardOnce", { key: "k", amount: 100, request_id: crypto.randomUUID() });
    await call(a, "buySeeds", { request_id: crypto.randomUUID() });
    await call(a, "plantGarden", { request_id: crypto.randomUUID() });
    await call(a, "recordCatch", { fish_id: "perch", request_id: crypto.randomUUID() });
    await call(a, "earnAffection", { reason: "walk", request_id: crypto.randomUUID() });
    await call(a, "addJournalEntry", { text: "Mine alone." });
    await call(a, "addNote", { text: "A note for A." }).catch(() => {});
    await call(a, "markQuestDone", { questId: "first-walk" });
    await call(a, "completeChallenge", { challenge_id: "forum", request_id: crypto.randomUUID() });
    await call(a, "markInscription", { fragment_id: "f1", request_id: crypto.randomUUID() });
    await call(a, "recordGift", { item: "honey", tier: "loved", label: "Honey", consume: "none", request_id: crypto.randomUUID() });
    await call(a, "chatWithMuse", { message: "Remember that I love honey cakes", local_reply: true, context: { weather: "clear", night: false, tree_stage: "sapling", found_count: 1, board_as_of: "", unread_letters: 0 } });

    const afterA = await dump(a);
    expect(sum(afterA)).toBeGreaterThan(sum(freshB));
    // Nothing of A's reached B: B still reads exactly as a fresh town.
    expect(await dump(b)).toEqual(freshB);
    expect((await call(b, "getState")).found).toEqual([]);
    expect((await call(b, "getState")).journal).toEqual([]);

    // Nor does B's play reach A.
    await call(b, "addJournalEntry", { text: "B's own line." });
    await call(b, "markFound", { collectibleId: "stargazing" });
    expect(await dump(a)).toEqual(afterA);
    const stateA = await call(a, "getState");
    expect(stateA.found).toEqual(["garden-key"]);
    expect(stateA.journal.map((entry: { text: string }) => entry.text)).toEqual(["Mine alone."]);
  });

  test("a failed economy transaction rolls back alone and leaves no receipt", async () => {
    const town = await newTown();
    await call(town, "awardOnce", { key: "k", amount: 100, request_id: crypto.randomUUID() });
    await call(town, "buySeeds", { request_id: crypto.randomUUID() });
    await client.exec(`CREATE FUNCTION ${town}.fail_plant() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test planting failure'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_plant BEFORE INSERT ON ${town}.garden_state FOR EACH ROW EXECUTE FUNCTION ${town}.fail_plant();`);
    const before = await call(town, "getState");
    await expect(call(town, "plantGarden", { request_id: "00000000-0000-4000-8000-00000000bbbb" })).rejects.toThrow(/test planting failure|Failed query/);
    const after = await call(town, "getState");
    expect(after.purse.seeds).toBe(before.purse.seeds);
    const receipts = await withTown(db, town, (tx) => tx.select().from(pgSchema.requestReceipts as unknown as typeof sqliteSchema.requestReceipts));
    expect(receipts.map((row) => row.requestId)).not.toContain("00000000-0000-4000-8000-00000000bbbb");
  });

  test("a save round-trips, and the sequences move past the restored ids", async () => {
    const town = await newTown();
    await call(town, "getState");
    await call(town, "addJournalEntry", { text: "Before the save." });
    const { json } = await call(town, "exportSave");
    const save = JSON.parse(json);
    expect(Object.keys(save.tables).sort()).toEqual(Object.values(pgSchema).map(getTableName).sort());
    expect(save.tables.journal).toHaveLength(1);
    expect(typeof save.tables.journal[0].createdAt).toBe("number");

    await call(town, "addJournalEntry", { text: "Lost to the restore." });
    await call(town, "restoreSave", { json, request_id: crypto.randomUUID() });
    const restored = await call(town, "getState");
    expect(restored.journal.map((entry: { text: string }) => entry.text)).toEqual(["Before the save."]);
    // The next insert must not collide with a restored id.
    const next = await call(town, "addJournalEntry", { text: "After the restore." });
    expect(next.journal).toHaveLength(2);
    expect(new Set(next.journal.map((entry: { id: number }) => entry.id)).size).toBe(2);
  });

  test("receipt pruning keeps the newest affection ticks and every purchase", async () => {
    const town = await newTown();
    await withTown(db, town, async (tx) => {
      const receipts = pgSchema.requestReceipts as unknown as typeof sqliteSchema.requestReceipts;
      for (let i = 0; i < 700; i++) await tx.insert(receipts).values({ requestId: `tick-${i}`, action: "earnAffection", payloadHash: "x", completedAt: new Date(i * 1000) });
      for (let i = 0; i < 700; i++) await tx.insert(receipts).values({ requestId: `sale-${i}`, action: "buyUpgrade", payloadHash: "x", completedAt: new Date(i * 1000) });
    });
    await call(town, "earnAffection", { reason: "walk", request_id: "00000000-0000-4000-8000-000000000000" });
    const rows = await withTown(db, town, (tx) => tx.select().from(pgSchema.requestReceipts as unknown as typeof sqliteSchema.requestReceipts));
    const ticks = rows.filter((row) => row.action === "earnAffection").map((row) => row.requestId);
    expect(ticks).toHaveLength(PRUNED_RECEIPTS_KEPT + 1);
    expect(ticks).toContain("tick-699");
    expect(ticks).not.toContain("tick-0");
    expect(rows.filter((row) => row.action === "buyUpgrade")).toHaveLength(700);
  });

  test("a reset clears one town's finds and no other's", async () => {
    const a = await newTown();
    const b = await newTown();
    await call(a, "markFound", { collectibleId: "pointy-hat" });
    await call(b, "markFound", { collectibleId: "garden-key" });
    await call(a, "resetTown");
    expect((await call(a, "getState")).found).toEqual([]);
    expect((await call(b, "getState")).found).toEqual(["garden-key"]);
  });
});
