import { CLIFF } from "./seaCliff";

/**
 * Trees and foliage round the sea cliff's bench (Task 98).
 *
 * The bench sits at the headland's edge facing south (+Z) over the sea.
 * The planting stands to its north, east and west flanks, beside and
 * behind the seat line, never in front: it frames the bench without
 * walling off the view. Every piece lies on the headland disc (not on
 * the approach slope), so a later coastal shoulder cannot reach it.
 * Kinds are the town's existing ones.
 */
export type BenchFoliageKind = "cypress" | "olive" | "conifer" | "bushA" | "bushB" | "bushD" | "bushE";

export interface BenchFoliagePiece {
  kind: BenchFoliageKind;
  x: number;
  z: number;
  rotY: number;
  /** Height in metres (a tree) or width (a bush or olive crown), per `size`. */
  size: "height" | "width";
  value: number;
}

export const BENCH_FOLIAGE: readonly BenchFoliagePiece[] = [
  // West flank
  { kind: "cypress", x: -4.9, z: 116.2, rotY: 0.4, size: "height", value: 4.2 },
  { kind: "olive", x: -6.4, z: 111.8, rotY: 1.1, size: "width", value: 3.0 },
  { kind: "bushB", x: -3.2, z: 117.0, rotY: 0.7, size: "width", value: 1.3 },
  { kind: "bushE", x: -4.2, z: 114.2, rotY: 2.3, size: "width", value: 1.4 },
  // East flank
  { kind: "cypress", x: 5.2, z: 115.6, rotY: 2.1, size: "height", value: 3.8 },
  { kind: "conifer", x: 6.8, z: 111.0, rotY: 0.9, size: "height", value: 4.6 },
  { kind: "bushD", x: 3.3, z: 116.8, rotY: 1.6, size: "width", value: 1.2 },
  { kind: "bushA", x: 4.5, z: 113.6, rotY: 0.2, size: "width", value: 1.4 },
];

/** Half-angle (degrees from due south) of the seated view the foliage must leave open. */
export const SEA_VIEW_HALF_ANGLE_DEG = 75;
/** How far behind the seat line (z north of the bench) a piece must stand, metres. */
export const SEAT_LINE_MARGIN = 1.0;
/** The clear lane to the bench along the trail, half-width in x (metres), from z 100 to the bench. */
export const APPROACH_CLEAR_HALF = 1.8;

/** Is (x, z) inside the sea view cone from the bench, or on the south side of its seat line? */
export function inSeaView(x: number, z: number): boolean {
  const dx = x - CLIFF.bench.x;
  const dz = z - CLIFF.bench.z;
  if (dz > -SEAT_LINE_MARGIN) return Math.abs(dx) < 40; // level with or south of the seat line
  return false;
}
