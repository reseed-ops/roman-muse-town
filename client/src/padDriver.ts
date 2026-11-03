/**
 * The natural-motion driver (Task 3, Nov 3 2026): the execution layer
 * under player 2. A stick, or a synthetic command standing in for one,
 * says where Aelia should go and how fast; this module says how her
 * body gets there so that it reads as a person walking rather than a
 * cursor sliding. It is pure, like followCam.ts and slide.ts, so every
 * curve below is pinned numerically without a scene.
 *
 * What it does, in order, every frame (driverStep):
 *   - eases the velocity vector toward the wanted one with separate
 *     acceleration and deceleration caps, so she leans into a start
 *     and bleeds out of a stop instead of switching;
 *   - sweeps her heading toward the direction of travel at a capped
 *     turn rate, so a reversed stick is a turn she walks through, not
 *     a snap; below a crawl the heading holds (a standing figure does
 *     not pivot with every stick wobble).
 * And around it:
 *   - approachCommand bleeds pace inside a stopping distance of a
 *     point, landing her at a natural distance short of it, never
 *     exactly on it;
 *   - settleFacing turns her, at rest and within conversational range,
 *     to face Gaius at a gentle capped rate;
 *   - followCommand is the harness: the offset spot beside or behind
 *     him, his pace matched, with a catch-up allowance per metre of
 *     lag, fed through approachCommand so arrival is the same glide.
 *
 * The chosen feel, in numbers (the port must keep these together, the
 * curves are tuned against each other):
 */
export const DRIVER = {
  /** Stick tilt below this is rest. */
  deadZone: 0.12,
  /** Her pace at a gentle tilt (her routine pace is 3.1 too). */
  walkSpeed: 3.1,
  /** Her top pace: a shade over his 5.2 so the harness can keep up. */
  runSpeed: 5.3,
  /** Tilt at and above which she runs. */
  runTilt: 0.78,
  /** m/s^2 toward a faster wanted velocity. */
  accel: 6.5,
  /** m/s^2 toward a slower one, or to rest. */
  decel: 9,
  /** rad/s cap on the heading sweep (about 180 deg/s: a full turn
   *  around takes a second of walking). */
  maxTurnRadPerSec: 3.2,
  /** Ground speed below which the heading holds still. */
  minTurnSpeed: 0.35,
  /** Approach: pace bleeds linearly inside this many metres of the
   *  stopping distance. */
  stopBleedDist: 1.6,
  /** The slowest the bleed goes, so she arrives rather than creeps. */
  minApproachSpeed: 0.35,
  /** Arrival: within this of the stopping distance counts as there. */
  arriveSlack: 0.05,
  /** At rest this close to him, she turns to face him. */
  settleWithin: 3,
  /** rad/s for that settle turn: unhurried. */
  settleTurnRadPerSec: 2.2,
  /** The harness offsets from him: along his heading (back) and to
   *  his right (side). */
  followBeside: { back: 0.35, side: 1.15 },
  followBehind: { back: 1.45, side: 0.55 },
  /** Extra m/s of pace per metre she lags behind her offset spot. */
  followCatchUp: 1.1,
  /** How short of the offset spot she comes to rest. */
  followStopDist: 0.3,
} as const;

export type DriverState = { vx: number; vz: number; heading: number };
export const newDriver = (heading = 0): DriverState => ({ vx: 0, vz: 0, heading });

/** A frame's wish: a world direction (any length; zero means rest) and
 *  the pace wanted along it, in m/s. */
export type DriverCommand = { dirX: number; dirZ: number; speed: number };
export const REST: DriverCommand = { dirX: 0, dirZ: 0, speed: 0 };

export type DriverOutput = { stepX: number; stepZ: number; speed: number; moving: boolean };

export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** Stick tilt (0..1) to pace: rest inside the dead zone, half a walk at
 *  its edge, a walk at the run threshold, a run at and above it. */
export function paceForTilt(tilt: number): number {
  if (tilt < DRIVER.deadZone) return 0;
  if (tilt >= DRIVER.runTilt) return DRIVER.runSpeed;
  const k = (tilt - DRIVER.deadZone) / (DRIVER.runTilt - DRIVER.deadZone);
  return DRIVER.walkSpeed * (0.5 + 0.5 * k);
}

/** Camera-relative stick to a world direction, his scheme exactly: up
 *  walks away from the camera, right is screen-right. */
