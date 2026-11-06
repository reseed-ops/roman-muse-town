import { wrapAngle } from "./followCam";

/**
 * The pair camera (Tasks 12, 13, 15, 16, 17, 20), as a pure step so the
 * suite can drive a whole flirt through it and pin the numbers. The
 * scene feeds it the pair state, his heading, the camera's yaw and a
 * collision scan along the side line, and takes back the yaw, the boom,
 * and whether the framing is on, held off, or has just released.
 *
 * Why the linger exists (Task 20): a pair action is clamped at its last
 * frame and fades out at the animator's seated rate (about half a
 * second) once the pair state ends, and the flirt's raised hands
 * release over a third of a second more. The flirt's peak IS its last
 * frames, so a camera that went home the instant the state ended (Task
 * 16's way home) left the three-quarter exactly while the held peak was
 * on screen; the hug's long static clip hid the same thing. The camera
 * now holds its framing PAIR_CAM_LINGER_S after the state ends, then
 * comes home.
 */
export type PairKind = "flirt" | "hug";
export interface PairCamSpec {
  /** Yaw off his heading, from his right. */
  yaw: number;
  /** The boom the hold dollies to (m). */
  boom: number;
  /** The camera height for the hold, null = the walk's. */
  height: number | null;
  /** Aim at the pair's midpoint at chest height (the hug). */
  aimMid: boolean;
}
export const PAIR_CAM: Record<PairKind, PairCamSpec> = {
  flirt: { yaw: 0.95, boom: 5.5, height: null, aimMid: false },
  hug: { yaw: 1.6, boom: 3.8, height: 2.1, aimMid: true },
};
/** The yaw eases toward its target at this rate (per second). */
export const PAIR_CAM_YAW_RATE = 1.6;
/** The framing holds this long after the pair state ends (the pose's release). */
export const PAIR_CAM_LINGER_S = 1.0;
/** Then the yaw eases home behind him for this long. */
export const PAIR_CAM_HOME_S = 2.5;
/** The height-and-aim mix eases at this rate (per second). */
export const PAIR_CAM_MIX_RATE = 3;

export interface PairCamState {
  /** The last kind framed, kept through the linger and the way home. */
  kind: PairKind | null;
  linger: number;
  home: number;
  /** 0 = the walk's height and aim, 1 = the hold's. */
  mix: number;
}
export const newPairCamState = (): PairCamState => ({ kind: null, linger: 0, home: 0, mix: 0 });

export interface PairCamInput {
  dt: number;
  /** The scene's pair state: null between moments; glide = the walk-in. */
  pair: { kind: PairKind; glide: boolean } | null;
  walkHeading: number;
  camYaw: number;
  /** No drag, no pinch, no pad stick, no reduced motion. */
  camFree: boolean;
  reducedMotion: boolean;
  /** The collision-limited boom along the camera line at a yaw. */
  sideBoom: (camYaw: number) => number;
}
export interface PairCamStep {
  camYaw: number;
  /** The boom to use, or null to leave the walk's. */
  boom: number | null;
  /** The kind being framed this frame (hold or linger), if any. */
  framing: PairKind | null;
  /** A framing frame that could not run because the camera is not free. */
  heldOff: boolean;
  /** True on the one frame the linger ends and the way home begins. */
  released: boolean;
  mix: number;
}

export const angleLerp = (a: number, b: number, k: number): number => a + wrapAngle(b - a) * k;

export function stepPairCam(s: PairCamState, inp: PairCamInput): PairCamStep {
  const dt = Math.max(0, inp.dt);
  const active = inp.pair && !inp.pair.glide ? inp.pair.kind : null;
  let released = false;
  if (active) {
    s.kind = active;
    s.linger = PAIR_CAM_LINGER_S;
    s.home = 0;
  } else if (!inp.pair && s.linger > 0) {
    s.linger = Math.max(0, s.linger - dt);
    if (s.linger === 0) {
      s.home = PAIR_CAM_HOME_S;
      released = true;
    }
  }
  const framing: PairKind | null = active ?? (!inp.pair && s.linger > 0 ? s.kind : null);
  let camYaw = inp.camYaw;
  let boom: number | null = null;
  let heldOff = false;
  if (framing) {
    const cam = PAIR_CAM[framing];
    if (inp.camFree) {
      camYaw = angleLerp(camYaw, inp.walkHeading + cam.yaw, 1 - Math.exp(-dt * PAIR_CAM_YAW_RATE));
      boom = Math.min(inp.sideBoom(camYaw), cam.boom);
    } else {
      heldOff = true;
    }
  } else if (s.home > 0) {
    s.home = Math.max(0, s.home - dt);
    if (inp.camFree) camYaw = angleLerp(camYaw, inp.walkHeading, 1 - Math.exp(-dt * PAIR_CAM_YAW_RATE));
  }
  const mixTarget = framing && PAIR_CAM[framing].aimMid && inp.camFree ? 1 : 0;
  s.mix += (mixTarget - s.mix) * (inp.reducedMotion ? 1 : 1 - Math.exp(-dt * PAIR_CAM_MIX_RATE));
  if (s.mix < 0.01) s.mix = 0;
  return { camYaw, boom, framing, heldOff, released, mix: s.mix };
}
