// The coastal shoulder (Task 99): a headland of land west of the bench
// path that slopes up from the town and drops steeply into the sea. Pure
// height function, no three.js, so town.ts can add it into terrainHeight
// and one function carries the town plane, the camera, feet, props, the
// trail and the grass mesh. The shoulder is scenery: it is not walkable
// (seaCliff.ts keeps the old strip and head as the only walkable land).
//
// Seen from above (x west is negative, z grows south to the bench):
//   - crest 10 m high at (-48, 72), nearer the west (sea) edge than the
//     east, so the seaward flank is the steep one and the town-facing
//     flank the long, gentle one;
//   - at the coast line (z 56) it spans about x -72 to -7, 65 m of land
//     joined to the town; west of the town plane's edge (x -56) the
//     scene lays a small apron of ground displaced by the same function;
//   - north it fades to nothing by z 44 (gently: under 15 degrees inside
//     the town's walking disc), south by z 94, and east by x -7, a good
//     6 m short of the trail's ribbon.

export const SHOULDER = {
  h: 10,
  /** The crest's position. */
  crestX: -48,
  crestZ: 72,
  /** Quadrant radii: west, east, north, south of the crest. */
  rW: 28,
  rE: 50,
  rN: 34,
  rS: 22,
  /** The east gate: full at x <= eastFull, nothing at x >= eastZero. */
  eastFull: -22,
  eastZero: -7,
  /** The north fade: nothing at z <= northZ, full from northZ + northRun. */
  northZ: 44,
  northRun: 26,
} as const;

const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

/** The shoulder's height above the ground at (x, z): 0 outside its footprint, smooth at the rim. */
export function shoulderRise(x: number, z: number): number {
  const S = SHOULDER;
  const a = x - S.crestX;
  const b = z - S.crestZ;
  const ta = a < 0 ? a / S.rW : a / S.rE;
  const tb = b < 0 ? b / S.rN : b / S.rS;
  const t2 = ta * ta + tb * tb;
  if (t2 >= 1) return 0;
  const east = 1 - smooth((x - S.eastFull) / (S.eastZero - S.eastFull));
  const north = smooth((z - S.northZ) / S.northRun);
  return S.h * (1 - t2) ** 2 * east * north;
}

/** The older name for the rise term (the Task 69 bump it replaces). */
export const hillRise = shoulderRise;
