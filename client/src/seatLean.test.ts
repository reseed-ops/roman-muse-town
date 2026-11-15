import { describe, expect, test } from "bun:test";
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

describe("head on his shoulder (Task 98)", () => {
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
      expect(gapAfter).toBeGreaterThan(0.1);
      // The head dips a little but stays up; it does not move toward or away from the sea.
      expect(before.y - after.y).toBeLessThan(0.08);
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
    expect(a.chestRoll + a.neckRoll + a.headRoll).toBeLessThan(0.85);
    expect(a.headNod).toBeLessThan(0.15);
    let k = 0;
    for (let i = 0; i < 40; i++) k = easeLean(k, 1, 1 / 30);
    expect(k).toBe(1);
    expect(easeLean(0, 1, 1 / 60)).toBeLessThan(0.1);
    for (let i = 0; i < 60; i++) k = easeLean(k, 0, 1 / 30);
    expect(k).toBe(0);
    expect(LEAN.shift).toBeLessThan(0.36);
  });
});
