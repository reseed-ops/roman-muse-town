import type * as THREE from "three";
import { poseBone, type VrmRig } from "./characterAnimation";

/**
 * Task 106: she now slides 0.44 m (centres 0.40 m apart, shoulders meet) and rolls
 * 0.3 / 0.4 / 0.5 rad through chest, neck and head with a 0.12 nod, so the head lies on his
 * shoulder (Task 98's 0.32 m and 0.2 / 0.25 / 0.3 left a 0.52 m gap and an upright head).
 *
 * Aelia rests her head on Gaius's shoulder when the two sit together on
 * the sea cliff's bench (Task 98). A pose only: a small slide along the
 * seat toward him, a roll through chest, neck and head, a touch of nod. His
 * pose, the seats and the view are untouched.
 *
 * Model space: a VRM faces +Z, so its right hand is -X, and a positive
 * roll about Z tips the head's top toward -X, her right.
 */
export const LEAN = {
  /** Slide toward him along the seat, metres (the seats are 0.84 apart). */
  shift: 0.44,
  chestRoll: 0.3,
  neckRoll: 0.4,
  headRoll: 0.5,
  /** A slight nod, so the cheek meets the shoulder rather than the ear. */
  headNod: 0.12,
  /** Seconds to settle into (and out of) the lean. */
  settle: 0.5,
} as const;

/** +1 when he sits on her right (her roll is positive about Z), -1 on her left. */
export function sideOfHim(playerSlot: number): 1 | -1 {
  // Her facing is the bench's heading + PI, so her model +X is the bench's
  // -lx; he sits at bench lx = playerSlot * 0.42 from the centre, she at the opposite.
  return playerSlot > 0 ? 1 : -1;
}

/** Ease `k` toward `target` over LEAN.settle seconds. */
export function easeLean(k: number, target: number, dt: number): number {
  const a = 1 - Math.exp((-dt * 3) / LEAN.settle);
  const next = k + (target - k) * a;
  return Math.abs(target - next) < 0.002 ? target : next;
}

/** Her head's roll/pitch at lean amount k (0..1) toward a side. */
export function leanAngles(side: 1 | -1, k: number) {
  return { chestRoll: side * LEAN.chestRoll * k, neckRoll: side * LEAN.neckRoll * k, headRoll: side * LEAN.headRoll * k, headNod: LEAN.headNod * k, shift: -side * LEAN.shift * k };
}

/** Apply the lean to her rig and her inner group (shift is model-space x). Safe at k = 0. */
export function applyHeadRest(rig: VrmRig, inner: THREE.Object3D, side: 1 | -1, k: number) {
  const a = leanAngles(side, k);
  inner.position.x = a.shift + 0;
  if (k <= 0) return;
  poseBone(rig, rig.chest, 0, 0, a.chestRoll);
  poseBone(rig, rig.neck, 0, 0, a.neckRoll);
  poseBone(rig, rig.head, a.headNod, 0, a.headRoll);
}
