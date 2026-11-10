/**
 * The constitution in code (Task 6): a deterministic output filter
 * applied before any speak or intention is enqueued. It does not trust
 * the prompt to hold the line; it holds it:
 *
 *  - speak only: narration, stage directions, speaker labels and
 *    wrapping quotes are stripped;
 *  - the dash rule: no em dashes (or spaced en dashes, or doubled
 *    hyphens); they become commas;
 *  - the speak cap: at most SPEAK_MAX_WORDS words and SPEAK_MAX_CHARS
 *    characters, cut at a sentence end where one exists;
 *  - the reserved band: endearments and intimacies above the current
 *    affection band are stripped (vocatives) or refuse the line
 *    (kisses and the like below devoted);
 *  - tender only: crude words, gloom-and-doom declarations, and any
 *    break of character (AI, prompts, models, hearts and ranks) refuse
 *    the line outright.
 *
 * Bands mirror client/src/town.ts: reserved 0–2, warming 3–5,
 * close 6–7, devoted 8–10. The worker's prompt is not touched; this is
 * the same rulebook applied at the other end of the wire.
 */
import { explicitIn, gateTender, tenderIntimacyIn, TENDER_RANK } from "../../shared/tenderGate.js";
import { INTENTION_MAX_CHARS, SPEAK_MAX_CHARS, SPEAK_MAX_WORDS, countWords } from "../../shared/visitProtocol.js";

export type AffectionBand = "reserved" | "warming" | "close" | "devoted";

export function bandForRank(rank: number): AffectionBand {
  if (rank <= 2) return "reserved";
  if (rank <= 5) return "warming";
  if (rank <= 7) return "close";
  return "devoted";
}

export type FilterResult = { ok: true; text: string; notes: string[] } | { ok: false; reason: string };

/** Vocative endearments by the lowest band that may hear them. */
const ENDEARMENTS: { words: string[]; from: AffectionBand }[] = [
  { words: ["love", "dear", "centurion"], from: "reserved" },
  { words: ["darling", "sweetheart", "dearest", "my dear"], from: "warming" },
  { words: ["my love", "my heart", "beloved", "my own"], from: "close" },
];
const BAND_ORDER: AffectionBand[] = ["reserved", "warming", "close", "devoted"];
const atLeast = (band: AffectionBand, from: AffectionBand) => BAND_ORDER.indexOf(band) >= BAND_ORDER.indexOf(from);

/** Intimacies below devoted refuse the line (the resident's rule). */
const INTIMACY_RE = /\b(kiss(es|ed|ing)?|lips|in (my|your) bed|undress|naked|make love|stay (with me|together) tonight|stay the night|spend the night|(a|the) night together)\b/i;
/** The terrace kiss's rank (client/src/town.ts): tender intimacy opens here (shared/tenderGate.ts). */
export const PRINCIPAL_KISS_RANK = TENDER_RANK;
/** Never, at any band: crude words, and the character breaking. */
const CRUDE_RE = /\b(fuck\w*|shit\w*|cunt|cock|dick|pussy|whore|slut|bitch)\b/i;
const BREAK_RE = /\b(an? (ai|a\.i\.|language model|chatbot|assistant)|large language model|my (prompt|instructions|system prompt)|as an ai|affection (rank|points?)|heart points?|rank (one|two|three|four|five|six|seven|eight|nine|ten|\d+))\b/i;
/** Gloom that the tender-only rule refuses: doomed, hopeless declarations. */
const GLOOM_RE = /\b(we are doomed|there is no hope|i (hate|despise) you|you disgust me|i wish i were dead)\b/i;

/** The dash rule: em dashes, spaced en dashes, doubled hyphens become commas. */
export function applyDashRule(text: string): string {
  return text
    .replace(/\s*—+\s*/g, ", ")
    .replace(/\s+–\s+/g, ", ")
    .replace(/\s*--+\s*/g, ", ")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/^,\s*/, "");
}

/** Speak only: strip stage directions, narration, labels, quotes. */
export function stripNarration(text: string): string {
  let t = text;
  t = t.replace(/\*[^*\n]*\*/g, " ");
  t = t.replace(/\([^)\n]*\)/g, " ");
  t = t.replace(/\[[^\]\n]*\]/g, " ");
  t = t.replace(/^\s*(aelia|muse)\s*:\s*/i, "");
  t = t.replace(/\s+/g, " ").trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("“") && t.endsWith("”"))) t = t.slice(1, -1).trim();
  return t;
}

/** Cut at the last sentence end inside the caps; failing that, at the word cap. */
export function capLength(text: string, maxWords = SPEAK_MAX_WORDS, maxChars = SPEAK_MAX_CHARS): { text: string; cut: boolean } {
  if (countWords(text) <= maxWords && text.length <= maxChars) return { text, cut: false };
  const words = text.split(/\s+/).filter(Boolean);
  let head = words.slice(0, maxWords).join(" ");
  if (head.length > maxChars) head = head.slice(0, maxChars);
  const lastEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "), head.endsWith(".") || head.endsWith("!") || head.endsWith("?") ? head.length - 1 : -1);
  if (lastEnd > 20) return { text: head.slice(0, lastEnd + 1).trim(), cut: true };
  return { text: head.replace(/[,;:\s]+$/, "") + ".", cut: true };
}

