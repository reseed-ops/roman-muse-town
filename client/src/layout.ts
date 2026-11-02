// The Villa Aeliana's plan: one straight axis (x = 0) from the south gate to
// the great hall, climbing as it goes. Plain data and arithmetic, so the
// terrain, the scene, the walkers and the tests all read the same site.

export const VILLA = {
  lawnY: 0,
  gateY: -0.4,
  terraceY: 2.3,
  /** The raised terrace before the hall, walled on three sides. */
  terrace: { halfX: 7.5, north: -42.6, south: -24 },
  /** The great stair, down to the walk along the peristyle's north side. */
  stair: { halfX: 2.5, top: -24, foot: -13.5 },
  /** The colonnade around the Town Tree. */
  peristyle: { halfX: 12, halfZ: 10, columnHeight: 4.5 },
  /** Where the side walks leave the terrace, between its wall and the stair wall. */
  terraceWalkZ: -25,
  gate: [0, 46] as [number, number],
  metaSudans: [0, 15.5] as [number, number],
  ionicColumn: [-8.5, -6] as [number, number],
  statueMars: [-7.6, -15] as [number, number],
  gardenKey: [12.7, 23.5] as [number, number],
} as const;

/** Booths face the avenue: [x, z, rotY]. */
export const MARKET_BOOTHS: [number, number, number][] = [
  [8.5, 33.6, -Math.PI / 2],
  [-8.5, 33.6, Math.PI / 2],
  [8.5, 38.4, -Math.PI / 2],
];

/** The kitchen garden, mirroring the piscina across the axis. */
export const GARDEN_BEDS: [number, number][] = [[9, 22.5], [11.5, 22.5], [14, 22.5]];

/** The avenue's cypress pairs. */
export const AVENUE_CYPRESSES: [number, number][] = [23.2, 28, 32.8, 37.6, 42.4].flatMap(
  (z) => [[-4.4, z], [4.4, z]] as [number, number][],
);

/** Terrace and stair walls: [centre x, centre z, half x, half z]. */
export const VILLA_WALLS: [number, number, number, number][] = [
  [-7.5, -34.3, 0.2, 8.3], // west, stopping short of the walk's gap
  [7.5, -34.3, 0.2, 8.3], // east
  [0, -42.6, 7.7, 0.2], // north
  [-5, -24, 2.5, 0.2], // south, either side of the stair
  [5, -24, 2.5, 0.2],
  [-2.7, -18.75, 0.18, 5.25], // the stair's balustrades
  [2.7, -18.75, 0.18, 5.25],
];

const rectDistance = (x: number, z: number, x0: number, x1: number, z0: number, z1: number) =>
  Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));

const smooth = (k: number) => k * k * (3 - 2 * k);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Blend a rectangle of ground to `height`, feathering out by `feather`. */
function pad(ground: number, x: number, z: number, rect: [number, number, number, number], feather: number, height: number): number {
  const d = rectDistance(x, z, ...rect);
  return d >= feather ? ground : mix(height, ground, smooth(d / feather));
}

/** The stair's walking surface at z. */
export function stairHeight(z: number): number {
  const { top, foot } = VILLA.stair;
  return mix(VILLA.lawnY, VILLA.terraceY, Math.min(1, Math.max(0, (foot - z) / (foot - top))));
}

/** Natural hills become the villa's levels: lawn, avenue, stair and terrace.
 *  Heights the walkers stand on, so a wall can hide the terrace's edge but
 *  nothing here may be steeper than someone can climb. */
export function villaGround(natural: number, x: number, z: number): number {
  const { lawnY, gateY, terraceY } = VILLA;
  let h = pad(natural, x, z, [-27, 27, -17, 28], 5, lawnY);
  h = pad(h, x, z, [-13, 13, 28, 48], 5, mix(lawnY, gateY, Math.min(1, Math.max(0, (z - 28) / 18))));
  h = pad(h, x, z, [-7.7, 7.7, -42.8, -24], 1.4, terraceY);
  h = pad(h, x, z, [-4, 4, -24, -13.5], 1.2, stairHeight(z));
  // The west walk runs down the outside of the terrace wall to the lake bank.
  h = pad(h, x, z, [-9.2, -7.5, -31.2, -24], 0.6, mix(0.25, terraceY, smooth(Math.min(1, Math.max(0, (z + 31.2) / 5)))));
  // The east walk leaves level with the hill toward the temple.
  h = pad(h, x, z, [7.5, 11.5, -26.2, -23.8], 1.2, mix(terraceY, 1.75, Math.min(1, Math.max(0, (x - 7.5) / 4))));
  return h;
}

