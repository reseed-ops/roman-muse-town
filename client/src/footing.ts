// What is underfoot, and how far apart his steps fall. Pure, so the sound can
// be chosen and tested without a scene.

export type Footing = "stone" | "grass" | "gravel" | "wood" | "water";

export interface FootingFacts {
  onDock: boolean;
  /** How far outside the lake's ellipse he is: 1 is the waterline. */
  lakeNorm: number;
  inForest: boolean;
  streetDistance: number;
  onPaving: boolean;
}

export function footingAt(facts: FootingFacts): Footing {
  if (facts.onDock) return "wood";
  if (facts.lakeNorm < 1.14) return "water";
  if (facts.onPaving || facts.streetDistance < 1.5) return "stone";
  return facts.inForest ? "gravel" : "grass";
}

/** Metres between footfalls at his walk. */
export const STRIDE = 1.7;

/** Add a step's distance; returns the new tally and whether a foot fell. */
export function strideStep(tally: number, moved: number): { tally: number; fell: boolean } {
  const next = tally + moved;
  return next >= STRIDE ? { tally: next % STRIDE, fell: true } : { tally: next, fell: false };
}
