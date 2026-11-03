import { expect, test } from "bun:test";
import {
  DRIVER,
  approachCommand,
  driverStep,
  followCommand,
  followTargetPoint,
  newDriver,
  paceForTilt,
  settleFacing,
  stickToWorld,
  wrapAngle,
  type DriverCommand,
} from "./padDriver";

// The natural-motion driver, pinned numerically (Task 3). Each test
// names the piece of the feel it guards: a stick that ramps instead of
// switching, a turn that sweeps instead of snapping, an approach that
// bleeds and lands short, a settle that turns her to him, and a follow
// harness that keeps his pace at the offset. Change the numbers in
// DRIVER on purpose and these move with them; change the curves and
// they fail.

const DT = 1 / 60;
const east: DriverCommand = { dirX: 1, dirZ: 0, speed: DRIVER.runSpeed };
const west: DriverCommand = { dirX: -1, dirZ: 0, speed: DRIVER.runSpeed };

function run(state = newDriver(), cmd: DriverCommand, seconds: number) {
  let last = driverStep(state, cmd, 0);
  for (let t = 0; t < seconds - 1e-9; t += DT) last = driverStep(state, cmd, DT);
  return last;
}

test("tilt maps to pace: rest, half a walk, a walk, a run", () => {
  expect(paceForTilt(0)).toBe(0);
  expect(paceForTilt(DRIVER.deadZone - 0.01)).toBe(0);
  expect(paceForTilt(DRIVER.deadZone)).toBeCloseTo(DRIVER.walkSpeed / 2, 5);
  expect(paceForTilt(DRIVER.runTilt - 0.001)).toBeLessThan(DRIVER.walkSpeed);
  expect(paceForTilt(DRIVER.runTilt - 0.001)).toBeGreaterThan(DRIVER.walkSpeed * 0.98);
  expect(paceForTilt(DRIVER.runTilt)).toBe(DRIVER.runSpeed);
  expect(paceForTilt(1)).toBe(DRIVER.runSpeed);
});

test("the stick is camera-relative, his scheme exactly", () => {
  // Camera looking along +z: up walks +z, right walks -x (screen-right for that facing).
  const up = stickToWorld(0, 1, 0);
  expect(up.dirX).toBeCloseTo(0, 6);
  expect(up.dirZ).toBeCloseTo(1, 6);
  const right = stickToWorld(1, 0, 0);
  expect(right.dirX).toBeCloseTo(-1, 6);
  expect(right.dirZ).toBeCloseTo(0, 6);
  // Camera turned to look along +x: up now walks +x.
  const turned = stickToWorld(0, 1, Math.PI / 2);
  expect(turned.dirX).toBeCloseTo(1, 6);
  expect(turned.dirZ).toBeCloseTo(0, 6);
  expect(stickToWorld(0.05, 0.05, 0).tilt).toBe(0);
  expect(stickToWorld(0.6, 0, 0).tilt).toBeCloseTo(0.6, 6);
  expect(stickToWorld(3, 4, 0).tilt).toBe(1);
});

test("a held stick ramps the pace up over time, never in one frame", () => {
  const state = newDriver();
  const first = driverStep(state, east, DT);
  expect(first.speed).toBeCloseTo(DRIVER.accel * DT, 6);
  expect(first.speed).toBeLessThan(DRIVER.runSpeed / 10);
  const settled = run(state, east, 1.2);
  expect(settled.speed).toBeCloseTo(DRIVER.runSpeed, 3);
  // Reaching the run takes runSpeed / accel seconds, within a frame.
  const fresh = newDriver();
  let frames = 0;
  while (driverStep(fresh, east, DT).speed < DRIVER.runSpeed - 1e-6) frames += 1;
  expect(frames * DT).toBeCloseTo(DRIVER.runSpeed / DRIVER.accel, 1);
});

test("letting go bleeds the pace to rest faster than it built", () => {
  const state = newDriver();
  run(state, east, 1.2);
  const rest: DriverCommand = { dirX: 0, dirZ: 0, speed: 0 };
  let frames = 0;
  while (driverStep(state, rest, DT).moving) frames += 1;
  const stopSec = frames * DT;
  expect(stopSec).toBeCloseTo(DRIVER.runSpeed / DRIVER.decel, 1);
  expect(stopSec).toBeLessThan(DRIVER.runSpeed / DRIVER.accel);
  // The last crawl snaps to exact rest on the next frame: no drift at a standstill.
  driverStep(state, rest, DT);
  expect(state.vx).toBe(0);
  expect(state.vz).toBe(0);
});

test("a reversed stick is a sweep, capped at the turn rate", () => {
  const state = newDriver(Math.PI / 2); // facing east, walking east
  run(state, east, 1.2);
  const before = state.heading;
  driverStep(state, west, DT);
  // One frame later the heading has moved by at most the cap.
  expect(Math.abs(wrapAngle(state.heading - before))).toBeLessThanOrEqual(DRIVER.maxTurnRadPerSec * DT + 1e-9);
  // The full turn-around is a slow-down and then a sweep: she bleeds
  // her eastward pace (the heading holds while the velocity still
  // points east), then turns through PI at the capped rate as the
  // westward pace builds. Never a frame, never a snap.
  let seconds = DT;
  while (Math.abs(wrapAngle(state.heading - -Math.PI / 2)) > 0.02 && seconds < 5) {
    driverStep(state, west, DT);
    seconds += DT;
  }
  const sweep = Math.PI / DRIVER.maxTurnRadPerSec;
  expect(seconds).toBeGreaterThan(sweep);
  expect(seconds).toBeLessThan(DRIVER.runSpeed / DRIVER.decel + sweep + 0.4);
});

