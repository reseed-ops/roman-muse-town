import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { z } from "zod";
import { PRUNED_RECEIPTS_KEPT } from "./retrySafe";
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

describe("the affection tick stays small", () => {
  const body = "Dear friend,\n\nThe olive by the gate came into flower.";
  const earn = (reason = "walk", request_id = crypto.randomUUID()) => call("earnAffection", { reason, request_id });

  test("a plain tick carries no letters and doesn't invalidate", async () => {
    sqlite.run("INSERT INTO letters (date_label, title, body) VALUES ('June 1', 'A letter', ?)", [body]);
    const result = await earn();
    expect(result).not.toHaveProperty("letters");
    expect(result.ranked_up).toBeNull();
    expect(result.capped).toBe(false);
    expect(ctx.invalidateQueries).not.toHaveBeenCalled();
  });

  test("it reports the cap on the tick that reaches it", async () => {
    for (let i = 0; i < 4; i++) expect((await earn()).capped).toBe(false);
    expect((await earn()).capped).toBe(true);
  });

  test("a landmark is never capped", async () => {
    expect((await earn("landmark:forum")).capped).toBe(false);
  });

  test("a rank-up brings its letter with it", async () => {
    sqlite.run("INSERT INTO affection_state (id, points) VALUES (1, 99)");
    const result = await earn();
    expect(result.ranked_up).toBe(1);
    expect(result.letters?.length).toBeGreaterThan(0);
    expect(ctx.invalidateQueries).toHaveBeenCalled();
  });

  test("a replayed tick still answers with the current rank", async () => {
    const id = crypto.randomUUID();
    await earn("walk", id);
    expect((await earn("walk", id)).affection.rank).toBe(0);
  });
});

describe("letters travel light", () => {
  test("state has the first line and getLetter has the rest", async () => {
    sqlite.run("INSERT INTO letters (id, date_label, title, body) VALUES (1, 'June 1', 'A letter', ?)", ["\nDear friend,\n\n" + "x".repeat(5000)]);
    const state = await call("getState");
    expect(state.letters[0]!.preview).toBe("Dear friend,");
    expect(state.letters[0]).not.toHaveProperty("body");
    expect((await call("getLetter", { id: 1 })).body).toHaveLength(5015);
    expect((await call("getLetter", { id: 2 })).body).toBeNull();
  });
});

describe("receipt pruning", () => {
  const receipt = (id: string, action: string) =>
    sqlite.run("INSERT INTO request_receipts (request_id, action, payload_hash, completed_at) VALUES (?, ?, 'x', 0)", [id, action]);
  const count = (action: string) => row<{ count: number }>(`SELECT count(*) AS count FROM request_receipts WHERE action = '${action}'`).count;

  test("only affection ticks are pruned, and the newest are kept", async () => {
    for (let i = 0; i < 700; i++) receipt(`tick-${i}`, "earnAffection");
    for (let i = 0; i < 700; i++) receipt(`sale-${i}`, "buyUpgrade");
    await call("earnAffection", { reason: "walk", request_id: "00000000-0000-4000-8000-000000000000" });
    expect(count("earnAffection")).toBe(PRUNED_RECEIPTS_KEPT + 1);
    expect(count("buyUpgrade")).toBe(700);
    expect(row("SELECT 1 AS found FROM request_receipts WHERE request_id = 'tick-699'")).toBeTruthy();
    expect(row("SELECT 1 AS found FROM request_receipts WHERE request_id = 'tick-0'")).toBeNull();
  });

  test("most ticks leave the table alone", async () => {
    for (let i = 0; i < 700; i++) receipt(`tick-${i}`, "earnAffection");
    await call("earnAffection", { reason: "walk", request_id: "11111111-1111-4111-8111-111111111111" });
    expect(count("earnAffection")).toBe(701);
  });
});

describe("tables only answer for their own keys", () => {
  test("a fish called constructor isn't a catch", async () => {
    await call("recordCatch", { fish_id: "constructor" });
    expect(row<{ count: number }>("SELECT count(*) AS count FROM catches").count).toBe(0);
  });

  test("one already in a save can't spoil the fish market", async () => {
    sqlite.run("INSERT INTO purse_state (id, denarii, seeds) VALUES (1, 0, 0)");
    sqlite.run("INSERT INTO catches (fish_id, caught_at) VALUES ('constructor', 0), ('carp', 0)");
    await call("sellFish", {});
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBeGreaterThan(0);
  });

  test("an affection reason from the prototype earns nothing and caps nothing", async () => {
    const result = await call("earnAffection", { reason: "constructor", request_id: crypto.randomUUID() });
    expect(result.capped).toBe(false);
  });
});

