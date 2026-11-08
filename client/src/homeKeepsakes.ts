// Which of the home's keepsakes he has earned (Task 40): each comes
// from something already in the town's state, nothing new to grind.
import type { HomeKeepsakeId } from "../../shared/homeDecor";

/** The few parts of the town's state the keepsakes read. */
export type KeepsakeState = {
  fish: { fish_id: string }[];
  letters: unknown[];
  postcards: unknown[];
  inscriptions_complete: boolean;
  summit: { done: boolean };
  phoenix: { feathers: number };
  secret: { first_kiss: string | null };
  garden: { harvests: number };
  tree: { waterings: number };
};

export function earnedKeepsakes(s: KeepsakeState): Set<HomeKeepsakeId> {
  const out = new Set<HomeKeepsakeId>();
  if (s.summit.done) out.add("star-chart");
  if (s.inscriptions_complete) out.add("inscription-rubbings");
  if (s.fish.length > 0) out.add("fish-plaque");
  if (s.postcards.length > 0) out.add("postcard-frame");
  if (s.fish.some((f) => f.fish_id === "golden-carp")) out.add("golden-carp-bowl");
  if (s.letters.length > 0) out.add("letter-bundle");
  if (s.phoenix.feathers > 0) out.add("phoenix-feather");
  if (s.secret.first_kiss) out.add("terrace-lantern");
  if (s.garden.harvests > 0) out.add("harvest-basket");
  if (s.tree.waterings >= 7) out.add("tree-cutting");
  return out;
}
