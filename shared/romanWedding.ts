// A Roman wedding (Task 58). In the town's story Gaius and Aelia are
// already married; the town marks it, and renews their vows, in Roman
// form: preparations (flowers, vows, the town dressed), then the
// ceremony (the veil, the pronuba, the joining of right hands, the
// formula, vows before the town, the torchlit walk home, the threshold),
// then a remembered day (a keepsake on the shelf and a durable record).
//
// Tender only. The offer opens at the terrace kiss's rank (TENDER_RANK,
// shared/tenderGate.ts, which this file reads and never changes); no
// gate is lowered. Nothing here pays, scores or unlocks anything: the
// ceremony is held once, and the record is a kind and a count.
// Pure functions, shared by the server (which keeps the book in the
// purse's flags, no schema change, and checks every move) and the client.
import { TENDER_RANK } from "./tenderGate";

/** The wedding is offered from the terrace kiss's rank. */
export const WEDDING_RANK = TENDER_RANK;

/** The preparations, in the only order they can be done. */
export const WEDDING_STEPS = ["flowers", "vows", "dress"] as const;
export type WeddingStep = (typeof WEDDING_STEPS)[number];

/** The durable first the day leaves in the town's own story (dating firsts). */
export const WEDDING_FIRST_KEY = "wedding";

export interface WeddingBook {
  /** Preparations done, always a prefix of WEDDING_STEPS. */
  steps: WeddingStep[];
  /** How many times the day was held: the whole of the record. Once only, so 0 or 1. */
  weddings: number;
  /** The celebration for the day has played. */
  celebrated: boolean;
}

export const emptyWedding = (): WeddingBook => ({ steps: [], weddings: 0, celebrated: true });

export const WEDDING_PREP: Record<WeddingStep, { title: string; text: string; button: string; line: string }> = {
  flowers: {
    title: "Gather the flowers",
    text: "Marjoram and verbena for the wreath, and whatever else is in bloom. A Roman bride wove her own wreath.",
    button: "Gather flowers with her",
    line: "Marjoram, verbena, and a few wild blooms for good measure. Hold them while I bind the stems.",
  },
  vows: {
    title: "Learn the vows",
    text: "Say the old words together until they come easily: where you are Gaius, I am Gaia.",
    button: "Say the old words together",
    line: "Ubi tu Gaius, ego Gaia. Where you are Gaius, I am Gaia. Say it back to me, slowly, until it is ours.",
  },
  dress: {
    title: "Dress the town",
    text: "Garlands along the avenue, torches at the posts, and a saffron banner over the forum.",
    button: "Hang the garlands",
    line: "Look at the avenue, all in green and flame. The whole town is dressed for us.",
  },
};

/** The ceremony, phase by phase: what is happening, her words, and his part. */
export interface CeremonyPhase {
  id: "veil" | "pronuba" | "hands" | "formula" | "vows" | "torch" | "threshold";
  title: string;
  /** What the town shows, in plain words. */
  scene: string;
  /** Her words. */
  line: string;
  /** His button. */
  button: string;
}

export const CEREMONY: readonly CeremonyPhase[] = [
  {
    id: "veil",
    title: "The veil and the wreath",
    scene: "Aelia wears the flame-coloured veil, the flammeum, over a wreath of marjoram and verbena.",
    line: "The veil is the colour of a small flame, and the wreath is the one we gathered. I am ready, love.",
    button: "Take your place beside her",
  },
  {
    id: "pronuba",
    title: "The pronuba",
    scene: "A matron of the market, married once only, stands between you as the pronuba.",
    line: "A woman who has been married only once should lead us, and the market has found one. She will stand between us.",
    button: "Let the pronuba lead you",
  },
  {
    id: "hands",
    title: "The joining of right hands",
    scene: "The pronuba joins your right hands, the dextrarum iunctio.",
    line: "Right hand in right hand, as the old carvings show it. Hold on, I am not letting go.",
    button: "Join right hands",
  },
  {
    id: "formula",
    title: "Where you are Gaius",
    scene: "She says the old formula, and you give it back.",
    line: "Ubi tu Gaius, ego Gaia. Where you are Gaius, I am Gaia.",
    button: "Answer: Ubi tu Gaia, ego Gaius",
  },
  {
    id: "vows",
    title: "Vows before the town",
    scene: "The town gathers on the avenue to witness your words.",
    line: "Before the whole town, then. I choose you, and I will keep choosing you.",
    button: "Say your vows before the town",
  },
  {
    id: "torch",
    title: "The torch and the procession",
    scene: "The wedding torch is lit, and the town walks you home in procession, the deductio, calling out the old wedding cry.",
    line: "Light the torch. We walk home together, and the town may sing as loudly as it likes.",
    button: "Light the torch and walk home",
  },
  {
    id: "threshold",
    title: "The threshold",
    scene: "At your door, the door-posts are bound with wool and anointed, and you carry her over the threshold.",
    line: "They say a bride must not step on the threshold herself. So, my husband, lift me over it.",
    button: "Carry her over the threshold",
  },
];