describe("from the lake and the garden to the table", () => {
  const catchFish = (fish_id: string) => call("recordCatch", { fish_id, request_id: crypto.randomUUID() });
  const fishRow = () => row<{ sold: number }>("SELECT sold FROM catches ORDER BY id LIMIT 1");
  const facts = () => (sqlite.query("SELECT text, topic, source FROM aelia_facts WHERE source = 'kitchen'").all() as { text: string; topic: string }[]);

  test("a catch becomes an ingredient, pays nothing, and can't also be sold", async () => {
    seedPurse(10, 0);
    await catchFish("carp");
    const state = await call("pantryCatch", { fish_id: "carp", request_id: crypto.randomUUID() });
    expect(state.purse.ingredients).toContain("catch-carp");
    expect(state.purse.denarii).toBe(10);
    expect(fishRow().sold).toBe(1);
    expect((await call("sellFish", { request_id: crypto.randomUUID() })).purse.denarii).toBe(10);
  });

  test("the golden carp is never food", async () => {
    seedPurse(0, 0);
    await catchFish("golden-carp");
    const state = await call("pantryCatch", { fish_id: "golden-carp", request_id: crypto.randomUUID() });
    expect(state.purse.ingredients).toEqual([]);
    expect(fishRow().sold).toBe(0);
  });

  test("no fish, no ingredient, and a made-up one does nothing", async () => {
    seedPurse(0, 0);
    expect((await call("pantryCatch", { fish_id: "carp", request_id: crypto.randomUUID() })).purse.ingredients).toEqual([]);
    expect((await call("pantryCatch", { fish_id: "constructor", request_id: crypto.randomUUID() })).purse.ingredients).toEqual([]);
  });

  test("a replayed request spends one fish", async () => {
    seedPurse(0, 0);
    await catchFish("eel");
    await catchFish("eel");
    const request_id = crypto.randomUUID();
    await call("pantryCatch", { fish_id: "eel", request_id });
    const state = await call("pantryCatch", { fish_id: "eel", request_id });
    expect(state.purse.ingredients).toEqual(["catch-eel"]);
  });

  test("cooking his own catch becomes something she remembers, once", async () => {
    seedPurse(0, 0);
    for (let i = 0; i < 2; i++) {
      await catchFish("perch");
      await call("pantryCatch", { fish_id: "perch", request_id: crypto.randomUUID() });
      await call("cookDish", { ingredient: "catch-perch", request_id: crypto.randomUUID() });
    }
    expect(facts()).toHaveLength(1);
    expect(facts()[0]!.topic).toBe("fried-perch");
  });

  test("a stall dish leaves no such memory", async () => {
    sqlite.run("INSERT INTO purse_state (id, denarii, seeds, ingredients) VALUES (1, 0, 0, '[\"market-basket\"]')");
    await call("cookDish", { ingredient: "market-basket", request_id: crypto.randomUUID() });
    expect(facts()).toHaveLength(0);
  });

  test("a harvest still pays, and sends greens to the kitchen", async () => {
    seedPurse(0, 0);
    sqlite.run("INSERT INTO garden_state (id, planted_on, water_days) VALUES (1, '2026-01-01', 3)");
    const state = await call("harvestGarden", { request_id: crypto.randomUUID() });
    expect(state.purse.denarii).toBeGreaterThan(0);
    expect(state.purse.ingredients).toEqual(["garden-greens"]);
  });
});

describe("their home's keepsakes (Task 40)", () => {
  test("a keepsake is placed, moved, cleared, and kept beside the purse's other flags; nothing is paid", async () => {
    seedPurse(50);
    sqlite.run(`UPDATE purse_state SET flags = '{"award:x":true}'`);
    await call("arrangeHome", { slot: "wall-back", keepsake: "star-chart" });
    await call("arrangeHome", { slot: "shelf-left", keepsake: "letter-bundle" });
    // Moving the letters to the other shelf empties the first.
    await call("arrangeHome", { slot: "shelf-right", keepsake: "letter-bundle" });
    // A wall keepsake cannot stand on the floor; an unknown slot changes nothing.
    await call("arrangeHome", { slot: "floor", keepsake: "star-chart" });
    await call("arrangeHome", { slot: "attic", keepsake: "star-chart" });
    const flags = JSON.parse(row<{ flags: string }>("SELECT flags FROM purse_state").flags) as Record<string, unknown>;
    expect(flags["award:x"]).toBe(true);
    expect(flags.home).toEqual({ "wall-back": "star-chart", "shelf-right": "letter-bundle" });
    await call("arrangeHome", { slot: "wall-back", keepsake: null });
    const after = JSON.parse(row<{ flags: string }>("SELECT flags FROM purse_state").flags) as { home: Record<string, string> };
    expect(after.home).toEqual({ "shelf-right": "letter-bundle" });
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBe(50);
  });
});

