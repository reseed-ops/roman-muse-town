import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { QUEST_DEFS, acceptQuest, advanceQuest, carryQuest, completeQuest, markCelebrated, type QuestBook } from "../../shared/projectQuests";
import { CELEBRATION_SECONDS, QUEST_SPOTS, alongRoad, buildBanner, buildMessenger, createQuestScene } from "./projectQuests";
import { questProgress } from "./QuestBoard";
import { earnedKeepsakes, type KeepsakeState } from "./homeKeepsakes";

const begun = (kind: Parameters<typeof carryQuest>[1]): QuestBook => acceptQuest(carryQuest([], kind), kind);

describe("Task 56: the scene's quest pieces", () => {
  test("the banner stands only once the Focus Companion quest is finished", () => {
    const s = createQuestScene();
    const banner = s.group.children[0]!;
    s.setBook(begun("focus-companion"));
    expect(banner.visible).toBe(false);
    s.setBook(completeQuest(begun("focus-companion"), "focus-companion"));
    expect(banner.visible).toBe(true);
    const box = new THREE.Box3().setFromObject(buildBanner());
    expect(box.max.y).toBeGreaterThan(4); // hung high over the avenue, clear of heads
  });

  test("a messenger goes out for each new application, never at the first look, and runs the road out", () => {
    const s = createQuestScene();
    let b = begun("job-hunt");
    b = advanceQuest(advanceQuest(b, "job-hunt"), "job-hunt");
    expect(s.setBook(b).messengers).toBe(0); // a reload replays no history
    b = advanceQuest(b, "job-hunt");
    expect(s.setBook(b).messengers).toBe(1);
    expect(s.messengersOnRoad()).toBe(1);
    expect(s.setBook(b).messengers).toBe(0); // the same book again sends none
    for (let i = 0; i < 400; i++) s.update(0.1, i * 0.1);
    expect(s.messengersOnRoad()).toBe(0);
    expect(buildMessenger().children.length).toBeGreaterThan(4);
  });

  test("the road is walked end to end", () => {
    const end = alongRoad(QUEST_SPOTS.road, 10_000);
    expect(end.done).toBe(true);
    expect(alongRoad(QUEST_SPOTS.road, 0).done).toBe(false);
  });

  test("a finished quest reports its celebration until it is marked; each celebration plays and ends on its own", () => {
    const s = createQuestScene();
    s.setBook(begun("etsy-shop"));
    const done = completeQuest(begun("etsy-shop"), "etsy-shop");
    expect(s.setBook(done).celebrations).toEqual(["etsy-shop"]);
    expect(s.setBook(markCelebrated(done, "etsy-shop")).celebrations).toEqual([]);
    for (const def of QUEST_DEFS) {
      s.celebrate(def.celebration);
      s.celebrate(def.celebration); // twice at once is still one show
    }
    expect(s.playing().sort()).toEqual(["lamplight", "market-day", "scroll-to-senate", "triumph-feast"]);
    const before = s.group.children.length;
    for (let t = 0; t <= Math.max(...Object.values(CELEBRATION_SECONDS)) + 1; t++) s.update(1, t);
    expect(s.playing()).toEqual([]);
    expect(s.group.children.length).toBeLessThan(before);
  });

  test("the feast has torches and a table, the market day four stalls", () => {
    const s = createQuestScene();
    s.celebrate("triumph-feast");
    let flames = 0;
    s.group.traverse((o) => { if (o.name === "flame") flames++; });
    expect(flames).toBe(QUEST_SPOTS.torches.length);
    expect(QUEST_SPOTS.stalls.length).toBe(4);
  });

  test("progress she can see, per quest", () => {
    const job = QUEST_DEFS.find((q) => q.kind === "job-hunt")!;
    expect(questProgress(job, undefined)).toContain("Not on the board");
    expect(questProgress(job, begun("job-hunt")[0])).toContain("No application");
    const two = advanceQuest(advanceQuest(begun("job-hunt"), "job-hunt"), "job-hunt");
    expect(questProgress(job, two[0])).toContain("2 applications");
    expect(questProgress(QUEST_DEFS[0]!, carryQuest([], "etsy-shop")[0])).toContain("Posted");
  });

  test("the first coin goes on the shelf only after the shop's first sale", () => {
    const fresh: KeepsakeState = {
      fish: [], letters: [], postcards: [], inscriptions_complete: false, summit: { done: false },
      phoenix: { feathers: 0 }, secret: { first_kiss: null }, garden: { harvests: 0 }, tree: { waterings: 0 },
    };
    expect(earnedKeepsakes({ ...fresh, purse: { quests: [{ kind: "etsy-shop", completed: 0 }] } }).size).toBe(0);
    expect(earnedKeepsakes({ ...fresh, purse: { quests: [{ kind: "job-hunt", completed: 3 }] } }).size).toBe(0);
    expect(earnedKeepsakes({ ...fresh, purse: { quests: [{ kind: "etsy-shop", completed: 1 }] } })).toEqual(new Set(["first-coin"]));
  });

  test("the scene and the board are wired to the quests, and nothing pays", () => {
    const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
    expect(scene).toContain("createQuestScene");
    expect(scene).toContain("questScene.update");
    expect(app).toContain("<QuestBoard");
    expect(app).toContain("celebrateQuest.mutate");
    const server = readFileSync(join(import.meta.dir, "../../server/src/actions.ts"), "utf8");
    const block = server.slice(server.indexOf("async function moveQuest"), server.indexOf("/** Small gameplay response"));
    expect(block).not.toMatch(/awardDenarii|denarii|points/);
  });
});
