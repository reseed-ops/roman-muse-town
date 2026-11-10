// Ships on the sea (Task 50): Roman ships passing below the sea cliff,
// a quiet sight from the headland, never a game. One ship at a time,
// chosen by chance as it appears: about 3 in 4 the Ancient trade ship,
// close enough to read its sail, about 1 in 4 the trireme, farther out
// and slower, so a warship feels rare. Ships run east in the morning
// and west after noon, on a gentle arc rather than a ruled line, and
// they come out of the haze and go back into it.
//
// Pure planning here (which ship, which lane, where it is along it,
// how long until the next), so the timing is testable off the scene;
// townScene loads the models, places them and rocks them on the swell.
import { CLIFF } from "./seaCliff";

export type ShipKind = "trade" | "trireme";

export interface ShipSpec {
  /** Hull length in metres, bow to stern (the model is scaled to it). */
  length: number;
  /** How far south of the headland's centre the lane runs (metres). */
  laneOut: number;
  /** Half the lane's east-west run; it starts and ends in the haze. */
  halfRun: number;
  /** Speed through the water, metres a second. */
  speed: number;
  /** How far the keel sits below the sea's surface (metres, after scaling). */
  sink: number;
  /** How deep the lane bows toward the headland at its middle (metres). */
  arc: number;
}

// The town's clear-weather fog runs 95 to 235 metres. The trade ship's
// lane lies about 65 m from a viewer at the bench: crisp, sail and all.
// The trireme's lies about 125 m out, already a little hazed, and both
// runs begin and end where the fog swallows the hull.
export const SHIPS: Record<ShipKind, ShipSpec> = {
  // The Kyrenia merchantman was about 14 m long.
  trade: { length: 14, laneOut: 60, halfRun: 150, speed: 1.6, sink: 1.1, arc: 10 },
  // A trireme ran about 35 m; this one rows slowly, far out.
  trireme: { length: 34, laneOut: 122, halfRun: 210, speed: 1.15, sink: 2.6, arc: 16 },
};

/** About 3 in 4 a trade ship, about 1 in 4 a trireme. */
export const TRIREME_CHANCE = 0.25;

export function pickShip(r: number): ShipKind {
  return r < TRIREME_CHANCE ? "trireme" : "trade";
}

/**
 * How a pass looks, beyond which hull it is. The trade ship's linen sail
 * is dyed by chance (undyed most often, else ochre, rust or a faded
 * madder; the colour multiplies the linen texture). The trireme sails in
 * one of the pack's two liveries: red-and-white striped sails with red
 * low on the hull, or plain linen sails with the red at the top strakes.
 */
export const SAIL_DYES = [0xffffff, 0xffffff, 0xd9a441, 0xb85a3c, 0xc98f86] as const;
export type TriremeLivery = "striped" | "plain";

export function pickSailDye(r: number): number {
  return SAIL_DYES[Math.min(SAIL_DYES.length - 1, Math.floor(r * SAIL_DYES.length))]!;
}
export function pickLivery(r: number): TriremeLivery {
  return r < 0.5 ? "striped" : "plain";
}

export interface Voyage {
  kind: ShipKind;
  /** The trade ship's sail colour (white is undyed); the trireme ignores it. */
  dye: number;
  /** The trireme's livery; the trade ship ignores it. */
  livery: TriremeLivery;
  /** +1 sails east (+X), -1 sails west. */
  dir: 1 | -1;
  /** The lane's own small offset out to sea, so no two passes are alike. */
  laneZ: number;
  /** Seconds the whole run takes. */
  duration: number;
  /** Seconds into the run (it can start part way, already in view). */
  elapsed: number;
}

/**
 * Plan one pass. `morning` is the sun still in the east: ships run east
 * then, west after noon. `rand` is any 0..1 source (Math.random in the
 * scene, fixed numbers in tests). `startAt` (0..1) starts it part way.
 */
export function planVoyage(kind: ShipKind, morning: boolean, rand: () => number, startAt = 0): Voyage {
  const spec = SHIPS[kind];
  const laneZ = CLIFF.head.z + spec.laneOut + (rand() - 0.5) * 16;
  const duration = (spec.halfRun * 2) / spec.speed;
  const dye = pickSailDye(rand());
  const livery = pickLivery(rand());
  return { kind, dye, livery, dir: morning ? 1 : -1, laneZ, duration, elapsed: Math.max(0, Math.min(1, startAt)) * duration };
}

export interface ShipPose {
  x: number;
  z: number;
  /** Rotation about Y for a model whose bow is +X. */
  heading: number;
}

/** Where a voyage's ship is, and which way it faces, at progress p (0..1). */
export function voyagePose(v: Voyage, p: number): ShipPose {
  const spec = SHIPS[v.kind];
  const u = Math.max(0, Math.min(1, p));
  const x = v.dir * spec.halfRun * (2 * u - 1);
  // The arc bows the lane in toward the headland at its middle.
  const z = v.laneZ - spec.arc * Math.sin(Math.PI * u);
  const dx = v.dir * spec.halfRun * 2;
  const dz = -spec.arc * Math.PI * Math.cos(Math.PI * u);
  // A model with its bow on +X faces (cos h, -sin h) in (x, z) after rotation.y = h.
  return { x, z, heading: Math.atan2(-dz, dx) };
}

export interface SeaWeather {
  nightMix: number;
  storm: boolean;
  fog: boolean;
}

/** No ship puts out in a storm, and none is seen in a fog bank. */
export function shipsSail(w: SeaWeather): boolean {
  return !w.storm && !w.fog;
}

/** Seconds of empty sea before the next ship: a minute or so by day, twice that at night. */
export function nextGap(w: SeaWeather, r: number): number {
  const day = 25 + r * 50;
  return day * (1 + w.nightMix);
}

/** Is the viewer out on the peninsula, where the sea can be seen at all? */
export function watchingSea(viewZ: number): boolean {
  return viewZ > CLIFF.walkFromZ - 4;
}

/**
 * Fishing boats: the town's own small boat (the lake's), one or two of
 * them riding at anchor in the water below the headland, inside the
 * ships' lanes, by day. Each spot is [x, z]; they swing slowly about
 * their anchors.
 */
export const FISHING_SPOTS: readonly (readonly [number, number])[] = [
  [-24, 136],
  [20, 141],
  [33, 127],
  [-36, 128],
];
/** The fishing boat's length, metres (the lake's boat is 3.6 m; a sea boat is a little longer). */
export const FISHING_BOAT_LENGTH = 4.4;

/** Fishermen are out by day and at dusk, not at night, nor in a storm or fog. */
export function fishingOut(w: SeaWeather): boolean {
  return shipsSail(w) && w.nightMix < 0.55;
}

/** Which spots have a boat this time he comes out: one or two, by chance. */
export function pickFishingSpots(rand: () => number): (readonly [number, number])[] {
  const count = rand() < 0.4 ? 1 : 2;
  const pool = [...FISHING_SPOTS];
  const out: (readonly [number, number])[] = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length) % pool.length, 1)[0]!);
  return out;
}
