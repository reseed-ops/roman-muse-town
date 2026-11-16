// Swimming in the sea (Task 100). Pure rules, no three.js and no scene:
// when a walker becomes a swimmer and back, what the sea floor is, where
// the swimmer may go, how the view changes under the surface, and the
// swimming pose's numbers. townScene wires it; swimScene builds the
// seabed and the stair from the same functions, so what is drawn is
// what is stood on.
//
// The feel, in numbers: Gaius steps off the stair's foot into water
// above his chest (1.15 m) and swims; he comes out again when the steps
// under him rise to 0.9 m below the surface. A swimmer's axis (the line
// of his back to his belly, the point the camera follows) floats 0.02 m
// below the surface and cannot rise past it, nor sink within 0.5 m of
// the floor. Neutral buoyancy: with no depth button held he stays at the
// depth he is at.
import { CLIFF, COAST_FILLET, nearestOnLandEdge, onLand } from "./seaCliff";
import { insideStairMass, SEA_Y, shoreStairY, STAIR, stairY } from "./shoreStair";

export const SWIM = {
  seaY: SEA_Y,
  /** Walker to swimmer: the water over the steps is deeper than this. */
  enterDepth: 1.15,
  /** Swimmer to walker: the steps under him are shallower than this (a gap, so he does not flicker at the line). */
  exitDepth: 0.9,
  /** The swimmer's axis below the surface at its highest. */
  carry: 0.02,
  /** Metres a second: horizontal at full stick, and up or down with a depth button held. */
  speed: 2.3,
  vSpeed: 1.5,
  /** He cannot sink within this of the floor. */
  floorClear: 0.5,
  /** Keep this far from the cliff's foot: the rock bulges out to 1.75 m over the smooth outline. */
  landMargin: 2,
  /** The sea he may swim: x within these, z short of zMax; the last `soft` metres drag him back. */
  bounds: { xMin: -110, xMax: 110, zMax: 200, soft: 12 },
  /** Aelia swims this far to his side and this far behind him. */
  companion: { side: 1.15, back: 0.35 },
  /** Her pace, a shade over his so she keeps up. */
  companionSpeed: 2.6,
} as const;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// ---------------------------------------------------------------- modes

/** The water over the stair at (x, z), metres, or null off the stair. */
export function waterOverStair(x: number, z: number): number | null {
  const y = shoreStairY(x, z);
  return y === null ? null : SEA_Y - y;
}

/** A walker on the stair whose water is deeper than the chest swims. */
export function shouldSwim(x: number, z: number): boolean {
  const d = waterOverStair(x, z);
  return d !== null && d > SWIM.enterDepth;
}

/** A swimmer over steps shallow enough to stand on walks. */
export function shouldWalk(x: number, z: number): boolean {
  const d = waterOverStair(x, z);
  return d !== null && d <= SWIM.exitDepth;
}

/** Where a swimmer's axis starts when he steps in: the surface, with the stair's feet under him. */
export const surfaceY = () => SEA_Y - SWIM.carry;

/** Where she heads to climb out, on the stair in the shallows. */
export const SWIM_EXIT = { x: (STAIR.x0 + STAIR.x1) / 2, z: 100.2 } as const;

/**
 * Where Aelia walks to, to follow him down the stair, or null when she is
 * not near its head. Until she stands on the stair the goal is a point
 * just inside it (a hair past the head), never short of the line that
 * counts as being on the steps, so she cannot arrive and stand there; on
 * the steps it is the foot, into the water.
 */
export function museStairGoal(x: number, z: number): { x: number; z: number } | null {
  if (!(z > 48 && x > -8 && x < 15)) return null;
  const onSteps = z >= STAIR.topZ - 0.5 && x >= STAIR.x0 - 0.2;
  return { x: (STAIR.x0 + STAIR.x1) / 2, z: onSteps ? STAIR.endZ + 4 : STAIR.topZ + 0.3 };
}

// ---------------------------------------------------------------- floor

/** The straight coast, east and west of the land: distance south of it, else Infinity. */
function coastDistance(x: number, z: number): number {
  if (x >= COAST_FILLET.x && x <= CLIFF.landHalf) return Infinity;
  return z - CLIFF.coastZ;
}

/** Distance from the land (the smooth outline and the straight coast), 0 on it. */
export function distanceToLand(x: number, z: number): number {
  if (z < CLIFF.coastZ || onLand(x, z)) return 0;
  const p = nearestOnLandEdge(x, z);
  return Math.max(0, Math.min(Math.hypot(x - p.x, z - p.z), coastDistance(x, z)));
}

