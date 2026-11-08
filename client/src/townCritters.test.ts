import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import {
  CRICKET_STARTLE,
  CRITTER_BUDGET,
  beesOut,
  chirpLevel,
  createCritters,
  cricketsOut,
  critterBudget,
  hopHeight,
  hopTarget,
  humLevel,
  type CritterFrame,
} from "./townCritters";

const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const flat = () => 0;
const sites = {
  beePatches: [[[0, 0], [1, 0], [0, 1]] as const, [[10, 10], [11, 10]] as const],
  butterflyPatches: [{ centre: [0, 0] as const, radius: 5, flowers: [[1, 1]] as const }],
  cricketGrass: [[3, 3], [4, 3], [3, 4]] as const,
};
const day: Omit<CritterFrame, "t" | "dt"> = {
  tier: 2, nightMix: 0, rain: 0, snow: 0, fog: false, season: "summer", player: null, view: [0, 0],
};
const run = (c: ReturnType<typeof createCritters>, frame: Omit<CritterFrame, "t" | "dt">, seconds: number, from = 0) => {
  let out = { hum: 0, chirp: 0 };
  for (let t = from; t < from + seconds; t += 1 / 30) out = c.update({ ...frame, t, dt: 1 / 30 });
  return out;
};

describe("Task 46: bees, butterflies and crickets", () => {
  test("a phone draws fewer of each than a full-tier town", () => {
    expect(critterBudget(1).bees).toBeLessThan(critterBudget(2).bees);
    expect(critterBudget(0).crickets).toBeLessThan(critterBudget(1).crickets);
    expect(critterBudget(5)).toEqual(CRITTER_BUDGET[2]);
    const c = createCritters(new THREE.Group(), { ...sites, beePatches: [[[0, 0], [1, 0]], [[2, 0], [3, 0]], [[4, 0], [5, 0]]] }, flat, seeded());
    run(c, { ...day, tier: 1 }, 1);
    expect(c.drawn.bees).toBe(CRITTER_BUDGET[1].bees);
    run(c, { ...day, tier: 2 }, 1, 1);
    expect(c.drawn.bees).toBe(CRITTER_BUDGET[2].bees);
  });

  test("bees and butterflies by day, crickets at night, none in winter", () => {
    const c = createCritters(new THREE.Group(), sites, flat, seeded());
    run(c, day, 1);
    expect(c.drawn.bees).toBeGreaterThan(0);
    expect(c.drawn.butterflies).toBeGreaterThan(0);
    expect(c.drawn.crickets).toBe(0);
    run(c, { ...day, nightMix: 0.9 }, 1, 1);
    expect(c.drawn.bees).toBe(0);
    expect(c.drawn.butterflies).toBe(0);
    expect(c.drawn.crickets).toBe(3);
    expect(beesOut({ ...day, season: "winter" })).toBe(false);
    expect(cricketsOut({ ...day, nightMix: 0.9, season: "winter" })).toBe(false);
    expect(beesOut({ ...day, rain: 0.6 })).toBe(false);
  });

  test("nothing is animated or drawn far from the camera", () => {
    const c = createCritters(new THREE.Group(), sites, flat, seeded());
    run(c, { ...day, view: [200, 200] }, 1);
    expect(c.drawn).toEqual({ bees: 0, butterflies: 0, crickets: 0 });
  });

  test("a cricket hops clear when he walks close, then settles near home", () => {
    const c = createCritters(new THREE.Group(), sites, flat, seeded());
    const night = { ...day, nightMix: 0.9 };
    run(c, { ...night, player: [3.5, 3] }, 2);
    const [x, z] = c.cricketsAt()[0]!;
    expect(Math.hypot(x - 3.5, z - 3)).toBeGreaterThan(0.5);
    expect(Math.hypot(x - 3, z - 3)).toBeLessThanOrEqual(2.5 + 1e-9);
    const settled = c.cricketsAt();
    run(c, night, 1, 2);
    expect(c.cricketsAt()).toEqual(settled);
  });

  test("hopTarget moves away from him and stays on its leash", () => {
    const r = seeded(3);
    for (let i = 0; i < 50; i++) {
      const to = hopTarget([0, 0], [0, 0], [1, 0], r);
      expect(to[0]).toBeLessThan(0);
      expect(Math.hypot(to[0], to[1])).toBeLessThanOrEqual(1.1 + 1e-9);
      const far = hopTarget([2.4, 0], [0, 0], [1.5, 0], r);
      expect(Math.hypot(far[0], far[1])).toBeLessThanOrEqual(2.5 + 1e-9);
    }
    expect(hopHeight(0)).toBe(0);
    expect(hopHeight(1)).toBe(0);
    expect(hopHeight(0.5)).toBeCloseTo(0.22);
    expect(CRICKET_STARTLE).toBeGreaterThan(1);
  });

  test("the hum is only close; the chirp carries and waits for dusk", () => {
    expect(humLevel(0.3)).toBe(1);
    expect(humLevel(3.5)).toBe(0);
    expect(chirpLevel(2, 0)).toBe(0);
    expect(chirpLevel(2, 0.9)).toBe(1);
    expect(chirpLevel(20, 0.9)).toBe(0);
    const c = createCritters(new THREE.Group(), sites, flat, seeded());
    expect(run(c, { ...day, player: [0.3, 0.3] }, 2).hum).toBeGreaterThan(0);
    expect(run(c, { ...day, player: [30, 30] }, 1, 2).hum).toBe(0);
  });

  test("everything is a few instanced meshes without shadows, removed on dispose", () => {
    const world = new THREE.Group();
    const c = createCritters(world, sites, flat, seeded());
    expect(world.children.length).toBe(6);
    for (const m of world.children) {
      expect(m).toBeInstanceOf(THREE.InstancedMesh);
      expect(m.castShadow).toBe(false);
    }
    c.dispose();
    expect(world.children.length).toBe(0);
  });
});
