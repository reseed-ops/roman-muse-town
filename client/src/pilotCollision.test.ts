import { expect, test } from "bun:test";
import { movementFootprints } from "./buildingFootprints";
import { circ, obb, obbWorld, resolveCollisions, whileVisible, type Obstacle } from "./collision";
import { WEST_STAIR } from "./colosseumSetting";
import { incendiaryFootprints, INCENDIARY_SPOT } from "./incendiary";
import { vineyardFootprints } from "./vineyard";
import { PLACES, groundHeightAt, terrainHeight } from "./town";

function blocked(shapes: Obstacle[], x: number, z: number, clearance = 0.5) {
  const next = resolveCollisions(shapes, x, z, clearance);
  return Math.hypot(next.x - x, next.z - z) > 0.00001;
}

const buildings = movementFootprints(PLACES);

test("Embassy walls, pillars and closed door leave both approaches clear", () => {
  for (const x of [15.08, 10.43]) expect(blocked(buildings, x, 43)).toBe(false);
  for (const [x, z] of [[14.1, 43], [12.8, 45.4], [10.95, 41.15], [11.08, 43]] as const)
    expect(blocked(buildings, x, z)).toBe(true);
});

test("vineyard stakes leave room between neighbouring feet", () => {
  const shapes = vineyardFootprints();
  expect(shapes).toHaveLength(60);
  expect(blocked(shapes, 11.5, 31.1)).toBe(true);
  expect(blocked(shapes, 11.5, 31.8)).toBe(false);
});

test("pavilion centre and inter-column opening are clear", () => {
  expect(blocked(buildings, 17.8, -12)).toBe(false);
  expect(blocked(buildings, 17.8 + 2.46, -12)).toBe(true);
  expect(blocked(buildings, 17.8 + 2.46*Math.cos(Math.PI/8), -12 + 2.46*Math.sin(Math.PI/8))).toBe(false);
});

test("ballista runners block the machine centre, at its bolder scale", () => {
  const shapes = incendiaryFootprints();
  expect(blocked(shapes, INCENDIARY_SPOT.x, INCENDIARY_SPOT.z)).toBe(true);
  expect(blocked(shapes, INCENDIARY_SPOT.x, INCENDIARY_SPOT.z + 1.485 + 0.4)).toBe(true);
});

test("removing the fountain upgrade restores passage immediately", () => {
  const fountain = { visible: false };
  const shapes = [whileVisible(fountain, circ(0, 15.5, 1.85, 0.12))];
  for (const visible of [true, true, false, true, false]) {
    fountain.visible = visible;
    expect(blocked(shapes, 0, 15.5)).toBe(visible);
  }
});

test("west stair treads rise from the avenue to the closed ring", () => {
  const stair = obb(WEST_STAIR.x, WEST_STAIR.z, 2, 1.7, WEST_STAIR.rotY);
  const base = terrainHeight(stair.x, stair.z);
  let previous = base;
  for (let i = 0; i < 13; i++) {
    const { x, z } = obbWorld(stair, 0, 1.48 - i * 0.186);
    const height = groundHeightAt(x, z);
    expect(height).toBeGreaterThan(previous);
    previous = height;
  }
});
