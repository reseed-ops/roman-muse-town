import { obbLocal, type Obstacle } from "./collision";
import { wrapAngle } from "./followCam";

/**
 * The walk camera's guard rails (Task 113). The camera is clamped and
 * unstuck, never redesigned: its yaw, its follow and its controls are
 * the player's and stay as they were. Four small rules, all pure so the
 * suite can drive them without a scene:
 *
 *  1. The boom test (`boomAlong`) sees what hid the characters in the
 *     Nov 18 playtest: a wall he stands against (the old test skipped any
 *     entry under 0.5 m, which is exactly where a walker's clearance puts
 *     him, so the camera sat inside the wall), the Town Tree's ring
 *     (same), and thin trunks (cypress, olive, pine), which the old test
 *     skipped outright.
 *  2. When the boom is blocked closer than a comfortable distance, the
 *     camera swings round the walker by the smallest angle that opens
 *     the line (`stepCamAvoid`). Only the camera's VIEW yaw moves: the
 *     player's own yaw, and the input reference movement reads against,
 *     are untouched, so no direction of travel changes.
 *  3. The look-up is capped (`capLookTargetY`) so the walker's head stays
 *     in frame: no more nearly-straight-up views of empty sky.
 *  4. Aelia is kept in frame (`aimNudge`): the aim turns sideways, never
 *     further than keeps Gaius in frame, just enough to hold her too.
 */
export const CAM_GUARD = {
  /** The boom never goes shorter than this, even pinched. */
  minBoom: 1.0,
  /** Blocked closer than this and the camera swings round instead. */
  comfortBoom: 2.4,
  /** Clearance a wall or a building keeps from the lens. */
  wallExpand: 0.55,
  /** Thinnest trunk that counts, and the clearance it keeps. */
  thinMinR: 0.28,
  thinExpand: 0.75, // the cypress's foliage column is wider than its 0.3 m collider
  /** Swing search: step and widest swing (rad); the smallest swing that opens the line wins. */
  avoidStep: (10 * Math.PI) / 180,
  avoidMax: Math.PI,
  /** The opened line must be this much longer than comfort before the swing releases. */
  releaseMargin: 0.8,
  /** Swing ease rate (per second). */
  avoidRate: 5,
  /** Share of the half field of view the head may sit above the aim: the look-up cap. */
  lookUpFrac: 0.6,
  /** Aelia counts for framing within this distance of Gaius, and inside this bearing off the aim (rad). */
  aeliaRange: 10,
  aeliaMaxBearing: (80 * Math.PI) / 180,
  /** Share of the half horizontal field both bodies are kept inside. */
  frameFrac: 0.8,
  /** Aim ease rate (per second). */
  aimRate: 4,
} as const;

/** Nearest distance along a ground ray at which it meets an obstacle grown by `expand`.
 *  0 when the ray starts inside the grown shape and runs into it; Infinity on a miss
 *  (including a ray that starts inside and runs out of it). */
export function rayEntry(ox: number, oz: number, dx: number, dz: number, ob: Obstacle, expand: number): number {
  if (ob.kind === "circle") {
    const relX = ob.x - ox;
    const relZ = ob.z - oz;
    const along = relX * dx + relZ * dz;
    const rr = ob.r + expand;
    const perp2 = relX * relX + relZ * relZ - along * along;
    if (perp2 >= rr * rr) return Infinity;
    const half = Math.sqrt(rr * rr - perp2);
    const tEnter = along - half;
    const tExit = along + half;
    if (tExit <= 0) return Infinity;
    if (tEnter > 0) return tEnter;
    return along > 0.15 ? 0 : Infinity; // inside the grown circle: a hit only if it runs deeper in
  }
  const o = obbLocal(ob, ox, oz);
  const c = Math.cos(ob.rot);
  const s = Math.sin(ob.rot);
  const ldx = dx * c - dz * s;
  const ldz = dx * s + dz * c;
  let tEnter = -Infinity;
  let tExit = Infinity;
  for (const [lo, ld, half] of [[o.lx, ldx, ob.halfW + expand], [o.lz, ldz, ob.halfD + expand]] as [number, number, number][]) {
    if (Math.abs(ld) < 1e-6) {
      if (Math.abs(lo) > half) return Infinity;
    } else {
      let t1 = (-half - lo) / ld;
      let t2 = (half - lo) / ld;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tEnter = Math.max(tEnter, t1);
      tExit = Math.min(tExit, t2);
    }
  }
  if (tExit < 0 || tEnter > tExit) return Infinity;
  if (tEnter > 0) return tEnter;
  // Inside the grown box: running out of it again (away from a wall he stands at) is a miss.
  return tExit > CAM_GUARD.wallExpand + 0.15 ? 0 : Infinity;
}

