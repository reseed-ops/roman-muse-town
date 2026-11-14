// Task 86: statues and market dressing from the Idyllic Rome pack.
// Athena in her temple, Augustus in the forum, a putto by the domus
// pool, and the market stalls' vases, amphorae, baskets, bread and
// hanging cloth. Pure data (no three.js) so the placement is testable;
// townScene.ts loads and places it. The statues travel in their own
// `statuary` pack and the stall goods in `market`, so neither drags the
// Colosseum's 7 MB `idyllic` pack in with it (a pack is one fetch).

import { PERISTYLE_PUTTO } from "./homePlan";
import { MARKET_BOOTHS } from "./layout";
import { ATHENA_TEMPLE } from "./town";

export type DressingAsset =
  | "athena" | "augustus" | "putto" | "podest"
  | "vase_a" | "vase_b" | "vase_c" | "amphora_a" | "amphora_b" | "amphora_c"
  | "basket_fruit" | "basket_grain" | "bread" | "cloth_a" | "cloth_b" | "cloth_c";

export const DRESSING_FILES: Record<DressingAsset, string> = {
  athena: "statuary/athena.glb",
  augustus: "statuary/augustus.glb",
  putto: "statuary/putto.glb",
  podest: "statuary/podest.glb",
  vase_a: "market/vase_a.glb",
  vase_b: "market/vase_b.glb",
  vase_c: "market/vase_c.glb",
  amphora_a: "market/amphora_a.glb",
  amphora_b: "market/amphora_b.glb",
  amphora_c: "market/amphora_c.glb",
  basket_fruit: "market/basket_fruit.glb",
  basket_grain: "market/basket_grain.glb",
  bread: "market/bread.glb",
  cloth_a: "market/cloth_a.glb",
  cloth_b: "market/cloth_b.glb",
  cloth_c: "market/cloth_c.glb",
};

/** What the build chose, measured on the slimmed GLBs (tools/idyllic/slim.py at ratio 0.4): the pack's
 *  statues are 21,904 / 21,640 / 8,216 triangles as imported (the brief's polygon counts are quads),
 *  which is heavy for one marble figure on a phone. The ceilings the tests hold: */
export const DRESSING_BUDGET = {
  statueTriangles: 10_000,
  puttoTriangles: 4_000,
  propTriangles: 2_000,
  statuaryBytes: 2_700_000, // 2.0 MB until Task 93 put the pack's normal maps back (athena, augustus, putto, podest: +0.67 MB)
  marketBytes: 900_000,
} as const;

/** Where a piece stands: the town's own frame, or the domus's (its floor is local y 0, the court's lawn). */
export type DressingFrame = "world" | "home";

export interface DressingPiece {
  id: string;
  site: "temple" | "forum" | "garden" | "market";
  asset: DressingAsset;
  frame: DressingFrame;
  x: number;
  z: number;
  rotY: number;
  width?: number;
  height?: number;
  /** Height above the base, in metres (a statue on its podium, a basket on a crate). */
  lift?: number;
  /** Stand on the ground sampled here, not at (x, z) (the temple's podium, a stall's floor). */
  groundAt?: [number, number];
  /** Ground footprint for collision, a circle: only where nothing else already blocks the spot. */
  footprint?: { r: number };
  /** A stall's goods: out by day, gone with the boards (the market's own rhythm). The cloth stays. */
  goods?: boolean;
  /** Which stall (index into MARKET_BOOTHS). */
  booth?: number;
}

const toWorldRot = (x: number, z: number): number => Math.atan2(-x, -z);

// --- Athena, in her temple ---------------------------------------------------
// Inside the cella (Tasks 87, 88), against the back wall on the axis, looking east
// out of the doorway, down the front step toward Lucretia and the bench. A walker
// can step in and stand before her (her collision circle is in athenaTemple.ts).
const T = ATHENA_TEMPLE;
export const ATHENA_STATUE = {
  /** Metres from the temple's origin (local +x). The cella's inner back face is at x0 + wall = -2.95; she is about 0.62 m deep, so her back is a hand from it. */
  localX: T.statueX,
  height: 1.8,
} as const;

