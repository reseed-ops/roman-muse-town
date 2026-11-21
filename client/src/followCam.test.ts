import { describe, expect, test } from "bun:test";
import { FOLLOW_CAM, INPUT_REF_RESYNC_RAD, followCamSustain, followCamYawStep, inputRefNeedsResync, wrapAngle, type FollowCamGate } from "./followCam";
import { stickToWorld } from "./padDriver";

const DT = 1 / 60;
const open: FollowCamGate = {
  underway: true,
  dragging: false,
  sinceDragEndSec: 10,
  hold: false,
  reducedMotion: false,
  boomPinched: false,
};

/** Run the sustain clock and the yaw step together the way the scene does. */
function run(yaw: number, target: number, seconds: number, gate: FollowCamGate = open) {
  let sustain = 0;
  let y = yaw;
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    sustain = followCamSustain(sustain, DT, gate);
    y = followCamYawStep(y, target, DT, sustain, gate);
  }
  return y;
}

describe("wrapAngle", () => {
  test("wraps to the short way around", () => {
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(0.3)).toBeCloseTo(0.3);
  });
});

describe("loose follow camera", () => {
  test("(a) standing still after a drag leaves the camera exactly where the player put it", () => {
    const put = 2.1;
    // He is not underway: the sustain clock never starts and the yaw
    // is returned untouched, frame after frame.
    const y = run(put, 0, 6, { ...open, underway: false });
    expect(y).toBe(put);
  });

  test("(a2) a drag in progress suspends the recenter even mid-walk", () => {
    const y = run(0, 1.4, 4, { ...open, dragging: true });
    expect(y).toBe(0);
  });

  test("(a3) the post-drag grace keeps the camera still, then walking earns it back", () => {
    const y = run(0, 1.4, 4, { ...open, sinceDragEndSec: 0.2 });
    expect(y).toBe(0);
  });

  test("(b) a sustained walk gradually settles the camera behind him", () => {
    // Nothing at all happens during the sustain window.
    expect(run(0, 1.2, FOLLOW_CAM.sustainSec - 0.1)).toBe(0);
    // Then it eases: partway there after a couple of seconds, inside
    // the dead zone after several, and it approaches monotonically
    // without ever snapping the whole way in one frame.
    const midway = run(0, 1.2, FOLLOW_CAM.sustainSec + 0.5);
    expect(midway).toBeGreaterThan(0.3);
    expect(midway).toBeLessThan(1.2 - FOLLOW_CAM.deadZoneRad);
    const settled = run(0, 1.2, FOLLOW_CAM.sustainSec + 5);
    expect(Math.abs(wrapAngle(1.2 - settled))).toBeLessThanOrEqual(FOLLOW_CAM.deadZoneRad + 1e-9);
    // Per-frame rotation never exceeds the cap.
    let y = 0;
    let sustain = 0;
    for (let i = 0; i < 60 * 6; i++) {
      sustain = followCamSustain(sustain, DT, open);
      const next = followCamYawStep(y, 1.2, DT, sustain, open);
      expect(Math.abs(next - y)).toBeLessThanOrEqual(FOLLOW_CAM.maxRateRadPerSec * DT + 1e-12);
      y = next;
    }
  });

  test("(b2) inside the dead zone the camera does not recenter at all", () => {
    const off = FOLLOW_CAM.deadZoneRad - 0.02;
    expect(run(0, off, 8)).toBe(0);
  });

  test("(b3) recentering takes the short way across the angle wrap", () => {
    const start = Math.PI - 0.2;
    const target = -Math.PI + 0.4;
    const y = run(start, target, FOLLOW_CAM.sustainSec + 6);
    expect(Math.abs(wrapAngle(target - y))).toBeLessThanOrEqual(FOLLOW_CAM.deadZoneRad + 1e-9);
  });

  test("(c) a conversation or panel owning the screen stops all auto-rotation", () => {
    const y = run(0, 1.6, 8, { ...open, hold: true });
    expect(y).toBe(0);
  });

  test("reduced motion and a pinched boom also hold the camera", () => {
    expect(run(0, 1.6, 8, { ...open, reducedMotion: true })).toBe(0);
    expect(run(0, 1.6, 8, { ...open, boomPinched: true })).toBe(0);
  });

  test("the sustain clock resets the moment he stops or a drag begins", () => {
    let s = followCamSustain(0, DT, open);
    s = followCamSustain(s, DT, open);
    expect(s).toBeCloseTo(DT * 2);
    expect(followCamSustain(s, DT, { ...open, underway: false })).toBe(0);
    expect(followCamSustain(s, DT, { ...open, dragging: true })).toBe(0);
    expect(followCamSustain(s, DT, { ...open, hold: true })).toBe(0);
  });
});

