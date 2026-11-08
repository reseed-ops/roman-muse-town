import { expect, test } from "bun:test";
import { buildHomeHouse } from "./homeHouse";
import { groundHeightAt, HOME, HOME_FLOOR_Y, homeToWorld, terrainHeight } from "./town";
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
