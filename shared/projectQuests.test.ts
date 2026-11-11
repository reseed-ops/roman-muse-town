import { describe, expect, test } from "bun:test";
import { gateTender } from "./tenderGate";
import { HOME_KEEPSAKES, fits } from "./homeDecor";
import {
  MAX_QUEST_STEPS, QUEST_DEFS, QUEST_KINDS, QUEST_LINES,
  acceptQuest, advanceQuest, carryQuest, completeQuest, markCelebrated, pendingCelebrations, readQuestBook, type QuestBook,
} from "./projectQuests";

describe("Task 56: the four first quests", () => {
  test("one per real project, each with a beginning, a celebration and her offer", () => {
    expect([...QUEST_KINDS]).toEqual(["etsy-shop", "focus-companion", "job-hunt", "vietnamese"]);
    expect(QUEST_DEFS.map((q) => q.project)).toEqual([
      "The Etsy shop, TradesDesign", "Focus Companion (Reseed)", "The primary job hunt", "Learning Vietnamese",
    ]);
    expect(QUEST_DEFS.map((q) => q.celebration)).toEqual(["market-day", "scroll-to-senate", "triumph-feast", "lamplight"]);
    for (const q of QUEST_DEFS) {
      expect(q.beginning.length).toBeGreaterThan(10);
      expect(q.offer.length).toBeGreaterThan(0);
      expect(q.celebrationLines.length).toBeGreaterThan(0);
    }
  });

  test("only the job hunt and the lessons carry steps; the shop's keepsake is a real shelf item", () => {
    expect(QUEST_DEFS.filter((q) => q.step).map((q) => q.kind)).toEqual(["job-hunt", "vietnamese"]);
    const shop = QUEST_DEFS.find((q) => q.kind === "etsy-shop")!;
    const keep = HOME_KEEPSAKES.find((k) => k.id === shop.keepsake);
    expect(keep?.mount).toBe("shelf");
    expect(fits("shelf-left", "first-coin")).toBe(true);
    expect(fits("floor", "first-coin")).toBe(false);
  });
});

describe("Task 56: the rules of a quest", () => {
  const begun = (kind: (typeof QUEST_KINDS)[number]): QuestBook => acceptQuest(carryQuest([], kind), kind);

  test("a quest is carried, taken up, advanced and finished, in that order and no other", () => {
    expect(acceptQuest([], "job-hunt")).toEqual([]);
    expect(advanceQuest(carryQuest([], "job-hunt"), "job-hunt")[0]!.steps).toBe(0); // not yet taken up
    expect(completeQuest(carryQuest([], "job-hunt"), "job-hunt")[0]!.stage).toBe("posted");
    let b = begun("job-hunt");
    b = advanceQuest(advanceQuest(b, "job-hunt"), "job-hunt");
    expect(b[0]).toMatchObject({ stage: "begun", steps: 2, completed: 0 });
    b = completeQuest(b, "job-hunt");
    expect(b[0]).toMatchObject({ stage: "done", steps: 0, completed: 1, celebrated: false });
  });

  test("carrying again changes nothing while it is on the board", () => {
    const b = begun("vietnamese");
    expect(carryQuest(b, "vietnamese")).toEqual(b);
    expect(acceptQuest(b, "vietnamese")).toEqual(b);
  });

  test("a quest without steps takes none", () => {
    const b = begun("etsy-shop");
    expect(advanceQuest(b, "etsy-shop")).toEqual(b);
  });

  test("steps are bounded", () => {
    let b = begun("vietnamese");
    b = [{ ...b[0]!, steps: MAX_QUEST_STEPS }];
    expect(advanceQuest(b, "vietnamese")[0]!.steps).toBe(MAX_QUEST_STEPS);
  });

  test("finishing counts once: repeating the ending cannot raise the count", () => {
    let b = completeQuest(begun("focus-companion"), "focus-companion");
    for (let i = 0; i < 5; i++) b = completeQuest(b, "focus-companion");
    expect(b[0]!.completed).toBe(1);
  });

  test("the celebration is owed once, plays once, and is not owed again", () => {
    let b = completeQuest(begun("etsy-shop"), "etsy-shop");
    expect(pendingCelebrations(b)).toEqual(["etsy-shop"]);
    // A finished quest awaiting its celebration cannot be re-posted over it.
    expect(carryQuest(b, "etsy-shop")).toEqual(b);
    b = markCelebrated(b, "etsy-shop");
    expect(pendingCelebrations(b)).toEqual([]);
    expect(markCelebrated(b, "etsy-shop")).toEqual(b);
    // Nothing owed on a quest that never finished.
    expect(pendingCelebrations(begun("job-hunt"))).toEqual([]);
    expect(markCelebrated(begun("job-hunt"), "job-hunt")[0]!.celebrated).toBe(true);
  });

  test("the record is a kind and a count only: a finished quest keeps nothing else, and may be posted afresh", () => {
    let b = completeQuest(advanceQuest(begun("job-hunt"), "job-hunt"), "job-hunt");
    b = markCelebrated(b, "job-hunt");
    b = carryQuest(b, "job-hunt");
    expect(b[0]).toEqual({ kind: "job-hunt", stage: "posted", steps: 0, completed: 1, celebrated: true });
    expect(Object.keys(b[0]!).sort()).toEqual(["celebrated", "completed", "kind", "stage", "steps"]);
    // No points, currency or reward field anywhere in a record or a definition.
    for (const q of QUEST_DEFS) expect(Object.keys(q).join(",")).not.toMatch(/point|score|coin(?!s)|denarii|reward|streak|xp/i);
  });

  test("a stored book drops what is not valid and keeps kinds in order", () => {
    const book = readQuestBook([
      { kind: "vietnamese", stage: "begun", steps: 3, completed: 0, celebrated: true, extra: "x" },
      { kind: "bogus", stage: "done" },
      "junk",
      { kind: "etsy-shop", stage: "nonsense", steps: -4, completed: 1.5 },
    ]);
    expect(book.map((r) => r.kind)).toEqual(["etsy-shop", "vietnamese"]);
    expect(book[0]).toEqual({ kind: "etsy-shop", stage: "posted", steps: 0, completed: 0, celebrated: true });
    expect(readQuestBook(null)).toEqual([]);
  });
});

describe("Task 56: her lines pass the tender-only gate at every rank", () => {
  test("every offer, step and celebration line is clean", () => {
    expect(QUEST_LINES.length).toBeGreaterThan(12);
    for (const line of QUEST_LINES) for (let rank = 0; rank <= 10; rank++) expect(gateTender(line, rank)).toBeNull();
  });
});
