// The town remembers (Task 60): the real calendar's season, and how far the
// town's olive trees have grown. Both are pure functions of a real date, so
// the town needs no clock of its own, no stored state and no migration: open
// it in any season, on any device, and it looks the way the year says.
//
// Season: the northern hemisphere's meteorological seasons by the local
// calendar month (the town sits in Texas and keeps Roman weather), the same
// rule the town tree has always used.
//
// Growth: the olives were "planted" on a FIXED epoch, OLIVES_PLANTED_DAY,
// the day this task landed. A stage is the number of whole real seasons
// (about 91 days) since, so an olive grows one visible step a season and
// reaches its full size after two years. The epoch is a constant, not a
// stored date, on purpose: it is the same on every device and in every
// save, it survives a restore, and it cannot be farmed or rushed. A
// date before the epoch (a clock set back) is stage 0, never negative.

export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASON_ORDER: readonly Season[] = ["spring", "summer", "autumn", "winter"];

/** The season of a real date (local calendar, northern hemisphere). */
export function seasonAt(date: Date): Season {
  const month = date.getMonth(); // 0 = January
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

/** Fireflies keep to the warm nights, and are fullest in summer. */
export function fireflyShare(season: Season): number {
  return season === "summer" ? 1 : season === "spring" ? 0.7 : 0;
}

// --- Olive growth -------------------------------------------------------

/** The day the olives were planted (a fixed epoch, local calendar day). */
export const OLIVES_PLANTED_DAY = "2026-11-10";
/** A season's length in days: one growth step. */
export const OLIVE_DAYS_PER_STAGE = 91;
/** The last stage: two years of seasons, then full grown. */
export const OLIVE_MAX_STAGE = 8;
/** A sapling's size against a full tree, and the full tree's. */
export const OLIVE_MIN_SCALE = 0.4;

const dayNumber = (y: number, m: number, d: number): number => Math.floor(Date.UTC(y, m, d) / 86400000);

/** Whole days from the planting to this date (never negative). */
export function daysSincePlanting(date: Date): number {
  const [py, pm, pd] = OLIVES_PLANTED_DAY.split("-").map(Number) as [number, number, number];
  return Math.max(0, dayNumber(date.getFullYear(), date.getMonth(), date.getDate()) - dayNumber(py, pm - 1, pd));
}

/** The growth stage, 0 to OLIVE_MAX_STAGE: monotonic in the date, one step a season. */
export function oliveStage(date: Date): number {
  return Math.min(OLIVE_MAX_STAGE, Math.floor(daysSincePlanting(date) / OLIVE_DAYS_PER_STAGE));
}

/** The scale of a young olive against the pack's full-grown model, by stage. */
export function oliveScale(stage: number): number {
  const s = Math.max(0, Math.min(OLIVE_MAX_STAGE, Math.floor(stage)));
  return OLIVE_MIN_SCALE + (1 - OLIVE_MIN_SCALE) * (s / OLIVE_MAX_STAGE);
}
