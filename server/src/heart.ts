// Aelia's heart: pure logic, with no database and no SDK, so it can be
// tested on its own. Ported from the Edo prototype's emotion_state.gd
// and companion_memory.gd, and bent to this town's one promise: the
// bond only rises. So there is no irritation, no hurt, and no belief
// that turns against him. Nothing here grants or removes affection,
// triggers friction, or gates anything, and no feeling is ever shown
// as a number or a label.

import type { SentimentIntensity, SentimentWeather } from "./hearing";
import { isHeavyWeather } from "./hearing";

// --- Feelings: how she is today -----------------------------------------

export interface Feelings {
  warmth: number;
  joy: number;
  concern: number;
}

const FADE_PER_DAY = 8;
/** A feeling below this reads as not felt right now. */
const NEUTRAL = 14;

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Fold one message's weather into her feelings. Unlike the sentiment
 *  note, which answers THIS message, these outlast it: she can still be
 *  worried tomorrow. His joy eases her worry; nothing else does but time. */
export function feelSentiment(
  f: Feelings,
  weather: SentimentWeather,
  intensity: SentimentIntensity,
): Feelings {
  const s = intensity === "strong" ? 2 : 1;
  if (weather === "bright")
    return { warmth: clamp(f.warmth + 5 * s), joy: clamp(f.joy + 15 * s), concern: clamp(f.concern - 10 * s) };
  if (weather === "warm")
    return { ...f, warmth: clamp(f.warmth + 15 * s), joy: clamp(f.joy + 5 * s) };
  if (weather === "content") return { ...f, warmth: clamp(f.warmth + 5 * s) };
  if (isHeavyWeather(weather)) return { ...f, concern: clamp(f.concern + 20 * s) };
  return f;
}

/** Fade toward calm over `days` real days. */
export function fadeFeelings(f: Feelings, days: number): Feelings {
  const d = Math.max(0, days) * FADE_PER_DAY;
  return { warmth: clamp(f.warmth - d), joy: clamp(f.joy - d), concern: clamp(f.concern - d) };
}

/** A short prompt phrase for her mood, or "" when calm. Concern comes
 *  first, and how openly she shows it follows his closeness rank. */
export function moodLine(f: Feelings, rank: number): string {
  if (f.concern > NEUTRAL) {
    if (rank >= 6)
      return "You are still a little worried for him from these past days. It sits close to the surface: look after him, without fussing.";
    if (rank <= 2)
      return "You have noticed he has been carrying something lately. You keep your distance, but you are gentler with him for it.";
    return "He has been on your mind these past days, and you are quietly watching over him.";
  }
  if (f.joy > f.warmth && f.joy > NEUTRAL)
    return "You are in good spirits today, still lit by something glad he shared.";
  if (f.warmth > NEUTRAL) return "You feel fond of him today, within what your closeness allows.";
  return "";
}

// --- Reflection: what she comes to believe -------------------------------
// Each new day she folds what she noticed into a few durable beliefs and
// lets the counted days go, so memory stays small. Deterministic: no
// model call, so it works in the offline build, where no outside Muse
// visits each morning to keep her current.

export type EpisodeKind = "WARM" | "BRIGHT" | "HEAVY" | "WATERED";
export type Episodes = Partial<Record<EpisodeKind, number>>;

export type BeliefKey = "steady" | "shares-joy" | "tends" | "hard-stretch" | "came-through";

/** In the same third person as her other facts, which is how they read
 *  on the Villa's memory list, where he can make her forget any of them. */
export const BELIEFS: Record<BeliefKey, string> = {
  steady: "He has been steadily fond of her, and she has come to rely on it.",
  "shares-joy": "He brings his good days to her, and she has come to expect it.",
  tends: "He keeps the small rituals faithfully, and she has noticed.",
  "hard-stretch": "He has been going through a hard stretch.",
  "came-through": "He came through a hard stretch, and she stayed beside him for it.",
};

/** The same beliefs as she holds them, for the chat prompt. */
export const BELIEF_VOICE: Record<BeliefKey, string> = {
  steady: "He has been steadily fond of you, and you have come to rely on it.",
  "shares-joy": "He brings his good days to you, and you have come to expect it.",
  tends: "He keeps the small rituals faithfully, and you have noticed.",
  "hard-stretch": "He has been going through a hard stretch.",
  "came-through": "He came through a hard stretch, and you stayed beside him for it.",
};

const WARM_DAYS = 3;
const BRIGHT_DAYS = 3;
const WATERED_DAYS = 5;
const HEAVY_DAYS = 2;
const RECOVERY_DAYS = 2;

export interface Reflection {
  episodes: Episodes;
  add: BeliefKey[];
  remove: BeliefKey[];
}

/** Turn counted days into beliefs. Counts folded into a belief are
 *  spent, held beliefs are never added twice, and a belief he made her
 *  forget stays in `held`, so it does not grow back. A hard stretch
 *  heals into having come through it, the only rupture and repair this
 *  town has: it is about his days, never about the two of them. If he
 *  made her forget the stretch, she does not bring it back by saying
 *  he came through it. */
export function reflect(
  episodes: Episodes,
  held: readonly BeliefKey[],
  forgotten: readonly BeliefKey[] = [],
): Reflection {
  const left: Episodes = { ...episodes };
  const add: BeliefKey[] = [];
  const remove: BeliefKey[] = [];
  const has = (k: BeliefKey) => held.includes(k);
  const count = (k: EpisodeKind) => left[k] ?? 0;
  const form = (k: BeliefKey, spent: EpisodeKind) => {
    delete left[spent];
    if (!has(k) && !add.includes(k)) add.push(k);
  };
  if (has("hard-stretch") && !forgotten.includes("hard-stretch") && count("BRIGHT") >= RECOVERY_DAYS) {
    remove.push("hard-stretch");
    form("came-through", "BRIGHT");
  } else if (count("HEAVY") >= HEAVY_DAYS) {
    form("hard-stretch", "HEAVY");
  }
  if (count("BRIGHT") >= BRIGHT_DAYS) form("shares-joy", "BRIGHT");
  if (count("WARM") >= WARM_DAYS) form("steady", "WARM");
  if (count("WATERED") >= WATERED_DAYS) form("tends", "WATERED");
  return { episodes: left, add, remove };
}

/** What her ear heard, as a kind of day worth counting. */
export function episodeFor(weather: SentimentWeather): EpisodeKind | null {
  if (weather === "bright") return "BRIGHT";
  if (weather === "warm") return "WARM";
  if (isHeavyWeather(weather)) return "HEAVY";
  return null;
}
