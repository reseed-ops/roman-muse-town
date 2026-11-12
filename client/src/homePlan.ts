// The plan of their house (Task 76): a noble's Roman domus, as pure data in
// the house's local frame (HOME in town.ts: local +z is the door side, the
// door stands at x = 0). No three.js here, so the tests can read the rooms,
// the openings and the vista directly, and town.ts can lay the floor under
// every room without a cycle.
//
// The pattern is the honest one of Vitruvius, De architectura VI.3 (the
// atrium, its alae, the tablinum, the peristyle behind) and VI.5 (the
// vestibulum before the door, the fauces, the triclinia and cubicula), as
// the houses of Pompeii keep it: the House of the Faun (the great atrium
// with its impluvium, the tablinum looking through to the peristyle), the
// House of the Vettii (the red-and-ochre painted rooms, the lararium in
// the atrium, the marble-white columns with a red foot).
//
// It is a small domus in a small plot, and the plot decides the plan. The
// door, the steps and the floor height stay where Task 35 put them. The
// town's walking rim (a disc of radius 52 about the forum) clips the back
// to the south-west, two young olives and a tree stand beside it, and the
// lawn lies before it: so the house grows north (the wing of the
// triclinium and the bedroom) and the entrance runs straight back along
// the door's axis, door, fauces, atrium, tablinum, peristyle, the court
// kept in what room the rim leaves.

export type Rect = { x0: number; x1: number; z0: number; z1: number };
export type Opening = { from: number; to: number; h: number };
/** A wall's painted face: the room's fresco style, or none (plain plaster). */
export type Fresco = "red" | "ochre" | "black" | "garden" | "plain" | "outer";
export type Wall = {
  id: string;
  /** "x": runs along x at z = c; "z": runs along z at x = c. */
  axis: "x" | "z";
  c: number;
  a: number;
  b: number;
  t: number;
  /** The wall's top at `a` and at `b` (the roofs slope, the walls follow). */
  top: [number, number];
  open: Opening[];
  /** Painted face toward +perpendicular (larger z for axis x; larger x for axis z), and toward -. */
  pos?: Fresco;
  neg?: Fresco;
};

/** The plan's wall thicknesses: outer (HOME.wall) and partition. */
export const WALL_OUT = 0.22;
export const WALL_IN = 0.2;

/** Heights (house frame, floor = 0). */
export const H_ATRIUM = 4.3; // the taller atrium: its walls
export const H_HIGH = 3.65; // where a shed roof meets the atrium's wall
export const H_EAVE = 3.0; // the eave line of the outer walls
export const H_COMPLUVIUM = 3.3; // the inner edge of the atrium roof, at the opening
export const COLUMN_H = 3.3; // the atrium's columns

export const ROOMS = {
  fauces: { x0: -0.65, x1: 0.65, z0: 2.0, z1: 3.2 },
  cellS: { x0: -2.6, x1: -0.85, z0: 2.0, z1: 3.2 },
  cellN: { x0: 0.85, x1: 2.6, z0: 2.0, z1: 3.2 },
  atrium: { x0: -2.6, x1: 2.6, z0: -0.8, z1: 1.8 },
  closet: { x0: -2.6, x1: -1.5, z0: -2.2, z1: -1.0 },
  tablinum: { x0: -1.3, x1: 1.3, z0: -2.2, z1: -1.0 },
  passage: { x0: 1.5, x1: 2.6, z0: -2.2, z1: -1.0 },
  triclinium: { x0: 2.8, x1: 6.2, z0: 0.8, z1: 3.2 },
  cubiculum: { x0: 2.8, x1: 6.2, z0: -2.2, z1: 0.6 },
  gallery: { x0: -0.7, x1: 3.9, z0: -3.2, z1: -2.4 },
  garden: { x0: -0.7, x1: 3.2, z0: -4.6, z1: -3.2 },
} as const satisfies Record<string, Rect>;
export type RoomId = keyof typeof ROOMS;

/** The porch before the door (the vestibulum, distyle in antis), outside the walls. */
export const PORTICO: Rect = { x0: -1.9, x1: 1.9, z0: 3.42, z1: 4.9 };

/** The compluvium (the roof opening) and the impluvium (the rain pool below it). */
export const COMPLUVIUM: Rect = { x0: -0.55, x1: 0.55, z0: 0.15, z1: 0.85 };
export const IMPLUVIUM: Rect = { x0: -0.75, x1: 0.75, z0: -0.05, z1: 1.05 };

