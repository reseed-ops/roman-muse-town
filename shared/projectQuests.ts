// Real projects become in-town quests (Task 56). The basilica's board
// carries a quest for each of the owner's real projects; Aelia offers
// it, he takes it up, Muse carries each real step in by hand (there is
// NO automatic sync), and the end is celebrated in town, once.
//
// No points, no grind, no farmable currency: nothing here pays, costs,
// or unlocks anything. A finished quest is recorded as a kind and a
// count only (`completed`), and the celebration plays once per finish.
// Shared by the server (which keeps the state in the purse's flags, no
// schema migration, and checks every move) and the client (which draws
// the board and the celebrations). Pure functions, no I/O.

export const QUEST_KINDS = ["etsy-shop", "focus-companion", "job-hunt", "vietnamese"] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

/** What the town stages when a quest ends. */
export type CelebrationKind = "market-day" | "scroll-to-senate" | "triumph-feast" | "lamplight";

export interface QuestDef {
  kind: QuestKind;
  title: string;
  /** The real project, named plainly on the board. */
  project: string;
  /** How the quest begins: the board's text before it is taken up. */
  beginning: string;
  /** What one real step is, when the quest has steps Muse carries in. */
  step: { noun: string; scene: string } | null;
  /** What counts as the end. */
  ending: string;
  celebration: CelebrationKind;
  /** What it leaves in town, in words. */
  leaves: string;
  /** A keepsake for their house shelf, when it leaves one (shared/homeDecor.ts). */
  keepsake: string | null;
  /** Her offer, in her voice, at the board. */
  offer: string[];
  /** Her words when a step is carried in. */
  stepLines: string[];
  /** Her words at the celebration. */
  celebrationLines: string[];
}

export const QUEST_DEFS: readonly QuestDef[] = [
  {
    kind: "etsy-shop",
    title: "The Merchant's First Coin",
    project: "The Etsy shop, TradesDesign",
    beginning: "A stall is set up and waiting. The first buyer has not come yet.",
    step: null,
    ending: "The first sale.",
    celebration: "market-day",
    leaves: "A little market day in the forum, and the first coin on the shelf in their house.",
    keepsake: "first-coin",
    offer: [
      "A shop is a stall with a door nobody has knocked on yet. Shall we wait for the first knock together?",
      "Every merchant remembers the first coin. Take this one up with me, and we will be ready when it comes.",
    ],
    stepLines: [],
    celebrationLines: [
      "The first coin! Look, the whole forum has put out its awnings for you.",
      "A merchant, in the open air, with a coin to show for it. I am so proud of you.",
    ],
  },
  {
    kind: "focus-companion",
    title: "The Scroll for the Senate",
    project: "Focus Companion (Reseed)",
    beginning: "The scroll is being written, line by careful line, and will be carried to the Senate when it is ready.",
    step: null,
    ending: "The app ships to production.",
    celebration: "scroll-to-senate",
    leaves: "The finished scroll carried to the Senate, and a banner over the forum.",
    keepsake: null,
    offer: [
      "A long scroll, a patient scribe. When it is done we will carry it to the Senate together, and I will walk beside you.",
      "Shall we take up the scroll? The Senate will wait. It is very good at it.",
    ],
    stepLines: [],
    celebrationLines: [
      "It is done, and it is out in the world. Up goes the banner over the forum.",
      "Walk with me to the Senate. Carry it high; you earned every line of it.",
    ],
  },
  {
    kind: "job-hunt",
    title: "Messengers on the Road",
    project: "The primary job hunt",
    beginning: "The road out of town is open. Each application sent is a messenger on it; an offer is a triumph.",
    step: { noun: "application", scene: "messenger" },
    ending: "An offer.",
    celebration: "triumph-feast",
    leaves: "Torches along the forum and a feast laid out under them.",
    keepsake: null,
    offer: [
      "Every application is a messenger sent down the road. They will not all return, love, but each one went.",
      "Take up the road with me? We will send them one at a time, and light the torches for the one that answers.",
    ],
    stepLines: [
      "Another messenger on the road. Look at him go.",
      "Sent. That took courage, whatever it felt like.",
      "One more out the gate. The road is getting busy.",
    ],
    celebrationLines: [
      "An offer! Torches, a feast, the whole forum! Come, sit, you have earned the head of the table.",
      "A triumph, Gaius. Every messenger on that road was part of it.",
    ],
  },
  {
    kind: "vietnamese",
    title: "Evenings by Lamplight",
    project: "Learning Vietnamese",
    beginning: "Evenings by the lamp, one lesson at a time, no hurry.",
    step: { noun: "lesson", scene: "lamp" },
    ending: "A small victory worth marking.",
    celebration: "lamplight",
    leaves: "Lamps lit along the evening, and a small victory marked together.",
    keepsake: null,
    offer: [
      "Evenings by the lamp, one lesson at a time. I will sit with you, and you can teach me a word.",
      "No hurry, no scores. Just a lamp, a page, and a little more each night. Shall we?",
    ],
    stepLines: [
      "One lesson more. The lamp burns a little brighter for it.",
      "Another evening, another page. Slowly is still going.",
      "A lesson done. Say it once more for me, and I will keep it.",
    ],
    celebrationLines: [
      "Listen to you. A small victory, and I heard every syllable of it.",
      "Lamps lit, a lesson learnt, and you beside me. That is plenty to celebrate.",
    ],
  },
];