describe("real projects as quests (Task 56)", () => {
  const flagsOf = () => JSON.parse(row<{ flags: string }>("SELECT flags FROM purse_state").flags) as Record<string, unknown>;

  test("the four kinds are accepted and nothing else; no schema, no payment", async () => {
    seedPurse(50);
    sqlite.run(`UPDATE purse_state SET flags = '{"award:x":true,"home":{"floor":"tree-cutting"}}'`);
    for (const kind of ["etsy-shop", "focus-companion", "job-hunt", "vietnamese"]) await call("carryQuest", { kind });
    await expect(call("carryQuest", { kind: "taxes" })).rejects.toThrow();
    await expect(call("advanceQuest", { kind: "" })).rejects.toThrow();
    const state = await call("acceptQuest", { kind: "job-hunt" });
    expect(state.purse.quests.map((q) => q.kind)).toEqual(["etsy-shop", "focus-companion", "job-hunt", "vietnamese"]);
    expect(state.purse.quests.find((q) => q.kind === "job-hunt")?.stage).toBe("begun");
    expect(flagsOf()["award:x"]).toBe(true);
    expect(flagsOf().home).toEqual({ floor: "tree-cutting" });
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBe(50);
  });

  test("steps, one ending, one celebration, and a record of a kind and a count", async () => {
    seedPurse(0);
    await call("carryQuest", { kind: "job-hunt" });
    // Not yet taken up: a step and an ending change nothing.
    await call("advanceQuest", { kind: "job-hunt" });
    expect((await call("completeQuest", { kind: "job-hunt" })).purse.quests[0]).toMatchObject({ stage: "posted", steps: 0, completed: 0 });
    await call("acceptQuest", { kind: "job-hunt" });
    await call("advanceQuest", { kind: "job-hunt" });
    expect((await call("advanceQuest", { kind: "job-hunt" })).purse.quests[0]!.steps).toBe(2);
    let done = await call("completeQuest", { kind: "job-hunt" });
    expect(done.purse.quests[0]).toMatchObject({ stage: "done", completed: 1, celebrated: false });
    // Repeating the ending, or the request, adds nothing.
    done = await call("completeQuest", { kind: "job-hunt" });
    expect(done.purse.quests[0]!.completed).toBe(1);
    // The celebration is marked once; marking again is a no-op.
    await call("celebrateQuest", { kind: "job-hunt" });
    const after = await call("celebrateQuest", { kind: "job-hunt" });
    expect(after.purse.quests[0]).toMatchObject({ stage: "done", completed: 1, celebrated: true });
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBe(0);
    const stored = (flagsOf().quests as Record<string, unknown>[])[0]!;
    expect(Object.keys(stored).sort()).toEqual(["celebrated", "completed", "kind", "stage", "steps"]);
  });

  test("a retried request id is applied once", async () => {
    seedPurse(0);
    await call("carryQuest", { kind: "vietnamese" });
    await call("acceptQuest", { kind: "vietnamese" });
    const id = crypto.randomUUID();
    await call("advanceQuest", { kind: "vietnamese", request_id: id });
    const again = await call("advanceQuest", { kind: "vietnamese", request_id: id });
    expect(again.purse.quests[0]!.steps).toBe(1);
  });

  test("the first sale finishes the shop quest, which earns the shelf's first coin as a cosmetic keepsake", async () => {
    seedPurse(0);
    await call("carryQuest", { kind: "etsy-shop" });
    await call("acceptQuest", { kind: "etsy-shop" });
    await call("completeQuest", { kind: "etsy-shop" });
    const state = await call("arrangeHome", { slot: "shelf-left", keepsake: "first-coin" });
    expect(state.purse.home_decor).toEqual({ "shelf-left": "first-coin" });
    expect(state.purse.quests[0]).toMatchObject({ kind: "etsy-shop", completed: 1 });
  });
});

describe("Task 57: a quiet drift on the lake leaves a kind and a count only", () => {
  const flagsOf = () => JSON.parse(row<{ flags: string }>("SELECT flags FROM purse_state").flags) as Record<string, unknown>;
  test("each drift adds one to the count, nothing is paid, other flags stay, a retried id counts once", async () => {
    seedPurse(5);
    await call("arrangeHome", { slot: "floor", keepsake: "tree-cutting" });
    await call("noteQuietBoat", {});
    const id = crypto.randomUUID();
    await call("noteQuietBoat", { request_id: id });
    await call("noteQuietBoat", { request_id: id });
    expect(flagsOf().quiet_boat).toEqual({ kind: "quiet-boat", count: 2 });
    expect(flagsOf().home).toEqual({ floor: "tree-cutting" });
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBe(5);
  });
});


