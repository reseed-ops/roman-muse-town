// Their home's keepsakes (Task 40, a playable home): things they did
// together, shown in the house where he chooses. Each keepsake is earned
// by something already in the town's state (a fish, a letter, the
// summit night) and fits one kind of spot: a wall, a shelf, or the
// floor. Shared by the server (which keeps the arrangement and checks
// the ids) and the client (which knows what is earned and draws them).
// Cosmetic only: no keepsake pays, costs, or unlocks anything.

export type HomeMount = "wall" | "shelf" | "floor";

export const HOME_SLOTS = [
  { id: "wall-back", label: "Above the bed", mount: "wall" },
  { id: "wall-side", label: "The side wall", mount: "wall" },
  { id: "shelf-left", label: "The shelf, left", mount: "shelf" },
  { id: "shelf-right", label: "The shelf, right", mount: "shelf" },
  { id: "table", label: "The lamp table", mount: "shelf" },
  { id: "floor", label: "By the door", mount: "floor" },
] as const satisfies readonly { id: string; label: string; mount: HomeMount }[];

export type HomeSlotId = (typeof HOME_SLOTS)[number]["id"];

export const HOME_KEEPSAKES = [
  { id: "star-chart", label: "The Two Lanterns, charted", mount: "wall", earnedBy: "the night the stars fell, at the summit" },
  { id: "inscription-rubbings", label: "Rubbings of the inscriptions", mount: "wall", earnedBy: "reading every inscription in town" },
  { id: "fish-plaque", label: "A plaque for his best catch", mount: "wall", earnedBy: "catching a fish" },
  { id: "postcard-frame", label: "A framed postcard", mount: "wall", earnedBy: "keeping a postcard" },
  { id: "golden-carp-bowl", label: "The golden carp, in a bowl", mount: "shelf", earnedBy: "catching the golden carp" },
  { id: "letter-bundle", label: "Her letters, tied with a ribbon", mount: "shelf", earnedBy: "a letter from her" },
  { id: "phoenix-feather", label: "A phoenix feather in a vase", mount: "shelf", earnedBy: "a feather from the phoenix" },
  { id: "terrace-lantern", label: "A small lantern from the terrace", mount: "shelf", earnedBy: "the first kiss at the terrace" },
  { id: "harvest-basket", label: "A basket from the garden", mount: "floor", earnedBy: "a harvest from the garden" },
  { id: "tree-cutting", label: "A cutting of the Town Tree, potted", mount: "floor", earnedBy: "watering the Town Tree seven times" },
  { id: "first-coin", label: "The first coin, from the shop", mount: "shelf", earnedBy: "the first sale at the Etsy shop quest" },
  { id: "night-lamp", label: "The lamp they kept lit", mount: "shelf", earnedBy: "their first night together" },
] as const satisfies readonly { id: string; label: string; mount: HomeMount; earnedBy: string }[];

export type HomeKeepsakeId = (typeof HOME_KEEPSAKES)[number]["id"];

/** slot id -> keepsake id */
export type HomeArrangement = Partial<Record<HomeSlotId, HomeKeepsakeId>>;

export const isHomeSlot = (id: string): id is HomeSlotId => HOME_SLOTS.some((s) => s.id === id);
export const isHomeKeepsake = (id: string): id is HomeKeepsakeId => HOME_KEEPSAKES.some((k) => k.id === id);

/** Can this keepsake stand in this spot? */
export function fits(slot: HomeSlotId, keepsake: HomeKeepsakeId): boolean {
  const s = HOME_SLOTS.find((x) => x.id === slot);
  const k = HOME_KEEPSAKES.find((x) => x.id === keepsake);
  return !!s && !!k && s.mount === k.mount;
}

/** Place (or clear) one spot; a keepsake stands in one spot at a time,
 *  so placing it elsewhere moves it. Invalid moves change nothing. */
export function arrange(current: HomeArrangement, slot: string, keepsake: string | null): HomeArrangement {
  if (!isHomeSlot(slot)) return current;
  const next: HomeArrangement = { ...current };
  if (keepsake === null) {
    delete next[slot];
    return next;
  }
  if (!isHomeKeepsake(keepsake) || !fits(slot, keepsake)) return current;
  for (const s of Object.keys(next) as HomeSlotId[]) if (next[s] === keepsake) delete next[s];
  next[slot] = keepsake;
  return next;
}

/** Read a stored arrangement, dropping anything no longer valid. */
export function readArrangement(raw: unknown): HomeArrangement {
  let out: HomeArrangement = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [slot, keepsake] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof keepsake === "string") out = arrange(out, slot, keepsake);
  }
  return out;
}