/** Round outcrops on the sea floor: [x, z, radius, height]. */
const MOUNDS: readonly (readonly [number, number, number, number])[] = [
  [-52, 128, 11, 4.2],
  [38, 150, 13, 5.0],
  [-18, 176, 9, 3.4],
  [74, 112, 8, 3.0],
  [-84, 168, 14, 5.5],
  [6, 138, 6, 2.2],
];

/**
 * The sea floor under (x, z): a shelf rising to 3.8 m under the sea at
 * the cliff's foot (so the stair's last steps meet it) and falling away
 * to about 15 m under it, rippled into long dunes and swells, with a few
 * round outcrops. The dunes fade to nothing at the cliff.
 */
export function seabedHeight(x: number, z: number): number {
  const d = distanceToLand(x, z);
  const depth = 3.8 + 11.5 * smooth(d / 75);
  const dunes =
    0.55 * Math.sin(0.11 * x + 1.7 * Math.sin(0.05 * z)) +
    0.4 * Math.sin(0.07 * z - 0.04 * x + 1) +
    0.22 * Math.sin(0.31 * x + 0.23 * z) +
    0.07 * Math.sin(0.9 * x + 0.6 * z);
  let bump = 0;
  for (const [mx, mz, r, h] of MOUNDS) {
    const t = Math.hypot(x - mx, z - mz) / r;
    if (t < 1) bump += h * (1 - t * t) ** 2;
  }
  const calm = smooth(d / 24);
  return SEA_Y - depth + (dunes + bump) * calm;
}

/** The floor is built to this much beyond the swim bounds, so its edge is always out in the fog. */
export const SEABED_EXTENT = { xMin: -150, xMax: 150, zMin: 50, zMax: 245, cell: 2 } as const;

/**
 * The floor as it is DRAWN (Task 103): the mesh is two-metre cells split
 * into planar triangles on seabedHeight's samples, so between vertices it
 * differs from the continuous function (by 0.15 m or more over the dunes).
 * This is the mesh's own height: the same cell, the same diagonal as
 * three's PlaneGeometry (each cell's a=(i,j) b=(i,j+1) c=(i+1,j+1)
 * d=(i+1,j) makes triangles a-b-d and b-c-d, so the diagonal is b-d),
 * interpolated on the triangle. Off the mesh, the function.
 */
export function seabedMeshHeight(x: number, z: number): number {
  const E = SEABED_EXTENT;
  if (x < E.xMin || x > E.xMax || z < E.zMin || z > E.zMax) return seabedHeight(x, z);
  const nx = Math.round((E.xMax - E.xMin) / E.cell);
  const nz = Math.round((E.zMax - E.zMin) / E.cell);
  // The cell counts are rounded, so the z spacing is 195 / 98, not exactly the nominal two metres.
  const dx = (E.xMax - E.xMin) / nx;
  const dz = (E.zMax - E.zMin) / nz;
  const gx = (x - E.xMin) / dx;
  const gz = (z - E.zMin) / dz;
  const i = Math.min(nx - 1, Math.floor(gx));
  const j = Math.min(nz - 1, Math.floor(gz));
  const u = gx - i;
  const v = gz - j;
  const h = (a: number, b: number) => seabedHeight(E.xMin + a * dx, E.zMin + b * dz);
  const ha = h(i, j);
  const hb = h(i, j + 1);
  const hd = h(i + 1, j);
  if (u + v <= 1) return ha + u * (hd - ha) + v * (hb - ha);
  const hc = h(i + 1, j + 1);
  return hc + (1 - u) * (hb - hc) + (1 - v) * (hd - hc);
}

/** The submerged steps under (x, z), or -Infinity off them. */
export function stairFloor(x: number, z: number): number {
  if (x < STAIR.meshX0 || x > STAIR.meshX1 || z < STAIR.topZ || z > STAIR.endZ) return -Infinity;
  return stairY(z) + STAIR.rise / 2;
}

/** What a swimmer cannot sink through: the sea floor as drawn, or the steps over it. */
export function swimFloor(x: number, z: number): number {
  return Math.max(seabedMeshHeight(x, z), stairFloor(x, z));
}

/** The highest a swimmer's axis goes. */
export const swimCeiling = () => SEA_Y - SWIM.carry;

// --------------------------------------------------------------- bounds

/** Inside the sea he may swim (before the land is considered)? */
export function inSwimBounds(x: number, z: number): boolean {
  const b = SWIM.bounds;
  return x >= b.xMin && x <= b.xMax && z <= b.zMax;
}

