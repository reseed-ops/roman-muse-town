import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { bakeRetargetedClip, OUTDOOR_RIG } from "./characterAnimation";

// The bake carries each bone's rotation away from its own bind. The
// Outdoor library's rig binds in an A-pose (upper arms 49° below
// level, elbows bent, forearms forward) while the VRMs bind in a
// T-pose, so a delta that points the source's arm forward pointed
// the VRM's arm somewhere else (measured Nov 5, 2026: a hug's arms
// spread wide). These two toy rigs stand exactly that way; a source
// clip that reaches forward must reach forward on the target too.
type Spec = { name: string; at: [number, number, number]; children?: Spec[] };
function build(spec: Spec, parent: THREE.Object3D): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = spec.name;
  o.position.set(...spec.at);
  parent.add(o);
  for (const c of spec.children ?? []) build(c, o);
  return o;
}
const A_UP = new THREE.Vector3(0.66, -0.75, 0).normalize(); // source upper arm at bind
const A_FORE = new THREE.Vector3(0.72, -0.58, 0.38).normalize(); // elbow bent, forearm forward
function sourceRig(): THREE.Group {
  const root = new THREE.Group();
  const up = A_UP.clone().multiplyScalar(28);
  const fore = A_FORE.clone().multiplyScalar(25);
  build(
    {
      name: "Hips", at: [0, 98, 0], children: [
        { name: "Left_UpperLeg", at: [9, -4, 0] },
        { name: "Right_UpperLeg", at: [-9, -4, 0] },
        { name: "Spine", at: [0, 10, 0], children: [{ name: "Chest", at: [0, 15, 0], children: [
          { name: "Left_Shoulder", at: [3, 22, 0], children: [{ name: "Left_UpperArm", at: [14, 0, 0], children: [
            { name: "Left_LowerArm", at: [up.x, up.y, up.z], children: [{ name: "Left_Hand", at: [fore.x, fore.y, fore.z] }] }] }] },
          { name: "Right_Shoulder", at: [-3, 22, 0], children: [{ name: "Right_UpperArm", at: [-14, 0, 0], children: [
            { name: "Right_LowerArm", at: [-up.x, up.y, up.z], children: [{ name: "Right_Hand", at: [-fore.x, fore.y, fore.z] }] }] }] },
        ] }] },
      ],
    },
    root,
  );
  return root;
}
function targetRig(): THREE.Group {
  const root = new THREE.Group();
  build(
    {
      name: "J_Bip_C_Hips", at: [0, 1.0, 0], children: [
        { name: "J_Bip_L_UpperLeg", at: [0.08, -0.04, 0] },
        { name: "J_Bip_R_UpperLeg", at: [-0.08, -0.04, 0] },
        { name: "J_Bip_C_Spine", at: [0, 0.1, 0], children: [{ name: "J_Bip_C_Chest", at: [0, 0.15, 0], children: [
          { name: "J_Bip_L_Shoulder", at: [0.03, 0.22, 0], children: [{ name: "J_Bip_L_UpperArm", at: [0.14, 0, 0], children: [
            { name: "J_Bip_L_LowerArm", at: [0.27, 0, 0], children: [{ name: "J_Bip_L_Hand", at: [0.24, 0, 0] }] }] }] },
          { name: "J_Bip_R_Shoulder", at: [-0.03, 0.22, 0], children: [{ name: "J_Bip_R_UpperArm", at: [-0.14, 0, 0], children: [
            { name: "J_Bip_R_LowerArm", at: [-0.27, 0, 0], children: [{ name: "J_Bip_R_Hand", at: [-0.24, 0, 0] }] }] }] },
        ] }] },
      ],
    },
    root,
  );
  return root;
}
/** A one-pose clip: the source's left upper arm turned so it points
 *  `dir` (world), its forearm turned to point `dir` as well. */
function reachClip(dir: THREE.Vector3): THREE.AnimationClip {
  const qUp = new THREE.Quaternion().setFromUnitVectors(A_UP, dir);
  // The forearm's world turn must be `qFore` such that qFore * A_FORE = dir;
  // its local track is parent-relative, so divide the upper arm's turn out.
  const qFore = new THREE.Quaternion().setFromUnitVectors(A_FORE, dir);
  const localFore = qUp.clone().invert().multiply(qFore);
  const times = [0, 1 / 30];
  const rep = (q: THREE.Quaternion) => [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w];
  return new THREE.AnimationClip("reach", 1 / 30, [
    new THREE.QuaternionKeyframeTrack("Left_UpperArm.quaternion", times, rep(qUp)),
    new THREE.QuaternionKeyframeTrack("Left_LowerArm.quaternion", times, rep(localFore)),
  ]);
}
function limbDir(root: THREE.Object3D, from: string, to: string): THREE.Vector3 {
  root.updateMatrixWorld(true);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  root.getObjectByName(from)!.getWorldPosition(a);
  root.getObjectByName(to)!.getWorldPosition(b);
  return b.sub(a).normalize();
}

describe("bakeRetargetedClip with unlike bind postures", () => {
  test("an A-pose source reaching straight forward reaches straight forward on a T-pose target", () => {
    const src = sourceRig();
    const tgt = targetRig();
    const fwd = new THREE.Vector3(0, 0, 1);
    const baked = bakeRetargetedClip(src, reachClip(fwd), tgt, OUTDOOR_RIG);
    expect(baked).not.toBeNull();
    const mixer = new THREE.AnimationMixer(tgt);
    mixer.clipAction(baked!.clip).play();
    mixer.setTime(0);
    const upper = limbDir(tgt, "J_Bip_L_UpperArm", "J_Bip_L_LowerArm");
    const fore = limbDir(tgt, "J_Bip_L_LowerArm", "J_Bip_L_Hand");
    expect(upper.dot(fwd)).toBeGreaterThan(0.995);
    expect(fore.dot(fwd)).toBeGreaterThan(0.995);
    // The right arm has no track, so the source holds it at ITS bind,
    // the A-pose, and that is where the target's right arm goes too.
    const right = limbDir(tgt, "J_Bip_R_UpperArm", "J_Bip_R_LowerArm");
    expect(right.x).toBeCloseTo(-A_UP.x, 2);
    expect(right.y).toBeCloseTo(A_UP.y, 2);
  });

  test("a source arm hanging at the side hangs at the side on the target", () => {
    const src = sourceRig();
    const tgt = targetRig();
    const down = new THREE.Vector3(0, -1, 0);
    const baked = bakeRetargetedClip(src, reachClip(down), tgt, OUTDOOR_RIG)!;
    const mixer = new THREE.AnimationMixer(tgt);
    mixer.clipAction(baked.clip).play();
    mixer.setTime(0);
    expect(limbDir(tgt, "J_Bip_L_UpperArm", "J_Bip_L_LowerArm").y).toBeLessThan(-0.995);
    expect(limbDir(tgt, "J_Bip_L_LowerArm", "J_Bip_L_Hand").y).toBeLessThan(-0.995);
  });
});
