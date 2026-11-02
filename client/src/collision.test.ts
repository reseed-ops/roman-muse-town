import { describe, expect, test } from "bun:test";
import { circ, obb, resolveCollisions, slideMotion, stepEntersBox, type Obstacle } from "./collision";

const wall = obb(0, 0, 0.15, 4, 0); // a thin north-south wall at x = 0
const CLEARANCE = 0.5;

describe("resolveCollisions", () => {
  test("a wall stops a walker at his clearance", () => {
    expect(resolveCollisions([wall], -0.4, 0, CLEARANCE).x).toBeCloseTo(-0.65);
  });

  test("a diagonal push slides along the wall", () => {
    const r = resolveCollisions([wall], -0.4, 1, CLEARANCE);
    expect(r.z).toBeCloseTo(1);
  });

  test("a body beside a wall cannot shove a walker into it", () => {
    const r = resolveCollisions([wall], -0.7, 0, CLEARANCE, { x: -1.1, z: 0, r: 0.4, pad: 0.15 });
    expect(r.x).toBeLessThanOrEqual(-0.65 + 1e-9);
  });

  test("a body keeps a walker off when there is room", () => {
    const r = resolveCollisions([], 0.2, 0, CLEARANCE, { x: 0, z: 0, r: 0.4, pad: 0.15 });
    expect(r.x).toBeCloseTo(0.55);
  });

  test("the fence has the last word", () => {
    const r = resolveCollisions([], 3, 0, CLEARANCE, undefined, (x, z) => ({ x: Math.min(x, 2), z }));
    expect(r.x).toBe(2);
  });

  test("ghosts never block", () => {
    const ghost: Obstacle = { ...circ(0, 0, 1), ghost: true };
    expect(resolveCollisions([ghost], 0.1, 0, CLEARANCE).x).toBe(0.1);
  });
});

describe("stepEntersBox", () => {
  test("a step across a thin wall is caught, even one that ends beyond it", () => {
    expect(stepEntersBox([wall], -0.5, 0, 0.5, 0)).toBe(true);
  });

  test("a step ending inside a box is caught", () => {
    expect(stepEntersBox([wall], -0.5, 0, 0, 0)).toBe(true);
  });

  test("steps along or clear of a wall pass", () => {
    expect(stepEntersBox([wall], -0.5, 0, -0.5, 1)).toBe(false);
    expect(stepEntersBox([wall], -0.5, 5, 0.5, 5)).toBe(false);
  });

  test("a rotated box is respected", () => {
    const turned = obb(0, 0, 0.15, 4, Math.PI / 4);
    expect(stepEntersBox([turned], -1, 1, 1, -1)).toBe(true);
    expect(stepEntersBox([turned], -3, 3, -2.9, 2.9)).toBe(false);
  });

  test("a walker already inside can always step out", () => {
    expect(stepEntersBox([wall], 0, 0, 1, 0)).toBe(false);
  });
});

describe("slideMotion", () => {
  test("open ground leaves the step alone", () => {
    expect(slideMotion([circ(5, 5, 0.4)], 0, 0, 0.1, 0, CLEARANCE)).toEqual({ dx: 0.1, dz: 0 });
  });

  test("a wall keeps only the part of the step along it", () => {
    const m = slideMotion([wall], -0.66, 0, 0.1, 0.1, CLEARANCE);
    expect(m.dx).toBeCloseTo(0);
    expect(m.dz).toBeCloseTo(0.1);
  });

  test("a dead-on approach to a rock goes around it, at most of his speed", () => {
    const m = slideMotion([circ(0.65, 0, 0.4)], 0, 0, 0.1, 0, CLEARANCE);
    expect(Math.abs(m.dx)).toBeLessThan(0.01);
    expect(Math.hypot(m.dx, m.dz)).toBeCloseTo(0.075);
  });

  test("walking past a rock is untouched once he's heading away from it", () => {
    expect(slideMotion([circ(0, 0, 0.4)], 0.67, 0, 0.1, 0, CLEARANCE)).toEqual({ dx: 0.1, dz: 0 });
  });

  test("a ring of rocks is walked around without ever losing the way", () => {
    const rocks = [circ(3, 0.1, 0.4), circ(5, -0.1, 0.45), circ(7, 0.15, 0.35)];
    let x = 0;
    let z = 0;
    let kinks = 0;
    let last = { dx: 0.1, dz: 0 };
    for (let i = 0; i < 200 && x < 9; i++) {
      const m = slideMotion(rocks, x, z, 0.1, 0, CLEARANCE);
      const r = resolveCollisions(rocks, x + m.dx, z + m.dz, CLEARANCE);
      const step = { dx: r.x - x, dz: r.z - z };
      const turn = Math.abs(Math.atan2(last.dx * step.dz - last.dz * step.dx, last.dx * step.dx + last.dz * step.dz));
      if (turn > 1.2) kinks++;
      last = step;
      x = r.x;
      z = r.z;
    }
    expect(x).toBeGreaterThanOrEqual(9);
    expect(kinks).toBe(0);
  });

  test("ghosts don't bend anything", () => {
    const ghost = { ...circ(0.65, 0, 0.4), ghost: true };
    expect(slideMotion([ghost], 0, 0, 0.1, 0, CLEARANCE)).toEqual({ dx: 0.1, dz: 0 });
  });

  test("small props keep a slimmer clearance than buildings", () => {
    expect(resolveCollisions([circ(0, 0, 0.3)], 0.4, 0, CLEARANCE).x).toBeCloseTo(0.58);
    expect(resolveCollisions([circ(0, 0, 0.9)], 1, 0, CLEARANCE).x).toBeCloseTo(0.9 + CLEARANCE);
  });
});
