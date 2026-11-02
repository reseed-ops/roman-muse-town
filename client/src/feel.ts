// The town's feel, in one place. Each of these was set by reasoning, not
// by ear or eye, so expect to adjust them after playing.

export const FEEL = {
  /** Loudness of the rain's droplet ticks. Lower if they read as clicks. */
  dropletVolume: 0.6,
  /** How far rain lifts the lamps by day, 0..1. Lower if the plaza glows. */
  rainLampGlow: 0.3,
  /** How often Aelia reaches for a Roman line when nothing else is
   *  claiming the moment, 0..1. */
  romanLineChance: 0.25,
  /** How much a roof muffles the rain, 0 (not at all) to 1 (heavily). */
  shelterMuffle: 1,
  /** Loudness of his footsteps. Lower if they start to nag. */
  stepVolume: 0.5,
} as const;
