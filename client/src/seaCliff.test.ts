import { expect, test } from "bun:test";
import { CLIFF, clampToWorld, clearOfSea, HORIZON_HILLS, landOutline, onLand, outwardFromSpine, walkable } from "./seaCliff";

// The sea cliff's geometry (Task 34), pinned off the scene.

const forest = { norm: (x: number, z: number) => Math.hypot((x + 44) / 11.5, (z + 22) / 15), cx: -44, cz: -22 };

test("the trail and the headland are walkable, the sea is not", () => {
  expect(walkable(0, 60)).toBe(true);
  expect(walkable(0, 100)).toBe(true);
  expect(walkable(CLIFF.bench.x, CLIFF.bench.z)).toBe(true);
  expect(walkable(0, CLIFF.head.z + CLIFF.head.r)).toBe(false);
  expect(walkable(20, 80)).toBe(false);
  // The bench stands on land, short of the edge, and faces the sea (south, +Z).
  expect(onLand(CLIFF.bench.x, CLIFF.bench.z + 1.5)).toBe(true);
  expect(CLIFF.bench.rotY).toBeCloseTo(Math.PI);
});

test("the world clamp: town, forest and peninsula pass; the sea and the wide meadow ease back", () => {
  expect(clampToWorld(10, 10, forest)).toEqual({ x: 10, z: 10 });
  expect(clampToWorld(0, 90, forest)).toEqual({ x: 0, z: 90 });
  // Off the peninsula's side, over the sea: back onto the trail.
  const off = clampToWorld(12, 90, forest);
  expect(off.x).toBeCloseTo(CLIFF.walkHalf);
  expect(off.z).toBeCloseTo(90);
  // Past the headland's edge: back onto the headland.
  const edge = clampToWorld(0, 130, forest);
  expect(Math.hypot(edge.x - CLIFF.head.x, edge.z - CLIFF.head.z)).toBeCloseTo(CLIFF.walkHeadR);
  // East of town, no peninsula: back to the town's rim.
  const east = clampToWorld(60, 0, forest);
  expect(east).toEqual({ x: 52, z: 0 });
});

test("the outline runs from the coast round the headland and back, all on its land's edge", () => {
  const pts = landOutline();
  expect(pts[0]!.z).toBe(CLIFF.coastZ);
  expect(pts[pts.length - 1]!.z).toBe(CLIFF.coastZ);
  const southmost = Math.max(...pts.map((p) => p.z));
  expect(southmost).toBeGreaterThanOrEqual(CLIFF.head.z + CLIFF.head.r - 0.01);
  expect(southmost).toBeLessThanOrEqual(CLIFF.head.z + CLIFF.head.r + 0.9);
  // The edge is roughened outward only: every point is on the land or within 0.9 m outside it,
  // so the land never overhangs its cliff.
  for (const p of pts) {
    const o = outwardFromSpine(p);
    expect(onLand(p.x - o.x * 0.95, p.z - o.z * 0.95)).toBe(true);
  }
});

test("the horizon hills stay on land, clear of the sea and of the peninsula's trail", () => {
  for (const [hx, hz, hr, hh] of HORIZON_HILLS) {
    expect(clearOfSea(hz, hr)).toBe(true);
    // Nowhere along the trail or on the headland is under a hill.
    for (let z = CLIFF.walkFromZ; z <= CLIFF.head.z + CLIFF.walkHeadR; z += 2) {
      const d = Math.hypot(0 - hx, z - hz);
      const top = d < hr ? hh * Math.sqrt(1 - (d / hr) ** 2) : 0;
      expect(top).toBeLessThan(0.05);
    }
    // And none rises inside the town's walking disc.
    expect(Math.hypot(hx, hz) - hr).toBeGreaterThan(52);
  }
});

test("clearOfSea: the coast is the line", () => {
  expect(clearOfSea(CLIFF.coastZ - 1)).toBe(true);
  expect(clearOfSea(CLIFF.coastZ + 1)).toBe(false);
  expect(clearOfSea(40, 20)).toBe(false);
});
