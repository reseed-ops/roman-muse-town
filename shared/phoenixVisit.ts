// The phoenix's rare visit (Task 60): she perches near Athena's temple and
// stays a while when the town is quiet and the two of them are simply
// there. Nothing is chased: no quest, no moment, no celebration, no open
// director visit, nothing to collect and nothing to earn. The roll is a
// deterministic function of the local day (the same answer on every
// device), with a cooldown of days. Only the client's own pacing memory
// (the day of the last visit) is kept, in the browser; the town's record is
// untouched.

/** About one day in this many is a day she might come. */
export const PHOENIX_VISIT_ONE_IN = 7;
/** At least this many local days between two visits. */
export const PHOENIX_COOLDOWN_DAYS = 5;
/** How long she stays, at most, once she is perched (ms). */
export const PHOENIX_STAY_MS = 4 * 60 * 1000;
/** How near the perch the two of them must be (metres). */
export const PHOENIX_NEAR = 16;
/** Quiet is held this long before she comes (ms). */
export const PHOENIX_QUIET_MS = 8000;
/** Never in a visit's opening minutes. */
export const PHOENIX_VISIT_GRACE_MS = 5 * 60 * 1000;

/** A deterministic 32-bit hash of a string (FNV-1a). */
export function hashDay(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Is this local day (YYYY-MM-DD) one she might come? Same answer every time. */
export function phoenixRollsDay(day: string): boolean {
  return hashDay(`phoenix:${day}`) % PHOENIX_VISIT_ONE_IN === 0;
}

const dayNum = (d: string): number => {
  const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, dd) / 86400000);
};

export interface PhoenixVisitFacts {
  /** The phoenix has already come to the town (the story's arrival happened). */
  arrived: boolean;
  /** Daylight, and the weather's id. */
  daylight: boolean;
  weather: string | null;
  walking: boolean;
  /** She is walking beside him. */
  together: boolean;
  /** Both within PHOENIX_NEAR of the perch. */
  nearPerch: boolean;
  /** A dream, the summit, a night, a boat, a tender moment, a surprise, a quest celebration, the wedding, a bath, fishing, a dance, a seat, or an open conversation. */
  busy: boolean;
  troubled: boolean;
  /** A director's visit is open (it started at this time), or null. */
  visitBeganAt: number | null;
  now: number;
  today: string;
  /** The local day of the last visit, or null. */
  lastVisitDay: string | null;
}

/** Why she does not come now, or null when she may. */
export function phoenixVisitBlocked(f: PhoenixVisitFacts): string | null {
  if (!f.arrived) return "not yet arrived";
  if (!f.daylight) return "night";
  if (f.weather === "rain" || f.weather === "storm" || f.weather === "snow" || f.weather === "fog") return "weather";
  if (!f.walking || !f.together) return "not together";
  if (!f.nearPerch) return "far from the perch";
  if (f.busy) return "busy";
  if (f.troubled) return "troubled";
  if (f.visitBeganAt !== null) return "a visit is open";
  if (!phoenixRollsDay(f.today)) return "not her day";
  if (f.lastVisitDay) {
    if (f.lastVisitDay === f.today) return "already today";
    if (dayNum(f.today) - dayNum(f.lastVisitDay) < PHOENIX_COOLDOWN_DAYS) return "cooldown";
  }
  return null;
}

/** Her one quiet line when she settles; nothing else is said. */
export const PHOENIX_VISIT_LINE = "Look, love. She's come to sit with us. Don't move, and she'll stay a while.";
