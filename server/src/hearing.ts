// Aelia's ear: pure text logic, with no database and no SDK, so it can
// be tested on its own. The stateful bookkeeping built on top of it
// lives in actions.ts.

import { PLAYER, type Pronouns } from "./player";

/** Normalized comparison for the dedupe ring: case and punctuation
 *  folded away, then equality, or, for replies long enough to have
 *  a shape, a high word-overlap (Jaccard ≥ 0.8), counts as a
 *  near-exact repeat. Very short replies (≤ 4 words) only ever
 *  count on exact equality: brief formulae are her manners, not
 *  repeats. */
function normalizeReplyText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function repliesNearDuplicate(a: string, b: string): boolean {
  const na = normalizeReplyText(a);
  const nb = normalizeReplyText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = new Set(na.split(" "));
  const wb = new Set(nb.split(" "));
  if (Math.min(wa.size, wb.size) <= 4) return false;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union > 0 && inter / union >= 0.8;
}

// --- Sentiment: Aelia's ear -------------------------------------------
// A hand-tuned lexicon scorer in the same spirit as fact extraction
// below: word and phrase weights across weather categories, with
// intensifiers ("so tired" counts stronger), dampeners, and negation
// handling ("not bad" is not bad; "not tired" is not tired). The
// output is a dominant weather + intensity + confidence; short or
// ambiguous messages return NO signal ("none"), she answers
// normally rather than guessing at his heart. Sarcasm and irony are
// a known blind spot, accepted and designed around: when the signal
// is muddy, there is no signal. Sentiment never grants or removes
// affection, never triggers friction, never gates anything, and is
// never shown anywhere as a number or a label.

export type SentimentWeather =
  | "bright"
  | "warm"
  | "content"
  | "flat"
  | "weary"
  | "low"
  | "strained"
  | "none";
export type SentimentIntensity = "mild" | "strong" | "none";

export interface SentimentResult {
  weather: SentimentWeather;
  intensity: SentimentIntensity;
  confidence: number;
  scores: Record<string, number>;
}

type SentimentCategory = Exclude<SentimentWeather, "none">;

const SENTIMENT_PHRASES: [string, SentimentCategory, number][] = [
  // bright, joy, good news
  ["great news", "bright", 3],
  ["good news", "bright", 2.6],
  ["got the job", "bright", 3.2],
  ["got promoted", "bright", 3.2],
  ["it worked", "bright", 2.4],
  ["we did it", "bright", 3],
  ["i did it", "bright", 3],
  ["best day", "bright", 3],
  ["so happy", "bright", 3],
  ["really happy", "bright", 3],
  ["over the moon", "bright", 3.2],
  ["on top of the world", "bright", 3.2],
  // warm, fond, affectionate
  ["love you", "warm", 3],
  ["miss you", "warm", 2.8],
  ["adore you", "warm", 3],
  ["thinking of you", "warm", 2.6],
  ["fond of you", "warm", 2.8],
  ["glad you're here", "warm", 2.6],
  ["glad you are here", "warm", 2.6],
  ["appreciate you", "warm", 2.4],
  // content, calm, positive
  ["not bad", "content", 2.2],
  ["pretty good", "content", 2.2],
  ["feeling good", "content", 2.4],
  ["feels good", "content", 2.2],
  ["easy day", "content", 2.2],
  ["quiet day", "content", 2],
  ["good day", "content", 2.2],
  ["all right", "content", 1.6],
  ["alright", "content", 1.6],
  // weary, tired, drained
  ["worn out", "weary", 3],
  ["running on empty", "weary", 3.2],
  ["no energy", "weary", 2.8],
  ["need sleep", "weary", 2.6],
  ["need rest", "weary", 2.4],
  ["barely awake", "weary", 2.8],
  ["so tired", "weary", 3],
  ["really tired", "weary", 3],
  // low, sad, down, lonely
  ["feel down", "low", 2.8],
  ["feeling down", "low", 2.8],
  ["feeling low", "low", 2.8],
  ["feel low", "low", 2.8],
  ["so sad", "low", 3],
  ["really sad", "low", 3],
  ["feel alone", "low", 2.8],
  ["feeling alone", "low", 2.8],
  ["carrying something heavy", "low", 2.6],
  ["heavy heart", "low", 2.8],
  // strained, stressed, anxious, frustrated
  ["falling behind", "strained", 2.6],
  ["too much", "strained", 2.2],
  ["so stressed", "strained", 3],
  ["really stressed", "strained", 3],
  ["stressed out", "strained", 3],
  ["fed up", "strained", 2.6],
];