/** The peristyle's pool, round, in the garden. */
export const PERISTYLE_POOL = { x: 1.25, z: -3.95, r: 0.42 } as const;

/** A putto (Task 86, the Idyllic Rome pack) on a small marble plinth east of the pool, facing it. It
 *  stands clear of the stepping stones (x up to 0.52), the gallery walk (z from -3.2), the planters and the
 *  hedges; nothing is built over it, the court stays open to the sky. */
export const PERISTYLE_PUTTO = { x: 2.1, z: -3.95, plinth: 0.32, plinthHalf: 0.2, height: 0.55, rotY: -Math.PI / 2 } as const;

export const DOOR = { x: 0, width: 1.3, h: 2.15 } as const;

const F = 3.31; // front wall centre
const S = -2.71; // south outer wall centre
const E1 = 2.7; // atrium east wall centre
const E2 = 6.31; // wing east wall centre
const P1 = 1.9; // atrium front wall centre
const P2 = -0.9; // atrium back wall centre
const P3 = -2.3; // tablinum row's back wall centre

export const WALLS: Wall[] = [
  // The front: the door (as in the cottage: 1.3 wide, a lintel above 2.15).
  { id: "front-w", axis: "x", c: F, a: -2.82, b: E1, t: WALL_OUT, top: [3.05, 3.05], open: [{ from: -0.65, to: 0.65, h: DOOR.h }], pos: "outer", neg: "red" },
  { id: "front-e", axis: "x", c: F, a: E1, b: 6.42, t: WALL_OUT, top: [H_HIGH, H_EAVE], open: [], pos: "outer", neg: "red" },
  // The south outer wall, and the atrium's tall one.
  { id: "south-front", axis: "z", c: S, a: P1, b: 3.42, t: WALL_OUT, top: [H_HIGH, H_EAVE], open: [], pos: "black", neg: "outer" },
  { id: "south-atrium", axis: "z", c: S, a: P2, b: P1, t: WALL_OUT, top: [H_ATRIUM, H_ATRIUM], open: [], pos: "red", neg: "outer" },
  { id: "south-back", axis: "z", c: S, a: -2.4, b: P2, t: WALL_OUT, top: [H_EAVE, H_HIGH], open: [], pos: "ochre", neg: "outer" },
  // The atrium's front wall, pierced by the fauces and the two cells' doors.
  {
    id: "atrium-front", axis: "x", c: P1, a: -2.82, b: E1, t: WALL_IN, top: [H_ATRIUM, H_ATRIUM],
    open: [{ from: -2.15, to: -1.25, h: 2.2 }, { from: -0.65, to: 0.65, h: 2.8 }, { from: 1.25, to: 2.15, h: 2.2 }],
    pos: "black", neg: "red",
  },
  // The atrium's back wall: the tablinum open at the axis, the closet and the passage either side.
  {
    id: "atrium-back", axis: "x", c: P2, a: -2.82, b: E1, t: WALL_IN, top: [H_ATRIUM, H_ATRIUM],
    open: [{ from: -2.45, to: -1.65, h: 2.2 }, { from: -0.9, to: 0.9, h: 2.9 }, { from: 1.6, to: 2.4, h: 2.2 }],
    pos: "ochre", neg: "red",
  },
  // The atrium's east wall: the bedroom's door and the dining room's.
  {
    id: "atrium-east", axis: "z", c: E1, a: P2, b: P1, t: WALL_IN, top: [H_ATRIUM, H_ATRIUM],
    open: [{ from: -0.7, to: 0.2, h: 2.3 }, { from: 0.85, to: 1.75, h: 2.3 }],
    pos: "ochre", neg: "red",
  },
  { id: "east-front", axis: "z", c: E1, a: P1, b: 3.42, t: WALL_IN, top: [H_HIGH, H_HIGH], open: [], pos: "red", neg: "ochre" },
  { id: "east-back", axis: "z", c: E1, a: -2.4, b: P2, t: WALL_IN, top: [H_HIGH, H_HIGH], open: [], pos: "ochre", neg: "plain" },
  // The cells and the fauces: the passage's two side walls.
  { id: "fauces-w", axis: "z", c: -0.75, a: 1.8, b: 3.2, t: WALL_IN, top: [H_HIGH, 3.1], open: [], pos: "red", neg: "ochre" },
  { id: "fauces-e", axis: "z", c: 0.75, a: 1.8, b: 3.2, t: WALL_IN, top: [H_HIGH, 3.1], open: [], pos: "ochre", neg: "red" },
  // The tablinum's two side walls.
  { id: "tablinum-w", axis: "z", c: -1.4, a: -2.4, b: P2, t: WALL_IN, top: [3.0, H_HIGH], open: [], pos: "red", neg: "ochre" },
  { id: "tablinum-e", axis: "z", c: 1.4, a: -2.4, b: P2, t: WALL_IN, top: [3.0, H_HIGH], open: [], pos: "ochre", neg: "red" },
  // The wing (the dining room and the bedroom): its partition, its east wall.
  { id: "wing-part", axis: "x", c: 0.7, a: E1, b: 6.42, t: WALL_IN, top: [H_HIGH, H_EAVE], open: [], pos: "red", neg: "ochre" },
  { id: "wing-east-dining", axis: "z", c: E2, a: 0.7, b: 3.42, t: WALL_OUT, top: [3.02, 3.02], open: [], pos: "outer", neg: "red" },
  { id: "wing-east-bed", axis: "z", c: E2, a: -2.4, b: 0.7, t: WALL_OUT, top: [3.02, 3.02], open: [], pos: "outer", neg: "ochre" },
  // The back of the tablinum row, then the wing's back wall (the gallery door).
  {
    id: "back-w", axis: "x", c: P3, a: -2.82, b: E1, t: WALL_IN, top: [3.04, 3.04],
    open: [{ from: -0.6, to: 0.6, h: 2.9 }, { from: 1.6, to: 2.4, h: 2.2 }],
    pos: "red", neg: "plain",
  },
  { id: "back-e", axis: "x", c: P3, a: E1, b: 6.42, t: WALL_IN, top: [H_HIGH, H_EAVE], open: [{ from: 2.9, to: 3.8, h: 2.3 }], pos: "ochre", neg: "plain" },
  // The peristyle: its west, south and east walls, painted as a garden; the gallery's returns.
  { id: "court-w", axis: "z", c: -0.8, a: -4.8, b: -2.4, t: WALL_IN, top: [2.6, 3.0], open: [], pos: "garden", neg: "outer" },
  { id: "court-s", axis: "x", c: -4.7, a: -0.9, b: 3.4, t: WALL_IN, top: [2.6, 2.6], open: [], pos: "garden", neg: "outer" },
  { id: "court-e", axis: "z", c: 3.3, a: -4.8, b: -3.2, t: WALL_IN, top: [2.6, 2.6], open: [], pos: "outer", neg: "garden" },
  { id: "gallery-s", axis: "x", c: -3.3, a: 3.2, b: 4.1, t: WALL_IN, top: [2.55, 2.55], open: [], pos: "ochre", neg: "outer" },
  { id: "gallery-e", axis: "z", c: 4.0, a: -3.4, b: -2.4, t: WALL_IN, top: [2.55, 2.95], open: [], pos: "outer", neg: "ochre" },
];