describe("Task 58: a Roman wedding is kept as a kind and a count, and as a durable first", () => {
  const flagsOf = () => JSON.parse(row<{ flags: string }>("SELECT flags FROM purse_state").flags) as Record<string, unknown>;
  const firsts = () => JSON.parse(row<{ firsts: string }>("SELECT firsts FROM dating_state").firsts) as Record<string, string>;
  const rank = (r: number) => sqlite.run("INSERT OR REPLACE INTO affection_state (id, points) VALUES (1, ?)", [r * 100]);
  const prepareAll = async () => {
    await call("prepareWedding", { step: "flowers" });
    await call("prepareWedding", { step: "vows" });
    return call("prepareWedding", { step: "dress" });
  };

  test("below the terrace kiss's rank nothing moves; at it the chain runs in order and only in order", async () => {
    seedPurse(20);
    rank(6);
    expect((await call("prepareWedding", { step: "flowers" })).purse.wedding.steps).toEqual([]);
    rank(7);
    await expect(call("prepareWedding", { step: "feast" })).rejects.toThrow();
    expect((await call("prepareWedding", { step: "dress" })).purse.wedding.steps).toEqual([]);
    expect((await call("holdWedding")).purse.wedding.weddings).toBe(0);
    expect((await prepareAll()).purse.wedding.steps).toEqual(["flowers", "vows", "dress"]);
    expect(row<{ firsts: string } | null>("SELECT firsts FROM dating_state")?.firsts ?? "{}").toBe("{}");
  });

  test("holding the day once records it among the durable firsts, pays nothing, and a second try or a retried id changes nothing", async () => {
    seedPurse(20);
    rank(8);
    sqlite.run(`UPDATE purse_state SET flags = '{"award:x":true,"home":{"floor":"tree-cutting"}}'`);
    await prepareAll();
    const id = crypto.randomUUID();
    const held = await call("holdWedding", { request_id: id });
    expect(held.purse.wedding).toMatchObject({ weddings: 1, celebrated: false });
    expect(Object.keys(firsts())).toEqual(["wedding"]);
    expect(firsts().wedding).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    sqlite.run(`UPDATE dating_state SET firsts = '{"wedding":"2026-01-01","night":"2026-02-02"}'`);
    await call("holdWedding", { request_id: id });
    const again = await call("holdWedding");
    expect(again.purse.wedding.weddings).toBe(1);
    expect(firsts()).toEqual({ wedding: "2026-01-01", night: "2026-02-02" });
    expect((await call("prepareWedding", { step: "flowers" })).purse.wedding.weddings).toBe(1);
    await call("celebrateWedding");
    const after = await call("celebrateWedding");
    expect(after.purse.wedding).toMatchObject({ weddings: 1, celebrated: true, steps: ["flowers", "vows", "dress"] });
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBe(20);
    expect(flagsOf()["award:x"]).toBe(true);
    expect(flagsOf().home).toEqual({ floor: "tree-cutting" });
    expect(Object.keys(flagsOf().wedding as object).sort()).toEqual(["celebrated", "steps", "weddings"]);
  });

  test("the wedding-hands keepsake can be placed on the shelf", async () => {
    seedPurse(0);
    const state = await call("arrangeHome", { slot: "shelf-left", keepsake: "wedding-hands" });
    expect(state.purse.home_decor).toEqual({ "shelf-left": "wedding-hands" });
  });
});

describe("Task 59: tender moments are kept as kinds and counts only, from rank 7", () => {
  const flagsOf = () => JSON.parse(row<{ flags: string }>("SELECT flags FROM purse_state").flags) as Record<string, unknown>;
  const rank = (r: number) => sqlite.run("INSERT OR REPLACE INTO affection_state (id, points) VALUES (1, ?)", [r * 100]);

  test("below rank 7 nothing is recorded; from 7 a kind and a count, retry-safe, nothing paid", async () => {
    seedPurse(5);
    rank(6);
    await call("noteTenderMoment", { kind: "cheek-kiss" });
    expect(flagsOf().tender_moments).toBeUndefined();
    rank(7);
    await call("noteTenderMoment", { kind: "cheek-kiss" });
    const id = crypto.randomUUID();
    await call("noteTenderMoment", { kind: "slow-dance", request_id: id });
    await call("noteTenderMoment", { kind: "slow-dance", request_id: id });
    const state = await call("noteTenderMoment", { kind: "cheek-kiss" });
    expect(flagsOf().tender_moments).toEqual({ kind: "tender-moments", counts: { "cheek-kiss": 2, "slow-dance": 1 } });
    expect(state.purse.tender.counts).toEqual({ "cheek-kiss": 2, "slow-dance": 1 });
    expect(row<{ denarii: number }>("SELECT denarii FROM purse_state").denarii).toBe(5);
  });

  test("an unknown kind is refused", async () => {
    rank(7);
    await expect(call("noteTenderMoment", { kind: "anything-else" } as never)).rejects.toThrow();
  });
});
