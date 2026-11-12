import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { HOME_KEEPSAKES } from "../../shared/homeDecor";
import { WEDDING_RANK, WEDDING_STEPS, emptyWedding, hold, markWeddingCelebrated, prepare, type WeddingBook } from "../../shared/romanWedding";
import { WEDDING_ARCH, WEDDING_CELEBRATION_SECONDS, WEDDING_PIECES, WEDDING_POSTS, buildGarland, buildWeddingArch, createWeddingScene, type WeddingPieceId, type WeddingPlacer } from "./romanWedding";
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
    expect(scene).toContain("createWeddingScene({");
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

// Task 84: the Wedding Banquet pack's pieces dress the same quest. The scene is handed a loader, so these run
// without any asset: a fake placer stands a marker group where placeModel would stand a model.
describe("Task 84: the wedding pieces", () => {
  const IDS: WeddingPieceId[] = ["flower_arch", "flammeum_stand", "table_round", "table_long", "cake", "ring_box"];
  const fakePlacer = (calls: { id: WeddingPieceId; x: number; y: number; z: number }[], fail: WeddingPieceId[] = []): WeddingPlacer =>
    async (id, parent, o) => {
      calls.push({ id, x: o.x, y: o.y, z: o.z });
      if (fail.includes(id)) return null;
      const g = new THREE.Group();
      g.name = id;
      g.position.set(o.x, o.y, o.z);
      parent.add(g);
      return g;
    };
  const shown = (s: ReturnType<typeof createWeddingScene>) => s.pieces().filter((p) => p.visible).map((p) => p.id).sort();

  test("six pieces, each named once, placed inside the avenue's posts around the arch", () => {
    expect(WEDDING_PIECES.map((p) => p.id).sort()).toEqual([...IDS].sort());
    const postX = Math.min(...WEDDING_POSTS.map(([x]) => Math.abs(x)));
    for (const p of WEDDING_PIECES) {
      // x half-extent, turned by rotY (a piece is at most twice as long as it is deep)
      const w = p.width ?? 0;
      const halfX = (Math.abs(Math.cos(p.rotY)) * w) / 2 + (Math.abs(Math.sin(p.rotY)) * w * 0.5) / 2;
      expect(Math.abs(p.x) + halfX).toBeLessThan(postX);
      expect(p.z).toBeGreaterThan(-8);
      expect(p.z).toBeLessThan(2);
    }
    const arch = WEDDING_PIECES.find((p) => p.id === "flower_arch")!;
    expect(arch.x).toBe(0);
    expect(arch.width!).toBeLessThan(WEDDING_ARCH.halfWidth * 2); // fits between the wooden poles
    // The cake and the ring box stand on the long table's top, which is where the table is.
    const table = WEDDING_PIECES.find((p) => p.id === "table_long")!;
    for (const id of ["cake", "ring_box"] as const) {
      const p = WEDDING_PIECES.find((q) => q.id === id)!;
      expect(p.at).toBe("feast");
      expect(p.y!).toBeGreaterThan(0.9);
      expect(Math.hypot(p.x - table.x, p.z - table.z)).toBeLessThan(table.width! / 2);
    }
  });

  test("nothing loads until the town is dressed; then every piece loads once, on the terrain", async () => {
    const calls: { id: WeddingPieceId; x: number; y: number; z: number }[] = [];
    const s = createWeddingScene({ place: fakePlacer(calls) });
    s.setBook(emptyWedding());
    s.setBook(prepare(prepare(emptyWedding(), "flowers", R), "vows", R));
    await s.loaded();
    expect(calls.length).toBe(0);
    s.setBook(ready());
    s.setBook(ready());
    await s.loaded();
    expect(calls.map((c) => c.id).sort()).toEqual([...IDS].sort());
    expect(s.pieces().length).toBe(6);
  });

  test("the preparations dress the arch, the veil and the round table; the banquet is laid only for the celebration, then all comes down", async () => {
    const s = createWeddingScene({ place: fakePlacer([]) });
    s.setBook(ready());
    await s.loaded();
    expect(shown(s)).toEqual(["flammeum_stand", "flower_arch", "table_round"]);
    const held = hold(ready(), R);
    expect(s.setBook(held)).toBe(true); // the day is held, the celebration is owed
    expect(shown(s)).toEqual([]);
    s.celebrate();
    expect(shown(s)).toEqual([...IDS].sort());
    for (let t = 0; t <= WEDDING_CELEBRATION_SECONDS + 2; t++) s.update(1, t);
    expect(s.celebrating()).toBe(false);
    expect(shown(s)).toEqual([]);
    expect(s.dressed()).toBe(false);
  });

  test("the pack's arch replaces the procedural garland; a failed load leaves the garland standing", async () => {
    const withModel = createWeddingScene({ place: fakePlacer([]) });
    withModel.setBook(ready());
    await withModel.loaded();
    const named = (s: ReturnType<typeof createWeddingScene>) => { let n = 0; s.group.traverse((o) => { if (o.name === "archGarland") n++; }); return n; };
    expect(named(withModel)).toBe(0);
    const failed = createWeddingScene({ place: fakePlacer([], ["flower_arch", "cake"]) });
    failed.setBook(ready());
    await failed.loaded();
    expect(named(failed)).toBe(1);
    expect(failed.pieces().map((p) => p.id)).not.toContain("flower_arch");
    expect(failed.dressed()).toBe(true); // the dressing carries on without the pieces
  });

  test("a throwing loader does not break the dressing, and a scene with no loader still works", async () => {
    const boom = createWeddingScene({ place: () => { throw new Error("nope"); } });
    expect(() => boom.setBook(ready())).not.toThrow();
    await boom.loaded().catch(() => {});
    expect(boom.dressed()).toBe(true);
    const bare = createWeddingScene();
    bare.setBook(ready());
    await bare.loaded();
    expect(bare.pieces()).toEqual([]);
  });

  test("the keepsake and the quest's structure are unchanged: the shared module and the keepsake build do not know the pieces", () => {
    const shared = readFileSync(join(import.meta.dir, "../../shared/romanWedding.ts"), "utf8");
    expect(shared).not.toMatch(/flower_arch|WEDDING_PIECES|banquet/i);
    expect(WEDDING_STEPS).toEqual(["flowers", "vows", "dress"]);
    expect(buildKeepsake("wedding-hands").children.length).toBeGreaterThan(0);
  });

  test("wiring: the scene hands the loader its six URLs; romanWedding.ts imports no asset; the pieces travel in their own pack", () => {
    const read = (f: string) => readFileSync(join(import.meta.dir, f), "utf8");
    const scene = read("townScene.ts");
    for (const f of ["flower_arch", "flammeum_stand", "table_round", "table_long", "cake", "ring_box"]) {
      expect(scene).toContain(`./assets/wedding/${f}.glb`);
    }
    expect(scene).toContain("place: (id, parent, o) => placeModel(WEDDING_PIECE_URLS[id], parent, o)");
    expect(read("romanWedding.ts")).not.toMatch(/\.glb|\.\/assets/);
    expect(read("../../web/assetPack.ts")).toContain('rel.startsWith("wedding/")');
  });

  // The files are licensed and absent from a clean clone and from CI; on the build box they are checked for real.
  const dir = join(import.meta.dir, "assets/wedding");
  const present = IDS.every((id) => existsSync(join(dir, `${id}.glb`)));
  const header = (id: string) => {
    const b = readFileSync(join(dir, `${id}.glb`));
    return { b, json: JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")) as { materials: { name: string; pbrMetallicRoughness?: { baseColorFactor?: number[] } }[]; meshes: unknown[] } };
  };
  test.skipIf(!present)("the six files are well-formed GLBs, small, and recoloured to the Roman palette", () => {
    let total = 0;
    for (const id of IDS) {
      const { b, json } = header(id);
      expect(b.subarray(0, 4).toString()).toBe("glTF");
      expect(b.readUInt32LE(8)).toBe(b.length);
      expect(json.meshes.length).toBeGreaterThan(0);
      total += b.length;
      // No pack pink survives: blush/peach/rose petals are deep red and terracotta now.
      for (const m of json.materials) {
        const c = m.pbrMetallicRoughness?.baseColorFactor;
        if (/^Wedding_Petal_(Blush|Rose)$/.test(m.name)) expect(c![0]! > 0.2 && c![1]! < 0.05).toBe(true);
        if (m.name === "Wedding_Leaf") expect(c![1]! > c![0]!).toBe(true);
      }
    }
    expect(total).toBeLessThan(1_000_000); // the whole set is under 1 MB (Mobile variants), and fetched only when the day dresses the town
    const veil = header("flammeum_stand").json.materials.find((m) => m.name === "Wedding_Veil")!;
    expect(veil.pbrMetallicRoughness!.baseColorFactor![0]!).toBeGreaterThan(veil.pbrMetallicRoughness!.baseColorFactor![2]! * 3); // saffron, not white
  });
});
