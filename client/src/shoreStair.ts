// The way down to the sea (Task 100). The sea lies 25 m below the cliff
// and nowhere does the ground meet the water, so the town gets the
// simplest walkable entry: a stone stair cut along the strip's east
// face, from a landing off the trail just south of the gate down to the
// water, and on, under it, a few steps further. Pure numbers, no
// three.js: seaCliff (the walkable set), town (the ground height),
// swim (the floor under a swimmer) and swimScene (the mesh) all read it.
//
// Seen from above (z grows south, x east):
//   - the landing: a flat apron, y 0, x 5 to 12.9, z 56.2 to 58, off the
//     trail's east edge (the strip walkable ends at x 5.4);
//   - the stair: x 10.9 to 12.9, from z 58 running south, falling 0.6 m
//     per metre (31 degrees, 0.3 m steps of 0.5 m) to z 106, y -28.8.
//     It stands clear of the rock face's bulge (the face leans out at
//     most 1.75 m from the strip's edge, x 9): the walkway keeps 0.15 m
//     beyond it, and the headland, whose circle reaches x 9.1 at z 106,
//     is just clear of the foot.

/** The sea's level: the same as CLIFF.seaY (seaCliff.ts; a test pins it). */
export const SEA_Y = -25;

export const STAIR = {
  /** The walkway's west and east edges. */
  x0: 10.9,
  x1: 12.9,
  /** The stair starts here (y 0) and ends here. */
  topZ: 58,
  endZ: 106,
  /** Metres fallen per metre run: steps of 0.3 down, 0.5 along. */
  slope: 0.6,
  rise: 0.3,
  run: 0.5,
  /** The landing off the trail: flat, y 0. */
  landing: { x0: 5.0, x1: 12.9, z0: 56.2, z1: 58 },
  /** The mass the stair is built of reaches this far west, into the rock, so no seam shows where it meets the face. */
  meshX0: 8.0,
  /** The outer wall. */
  meshX1: 13.0,
  /** How thick the slab is under its treads. */
  thick: 2.2,
} as const;

/** The stair's centre-of-tread height at z (the walkable ground): the line through the steps' middles. */
export function stairY(z: number): number {
  return -STAIR.slope * (z - STAIR.topZ);
}

/** A tread's top: step i (0 at the head) covers z topZ + run*i .. +run. */
export function treadTop(i: number): number {
  return -STAIR.rise * i - STAIR.rise / 2;
}

export const STAIR_STEPS = Math.round((STAIR.endZ - STAIR.topZ) / STAIR.run);

/** Is (x, z) on the landing? */
export function onLanding(x: number, z: number): boolean {
  const L = STAIR.landing;
  return x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1;
}

/** Is (x, z) on the walkway of the stair itself? */
export function onStairway(x: number, z: number): boolean {
  return x >= STAIR.x0 && x <= STAIR.x1 && z >= STAIR.topZ && z <= STAIR.endZ;
}

/** Where one may walk: the landing and the stair. */
export function stairWalkable(x: number, z: number): boolean {
  return onLanding(x, z) || onStairway(x, z);
}

/**
 * The ground height at (x, z) on the landing or the stair, or null off
 * them. The landing is level; the stair is the line through the treads.
 */
export function shoreStairY(x: number, z: number): number | null {
  if (onStairway(x, z)) return stairY(z);
  if (onLanding(x, z)) return 0;
  return null;
}

/** The nearest point of the landing-and-stair walkable set. */
export function nearestStairPoint(x: number, z: number): { x: number; z: number } {
  const L = STAIR.landing;
  const a = { x: Math.max(L.x0, Math.min(L.x1, x)), z: Math.max(L.z0, Math.min(L.z1, z)) };
  const b = { x: Math.max(STAIR.x0, Math.min(STAIR.x1, x)), z: Math.max(STAIR.topZ, Math.min(STAIR.endZ, z)) };
  return Math.hypot(x - a.x, z - a.z) <= Math.hypot(x - b.x, z - b.z) ? a : b;
}

/**
 * The stair's solid column for a swimmer: the whole footprint of the
 * mass, from the rock to the outer wall, below the tread. True when a
 * point at height y is inside it (a hair above the tread counts as
 * clear, so a swimmer can skim the submerged steps).
 */
export function insideStairMass(x: number, y: number, z: number): boolean {
  if (x < STAIR.meshX0 || x > STAIR.meshX1 || z < STAIR.landing.z0 || z > STAIR.endZ) return false;
  const top = z < STAIR.topZ ? 0 : stairY(z) + STAIR.rise / 2;
  return y < top;
}
