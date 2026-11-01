// The town's first-run festival calendar. Kept apart from actions.ts so
// it can be tested without the SDK. The dates are the Roman calendar's
// own, kept on the real date each year.

export interface FestivalSeed {
  month_day: string;
  name: string;
  dressing: string;
  colors: string;
}

export const FESTIVALS_SEED: FestivalSeed[] = [
  // TEMPLATE calendar of generic festivals. The original town also kept
  // the owner's family birthdays and race day; those were personal and
  // are not included. A receiving Muse should add the new owner's own
  // dates with them.
  { month_day: "10-31", name: "Halloween — the town in costume colors", dressing: "Bunting in orange and black over the forum; the lamps glow a little more pumpkin than usual.", colors: "#e07b2a,#2b2b30,#8a4bff" },
  { month_day: "12-17", name: "Saturnalia — the midwinter feast", dressing: "Garlands on the basilica, candles in every window, and the town turned briefly upside down in the old way.", colors: "#b03a2e,#f2c14e,#51683c" },
  { month_day: "02-15", name: "Lupercalia — the February rite", dressing: "Red and white ribbons on the forum columns; the wolf keeps her distance, honoured.", colors: "#c0392b,#e8e3d8,#7a4a21" },
  // The Roman year, added Nov 2026. Existing towns get these through
  // migration 0026, so keep the two lists agreeing. Compitalia moved
  // from year to year in early January; the town keeps it on the 3rd.
  { month_day: "01-03", name: "Compitalia — the feast of the crossroads", dressing: "Woollen dolls and little balls hung at the street shrines, one for everyone in the house, and food shared where the lanes meet.", colors: "#a8552e,#e6d3a8,#5e6b3a" },
  { month_day: "02-22", name: "Caristia — the family table", dressing: "Quarrels set down for the day and places laid for everyone: the meal where a family makes its peace.", colors: "#9c4a3c,#efe0c4,#6d7a4c" },
  { month_day: "03-01", name: "Matronalia — the women's day", dressing: "Spring flowers on every doorstep, and gifts for the women of the house.", colors: "#c9708a,#f3e6d0,#7f9a5b" },
  { month_day: "04-21", name: "Parilia — Rome's birthday", dressing: "Bonfires of straw at dusk and the whole town wishing the city many happy returns.", colors: "#d9772b,#f2d27a,#8a3324" },
  { month_day: "04-28", name: "Floralia — the days of flowers", dressing: "Garlands on every column and the lanes smelling of cut stems.", colors: "#d9568a,#f2c14e,#6db33f" },
  { month_day: "06-09", name: "Vestalia — the bakers' holiday", dressing: "Millstones garlanded and the market donkeys decked with violets and loaves of bread.", colors: "#7a5ba6,#e8d6a8,#b5763a" },
  { month_day: "07-23", name: "Neptunalia — the high summer shade", dressing: "Shelters of leafy boughs along the lanes, and everyone keeping close to the water.", colors: "#2e86ab,#a9d6c8,#4f8a4c" },
  { month_day: "08-23", name: "Vulcanalia — the fire watch", dressing: "Small fires lit at nightfall to keep the great ones away, and every lamp minded with care.", colors: "#c8401f,#f0a03a,#3a3230" },
];
