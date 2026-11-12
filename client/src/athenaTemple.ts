// Athena's temple as a place to walk (Task 88): the colliders of the podium's
// edge, the cella's walls, the columns and the statue, in world coordinates,
// and the doorway and the stair as numbers the tests and the scene share.
// Pure data and math (the scene builds the meshes in tributes.ts from the
// same ATHENA_TEMPLE record), so a test can walk a real walker through it.

import type { Obstacle } from "./collision";
import { ATHENA_TEMPLE } from "./town";

const T = ATHENA_TEMPLE;
const [PX, PZ] = T.position;

/** A local point (front +x) as a world point. The temple is not rotated. */
export const athenaWorld = (lx: number, lz: number): [number, number] => [PX + lx, PZ + lz];

const box = (lx0: number, lx1: number, lz0: number, lz1: number, pad: number): Obstacle => ({
  kind: "obb", x: PX + (lx0 + lx1) / 2, z: PZ + (lz0 + lz1) / 2, halfW: (lx1 - lx0) / 2, halfD: (lz1 - lz0) / 2, rot: 0, pad,
});
const post = (lx: number, lz: number, r: number, pad: number): Obstacle => ({ kind: "circle", x: PX + lx, z: PZ + lz, r, pad });

/** The bronze lamps' stands, against the back wall either side of Athena. */
export const ATHENA_LAMP_STANDS: readonly [number, number][] = [[T.cella.x0 + T.cella.wall + 0.22, -1.3], [T.cella.x0 + T.cella.wall + 0.22, 1.3]];

/** Everything on the temple's plot a walker cannot pass. The walls carry a 0.2 m pad
 *  (a walker's centre keeps 0.2 m off a wall face), so the 1.4 m doorway leaves 1.0 m
 *  to walk and the stair's lanes stay open. The podium itself is not one block any more:
 *  its edge is a rail, open at the two flights. */
export function athenaColliders(): Obstacle[] {
  const C = T.cella;
  const out: Obstacle[] = [];
  const edge = 0.3, rail = 0.1;
  // the podium's edge: back and both sides (the front is the step, the flights and the columns)
  out.push(box(-T.backX, -T.backX + edge, -T.halfZ, T.halfZ, rail));
  for (const s of [-1, 1]) out.push(s > 0 ? box(-T.backX, T.halfX + 0.05, T.halfZ - edge, T.halfZ, rail) : box(-T.backX, T.halfX + 0.05, -T.halfZ, -T.halfZ + edge, rail));
  // the seat step: a solid block in the middle of the front, a flight either side
  out.push(box(T.halfX, T.halfX + T.stepDepth, -T.stepHalfZ, T.stepHalfZ, 0.15));
  // the cella's walls: back, two sides, the front either side of the door
  const wallPad = 0.2;
  out.push(box(C.x0, C.x0 + C.wall, -C.halfZ, C.halfZ, wallPad));
  out.push(box(C.x0, C.x1, -C.halfZ, -C.halfZ + C.wall, wallPad));
  out.push(box(C.x0, C.x1, C.halfZ - C.wall, C.halfZ, wallPad));
  out.push(box(C.x1 - C.wall, C.x1, C.doorHalf, C.halfZ, wallPad));
  out.push(box(C.x1 - C.wall, C.x1, -C.halfZ, -C.doorHalf, wallPad));
  // the four columns, and what stands inside: Athena, the two lamp stands
  for (const cz of T.columnZ) out.push(post(T.colX, cz, 0.2, 0.1));
  out.push(post(T.statueX, 0, 0.35, 0.1));
  for (const [lx, lz] of ATHENA_LAMP_STANDS) out.push(post(lx, lz, 0.08, 0.08));
  return out;
}