test("the heading holds below a crawl", () => {
  const state = newDriver(1.0);
  const crawl: DriverCommand = { dirX: 0, dirZ: 1, speed: DRIVER.minTurnSpeed * 0.8 };
  run(state, crawl, 1);
  expect(state.heading).toBe(1.0);
});

test("an approach bleeds pace inside the stopping distance and lands short of the point", () => {
  const far = approachCommand(0, 0, 10, 0, DRIVER.runSpeed, 1);
  expect(far.speed).toBe(DRIVER.runSpeed);
  expect(far.dirX).toBe(1);
  const near = approachCommand(0, 0, 1 + DRIVER.stopBleedDist / 2, 0, DRIVER.runSpeed, 1);
  expect(near.speed).toBeCloseTo(DRIVER.runSpeed / 2, 6);
  const nearer = approachCommand(0, 0, 1.08, 0, DRIVER.runSpeed, 1);
  expect(nearer.speed).toBe(DRIVER.minApproachSpeed);
  expect(approachCommand(0, 0, 1.02, 0, DRIVER.runSpeed, 1).speed).toBe(0);
  // Walked to the end: she stops short of the point, within the stop distance, never on it.
  const state = newDriver();
  let x = 0;
  for (let t = 0; t < 8; t += DT) {
    const out = driverStep(state, approachCommand(x, 0, 6, 0, DRIVER.runSpeed, 1), DT);
    x += out.stepX;
  }
  expect(6 - x).toBeGreaterThan(0.6);
  expect(6 - x).toBeLessThan(1.1);
  expect(Math.hypot(state.vx, state.vz)).toBeLessThan(0.05);
});

test("at rest near Gaius she settles to face him, gently, and not from across the square", () => {
  let heading = 0; // facing +z; he stands to her +x
  const before = heading;
  heading = settleFacing(heading, 0, 0, 2, 0, DT);
  expect(heading - before).toBeCloseTo(DRIVER.settleTurnRadPerSec * DT, 6);
  for (let t = 0; t < 3; t += DT) heading = settleFacing(heading, 0, 0, 2, 0, DT);
  expect(heading).toBeCloseTo(Math.PI / 2, 3);
  expect(settleFacing(0.4, 0, 0, DRIVER.settleWithin + 0.5, 0, DT)).toBe(0.4);
  expect(settleFacing(0.4, 0, 0, 0.01, 0, DT)).toBe(0.4);
});

test("the follow harness puts her beside or behind him, on his right", () => {
  const base = { museX: 0, museZ: 0, gaiusX: 0, gaiusZ: 0, gaiusHeading: 0, gaiusSpeed: 0 };
  const beside = followTargetPoint({ ...base, offset: "beside" });
  expect(beside.x).toBeCloseTo(DRIVER.followBeside.side, 6);
  expect(beside.z).toBeCloseTo(-DRIVER.followBeside.back, 6);
  const behind = followTargetPoint({ ...base, offset: "behind" });
  expect(behind.z).toBeCloseTo(-DRIVER.followBehind.back, 6);
  expect(Math.abs(behind.z)).toBeGreaterThan(Math.abs(beside.z));
  // He turns to face +x: beside is now at -z (his right), a step back along -x.
  const turned = followTargetPoint({ ...base, gaiusHeading: Math.PI / 2, offset: "beside" });
  expect(turned.x).toBeCloseTo(-DRIVER.followBeside.back, 6);
  expect(turned.z).toBeCloseTo(-DRIVER.followBeside.side, 6);
});

test("the harness matches his pace at the offset, catches up when lagging, and rests when he does", () => {
  // In her spot while he walks: his pace, no more.
  const spot = followTargetPoint({ museX: 0, museZ: 0, gaiusX: 0, gaiusZ: 0, gaiusHeading: 0, gaiusSpeed: 3, offset: "beside" });
  const inPlace = followCommand({ museX: spot.x, museZ: spot.z - 2.5, gaiusX: 0, gaiusZ: 0, gaiusHeading: 0, gaiusSpeed: 3, offset: "beside" });
  expect(inPlace.speed).toBeCloseTo(Math.min(DRIVER.runSpeed, 3 + 2.5 * DRIVER.followCatchUp), 6);
  // Far behind: capped at her run.
  const lagging = followCommand({ museX: 0, museZ: -20, gaiusX: 0, gaiusZ: 0, gaiusHeading: 0, gaiusSpeed: 5.2, offset: "behind" });
  expect(lagging.speed).toBe(DRIVER.runSpeed);
  expect(lagging.dirZ).toBeGreaterThan(0.99);
  // He stands still and she is in her spot: rest.
  const resting = followCommand({ museX: spot.x, museZ: spot.z, gaiusX: 0, gaiusZ: 0, gaiusHeading: 0, gaiusSpeed: 0, offset: "beside" });
  expect(resting.speed).toBe(0);
  // Walked in from across the square with him standing: she stops short of the spot, never on it.
  const state = newDriver();
  let mx = -8;
  let mz = 0;
  for (let t = 0; t < 10; t += DT) {
    const out = driverStep(state, followCommand({ museX: mx, museZ: mz, gaiusX: 0, gaiusZ: 0, gaiusHeading: 0, gaiusSpeed: 0, offset: "beside" }), DT);
    mx += out.stepX;
    mz += out.stepZ;
  }
  const left = Math.hypot(spot.x - mx, spot.z - mz);
  expect(left).toBeGreaterThan(DRIVER.followStopDist * 0.5);
  expect(left).toBeLessThan(DRIVER.followStopDist + 0.3);
});