describe("Task 130: camera-relative movement and a camera that keeps behind him", () => {
  const angles = [0, 0.7, 1.9, Math.PI, -2.4, -0.5];

  test("pushing up always walks away from the camera, at any camera angle", () => {
    for (const yaw of angles) {
      const w = stickToWorld(0, 1, yaw);
      // The camera looks along (sin yaw, cos yaw); up is exactly that way.
      expect(w.dirX).toBeCloseTo(Math.sin(yaw), 6);
      expect(w.dirZ).toBeCloseTo(Math.cos(yaw), 6);
      // The body turns to face the way he travels.
      expect(Math.atan2(w.dirX, w.dirZ)).toBeCloseTo(wrapAngle(yaw), 6);
      // Down comes toward the camera; right is screen-right.
      const d = stickToWorld(0, -1, yaw);
      expect(d.dirX * Math.sin(yaw) + d.dirZ * Math.cos(yaw)).toBeCloseTo(-1, 6);
      const r = stickToWorld(1, 0, yaw);
      expect(-r.dirX * Math.cos(yaw) + r.dirZ * Math.sin(yaw)).toBeCloseTo(1, 6);
    }
  });

  test("walking, the camera comes back behind him from any angle, even from in front", () => {
    for (const start of angles) {
      const heading = 0.4;
      const y = run(start, heading, 5);
      expect(Math.abs(wrapAngle(heading - y))).toBeLessThanOrEqual(FOLLOW_CAM.deadZoneRad + 1e-9);
    }
    // From dead in front (180 deg) it is an ease of a few seconds, not a snap.
    expect(Math.abs(wrapAngle(0.4 - run(0.4 + Math.PI, 0.4, 1.5)))).toBeGreaterThan(1);
  });

  test("a new direction of push is read against the live view; a steady hold keeps its reference", () => {
    expect(inputRefNeedsResync(null, 0)).toBe(true);
    // A steady hold, or a small wobble of the thumb, never re-reads.
    expect(inputRefNeedsResync(0, INPUT_REF_RESYNC_RAD - 0.05)).toBe(false);
    expect(inputRefNeedsResync(0, -(INPUT_REF_RESYNC_RAD - 0.05))).toBe(false);
    // Left to up, down to up, across the angle wrap: re-read.
    expect(inputRefNeedsResync(-Math.PI / 2, 0)).toBe(true);
    expect(inputRefNeedsResync(Math.PI, 0)).toBe(true);
    expect(inputRefNeedsResync(Math.PI - 0.1, -Math.PI + 0.1)).toBe(false);
  });

  test("walk forward, turn, walk again: up stays up on every leg (scripted)", () => {
    // Stick against the live view, camera easing behind him between legs.
    let cam = 0;
    let ref = cam;
    let anchor: number | null = null;
    const heading = (ix: number, iy: number) => {
      const a = Math.atan2(ix, iy);
      if (inputRefNeedsResync(anchor, a)) {
        ref = cam;
        anchor = a;
      }
      const w = stickToWorld(ix, iy, ref);
      return Math.atan2(w.dirX, w.dirZ);
    };
    const leg = (ix: number, iy: number, seconds: number, head: { v: number }) => {
      let sustain = 0;
      for (let i = 0; i < seconds * 60; i++) {
        head.v = heading(ix, iy);
        sustain = followCamSustain(sustain, DT, open);
        cam = followCamYawStep(cam, head.v, DT, sustain, open);
      }
    };
    const h = { v: 0 };
    leg(0, 1, 2, h); // forward
    expect(h.v).toBeCloseTo(0, 6);
    leg(1, 0, 3, h); // turn right, held: the camera swings in behind him
    expect(Math.abs(wrapAngle(h.v - cam))).toBeLessThanOrEqual(FOLLOW_CAM.deadZoneRad + 1e-9);
    const before = cam;
    leg(0, 1, 0.1, h); // push up again, without letting go: away from the camera
    expect(h.v).toBeCloseTo(wrapAngle(before), 3);
  });
});
