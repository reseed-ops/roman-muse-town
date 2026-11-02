/** Actions whose effects and request receipts commit in the same transaction. */
export const RETRY_SAFE_ACTIONS = [
  "markFound", "markQuestDone", "recordGift", "claimPerk", "foragePick",
  "awardOnce", "buyUpgrade", "buyIngredient", "cookDish", "buySeeds",
  "plantGarden", "waterGarden", "harvestGarden", "recordCatch", "sellFish",
  "releaseFish", "settleKnucklebones", "completeChallenge", "markInscription", "earnAffection", "pantryCatch",
] as const;

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
