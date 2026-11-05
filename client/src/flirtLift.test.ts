import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { collectRig, poseFlirtLift } from "./characterAnimation";

// The composed flirt raise (Task 13): from a T-pose bind the right hand
// must come forward and up to chest height, for either body's angles,
// and ease in by slerp so a half amount sits between bind and the pose.
function rig() {
  const root = new THREE.Group();
  const mk = (name: string, at: [number, number, number], parent: THREE.Object3D) => {
    const o = new THREE.Object3D();
    o.name = name;
    o.position.set(...at);
    parent.add(o);
    return o;
  };
  const hips = mk("J_Bip_C_Hips", [0, 1, 0], root);
  const chest = mk("J_Bip_C_Chest", [0, 0.25, 0], hips);
  const sh = mk("J_Bip_R_Shoulder", [-0.03, 0.22, 0], chest);
  const up = mk("J_Bip_R_UpperArm", [-0.14, 0, 0], sh);
  const lo = mk("J_Bip_R_LowerArm", [-0.27, 0, 0], up);
  mk("J_Bip_R_Hand", [-0.24, 0, 0], lo);
  return { root, hips };
}
const handRel = (root: THREE.Object3D, hips: THREE.Object3D) => {
  root.updateMatrixWorld(true);
  const h = new THREE.Vector3();
  const p = new THREE.Vector3();
  hips.getWorldPosition(h);
  root.getObjectByName("J_Bip_R_Hand")!.getWorldPosition(p);
  return p.sub(h);
};

describe("poseFlirtLift", () => {
  for (const who of ["his", "hers"] as const) {
    test(`${who}: the right hand comes forward and up to chest height from the bind`, () => {
      const { root, hips } = rig();
      const r = collectRig(root);
      const bind = handRel(root, hips);
      expect(bind.x).toBeLessThan(-0.6); // T-pose: straight out to the right
      poseFlirtLift(r, 1, who);
      const lifted = handRel(root, hips);
      expect(lifted.z).toBeGreaterThan(0.15); // forward
      expect(lifted.y).toBeGreaterThan(0.3); // chest height above the hips
      expect(lifted.y).toBeLessThan(0.7);
      expect(Math.abs(lifted.x)).toBeLessThan(0.3); // near the body's centre line
    });
  }
  test("a half amount sits between the bind and the pose", () => {
    const { root, hips } = rig();
    const r = collectRig(root);
    poseFlirtLift(r, 0.5, "his");
    const half = handRel(root, hips);
    const { root: r2, hips: h2 } = rig();
    poseFlirtLift(collectRig(r2), 1, "his");
    const full = handRel(r2, h2);
    expect(half.z).toBeGreaterThan(0.02);
    expect(half.z).toBeLessThan(full.z);
  });
});
