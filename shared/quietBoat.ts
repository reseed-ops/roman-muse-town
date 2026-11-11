// A quiet boat on the lake (Task 57, agreed Nov 10, 2026): the small boat
// that waits at the lake's edge, Gaius and Aelia aboard together, rowed
// out, then left to drift, facing each other, nowhere to be. No timer
// runs and no clock ends it: the moment ends only when he chooses to row
// back. Pure rules, shared by the client (which runs the moment) and the
// tests; nothing here touches the tender-only gate or the affection
// gates, and her lines are held to the gate at every rank by a test.

/** He must have rowed this far from the mooring before the drift is offered. */
export const QUIET_BOAT_MIN_OUT = 3.6;
/** Never in a visit's opening minutes (the same grace as the night). */
export const QUIET_BOAT_VISIT_GRACE_MS = 5 * 60 * 1000;
/** The drift's speed in metres a second: barely moving. */
export const DRIFT_SPEED = 0.16;
/** The hull stays inside this fraction of the water's ellipse. */
export const DRIFT_RIM = 0.7;

export const DRIFT_PROMPT = "Let the boat drift";
export const ROW_BACK_PROMPT = "Row back";

/** Her words as the oars come in. */
export const QUIET_BOAT_BEGIN_LINE = "Ship the oars. Let the lake have us for a while.";
/** Her few quiet lines for the drift, said once each, in order, and then only the water. */
export const QUIET_BOAT_LINES = [
  "Look at me, not the shore. There. That's all I wanted.",
  "Nobody is waiting for us out here.",
  "Listen: the water against the hull, and nothing else.",
  "I like how still you are when you're not trying to be.",
  "We can stay as long as the lake lets us. Longer, if it's kind.",
  "Whenever you want to go back, we will. There's no hurry in it.",
];
/** Her word when he takes the oars again. */
export const QUIET_BOAT_RETURN_LINES = [
  "All right. Row us home, love. That was lovely.",
  "Back, then. Thank you for the quiet.",
];

/** Every line she can say in this moment, for the gate's test. */
export const QUIET_BOAT_ALL_LINES = [QUIET_BOAT_BEGIN_LINE, ...QUIET_BOAT_LINES, ...QUIET_BOAT_RETURN_LINES];

/** Weather the boat will not drift in: wet, cold or wild. */
export const QUIET_BOAT_BAD_WEATHER = ["rain", "storm", "snow"] as const;

export interface QuietBoatFacts {
  /** He is in the boat, and she is aboard with him. */
  rowing: boolean;
  museAboard: boolean;
  walking: boolean;
  /** Metres from the mooring. */
  outFromMooring: number;
  /** A drift is already under way. */
  drifting: boolean;
  /** The weather's id, or null when unknown. */
  weather: string | null;
  /** A dream, the summit, a night together or a quest's celebration holds the town. */
  busy: boolean;
  /** A quarrel open or a heavy day: she would not choose the lake, so it is not offered. */
  troubled: boolean;
  /** A visit's start (ms) if a visit is open, and now (ms). */
  visitBeganAt: number | null;
  now: number;
}

/** Why the drift is not offered, or null when it is. */
export function quietBoatBlocked(f: QuietBoatFacts): string | null {
  if (!f.walking || !f.rowing) return "not afloat";
  if (!f.museAboard) return "alone";
  if (f.drifting) return "already drifting";
  if (f.busy) return "busy";
  if (f.weather && (QUIET_BOAT_BAD_WEATHER as readonly string[]).includes(f.weather)) return "weather";
  if (f.troubled) return "troubled";
  if (f.visitBeganAt !== null && f.now - f.visitBeganAt < QUIET_BOAT_VISIT_GRACE_MS) return "visit opening";
  if (f.outFromMooring < QUIET_BOAT_MIN_OUT) return "too near the dock";
  return null;
}

/** The drifting boat's body: where it is, which way it faces, which way it creeps. */
export interface Drift {
  x: number;
  z: number;
  /** The hull's heading (bow direction), swaying a little, never steered. */
  heading: number;
  /** Direction of the creep, radians. */
  dir: number;
}

export interface LakeShape { cx: number; cz: number; rx: number; rz: number }

/** Begin drifting from where the boat lies: the creep continues the way it was heading. */
export function beginDrift(x: number, z: number, heading: number): Drift {
  return { x, z, heading, dir: heading };
}

