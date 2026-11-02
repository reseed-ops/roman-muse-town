import type { TownState } from "./useTownState";

export type ArrivalDestination = "letters" | "garden" | "tree" | "quests";
export interface ArrivalMarker { day: string; lastLetterId: number }
export interface ArrivalSummary { title: string; lines: string[]; suggestion: string; destination: ArrivalDestination; quiet: boolean }
export function utcDay(now: Date): string { return now.toISOString().slice(0, 10); }

export function buildArrivalSummary(state: TownState, previous: ArrivalMarker | null, now = new Date()): ArrivalSummary {
  const unread = state.letters.filter((letter) => !letter.read);
  const newLetters = unread.filter((letter) => previous && letter.id > previous.lastLetterId).length;
  const harvest = !!state.garden.planted_on && state.garden.water_days >= 3;
  const lines: string[] = [];
  if (newLetters) lines.push(`${newLetters} new ${newLetters === 1 ? "letter is" : "letters are"} waiting at the desk.`);
  else if (unread.length) lines.push(`${unread.length} unread ${unread.length === 1 ? "letter is" : "letters are"} waiting at the desk.`);
  if (harvest) lines.push("Your garden is ready to harvest.");
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const festivals = state.festivals.flatMap((festival) => {
    if (!/^\d{2}-\d{2}$/.test(festival.month_day)) return [];
    const [month, day] = festival.month_day.split("-").map(Number) as [number, number];
    let date = new Date(Date.UTC(now.getUTCFullYear(), month - 1, day));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return [];
    if (date.getTime() < midnight) date = new Date(Date.UTC(now.getUTCFullYear() + 1, month - 1, day));
    const days = Math.round((date.getTime() - midnight) / 86400000);
    return days <= 7 ? [{ name: festival.name, days }] : [];
  }).sort((a, b) => a.days - b.days);
  if (festivals[0]) lines.push(`${festivals[0].name} ${festivals[0].days === 0 ? "is today" : festivals[0].days === 1 ? "is tomorrow" : `is in ${festivals[0].days} days`}.`);
  const quiet = !lines.length;
  if (quiet) lines.push("The town is quiet. There is time for one small ritual.");
  const destination = unread.length ? "letters" : harvest ? "garden" : !state.tree.watered_today ? "tree" : "quests";
  const suggestion = { letters: "Read a letter", garden: "Visit the garden", tree: "Water the Town Tree", quests: "Choose a small quest" }[destination];
  return { title: previous ? "Since your last visit" : "Welcome to your town", lines, suggestion, destination, quiet };
}
