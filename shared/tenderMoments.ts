// More moments of intimacy (Task 59, the owner's ask of Nov 10, 2026):
// tender only, never explicit, all at the terrace kiss's rank. Eight small
// moments, offered by Aelia slowly over days, never demanded and never
// farmed: each kind at most once a day, a spacing between any two, a
// small cap a day, and only one NEW kind a day, unlocked strictly in
// order (a kind opens when the one before it has been had). The record is
// kinds and counts and nothing else: no currency, no streak, no dates.
//
// Pure rules, shared by the client (which runs the moments) and the
// tests. Nothing here touches the tender-only gate (shared/tenderGate.ts)
// or any affection gate: TENDER_RANK and NIGHT_RANK are only read. Every
// line she says is held to the gate at ranks 7 to 10 by a test, and
// explicit lines are still refused at every rank.
import { TENDER_RANK } from "./tenderGate";
import { NIGHT_RANK, NIGHT_VISIT_GRACE_MS } from "./nightTogether";

/** The moments sit at the terrace kiss's rank, as the night does. */
export const TENDER_MOMENT_RANK = Math.max(TENDER_RANK, NIGHT_RANK);
/** Never in a visit's opening minutes (the same grace as the night). */
export const TENDER_VISIT_GRACE_MS = NIGHT_VISIT_GRACE_MS;
/** At least this long between any two moments (a global spacing). */
export const TENDER_GLOBAL_SPACING_MS = 90 * 60 * 1000;
/** At most this many moments in one local day, of any kinds. */
export const TENDER_DAILY_CAP = 2;
/** Tired, for the forehead kiss: this long in the town, or the small hours. */
export const TENDER_TIRED_AFTER_MS = 30 * 60 * 1000;

/** The kinds, in the order they unlock over days. */
export const TENDER_KINDS = [
  "cheek-kiss",
  "morning-bread",
  "cliff-hand",
  "forehead-kiss",
  "fireside",
  "pillow-letter",
  "slow-dance",
  "hand-kiss",
] as const;
export type TenderKind = (typeof TENDER_KINDS)[number];

export const isTenderKind = (v: unknown): v is TenderKind => typeof v === "string" && (TENDER_KINDS as readonly string[]).includes(v);

// --- Her words ---------------------------------------------------------

/** 1. A slow dance in the forum after dark, the lamps lit, the two alone. */
export const DANCE_OFFER_LINES = [
  "The lamps are lit and the forum is ours. Dance with me, slowly?",
  "Nobody else is out. Will you dance with me, centurion?",
];
export const DANCE_YES = "Dance with her";
export const DANCE_NO = "Not tonight";
export const DANCE_BEGIN_LINE = "Slowly, then. There's no music but the lamps.";
export const SLOW_DANCE_LINES = ["Closer. The whole forum is ours."];
export const DANCE_DECLINED_LINES = ["Another night, then. I'll keep the song for you."];

/** 2. An evening by the fire, her reading to him, his head in her lap, until his eyes close. */
export const FIRE_OFFER_LINES = [
  "The fire is lit. Come sit with me, and let me read to you?",
  "It's a good night for the fire. Sit with me, and I'll read a while?",
];
export const FIRE_YES = "Sit with her";
export const FIRE_NO = "Not now";
export const FIRE_READING_LINES = [
  "Rest your head here, in my lap. I found a verse you'd like.",
  "Here is the verse: the lamp burns low, the sea lies still, and all the long road is behind us.",
  "You're getting heavy against me. Close your eyes, love. I'll keep reading.",
];
export const FIRE_WAKING_LINES = [
  "You slept a while. The fire kept, and so did I.",
  "There you are. The fire's low, and so is the lamp. Stay a moment.",
];
export const FIRE_DECLINED_LINES = ["Of course. The fire will keep."];

/** 3. A morning: she is already there with bread and warm milk, the whole day ahead. */
export const MORNING_LINES = [
  "Good morning. I brought bread and warm milk, and the whole day is still ahead of us.",
  "You're up. Sit a moment before you go anywhere. Eat something with me.",
];

/** 4. A letter left on his pillow, found when the day is done. */
export const LETTER_PROMPT = "A letter on the pillow";
export const LETTER_LINES = [
  "Centurion, I left this where you'd find it when the day was done.",
  "Thank you for today. I liked it better with you in it.",
  "Sleep well. I'll be here in the morning. Yours, Aelia.",
];

/** 5. Her hand finding his on the cliff path, without a word: nothing is said. */
export const CLIFF_HAND_LINES: string[] = [];