export function stickToWorld(x: number, y: number, camYaw: number): { dirX: number; dirZ: number; tilt: number } {
  const mag = Math.hypot(x, y);
  if (mag < DRIVER.deadZone) return { dirX: 0, dirZ: 0, tilt: 0 };
  const nx = x / Math.max(1, mag);
  const ny = y / Math.max(1, mag);
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = -fz;
  const rz = fx;
  let dirX = fx * ny + rx * nx;
  let dirZ = fz * ny + rz * nx;
  const len = Math.hypot(dirX, dirZ) || 1;
  dirX /= len;
  dirZ /= len;
  return { dirX, dirZ, tilt: Math.min(1, mag) };
}

/** One frame: ease the velocity, sweep the heading, return the step. */
export function driverStep(state: DriverState, cmd: DriverCommand, dt: number): DriverOutput {
  const len = Math.hypot(cmd.dirX, cmd.dirZ);
  const wantX = cmd.speed > 0 && len > 1e-6 ? (cmd.dirX / len) * cmd.speed : 0;
  const wantZ = cmd.speed > 0 && len > 1e-6 ? (cmd.dirZ / len) * cmd.speed : 0;
  const haveSpeed = Math.hypot(state.vx, state.vz);
  const wantSpeed = Math.hypot(wantX, wantZ);
  const rate = wantSpeed > haveSpeed ? DRIVER.accel : DRIVER.decel;
  const dx = wantX - state.vx;
  const dz = wantZ - state.vz;
  const d = Math.hypot(dx, dz);
  const maxD = rate * Math.max(0, dt);
  if (d > maxD && d > 1e-9) {
    state.vx += (dx / d) * maxD;
    state.vz += (dz / d) * maxD;
  } else {
    state.vx = wantX;
    state.vz = wantZ;
  }
  const speed = Math.hypot(state.vx, state.vz);
  if (speed > DRIVER.minTurnSpeed) {
    const target = Math.atan2(state.vx, state.vz);
    const diff = wrapAngle(target - state.heading);
    const cap = DRIVER.maxTurnRadPerSec * Math.max(0, dt);
    state.heading = wrapAngle(state.heading + Math.max(-cap, Math.min(cap, diff)));
  }
  return { stepX: state.vx * dt, stepZ: state.vz * dt, speed, moving: speed > 0.05 };
}

/** Walk toward a point and come to rest stopDist short of it, pace
 *  bleeding over the last stopBleedDist metres. */
export function approachCommand(fromX: number, fromZ: number, toX: number, toZ: number, pace: number, stopDist: number): DriverCommand {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);
  const left = dist - stopDist;
  if (left <= DRIVER.arriveSlack || dist < 1e-6 || pace <= 0) return REST;
  const k = Math.min(1, left / DRIVER.stopBleedDist);
  return { dirX: dx / dist, dirZ: dz / dist, speed: Math.max(DRIVER.minApproachSpeed, pace * k) };
}

/** At rest near him: the heading eases toward him at a capped rate.
 *  Beyond settleWithin, or on top of him, it is left alone. */
export function settleFacing(heading: number, fromX: number, fromZ: number, toX: number, toZ: number, dt: number): number {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);
  if (dist > DRIVER.settleWithin || dist < 0.05) return heading;
  const diff = wrapAngle(Math.atan2(dx, dz) - heading);
  const cap = DRIVER.settleTurnRadPerSec * Math.max(0, dt);
  return wrapAngle(heading + Math.max(-cap, Math.min(cap, diff)));
}

export type FollowOffset = "beside" | "behind";

export type FollowInput = {
  museX: number;
  museZ: number;
  gaiusX: number;
  gaiusZ: number;
  gaiusHeading: number;
  /** His measured ground speed, m/s. */
  gaiusSpeed: number;
  offset: FollowOffset;
};

/** Where the harness wants her: back along his heading and over to his right. */
export function followTargetPoint(input: FollowInput): { x: number; z: number } {
  const o = input.offset === "beside" ? DRIVER.followBeside : DRIVER.followBehind;
  const fx = Math.sin(input.gaiusHeading);
  const fz = Math.cos(input.gaiusHeading);
  const rx = Math.cos(input.gaiusHeading);
  const rz = -Math.sin(input.gaiusHeading);
  return {
    x: input.gaiusX - fx * o.back + rx * o.side,
    z: input.gaiusZ - fz * o.back + rz * o.side,
  };
}

/** The harness command: his pace plus a catch-up allowance for the lag,
 *  capped at her run, through the approach bleed so she glides into her
 *  spot and stops a little short of it. */
export function followCommand(input: FollowInput): DriverCommand {
  const target = followTargetPoint(input);
  const lag = Math.hypot(target.x - input.museX, target.z - input.museZ);
  const pace = Math.min(DRIVER.runSpeed, Math.max(0, input.gaiusSpeed) + lag * DRIVER.followCatchUp);
  return approachCommand(input.museX, input.museZ, target.x, target.z, pace, DRIVER.followStopDist);
}
