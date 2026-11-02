// How well-kept each part of the estate is, 0 to 1, read straight from what
// the saved town already records, so an old save simply shows its progress.
// Nothing here is stored and nothing can be lost: care only looks back at
// things done. The villa starts modest, never ruined.

export const ESTATE_AREAS = ["avenue", "forecourt", "peristyle", "terrace", "baths", "kitchen"] as const;
export type EstateArea = (typeof ESTATE_AREAS)[number];
export type EstateCare = Record<EstateArea, number>;

export interface CareFacts {
  waterings: number;
  harvests: number;
  questsDone: number;
  found: number;
  inscriptions: number;
  rank: number;
  dishes: number;
  upgrades: readonly string[];
  sharedBath: boolean;
}

const share = (value: number, full: number) => Math.min(1, value / full);
const has = (facts: CareFacts, id: string) => (facts.upgrades.includes(id) ? 1 : 0);

export function estateCare(facts: CareFacts): EstateCare {
  return {
    avenue: share(facts.questsDone, 6) * 0.7 + has(facts, "lanterns") * 0.3,
    forecourt: share(facts.found, 10) * 0.4 + has(facts, "fountain") * 0.6,
    peristyle: share(facts.waterings, 10) * 0.6 + has(facts, "planters") * 0.25 + has(facts, "cobbles") * 0.15,
    terrace: share(facts.rank, 6) * 0.6 + share(facts.inscriptions, 6) * 0.4,
    baths: share(facts.rank, 4) * 0.5 + (facts.sharedBath ? 0.5 : 0),
    kitchen: share(facts.harvests, 4) * 0.6 + share(facts.dishes, 5) * 0.4,
  };
}

/** Rounded to tenths, so the scene only rebuilds when it could show. */
export function careKey(care: EstateCare): string {
  return ESTATE_AREAS.map((area) => Math.round(care[area] * 10)).join(",");
}

/** The weeds a kept area has lost: each stands until care passes its own
 *  threshold, so clearing is gradual. */
export function weedStands(care: number, threshold: number): boolean {
  return care < threshold;
}