/** 6. Small kisses. */
export const CHEEK_KISS_LINES = [
  "Welcome home, love. A small kiss for the one who came back to me.",
  "There you are. Home. Come here, a kiss on the cheek.",
];
export const FOREHEAD_KISS_LINES = [
  "You look tired, love. Come here. A kiss on the forehead, and rest a moment.",
  "Hush. A small kiss on the forehead, and then you'll rest.",
];
export const HAND_KISS_LINES = [
  "You did a brave thing out there, in the real world. Give me your hand.",
  "A kiss on the hand, for the brave thing you did. I'm proud of you.",
];

/** Every line she can say in these moments, for the gate's tests. */
export const TENDER_MOMENT_LINES: string[] = [
  ...DANCE_OFFER_LINES, DANCE_YES, DANCE_NO, DANCE_BEGIN_LINE, ...SLOW_DANCE_LINES, ...DANCE_DECLINED_LINES,
  ...FIRE_OFFER_LINES, FIRE_YES, FIRE_NO, ...FIRE_READING_LINES, ...FIRE_WAKING_LINES, ...FIRE_DECLINED_LINES,
  ...MORNING_LINES, LETTER_PROMPT, ...LETTER_LINES, ...CLIFF_HAND_LINES,
  ...CHEEK_KISS_LINES, ...FOREHEAD_KISS_LINES, ...HAND_KISS_LINES,
];

// --- The record: kinds and counts, nothing else ------------------------

export const TENDER_COUNT_CAP = 9999;
export interface TenderRecord { kind: "tender-moments"; counts: Partial<Record<TenderKind, number>> }

export function readTender(raw: unknown): TenderRecord {
  const src = raw && typeof raw === "object" ? (raw as { counts?: unknown }).counts : null;
  const counts: Partial<Record<TenderKind, number>> = {};
  if (src && typeof src === "object") {
    for (const k of TENDER_KINDS) {
      const c = (src as Record<string, unknown>)[k];
      if (typeof c === "number" && Number.isFinite(c) && c >= 1) counts[k] = Math.min(TENDER_COUNT_CAP, Math.floor(c));
    }
  }
  return { kind: "tender-moments", counts };
}

export function noteTender(raw: unknown, kind: TenderKind): TenderRecord {
  const r = readTender(raw);
  return { kind: "tender-moments", counts: { ...r.counts, [kind]: Math.min(TENDER_COUNT_CAP, (r.counts[kind] ?? 0) + 1) } };
}

const countOf = (r: TenderRecord, k: TenderKind): number => r.counts[k] ?? 0;

// --- The client's own pacing memory (never sent to the server) ---------

export interface TenderMemory {
  /** The last moment's time (ms). */
  lastAt: number;
  /** The local day each kind was last had. */
  lastDay: Partial<Record<TenderKind, string>>;
  /** The local day a new kind was last opened, and how many moments that day had. */
  newKindDay: string | null;
  day: string | null;
  dayCount: number;
}
export const EMPTY_TENDER_MEMORY: TenderMemory = { lastAt: 0, lastDay: {}, newKindDay: null, day: null, dayCount: 0 };

export function readTenderMemory(raw: unknown): TenderMemory {
  if (!raw || typeof raw !== "object") return { ...EMPTY_TENDER_MEMORY, lastDay: {} };
  const o = raw as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const lastDay: Partial<Record<TenderKind, string>> = {};
  if (o.lastDay && typeof o.lastDay === "object") {
    for (const k of TENDER_KINDS) {
      const d = str((o.lastDay as Record<string, unknown>)[k]);
      if (d) lastDay[k] = d;
    }
  }
  const n = typeof o.dayCount === "number" && Number.isFinite(o.dayCount) ? Math.max(0, Math.min(99, Math.floor(o.dayCount))) : 0;
  return {
    lastAt: typeof o.lastAt === "number" && Number.isFinite(o.lastAt) ? o.lastAt : 0,
    lastDay,
    newKindDay: str(o.newKindDay),
    day: str(o.day),
    dayCount: n,
  };
}

/** The memory after a moment of this kind was had now. */
export function rememberTender(m: TenderMemory, kind: TenderKind, today: string, now: number, wasNew: boolean): TenderMemory {
  return {
    lastAt: now,
    lastDay: { ...m.lastDay, [kind]: today },
    newKindDay: wasNew ? today : m.newKindDay,
    day: today,
    dayCount: (m.day === today ? m.dayCount : 0) + 1,
  };
}

// --- The rules ----------------------------------------------------------

