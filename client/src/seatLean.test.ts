import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { collectRig } from "./characterAnimation";
import { applyHeadRest, easeLean, LEAN, leanAngles, sideOfHim } from "./seatLean";
import { CLIFF } from "./seaCliff";

// A toy VRM: inner > hips > spine > neck > head > crown, her proportions.
function toy() {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const root = new THREE.Group();
  inner.add(root);
  let parent: THREE.Object3D = root;
  const mk = (name: string, y: number) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.y = y;
    parent.add(o);
    parent = o;
    return o;
  };
  mk("J_Bip_C_Hips", 0.5);
  mk("J_Bip_C_Spine", 0.2);
  mk("J_Bip_C_Chest", 0.12);
  mk("J_Bip_C_Neck", 0.18);
  const head = mk("J_Bip_Head", 0.08);
  const crown = new THREE.Object3D();
  crown.position.y = 0.16;
  head.add(crown);
  return { group, inner, root, crown, rig: collectRig(root) };
}

/** The bench's slot point in world space, as townScene's benchSlotPos computes it. */
const slotPos = (slot: number) => {
  const lx = slot * 0.42;
  const { x, z, rotY } = CLIFF.bench;
  return { x: x + lx * Math.cos(rotY) + -0.015 * Math.sin(rotY), z: z - lx * Math.sin(rotY) - 0.015 * Math.cos(rotY) };
};

describe("head on his shoulder (Task 98, closer in Task 106)", () => {
  for (const gaiusSlot of [-1, 1]) {
    test(`seated together, he in slot ${gaiusSlot}: her head moves toward him and stays on the bench`, () => {
      const t = toy();
      const her = slotPos(-gaiusSlot);
      const him = slotPos(gaiusSlot);
      t.group.position.set(her.x, 0, her.z);
      t.group.rotation.y = CLIFF.bench.rotY + Math.PI;
      t.group.updateMatrixWorld(true);
      const before = t.crown.getWorldPosition(new THREE.Vector3());
      applyHeadRest(t.rig, t.inner, sideOfHim(gaiusSlot), 1);
      t.group.updateMatrixWorld(true);
      const after = t.crown.getWorldPosition(new THREE.Vector3());
      // Closer to him along the bench, by a readable amount, never past his centre line.
      const gapBefore = Math.abs(before.x - him.x);
      const gapAfter = Math.abs(after.x - him.x);
      expect(gapBefore - gapAfter).toBeGreaterThan(0.2);
      expect(gapBefore - gapAfter).toBeLessThan(0.75);
      // Task 106: the head ends close to his centre line, over his shoulder (centres were 0.84 apart).
      expect(gapBefore).toBeGreaterThan(0.8);
      expect(gapAfter).toBeLessThan(0.45);
      expect(gapAfter).toBeGreaterThan(0.1);
      // The head settles down onto his shoulder (0.13 m with the Task 106 roll, was under 0.08) but stays up; it does not move toward or away from the sea.
      expect(before.y - after.y).toBeLessThan(0.18);
      expect(Math.abs(after.z - before.z)).toBeLessThan(0.05);
      // Still within the bench's 1.9 m seat.
      expect(Math.abs(after.x - CLIFF.bench.x)).toBeLessThan(0.95);
    });
  }

  test("at rest (k = 0) nothing is changed", () => {
    const t = toy();
    t.group.updateMatrixWorld(true);
    const before = t.crown.getWorldPosition(new THREE.Vector3());
    applyHeadRest(t.rig, t.inner, 1, 0);
    t.group.updateMatrixWorld(true);
    expect(t.crown.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-9);
    expect(t.inner.position.x).toBe(0);
  });

  test("the lean is gentle: bounded angles, eased in and back out", () => {
    const a = leanAngles(1, 1);
    expect(a.chestRoll + a.neckRoll + a.headRoll).toBeLessThan(1.3);
    expect(a.headNod).toBeLessThan(0.15);
    expect(a.chestRoll + a.neckRoll + a.headRoll).toBeGreaterThan(1.0); // enough roll to lie on the shoulder (Task 106)
    let k = 0;
    for (let i = 0; i < 40; i++) k = easeLean(k, 1, 1 / 30);
    expect(k).toBe(1);
    expect(easeLean(0, 1, 1 / 60)).toBeLessThan(0.1);
    for (let i = 0; i < 60; i++) k = easeLean(k, 0, 1 / 30);
    expect(k).toBe(0);
    // Task 106: the bound moved from 0.36 to 0.5. The seats are 0.84 m apart; a slide of 0.44 closes
    // them to 0.40 m between centres, where shoulders meet. Past 0.5 she would sit inside him.
    expect(LEAN.shift).toBeGreaterThan(0.4);
    expect(LEAN.shift).toBeLessThan(0.5);
    expect(0.84 - LEAN.shift).toBeGreaterThan(0.34);
  });

  for (const slot of [-1, 1]) {
    test(`eases out when either stands (he in slot ${slot}): k falls to 0 and her slide returns to 0`, () => {
      const t = toy();
      let k = 1;
      applyHeadRest(t.rig, t.inner, sideOfHim(slot), k);
      expect(Math.abs(t.inner.position.x)).toBeCloseTo(LEAN.shift, 6);
      for (let i = 0; i < 60; i++) {
        k = easeLean(k, 0, 1 / 30); // `together` is false the frame either of them stands
        applyHeadRest(t.rig, t.inner, sideOfHim(slot), k);
      }
      expect(k).toBe(0);
      expect(t.inner.position.x).toBe(0);
    });
  }

  test("the lean fires only on the cliff bench, so the boat and bath seats are untouched", () => {
    const src = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    expect(src).toContain("seatPlayer.bench.id === CLIFF.bench.id && seatMuse.bench.id === CLIFF.bench.id");
  });
});
