import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createPlaceFootprints } from "./buildingFootprints";
import { circ, obb, obbLocal, type Obstacle } from "./collision";
import {
  COLOSSEUM_BUDGET, COLOSSEUM_PLACEMENT, COLOSSEUM_RING_RADIUS, COLOSSEUM_ROOF_RATIO, COLOSSEUM_SOURCE, ROAD_END,
  SETTING_FILES, SETTING_PIECES, STEPS_SEEK_SPOT, settingFootprints, type SettingAsset,
} from "./colosseumSetting";
import { BATHS, COLOSSEUM, MARKET_BOOTHS, PLACES, SEEK_SPOTS, STREETS, streetDistance, streetWidth, terrainHeight } from "./town";
import { samplePath } from "./pathGeometry";

const ASSETS = join(import.meta.dir, "assets");
const parse = (file: string) => {
  const b = readFileSync(join(ASSETS, file));
  const jsonLen = b.readUInt32LE(12);
  return { bytes: b.length, json: JSON.parse(b.subarray(20, 20 + jsonLen).toString("utf8")) as GltfJson };
};
interface GltfJson {
  accessors: { count: number; type: string; min?: number[]; max?: number[] }[];
  meshes: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorTexture?: unknown } }[];
  images?: unknown[];
  nodes: { scale?: number[] }[];
}
const triangles = (j: GltfJson) =>
  j.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices !== undefined ? j.accessors[p.indices]!.count : j.accessors[p.attributes.POSITION!]!.count) / 3, 0);
// absent on a clean clone, and an empty stand-in (web/stubAssets.ts) is not the file either
const present = Object.values(SETTING_FILES).every((f) => existsSync(join(ASSETS, f)) && statSync(join(ASSETS, f)).size > 1000);