/** The boom along (dirX, dirZ) from the walker: the nearest solid on the line shortens `max`. */
export function boomAlong(obstacles: readonly Obstacle[], px: number, pz: number, dirX: number, dirZ: number, max: number): number {
  let b = max;
  for (const ob of obstacles) {
    if (ob.ghost) continue;
    let expand: number = CAM_GUARD.wallExpand;
    if (ob.kind === "circle") {
      if (ob.r < CAM_GUARD.thinMinR) continue; // posts, stalks, saplings pass the lens
      if (ob.r < 0.8) expand = CAM_GUARD.thinExpand;
    }
    const hit = rayEntry(px, pz, dirX, dirZ, ob, expand);
    if (hit < b) b = hit;
  }
  return Math.max(CAM_GUARD.minBoom, Math.min(b, max));
}

export interface CamAvoidState {
  /** The swing now applied to the view yaw (rad). */
  off: number;
  /** The swing it is easing toward. */
  target: number;
}
export const newCamAvoidState = (): CamAvoidState => ({ off: 0, target: 0 });

export interface CamAvoidInput {
  dt: number;
  reducedMotion: boolean;
  obstacles: readonly Obstacle[];
  /** The walker's ground position. */
  px: number;
  pz: number;
  /** The player's own camera yaw (the camera sits behind it, at -sin, -cos). */
  yaw: number;
  /** The boom the camera wants, before collision (m). */
  rest: number;
  /** Another system owns the camera's yaw (the pair hold): no swing, the swing eases home. */
  suspended: boolean;
}
export interface CamAvoidStep {
  /** The view yaw to place the camera and the aim by. */
  yaw: number;
  /** The collision-limited boom along it. */
  boom: number;
}

/** One frame of the unstick: swing round by the smallest angle that opens the line, ease it, hold it with hysteresis. */
export function stepCamAvoid(s: CamAvoidState, inp: CamAvoidInput): CamAvoidStep {
  const boomAt = (yaw: number) => boomAlong(inp.obstacles, inp.px, inp.pz, -Math.sin(yaw), -Math.cos(yaw), inp.rest);
  const need = Math.min(inp.rest, CAM_GUARD.comfortBoom);
  if (inp.suspended) {
    s.target = 0;
  } else {
    const b0 = boomAt(inp.yaw);
    if (s.target !== 0) {
      if (b0 >= need + CAM_GUARD.releaseMargin) s.target = 0;
      else if (boomAt(inp.yaw + s.target) < need) s.target = findSwing(boomAt, inp.yaw, need, Math.sign(s.target));
    } else if (b0 < need) {
      s.target = findSwing(boomAt, inp.yaw, need, 0);
    }
  }
  s.off = inp.reducedMotion ? s.target : s.off + (s.target - s.off) * (1 - Math.exp(-Math.max(0, inp.dt) * CAM_GUARD.avoidRate));
  if (Math.abs(s.off - s.target) < 0.002) s.off = s.target;
  const yaw = inp.yaw + s.off;
  return { yaw, boom: boomAt(yaw) };
}

