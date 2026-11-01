// The Roman day: what kind of day it is on the real calendar, and what
// Aelia might say about it. Pure code, with no scene in it, so it can be
// tested on its own.
//
// The facts come from the Rome Life research (docs/research there), and
// each keeps its status from that project's claims register: Attested,
// or Plausible where the detail is reconstruction. A line only plays
// when it is true today: the market line on a market day, the bath line
// at the real eighth hour. History is the reward here, never a test, so
// nothing needs Latin or foreknowledge to enjoy.

export interface RomanDate {
  month: number;
  day: number;
  /** The month's three named days, or null on an ordinary day. */
  marked: "kalends" | "nones" | "ides" | null;
  /** The nundinae, the market day that came round every eighth day. */
  market: boolean;
}

function romeCalendarDay(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** March, May, July and October keep their Nones on the 7th and Ides on
 *  the 15th; every other month on the 5th and 13th. */
const LATE_MONTHS = new Set([3, 5, 7, 10]);

export function romanDate(now: Date): RomanDate {
  const { year, month, day } = romeCalendarDay(now);
  const late = LATE_MONTHS.has(month);
  const marked = day === 1 ? "kalends" : day === (late ? 7 : 5) ? "nones" : day === (late ? 15 : 13) ? "ides" : null;
  // The cycle's real phase is lost, so ours simply counts from the epoch.
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return { month, day, marked, market: ((dayNumber % 8) + 8) % 8 === 0 };
}

const STEP_MS = 10 * 60 * 1000;
const MAX_STEPS = 18 * 6; // a Roman midsummer day is well inside 18 hours

/** Which of the day's twelve hours it is, 1..12, or null at night. The
 *  Romans cut the daylight into twelve whatever its length, so an hour
 *  is long in June and short in December. `elevation` gives the sun's
 *  height at an instant (the town's solar function). */
export function romanHour(now: Date, elevation: (at: Date) => number): number | null {
  if (elevation(now) <= 0) return null;
  const edge = (direction: 1 | -1): number => {
    let at = now.getTime();
    for (let i = 0; i < MAX_STEPS; i++) {
      const next = at + direction * STEP_MS;
      if (elevation(new Date(next)) <= 0) return next;
      at = next;
    }
    return at;
  };
  const sunrise = edge(-1);
  const sunset = edge(1);
  const hour = Math.floor(((now.getTime() - sunrise) / (sunset - sunrise)) * 12) + 1;
  return Math.min(12, Math.max(1, hour));
}

// --- What she says ---------------------------------------------------------

const MARKED_DAY: Record<NonNullable<RomanDate["marked"]>, string[]> = {
  // Attested: fuller household rites on Kalends, Nones and Ides.
  kalends: [
    "The Kalends, love: first of the month. Every house in Rome gives its Lares a little something today, and they are not fussy. Wine, incense, a garland.",
    "New month. The household gods get their due this morning, and I gave mine a sprig of laurel and a brief account of your conduct.",
  ],
  nones: [
    "The Nones today. A quiet marked day: a little incense at the household shrine, and the month carries on.",
    "It's the Nones, Centurion. Not a day that troubles anyone much, but the Lares still expect their garland.",
  ],
  // Attested: the Ides sacred to Jupiter.
  ides: [
    "The Ides, and sacred to Jupiter, every month of the year. One unfortunate March aside, it has a good record.",
    "Ides today, love. Jupiter's day. Stand up straight; I'm told he notices.",
  ],
};

// Attested: country people in town, school off, every eighth day.
const MARKET_DAY = [
  "Market day! The country people are in with their baskets, and the school is shut. Rome counts its weeks by this as much as by anything.",
  "Every eighth day the whole countryside comes in to sell us its cabbages, and the children go free. It's the best kind of noise.",
  "Nundinae, love: the ninth day, as they count it, because Romans count the day they start from. Do not ask me to defend this.",
];

const HOUR_LINES: Record<string, string[]> = {
  // Attested: Martial gives the eighth hour to the baths and exercise.
  bath: [
    "The eighth hour. All of Rome is setting down its work and walking to the baths. We're nothing if not punctual about hot water.",
    "This is bath time, you know. The whole city, every afternoon, at about this hour. It may be our greatest achievement.",
  ],
  // Attested: twelve seasonal daylight hours.
  morning: [
    "First hour of the day, and the sun has only just agreed to it. In Rome the morning belongs to whoever is up.",
  ],
  long: [
    "Twelve hours in a day, summer and winter alike, so a June hour is a generous thing. I recommend spending this one slowly.",
  ],
  short: [
    "We cut the daylight into twelve whatever its length, so a winter hour is a stingy little thing. Walk quickly, or don't, and be late with me.",
  ],
};

type Season = { from: [number, number]; to: [number, number]; lines: string[] };

const SEASONS: Season[] = [
  // Attested: Sirius's rising marks the dog days. Dates approximate.
  { from: [7, 20], to: [8, 20], lines: [
    "The dog days, love. Sirius is up with the sun and all Rome blames him for the heat.",
  ] },
  // Attested: cicadas, the Mediterranean summer's soundtrack.
  { from: [6, 15], to: [8, 31], lines: [
    "Hear the cicadas? They have one opinion and all summer to express it.",
  ] },
  // Plausible: swifts and swallows circling the monuments in season.
  { from: [4, 15], to: [8, 15], lines: [
    "The swifts are back over the rooftops. I like a citizen who keeps a schedule.",
  ] },
  // Attested: Pliny has farmers timing millet by the fireflies.
  { from: [5, 15], to: [6, 30], lines: [
    "Fireflies soon, at dusk. The farmers sow their millet by them. Pliny says so, and Pliny says most things.",
  ] },
  // Attested: the hawk-moth, native and hovering at flowers.
  { from: [5, 1], to: [9, 30], lines: [
    "See that, hanging in the air at the flowers? It looks like a tiny bird and it is a moth. Fern has been fooled twice.",
  ] },
];

// Attested throughout, status noted where it is softer.
const LORE = [
  // No numbered addresses; signs and landmarks. Martial's "ad Pirum".
  "There isn't a numbered door in all Rome. You ask for the sign, or the landmark. A poet once gave his address as At the Pear Tree, and people found him.",
  "If anyone wants you, they'll ask for the centurion by the big tree. That's a complete address here. It's how the whole city works.",
  // No private post; letters by bearer.
  "No one delivers letters in Rome unless you are the emperor. For the rest of us, it's a friend who happens to be going that way.",
  // 1 denarius = 4 sestertii = 16 asses.
  "One denarius, four sestertii, sixteen asses. If Basil tells you otherwise, count again and count slowly.",
  // Honey was the sweetener; there was no sugar.
  "Everything sweet in Rome is honey. Every cake and every sauce. We owe more to bees than we do to several emperors.",
  // Kites as the city's scavenger (uncertainty low-med in the register).
  "Watch that kite over the rooftops. Rome's real street-sweeper, and paid about as well.",
  // Named blocks, e.g. the Insula Felicles.
  "The great tenement blocks have names of their own, like ships. One was so tall they joked about it across the empire.",
  // Compital shrines, vicomagistri (typically freedmen).
  "Every crossroads has its shrine, tended by neighbours chosen for the year, freedmen as often as not. For a year, it's the finest job on the street.",
];

const NIGHT_LORE = [
  // Attested: the pole lay between Polaris and Kochab; north from Cynosura.
  "There's no one star that marks north, you know. Sailors steer by the whole of the Little Bear and hope for the best.",
  // Attested: Aratus, widely read in Latin.
  "All Rome reads its stars out of Aratus. Even Cicero translated him. Nova has opinions about the translation.",
];

/** Added to the matching places' existing line pools. */
export const ROMAN_PLACE_LINES = {
  temple: [
    // Attested: sacrifice happens in front; the cella houses the statue.
    "The altar is out here in the open, you know, not inside. Inside is the god's house. Out here is where the rest of us do our business with the god.",
    // Attested: vows, do ut des.
    "Romans bargain with their gods quite openly. Grant me this, and I'll put up a plaque. It's a very honest sort of prayer.",
  ],
  stars: [
    "Nova reads the whole sky off Aratus and a sundial's shadow. She would tell you the dog star's rising runs the summer.",
  ],
  baths: [
    // Attested: oil and strigil, no soap.
    "No soap in here, love. Oil, a good scrape with the strigil, and a clear conscience.",
    // Attested: the quadrans, proverbially cheap.
    "A quadrans to get in, at any public bath in Rome. A quarter of an as. Emperors and sausage-sellers, in the same steam.",
    // Attested: clothes theft a stock complaint.
    "Keep an eye on your cloak at a public bath. Half the curses in Rome are aimed at someone who stole a tunic from a changing room.",
    // Attested: Seneca Ep. 56, on the noise of a bathhouse.
    "Seneca lodged over a bathhouse once and wrote a whole letter on the racket: the grunters, the splashers, the man selling sausages. We've done rather better.",
  ],
  market: [
    // Attested: painted price lists on walls, not chalkboards.
    "Prices go up in paint on the wall here. If Basil's change, he has to repaint, which is why he argues instead.",
    // Attested: no citrus beyond citron; market produce list.
    "Plums, grapes, figs, pomegranates. If it's on this stall, it grew within a few days of here, or came up the river.",
  ],
} as const;

export interface RomanLinePool {
  /** A stable key for the no-repeat line bag. */
  key: string;
  lines: readonly string[];
}

const inSeason = (s: Season, month: number, day: number): boolean => {
  const at = month * 100 + day;
  return at >= s.from[0] * 100 + s.from[1] && at <= s.to[0] * 100 + s.to[1];
};

/** Every pool of lines that is true right now, the day's own news
 *  first. `hour` is the Roman hour, or null at night. */
export function romanPools(date: RomanDate, hour: number | null): RomanLinePool[] {
  const pools: RomanLinePool[] = [];
  if (date.marked) pools.push({ key: `roman:${date.marked}`, lines: MARKED_DAY[date.marked] });
  if (date.market) pools.push({ key: "roman:market-day", lines: MARKET_DAY });
  if (hour === 1) pools.push({ key: "roman:hour-morning", lines: HOUR_LINES.morning! });
  if (hour === 8 || hour === 9) pools.push({ key: "roman:hour-bath", lines: HOUR_LINES.bath! });
  if (hour !== null && date.month >= 6 && date.month <= 7) pools.push({ key: "roman:hour-long", lines: HOUR_LINES.long! });
  if (hour !== null && (date.month === 12 || date.month === 1)) pools.push({ key: "roman:hour-short", lines: HOUR_LINES.short! });
  SEASONS.forEach((season, i) => {
    if (inSeason(season, date.month, date.day)) pools.push({ key: `roman:season-${i}`, lines: season.lines });
  });
  pools.push(hour === null ? { key: "roman:night-lore", lines: NIGHT_LORE } : { key: "roman:lore", lines: LORE });
  return pools;
}

/** One pool to draw from. A marked or market day gets said most times
 *  she reaches for one; otherwise it's an even choice. */
export function pickRomanPool(pools: RomanLinePool[], random: () => number): RomanLinePool {
  const first = pools[0]!;
  const news = /kalends|nones|ides|market-day/.test(first.key);
  if (news && random() < 0.6) return first;
  return pools[Math.floor(random() * pools.length)]!;
}