describe("the Colosseum and its setting (Task 85)", () => {
  test("the colosseum is where town.ts cuts its basin, at the width the collision ring assumes", () => {
    expect([COLOSSEUM_PLACEMENT.x, COLOSSEUM_PLACEMENT.z] as number[]).toEqual([...COLOSSEUM.position]);
    expect(COLOSSEUM_RING_RADIUS).toBe(8);
  });

  test("every piece names a file that the pack layout lists, in the idyllic folder", () => {
    for (const piece of SETTING_PIECES) expect(SETTING_FILES[piece.asset as SettingAsset]).toMatch(/^idyllic\/.+\.glb$/);
    expect(new Set(Object.values(SETTING_FILES)).size).toBe(Object.keys(SETTING_FILES).length);
  });

  test("the build's budget sits far under the source mesh", () => {
    expect(COLOSSEUM_BUDGET.maxTriangles).toBeLessThan(COLOSSEUM_SOURCE.polygons / 7);
    expect(COLOSSEUM_BUDGET.maxBytes).toBeLessThan(COLOSSEUM_SOURCE.glbBytes / 5);
  });

  test.skipIf(!present)("the slimmed colosseum loads, stays inside the budget, and is textured", () => {
    const { bytes, json } = parse(SETTING_FILES.colosseum);
    expect(bytes).toBeLessThanOrEqual(COLOSSEUM_BUDGET.maxBytes);
    expect(triangles(json)).toBeLessThanOrEqual(COLOSSEUM_BUDGET.maxTriangles);
    expect(triangles(json)).toBeGreaterThan(20_000); // not a ruined stub: the arches and tiers are still modelled
    expect(json.meshes[0]!.primitives.length).toBeLessThanOrEqual(14); // a handful of draw calls
    const textured = (json.materials ?? []).filter((m) => m.pbrMetallicRoughness?.baseColorTexture);
    expect(textured.length).toBeGreaterThanOrEqual(9); // stone, columns, trims, banners... the pack's own BaseMaps
    expect((json.images ?? []).length).toBeGreaterThanOrEqual(9);
  });

  test.skipIf(!present)("the roof ratio the phoenix perch uses matches the model", () => {
    const { json } = parse(SETTING_FILES.colosseum);
    const pos = json.accessors.filter((a) => a.type === "VEC3" && a.min && a.max);
    const width = Math.max(...pos.map((a) => a.max![0]!)) - Math.min(...pos.map((a) => a.min![0]!));
    // glTF is Y-up: the stone roofline is the tallest part that is not a mast or rope.
    const heights = pos.map((a) => a.max![1]!).sort((a, b) => b - a);
    expect(width).toBeGreaterThan(41);
    expect(width).toBeLessThan(43);
    expect(heights[0]! / width).toBeGreaterThan(COLOSSEUM_ROOF_RATIO); // masts rise above the roof
    expect(COLOSSEUM_ROOF_RATIO * COLOSSEUM_PLACEMENT.width).toBeGreaterThan(8); // roof 8.6 m at the placed width
    expect(COLOSSEUM_ROOF_RATIO * COLOSSEUM_PLACEMENT.width).toBeLessThan(9.2);
  });

  test.skipIf(!present)("every setting piece is a small textured GLB and the whole folder stays modest", () => {
    let total = 0;
    for (const [asset, file] of Object.entries(SETTING_FILES)) {
      const { bytes, json } = parse(file);
      total += bytes;
      if (asset !== "colosseum") expect(bytes).toBeLessThan(700_000);
      expect(triangles(json)).toBeGreaterThan(0);
      if (asset !== "colosseum") expect(triangles(json)).toBeLessThan(8_000);
    }
    expect(total).toBeLessThan(8_000_000) // 7.5 MB until Task 93 restored the normal and mask maps (+0.6 MB with the podest);
  });

  test("the stair, statues and podests stand on the ring's road side, clear of the ring and of the road", () => {
    const [cx, cz] = [COLOSSEUM_PLACEMENT.x, COLOSSEUM_PLACEMENT.z];
    for (const id of ["stair", "podest-left", "podest-right", "statue-left", "statue-right"]) {
      const p = SETTING_PIECES.find((q) => q.id === id)!;
      const r = Math.hypot(p.x - cx, p.z - cz);
      expect(r).toBeGreaterThan(8.2);
      expect(r).toBeLessThan(10);
      expect(p.x).toBeLessThan(cx); // the west face, toward the town and the road
    }
    const stair = SETTING_PIECES.find((q) => q.id === "stair")!;
    // the stair's high end (local -z) points at the centre
    const toCentre = Math.atan2(cx - stair.x, cz - stair.z);
    const high = Math.atan2(-Math.sin(stair.rotY), -Math.cos(stair.rotY));
    expect(Math.cos(toCentre - high)).toBeGreaterThan(0.999);
  });

  test("the two statues are a matched pair either side of the stair, on podests", () => {
    const stair = SETTING_PIECES.find((q) => q.id === "stair")!;
    const left = SETTING_PIECES.find((q) => q.id === "statue-left")!;
    const right = SETTING_PIECES.find((q) => q.id === "statue-right")!;
    expect(left.asset).not.toBe(right.asset);
    expect(left.lift).toBe(right.lift);
    expect(left.lift).toBeGreaterThan(0.5);
    expect(Math.hypot(left.x - stair.x, left.z - stair.z)).toBeCloseTo(Math.hypot(right.x - stair.x, right.z - stair.z), 3);
    for (const [s, pod] of [["statue-left", "podest-left"], ["statue-right", "podest-right"]] as const) {
      const a = SETTING_PIECES.find((q) => q.id === s)!, b = SETTING_PIECES.find((q) => q.id === pod)!;
      expect([a.x, a.z]).toEqual([b.x, b.z]);
      expect(a.lift).toBeCloseTo(b.height!, 3); // the statue stands on top of its podest
    }
  });

  test("the houses stand on the rim, outside the basin's plaza and the ring, and face the Colosseum", () => {
    const [cx, cz] = [COLOSSEUM_PLACEMENT.x, COLOSSEUM_PLACEMENT.z];
    const houses = SETTING_PIECES.filter((p) => /^house|^insula/.test(p.asset));
    expect(houses.filter((p) => p.asset.startsWith("house")).length).toBeGreaterThanOrEqual(2);
    expect(houses.filter((p) => p.asset === "insula").length).toBeGreaterThanOrEqual(1);
    expect(houses.length).toBeLessThanOrEqual(6); // a few houses, not a quarter
    for (const h of houses) {
      expect(Math.hypot(h.x - cx, h.z - cz)).toBeGreaterThanOrEqual(15); // past COLOSSEUM_BASIN.riseTo
      expect(Math.hypot(h.x - cx, h.z - cz)).toBeLessThanOrEqual(24);
      const front = Math.atan2(Math.sin(h.rotY), Math.cos(h.rotY)); // local +z
      const toCentre = Math.atan2(cx - h.x, cz - h.z);
      expect(Math.cos(front - toCentre)).toBeGreaterThan(0.999);
    }
  });

  test("banners are the pack's, on poles, and out of the road", () => {
    const poles = SETTING_PIECES.filter((p) => p.asset === "banner");
    expect(poles.length).toBeGreaterThanOrEqual(2);
    for (const p of poles) {
      expect(p.pole).toBeGreaterThan(2.5);
      expect(streetDistance(p.x, p.z)).toBeGreaterThan(streetWidth(13) / 2 + 0.2);
    }
  });

  const shapes: [string, Obstacle][] = settingFootprints().map((f) => [f.id, "r" in f ? circ(f.x, f.z, f.r) : obb(f.x, f.z, f.hx, f.hz, f.rot)]);
  const clearance = (ob: Obstacle, x: number, z: number) => {
    if (ob.kind === "circle") return Math.hypot(x - ob.x, z - ob.z) - ob.r;
    const { lx, lz } = obbLocal(ob, x, z);
    const dx = Math.abs(lx) - ob.halfW, dz = Math.abs(lz) - ob.halfD;
    return dx < 0 && dz < 0 ? Math.max(dx, dz) : Math.hypot(Math.max(0, dx), Math.max(0, dz));
  };
  const nearestClearance = (a: Obstacle, b: Obstacle) => {
    // sample b's outline and centre against a: good enough to catch overlap
    const pts: [number, number][] = b.kind === "circle"
      ? [[b.x, b.z], ...Array.from({ length: 16 }, (_, i): [number, number] => [b.x + b.r * Math.cos(i * Math.PI / 8), b.z + b.r * Math.sin(i * Math.PI / 8)])]
      : [[b.x, b.z], ...[-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j): [number, number] => {
        const c = Math.cos(b.rot), s = Math.sin(b.rot), lx = i * b.halfW, lz = j * b.halfD;
        return [b.x + lx * c + lz * s, b.z - lx * s + lz * c];
      }))];
    return Math.min(...pts.map(([x, z]) => clearance(a, x, z)));
  };

  test("no setting piece overlaps another or the Colosseum's ring", () => {
    const ring = circ(COLOSSEUM.position[0], COLOSSEUM.position[1], 8);
    for (let i = 0; i < shapes.length; i++) {
      // the stair's high end meets the plinth (it may bury up to 0.6 m into the ring); nothing else touches it
      const allowed = shapes[i]![0] === "stair" ? -0.6 : -0.01;
      expect([shapes[i]![0], nearestClearance(ring, shapes[i]![1]) > allowed]).toEqual([shapes[i]![0], true]);
      for (let j = i + 1; j < shapes.length; j++) {
        if (shapes[i]![0].startsWith("podest") && shapes[j]![0].startsWith("podest")) continue;
        expect([shapes[i]![0], shapes[j]![0], nearestClearance(shapes[i]![1], shapes[j]![1]) > 0]).toEqual([shapes[i]![0], shapes[j]![0], true]);
      }
    }
  });

  test("no street, building, market booth or bath wall is touched, and the stair leaves the seek spot reachable", () => {
    const others: [string, Obstacle][] = [
      ...createPlaceFootprints(PLACES).entries(),
      ["Temple", obb(31, -27, 5.27, 12.86, -0.6)],
      ["Bath water", obb(BATHS.position[0], 23.4, 3.4, 1.5, 0)],
      ...MARKET_BOOTHS.map(([x, z, rot], i) => [`Market ${i}`, obb(x, z, 1.73, 0.86, rot)] as [string, Obstacle]),
    ];
    for (const [id, shape] of shapes) {
      for (const [name, other] of others) expect([id, name, nearestClearance(other, shape) > 0.5]).toEqual([id, name, true]);
      STREETS.forEach((path, i) => {
        const near = Math.min(...samplePath(path).points.map(([x, z]) => clearance(shape, x, z)));
        expect([id, `street ${i}`, near >= streetWidth(i) / 2]).toEqual([id, `street ${i}`, true]);
      });
    }
    const spot = SEEK_SPOTS.find((s) => s.id === "colosseum-steps")!;
    expect([spot.x, spot.z]).toEqual([...STEPS_SEEK_SPOT]);
    for (const [id, shape] of shapes) expect([id, clearance(shape, spot.x, spot.z) > 0.6]).toEqual([id, true]);
    expect(Math.hypot(ROAD_END[0] - COLOSSEUM.position[0], ROAD_END[1] - COLOSSEUM.position[1])).toBeGreaterThan(8);
  });

  test("the ground under the setting is the basin's: the stair sits on the plaza, the houses on the rim", () => {
    const stair = SETTING_PIECES.find((q) => q.id === "stair")!;
    expect(terrainHeight(stair.x, stair.z)).toBeLessThan(0.6);
    expect(Math.abs(terrainHeight(stair.x, stair.z) - terrainHeight(COLOSSEUM.position[0], COLOSSEUM.position[1]))).toBeLessThan(0.7);
  });
});
