// The rain's slow mood: one drifting swell that the sound and the
// streaks both follow, so a shower breathes as a single thing. Pure
// code, with no scene or audio in it, so it can be tested on its own.

/** 0..1, drifting between drizzle and steady rain over about a minute.
 *  Two unrelated periods, so the pattern never visibly repeats. */
export function rainSwell(seconds: number): number {
  const slow = Math.sin((seconds * 2 * Math.PI) / 97);
  const quick = Math.sin((seconds * 2 * Math.PI) / 47 + 1.3);
  return Math.min(1, Math.max(0, 0.5 + slow * 0.32 + quick * 0.18));
}

/** How hard it is raining right now, from the weather's own amount. A
 *  lull is still rain: it thins, it never stops. */
export function rainIntensity(amount: number, swell: number): number {
  return amount * (0.5 + swell * 0.5);
}

/** Seconds until the next droplet tick: random gaps, closer together as
 *  the rain builds, because an even rhythm reads as a machine. */
export function dropletDelay(intensity: number, random: () => number): number {
  const perSecond = 2.5 + intensity * 11;
  return Math.min(1.2, -Math.log(1 - random() * 0.999) / perSecond);
}

/** Seconds until the next slow drip off an eave. */
export function dripDelay(random: () => number): number {
  return 5 + random() * 9;
}

/** Keep a drop inside the box around the viewer, so the rain stays
 *  gathered where it is seen as the viewer walks. */
export function wrapAround(value: number, centre: number, half: number): number {
  const span = half * 2;
  return centre + ((((value - centre + half) % span) + span) % span) - half;
}

/** Somewhere the rain doesn't reach: a spot, and the radius of its roof. */
export type Shelter = [x: number, z: number, radius: number];

/** 1 under a roof, easing to 0 over a couple of paces beyond it. */
export function shelterAmount(x: number, z: number, shelters: readonly Shelter[]): number {
  let best = 0;
  for (const [sx, sz, radius] of shelters) {
    best = Math.max(best, Math.min(1, Math.max(0, 1 - (Math.hypot(x - sx, z - sz) - radius) / 2)));
  }
  return best;
}

/** Filter cutoff for rain heard from under a roof: open at 0, rounded
 *  and low at 1. */
export function shelterCutoff(amount: number): number {
  return 16000 * Math.pow(1100 / 16000, Math.min(1, Math.max(0, amount)));
}

/** She mentions the roof while it rains, before you've found it. */
export const SHELTER_HINT_LINE =
  "There's a sound roof on the lake pavilion, if you'd like to sit this out and listen to it. I'd like that.";

/** And says these once you're under one. */
export const SHELTERED_LINES = [
  "There. Dry as a scroll, and the whole sky drumming just out of reach.",
  "No hurry at all now. It can rain as long as it likes.",
  "I think rain sounds best from exactly here, a step inside the edge of it.",
  "Stay a while. The town doesn't need us until it stops.",
];
