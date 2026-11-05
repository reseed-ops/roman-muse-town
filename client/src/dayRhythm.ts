// The estate's day: where life gathers at this hour, and what is going on
// there. Pure code on top of the Roman calendar, so the scene, the shell and
// Aelia all read the same day. Hours are the Romans' own twelve, so morning
// runs long in June and short in December.

import type { RomanDate } from "./romanDay";

export type DayPart = "morning" | "midday" | "dusk" | "night";
/** Aelia's routine anchors the rhythm can send her to. */
export type RhythmAnchor = "market" | "baths" | "terrace" | "lake" | "forum";

export interface Rhythm {
  /** Changes when the hour's invitation does; repeats day to day. */
  id: string;
  part: DayPart;
  override: "festival" | "market" | null;
  title: string;
  where: string;
  line: string;
  anchor: RhythmAnchor;
  spot: [number, number];
  marketOpen: boolean;
  marketBusy: boolean;
}

const SPOTS: Record<RhythmAnchor, [number, number]> = {
  market: [6.2, 35.2],
  baths: [24, 26.6],
  terrace: [3.6, -27],
  lake: [-9.7, -29.9],
  forum: [3.6, 4.2],
};

export function dayPart(hour: number | null): DayPart {
  if (hour === null) return "night";
  if (hour <= 4) return "morning";
  return hour <= 8 ? "midday" : "dusk";
}

const ORDINARY: Record<DayPart, Pick<Rhythm, "title" | "where" | "line" | "anchor">> = {
  morning: { title: "The morning market", where: "the stalls on the avenue", line: "The stalls are open and the bread is still warm.", anchor: "market" },
  midday: { title: "The hour of the baths", where: "the thermae, east of the avenue", line: "The day's work is done by the Roman clock, and the water is hot.", anchor: "baths" },
  dusk: { title: "Dusk on the terrace", where: "the top of the great stair", line: "The light is going gold along the whole length of the axis.", anchor: "terrace" },
  night: { title: "Night at the lake", where: "the dock, west of the terrace", line: "The stalls are shuttered, and the dock lantern is lit.", anchor: "lake" },
};

export function dayRhythm(hour: number | null, date: RomanDate, festival: string | null): Rhythm {
  const part = dayPart(hour);
  const open = part === "morning" || part === "midday";
  const shared = { part, marketOpen: open, marketBusy: false };
  if (festival && part !== "night") {
    return {
      ...shared,
      id: `festival:${part}`,
      override: "festival",
      title: festival,
      where: "the peristyle",
      line: "The whole estate has come out to the garden.",
      anchor: "forum",
      spot: SPOTS.forum,
      marketOpen: true,
      marketBusy: true,
    };
  }
  if (date.market && open) {
    return {
      ...shared,
      id: `market:${part}`,
      override: "market",
      title: "Market day",
      where: "the stalls on the avenue",
      line: "The country people are in with their baskets, and the avenue is full.",
      anchor: "market",
      spot: SPOTS.market,
      marketBusy: true,
    };
  }
  const plain = ORDINARY[part];
  // The terrace hours run from the ninth; the gold itself comes with
  // the eleventh. Until then the card says afternoon, not dusk (the
  // Nov 5 hosted verification read "Dusk" over full daylight). The
  // part, its anchor and the market's hours are unchanged.
  const titled =
    part === "dusk" && hour !== null && hour <= 10
      ? { ...plain, title: "Afternoon on the terrace", line: "The light is lengthening along the whole length of the axis." }
      : plain;
  return { ...shared, ...titled, id: part, override: null, spot: SPOTS[plain.anchor] };
}
