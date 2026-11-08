import { describe, expect, test } from "bun:test";
import { CLIFF, onLand } from "./seaCliff";
import { HOME } from "./town";
import { FIREFLY_PLACES_BUDGET, FIREFLY_PLACES_MAX, HOUSE_LAWN, cliffHaunt, fireflyPlaceAt, fireflyPlacesBudget } from "./fireflyPlaces";

const flat = () => 0;
const at = (place: "house" | "cliff", seed: number, t: number) => {
  const out = new Float32Array(3);
  fireflyPlaceAt(place, seed, t, flat, out, 0);
  return { x: out[0]!, y: out[1]!, z: out[2]! };
};
const seeds = Array.from({ length: 200 }, (_, i) => (i + 0.5) / 200);
const times = [0, 7.3, 61, 333, 2400];

describe("fireflies by the house and the cliff (Task 49)", () => {
  test("counts follow the tier, phone lightest, and fit the buffer", () => {
    expect(fireflyPlacesBudget(0)).toEqual(FIREFLY_PLACES_BUDGET[0]);
    expect(fireflyPlacesBudget(1)).toEqual(FIREFLY_PLACES_BUDGET[1]);
    expect(fireflyPlacesBudget(5)).toEqual(FIREFLY_PLACES_BUDGET[2]);
    const sum = (b: { house: number; cliff: number }) => b.house + b.cliff;
    expect(sum(FIREFLY_PLACES_BUDGET[0])).toBeLessThan(sum(FIREFLY_PLACES_BUDGET[1]));
    expect(sum(FIREFLY_PLACES_BUDGET[1])).toBeLessThan(sum(FIREFLY_PLACES_BUDGET[2]));
    expect(sum(FIREFLY_PLACES_BUDGET[2])).toBe(FIREFLY_PLACES_MAX);
  });

  test("house fireflies keep to the lawn outside the door, never inside the walls", () => {
    const doorWallX = HOME.position[0] + HOME.halfD + HOME.wall;
    for (const s of seeds)
      for (const t of times) {
        const p = at("house", s, t);
        expect(p.x).toBeGreaterThan(doorWallX);
        expect(Math.hypot(p.x - HOUSE_LAWN.x, p.z - HOUSE_LAWN.z)).toBeLessThan(HOUSE_LAWN.rz + 1.2);
        expect(p.y).toBeGreaterThan(0.1);
        expect(p.y).toBeLessThan(2.2);
      }
  });

  test("cliff fireflies: path and headland over the land, the rest over the sea", () => {
    let haunts = new Set<string>();
    for (const s of seeds)
      for (const t of times) {
        const p = at("cliff", s, t);
        const h = cliffHaunt(s);
        haunts.add(h);
        if (h === "sea") {
          expect(onLand(p.x, p.z)).toBe(false);
          expect(p.z).toBeGreaterThan(CLIFF.coastZ);
          expect(p.y).toBeGreaterThan(CLIFF.seaY);
          expect(p.y).toBeLessThan(CLIFF.seaY + 5);
        } else {
          expect(onLand(p.x, p.z)).toBe(true);
          expect(p.y).toBeGreaterThan(0.1);
          expect(p.y).toBeLessThan(2.2);
        }
      }
    expect([...haunts].sort()).toEqual(["head", "path", "sea"]);
  });

  test("they drift smoothly, never jumping between frames", () => {
    for (const place of ["house", "cliff"] as const)
      for (const s of seeds)
        for (let t = 0; t < 400; t += 3.7) {
          const a = at(place, s, t);
          const b = at(place, s, t + 1 / 30);
          expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(0.2);
        }
  });
});
