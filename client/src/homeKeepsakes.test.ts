import { expect, test } from "bun:test";
import * as THREE from "three";
import { earnedKeepsakes, type KeepsakeState } from "./homeKeepsakes";
import { buildHomeHouse, buildKeepsake } from "./homeHouse";
import { HOME_KEEPSAKES } from "../../shared/homeDecor";
import { terrainHeight } from "./town";

const fresh: KeepsakeState = {
  fish: [], letters: [], postcards: [], inscriptions_complete: false, summit: { done: false },
  phoenix: { feathers: 0 }, secret: { first_kiss: null }, garden: { harvests: 0 }, tree: { waterings: 0 },
};

test("a fresh town has earned nothing; each keepsake comes from its own deed", () => {
  expect(earnedKeepsakes(fresh).size).toBe(0);
  const all = earnedKeepsakes({
    fish: [{ fish_id: "golden-carp" }], letters: [{}], postcards: [{}], inscriptions_complete: true, summit: { done: true },
    phoenix: { feathers: 1 }, secret: { first_kiss: "2026-11-01" }, garden: { harvests: 1 }, tree: { waterings: 7 }, dating: { firsts: { night: "2026-11-08" } },
  });
  expect([...all].sort()).toEqual(HOME_KEEPSAKES.map((k) => k.id).sort());
  expect(earnedKeepsakes({ ...fresh, fish: [{ fish_id: "carp" }] })).toEqual(new Set(["fish-plaque"]));
});

test("every keepsake builds, and the house shows only what is placed", () => {
  for (const k of HOME_KEEPSAKES) expect(buildKeepsake(k.id).children.length).toBeGreaterThan(0);
  const house = buildHomeHouse(terrainHeight);
  const count = () => {
    let n = 0;
    house.group.traverse(() => n++);
    return n;
  };
  const bare = count();
  house.setDecor({ "wall-back": "star-chart", floor: "tree-cutting" });
  const decorated = count();
  expect(decorated).toBeGreaterThan(bare);
  house.setDecor({});
  expect(count()).toBe(bare);
  void THREE;
});

test("the lamp is lit when someone comes home, and only then reports it", () => {
  const house = buildHomeHouse(terrainHeight);
  const inside = house.waitSpot;
  expect(house.update(0.1, [{ x: 0, z: 0 }], 1)).toBe(false);
  expect(house.update(0.1, [{ x: inside.x, z: inside.z }], 1)).toBe(true);
  expect(house.update(0.1, [{ x: inside.x, z: inside.z }], 1)).toBe(false);
  for (let i = 0; i < 30; i++) house.update(0.1, [{ x: inside.x, z: inside.z }], 1);
  expect(house.lamp.intensity).toBeGreaterThan(3);
  for (let i = 0; i < 80; i++) house.update(0.1, [{ x: 0, z: 0 }], 1);
  expect(house.lamp.intensity).toBeLessThan(1);
});
