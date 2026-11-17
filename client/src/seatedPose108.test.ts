// Task 108: Gaius seated on a bench: the sword clear of the seat, and the legs steady.
import { expect, test } from "bun:test";
import * as THREE from "three";
import { createGaiusArms, SWORD_SEATED_PITCH } from "./gaiusArms";
import { graftLegTracks, seatedClipOwnsLegs } from "./characterAnimation";

const SEAT_PELVIS_PAD = 0.165; // townScene: the hips bone rides 0.165 m above the seat

function rig(yaw: number, hipsFlip: number) {
  const frame = new THREE.Group();
  const body = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = "J_Bip_C_Hips";
  hips.position.set(0, 0.95, 0);
  hips.rotation.y = hipsFlip;
  const chest = new THREE.Bone();
  chest.name = "J_Bip_C_UpperChest";
  chest.position.set(0, 0.35, 0);
  hips.add(chest);
  body.add(hips);
  frame.add(body);
  frame.rotation.y = yaw;
  const arms = createGaiusArms({ frame, place: async () => null, gladiusUrl: "g", shieldUrl: "s" });
  arms.attach(body);
  frame.updateMatrixWorld(true);
  return { frame, hips, arms };
}
/** The sword's lowest point above the seat, with the pelvis sat down on it (the seat is y 0 here). */
function lowestAboveSeat(r: ReturnType<typeof rig>): number {
  r.frame.position.y = SEAT_PELVIS_PAD - 0.95; // the hips bone at seat + 0.165
  r.frame.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(r.arms.sword).min.y;
}

for (const [name, yaw, flip] of [["slot 0 (facing the sea)", 0, 0], ["slot 1 (turned)", Math.PI, 0], ["a hips bone turned half round", 0.7, Math.PI]] as const) {
  test(`Task 108: the gladius clears the seat while he sits, and hangs as before after he stands (${name})`, () => {
    const r = rig(yaw, flip);
    // Worn and hanging: the bug, the tip passes through the seat.
    expect(lowestAboveSeat(r)).toBeLessThan(-0.3);
    // Sat: it eases to the thigh and the whole sword is above the seat surface.
    for (let i = 0; i < 40; i++) r.arms.setSeated(true, 0.05);
    expect(r.arms.seatedAmount()).toBe(1);
    expect(lowestAboveSeat(r)).toBeGreaterThan(0.05);
    // Stood again: back to exactly the worn pose.
    for (let i = 0; i < 40; i++) r.arms.setSeated(false, 0.05);
    expect(r.arms.seatedAmount()).toBe(0);
    const hang = rig(yaw, flip);
    expect(r.arms.sword.quaternion.angleTo(hang.arms.sword.quaternion)).toBeLessThan(1e-6);
  });
}

test("Task 108: sitting does not change what the sword is, only where it rests (visible stays true, LT stows as before)", () => {
  const r = rig(0, 0);
  for (let i = 0; i < 40; i++) r.arms.setSeated(true, 0.05);
  r.arms.setVisible({ sword: true, shield: false });
  expect(r.arms.sword.visible).toBe(true);
  r.arms.setVisible({ sword: false, shield: false });
  expect(r.arms.sword.visible).toBe(false);
  expect(SWORD_SEATED_PITCH).toBeLessThan(-1);
});

function legClip(name: string, duration: number, wobble: number): THREE.AnimationClip {
  const times: number[] = [];
  const values: number[] = [];
  for (let t = 0; t < duration - 1e-6; t += 1 / 30) {
    times.push(t);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.55 + Math.sin(t * 3) * wobble, 0, 0.05));
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.AnimationClip(name, duration, [new THREE.QuaternionKeyframeTrack("J_Bip_L_UpperLeg.quaternion", times, values)]);
}

test("Task 108: the grafted sit legs are held over the whole bench take, not only the sit clip's 2 s", () => {
  const sit = legClip("sit", 2.0, 0.01);
  const bench = legClip("bench", 3.33, 0.9); // its own legs wander hugely
  const other = new THREE.QuaternionKeyframeTrack("J_Bip_Spine.quaternion", [0, 3.33], [0, 0, 0, 1, 0, 0, 0, 1]);
  bench.tracks.push(other);
  graftLegTracks(sit, bench);
  const leg = bench.tracks.find((t) => t.name === "J_Bip_L_UpperLeg.quaternion")!;
  expect(bench.tracks.some((t) => t.name === "J_Bip_Spine.quaternion")).toBe(true);
  expect(leg.times[leg.times.length - 1]).toBeCloseTo(3.33, 5);
  const ip = (leg as unknown as { createInterpolant(): { evaluate(t: number): ArrayLike<number> } }).createInterpolant();
  const at0 = Array.from(ip.evaluate(0)) as number[];
  for (let t = 0; t <= 3.33; t += 0.05) {
    const v = ip.evaluate(t);
    for (let k = 0; k < 4; k++) expect(v[k]!).toBeCloseTo(at0[k]!, 5);
  }
});

test("Task 108: seated, the legs stay in the sit pose over many passes of the take even when the scene writes its idle pose each frame", () => {
  // The defect: the mixer writes a bone only when its blended value changed, the sit legs hold still,
  // and the scene's procedural idle wrote the legs every frame before the mixer: standing legs showed.
  const root = new THREE.Object3D();
  const leg = new THREE.Bone();
  leg.name = "J_Bip_L_UpperLeg";
  root.add(leg);
  const sit = legClip("sit", 2.0, 0.01);
  const bench = legClip("bench", 3.33, 0.9);
  graftLegTracks(sit, bench);
  const mixer = new THREE.AnimationMixer(root);
  const a = mixer.clipAction(bench);
  a.play();
  const idleLeg = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.035, 0.13, 0.015));
  const seatedLeg = new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.55, 0, 0.05));
  const run = (guarded: boolean) => {
    leg.quaternion.copy(seatedLeg);
    let worst = 0;
    for (let f = 0; f < 600; f++) {
      if (!guarded || !seatedClipOwnsLegs({ ready: true, hasSit: true }, true)) leg.quaternion.copy(idleLeg);
      mixer.update(1 / 30);
      worst = Math.max(worst, leg.quaternion.angleTo(seatedLeg));
    }
    return worst;
  };
  expect(run(false)).toBeGreaterThan(1.0); // unguarded, the legs stand up between mixer writes
  mixer.setTime(0);
  expect(run(true)).toBeLessThan(0.05); // guarded: one steady seated pose for 20 s
});

test("Task 108: the clip owns the legs only seated, with a ready animator that has a sit clip", () => {
  expect(seatedClipOwnsLegs({ ready: true, hasSit: true }, true)).toBe(true);
  expect(seatedClipOwnsLegs({ ready: true, hasSit: true }, false)).toBe(false); // stood up: the stride/idle pose is back
  expect(seatedClipOwnsLegs({ ready: true, hasSit: false }, true)).toBe(false); // no sit clip: procedural seated pose
  expect(seatedClipOwnsLegs({ ready: false, hasSit: true }, true)).toBe(false);
  expect(seatedClipOwnsLegs(null, true)).toBe(false);
});
