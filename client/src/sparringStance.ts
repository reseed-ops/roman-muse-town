// Task 131: Gaius's arms for the sparring bout: the gladius in his right hand, the scutum on his left forearm,
// and the guard, parry, strike and hit poses they move through. Procedural like the rest of his arms
// (poseBone on top of the rest pose); the bout phases choose the pose (sparring.ts), this file only knows the shapes.
import * as THREE from "three";
import type { VrmRig } from "./characterAnimation";

export type Move = "guard" | "parry" | "strike" | "hit";
type V3 = [number, number, number];
/** One pose: an Euler (x, y, z) per bone, in the same parent-space convention as poseBone. */
export type Stance = { rUpper: V3; rLower: V3; rHand: V3; lUpper: V3; lLower: V3 };

// Euler (x, y, z) per bone, tuned against renders (tools/tour/pose131.ts). On these bodies y swings an arm forward, z lowers
// it (negative raises it), and the elbow bends about y; the sword rides his hand blade-up, so the wrist's x rolls it forward.
const GUARD: Stance = { rUpper: [0, 0.9, 0.5], rLower: [0, 0.6, 0], rHand: [0, 0, 0], lUpper: [0, -0.8, -0.5], lLower: [0, -0.7, 0] };
const PARRY: Stance = { rUpper: [0, 0.7, -0.3], rLower: [0, 0.9, 0], rHand: [0, 0, 0], lUpper: [0, -0.8, -0.5], lLower: [0, -0.7, 0] };
const WIND: Stance = { rUpper: [0, 0.4, -1.3], rLower: [0, 0.6, 0], rHand: [0.5, 0, 0], lUpper: [0, -0.8, -0.5], lLower: [0, -0.7, 0] };
const THRUST: Stance = { rUpper: [0, 1.2, 0.2], rLower: [0, 0.1, 0], rHand: [-1.0, 0, 0], lUpper: [0, -0.8, -0.5], lLower: [0, -0.7, 0] };
const HIT: Stance = { rUpper: [0.3, 0.2, 0.9], rLower: [0, 0.3, 0], rHand: [0, 0, 0], lUpper: [0.2, -0.2, -0.9], lLower: [0, -0.3, 0] };

const mix = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const mixStance = (a: Stance, b: Stance, k: number): Stance => ({
  rUpper: mix(a.rUpper, b.rUpper, k), rLower: mix(a.rLower, b.rLower, k), rHand: mix(a.rHand, b.rHand, k),
  lUpper: mix(a.lUpper, b.lUpper, k), lLower: mix(a.lLower, b.lLower, k),
});
const smooth = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };

/** The pose for a move at its progress (0..1 across the move). */
export function gaiusStance(move: Move, progress: number): Stance {
  switch (move) {
    case "parry": return mixStance(GUARD, PARRY, Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI));
    case "hit": return mixStance(GUARD, HIT, Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI));
    case "strike":
      // guard to wind-up (35%), the cut (to 60%), back to the guard
      if (progress < 0.35) return mixStance(GUARD, WIND, smooth(progress / 0.35));
      if (progress < 0.6) return mixStance(WIND, THRUST, smooth((progress - 0.35) / 0.25));
      return mixStance(THRUST, GUARD, smooth((progress - 0.6) / 0.4));
    default: return GUARD;
  }
}

const euler = new THREE.Euler();
const target = new THREE.Quaternion();
/** Move a bone toward the stance's pose for it: `amount` 1 is the pose itself, less is a slerp from whatever the clip and the
 *  idle left on the bone this frame, so the bout's arms ease in and out of his own. */
function toward(rig: VrmRig, bone: THREE.Object3D | null, v: V3, amount: number) {
  const rest = rig.rest.get(bone as THREE.Object3D);
  if (!bone || !rest) return;
  target.setFromEuler(euler.set(v[0], v[1], v[2])).multiply(rest);
  if (amount >= 1) bone.quaternion.copy(target);
  else bone.quaternion.slerp(target, amount);
}

/** Put the stance on his arms, eased in by `amount` (0 leaves them, 1 is the pose). `swordArm: false` leaves the right arm to
 *  whatever else owns it (the victory wave). Call after the clips and the idle have written the frame. */
export function applyStance(rig: VrmRig, s: Stance, amount: number, swordArm = true) {
  toward(rig, rig.lUpperArm, s.lUpper, amount);
  toward(rig, rig.lLowerArm, s.lLower, amount);
  if (!swordArm) return;
  toward(rig, rig.rUpperArm, s.rUpper, amount);
  toward(rig, rig.rLowerArm, s.rLower, amount);
  toward(rig, rig.rHand, s.rHand, amount);
}