/** Smallest swing (either side; `prefer` breaks ties) with a boom of at least `need`; 0 when none opens. */
function findSwing(boomAt: (yaw: number) => number, yaw: number, need: number, prefer: number): number {
  for (let a = CAM_GUARD.avoidStep; a <= CAM_GUARD.avoidMax + 1e-9; a += CAM_GUARD.avoidStep) {
    const first = prefer < 0 ? -1 : 1;
    for (const sign of [first, -first]) {
      if (boomAt(yaw + sign * a) >= need) return sign * a;
    }
  }
  return 0;
}

/** The aim height capped so the walker's head stays in frame.
 *  camY: camera height; camDist: horizontal distance camera to walker;
 *  aimDist: horizontal distance camera to the aim point; headY: his head. */
export function capLookTargetY(targetY: number, o: { camY: number; camDist: number; aimDist: number; headY: number; fovDeg: number }): number {
  const half = (o.fovDeg * Math.PI) / 360;
  const headElev = Math.atan2(o.headY - o.camY, Math.max(0.1, o.camDist));
  const maxElev = Math.min(headElev + CAM_GUARD.lookUpFrac * half, Math.PI / 2 - 0.05);
  const cap = o.camY + Math.tan(maxElev) * o.aimDist;
  return Math.min(targetY, Math.max(cap, o.camY));
}

/** Horizontal bearing of (x, z) from the camera, off the aim's bearing (rad, wrapped). */
function bearingOff(camX: number, camZ: number, aimX: number, aimZ: number, x: number, z: number): number {
  return wrapAngle(Math.atan2(x - camX, z - camZ) - Math.atan2(aimX - camX, aimZ - camZ));
}

/**
 * The sideways turn of the aim (rad, positive = toward larger bearing) that holds Gaius and Aelia
 * inside CAM_GUARD.frameFrac of the half horizontal field, closest to no turn. Gaius wins when both
 * cannot fit; Aelia is ignored when far from him or behind the lens.
 */
export function aimNudge(o: {
  camX: number; camZ: number; aimX: number; aimZ: number;
  gaius: { x: number; z: number };
  aelia: { x: number; z: number } | null;
  fovDeg: number; aspect: number;
}): number {
  const hHalf = Math.atan(Math.tan((o.fovDeg * Math.PI) / 360) * o.aspect);
  const lim = hHalf * CAM_GUARD.frameFrac;
  const aG = bearingOff(o.camX, o.camZ, o.aimX, o.aimZ, o.gaius.x, o.gaius.z);
  let lo = aG - lim;
  let hi = aG + lim;
  const a = o.aelia;
  if (a && Math.hypot(a.x - o.gaius.x, a.z - o.gaius.z) <= CAM_GUARD.aeliaRange) {
    const aA = bearingOff(o.camX, o.camZ, o.aimX, o.aimZ, a.x, a.z);
    if (Math.abs(aA) <= CAM_GUARD.aeliaMaxBearing) {
      const lo2 = Math.max(lo, aA - lim);
      const hi2 = Math.min(hi, aA + lim);
      if (lo2 <= hi2) { lo = lo2; hi = hi2; }
      else {
        // Both cannot fit: hold Gaius, and take Aelia as far as he allows.
        const want = Math.max(lo, Math.min(hi, aA > aG ? aA - lim : aA + lim));
        lo = hi = want;
      }
    }
  }
  return Math.max(lo, Math.min(hi, 0));
}

/** Rotate the aim point about the camera by `turn` (rad), in the ground plane; y is kept. */
export function turnAim(camX: number, camZ: number, aimX: number, aimZ: number, turn: number): { x: number; z: number } {
  const dx = aimX - camX;
  const dz = aimZ - camZ;
  const r = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz) + turn;
  return { x: camX + Math.sin(ang) * r, z: camZ + Math.cos(ang) * r };
}