/** Where a walker can pass on her own errands, as named stops and the
 *  straight walks between them. Walls and colonnades leave only so many
 *  gaps, and steering alone can't plan for them. */
const WALK_NODES: Record<string, [number, number]> = {
  gate: [1.8, 40],
  stalls: [1.8, 35.2],
  avenue: [1.8, 31.8],
  ponds: [1.8, 25.9],
  courtEast: [5.4, 19.5],
  courtWest: [-5.4, 19.5],
  gardenEast: [2.8, 8],
  gardenWest: [-2.8, 8],
  roomEast: [8, 0],
  roomWest: [-8, 0],
  doorEast: [13.8, 0],
  doorWest: [-13.8, 0],
  stairFootEast: [2.8, -12],
  stairFootWest: [-2.8, -12],
  gardenNorthEast: [2.8, -8],
  gardenNorthWest: [-2.8, -8],
  storiesWalk: [-12.6, -12.4],
  lakePath: [-9, -23.4],
  lakeBank: [-9, -30.2],
  bathsRoad: [2.4, 29.6],
  bathsGate: [24, 29.6],
  bathsInside: [24, 26.6],
  stairFoot: [0, -12.6],
  stairTop: [0, -25],
  storiesAlley: [-14, -6],
};

const WALK_EDGES: [string, string][] = [
  ["gate", "stalls"], ["stalls", "avenue"], ["avenue", "bathsRoad"], ["bathsRoad", "ponds"], ["ponds", "courtEast"], ["ponds", "courtWest"],
  ["courtEast", "gardenEast"], ["courtWest", "gardenWest"], ["gardenEast", "roomEast"], ["gardenWest", "roomWest"],
  ["roomEast", "doorEast"], ["roomWest", "doorWest"], ["roomEast", "gardenNorthEast"], ["roomWest", "gardenNorthWest"],
  ["gardenNorthEast", "stairFootEast"], ["gardenNorthWest", "stairFootWest"], ["stairFootEast", "stairFoot"], ["stairFootWest", "stairFoot"],
  ["stairFoot", "stairTop"], ["stairFootWest", "storiesWalk"], ["storiesWalk", "lakePath"], ["lakePath", "lakeBank"],
  ["bathsRoad", "bathsGate"], ["bathsGate", "bathsInside"], ["doorWest", "storiesAlley"], ["storiesAlley", "storiesWalk"],
];

export const WALK_ROUTES = { nodes: WALK_NODES, edges: WALK_EDGES };

/** The stops between two points on the shortest run of walks, ending with
 *  the destination itself. Empty for a short hop with no need of them. */
export function routeBetween(from: [number, number], to: [number, number]): [number, number][] {
  const names = Object.keys(WALK_NODES);
  const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  if (dist(from, to) < 5) return [];
  const nearest = (p: [number, number]) => names.reduce((best, n) => (dist(p, WALK_NODES[n]!) < dist(p, WALK_NODES[best]!) ? n : best));
  const start = nearest(from);
  const goal = nearest(to);
  const cost = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const open = new Set([start]);
  while (open.size) {
    const here = [...open].reduce((a, b) => (cost.get(a)! <= cost.get(b)! ? a : b));
    open.delete(here);
    if (here === goal) break;
    for (const [a, b] of WALK_EDGES) {
      const next = a === here ? b : b === here ? a : null;
      if (!next) continue;
      const total = cost.get(here)! + dist(WALK_NODES[here]!, WALK_NODES[next]!);
      if (total < (cost.get(next) ?? Infinity)) {
        cost.set(next, total);
        prev.set(next, here);
        open.add(next);
      }
    }
  }
  const path: [number, number][] = [to];
  if (start === goal && !prev.has(goal)) return [WALK_NODES[goal]!, to];
  for (let n: string | undefined = goal; n; n = prev.get(n)) path.unshift(WALK_NODES[n]!);
  return path;
}

/** A saved position may predate the layout: anywhere that isn't open ground
 *  now falls back to the gate, so nobody resumes inside a wall. */
export function resumeSpot(
  x: number,
  z: number,
  spawn: readonly [number, number],
  settle: (x: number, z: number) => { x: number; z: number },
  inBounds: (x: number, z: number) => boolean,
): { x: number; z: number; moved: boolean } {
  const settled = settle(x, z);
  const open = inBounds(x, z) && Math.hypot(settled.x - x, settled.z - z) < 0.05;
  return open ? { x, z, moved: false } : { x: spawn[0], z: spawn[1], moved: true };
}
