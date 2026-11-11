// Aelia's surprises (Task 60): now and then she leads him somewhere he did
// not plan to go, a favourite place of hers, a view or a quiet corner, says
// one short line there, and that is all. She asks; he can follow ("Show
// me") or decline kindly ("Not now"), and a decline costs nothing and is
// never held against him. Rare by design: a cooldown of days, a roll that
// is a pure function of the local day, her mood and the hour of the day.
//
// Pure rules, shared by the client (which runs it) and the tests. Nothing
// here touches the tender-only gate or any affection gate: SURPRISE_RANK is
// a plain number, and every line she says passes shared/tenderGate.ts at
// every rank (a test). It is exclusive with every moment: tender moments
// (shared/tenderMoments.ts), the quiet boat (shared/quietBoat.ts), the
// night together (shared/nightTogether.ts), quest celebrations, the
// wedding, the phoenix's visit and the rest, through `busy`, which the
// shell also feeds to each of those, so neither can start inside the other.
// The record is kinds (the places) and counts, nothing else: no date, no
// streak, no currency.
import { hashDay } from "./phoenixVisit";

/** Comfortable enough to be led: well below the kiss's rank, nothing intimate in it. */
export const SURPRISE_RANK = 3;
/** At least this many local days between one surprise offered and the next (a decline counts). */
export const SURPRISE_COOLDOWN_DAYS = 3;
/** About one day in this many is a day she might. */
export const SURPRISE_ONE_IN = 2;
/** Never in a visit's opening minutes (the same grace as the night). */
export const SURPRISE_VISIT_GRACE_MS = 5 * 60 * 1000;
/** Not soon after a tender moment (ms). */
export const SURPRISE_AFTER_TENDER_MS = 45 * 60 * 1000;

export const SURPRISE_SPOTS = ["athena-step", "cliff-bench", "lake-dock", "forum-garden"] as const;
export type SurpriseSpot = (typeof SURPRISE_SPOTS)[number];
export const isSurpriseSpot = (v: unknown): v is SurpriseSpot => typeof v === "string" && (SURPRISE_SPOTS as readonly string[]).includes(v);

export interface SurpriseSpotInfo {
  id: SurpriseSpot;
  /** Where she leads him (the town's x, z); the client's test pins these to the town's own places. */
  at: readonly [number, number];
  /** Local hours (from inclusive, to exclusive) when she loves it. */
  hours: readonly [number, number];
  /** It is a place for fair weather only. */
  fairOnly: boolean;
  offers: readonly string[];
  arrivals: readonly string[];
}

export const SURPRISE_INFO: Record<SurpriseSpot, SurpriseSpotInfo> = {
  "athena-step": {
    id: "athena-step",
    at: [-17.0, 8.0],
    hours: [8, 19],
    fairOnly: false,
    offers: [
      "There's a place I'd like you to see. It isn't on any list. Come with me?",
      "Will you come somewhere with me? I'll show you the step where I sit and think.",
    ],
    arrivals: [
      "Here. Athena's step. I come to sit with the olives and not be anybody for a while.",
      "This is mine, the quiet corner by the owl's goddess. I wanted you to know it.",
    ],
  },
  "cliff-bench": {
    id: "cliff-bench",
    at: [1.2, 116.4],
    hours: [6, 20],
    fairOnly: true,
    offers: [
      "I want to show you something. It's a walk, and it's worth it. Come with me?",
      "Come with me, love? There's a view I keep for the best days.",
    ],
    arrivals: [
      "There. The whole sea, and nobody in front of us. I kept it for you.",
      "Look how far it goes. I come here when I want the world to be big.",
    ],
  },
  "lake-dock": {
    id: "lake-dock",
    at: [-9.9, -31.05],
    hours: [6, 21],
    fairOnly: false,
    offers: [
      "Walk with me to the water? I've been wanting to show you the lake from the dock.",
      "I know where the light is lovely right now. Come with me?",
    ],
    arrivals: [
      "Here. The water says everything better than I could.",
      "Just this: the lake, the dock, and you. That's the surprise.",
    ],
  },
  "forum-garden": {
    id: "forum-garden",
    at: [-10.9, 5.0],
    hours: [9, 18],
    fairOnly: false,
    offers: [
      "There's a corner of the garden I love. Come and see it with me?",
      "Come with me, centurion? Not far. I'd like to show you a quiet place.",
    ],
    arrivals: [
      "Between Lucretia and the olives. It's the quietest place in the town.",
      "Here. Nothing happens here, and I'm very fond of it.",
    ],
  },
};

export const SURPRISE_YES = "Show me";
export const SURPRISE_NO = "Not now";
/** Her words as she sets off. */
export const SURPRISE_SETOFF_LINE = "Come on, then. This way.";
/** Her kind answer to a no. */
export const SURPRISE_DECLINED_LINES = [
  "Of course. Another day. It will keep.",
  "No trouble at all. We'll go another time.",
];

/** Every line she can say in this, for the gate's tests. */
export const SURPRISE_LINES: string[] = [
  SURPRISE_YES,
  SURPRISE_NO,
  SURPRISE_SETOFF_LINE,
  ...SURPRISE_DECLINED_LINES,
  ...SURPRISE_SPOTS.flatMap((s) => [...SURPRISE_INFO[s].offers, ...SURPRISE_INFO[s].arrivals]),
];