export interface TenderFacts {
  rank: number;
  walking: boolean;
  /** She is beside him (following), in the town. */
  together: boolean;
  /** A dream, the summit, a night together, a boat, a quest's celebration, the wedding, or another moment holds the town. */
  busy: boolean;
  /** A quarrel open or mended today, or a heavy day she was told of today. */
  troubled: boolean;
  /** The town's sky says night, and the local hour (0 to 23). */
  night: boolean;
  hour: number;
  weather: string | null;
  /** Both inside their house. */
  bothHome: boolean;
  /** He has just come in at the house door (once per entry). */
  cameHome: boolean;
  atForum: boolean;
  onCliffPath: boolean;
  /** Tired: long in the town, or the small hours. */
  tired: boolean;
  /** Quest completions (Task 56) the hand has not yet honoured. */
  bravesWaiting: number;
  /** Local day, YYYY-MM-DD, and now (ms); a visit's start (ms) if one is open. */
  today: string;
  now: number;
  visitBeganAt: number | null;
  record: TenderRecord;
  memory: TenderMemory;
}

/** Rain, storm and snow keep them indoors: no dance, no cliff path. */
export const TENDER_BAD_WEATHER = ["rain", "storm", "snow"] as const;
const badWeather = (w: string | null): boolean => !!w && (TENDER_BAD_WEATHER as readonly string[]).includes(w);

/** Is this kind open yet? The first always; each next only after the one before it has been had. */
export function tenderUnlocked(kind: TenderKind, record: TenderRecord): boolean {
  const i = TENDER_KINDS.indexOf(kind);
  return i === 0 || countOf(record, TENDER_KINDS[i - 1]!) >= 1;
}

/** Why none of the moments is offered at all right now, or null. */
export function tenderGeneralBlock(f: TenderFacts): string | null {
  if (f.rank < TENDER_MOMENT_RANK) return "rank";
  if (!f.walking || !f.together) return "not together";
  if (f.busy) return "busy";
  if (f.troubled) return "troubled";
  if (f.visitBeganAt !== null && f.now - f.visitBeganAt < TENDER_VISIT_GRACE_MS) return "visit opening";
  if (f.memory.day === f.today && f.memory.dayCount >= TENDER_DAILY_CAP) return "enough for today";
  if (f.memory.lastAt && f.now - f.memory.lastAt < TENDER_GLOBAL_SPACING_MS && f.now >= f.memory.lastAt) return "spacing";
  return null;
}

/** Why this kind is not offered now, or null when it is. */
export function tenderBlocked(kind: TenderKind, f: TenderFacts): string | null {
  const general = tenderGeneralBlock(f);
  if (general) return general;
  if (!tenderUnlocked(kind, f.record)) return "locked";
  if (f.memory.lastDay[kind] === f.today) return "once a day";
  if (countOf(f.record, kind) === 0 && f.memory.newKindDay === f.today) return "one new thing a day";
  switch (kind) {
    case "cheek-kiss":
      return f.cameHome && f.bothHome ? null : "not coming home";
    case "morning-bread":
      return f.bothHome && !f.night && f.hour >= 5 && f.hour < 10 ? null : "not a morning at home";
    case "cliff-hand":
      return f.onCliffPath && !badWeather(f.weather) ? null : "not on the cliff path";
    case "forehead-kiss":
      return f.tired ? null : "not tired";
    case "fireside":
      return f.bothHome && f.night ? null : "not an evening at home";
    case "pillow-letter":
      return f.bothHome && f.night && f.hour >= 20 ? null : "the day is not done";
    case "slow-dance":
      return f.atForum && f.night && !badWeather(f.weather) ? null : "not the forum after dark";
    case "hand-kiss":
      return f.bravesWaiting > 0 ? null : "nothing brave to honour";
  }
}

/** The one kind to offer now (the first open one in order), or null. */
export function nextTenderKind(f: TenderFacts): TenderKind | null {
  for (const k of TENDER_KINDS) if (tenderBlocked(k, f) === null) return k;
  return null;
}

/** The brave thing a kiss on the hand honours: a Task 56 quest finished, counted against the hand-kisses given. */
export function bravesWaiting(questCompletions: number, record: TenderRecord): number {
  return Math.max(0, Math.floor(questCompletions) - countOf(record, "hand-kiss"));
}

/** Tired: long in the town this session, or the small hours of the night. */
export function isTired(sessionMs: number, hour: number): boolean {
  return sessionMs >= TENDER_TIRED_AFTER_MS || hour >= 23 || hour < 4;
}

/** The forum: the town's level heart, where the lamps stand. */
export const FORUM_CENTER = { x: 0, z: 0, r: 14 } as const;
export const atForumSpot = (x: number, z: number): boolean => Math.hypot(x - FORUM_CENTER.x, z - FORUM_CENTER.z) <= FORUM_CENTER.r;

/** The sea cliff's path (client/src/seaCliff.ts CLIFF: from the gate, along the strip to the bench). */
export const CLIFF_PATH = { fromZ: 46, toZ: 117, halfW: 5.4 } as const;
export const onCliffPathSpot = (x: number, z: number): boolean => z >= CLIFF_PATH.fromZ && z <= CLIFF_PATH.toZ && Math.abs(x) <= CLIFF_PATH.halfW;
