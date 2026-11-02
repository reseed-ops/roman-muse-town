/**
 * Loose follow camera math (Nov 2, owner's design): in walk mode the
 * third-person camera is NOT pinned behind Gaius. It eases toward a
 * position behind him only once he is genuinely underway on a
 * sustained walk, it never moves for small steps or turns in place,
 * the player's own drag always wins instantly, and while a panel or
 * conversation owns the screen it does not rotate at all.
 *
 * This module is the pure decision core so the behaviour can be
 * unit-tested without a scene: the scene (townScene.ts) feeds it the
 * frame's facts and applies the returned yaw.
 *
 * The chosen feel, in numbers (the owner can ask for tighter or
 * looser by these):
 *   deadZoneRad      0.14 rad (about 8 deg): misalignment at or
 *                    below this never recenters.
 *   sustainSec       1.1 s of continuous genuine walking before the
 *                    recenter engages at all.
 *   ratePerSec       0.8: exponential approach rate toward his
 *                    heading once engaged.
 *   maxRateRadPerSec 0.30 rad/s (about 17 deg/s): hard cap on the
 *                    automatic rotation speed, however far behind
 *                    the camera has fallen.
 *   dragGraceSec     0.75 s of quiet after a drag ends before the
 *                    recenter may resume.
 *   minWalkSpeed     1.2 m/s of real displacement for a frame to
 *                    count as "underway" (the stroll pace is 2.3,
 *                    the walk pace 5.2, so both count; sidesteps,
 *                    push-outs and turns in place do not).
 */

export const FOLLOW_CAM = {
  deadZoneRad: 0.14,
  sustainSec: 1.1,
  ratePerSec: 0.8,
  maxRateRadPerSec: 0.3,
  dragGraceSec: 0.75,
  minWalkSpeed: 1.2,
} as const;

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** The frame's facts for the loose-follow decision. */
export interface FollowCamGate {
  /** He is on foot and actually displacing at walking speed. */
  underway: boolean;
  /** A pointer drag (or pinch) on the view is in progress. */
  dragging: boolean;
  /** Seconds since the last drag ended. */
  sinceDragEndSec: number;
  /** A panel, menu, or conversation owns the screen. */
  hold: boolean;
  /** Reduced motion: the automatic recenter never runs. */
  reducedMotion: boolean;
  /** The boom is collision-shortened hard (a narrow gap): the
   *  collision behaviour owns the camera, no rotation. */
  boomPinched: boolean;
}

/**
 * Advance the sustained-walk clock: it grows only while he is
 * genuinely underway with no drag and no screen owner; anything
 * else resets it to zero, so the recenter always has to earn its
 * engagement again after an interruption.
 */
export function followCamSustain(prev: number, dt: number, gate: FollowCamGate): number {
  if (!gate.underway || gate.dragging || gate.hold) return 0;
  return prev + Math.max(0, dt);
}

/**
 * One frame of loose follow: returns the camera yaw for this frame.
 * Unchanged unless every gate passes AND the sustained-walk clock
 * has reached sustainSec AND the camera is outside the dead zone
 * around his heading. The step is an exponential approach capped at
 * maxRateRadPerSec, so it settles gradually and never snaps.
 */
export function followCamYawStep(
  currentYaw: number,
  targetHeading: number,
  dt: number,
  sustain: number,
  gate: FollowCamGate,
): number {
  if (
    gate.hold ||
    gate.dragging ||
    gate.reducedMotion ||
    gate.boomPinched ||
    !gate.underway ||
    gate.sinceDragEndSec < FOLLOW_CAM.dragGraceSec ||
    sustain < FOLLOW_CAM.sustainSec ||
    dt <= 0
  ) {
    return currentYaw;
  }
  const diff = wrapAngle(targetHeading - currentYaw);
  if (Math.abs(diff) <= FOLLOW_CAM.deadZoneRad) return currentYaw;
  const step = diff * (1 - Math.exp(-dt * FOLLOW_CAM.ratePerSec));
  const cap = FOLLOW_CAM.maxRateRadPerSec * dt;
  return currentYaw + Math.max(-cap, Math.min(cap, step));
}