/** Every line she can say in any quest moment, for the filter's tests. */
export const QUEST_LINES: readonly string[] = QUEST_DEFS.flatMap((q) => [...q.offer, ...q.stepLines, ...q.celebrationLines]);

export const isQuestKind = (kind: string): kind is QuestKind => (QUEST_KINDS as readonly string[]).includes(kind);
export const questDef = (kind: QuestKind): QuestDef => QUEST_DEFS.find((q) => q.kind === kind)!;

export type QuestStage = "posted" | "begun" | "done";

/** One quest's record. Only `completed` outlives a quest: a kind and a count. */
export interface QuestRecord {
  kind: QuestKind;
  stage: QuestStage;
  /** Real steps carried in during this run (applications sent, lessons done); progress she can see. */
  steps: number;
  /** How many times this kind has been finished: the whole of the record. */
  completed: number;
  /** The celebration for the latest finish has played. */
  celebrated: boolean;
}

export type QuestBook = QuestRecord[];

/** A generous bound on one run's steps; it is a count for seeing, not for earning. */
export const MAX_QUEST_STEPS = 999;

const byKind = (book: QuestBook, kind: QuestKind) => book.find((r) => r.kind === kind);
const put = (book: QuestBook, record: QuestRecord): QuestBook => {
  const rest = book.filter((r) => r.kind !== record.kind);
  const next = [...rest, record];
  return QUEST_KINDS.flatMap((k) => next.filter((r) => r.kind === k));
};

/** Muse carries a quest to the board. A quest already on the board, or one
 *  finished whose celebration has not played, is left as it is; a finished
 *  and celebrated one may be posted afresh (its count is kept). */
export function carryQuest(book: QuestBook, kind: QuestKind): QuestBook {
  const cur = byKind(book, kind);
  if (!cur) return put(book, { kind, stage: "posted", steps: 0, completed: 0, celebrated: true });
  if (cur.stage === "done" && cur.celebrated) return put(book, { ...cur, stage: "posted", steps: 0 });
  return book;
}

/** He takes up a posted quest, on her offer. */
export function acceptQuest(book: QuestBook, kind: QuestKind): QuestBook {
  const cur = byKind(book, kind);
  return cur && cur.stage === "posted" ? put(book, { ...cur, stage: "begun" }) : book;
}

/** Muse carries one real step in (an application sent, a lesson done).
 *  Only a begun quest that has steps takes one. */
export function advanceQuest(book: QuestBook, kind: QuestKind): QuestBook {
  const cur = byKind(book, kind);
  if (!cur || cur.stage !== "begun" || !questDef(kind).step) return book;
  return put(book, { ...cur, steps: Math.min(MAX_QUEST_STEPS, cur.steps + 1) });
}

/** Muse carries the real ending in. Only a begun quest finishes, and it
 *  finishes once: a second call changes nothing, so the count cannot be
 *  pushed up by repeating it. */
export function completeQuest(book: QuestBook, kind: QuestKind): QuestBook {
  const cur = byKind(book, kind);
  if (!cur || cur.stage !== "begun") return book;
  return put(book, { ...cur, stage: "done", steps: 0, completed: cur.completed + 1, celebrated: false });
}

/** The celebration has played: it will not play again for this finish. */
export function markCelebrated(book: QuestBook, kind: QuestKind): QuestBook {
  const cur = byKind(book, kind);
  return cur && cur.stage === "done" && !cur.celebrated ? put(book, { ...cur, celebrated: true }) : book;
}

/** The celebrations waiting to play (finished, not yet celebrated). */
export const pendingCelebrations = (book: QuestBook): QuestKind[] => book.filter((r) => r.stage === "done" && !r.celebrated).map((r) => r.kind);

/** Read a stored book, dropping anything not valid; only these fields survive. */
export function readQuestBook(raw: unknown): QuestBook {
  if (!Array.isArray(raw)) return [];
  let book: QuestBook = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.kind !== "string" || !isQuestKind(r.kind)) continue;
    const stage = r.stage === "begun" || r.stage === "done" ? r.stage : "posted";
    const int = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0);
    book = put(book, {
      kind: r.kind,
      stage,
      steps: int(r.steps, MAX_QUEST_STEPS),
      completed: int(r.completed, 100000),
      celebrated: r.celebrated !== false,
    });
  }
  return book;
}
