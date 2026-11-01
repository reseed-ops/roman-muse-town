import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import * as schema from "./schema";

// Only the hosted action registration is replaced. Handlers, validation,
// Drizzle queries, transactions and migrations are the production code.
mock.module("@hatch/space-sdk", () => ({ z, defineAction: (definition: unknown) => definition }));
const { Actions } = await import("./actions");
type TestAction = {
  request: z.ZodType;
  response: z.ZodType;
  handler(ctx: unknown, args: unknown): Promise<unknown>;
};
const actions = Actions as unknown as Record<keyof typeof Actions, TestAction>;

let sqlite: Database;
let ctx: { db: () => ReturnType<typeof drizzle<typeof schema>>; invalidateQueries: ReturnType<typeof mock>; blobs: { getUrl: ReturnType<typeof mock> } };
beforeEach(() => {
  sqlite = new Database(":memory:");
  const directory = new URL("../../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  const db = drizzle(sqlite, { schema });
  ctx = { db: () => db, invalidateQueries: mock(() => {}), blobs: { getUrl: mock(async () => "test-url") } };
});
afterEach(() => sqlite.close());

async function call<K extends keyof typeof Actions>(name: K, args: Record<string, unknown> = {}) {
  const action = actions[name];
  const result = await action.handler(ctx, action.request.parse(args));
  action.response.parse(result);
  return result as Awaited<ReturnType<(typeof Actions)[K]["handler"]>>;
}
function row<T = Record<string, unknown>>(query: string): T { return sqlite.query(query).get() as T; }
function seedPurse(denarii = 100, seeds = 1) {
  sqlite.run("INSERT INTO purse_state (id, denarii, seeds) VALUES (1, ?, ?)", [denarii, seeds]);
}

describe("permanent fish state", () => {
  test("old released fish and golden-carp prerequisites survive 60 newer catches", async () => {
    seedPurse();
    sqlite.exec(`UPDATE purse_state SET upgrades = '["fountain","lanterns","planters","cobbles"]';
      INSERT INTO affection_state (id, points) VALUES (1, 1000);
      INSERT INTO garden_state (id, harvests) VALUES (1, 1);`);
    for (let i = 0; i < 8; i++) sqlite.run("INSERT INTO challenges_state (challenge_id, done_at) VALUES (?, 0)", [String(i)]);
    for (let i = 0; i < 6; i++) sqlite.run("INSERT INTO inscriptions_state (fragment_id, found_at) VALUES (?, 0)", [String(i)]);
    sqlite.exec("INSERT INTO catches (fish_id, caught_at, released) VALUES ('golden-carp', 0, 1)");
    for (let i = 0; i < 60; i++) sqlite.exec("INSERT INTO catches (fish_id, caught_at, sold) VALUES ('perch', 0, 1)");
    const result = await call("sellFish");
    expect(result.fish).toHaveLength(60);
    expect(result.piscina.released_species).toEqual(["golden-carp"]);
    expect(result.summit.ready).toBe(true);
    expect(result.phoenix.ready).toBe(true);
    const full = await call("getState");
    expect(full.piscina).toEqual(result.piscina);
    expect(full.summit.ready).toBe(true);
  });

  test("old live fish remain in inventory, and each sale pays only once", async () => {
    seedPurse(0);
    sqlite.exec("INSERT INTO catches (fish_id, caught_at) VALUES ('golden-carp', 0)");
    for (let i = 0; i < 60; i++) sqlite.exec("INSERT INTO catches (fish_id, caught_at, sold) VALUES ('perch', 0, 1)");
    const before = await call("buySeeds");
    expect(before.fish).toHaveLength(61);
    await Promise.all([call("sellFish"), call("sellFish")]);
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBe(40);
  });
});

describe("atomic economy", () => {
  test("a lost purchase response can be retried without a second debit", async () => {
    seedPurse(100, 0);
    const request_id = "00000000-0000-4000-8000-000000000001";
    await call("buySeeds", { request_id });
    await call("buySeeds", { request_id });
    expect(row<{ denarii: number; seeds: number }>("SELECT denarii, seeds FROM purse_state")).toEqual({ denarii: 94, seeds: 2 });
    await expect(call("plantGarden", { request_id })).rejects.toThrow("different action");
    expect(row<{ count: number }>("SELECT count(*) AS count FROM request_receipts").count).toBe(1);
  });

  test("failed planting restores the spent seed and sends no invalidation", async () => {
    seedPurse();
    sqlite.exec("CREATE TRIGGER fail_plant BEFORE INSERT ON garden_state BEGIN SELECT RAISE(ABORT, 'test planting failure'); END");
    await expect(call("plantGarden")).rejects.toThrow("test planting failure");
    expect(row<{ seeds: number }>("SELECT seeds FROM purse_state").seeds).toBe(1);
    expect(ctx.invalidateQueries).not.toHaveBeenCalled();
  });

  test("failed harvest payment preserves the ready crop", async () => {
    seedPurse();
    sqlite.exec("INSERT INTO garden_state (id, planted_on, water_days) VALUES (1, '2026-01-01', 3)");
    sqlite.exec("CREATE TRIGGER fail_payment BEFORE UPDATE ON purse_state BEGIN SELECT RAISE(ABORT, 'test payment failure'); END");
    await expect(call("harvestGarden")).rejects.toThrow("test payment failure");
    expect(row<{ planted_on: string; water_days: number; harvests: number }>("SELECT planted_on, water_days, harvests FROM garden_state")).toEqual({ planted_on: "2026-01-01", water_days: 3, harvests: 0 });
  });

  test("failed fish payment leaves the fish sellable", async () => {
    seedPurse();
    sqlite.exec("INSERT INTO catches (fish_id, caught_at) VALUES ('golden-carp', 0)");
    sqlite.exec("CREATE TRIGGER fail_payment BEFORE UPDATE ON purse_state BEGIN SELECT RAISE(ABORT, 'test payment failure'); END");
    await expect(call("sellFish")).rejects.toThrow("test payment failure");
    expect(row<{ sold: number }>("SELECT sold FROM catches").sold).toBe(0);
  });

  test("overlapping purchases preserve both debits and seed grants", async () => {
    seedPurse(12, 0);
    await Promise.all([call("buySeeds"), call("buySeeds"), call("buySeeds")]);
    expect(row<{ denarii: number; seeds: number }>("SELECT denarii, seeds FROM purse_state")).toEqual({ denarii: 0, seeds: 4 });
  });

  test("duplicate harvest requests pay once", async () => {
    seedPurse(0);
    sqlite.exec("INSERT INTO garden_state (id, planted_on, water_days) VALUES (1, '2026-01-01', 3)");
    await Promise.all([call("harvestGarden"), call("harvestGarden")]);
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBe(18);
    expect(row<{ harvests: number }>("SELECT harvests FROM garden_state").harvests).toBe(1);
  });

  test("routine economy updates do not read history tables or sign postcards", async () => {
    seedPurse();
    // If a mutation accidentally returns the full state these reads fail.
    sqlite.exec("DROP TABLE letters; DROP TABLE journal; DROP TABLE aelia_facts; DROP TABLE postcards;");
    const result = await call("buySeeds");
    expect(result.purse.seeds).toBe(3);
    expect(result).not.toHaveProperty("letters");
    expect(ctx.blobs.getUrl).not.toHaveBeenCalled();
  });
});