/** Roof slabs: a rect, the axis it slopes along, and the height at each end of that run. */
export type Slab = { id: string; rect: Rect; axis: "x" | "z"; u0: number; y0: number; u1: number; y1: number };
export const SLABS: Slab[] = [
  { id: "front", rect: { x0: -3.1, x1: E1, z0: P1, z1: 3.8 }, axis: "z", u0: P1, y0: H_HIGH, u1: 3.8, y1: 2.84 },
  { id: "tablinum-w", rect: { x0: -3.1, x1: -0.9, z0: -2.7, z1: P2 }, axis: "z", u0: -2.7, y0: 2.87, u1: P2, y1: H_HIGH },
  { id: "tablinum-m", rect: { x0: -0.9, x1: E1, z0: -2.4, z1: P2 }, axis: "z", u0: -2.4, y0: 3.0, u1: P2, y1: H_HIGH },
  { id: "wing", rect: { x0: E1, x1: 6.8, z0: -2.7, z1: 3.8 }, axis: "x", u0: E1, y0: H_HIGH, u1: 6.8, y1: 2.93 },
  { id: "gallery", rect: { x0: -0.9, x1: 4.1, z0: -3.45, z1: -2.4 }, axis: "z", u0: -3.45, y0: 2.5, u1: -2.4, y1: 2.95 },
];

