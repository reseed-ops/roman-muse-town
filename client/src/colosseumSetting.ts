// Task 85: the Colosseum's setting. The pack's amphitheatre (slimmed by
// tools/idyllic/slim.py) replaces the plain white shell, and a few pieces
// from the same pack dress its basin: a stair at the road's end with a pair
// of marble statues, houses and an insula on the basin's rim, and the
// pack's eagle banners. Pure data (no three.js) so the layout is testable;
// townScene.ts loads and places it.

/** The pack's pieces, in the `idyllic` asset pack (client/src/assets/idyllic/). */
export type SettingAsset =
  | "colosseum" | "stairs" | "house_a" | "house_b" | "insula"
  | "statue_soldier" | "statue_general" | "podest" | "banner";

export const SETTING_FILES: Record<SettingAsset, string> = {
  colosseum: "idyllic/colosseum.glb",
  stairs: "idyllic/stairs.glb",
  house_a: "idyllic/house_a.glb",
  house_b: "idyllic/house_b.glb",
  insula: "idyllic/insula.glb",
  statue_soldier: "idyllic/statue_soldier.glb",
  statue_general: "idyllic/statue_general.glb",
  podest: "idyllic/podest.glb",
  banner: "idyllic/banner.glb",
};

/** What the build chose for the slimmed building (measured, then rounded up). The
 *  pack's own mesh is 518,560 triangles and 29.5 MB; this is the ceiling the test holds. */
export const COLOSSEUM_BUDGET = { maxTriangles: 66_000, maxBytes: 5_500_000 } as const;
/** maxBytes was 5,000,000 until Task 93 restored the pack's normal and mask maps (4.73 MB to 5.30 MB). */
/** The source mesh, for the record: 532,584 polygons as imported, 29,456,696 bytes as GLB. */
export const COLOSSEUM_SOURCE = { polygons: 532_584, glbBytes: 29_456_696 } as const;

/** The Colosseum's basin, as town.ts cuts it (the cut itself stays in town.ts). */
export const COLOSSEUM_PLACEMENT = { x: 40, z: 13, rotY: -0.35, width: 16 } as const;
/** The stone roofline's height over the model's width (measured on the slimmed GLB: 22.65 m of 42.0 m;
 *  the masts and their ropes rise to 28.7 m above it). The phoenix perches on the roof, not the masts. */
export const COLOSSEUM_ROOF_RATIO = 22.65 / 42.0;
/** The solid ring's collision radius (half the placed width). */
export const COLOSSEUM_RING_RADIUS = COLOSSEUM_PLACEMENT.width / 2;

export interface SettingPiece {
  id: string;
  asset: SettingAsset;
  x: number;
  z: number;
  rotY: number;
  /** Scale by one of these (groundModel), as for every other model in the town. */
  width?: number;
  height?: number;
  /** Squash the placed model vertically (the stair's rise is eased to the plinth). */
  squashY?: number;
  /** Lift above the terrain (a statue stands on its podest). */
  lift?: number;
  /** Ground footprint for collision: a circle, or a box (half extents, in the piece's own frame). */
  footprint?: { r: number } | { hx: number; hz: number };
  /** A vexillum pole under a banner: the pole's height (the banner hangs from its top). */
  pole?: number;
}

const C = COLOSSEUM_PLACEMENT;
const rad = (deg: number): number => (deg * Math.PI) / 180;
/** A point `r` out from the Colosseum's centre on bearing `deg` (0 = east, 90 = south), shifted `lateral` along the tangent. */
export const around = (r: number, deg: number, lateral = 0): [number, number] => {
  const a = rad(deg);
  return [C.x + r * Math.cos(a) - lateral * Math.sin(a), C.z + r * Math.sin(a) + lateral * Math.cos(a)];
};
/** rotY for a model whose front is local +z so that it faces the Colosseum's centre from bearing `deg`. */
export const facingCentre = (deg: number): number => Math.atan2(-Math.cos(rad(deg)), -Math.sin(rad(deg)));
/** ...and so that it faces outward, away from the centre. */
export const facingOut = (deg: number): number => facingCentre(deg) + Math.PI;

/** The road's end (town.ts STREETS: the east lane stops at 31.5, 7.4, outside the ring). */
export const ROAD_END: [number, number] = [31.5, 7.4];

/** The seek spot "behind the Colosseum steps" (town.ts SEEK_SPOTS): the stair stands just clear of it. */
export const STEPS_SEEK_SPOT: [number, number] = [31.5, 17];
/** The grand stair stands on the ring's west face midway between the road's end and the seek spot
 *  (bearings 213 and 155 from the centre), and its high end meets the Colosseum's plinth. */
export const STAIR_BEARING = 184;
const STAIR_R = 9.3;
const STAT_R = 9.0;

const [sx, sz] = around(STAIR_R, STAIR_BEARING);
const [lx, lz] = around(STAT_R, STAIR_BEARING, -2.75);
const [rx, rz] = around(STAT_R, STAIR_BEARING, 2.75);
const [vlx, vlz] = around(9.8, 130);
const [vrx, vrz] = around(9.8, 238);

const house = (id: string, asset: SettingAsset, r: number, deg: number, width: number, footprint: SettingPiece["footprint"]): SettingPiece => {
  const [x, z] = around(r, deg);
  return { id, asset, x, z, rotY: facingCentre(deg), width, footprint };
};

export const SETTING_PIECES: SettingPiece[] = [
  { id: "stair", asset: "stairs", x: sx, z: sz, rotY: facingCentre(STAIR_BEARING) + Math.PI, width: 4.0, squashY: 0.55, footprint: { hx: 2.0, hz: 1.7 } },
  { id: "podest-left", asset: "podest", x: lx, z: lz, rotY: facingOut(STAIR_BEARING), height: 0.9, footprint: { r: 0.5 } },
  { id: "podest-right", asset: "podest", x: rx, z: rz, rotY: facingOut(STAIR_BEARING), height: 0.9, footprint: { r: 0.5 } },
  { id: "statue-left", asset: "statue_soldier", x: lx, z: lz, rotY: facingOut(STAIR_BEARING), height: 2.2, lift: 0.9 },
  { id: "statue-right", asset: "statue_general", x: rx, z: rz, rotY: facingOut(STAIR_BEARING), height: 2.2, lift: 0.9 },
  { id: "vexillum-left", asset: "banner", x: vlx, z: vlz, rotY: facingOut(130), width: 1.1, pole: 3.6, footprint: { r: 0.2 } },
  { id: "vexillum-right", asset: "banner", x: vrx, z: vrz, rotY: facingOut(238), width: 1.1, pole: 3.6, footprint: { r: 0.2 } },
  house("house-north", "house_a", 19, -72, 6.0, { hx: 2.6, hz: 2.1 }),
  house("house-east", "house_b", 20, -18, 6.0, { hx: 2.6, hz: 2.6 }),
  house("insula-south-east", "insula", 21, 38, 4.2, { hx: 1.8, hz: 1.8 }),
];

export interface SettingFootprint { id: string; x: number; z: number; rot: number; foundation: boolean }
/** Collision shapes for the pieces that have one: a circle (r) or a box (hx, hz) at rotation rot. */
export function settingFootprints(): ((SettingFootprint & { r: number }) | (SettingFootprint & { hx: number; hz: number }))[] {
  return SETTING_PIECES.flatMap((p) => {
    const fp = p.footprint;
    if (!fp) return [];
    const base = { id: p.id, x: p.x, z: p.z, rot: p.rotY, foundation: p.asset.startsWith("house") || p.asset === "insula" };
    return [{ ...base, ...fp }];
  });
}
