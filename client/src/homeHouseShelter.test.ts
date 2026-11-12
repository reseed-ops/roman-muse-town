import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { buildHomeHouse, splashLanding } from "./homeHouse";
import { groundHeightAt, HOME_FLOOR_Y, homeToWorld, terrainHeight } from "./town";
import { COMPLUVIUM, inRect, ROOMS, WALLS } from "./homePlan";

// Task 79: the domus's thresholds, eaves and overhang (Codex's Task 76 review, section 3).
// Expected answers below are written out by hand from the plan, not derived from ROOMS.

const world = (lx: number, lz: number) => homeToWorld(lx, lz);
type House = ReturnType<typeof buildHomeHouse>;

// [local x, local z, inside, sheltered, what]
const SAMPLES: [number, number, boolean, boolean, string][] = [
  [0, 0.5, true, false, "the compluvium"],
  [0, 1.9, true, true, "fauces/atrium threshold"],
  [-0.4, 1.9, true, true, "fauces/atrium threshold, off axis"],
  [0.4, 1.9, true, true, "fauces/atrium threshold, off axis"],
  [-1.95, 1.9, true, true, "south cell door"],
  [1.95, 1.9, true, true, "north cell door"],
  [0, -0.9, true, true, "atrium/tablinum threshold"],
  [-0.7, -0.9, true, true, "atrium/tablinum threshold"],
  [0.7, -0.9, true, true, "atrium/tablinum threshold"],
  [-2.05, -0.9, true, true, "closet door"],
  [2.0, -0.9, true, true, "passage door"],
  [0, -2.3, true, true, "tablinum/gallery threshold"],
  [-0.4, -2.3, true, true, "tablinum/gallery threshold"],
  [0.4, -2.3, true, true, "tablinum/gallery threshold"],
  [2.0, -2.3, true, true, "passage/gallery threshold"],
  [3.35, -2.3, true, true, "bedroom/gallery door"],
  [2.7, -0.25, true, true, "bedroom door"],
  [2.7, 1.3, true, true, "dining room door"],
  [0, 3.31, true, true, "the front door's sill"],
  [0, -3.3, true, true, "the gallery's overhang over the garden"],
  [1.2, -3.4, true, true, "the gallery's overhang over the garden"],
  [1.2, -4.0, true, false, "the open garden"],
  [0, -4.5, true, false, "the open garden"],
  [0, 4.2, false, true, "the porch"],
  [-3.0, -1.5, false, true, "under the west eave"],
  [0, 8, false, false, "the lawn"],
  [-4, 0, false, false, "outside the west wall"],
];

describe("thresholds, eaves and the overhang", () => {
  test("every doorway is inside and under a roof, the court is open, with independent expectations", () => {
    const house = buildHomeHouse(terrainHeight);
    for (const [lx, lz, inside, sheltered, what] of SAMPLES) {
      const p = world(lx, lz);
      expect([what, house.inside(p.x, p.z)]).toEqual([what, inside]);
      expect([what, house.sheltered(p.x, p.z)]).toEqual([what, sheltered]);
    }
  });

  test("walking the axis from the door to the garden never leaves the house, nor the roof until the court", () => {
    const house = buildHomeHouse(terrainHeight);
    for (let lz = 3.3; lz >= -3.19; lz -= 0.01) {
      const p = world(0, lz);
      expect(house.inside(p.x, p.z)).toBe(true);
      // Sheltered all the way, but for the compluvium's span.
      expect(house.sheltered(p.x, p.z)).toBe(!(lz >= COMPLUVIUM.z0 && lz <= COMPLUVIUM.z1));
    }
  });

  test("a walker crossing an interior doorway stays home: the lamp's arrival does not fire again", () => {
    const house = buildHomeHouse(terrainHeight);
    const from = world(0, 1.0);
    expect(house.update(1 / 30, [from], 1)).toBe(true); // arrival: the lamp catches, once
    // The only walker steps through the atrium/tablinum doorway into the tablinum, on to the gallery: no second arrival.
    for (let lz = 1.0; lz >= -3.1; lz -= 0.02) {
      const p = world(0, lz);
      expect(house.update(1 / 30, [p], 1)).toBe(false);
    }
    // Leaving by the door and coming back is an arrival again.
    house.update(1 / 30, [world(0, 30)], 1);
    expect(house.update(1 / 30, [world(0, 1.0)], 1)).toBe(true);
  });
});

