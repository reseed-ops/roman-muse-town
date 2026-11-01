import { describe, expect, test } from "bun:test";
import { circ, obb, resolveCollisions, stepEntersBox, type Obstacle } from "./collision";

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