const SENTIMENT_WORDS: Record<string, [SentimentCategory, number]> = {
  // bright
  happy: ["bright", 2.2], joyful: ["bright", 2.6], joy: ["bright", 2.4],
  delighted: ["bright", 2.6], excited: ["bright", 2.4], thrilled: ["bright", 2.8],
  fantastic: ["bright", 2.6], amazing: ["bright", 2.4], wonderful: ["bright", 2.4],
  excellent: ["bright", 2.4], awesome: ["bright", 2.4], brilliant: ["bright", 2.2],
  proud: ["bright", 2], celebrating: ["bright", 2.4], celebrate: ["bright", 2.2],
  won: ["bright", 2.2], victory: ["bright", 2.4], great: ["bright", 1.4],
  glad: ["bright", 1.8], elated: ["bright", 2.8], ecstatic: ["bright", 3],
  // warm
  love: ["warm", 2.2], adore: ["warm", 2.6], fond: ["warm", 2.2],
  tender: ["warm", 2.2], affectionate: ["warm", 2.4], darling: ["warm", 2.4],
  sweetheart: ["warm", 2.4], dearest: ["warm", 2.4], cherish: ["warm", 2.4],
  // content
  calm: ["content", 2], peaceful: ["content", 2.2], relaxed: ["content", 2.2],
  content: ["content", 2.2], fine: ["content", 1.4], good: ["content", 1.4],
  okay: ["content", 1.2], ok: ["content", 1], pleasant: ["content", 1.8],
  steady: ["content", 1.6], comfortable: ["content", 1.8], settled: ["content", 1.6],
  better: ["content", 1.2],
  // flat
  meh: ["flat", 2], bored: ["flat", 1.8], dull: ["flat", 1.6],
  blank: ["flat", 1.6], numb: ["flat", 2],
  // weary
  tired: ["weary", 2.4], exhausted: ["weary", 3], drained: ["weary", 2.8],
  weary: ["weary", 2.6], sleepy: ["weary", 2], fatigued: ["weary", 2.6],
  worn: ["weary", 2], aching: ["weary", 1.6],
  // low
  sad: ["low", 2.6], down: ["low", 1.8], lonely: ["low", 2.8],
  alone: ["low", 1.8], unhappy: ["low", 2.6], gloomy: ["low", 2.4],
  heartbroken: ["low", 3], crying: ["low", 2.6], tears: ["low", 2.2],
  grief: ["low", 2.8], miss: ["low", 1.2], bad: ["low", 1.2],
  awful: ["low", 2.2], terrible: ["low", 2.2], rough: ["low", 1.6],
  hard: ["low", 1],
  // strained
  stressed: ["strained", 2.8], anxious: ["strained", 2.8], worried: ["strained", 2.4],
  worry: ["strained", 2.2], overwhelmed: ["strained", 3], frustrated: ["strained", 2.6],
  frustrated_: ["strained", 0], angry: ["strained", 2.6], annoyed: ["strained", 2.2],
  pressure: ["strained", 2.2], panic: ["strained", 2.8], nervous: ["strained", 2.4],
  tense: ["strained", 2.2], swamped: ["strained", 2.6], deadline: ["strained", 1.6],
  deadlines: ["strained", 1.6], struggling: ["strained", 2.2],
};
delete SENTIMENT_WORDS.frustrated_;

const SENTIMENT_INTENSIFIERS: Record<string, number> = {
  very: 1.5, so: 1.6, really: 1.5, extremely: 2, incredibly: 2,
  utterly: 2, completely: 1.8, totally: 1.8, deeply: 1.7,
  absolutely: 1.8, truly: 1.4, quite: 1.2, super: 1.7, awfully: 1.6,
};
const SENTIMENT_DAMPENERS: Record<string, number> = {
  slightly: 0.6, somewhat: 0.7, kinda: 0.7,
};
const SENTIMENT_NEGATIONS = new Set([
  "not", "no", "never", "dont", "don't", "cant", "can't", "isnt", "isn't",
  "wasnt", "wasn't", "wont", "won't", "didnt", "didn't", "aint", "hardly",
]);

/** What a negated feeling counts as instead: a negated bright word
 *  leans low, a negated heavy word leans content ("not bad", "not
 *  tired"), the weight always drops; negation softens, it does not
 *  simply mirror. */
const SENTIMENT_NEGATED: Record<SentimentCategory, [SentimentCategory, number]> = {
  bright: ["low", 0.8],
  warm: ["flat", 0.6],
  content: ["low", 0.5],
  flat: ["content", 0.5],
  weary: ["content", 0.8],
  low: ["content", 0.8],
  strained: ["content", 0.8],
};