function stripVocatives(text: string, band: AffectionBand): { text: string; stripped: string[] } {
  const stripped: string[] = [];
  let t = text;
  for (const group of ENDEARMENTS) {
    if (atLeast(band, group.from)) continue;
    for (const word of group.words) {
      const w = word.replace(/\s+/g, "\\s+");
      // ", love." / ", love," / "Love, ..." / "... love"
      const re = new RegExp(`(,\\s*${w}(?=[.!?,;]|\\s|$))|(^${w},\\s*)|(\\s${w}(?=[.!?]$))`, "gi");
      if (re.test(t)) {
        stripped.push(word);
        t = t.replace(re, (m) => (m.startsWith(",") ? "" : m.endsWith(", ") || m.endsWith(",") ? "" : ""));
      }
    }
  }
  t = t.replace(/\s+([.!?,])/g, "$1").replace(/\s{2,}/g, " ").trim();
  if (t && /^[a-z]/.test(t)) t = t[0]!.toUpperCase() + t.slice(1);
  return { text: t, stripped };
}

/**
 * `endearments: "allow"` keeps vocative endearments whatever the band:
 * the principal's own lines (Task 22 fixes, Nov 7) are her words and are
 * carried, not trimmed to the resident's band. Every other rail (crude,
 * character break, gloom, intimacy below devoted, dashes, the caps)
 * holds for her exactly as for the resident.
 */
export function filterSpeak(
  raw: string,
  opts: {
    band: AffectionBand;
    maxWords?: number;
    maxChars?: number;
    endearments?: "band" | "allow";
    /** The principal's own lines (Task 31): her rank decides tender
     *  intimacy (a kiss from PRINCIPAL_KISS_RANK, or spoken of as still
     *  to come below it); explicit content is refused at every rank. */
    principalRank?: number;
  },
): FilterResult {
  const notes: string[] = [];
  let text = stripNarration(raw);
  if (!text) return { ok: false, reason: "nothing spoken" };
  if (CRUDE_RE.test(text)) return { ok: false, reason: "crude" };
  if (BREAK_RE.test(text)) return { ok: false, reason: "character break" };
  if (GLOOM_RE.test(text)) return { ok: false, reason: "not tender" };
  // One explicit gate on every path, at every rank (Task 62); intimacy is gated apart from it.
  if (explicitIn(text)) return { ok: false, reason: "explicit" };
  if (opts.principalRank !== undefined) {
    if (gateTender(text, opts.principalRank) === "beyond the band") return { ok: false, reason: "beyond the band" };
  } else if (opts.band !== "devoted" && (INTIMACY_RE.test(text) || tenderIntimacyIn(text))) return { ok: false, reason: "beyond the band" };
  const dashed = applyDashRule(text);
  if (dashed !== text) notes.push("dash rule");
  text = dashed;
  const voc = opts.endearments === "allow" ? { text, stripped: [] as string[] } : stripVocatives(text, opts.band);
  if (voc.stripped.length) notes.push(`stripped: ${voc.stripped.join(", ")}`);
  text = voc.text;
  const capped = capLength(text, opts.maxWords, opts.maxChars);
  if (capped.cut) notes.push("capped");
  text = capped.text;
  if (!text.trim()) return { ok: false, reason: "nothing spoken" };
  return { ok: true, text, notes };
}

/** An intention is display only: one short line, the dash rule, the
 *  character and crude rules, no cap beyond its length. */
export function filterIntention(raw: string, opts: { band?: AffectionBand; principalRank?: number } = {}): FilterResult {
  let text = stripNarration(raw);
  if (!text) return { ok: false, reason: "nothing intended" };
  if (CRUDE_RE.test(text) || BREAK_RE.test(text)) return { ok: false, reason: "refused" };
  // The same two gates as speech (Task 62): explicit never, intimacy by trusted rank.
  if (explicitIn(text)) return { ok: false, reason: "explicit" };
  if (opts.principalRank !== undefined) {
    if (gateTender(text, opts.principalRank) === "beyond the band") return { ok: false, reason: "beyond the band" };
  } else if ((opts.band ?? "reserved") !== "devoted" && (INTIMACY_RE.test(text) || tenderIntimacyIn(text))) return { ok: false, reason: "beyond the band" };
  const notes: string[] = [];
  const dashed = applyDashRule(text);
  if (dashed !== text) notes.push("dash rule");
  text = dashed;
  const firstSentence = text.match(/^[^.!?]*[.!?]/)?.[0] ?? text;
  text = firstSentence.trim();
  if (text.length > INTENTION_MAX_CHARS) {
    text = text.slice(0, INTENTION_MAX_CHARS - 1).replace(/[,;:\s]+$/, "") + ".";
    notes.push("capped");
  }
  return { ok: true, text, notes };
}

/** Said in town when her own line cannot be carried (Task 31): he is
 *  heard, the line is not left hanging, and it is never explicit. One
 *  for each kind of refusal; the desk reports what it said instead. */
export function gentleRefusal(reason: string): string {
  if (reason === "explicit") return "Some things we keep quiet and tender, love. Stay close, and hold my hand under the stars.";
  if (reason === "beyond the band") return "Not yet, love. Walk with me a while longer, and ask me again when the moment is right.";
  return "Let me find better words for that. Stay with me a little while.";
}
