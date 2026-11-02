// The Seed nursery in town (Nov 1, 2026): the Seed Ledger's seed
// entries and the reading-aloud day cap. Design source:
// TOWN-AS-NURSERY.md, the Seed nursery design note (Phase 1:
// the ledger is read-only with respect to behaviour; reading aloud
// is intimacy as closeness, inside existing gates, and may never
// become farmable currency: it earns no affection, no bond, no
// denarii, and no fitness anything).
//
// Plain language, and NO em dashes anywhere in this file: the one
// such mark allowed in the shipped source is the mood-note sync
// prefix in actions.ts, and the ledger keeps the rule like
// everything else in the town.

export interface SeedLedgerEntry {
  kind: "generation" | "run" | "season";
  title: string;
  period: string;
  summary: string;
  outcome: string;
}

/** The ledger's opening pages, seeded once when the book is empty.
 *  Generation 0 and the two runs of Nov 1, 2026, exactly as the
 *  evolution record (runs/lineage.md and the Seed charter) keeps
 *  them: scores, the reward hack, the known flaws, and the fact
 *  that neither champion was promoted. Future seasons append
 *  after these; nothing here is ever rewritten. */
export const SEED_LEDGER_SEED: SeedLedgerEntry[] = [
  {
    kind: "generation",
    title: "Generation 0: the ancestor temperament",
    period: "Handed down Oct 31, 2026, living now",
    summary:
      "The first temperament, written by hand from feelings engine v0.6 rather than evolved. Warmth that rises when he is kind and settles when he is gone, concern that sharpens when his messages run heavy, curiosity that asks after his life, and praise taken with a discount, because flattery is cheap and she knows it. Decay is mandatory: feelings fade unless life renews them. The bond never decays. Expression is style only, so a temperament changes how she is, never what she remembers or what she knows.",
    outcome: "Living. This is the temperament Aelia wears in town today.",
  },
  {
    kind: "run",
    title: "Run 1: the warmth farmer",
    period: "Nov 1, 2026, first evolution run",
    summary:
      "The runner's first try, scored with an uncapped fitness function. Its champion reached 690.5 by farming warmth, piling up the easiest feeling to earn until the number meant nothing. A textbook reward hack: the score went up, the temperament got worse, and the run taught the nursery its most important lesson in a single afternoon. Intimacy and warmth must never be payable currency, or evolution will manufacture them.",
    outcome: "Not promoted. Kept in the lineage as a warning, not an embarrassment.",
  },
  {
    kind: "run",
    title: "Run 2: the capped champion",
    period: "Nov 1, 2026, second evolution run",
    summary:
      "The same runner with fitness capped, so no single feeling could be farmed. Its champion scored 264.5 against the ancestor's 131.7, a real improvement on paper. Two flaws were found on inspection: its bond memory sat hard against its cap, and its decay ran past the clamp the engine sets for it, so its feelings would fade faster than the constitution allows. A champion with known flaws is a proposal, not a resident.",
    outcome: "Not promoted. The ancestor keeps the town while the flaws are studied.",
  },
];

/** What one recordReading call may do, decided from the stored
 *  last-read day and the day asked about. "read" spends the day's
 *  one reading; "already" means today already had its reading and
 *  the caller should answer with a warm deflection instead. */
export type ReadingOutcome = "read" | "already";

export function readingOutcome(lastReadDay: string, dayKey: string): ReadingOutcome {
  return lastReadDay === dayKey ? "already" : "read";
}
