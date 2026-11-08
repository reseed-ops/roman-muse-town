// Fireflies by their house and by the sea cliff (Task 49). The lake's
// swarm stays as it is; these are two more places he loves, lit by the
// same warm points under the same rules (after dark, spring and summer,
// out of the rain), and counted by the quality tier like the critters,
// so the phone stays smooth. Pure placement here; townScene draws them
// with the lake swarm's own material, so their glow is the same light.
import { CLIFF } from "./seaCliff";
import { HOME } from "./town";

export type FireflyPlace = "house" | "cliff";

/** How many drift by the house and over the cliff, per quality tier. */
export const FIREFLY_PLACES_BUDGET = {
  0: { house: 8, cliff: 10 },
  1: { house: 12, cliff: 16 },
  2: { house: 18, cliff: 26 },
} as const;

export const FIREFLY_PLACES_MAX = FIREFLY_PLACES_BUDGET[2].house + FIREFLY_PLACES_BUDGET[2].cliff;

export function fireflyPlacesBudget(tier: number): { house: number; cliff: number } {
  return FIREFLY_PLACES_BUDGET[tier >= 2 ? 2 : tier >= 1 ? 1 : 0];
}

/** The lawn outside their front door: the door faces east (+x), so the
 *  lawn's centre sits a few metres out from the door wall. */
export const HOUSE_LAWN = {
  x: HOME.position[0] + HOME.halfD + 5.6,
  z: HOME.position[1],
  rx: 4.6,
  rz: 6.2,
} as const;

/** Above the sea below the cliff: a band off the headland's sides and tip. */
export const SEA_BAND = {
  y: CLIFF.seaY + 1.4,
  rise: 2.6,
} as const;

/** Which of the cliff's three haunts a firefly keeps to, from its seed:
 *  the grass of the strip by the gate path, the headland, or the sea. */
export function cliffHaunt(seed: number): "path" | "head" | "sea" {
  return seed < 0.34 ? "path" : seed < 0.67 ? "head" : "sea";
}

/**
 * Where firefly `seed` (0..1) of `place` is at time `t`, written into
 * `out` at `i * 3`. `ground` is the walkers' ground height.
 */
export function fireflyPlaceAt(
  place: FireflyPlace,
  seed: number,
  t: number,
  ground: (x: number, z: number) => number,
  out: Float32Array,
  i: number,
): void {
  const wob = (k: number, f: number) => Math.sin(t * f + seed * k);
  let x: number;
  let y: number;
  let z: number;
  if (place === "house") {
    const a = seed * Math.PI * 2 + t * 0.08 * (0.5 + seed);
    const r = 0.25 + seed * 0.75;
    x = HOUSE_LAWN.x + Math.cos(a) * HOUSE_LAWN.rx * r + wob(20, 0.7) * 0.5;
    z = HOUSE_LAWN.z + Math.sin(a) * HOUSE_LAWN.rz * r + wob(14, 0.55) * 0.5;
    y = ground(x, z) + 0.55 + wob(9, 0.8 + seed) * 0.35 + seed * 0.9;
  } else {
    const haunt = cliffHaunt(seed);
    const s = (seed % 0.333) * 3; // 0..1 within its haunt
    if (haunt === "path") {
      // The grass either side of the path, gate to the headland's neck.
      const side = s < 0.5 ? -1 : 1;
      const along = 0.5 - 0.5 * Math.cos(s * 19.1 + t * 0.03 * (0.5 + s)); // to and fro, never a jump
      const zz = CLIFF.coastZ + 2 + along * (CLIFF.stripEndZ - CLIFF.coastZ - 6);
      x = side * (2.2 + (s * 13.7 % 1) * (CLIFF.landHalf - 3.4)) + wob(20, 0.6) * 0.5;
      z = zz + wob(14, 0.5) * 0.6;
      y = ground(x, z) + 0.5 + wob(9, 0.7 + s) * 0.35 + s * 0.8;
    } else if (haunt === "head") {
      const a = s * Math.PI * 2 + t * 0.07 * (0.5 + s);
      const r = (0.2 + s * 0.7) * CLIFF.walkHeadR;
      x = CLIFF.head.x + Math.cos(a) * r + wob(20, 0.6) * 0.5;
      z = CLIFF.head.z + Math.sin(a) * r + wob(14, 0.5) * 0.5;
      y = ground(x, z) + 0.5 + wob(9, 0.75 + s) * 0.35 + s * 0.8;
    } else {
      // Over the water: a slow arc round the headland, a few metres out
      // from its foot, low over the swell.
      const a = Math.PI * (-0.15 + s * 1.3) + Math.sin(t * 0.04 + s * 6) * 0.25;
      const r = CLIFF.head.r + 4 + s * 8;
      x = CLIFF.head.x + Math.cos(a) * r + wob(20, 0.5) * 0.7;
      z = CLIFF.head.z + Math.sin(a) * r + wob(14, 0.45) * 0.7;
      y = SEA_BAND.y + s * SEA_BAND.rise + wob(9, 0.6 + s) * 0.45;
    }
  }
  out[i * 3] = x;
  out[i * 3 + 1] = y;
  out[i * 3 + 2] = z;
}