// ---- Raycasts through the built meshes.

const meshesOf = (house: House) => {
  house.group.updateMatrixWorld(true);
  const list: THREE.Mesh[] = [];
  house.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) list.push(o as THREE.Mesh); });
  return list;
};

/** Does a roof-like surface (facing up or down, not a vertical wall face) lie above (lx, lz), higher than a lintel? */
const roofAbove = (meshes: THREE.Mesh[], lx: number, lz: number): boolean => {
  const p = world(lx, lz);
  const ray = new THREE.Raycaster(new THREE.Vector3(p.x, HOME_FLOOR_Y + 0.1, p.z), new THREE.Vector3(0, 1, 0), 0, 30);
  const normal = new THREE.Vector3();
  for (const h of ray.intersectObjects(meshes, false)) {
    if (!h.face) continue;
    normal.copy(h.face.normal).transformDirection(h.object.matrixWorld);
    if (Math.abs(normal.y) < 0.35) continue; // a vertical wall face
    if (h.point.y - HOME_FLOOR_Y > 2.4) return true;
  }
  return false;
};

describe("the roof the meshes make is the roof the shelter says", () => {
  test("on a grid across the house, the eaves and the court, an upward ray meets a roof exactly where it is sheltered", () => {
    const house = buildHomeHouse(terrainHeight);
    const meshes = meshesOf(house);
    // Within a hand's breadth of a roof's edge the two may differ by a tile's width: sample either side, not on it.
    const nearEdge = (x: number, z: number) => {
      const slabEdges = [-3.1, -2.76, -0.9, -0.95, 1.95, 2.7, 2.76, 3.8, 4.1, 6.8, -2.7, -2.4, -3.45, 1.8, -0.9];
      return slabEdges.some((e) => Math.abs(x - e) < 0.16 || Math.abs(z - e) < 0.16) ||
        [COMPLUVIUM.x0, COMPLUVIUM.x1].some((e) => Math.abs(x - e) < 0.16) ||
        [COMPLUVIUM.z0, COMPLUVIUM.z1].some((e) => Math.abs(z - e) < 0.16);
    };
    let checked = 0;
    let roofed = 0;
    const bad: string[] = [];
    for (let lx = -3.5; lx <= 7.3; lx += 0.1) {
      for (let lz = -4.7; lz <= 4.3; lz += 0.1) {
        // The porch's roof belongs to the porch, which house.sheltered counts too.
        if (nearEdge(lx, lz)) continue;
        const p = world(lx, lz);
        const above = roofAbove(meshes, lx, lz);
        checked++;
        if (above) roofed++;
        if (above !== house.sheltered(p.x, p.z)) bad.push(`(${lx.toFixed(2)}, ${lz.toFixed(2)}) roof=${above}`);
      }
    }
    expect(bad.slice(0, 12)).toEqual([]);
    expect(checked).toBeGreaterThan(3000);
    expect(roofed).toBeGreaterThan(1500);
  });

  test("the thresholds, the overhang and either side of the compluvium's frame, by ray", () => {
    const house = buildHomeHouse(terrainHeight);
    const meshes = meshesOf(house);
    for (const [lx, lz] of [[0, 1.9], [0, -0.9], [0, -2.3], [0, -3.3], [0.3, -3.3], [-2.05, -0.9], [2.0, -2.3]] as const) {
      expect([lx, lz, roofAbove(meshes, lx, lz)]).toEqual([lx, lz, true]);
    }
    // The opening itself is clear; a hand's breadth outside its frame the roof's slope is there.
    expect(roofAbove(meshes, 0, 0.5)).toBe(false);
    expect(roofAbove(meshes, 0.3, 0.3)).toBe(false);
    for (const [lx, lz] of [[0.75, 0.5], [-0.75, 0.5], [0, 1.05], [0, -0.05]] as const) {
      expect([lx, lz, roofAbove(meshes, lx, lz), house.sheltered(world(lx, lz).x, world(lx, lz).z)]).toEqual([lx, lz, true, true]);
    }
    // The garden's open middle has no roof.
    expect(roofAbove(meshes, 1.2, -4.0)).toBe(false);
  });
});