// --- Augustus, in the forum --------------------------------------------------
/** The forum's south-east quarter, facing the Town Tree: 16 m from Lucretia, clear of the bench (8.8, 4.6),
 *  the table (8.8, -5.2), the streets and the wedding's arch, tables and banquet. */
export const AUGUSTUS_SPOT: [number, number] = [6.5, 7.6];
export const AUGUSTUS_PODEST_HEIGHT = 1.0;
export const AUGUSTUS_HEIGHT = 1.9;
/** Collision: the podest's half-width (0.33) plus the margin Lucretia's plinth gets. */
export const AUGUSTUS_RADIUS = 0.45;

// --- The market stalls -------------------------------------------------------
/** The stalls' canopy: a flat roof on four poles at about 2.2 to 2.5 m, placed 3.6 m wide (booth GLBs: 4.04 x 2.04 x 2.9 native). */
export const BOOTH_CANOPY_Y = 2.35;
/** The collider's half extents (townScene.ts, measured): nothing of the dressing leaves it, so the avenue stays as it was. */
export const BOOTH_HALF = { x: 1.73, z: 0.86 } as const;
/** The crate (roman/crate.glb, 0.62 wide placed) is 0.55 m tall: bread rides on it. */
export const CRATE_TOP = 0.55;

/** A point in a stall's own frame (x along its width, z toward the avenue) as a world point. */
export function boothPoint(booth: number, lx: number, lz: number): [number, number] {
  const [bx, bz, rot] = MARKET_BOOTHS[booth]!;
  return [bx + lx * Math.cos(rot) + lz * Math.sin(rot), bz - lx * Math.sin(rot) + lz * Math.cos(rot)];
}

interface Stock {
  asset: DressingAsset;
  lx: number;
  lz: number;
  rot?: number;
  height?: number;
  width?: number;
  lift?: number;
  goods?: boolean;
}
const good = (asset: DressingAsset, lx: number, lz: number, rest: Omit<Stock, "asset" | "lx" | "lz" | "goods"> = {}): Stock => ({ asset, lx, lz, goods: true, ...rest });
/** Cloth hangs from the canopy's front edge at a stall's corners; `lift` is set so its lower end is `drop` under the canopy. */
const cloth = (asset: "cloth_a" | "cloth_b" | "cloth_c", lx: number, length: number): Stock =>
  ({ asset, lx, lz: 0.76, height: length, lift: BOOTH_CANOPY_Y - length });

/** What each stall carries. Goods stand inside the stall, behind the boards that go up at evening. */
const STOCK: Stock[][] = [
  // the east stall by the gate: the potter's: amphorae and painted vases along the back, a basket of grain in front
  [
    good("amphora_a", -1.35, -0.5, { height: 0.95, rot: 0.3 }),
    good("amphora_b", -0.85, -0.52, { height: 0.8, rot: -0.4 }),
    good("vase_a", 0.15, -0.48, { height: 0.72, rot: 0.6 }),
    good("vase_b", 0.8, -0.45, { height: 0.58, rot: -0.2 }),
    good("amphora_c", 1.4, -0.45, { height: 0.66, rot: 1.1 }),
    good("basket_grain", -0.2, 0.3, { width: 0.68, rot: 0.4 }),
    cloth("cloth_a", -1.5, 1.15),
    cloth("cloth_b", 1.5, 1.3),
  ],
  // the west stall: the fruiterer's: baskets of fruit and grain, bread on a crate, an amphora at the back
  [
    good("amphora_b", 0.1, -0.52, { height: 0.85, rot: 0.9 }),
    good("vase_c", -1.3, -0.46, { height: 0.8, rot: -0.5 }),
    good("basket_fruit", -0.95, 0.28, { width: 0.72, rot: 0.2 }),
    good("basket_grain", 0.05, 0.3, { width: 0.66, rot: -0.5 }),
    good("bread", 1.12, 0.22, { width: 0.4, rot: 0.8, lift: CRATE_TOP }),
    cloth("cloth_c", -1.5, 1.5),
    cloth("cloth_a", 1.5, 1.15),
  ],
  // the second east stall: a mix
  [
    good("vase_c", 1.3, -0.46, { height: 0.85, rot: 0.3 }),
    good("amphora_a", -1.3, -0.5, { height: 0.9, rot: -0.7 }),
    good("vase_a", -0.5, -0.5, { height: 0.62, rot: 0.4 }),
    good("basket_fruit", 0.25, 0.3, { width: 0.7, rot: -0.3 }),
    good("basket_grain", -0.95, 0.3, { width: 0.64, rot: 0.9 }),
    cloth("cloth_b", -1.5, 1.3),
    cloth("cloth_c", 1.5, 1.5),
  ],
];
/** The crates the bread rides on: the town's own crate model, inside the stall (the pack has none). */
export const STALL_CRATES: { booth: number; lx: number; lz: number; rot: number }[] = [{ booth: 1, lx: 1.12, lz: 0.22, rot: 0.8 }];

