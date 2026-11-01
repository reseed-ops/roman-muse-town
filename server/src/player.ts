// Who walks the town. The one switch a new town sets for a woman
// player: everything that speaks ABOUT the player reads through here.
// The name is separate: "Gaius" and the centurion's body are content
// a receiving Muse changes with their person (INSTALL-FOR-MUSE.md).

export type PlayerPronoun = "he" | "she";

export const PLAYER_PRONOUN: PlayerPronoun = "he";

export interface Pronouns {
  he: string;
  He: string;
  him: string;
  his: string;
  His: string;
  hers: string;
  woman: boolean;
}

const HE: Pronouns = { he: "he", He: "He", him: "him", his: "his", His: "His", hers: "his", woman: false };
const SHE: Pronouns = { he: "she", He: "She", him: "her", his: "her", His: "Her", hers: "hers", woman: true };

export function pronounsFor(p: PlayerPronoun): Pronouns {
  return p === "she" ? SHE : HE;
}

export const PLAYER: Pronouns = pronounsFor(PLAYER_PRONOUN);

const SWAPS: [RegExp, string][] = [
  [/\bhe\b/g, "she"],
  [/\bHe\b/g, "She"],
  [/\bhim\b/g, "her"],
  [/\bHim\b/g, "Her"],
  [/\bhis\b/g, "her"],
  [/\bHis\b/g, "Her"],
  [/\bhimself\b/g, "herself"],
  [/\bman\b/g, "woman"],
  [/\bMan\b/g, "Woman"],
];

/** Re-gender text authored around a male player. A blanket swap, so
 *  use it ONLY on text where every he/him/his is the player: never on
 *  anything holding the player's own words, Aelia's past replies, or a
 *  line about Basil or Pip. */
export function aboutPlayer(text: string, who: Pronouns = PLAYER): string {
  if (!who.woman) return text;
  return SWAPS.reduce((s, [re, to]) => s.replace(re, to), text);
}
