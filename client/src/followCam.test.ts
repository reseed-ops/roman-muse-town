import { describe, expect, test } from "bun:test";
import { FOLLOW_CAM, followCamSustain, followCamYawStep, wrapAngle, type FollowCamGate } from "./followCam";

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
    const midway = run(0, 1.2, FOLLOW_CAM.sustainSec + 2);
    expect(midway).toBeGreaterThan(0.3);
    expect(midway).toBeLessThan(1.2 - FOLLOW_CAM.deadZoneRad);
    const settled = run(0, 1.2, FOLLOW_CAM.sustainSec + 9);
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
    const y = run(start, target, FOLLOW_CAM.sustainSec + 9);
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