/** One step of the drift. No input, no end: only a slow creep, a slow turn of
 *  the creep, a small sway of the hull, and the shore turning it gently back. */
export function driftStep(d: Drift, dt: number, t: number, lake: LakeShape): Drift {
  let dir = d.dir + Math.sin(t * 0.05) * 0.03 * dt;
  const nx = d.x + Math.sin(dir) * DRIFT_SPEED * dt;
  const nz = d.z + Math.cos(dir) * DRIFT_SPEED * dt;
  const ex = (nx - lake.cx) / (lake.rx * DRIFT_RIM);
  const ez = (nz - lake.cz) / (lake.rz * DRIFT_RIM);
  const en = Math.hypot(ex, ez);
  let x = nx;
  let z = nz;
  if (en > 1) {
    // Past the rim: held on it.
    x = lake.cx + (ex / en) * lake.rx * DRIFT_RIM;
    z = lake.cz + (ez / en) * lake.rz * DRIFT_RIM;
  }
  if (en > 0.94) {
    // Near the rim the creep bends toward the middle, so the shore turns the boat gently back.
    const toMiddle = Math.atan2(lake.cx - x, lake.cz - z);
    const diff = Math.atan2(Math.sin(toMiddle - dir), Math.cos(toMiddle - dir));
    dir += diff * Math.min(1, 1.2 * dt);
  }
  return { x, z, dir, heading: d.heading + Math.sin(t * 0.11) * 0.004 * dt };
}

/** The seats: he sits in the stern, she in the bow, each turned to the other.
 *  Returns offsets along the heading from the boat's centre and each one's yaw. */
export function boatSeats(heading: number): { him: { along: number; yaw: number }; her: { along: number; yaw: number } } {
  return {
    him: { along: -0.62, yaw: heading },
    her: { along: 0.78, yaw: heading + Math.PI },
  };
}

/** Whether a body at `from` with this yaw faces `to` (within 0.2 rad). */
export function facesAlong(yaw: number, from: number, to: number): boolean {
  const want = to >= from ? 0 : Math.PI;
  const d = Math.atan2(Math.sin(yaw - want), Math.cos(yaw - want));
  return Math.abs(d) < 0.2;
}

/** The moment's small state: the drift, how many of her lines are said. */
export interface QuietBoatState {
  phase: "rowing" | "drifting";
  linesSaid: number;
}
export const QUIET_BOAT_START: QuietBoatState = { phase: "rowing", linesSaid: 0 };

/** Begin the drift if nothing blocks it; otherwise the state is unchanged. */
export function startDrift(s: QuietBoatState, f: QuietBoatFacts): QuietBoatState {
  return quietBoatBlocked(f) === null ? { phase: "drifting", linesSaid: 0 } : s;
}

/** His one way out: he rows back. Nothing else, no clock, ends it. */
export function rowBack(s: QuietBoatState): QuietBoatState {
  return s.phase === "drifting" ? { phase: "rowing", linesSaid: 0 } : s;
}

/** Her next line of the drift, or null once she has said them all (then only quiet). */
export function nextQuietLine(s: QuietBoatState): { line: string | null; state: QuietBoatState } {
  if (s.phase !== "drifting" || s.linesSaid >= QUIET_BOAT_LINES.length) return { line: null, state: s };
  return { line: QUIET_BOAT_LINES[s.linesSaid]!, state: { ...s, linesSaid: s.linesSaid + 1 } };
}

/** The record: a kind and a count, nothing else (kept in the purse's flags). */
export interface QuietBoatRecord { kind: "quiet-boat"; count: number }
export const QUIET_BOAT_COUNT_CAP = 9999;

export function readQuietBoat(raw: unknown): QuietBoatRecord {
  const c = raw && typeof raw === "object" ? (raw as { count?: unknown }).count : 0;
  const n = typeof c === "number" && Number.isFinite(c) ? Math.max(0, Math.min(QUIET_BOAT_COUNT_CAP, Math.floor(c))) : 0;
  return { kind: "quiet-boat", count: n };
}

export function noteQuietBoat(raw: unknown): QuietBoatRecord {
  const r = readQuietBoat(raw);
  return { kind: "quiet-boat", count: Math.min(QUIET_BOAT_COUNT_CAP, r.count + 1) };
}
