import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { circ, obb, obbLocal, type Obstacle } from "./collision";
import {
  CAM_GUARD, aimNudge, boomAlong, capLookTargetY, newCamAvoidState, rayEntry, stepCamAvoid, turnAim,
} from "./walkCamGuard";
import { wrapAngle } from "./followCam";

const TAU = Math.PI * 2;
const REST = 4;

// The reported places, in miniature: a long wall (x = 0, north-south), the Town Tree's ring, an
// avenue cypress and the temple-like block.
const wall = obb(0, 0, 0.15, 6, 0);
const ring = circ(0, 20, 2.45);
const cypress = circ(10, 0, 0.3, 0.15);
const block = obb(-12, -12, 3, 2, 0.4);
const world: Obstacle[] = [wall, ring, cypress, block];

const inside = (ob: Obstacle, x: number, z: number): boolean => {
  if (ob.kind === "circle") return Math.hypot(x - ob.x, z - ob.z) < ob.r;
  const { lx, lz } = obbLocal(ob, x, z);
  return Math.abs(lx) < ob.halfW && Math.abs(lz) < ob.halfD;
};
/** True when the segment (a to b) passes through the obstacle's solid. */
const crosses = (ob: Obstacle, ax: number, az: number, bx: number, bz: number): boolean => {
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    if (inside(ob, ax + (bx - ax) * t, az + (bz - az) * t)) return true;
  }
  return false;
};

/** Settle the guard at a walker position and player yaw (no easing), return the camera. */
function place(obstacles: Obstacle[], px: number, pz: number, yaw: number, rest = REST) {
  const s = newCamAvoidState();
  const g = stepCamAvoid(s, { dt: 1 / 60, reducedMotion: true, obstacles, px, pz, yaw, rest, suspended: false });
  const g2 = stepCamAvoid(s, { dt: 1 / 60, reducedMotion: true, obstacles, px, pz, yaw, rest, suspended: false });
  expect(g2.yaw).toBeCloseTo(g.yaw, 9);
  return { yaw: g2.yaw, boom: g2.boom, x: px - Math.sin(g2.yaw) * g2.boom, z: pz - Math.cos(g2.yaw) * g2.boom, off: s.off };
}

describe("rayEntry", () => {
  test("a wall he stands against (inside its grown box) is a hit at 0, not skipped", () => {
    // 0.5 m from the wall, ray running into it: the old test returned Infinity for any entry under 0.5.
    expect(rayEntry(-0.65, 0, 1, 0, wall, CAM_GUARD.wallExpand)).toBe(0);
  });
  test("the same spot, the ray running away from the wall, is a miss", () => {
    expect(rayEntry(-0.65, 0, -1, 0, wall, CAM_GUARD.wallExpand)).toBe(Infinity);
  });
  test("the Town Tree ring at his clearance is a hit, and away from it is a miss", () => {
    expect(rayEntry(0, 17.0, 0, 1, ring, CAM_GUARD.wallExpand)).toBe(0);
    expect(rayEntry(0, 17.0, 0, -1, ring, CAM_GUARD.wallExpand)).toBe(Infinity);
  });
  test("a thin trunk on the line is found at its near edge", () => {
    expect(rayEntry(0, 0, 1, 0, cypress, CAM_GUARD.thinExpand)).toBeCloseTo(10 - 0.3 - CAM_GUARD.thinExpand, 5);
  });
});

describe("boomAlong", () => {
  test("a cypress between the camera and him shortens the boom; one beside the line does not", () => {
    expect(boomAlong(world, 14, 0, -1, 0, 8)).toBeCloseTo(4 - 0.3 - CAM_GUARD.thinExpand, 5);
    expect(boomAlong(world, 14, 2, -1, 0, 8)).toBe(8);
  });
  test("stalks and posts (r under the thin floor) pass the lens", () => {
    expect(boomAlong([circ(5, 0, 0.2)], 10, 0, -1, 0, 8)).toBe(8);
  });
  test("never shorter than the minimum, however pinched", () => {
    expect(boomAlong(world, -0.65, 0, 1, 0, 8)).toBe(CAM_GUARD.minBoom);
  });
});