/** The slab's underside height at (x, z) (NaN outside it). */
export function slabAt(s: Slab, x: number, z: number): number {
  const { rect: r } = s;
  if (x < r.x0 - 1e-9 || x > r.x1 + 1e-9 || z < r.z0 - 1e-9 || z > r.z1 + 1e-9) return NaN;
  const u = s.axis === "x" ? x : z;
  return s.y0 + ((s.y1 - s.y0) * (u - s.u0)) / (s.u1 - s.u0);
}

/** Columns: the atrium's four (two beside the basin, two on the piers; the lararium's pair is shrine furniture), the peristyle's, the porch's. */
export const ATRIUM_COLUMNS: [number, number][] = [[-1.3, 0.5], [1.3, 0.5], [-2.35, 0.5], [2.35, 0.5]];
export const PERISTYLE_COLUMNS: [number, number][] = [-0.5, 0.5, 1.5, 2.5].map((x) => [x, -3.15] as [number, number]);
export const PORTICO_COLUMNS: [number, number][] = [[-1.4, 4.65], [1.4, 4.65]];
export const COLUMN_R = 0.17;

/** The bed for two, in the bedroom, its head against the back wall. */
export const BED = { lx: 5.3, lz: -1.0, halfW: 0.8, halfD: 1.05, top: 0.58 } as const;

/** The lamp table beside the bed. */
export const LAMP_TABLE = { x: BED.lx - BED.halfW - 0.45, z: -1.75, half: 0.25 } as const;

/** The rooms the house shuts in (rain stops there), and where the sky stays open. */
export const ROOFED: RoomId[] = ["fauces", "cellS", "cellN", "atrium", "closet", "tablinum", "passage", "triclinium", "cubiculum", "gallery"];
export const OPEN_SKY: Rect[] = [COMPLUVIUM, ROOMS.garden];

/** The atrium's four-sloped roof, from the walls' top in to the compluvium (its outer rim). */
export const ATRIUM_ROOF: Rect = { x0: -2.76, x1: 2.76, z0: -0.95, z1: 1.95 };

export const inRect = (r: Rect, x: number, z: number): boolean => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** A wall's openings as rectangles: the doorway through the wall's whole thickness. */
export const openingRects = (): Rect[] =>
  WALLS.flatMap((w) =>
    w.open.map((o) =>
      w.axis === "x"
        ? { x0: o.from, x1: o.to, z0: w.c - w.t / 2, z1: w.c + w.t / 2 }
        : { x0: w.c - w.t / 2, x1: w.c + w.t / 2, z0: o.from, z1: o.to },
    ),
  );
const OPENINGS = openingRects();

/** Inside the walls: every room, the garden court, and the doorways between them
 *  (a walker crossing a threshold stays inside). */
export const insideRooms = (x: number, z: number): boolean =>
  (Object.values(ROOMS) as Rect[]).some((r) => inRect(r, x, z)) || OPENINGS.some((r) => inRect(r, x, z));

/** The roof's footprint: every slab (eaves and the gallery's overhang over the garden
 *  included) and the atrium's four slopes. Rain stops wherever one of them lies above. */
export const ROOF_RECTS: Rect[] = [...SLABS.map((s) => s.rect), ATRIUM_ROOF];

/** Under a roof: beneath any roof's footprint (thresholds and eaves included), but not
 *  under a sky opening: the compluvium. The garden court has no roof of its own, so it
 *  stays open except under the gallery's overhang. */
export const shelteredAt = (x: number, z: number): boolean =>
  ROOF_RECTS.some((r) => inRect(r, x, z)) && !inRect(COMPLUVIUM, x, z);

/** Where the floor lies, as rectangles to the walls' outer faces: the main body, the gallery, the garden court. */
export const FLOOR_RECTS: Rect[] = [
  { x0: -2.82, x1: 6.42, z0: -2.4, z1: 3.42 },
  { x0: -0.9, x1: 4.1, z0: -3.4, z1: -2.4 }, // the gallery, with its east return
  { x0: -0.9, x1: 3.4, z0: -4.8, z1: -3.4 }, // the garden court
];

/** Where each spot stands (local). */
export const SPOTS = {
  /** Inside, by the door, facing it: the fauces. */
  wait: { x: 0, z: 2.55 },
  /** Where he stands to arrange the keepsakes: the bedroom, on the rug. */
  arrange: { x: 4.0, z: -0.6 },
  /** To rest together: beside the bed. */
  rest: { x: 3.95, z: -0.2 },
} as const;