/**
 * How hard the water holds him back at (x, z) when he is pushing
 * outward: 1 in the open, falling to 0 at the boundary (the last 12 m).
 */
export function edgeEase(x: number, z: number): number {
  const b = SWIM.bounds;
  const d = Math.min(x - b.xMin, b.xMax - x, b.zMax - z);
  return smooth(d / b.soft);
}

/** The point pulled back inside the swim bounds. */
export function clampToSea(x: number, z: number): { x: number; z: number } {
  const b = SWIM.bounds;
  return { x: Math.min(b.xMax, Math.max(b.xMin, x)), z: Math.min(b.zMax, z) };
}

/**
 * The swimmer's horizontal place made legal: inside the sea's bounds,
 * out of the rock and off the cliff's foot, and beside the stair, not
 * in the rock between it and the face (the stair's own solid is
 * checked by height, in swimMove).
 */
export function confine(x: number, z: number): { x: number; z: number } {
  const c = clampToSea(x, z);
  x = c.x;
  z = c.z;
  // Along the stair the walkway's edge is the wall: the face's own margin would shut the stair out.
  if (x >= 9 && x <= STAIR.meshX1 + 0.5 && z >= CLIFF.coastZ && z <= STAIR.endZ + 1) {
    if (x < STAIR.x0) x = STAIR.x0;
    return { x, z };
  }
  // The straight coast, east and west of the land.
  if ((x < COAST_FILLET.x || x > CLIFF.landHalf) && z < CLIFF.coastZ + SWIM.landMargin) z = CLIFF.coastZ + SWIM.landMargin;
  const p = nearestOnLandEdge(x, z);
  const d = Math.hypot(x - p.x, z - p.z);
  const inside = z >= CLIFF.coastZ && onLand(x, z);
  if (inside || d < SWIM.landMargin) {
    let nx = x - p.x;
    let nz = z - p.z;
    if (inside) {
      nx = -nx;
      nz = -nz;
    }
    const len = Math.hypot(nx, nz);
    if (len < 1e-6) {
      nx = 0;
      nz = 1;
    } else {
      nx /= len;
      nz /= len;
    }
    x = p.x + nx * SWIM.landMargin;
    z = p.z + nz * SWIM.landMargin;
  }
  return { x, z };
}

export type SwimPos = { x: number; y: number; z: number };

/**
 * One swim step: from `from`, by (dx, dz) horizontally and dy up or
 * down. Slides along the stair's mass and the cliff, never goes
 * through the floor nor above the surface, never out of the sea's
 * bounds. Returns the new place.
 */
export function swimMove(from: SwimPos, dx: number, dz: number, dy: number): SwimPos {
  const ceil = swimCeiling();
  let { x, z } = from;
  const tryTo = (tx: number, tz: number): boolean => {
    const c = confine(tx, tz);
    if (insideStairMass(c.x, from.y, c.z) && !insideStairMass(x, from.y, z)) return false;
    x = c.x;
    z = c.z;
    return true;
  };
  if (!tryTo(from.x + dx, from.z + dz)) {
    if (dx !== 0) tryTo(from.x + dx, from.z);
    if (dz !== 0) tryTo(x, from.z + dz);
  }
  let y = from.y + dy;
  const floor = swimFloor(x, z) + SWIM.floorClear;
  if (y < floor) y = floor;
  if (y > ceil) y = ceil;
  // Over a rise of the floor that would lift him above the surface, he is as high as he goes.
  if (y < floor) y = Math.min(floor, ceil);
  return { x, y, z };
}

/** The world heading a swimmer faces: from the stick, camera-relative, as on land. */
export function swimWish(ix: number, iy: number, camYaw: number): { dirX: number; dirZ: number; tilt: number } {
  const tilt = Math.min(1, Math.hypot(ix, iy));
  if (tilt < 1e-6) return { dirX: 0, dirZ: 0, tilt: 0 };
  const nx = ix / Math.hypot(ix, iy);
  const nz = iy / Math.hypot(ix, iy);
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const wx = fx * nz + -fz * nx;
  const wz = fz * nz + fx * nx;
  const l = Math.hypot(wx, wz) || 1;
  return { dirX: wx / l, dirZ: wz / l, tilt };
}

/** The depth buttons as a vertical wish: A (rise) up, B (sink) down, both cancel. */
export function depthWish(rise: boolean, sink: boolean): number {
  return (rise ? 1 : 0) - (sink ? 1 : 0);
}

// ----------------------------------------------------------------- view