describe("the unstick: the camera never sits in a wall or behind a trunk", () => {
  const spots: [string, number, number][] = [
    ["against the wall, west side", -0.7, 0],
    ["against the wall, east side", 0.7, 2],
    ["at the Town Tree's ring, south", 0, 17.0],
    ["at the Town Tree's ring, west", -2.9, 20],
    ["beside the cypress", 10.8, 0],
    ["against the block", -8.6, -13.44],
  ];
  for (const [name, px, pz] of spots) {
    for (const rest of [3, 4, 4.5, 8, 14]) {
      test(`${name}, rest ${rest} m: every drag angle leaves the camera clear, the line clear, and him in view`, () => {
        for (let k = 0; k < 72; k++) {
          const yaw = (k / 72) * TAU;
          const c = place(world, px, pz, yaw, rest);
          for (const ob of world) {
            expect(inside(ob, c.x, c.z)).toBe(false); // never inside a wall
            if (ob.kind === "circle" && ob.r >= CAM_GUARD.thinMinR) expect(Math.hypot(c.x - ob.x, c.z - ob.z)).toBeGreaterThan(ob.r + 0.5); // nor in a trunk's foliage
            if (ob.kind === "circle" && ob.r < CAM_GUARD.thinMinR) continue;
            expect(crosses(ob, c.x, c.z, px, pz)).toBe(false); // nothing solid between the lens and him
          }
          expect(c.boom).toBeGreaterThanOrEqual(CAM_GUARD.minBoom);
          expect(c.boom).toBeLessThanOrEqual(rest + 1e-9);
          expect(Math.abs(c.off)).toBeLessThanOrEqual(CAM_GUARD.avoidMax + 1e-9);
        }
      });
    }
  }
  test("a clear line is left exactly as the player put it: no swing, full boom", () => {
    const c = place(world, 30, 30, 1.234, 4);
    expect(c.off).toBe(0);
    expect(c.yaw).toBeCloseTo(1.234, 9);
    expect(c.boom).toBe(4);
  });
  test("the swing is the smallest one that opens the line", () => {
    // Wall between the camera and him: the nearest opening is the one that clears the wall's own face, within the swing limit.
    const c = place(world, -0.7, 0, Math.PI / 2, 4); // yaw +x: the camera sits at -x, behind him, clear.
    expect(c.off).toBe(0);
    const d = place(world, -0.7, 0, -Math.PI / 2, 4); // camera sits at +x: through the wall
    expect(Math.abs(d.off)).toBeGreaterThan(0);
    expect(Math.abs(d.off)).toBeLessThanOrEqual(CAM_GUARD.avoidMax + 1e-9);
  });
  test("the swing eases (no snap) and holds with hysteresis, then releases when the line opens", () => {
    const s = newCamAvoidState();
    const inp = { dt: 1 / 60, reducedMotion: false, obstacles: world, px: -0.7, pz: 0, yaw: -Math.PI / 2, rest: 4, suspended: false };
    const first = stepCamAvoid(s, inp);
    expect(Math.abs(s.off)).toBeLessThan(Math.abs(s.target)); // easing in, not a cut
    for (let i = 0; i < 120; i++) stepCamAvoid(s, inp);
    expect(s.off).toBeCloseTo(s.target, 2);
    const held = s.target;
    expect(held).not.toBe(0);
    // Turn the player's yaw to a clear one: the swing eases back to 0.
    for (let i = 0; i < 240; i++) stepCamAvoid(s, { ...inp, yaw: Math.PI / 2 });
    expect(s.target).toBe(0);
    expect(Math.abs(s.off)).toBeLessThan(0.01);
    expect(first.boom).toBeGreaterThan(0);
  });
  test("the player's own yaw is never written: the swing is view-only", () => {
    const s = newCamAvoidState();
    const inp = { dt: 1 / 60, reducedMotion: true, obstacles: world, px: -0.7, pz: 0, yaw: -Math.PI / 2, rest: 4, suspended: false };
    const g = stepCamAvoid(s, inp);
    expect(inp.yaw).toBe(-Math.PI / 2);
    expect(wrapAngle(g.yaw - inp.yaw)).toBeCloseTo(s.off, 9);
  });
  test("a pair hold owning the yaw suspends the swing", () => {
    const s = newCamAvoidState();
    const inp = { dt: 1 / 60, reducedMotion: true, obstacles: world, px: -0.7, pz: 0, yaw: -Math.PI / 2, rest: 4 };
    stepCamAvoid(s, { ...inp, suspended: false });
    expect(s.target).not.toBe(0);
    stepCamAvoid(s, { ...inp, suspended: true });
    expect(s.target).toBe(0);
  });
  test("a walker boxed in on every side still gets a camera at or beyond the minimum, never an exception", () => {
    const box = [obb(0, 1.2, 3, 0.3, 0), obb(0, -1.2, 3, 0.3, 0), obb(1.2, 0, 0.3, 3, 0), obb(-1.2, 0, 0.3, 3, 0)];
    for (let k = 0; k < 24; k++) {
      const c = place(box, 0, 0, (k / 24) * TAU, 4);
      expect(c.boom).toBeGreaterThanOrEqual(CAM_GUARD.minBoom);
      expect(Number.isFinite(c.x) && Number.isFinite(c.z)).toBe(true);
    }
  });
});

