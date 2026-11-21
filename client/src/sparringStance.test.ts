import { expect, test } from "bun:test";
import * as THREE from "three";
import { collectRig, poseBone } from "./characterAnimation";
import { applyStance, gaiusStance } from "./sparringStance";

function rig() {
  const root = new THREE.Group();
  const names = ["J_Bip_L_UpperArm", "J_Bip_R_UpperArm", "J_Bip_L_LowerArm", "J_Bip_R_LowerArm", "J_Bip_R_Hand"];
  for (const name of names) { const b = new THREE.Bone(); b.name = name; root.add(b); }
  return collectRig(root);
}

test("Task 131: stance amount 0 leaves his idle arms and 1 puts the pose on them", () => {
  const r = rig();
  const stance = gaiusStance("guard", 0);
  poseBone(r, r.rUpperArm, 0, 0, 1.22);
  const idle = r.rUpperArm!.quaternion.clone();
  applyStance(r, stance, 0);
  expect(r.rUpperArm!.quaternion.angleTo(idle)).toBeLessThan(1e-6);
  applyStance(r, stance, 1);
  const guard = new THREE.Quaternion().setFromEuler(new THREE.Euler(...stance.rUpper));
  expect(r.rUpperArm!.quaternion.angleTo(guard)).toBeLessThan(1e-6);
  poseBone(r, r.rUpperArm, 0, 0, 1.22);
  applyStance(r, stance, 0.5); // halfway between his arm and the guard
  expect(r.rUpperArm!.quaternion.angleTo(idle)).toBeCloseTo(idle.angleTo(guard) / 2, 5);
});

test("Task 131: the sword arm is left alone while the victory wave owns it", () => {
  const r = rig();
  poseBone(r, r.rUpperArm, 0.5, 0, 0.5);
  const before = r.rUpperArm!.quaternion.clone();
  applyStance(r, gaiusStance("guard", 0), 1, false);
  expect(r.rUpperArm!.quaternion.angleTo(before)).toBeLessThan(1e-6);
  expect(r.lUpperArm!.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.1);
});

test("Task 131: the strike winds up, cuts and returns to the guard; a parry and a hit leave and return", () => {
  const at = (p: number) => gaiusStance("strike", p).rUpper;
  expect(at(0)).toEqual(gaiusStance("guard", 0).rUpper);
  expect(at(0.35)[2]).toBeLessThan(-1); // the arm is up and back
  expect(at(0.6)[1]).toBeGreaterThan(1); // the cut is forward
  expect(at(1)[0]).toBeCloseTo(gaiusStance("guard", 0).rUpper[0], 6);
  for (const move of ["parry", "hit"] as const) {
    expect(gaiusStance(move, 0).rUpper).toEqual(gaiusStance("guard", 0).rUpper);
    expect(gaiusStance(move, 1).rUpper[2]).toBeCloseTo(gaiusStance("guard", 0).rUpper[2], 6);
    expect(gaiusStance(move, 0.5).rUpper).not.toEqual(gaiusStance("guard", 0).rUpper);
  }
});
