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

export interface Voyage {
  kind: ShipKind;
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
  return { kind, dir: morning ? 1 : -1, laneZ, duration, elapsed: Math.max(0, Math.min(1, startAt)) * duration };
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