describe("the look-up cap: his head stays in frame", () => {
  const fovs = [46, 52, 60];
  test("a full drag up (the old aim 43 m up) is capped, at every distance and fov", () => {
    for (const fovDeg of fovs) {
      for (const dist of [3, 4, 4.5, 8, 14, 28]) {
        const camY = 0.9;
        const y = capLookTargetY(43, { camY, camDist: dist, aimDist: dist + 1.2, headY: 1.85, fovDeg });
        expect(y).toBeLessThan(43);
        // The frame's lower edge sits at (aim elevation - half fov): his head must be above it, and the
        // aim must not look past the head by more than the share of the half field the cap allows.
        const half = (fovDeg * Math.PI) / 360;
        const aimElev = Math.atan2(y - camY, dist + 1.2);
        const headElev = Math.atan2(1.85 - camY, dist);
        expect(headElev).toBeGreaterThan(aimElev - half); // head above the frame's bottom edge
        expect(headElev).toBeLessThan(aimElev + half); // and below the top edge
        expect(aimElev).toBeLessThan(Math.PI / 2);
      }
    }
  });
  test("an aim already at or below the cap is untouched", () => {
    expect(capLookTargetY(1.15, { camY: 1.85, camDist: 4, aimDist: 5.2, headY: 1.85, fovDeg: 46 })).toBe(1.15);
  });
});

describe("Aelia stays in frame beside him", () => {
  // Camera at the origin looking along +z; Gaius straight ahead at 4 m.
  const base = { camX: 0, camZ: 0, aimX: 0, aimZ: 5.2, gaius: { x: 0, z: 4 } };
  const hHalf = (fov: number, aspect: number) => Math.atan(Math.tan((fov * Math.PI) / 360) * aspect);
  const bearing = (x: number, z: number, turn: number) => Math.atan2(x, z) - turn;
  for (const [name, fov, aspect] of [["landscape", 46, 16 / 9], ["portrait", 60, 0.56]] as const) {
    test(`${name}: Aelia 1.6 m to his side, camera at the default and the closest distance, both end up inside the frame`, () => {
      for (const dist of [3, 4, 4.5]) {
        for (const side of [-1.6, 1.6]) {
          const o = { ...base, gaius: { x: 0, z: dist }, aimZ: dist + 1.2, aelia: { x: side, z: dist + 0.2 }, fovDeg: fov, aspect };
          const t = aimNudge(o);
          const lim = hHalf(fov, aspect);
          const aA = bearing(side, dist + 0.2, t);
          const aG = bearing(0, dist, t);
          expect(Math.abs(aG)).toBeLessThanOrEqual(lim + 1e-9);
          // Wherever both can fit at all, both do.
          if (Math.abs(Math.atan2(side, dist + 0.2) - Math.atan2(0, dist)) < 2 * lim * CAM_GUARD.frameFrac) {
            expect(Math.abs(aA)).toBeLessThanOrEqual(lim + 1e-9);
          }
        }
      }
    });
  }
  test("no turn when both are already well inside the frame", () => {
    expect(aimNudge({ ...base, aelia: { x: 0.8, z: 4 }, fovDeg: 46, aspect: 16 / 9 })).toBe(0);
  });
  test("Aelia far off or behind the lens is ignored, and Gaius is never pushed out", () => {
    const far = aimNudge({ ...base, aelia: { x: 30, z: 4 }, fovDeg: 46, aspect: 16 / 9 });
    expect(far).toBe(0);
    const behind = aimNudge({ ...base, aelia: { x: 0, z: -2 }, fovDeg: 46, aspect: 16 / 9 });
    expect(behind).toBe(0);
    // Too wide to fit both (portrait, 6 m abeam): Gaius stays in frame.
    const t = aimNudge({ ...base, aelia: { x: 6, z: 4 }, fovDeg: 60, aspect: 0.56 });
    expect(Math.abs(bearing(0, 4, t))).toBeLessThanOrEqual(hHalf(60, 0.56) + 1e-9);
  });
  test("no Aelia: no turn", () => {
    expect(aimNudge({ ...base, aelia: null, fovDeg: 46, aspect: 1.78 })).toBe(0);
  });
  test("turnAim rotates about the camera and keeps the range", () => {
    const a = turnAim(0, 0, 0, 5, 0.3);
    expect(Math.hypot(a.x, a.z)).toBeCloseTo(5, 9);
    expect(Math.atan2(a.x, a.z)).toBeCloseTo(0.3, 9);
  });
});

describe("the scene's own bounds (Task 113)", () => {
  const src = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
  test("pitch is clamped on every write, and the zoom floor keeps the camera off his back", () => {
    expect(src).toContain("const CAM_PITCH_MIN = -3.0;");
    expect(src).toContain("const CAM_PITCH_MAX = 2.6;");
    expect(src).toContain("const ZOOM_MIN = 0.75;");
    expect(src).toContain("walkCamFraming().dist * userZoom, 3.0, 30");
    for (const m of src.matchAll(/camPitchOffset = THREE\.MathUtils\.clamp\(/g)) expect(m.index).toBeGreaterThan(0);
    expect(src).not.toMatch(/userZoom = [^;]*\n?[^;]*(?<!clamp\()snap\.userZoom/);
  });
});
