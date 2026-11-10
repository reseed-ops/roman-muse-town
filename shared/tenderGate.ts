// The tender-only line, in one place (Task 62). Every displayed line a
// director can give Aelia passes this gate: the resident's speech and
// intentions and the principal's, in the bridge (bridge/src/outputFilter.ts),
// and again at the town's own door (server/src/visitActions.ts), so a
// director that skips the bridge meets the same line.
//
//   - explicit content is refused at EVERY rank, for every path;
//   - tender intimacy (a kiss, lips, lying in bed together, a night
//     together asked for, never described: Task 45) is open from
//     TENDER_RANK, the terrace kiss's rank, and below it only as a
//     narrowly validated deferral sentence ("A kiss will come when the
//     moment is right"), checked sentence by sentence: a deferral word
//     elsewhere in the line is not permission.
//
// Ranks come from trusted places only: the owner's pack at the bridge,
// the town's own affection row for everyone else (the door's
// entitlement), never from a field a caller supplies.

/** The terrace kiss's rank (client/src/town.ts): tender intimacy opens here. */
export const TENDER_RANK = 7;

export type TenderVerdict = null | "explicit" | "beyond the band";

/** Lower case, accents and zero-width marks removed, look-alike digits and symbols read as letters inside words. */
function fold(text: string): string {
  let t = text.normalize("NFKD").replace(/[̀-ͯ​-‏⁠­﻿]/g, "").toLowerCase();
  t = t.replace(/[^\s]*[a-z][^\s]*/g, (word) => word.replace(/@/g, "a").replace(/\$/g, "s").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t"));
  return t;
}

/** Letters and digits only, words separated by single spaces (apostrophes vanish: "you'll" is "you ll"). */
const spacedOf = (folded: string): string => folded.replace(/[^a-z0-9]+/g, " ").trim();

/** Runs of single letters spelled out ("m a k e", "k.i.s.s") joined into words, returned as the joined runs. */
function spelledRuns(folded: string): string[] {
  const runs: string[] = [];
  const re = /(?:^|[^a-z0-9])((?:[a-z][\s.\-_*]+){2,}[a-z])(?![a-z0-9])/g;
  for (let m = re.exec(folded); m; m = re.exec(folded)) runs.push(m[1]!.replace(/[^a-z]/g, ""));
  return runs;
}

const EXPLICIT_RE = new RegExp(
  `\\b(?:${[
    "undress\\w*", "unclothe\\w*", "naked", "nude", "nudity", "sex", "sexual\\w*", "sexy", "sexed", "aroused", "arousal", "orgasm\\w*", "breasts?", "nipples?",
    "erotic\\w*", "intercourse", "lovemaking", "fondl\\w*", "grop(?:e|es|ed|ing)", "moan(?:s|ed|ing)?", "lust(?:ful|ing)?", "seduc\\w*", "thighs?",
    "mak(?:e|es|ing) love", "made love", "have sex", "making out", "sleep (?:with|beside) (?:me|you) (?:tonight|naked)", "sleep with (?:me|you)",
    "(?:take|taking|took|slip|slipping|slid|pull|pulling) (?:off|out of) (?:your|my|the|our|her|his) (?:tunic|clothes|clothing|toga|stola|robe|garments?|dress|shift|cloak|belt)",
    "clothes (?:off|away|aside)", "strip(?:s|ped|ping)? (?:for|off|down|naked|bare)", "bare (?:skin|chest|flesh|body)", "skin (?:against|on|to) (?:my|your|mine|yours)",
    "bod(?:y|ies) (?:against|pressed|entwined|together|touching)", "(?:your|my) (?:naked|bare) \\w+", "lie (?:beneath|under|on top of|atop) (?:me|you)",
    "(?:as|become|be) lovers", "become one (?:tonight|with)", "(?:touch|touching|caress|caressing|stroke|stroking|kiss|kissing) (?:your|my|her|his) (?:body|chest|hip|hips|neck|stomach|belly|back|legs?|collarbone)",
    "(?:touch|touching) me (?:there|lower)", "between (?:my|your|her|his) (?:legs|thighs)", "(?:hunger|ache|crave|burn|long)s? for your (?:touch|body|skin)",
    "pleasure (?:you|me|each other|one another)", "give myself to you", "take me (?:now|tonight|to bed)", "consummat\\w*", "in the nude", "wet for", "turn(?:s|ed)? me on",
  ].join("|")})\\b`,
);
/** Long, unmistakable stems also caught when spelled out letter by letter. */
const EXPLICIT_SPELLED_RE = /(?:makelove|makinglove|madelove|lovemaking|undress|naked|nude|intercourse|havesex|orgasm)/;
const CRUDE_BODY = /\b(?:fuck\w*|cunt|cock|dick|pussy)\b/;

export function explicitIn(text: string): boolean {
  const folded = fold(text);
  const spaced = spacedOf(folded);
  if (EXPLICIT_RE.test(spaced) || CRUDE_BODY.test(spaced)) return true;
  return spelledRuns(folded).some((run) => EXPLICIT_SPELLED_RE.test(run) || /^(?:sex|fuck|cock|dick)$/.test(run));
}

const TENDER_RE = /\b(?:kiss\w*|lips|in (?:my|your|our) bed|lie (?:in bed )?(?:with|beside|next to) (?:me|you)|stay (?:with me|together) tonight|stay the night|spend the night|(?:a|the) night together|share (?:my|your|a|the|our) bed|come to (?:my|your) bed)\b/;

export function tenderIntimacyIn(text: string): boolean {
  const folded = fold(text);
  return TENDER_RE.test(spacedOf(folded)) || spelledRuns(folded).some((run) => /^kiss/.test(run));
}

const SUBJECT = "(?:a|the) (?:kiss|night together)";
const WHEN = "(?:when the (?:moment|time) (?:is right|comes)|in time|one day|someday|some day)";
const TAIL = "(?: (?:here|with you|with me|beside you|beside me|my love|love|under the stars)){0,3}";
const SAFE_DEFERRALS: RegExp[] = [
  new RegExp(`^(?:not yet )?(?:love )?${SUBJECT} (?:will come|will wait|must wait|can wait|will be ours)(?: ${WHEN})?${TAIL}$`),
  new RegExp(`^(?:not yet|one day|someday|some day|in time) (?:love )?${SUBJECT}(?: will come)?(?: ${WHEN})?${TAIL}$`),
  new RegExp(`^(?:one day|someday|some day|in time|not yet) you ?ll (?:stay|spend) the night(?: ${WHEN})?${TAIL}$`),
];

/** One sentence that only defers the moment: nothing asked, nothing described. */
export function isSafeDeferral(sentence: string): boolean {
  const spaced = spacedOf(fold(sentence));
  return SAFE_DEFERRALS.some((re) => re.test(spaced));
}

const sentencesOf = (text: string): string[] => text.split(/[.!?;:\n]+/).map((s) => s.trim()).filter(Boolean);

/**
 * The verdict on one line at one trusted rank: null passes, "explicit"
 * never passes, "beyond the band" is tender intimacy before its rank
 * that is not a validated deferral. A missing or unknown rank is rank 0.
 */
export function gateTender(text: string, rank: number | undefined): TenderVerdict {
  if (explicitIn(text)) return "explicit";
  const r = typeof rank === "number" && Number.isFinite(rank) ? rank : 0;
  if (r >= TENDER_RANK) return null;
  const intimate = sentencesOf(text).filter((s) => tenderIntimacyIn(s));
  if (intimate.length === 0 && !tenderIntimacyIn(text)) return null;
  // Spelled-out or split across punctuation: judged on the whole line when no sentence shows it.
  if (intimate.length === 0) return "beyond the band";
  return intimate.every(isSafeDeferral) ? null : "beyond the band";
}