const marketPieces = (): DressingPiece[] =>
  STOCK.flatMap((items, booth) =>
    items.map((s, i): DressingPiece => {
      const [x, z] = boothPoint(booth, s.lx, s.lz);
      const rot = MARKET_BOOTHS[booth]![2];
      const cl = s.asset.startsWith("cloth");
      return {
        id: `stall-${booth}-${s.asset}-${i}`, site: "market", asset: s.asset, frame: "world", x, z,
        rotY: rot + (s.rot ?? 0), width: s.width, height: s.height, lift: s.lift,
        groundAt: [MARKET_BOOTHS[booth]![0], MARKET_BOOTHS[booth]![1]], goods: !cl, booth,
      };
    }),
  );

export const DRESSING_PIECES: DressingPiece[] = [
  {
    id: "athena", site: "temple", asset: "athena", frame: "world",
    x: T.position[0] + ATHENA_STATUE.localX, z: T.position[1], rotY: Math.PI / 2, height: ATHENA_STATUE.height,
    lift: T.podiumY, groundAt: [T.position[0], T.position[1]],
  },
  {
    id: "augustus-podest", site: "forum", asset: "podest", frame: "world",
    x: AUGUSTUS_SPOT[0], z: AUGUSTUS_SPOT[1], rotY: toWorldRot(...AUGUSTUS_SPOT), height: AUGUSTUS_PODEST_HEIGHT,
    footprint: { r: AUGUSTUS_RADIUS },
  },
  {
    id: "augustus", site: "forum", asset: "augustus", frame: "world",
    x: AUGUSTUS_SPOT[0], z: AUGUSTUS_SPOT[1], rotY: toWorldRot(...AUGUSTUS_SPOT), height: AUGUSTUS_HEIGHT, lift: AUGUSTUS_PODEST_HEIGHT,
  },
  {
    // the domus's own frame (floor at local y 0); its pedestal is built with the house (homeHouse.ts)
    id: "putto", site: "garden", asset: "putto", frame: "home",
    x: PERISTYLE_PUTTO.x, z: PERISTYLE_PUTTO.z, rotY: PERISTYLE_PUTTO.rotY, height: PERISTYLE_PUTTO.height, lift: PERISTYLE_PUTTO.plinth + 0.015,
  },
  ...marketPieces(),
];

export interface DressingFootprint { id: string; x: number; z: number; r: number }
/** Collision circles for the free-standing pieces (the others stand on something already solid). */
export const dressingFootprints = (): DressingFootprint[] =>
  DRESSING_PIECES.flatMap((p) => (p.footprint ? [{ id: p.id, x: p.x, z: p.z, r: p.footprint.r }] : []));