/** Her words when the day is done: a tender line, available from the offer's rank only. */
export const WEDDING_DONE_LINE = "Welcome home, my husband. A kiss, now the whole town has seen.";
/** Her words for the celebration, safe at every rank. */
export const WEDDING_CELEBRATION_LINE = "Look at the garlands, and the torches all the way down the avenue. The whole town came to see us.";
/** Her offer at the board, and her kind wait before the rank. */
export const WEDDING_OFFER_LINES = [
  "Shall we let the town see us wed, the old Roman way? A few flowers, the old words, and a walk home by torchlight.",
  "We are already married, you and I. But I would like the town to witness it the way Rome did. Will you take it up with me?",
];
export const WEDDING_WAIT_LINE = "A wedding day will come when we are closer. There is no hurry.";

/** Every line she says, split by what the gate must say of it. */
export const WEDDING_LINES_ANY_RANK: readonly string[] = [
  ...Object.values(WEDDING_PREP).map((p) => p.line),
  ...CEREMONY.map((c) => c.line),
  WEDDING_CELEBRATION_LINE,
  ...WEDDING_OFFER_LINES,
  WEDDING_WAIT_LINE,
];
/** The one line with a kiss in it; only ever said where the offer stands. */
export const WEDDING_LINES_TENDER: readonly string[] = [WEDDING_DONE_LINE];

/** Whether the wedding is offered at this rank. */
export const weddingOffered = (rank: number): boolean => rank >= WEDDING_RANK;

/** The next preparation, or null when all are done. */
export const nextStep = (book: WeddingBook): WeddingStep | null => WEDDING_STEPS[book.steps.length] ?? null;

/** The day has been held, once. */
export const weddingHeld = (book: WeddingBook): boolean => book.weddings > 0;

/** The ceremony may be held: every preparation done, not held before, rank enough. */
export const canHold = (book: WeddingBook, rank: number): boolean => weddingOffered(rank) && book.steps.length === WEDDING_STEPS.length && !weddingHeld(book);

/** The town is dressed from the dressing until the day is held (the celebration then plays on). */
export const townDressed = (book: WeddingBook): boolean => book.steps.includes("dress") && !weddingHeld(book);

/** One preparation. Only the NEXT step, only from the offered rank, only before the day:
 *  anything else, and any repeat, changes nothing. */
export function prepare(book: WeddingBook, step: WeddingStep, rank: number): WeddingBook {
  if (!weddingOffered(rank) || weddingHeld(book) || nextStep(book) !== step) return book;
  return { ...book, steps: [...book.steps, step] };
}

/** Hold the day, once: the count goes to one however often this is called, the celebration is owed, and the dressing comes down. */
export function hold(book: WeddingBook, rank: number): WeddingBook {
  if (!canHold(book, rank)) return book;
  return { steps: [...WEDDING_STEPS], weddings: 1, celebrated: false };
}

/** The celebration has played: it will not play again. */
export const markWeddingCelebrated = (book: WeddingBook): WeddingBook => (weddingHeld(book) && !book.celebrated ? { ...book, celebrated: true } : book);

/** A celebration is owed. */
export const weddingPending = (book: WeddingBook): boolean => weddingHeld(book) && !book.celebrated;

export const isWeddingStep = (s: string): s is WeddingStep => (WEDDING_STEPS as readonly string[]).includes(s);

/** Read a stored book, keeping only valid fields: steps are cut to a valid prefix. */
export function readWeddingBook(raw: unknown): WeddingBook {
  if (!raw || typeof raw !== "object") return emptyWedding();
  const r = raw as Record<string, unknown>;
  const steps: WeddingStep[] = [];
  if (Array.isArray(r.steps)) {
    for (const s of r.steps) {
      if (typeof s === "string" && s === WEDDING_STEPS[steps.length]) steps.push(s as WeddingStep);
      else break;
    }
  }
  const held = r.weddings === 1 || (typeof r.weddings === "number" && r.weddings > 0);
  if (held) return { steps: [...WEDDING_STEPS], weddings: 1, celebrated: r.celebrated !== false };
  return { steps, weddings: 0, celebrated: true };
}