/** Fraction under the surface the camera is: 0 more than 0.5 m above it, 1 more than 0.5 m below (the spec's half metre either side). */
export function underwaterMix(camY: number): number {
  return smooth((SEA_Y + 0.5 - camY) / 1.0);
}

export type RGB = readonly [number, number, number];
const lerpRGB = (a: RGB, b: RGB, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const SHALLOW_DAY: RGB = [0.2, 0.58, 0.82];
const DEEP_DAY: RGB = [0.03, 0.18, 0.4];
const SHALLOW_NIGHT: RGB = [0.02, 0.06, 0.14];
const DEEP_NIGHT: RGB = [0.005, 0.02, 0.05];

/**
 * The water's colour at a camera `depth` metres under the surface:
 * a clear blue near the top, deepening toward the floor, much darker by
 * night (warm lamp glow does not reach this far down). Also the colour
 * the far water fades to.
 */
export function underwaterColor(depth: number, nightMix: number): [number, number, number] {
  const k = smooth(depth / 14);
  const day = lerpRGB(SHALLOW_DAY, DEEP_DAY, k);
  const night = lerpRGB(SHALLOW_NIGHT, DEEP_NIGHT, k);
  return lerpRGB(day, night, Math.min(1, Math.max(0, nightMix)));
}

/** Fog under the surface: how clear the water is. Nearer by night. */
export function underwaterFog(nightMix: number): { near: number; far: number } {
  return { near: 0.5, far: 38 - 12 * Math.min(1, Math.max(0, nightMix)) };
}

/** Sun and sky light under water, as multiples of what they are above: dim, never black. */
export function underwaterLightScale(uw: number): { sun: number; hemi: number } {
  return { sun: 1 - 0.6 * uw, hemi: 1 - 0.3 * uw };
}

// -------------------------------------------------------------- Aelia

/** Her place beside him: to his right and a little behind, as on land. */
export function swimCompanionSpot(him: { x: number; z: number; heading: number }): { x: number; z: number } {
  const fx = Math.sin(him.heading);
  const fz = Math.cos(him.heading);
  const rx = -fz;
  const rz = fx;
  return { x: him.x - fx * SWIM.companion.back + rx * SWIM.companion.side, z: him.z - fz * SWIM.companion.back + rz * SWIM.companion.side };
}

/**
 * Her pace toward her spot: his own pace, plus a catch-up in proportion to
 * how far she is from it, capped, and nothing inside a hand's breadth. So
 * she settles beside him and stays there while he swims, instead of
 * trailing a stride behind.
 */
export function companionPace(dist: number, hisPace: number): number {
  if (dist < 0.1) return 0;
  return Math.min(3.4, hisPace + dist * 1.8);
}

// ----------------------------------------------------------------- pose

/**
 * The swimming pose's angles (radians, as poseBone takes them), for a
 * stroke `phase` and a pace `k` (0 floating, 1 swimming). A simple
 * crawl: the arms reach and pull in turn, the legs flutter, the head
 * lifts to look ahead. Model space: x swings an arm forward and up when
 * negative, as the seated and bath poses already use it.
 */
export function swimPoseAngles(phase: number, k: number) {
  const a = Math.sin(phase);
  const b = Math.sin(phase + Math.PI);
  const stroke = 0.35 + 0.65 * k;
  // The VRM's rest is arms out to the sides (a T). Rolling an arm about z raises it: its right arm
  // (-x) rises with a negative roll, its left with a positive one. Overhead (toward the head, which
  // leads when he lies out) is about 1.45; at the side, down toward the feet, about -1.2.
  const reach = (s: number) => 0.25 + 1.15 * s * stroke;
  return {
    lArmX: 0,
    rArmX: 0,
    lArmZ: reach(a),
    rArmZ: -reach(b),
    lForeX: 0,
    rForeX: 0,
    lLegX: 0.12 * Math.sin(phase * 2.2) * (0.4 + 0.6 * k),
    rLegX: 0.12 * Math.sin(phase * 2.2 + Math.PI) * (0.4 + 0.6 * k),
    lKneeX: -0.1 - 0.1 * Math.max(0, Math.sin(phase * 2.2)),
    rKneeX: -0.1 - 0.1 * Math.max(0, Math.sin(phase * 2.2 + Math.PI)),
    /** The head lifts to look ahead, not at the water. */
    headX: -0.8,
    /** The body lies this far over (about its x axis): a quarter turn, face down. */
    bodyPitch: Math.PI / 2,
    /** The body's own offset in its group: its length centred on the axis. */
    bodyBack: -0.9,
  };
}