// --- The record: kinds and counts, nothing else ------------------------

export const SURPRISE_COUNT_CAP = 9999;
export interface SurpriseRecord { kind: "aelia-surprises"; counts: Partial<Record<SurpriseSpot, number>> }

export function readSurprises(raw: unknown): SurpriseRecord {
  const src = raw && typeof raw === "object" ? (raw as { counts?: unknown }).counts : null;
  const counts: Partial<Record<SurpriseSpot, number>> = {};
  if (src && typeof src === "object") {
    for (const k of SURPRISE_SPOTS) {
      const c = (src as Record<string, unknown>)[k];
      if (typeof c === "number" && Number.isFinite(c) && c >= 1) counts[k] = Math.min(SURPRISE_COUNT_CAP, Math.floor(c));
    }
  }
  return { kind: "aelia-surprises", counts };
}

export function noteSurprise(raw: unknown, spot: SurpriseSpot): SurpriseRecord {
  const r = readSurprises(raw);
  return { kind: "aelia-surprises", counts: { ...r.counts, [spot]: Math.min(SURPRISE_COUNT_CAP, (r.counts[spot] ?? 0) + 1) } };
}

// --- The client's own pacing memory (never sent to the server) ---------

export interface SurpriseMemory {
  /** The local day she last asked (a no counts), and which place. */
  lastDay: string | null;
  lastSpot: SurpriseSpot | null;
}
export const EMPTY_SURPRISE_MEMORY: SurpriseMemory = { lastDay: null, lastSpot: null };

export function readSurpriseMemory(raw: unknown): SurpriseMemory {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SURPRISE_MEMORY };
  const o = raw as Record<string, unknown>;
  return {
    lastDay: typeof o.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.lastDay) ? o.lastDay : null,
    lastSpot: isSurpriseSpot(o.lastSpot) ? o.lastSpot : null,
  };
}
export const rememberSurprise = (spot: SurpriseSpot, today: string): SurpriseMemory => ({ lastDay: today, lastSpot: spot });

// --- The rules ----------------------------------------------------------

export interface SurpriseFacts {
  rank: number;
  walking: boolean;
  /** She is beside him (following), in the town. */
  together: boolean;
  /** Any moment holds the town: a dream, the summit, a night, the boat, a tender moment, a quest's celebration, the wedding, the phoenix's visit, a bath, fishing, a dance, a seat, an open conversation or another walk of hers. */
  busy: boolean;
  /** A quarrel or a heavy day: not her mood. */
  troubled: boolean;
  weather: string | null;
  /** Local hour 0..23, and the sky says night. */
  hour: number;
  night: boolean;
  /** His position, to skip a place he is already at. */
  at: readonly [number, number];
  today: string;
  now: number;
  visitBeganAt: number | null;
  /** The pacing memory's last tender moment time (ms), 0 if none. */
  lastTenderAt: number;
  memory: SurpriseMemory;
}

const BAD_WEATHER = ["rain", "storm", "snow"];
const dayNum = (d: string): number => {
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, dd) / 86400000);
};

/** Is this local day one she might surprise him? Deterministic, same on every device. */
export function surpriseRollsDay(day: string): boolean {
  return hashDay(`surprise:${day}`) % SURPRISE_ONE_IN === 0;
}

/** Why no surprise is offered at all now, or null. */
export function surpriseBlocked(f: SurpriseFacts): string | null {
  if (f.rank < SURPRISE_RANK) return "rank";
  if (!f.walking || !f.together) return "not together";
  if (f.busy) return "busy";
  if (f.troubled) return "troubled";
  if (f.night) return "night";
  if (f.visitBeganAt !== null && f.now - f.visitBeganAt < SURPRISE_VISIT_GRACE_MS) return "visit opening";
  if (f.lastTenderAt && f.now >= f.lastTenderAt && f.now - f.lastTenderAt < SURPRISE_AFTER_TENDER_MS) return "after a tender moment";
  if (!surpriseRollsDay(f.today)) return "not her day";
  if (f.memory.lastDay && dayNum(f.today) - dayNum(f.memory.lastDay) < SURPRISE_COOLDOWN_DAYS) return "cooldown";
  return null;
}

/** Does this place suit this hour, weather and spot of his? */
export function surpriseSpotFits(spot: SurpriseSpot, f: SurpriseFacts): boolean {
  const s = SURPRISE_INFO[spot];
  if (f.hour < s.hours[0] || f.hour >= s.hours[1]) return false;
  if (s.fairOnly && f.weather && BAD_WEATHER.includes(f.weather)) return false;
  if (Math.hypot(f.at[0] - s.at[0], f.at[1] - s.at[1]) < 12) return false;
  return true;
}

/** The place she would lead him to now, or null: a rotation seeded by the day, never the same place twice running. */
export function nextSurpriseSpot(f: SurpriseFacts): SurpriseSpot | null {
  if (surpriseBlocked(f)) return null;
  const start = hashDay(`spot:${f.today}`) % SURPRISE_SPOTS.length;
  for (let i = 0; i < SURPRISE_SPOTS.length; i++) {
    const spot = SURPRISE_SPOTS[(start + i) % SURPRISE_SPOTS.length]!;
    if (spot === f.memory.lastSpot) continue;
    if (surpriseSpotFits(spot, f)) return spot;
  }
  return null;
}