describe("the vista", () => {
  const axisClear = (house: House, extra?: THREE.Object3D): { clear: boolean; hit: string } => {
    for (let i = 0; i < 90; i++) house.update(1 / 30, [world(0, 4.6)], 0); // the door swings fully open
    if (extra) house.group.add(extra);
    const meshes = meshesOf(house);
    const eye = HOME_FLOOR_Y + 1.6;
    const o = world(0, 5.5);
    const end = world(0, -4.6);
    const dir = new THREE.Vector3(end.x - o.x, 0, end.z - o.z);
    const len = dir.length();
    dir.normalize();
    const hits = new THREE.Raycaster(new THREE.Vector3(o.x, eye, o.z), dir, 0, len).intersectObjects(meshes, false);
    // The first thing met must be the garden's south wall, at the end of the axis (z = -4.6 face).
    const first = hits[0];
    const clear = !first || first.distance > len - 0.35;
    return { clear, hit: first ? `${first.distance.toFixed(2)} of ${len.toFixed(2)}` : "none" };
  };

  test("at eye height down the open door's axis the view runs clear to the garden wall", () => {
    const house = buildHomeHouse(terrainHeight);
    const r = axisClear(house);
    expect([r.clear, r.hit]).toEqual([true, r.hit]);
  });

  test("a tall object on the axis blocks the view (the test can fail)", () => {
    const house = buildHomeHouse(terrainHeight);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.5, 0.3), new THREE.MeshBasicMaterial());
    const p = world(0, -1.6);
    post.position.set(p.x - house.group.position.x, HOME_FLOOR_Y + 1.25 - house.group.position.y, p.z - house.group.position.z);
    // The group is placed and turned: put the post in its own frame by way of the world point.
    house.group.updateMatrixWorld(true);
    post.position.copy(house.group.worldToLocal(new THREE.Vector3(p.x, HOME_FLOOR_Y + 1.25, p.z)));
    const r = axisClear(house, post);
    expect(r.clear).toBe(false);
  });

  test("every wall crossing the axis has its doorway on it", () => {
    for (const w of WALLS.filter((w) => w.axis === "x" && w.a <= 0 && w.b >= 0 && w.c > ROOMS.garden.z1)) {
      expect(w.open.some((o) => o.from < 0 && o.to > 0)).toBe(true);
    }
  });
});

describe("splash rings", () => {
  test("none land under a roof; the open court and the compluvium take them at the floor's height", () => {
    const house = buildHomeHouse(terrainHeight);
    for (const [lx, lz, , sheltered, what] of SAMPLES) {
      const p = world(lx, lz);
      const y = splashLanding(house, p.x, p.z, groundHeightAt);
      if (sheltered) expect([what, y]).toEqual([what, null]);
      else expect([what, y === null]).toEqual([what, false]);
    }
    const g = world(1.2, -4.0);
    expect(splashLanding(house, g.x, g.z, groundHeightAt)).toBeCloseTo(HOME_FLOOR_Y);
    const c = world(0, 0.5);
    expect(splashLanding(house, c.x, c.z, groundHeightAt)).toBeCloseTo(HOME_FLOOR_Y);
    expect(inRect(COMPLUVIUM, 0, 0.5)).toBe(true);
  });

  test("the scene parks sheltered rings below the ground, and says the garden is open too", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    expect(scene).toContain("splashLanding(homeHouse, nsx, nsz, groundHeightAt)");
    expect(scene).toContain("peristyle's garden court");
  });
});
