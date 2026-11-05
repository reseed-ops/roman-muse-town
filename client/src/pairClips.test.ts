import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { faceForwardInPlace, hipForwardStep } from "./characterAnimation";

// The Outdoor couple takes: the partner half is authored facing its
// initiator, a half turn from the rig's forward (f_hug, measured Nov
// 5). The scene turns the two bodies toward each other itself, so a
// pair clip must face +Z on its first frame and keep its own lean.
const HIPS = "J_Bip_C_Hips";
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

function clipWith(yawDeg: number, leanDeg: number, travel: [number, number, number][]): THREE.AnimationClip {
  const yaw = new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(yawDeg));
  const lean = new THREE.Quaternion().setFromAxisAngle(X, THREE.MathUtils.degToRad(leanDeg));
  const q = yaw.clone().multiply(lean); // turned, then leaning in its own frame
  const times = travel.map((_, i) => i / 30);
  const quat: number[] = [];
  const pos: number[] = [];
  for (const [x, y, z] of travel) {
    quat.push(q.x, q.y, q.z, q.w);
    pos.push(x, y, z);
  }
  return new THREE.AnimationClip("pair", times[times.length - 1] ?? 0, [
    new THREE.QuaternionKeyframeTrack(`${HIPS}.quaternion`, times, quat),
    new THREE.VectorKeyframeTrack(`${HIPS}.position`, times, pos),
  ]);
}

function forwardOf(clip: THREE.AnimationClip, frame: number): THREE.Vector3 {
  const v = clip.tracks.find((t) => t.name === `${HIPS}.quaternion`)!.values;
  const q = new THREE.Quaternion(v[frame * 4]!, v[frame * 4 + 1]!, v[frame * 4 + 2]!, v[frame * 4 + 3]!);
  return new THREE.Vector3(0, 0, 1).applyQuaternion(q);
}

describe("faceForwardInPlace", () => {
  test("a half-turned partner half faces +Z afterwards and keeps its lean", () => {
    const clip = clipWith(180, 12, [[0, 1, 0], [0, 1, 0]]);
    expect(forwardOf(clip, 0).z).toBeCloseTo(-Math.cos(THREE.MathUtils.degToRad(12)), 3); // authored facing -Z
    faceForwardInPlace(clip);
    const f = forwardOf(clip, 0);
    expect(f.x).toBeCloseTo(0, 3);
    expect(f.z).toBeCloseTo(Math.cos(THREE.MathUtils.degToRad(12)), 3);
    expect(f.y).toBeCloseTo(-Math.sin(THREE.MathUtils.degToRad(12)), 3); // the same forward lean, now facing +Z
  });

  test("the hips' travel turns with the body about the first frame's column", () => {
    // Authored facing -Z and stepping 0.3 m toward -Z (toward its partner).
    const clip = clipWith(180, 0, [[0.5, 1, 2], [0.5, 1, 1.85], [0.5, 1, 1.7]]);
    faceForwardInPlace(clip);
    const p = clip.tracks.find((t) => t.name === `${HIPS}.position`)!.values;
    expect(p[0]).toBeCloseTo(0.5, 5);
    expect(p[2]).toBeCloseTo(2, 5);
    expect(p[8]).toBeCloseTo(2.3, 5); // now the step goes +Z, the body's forward
    expect(p[6]).toBeCloseTo(0.5, 5);
    expect(hipForwardStep(clip)).toBeCloseTo(0.3, 5);
  });

  test("a clip already facing forward is left alone", () => {
    const clip = clipWith(0.5, 20, [[0, 1, 0], [0.1, 1, 0.2]]);
    const before = Array.from(clip.tracks[0]!.values);
    faceForwardInPlace(clip);
    expect(Array.from(clip.tracks[0]!.values)).toEqual(before);
    expect(hipForwardStep(clip)).toBeCloseTo(0.2, 5);
  });
});
