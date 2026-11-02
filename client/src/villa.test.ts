import { expect, test } from "bun:test";
import { AVENUE_CYPRESSES, MARKET_BOOTHS, VILLA, VILLA_WALLS, resumeSpot, routeBetween, stairHeight } from "./layout";
import { PLACES, PLAYER, STREETS, terrainHeight } from "./town";

const place = (id: string) => PLACES.find((p) => p.id === id)!;

test("the gate, the road, the tree and the hall stand on one line", () => {
  expect(VILLA.gate[0]).toBe(0);
  expect(place("mainchat").position[0]).toBe(0);
  expect(PLAYER.spawn[0]).toBe(0);
  for (const axis of [STREETS[0]!, STREETS[1]!]) for (const [x] of axis) expect(x).toBe(0);
});

test("the wings mirror each other across the axis", () => {
  for (const [west, east] of [["sounds", "recipes"], ["stories", "stars"], ["garden", "sidechat"]] as const) {
    const a = place(west), b = place(east);
    expect(a.position[1]).toBe(b.position[1]);
    expect(a.facing).toBe(-b.facing);
    expect(Math.abs(a.position[0] + b.position[0])).toBeLessThan(1e-9);
  }
});

test("every house door looks at the axis", () => {
  for (const p of PLACES) {
    const [x, z] = p.position;
    const out = Math.sin(p.facing) * x + Math.cos(p.facing) * (x === 0 ? z : 0);
    expect(out).toBeLessThan(0);
  }
});

test("the avenue's cypresses come in exact pairs", () => {
  for (const [x, z] of AVENUE_CYPRESSES) expect(AVENUE_CYPRESSES.some(([a, b]) => a === -x && b === z)).toBe(true);
  for (const [x] of MARKET_BOOTHS) expect(Math.abs(x)).toBe(8.5);
});

test("the stair climbs to the terrace at a walkable slope", () => {
  const { top, foot } = VILLA.stair;
  expect(stairHeight(foot)).toBeCloseTo(VILLA.lawnY);
  expect(stairHeight(top)).toBeCloseTo(VILLA.terraceY);
  for (let z = top; z < foot; z += 0.25) {
    expect(Math.abs(terrainHeight(0, z + 0.25) - terrainHeight(0, z)) / 0.25).toBeLessThan(0.3);
  }
});

test("the walks off the terrace stay climbable", () => {
  const west: [number, number][] = [[-8.35, -25], [-8.35, -26], [-8.35, -27], [-8.35, -28], [-8.35, -29], [-8.35, -30], [-8.9, -30.6], [-9.9, -31.05]];
  for (let i = 1; i < west.length; i++) {
    const [ax, az] = west[i - 1]!, [bx, bz] = west[i]!;
    expect(Math.abs(terrainHeight(ax, az) - terrainHeight(bx, bz)) / Math.hypot(ax - bx, az - bz)).toBeLessThan(0.75);
  }
  for (let x = 7.5; x < 15; x += 0.5) {
    expect(Math.abs(terrainHeight(x + 0.5, -25) - terrainHeight(x, -25)) / 0.5).toBeLessThan(0.5);
  }
});

test("terrace walls leave gaps for the stair and both walks", () => {
  const blocks = (x: number, z: number) => VILLA_WALLS.some(([cx, cz, hx, hz]) => Math.abs(x - cx) <= hx && Math.abs(z - cz) <= hz);
  expect(blocks(0, -24)).toBe(false);
  expect(blocks(-7.5, VILLA.terraceWalkZ)).toBe(false);
  expect(blocks(7.5, VILLA.terraceWalkZ)).toBe(false);
});

test("the routes run the long way round a wall, and skip a short hop", () => {
  expect(routeBetween([1, 1], [2, 2])).toEqual([]);
  const toLake = routeBetween([6.2, 35.2], [-9.7, -29.9]);
  expect(toLake.at(-1)).toEqual([-9.7, -29.9]);
  expect(toLake.length).toBeGreaterThan(4);
});

test("a saved spot that has become a wall falls back to the gate", () => {
  const settle = (x: number, z: number) => (x > 5 ? { x: 5, z } : { x, z });
  const inTown = (x: number, z: number) => Math.hypot(x, z) <= 52;
  expect(resumeSpot(1, 2, PLAYER.spawn, settle, inTown)).toEqual({ x: 1, z: 2, moved: false });
  expect(resumeSpot(9, 2, PLAYER.spawn, settle, inTown)).toEqual({ x: 0, z: 43, moved: true });
  expect(resumeSpot(-70, 0, PLAYER.spawn, settle, inTown)).toEqual({ x: 0, z: 43, moved: true });
});
