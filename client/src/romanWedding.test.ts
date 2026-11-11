import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { HOME_KEEPSAKES } from "../../shared/homeDecor";
import { WEDDING_RANK, WEDDING_STEPS, emptyWedding, hold, markWeddingCelebrated, prepare, type WeddingBook } from "../../shared/romanWedding";
import { WEDDING_ARCH, WEDDING_CELEBRATION_SECONDS, WEDDING_POSTS, buildGarland, buildWeddingArch, createWeddingScene } from "./romanWedding";
import { weddingProgress } from "./WeddingBoard";
import { earnedKeepsakes, type KeepsakeState } from "./homeKeepsakes";
import { buildKeepsake } from "./homeHouse";
import { HISTORY_LESSONS } from "./romanHistory";
import { lessonForPlace } from "./HistoryBook";

const R = WEDDING_RANK;
const ready = (): WeddingBook => WEDDING_STEPS.reduce((b, s) => prepare(b, s, R), emptyWedding());

describe("Task 58: the town dressed for the day", () => {
  test("nothing stands until the dressing; the town is dressed until the day is held", () => {
    const s = createWeddingScene();
    expect(s.setBook(emptyWedding())).toBe(false);
    expect(s.dressed()).toBe(false);
    expect(s.setBook(prepare(prepare(emptyWedding(), "flowers", R), "vows", R))).toBe(false);
    expect(s.dressed()).toBe(false);
    s.setBook(ready());
    expect(s.dressed()).toBe(true);
    const box = new THREE.Box3().setFromObject(s.group);
    expect(box.max.y).toBeGreaterThan(3);
  });

  test("the celebration is owed once; it plays, then the town is undressed and ordinary again", () => {
    const s = createWeddingScene();
    s.setBook(ready());
    const held = hold(ready(), R);
    expect(s.setBook(held)).toBe(true);
    expect(s.dressed()).toBe(false); // nothing is celebrating yet
    s.celebrate();
    s.celebrate();
    expect(s.celebrating()).toBe(true);
    expect(s.dressed()).toBe(true);
    s.setBook(markWeddingCelebrated(held)); // the mark arrives while it plays
    expect(s.dressed()).toBe(true);
    for (let t = 0; t <= WEDDING_CELEBRATION_SECONDS + 2; t++) s.update(1, t);
    expect(s.celebrating()).toBe(false);
    expect(s.dressed()).toBe(false);
    expect(s.setBook(markWeddingCelebrated(held))).toBe(false);
  });

  test("a reload after the day finds the town ordinary", () => {
    const s = createWeddingScene();
    expect(s.setBook(markWeddingCelebrated(hold(ready(), R)))).toBe(false);
    expect(s.dressed()).toBe(false);
  });

  test("garlands hang clear of heads, posts stand on both sides, and the arch rises over the avenue", () => {
    expect(WEDDING_POSTS.length).toBe(10);
    expect(WEDDING_POSTS.filter(([x]) => x < 0).length).toBe(5);
    const g = new THREE.Box3().setFromObject(buildGarland(0, 3, 0, 4, 3, 0));
    expect(g.min.y).toBeGreaterThan(2);
    const arch = new THREE.Box3().setFromObject(buildWeddingArch());
    expect(arch.max.y).toBeGreaterThan(WEDDING_ARCH.height);
    expect(arch.max.x).toBeGreaterThan(WEDDING_ARCH.halfWidth);
  });
});

describe("Task 58: the remembered day", () => {
  const fresh: KeepsakeState = {
    fish: [], letters: [], postcards: [], inscriptions_complete: false, summit: { done: false },
    phoenix: { feathers: 0 }, secret: { first_kiss: null }, garden: { harvests: 0 }, tree: { waterings: 0 },
  };
  test("the clasped hands come from the durable first 'wedding' alone, and not from the preparations", () => {
    expect(earnedKeepsakes(fresh).has("wedding-hands")).toBe(false);
    expect(earnedKeepsakes({ ...fresh, dating: { firsts: { night: "2026-11-08" } } }).has("wedding-hands")).toBe(false);
    expect(earnedKeepsakes({ ...fresh, dating: { firsts: { wedding: "2026-11-10" } } }).has("wedding-hands")).toBe(true);
    expect(HOME_KEEPSAKES.find((k) => k.id === "wedding-hands")?.mount).toBe("shelf");
    const hands = buildKeepsake("wedding-hands");
    expect(hands.children.length).toBeGreaterThan(3);
    // garland-free: nothing green or in bloom stays behind
    const greens = new Set([0x4f7f3a, 0x6aa04b]);
    hands.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat) expect(greens.has(mat.color.getHex())).toBe(false);
    });
  });
  test("progress words follow the book and the rank", () => {
    expect(weddingProgress(emptyWedding(), R - 1)).toContain("Not yet");
    expect(weddingProgress(emptyWedding(), R)).toContain("0 of 3");
    expect(weddingProgress(ready(), R)).toContain("ceremony can begin");
    expect(weddingProgress(hold(ready(), R), R)).toContain("clasped hands");
  });
});

describe("Task 58: the history book's page", () => {
  const lesson = HISTORY_LESSONS.find((l) => l.id === "roman-wedding")!;
  test("a Roman wedding is in the book and is found by its place", () => {
    expect(lesson).toBeDefined();
    expect(lessonForPlace("wedding")).toBe(lesson);
  });
  test("it cites Treggiari, Plutarch's Roman Questions, Catullus 61 and 62, and Festus, and marks what is uncertain", () => {
    const cites = lesson.sources.map((s) => s.cite).join("\n");
    expect(cites).toContain("Treggiari, Roman Marriage");
    expect(cites).toContain("Plutarch, Roman Questions");
    expect(cites).toContain("Catullus, Poems 61 and 62");
    expect(cites).toContain("Festus");
    for (const word of ["flammeum", "pronuba", "dextrarum iunctio", "Ubi tu Gaius, ego Gaia", "deductio", "threshold", "marjoram"]) {
      expect(lesson.text).toContain(word);
    }
    expect(lesson.text).toMatch(/uncertain/);
    expect(lesson.townNote).toMatch(/not always certain/);
    expect(lesson.townNote).toContain("already married");
  });
});

describe("Task 58: wiring", () => {
  const read = (f: string) => readFileSync(join(import.meta.dir, f), "utf8");
  test("the scene places and ticks the dressing, and the app shows the board, plays the celebration once and refetches for the keepsake", () => {
    const scene = read("townScene.ts");
    expect(scene).toContain("createWeddingScene()");
    expect(scene).toContain("weddingScene.update(dt, t)");
    const app = read("App.tsx");
    expect(app).toContain("<WeddingBoard");
    expect(app).toContain("api.holdWedding");
    expect(app).toContain("api.celebrateWedding");
    expect(app).toMatch(/holdWedding = useMutation[\s\S]{0,400}api\.getState/);
  });
  test("the tender gate and the affection ranks are untouched by this task", () => {
    const gate = read("../../shared/tenderGate.ts");
    expect(gate).toContain("export const TENDER_RANK = 7;");
    expect(gate).not.toContain("wedding");
  });
});
