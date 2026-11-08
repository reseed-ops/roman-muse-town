import { expect, test } from "bun:test";
import * as THREE from "three";
import { buildHomeHouse } from "./homeHouse";
import { groundHeightAt, HOME, HOME_FLOOR_Y, HOME_STEPS, homeToWorld, terrainHeight } from "./town";
import { resolveCollisions } from "./collision";

// Their house (Task 35): the floor, the door, the walls and the bed, pinned.

test("the floor stands over the ground everywhere under it, and the walker stands on it inside", () => {
  for (const [lx, lz] of [[0, 0], [-2.5, -2.9], [2.5, 2.9], [2.5, -2.9]]) {
    const p = homeToWorld(lx!, lz!);
    expect(HOME_FLOOR_Y).toBeGreaterThan(terrainHeight(p.x, p.z));
    expect(groundHeightAt(p.x, p.z)).toBeCloseTo(HOME_FLOOR_Y);
  }
  // The house stands inside the town's rim.
  const far = homeToWorld(-HOME.halfW, -HOME.halfD);
  expect(Math.hypot(far.x, far.z)).toBeLessThan(52);
});

test("the door lets a walker in, the walls do not, and the bed is a seat inside", () => {
  const house = buildHomeHouse(terrainHeight);
  const doorway = homeToWorld(0, HOME.halfD + HOME.wall / 2);
  const kept = resolveCollisions(house.colliders, doorway.x, doorway.z, 0.3);
  expect(Math.hypot(kept.x - doorway.x, kept.z - doorway.z)).toBeLessThan(0.05);
  const wall = homeToWorld(HOME.halfW + HOME.wall / 2, 0);
  const pushed = resolveCollisions(house.colliders, wall.x, wall.z, 0.3);
  expect(Math.hypot(pushed.x - wall.x, pushed.z - wall.z)).toBeGreaterThan(0.2);
  expect(house.inside(homeToWorld(0, 0).x, homeToWorld(0, 0).z)).toBe(true);
  expect(house.inside(doorway.x + 5, doorway.z)).toBe(false);
  expect(house.inside(house.bedSeat.x, house.bedSeat.z)).toBe(true);
  expect(house.bedSeat.y).toBeGreaterThan(HOME_FLOOR_Y + 0.4);
});

test("the steps a walker stands on are the steps the scene draws, and they climb from the lawn to the floor", () => {
  const house = buildHomeHouse(terrainHeight);
  let below = -Infinity;
  for (const step of [...HOME_STEPS].reverse()) {
    const p = homeToWorld(0, step.lz);
    // The walker stands on the step's top.
    expect(groundHeightAt(p.x, p.z)).toBeCloseTo(Math.max(step.top, terrainHeight(p.x, p.z)), 5);
    // Each step is above the ground at it and below the floor, rising toward the door.
    expect(step.top).toBeGreaterThan(terrainHeight(p.x, p.z));
    expect(step.top).toBeLessThan(HOME_FLOOR_Y);
    expect(step.top).toBeGreaterThan(below);
    below = step.top;
  }
  // The drawn step blocks' tops match (house-local y + the floor height).
  const tops = house.group.children
    .filter((o) => o instanceof THREE.Mesh && (o.geometry as THREE.BoxGeometry).parameters?.depth === 0.64)
    .map((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.BoxGeometry;
      return +(o.position.y + g.parameters.height / 2 + HOME_FLOOR_Y).toFixed(4);
    })
    .sort();
  expect(tops).toEqual(HOME_STEPS.map((s) => +s.top.toFixed(4)).sort());
});
