import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import * as schema from "./schema";
import { readingOutcome, SEED_LEDGER_SEED } from "./nursery";

// Only the hosted action registration is replaced. Handlers,
// validation, Drizzle queries, transactions and migrations are the
// production code (the economy.test.ts harness pattern).
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

describe("the Seed Ledger seed", () => {
  test("the shipped seed is exactly the three opening entries, in order", () => {
    expect(SEED_LEDGER_SEED).toHaveLength(3);
    expect(SEED_LEDGER_SEED.map((e) => e.kind)).toEqual(["generation", "run", "run"]);
    expect(SEED_LEDGER_SEED[0]!.title).toContain("Generation 0");
    expect(SEED_LEDGER_SEED[0]!.summary).toContain("v0.6");
    expect(SEED_LEDGER_SEED[0]!.outcome).toContain("Living");
    // Run 1: the uncapped warmth farmer and its score.
    expect(SEED_LEDGER_SEED[1]!.summary).toContain("690.5");
    expect(SEED_LEDGER_SEED[1]!.summary.toLowerCase()).toContain("reward hack");
    expect(SEED_LEDGER_SEED[1]!.outcome).toContain("Not promoted");
    // Run 2: capped, 264.5 against 131.7, both known flaws named.
    expect(SEED_LEDGER_SEED[2]!.summary).toContain("264.5");
    expect(SEED_LEDGER_SEED[2]!.summary).toContain("131.7");
    expect(SEED_LEDGER_SEED[2]!.summary).toContain("bond memory");
    expect(SEED_LEDGER_SEED[2]!.summary).toContain("decay");
    expect(SEED_LEDGER_SEED[2]!.outcome).toContain("Not promoted");
  });

  test("no ledger text carries an em dash", () => {
    for (const entry of SEED_LEDGER_SEED) {
      for (const field of [entry.title, entry.period, entry.summary, entry.outcome]) {
        expect(field).not.toContain("\u2014");
      }
    }
  });

  test("getState seeds the ledger once and never rewrites it", async () => {
    const first = await call("getState");
    expect(first.seed_ledger).toHaveLength(3);
    expect(first.seed_ledger[0]!.title).toContain("Generation 0");
    expect(first.seed_ledger[1]!.summary).toContain("690.5");
    expect(first.seed_ledger[2]!.outcome).toContain("Not promoted");
    const second = await call("getState");
    expect(second.seed_ledger).toEqual(first.seed_ledger);
    expect(row<{ count: number }>("SELECT count(*) AS count FROM seed_ledger").count).toBe(3);
  });
});

describe("reading aloud: the day cap and the no-pay rule", () => {
  test("the pure cap: same day is already spent, any other day reads", () => {
    expect(readingOutcome("", "2026-11-02")).toBe("read");
    expect(readingOutcome("2026-11-01", "2026-11-02")).toBe("read");
    expect(readingOutcome("2026-11-02", "2026-11-02")).toBe("already");
  });

  test("one reading per day, and a reading earns nothing on any path", async () => {
    // A town mid-life: affection points in hand, a bond well into
    // its levels, coins in the purse, a letter on the desk.
    sqlite.exec("INSERT INTO affection_state (id, points, day_key, caps, flags) VALUES (1, 250, '2026-11-02', '{}', '{}')");
    sqlite.exec("INSERT INTO bond_state (id, bond, level, next_level, next_at, as_of) VALUES (1, 350, 'Close confidant', 'Kindred', 500, 'Nov 1')");
    sqlite.exec("INSERT INTO purse_state (id, denarii) VALUES (1, 56)");
    await call("seedLetter");

    const first = await call("recordReading", { date_key: "2026-11-02" });
    expect(first.reading_outcome).toBe("read");
    expect(first.reading).toEqual({ last_read_day: "2026-11-02", readings: 1 });

    const second = await call("recordReading", { date_key: "2026-11-02" });
    expect(second.reading_outcome).toBe("already");
    expect(second.reading.readings).toBe(1);

    const nextDay = await call("recordReading", { date_key: "2026-11-03" });
    expect(nextDay.reading_outcome).toBe("read");
    expect(nextDay.reading.readings).toBe(2);

    // Nothing paid out, nothing moved: affection, bond, purse and
    // letters are byte-identical after three reading calls.
    expect(row<{ points: number }>("SELECT points FROM affection_state WHERE id = 1").points).toBe(250);
    expect(row<{ bond: number; level: string; next_at: number }>("SELECT bond, level, next_at FROM bond_state WHERE id = 1"))
      .toEqual({ bond: 350, level: "Close confidant", next_at: 500 });
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state WHERE id = 1").denarii).toBe(56);
    expect(row<{ count: number }>("SELECT count(*) AS count FROM letters").count).toBe(1);
    const state = await call("getState");
    expect(state.affection.rank).toBe(2);
    expect(state.bond.bond).toBe(350);
    expect(state.purse.denarii).toBe(56);
  });
});

describe("town invariants survive the nursery build", () => {
  test("the seeded bond, facts, board and goals are identical before and after readings", async () => {
    // Public edition of the author's own invariant test: in the
    // author's town the seed constants are his lived-in board, goals
    // and bond; here they are this tree's fresh-start seeds. The
    // guarantee under test is the same either way: a reading changes
    // none of them.
    await call("seedBoard");
    await call("seedGoals");
    const before = await call("getState");
    expect(before.facts.length).toBeGreaterThan(0);
    expect(before.board.entries.length).toBeGreaterThan(0);
    expect(before.goals.entries.length).toBeGreaterThan(0);

    await call("recordReading", { date_key: "2026-11-02" });
    await call("recordReading", { date_key: "2026-11-02" });
    const after = await call("getState");
    expect(after.bond).toEqual(before.bond);
    expect(after.facts).toEqual(before.facts);
    expect(after.board.entries).toEqual(before.board.entries);
    expect(after.goals.entries).toEqual(before.goals.entries);
    expect(after.seed_ledger).toHaveLength(3);
  });
});