export function scoreSentiment(message: string): SentimentResult {
  const lower = ` ${message.toLowerCase().replace(/[.!?;,]+/g, " ")} `;
  const tokens: string[] = [];
  {
    const re = /[a-z']+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) tokens.push(m[0]);
  }
  const scores: Record<string, number> = {};
  const intensified = new Set<string>();
  const add = (cat: SentimentCategory, w: number) => {
    scores[cat] = (scores[cat] ?? 0) + w;
  };
  /** Window check over the tokens just before token index `idx`. */
  const windowMods = (idx: number): { negated: boolean; mult: number } => {
    let negated = false;
    let mult = 1;
    let damp: number | null = null;
    for (let i = Math.max(0, idx - 3); i < idx; i++) {
      const t = tokens[i]!;
      if (SENTIMENT_NEGATIONS.has(t)) negated = true;
      if (i >= idx - 2) {
        const inten = SENTIMENT_INTENSIFIERS[t];
        if (inten) mult = Math.max(mult, inten);
        const d = SENTIMENT_DAMPENERS[t];
        if (d) damp = damp === null ? d : Math.min(damp, d);
      }
    }
    // "a bit" / "a little" just before the word dampen it too.
    const prev2 = `${tokens[idx - 2] ?? ""} ${tokens[idx - 1] ?? ""}`;
    if (prev2 === "a bit" || prev2 === "a little") damp = damp === null ? 0.6 : Math.min(damp, 0.6);
    if (damp !== null) mult = damp;
    return { negated, mult };
  };
  const applyHit = (cat: SentimentCategory, weight: number, tokenIdx: number) => {
    const { negated, mult } = windowMods(tokenIdx);
    if (mult > 1) intensified.add(cat);
    if (negated) {
      const [ncat, nscale] = SENTIMENT_NEGATED[cat];
      add(ncat, weight * nscale);
    } else {
      add(cat, weight * mult);
    }
  };
  // Phrases first (longest wins the span); their tokens are then
  // skipped by the single-word pass so nothing double-counts.
  const consumed = new Set<number>();
  const phrases = [...SENTIMENT_PHRASES].sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, cat, weight] of phrases) {
    const at = lower.indexOf(` ${phrase} `);
    if (at < 0) continue;
    // Token index nearest the phrase start.
    let approx = 0;
    {
      const before = lower.slice(0, at).match(/[a-z']+/g);
      approx = before ? before.length : 0;
    }
    applyHit(cat, weight, approx);
    const phraseTokens = phrase.split(" ").length;
    for (let i = approx; i < approx + phraseTokens; i++) consumed.add(i);
  }
  tokens.forEach((tok, i) => {
    if (consumed.has(i)) return;
    const hit = SENTIMENT_WORDS[tok];
    if (hit) applyHit(hit[0], hit[1], i);
  });
  const ranked = (Object.entries(scores) as [SentimentCategory, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  const none: SentimentResult = {
    weather: "none",
    intensity: "none",
    confidence: 0,
    scores,
  };
  if (!top) return none;
  const [topCat, topScore] = top;
  if (topScore < 1.6) return none;
  if (tokens.length <= 2 && topScore < 3) return none;
  const margin = (topScore - (second?.[1] ?? 0)) / topScore;
  const confidence = Math.min(
    1,
    0.35 + 0.4 * Math.min(1, topScore / 4) + 0.25 * margin,
  );
  if (confidence < 0.45) return none;
  const strong = topScore >= 3.4 || (topScore >= 2.8 && intensified.has(topCat));
  return {
    weather: topCat,
    intensity: strong ? "strong" : "mild",
    confidence,
    scores,
  };
}

export function isHeavyWeather(w: SentimentWeather): boolean {
  return w === "low" || w === "strained" || w === "weary";
}

// --- Fact extraction ---------------------------------------------------

function cleanFactClause(raw: string): string | null {
  const s = raw.replace(/\s+/g, " ").trim().replace(/[.!?\s]+$/, "");
  if (s.length < 3 || s.length > 90) return null;
  if (/^(yes|no|ok|okay|hi|hello|hey|thanks|thank you)$/i.test(s)) return null;
  return s;
}

function capSentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

/** Light first-person → third-person transform for "remember …"
 *  clauses. Returns null when the clause carries no first-person
 *  marker to anchor the transform on. */
function transformFirstPerson(clause: string, who: Pronouns): string | null {
  if (!/\b(i|i'm|i am|my|mine|we|our)\b/i.test(clause)) return null;
  const out = clause
    .replace(/\bi am\b/gi, `${who.he} is`)
    .replace(/\bi'm\b/gi, `${who.he} is`)
    .replace(/\bi have\b/gi, `${who.he} has`)
    .replace(/\bi love\b/gi, `${who.he} loves`)
    .replace(/\bi like\b/gi, `${who.he} likes`)
    .replace(/\bi hate\b/gi, `${who.he} hates`)
    .replace(/\bi live\b/gi, `${who.he} lives`)
    .replace(/\bi work\b/gi, `${who.he} works`)
    .replace(/\bi\b/gi, who.he)
    .replace(/\bmy\b/gi, who.his)
    .replace(/\bmine\b/gi, who.hers)
    .replace(/\bwe\b/gi, "they")
    .replace(/\bour\b/gi, "their");
  return capSentence(out);
}

/** Conservative extraction: returns a canonical fact for a typed
 *  line, or null. Patterns are explicit statements only. */
export function extractFact(message: string, who: Pronouns = PLAYER): { text: string; topic: string } | null {
  const m = message.trim();
  const cap = (re: RegExp) => m.match(re);
  let hit = cap(/\bremember (?:that|this)[:,]?\s+(.+)/i);
  if (hit?.[1]) {
    const clause = cleanFactClause(hit[1]);
    if (clause) {
      const t = transformFirstPerson(clause, who);
      return { text: t ?? `${who.He} asked her to remember: “${clause}.”`, topic: "life" };
    }
  }
  hit = cap(/\bmy favou?rite ([a-z][a-z ]{1,22}?) is ([^.!?]{2,60})/i);
  if (hit) {
    const c = cleanFactClause(hit[2]!);
    if (c) return { text: `${who.His} favourite ${hit[1]!.trim()} is ${c}.`, topic: "tastes" };
  }
  hit = cap(/\bi (?:really )?(love|like|adore|enjoy) ([^.!?]{2,60})/i);
  if (hit) {
    const c = cleanFactClause(hit[2]!);
    const verb = { love: "loves", like: "likes", adore: "adores", enjoy: "enjoys" }[hit[1]!.toLowerCase()];
    if (c && verb) return { text: `${who.He} ${verb} ${c}.`, topic: "tastes" };
  }
  hit = cap(/\bi (hate|dislike|can't stand|don’t like|don't like) ([^.!?]{2,60})/i);
  if (hit) {
    const c = cleanFactClause(hit[2]!);
    const v = hit[1]!.toLowerCase();
    const verb = v === "hate" ? "hates" : v === "dislike" ? "dislikes" : v.includes("stand") ? "can't stand" : "doesn't like";
    if (c) return { text: `${who.He} ${verb} ${c}.`, topic: "tastes" };
  }
  hit = cap(/\bi live in ([^.!?]{2,60})/i);
  if (hit) {
    const c = cleanFactClause(hit[1]!);
    if (c) return { text: `${who.He} lives in ${c}.`, topic: "life" };
  }
  hit = cap(/\bi (?:work|am working) (at|for) ([^.!?]{2,60})/i);
  if (hit) {
    const c = cleanFactClause(hit[2]!);
    if (c) return { text: `${who.He} works ${hit[1]!.toLowerCase()} ${c}.`, topic: "work" };
  }
  hit = cap(/\bmy job is ([^.!?]{2,60})/i);
  if (hit) {
    const c = cleanFactClause(hit[1]!);
    if (c) return { text: `${who.His} job is ${c}.`, topic: "work" };
  }
  hit = cap(/\bi'?m planning (?:to|on) ([^.!?]{2,70})/i);
  if (hit) {
    const c = cleanFactClause(hit[1]!);
    if (c) return { text: `${who.He} is planning to ${c}.`, topic: "plans" };
  }
  hit = cap(/\bi hope to ([^.!?]{2,70})/i);
  if (hit) {
    const c = cleanFactClause(hit[1]!);
    if (c) return { text: `${who.He} hopes to ${c}.`, topic: "plans" };
  }
  hit = cap(/\bmy (wife|husband|partner)(?:'s name)? is ([A-Z][a-z]{1,24})\b/);
  if (hit) return { text: `${who.His} ${hit[1]!.toLowerCase()} is named ${hit[2]}.`, topic: "family" };
  hit = cap(/\bmy (daughter|son) ([A-Z][a-z]{1,24})\b/);
  if (hit) return { text: `${who.His} ${hit[1]!.toLowerCase()} is named ${hit[2]}.`, topic: "family" };
  hit = cap(/\bi have a (dog|cat) named ([A-Z][a-z]{1,24})\b/i);
  if (hit) return { text: `${who.He} has a ${hit[1]!.toLowerCase()} named ${hit[2]}.`, topic: "family" };
  hit = cap(/\bmy birthday is ([^.!?]{3,30})/i);
  if (hit) {
    const c = cleanFactClause(hit[1]!);
    if (c) return { text: `${who.His} birthday is ${c}.`, topic: "life" };
  }
  hit = cap(/\bi grew up in ([^.!?]{2,50})/i);
  if (hit) {
    const c = cleanFactClause(hit[1]!);
    if (c) return { text: `${who.He} grew up in ${c}.`, topic: "life" };
  }
  return null;
}
