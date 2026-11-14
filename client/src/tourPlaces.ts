// Task 90: the walkthrough's place list, built from the town's own data.
//
// tools/tour/tour.py walks the town place by place and photographs each one.
// The list is not hand-kept: it is derived here from PLACES (every house),
// the scene's named anchors and seats (handed in by the scene, see
// TownSceneHandle.tourData), and the few landmarks the town keeps as
// constants (the Colosseum, the temple's cella, the baths, their home). A new
// place or seat in that data is picked up and visited with no edit here;
// only its facing is a guess (toward the town's middle) until TOUR_LOOK names
// a better one.
//
// Heading, as the scene's walk uses it: the walker faces (sin h, cos h), so
// north (-z) is h = pi and east (+x) is h = pi / 2.

import { CLIFF } from "./seaCliff";
import type { TownSceneHandle } from "./townScene";
import { ATHENA_TEMPLE, BATHS, COLOSSEUM, HOME, LAKE, PLACES, solarAngles } from "./town";

export interface TourPlace {
  id: string;
  label: string;
  /** Where Gaius stands, and which way he faces (the camera follows from behind). */
  x: number;
  z: number;
  heading: number;
  /** What this entry came from: a house, a landmark, a named anchor or a seat. */
  source: "place" | "landmark" | "anchor" | "seat";
}

export interface TourSeat {
  id: string;
  x: number;
  z: number;
  /** The seat's rotY: rotY 0 faces -z, pi faces +z, -pi/2 faces +x. */
  rotY: number;
}

export interface TourData {
  seats: TourSeat[];
  anchors: Record<string, [number, number]>;
}

/** Heading from a point toward a target. */
export const headingToward = (fx: number, fz: number, tx: number, tz: number): number => Math.atan2(tx - fx, tz - fz);

/** The scene's anchors that are the same place as a house or landmark already on the list. */
const ANCHOR_ALIAS: Record<string, string | null> = {
  stories: null, // the Villa of Stories house
  sounds: null, // the Atrium of Sounds house
  boat: "lake-dock",
  bath: "baths",
};

const ANCHOR_LABEL: Record<string, string> = {
  tree: "The Town Tree, in the peristyle",
  forum: "The forum",
  lakeshore: "The lakeshore",
  terrace: "The lantern terrace",
  market: "The market",
  gate: "The gate",
  baths: BATHS.name,
  piscina: "The Piscina",
};

/** Where an anchor looks: a world point, else the town's middle. Only for choices a photograph wants. */
const TOUR_LOOK: Record<string, [number, number]> = {
  market: [6.2, 46],
  gate: [0, 0],
  baths: [BATHS.position[0], BATHS.position[1] - 3],
  "lake-dock": [LAKE.position[0], LAKE.position[1]],
  lakeshore: [LAKE.position[0], LAKE.position[1]],
  piscina: [-11.5, 22.5],
};

const SEAT_LABEL: Record<string, string> = {
  "bench-stone": "The stone bench by the peristyle",
  "bench-temple": "The temple road's bench",
  "bench-terrace": "The terrace bench",
  "piscina-rim": "The Piscina's rim",
  "home-bed": "Their bed's edge",
  "bench-athena": "Athena's temple, from the bench",
  "bench-cliff": "The cliffside bench",
};

const titleCase = (id: string): string => id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Stand `dist` out from a point along a heading and look back at it. */
function standFacing(x: number, z: number, outHeading: number, dist: number): { x: number; z: number; heading: number } {
  return { x: x + Math.sin(outHeading) * dist, z: z + Math.cos(outHeading) * dist, heading: outHeading + Math.PI };
}

export function buildTourPlaces(data: TourData): TourPlace[] {
  const out: TourPlace[] = [];
  const seen = new Set<string>();
  const add = (p: TourPlace) => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    out.push(p);
  };

  // Every house: stand before its door and look at it.
  for (const p of PLACES) {
    const s = standFacing(p.position[0], p.position[1], p.facing, 11);
    add({ id: p.id, label: p.name, ...s, source: "place" });
  }

  // Landmarks the town keeps as constants.
  {
    const T = ATHENA_TEMPLE;
    const [px, pz] = T.position;
    // Inside the cella, just past the door, facing west to Athena at the back wall.
    add({ id: "athena-cella", label: "Athena's cella, before her", x: px + T.cella.x1 - 0.9, z: pz, heading: -Math.PI / 2, source: "landmark" });
    // The colosseum, from the south, clear of the domus and the baths compound.
    add({ id: "colosseum", label: COLOSSEUM.name, x: COLOSSEUM.position[0] - 4, z: COLOSSEUM.position[1] + 16, heading: headingToward(COLOSSEUM.position[0] - 4, COLOSSEUM.position[1] + 16, COLOSSEUM.position[0], COLOSSEUM.position[1]), source: "landmark" });
    add({ id: "home", label: "Their house", ...standFacing(HOME.position[0], HOME.position[1], HOME.facing, 8), source: "landmark" });
    add({ id: "cliff-path", label: "The cliff path, from the gate", x: CLIFF.bench.x, z: CLIFF.pathFromZ + 8, heading: 0, source: "landmark" });
  }

  // The scene's named anchors.
  for (const [name, [ax, az]] of Object.entries(data.anchors)) {
    const alias = name in ANCHOR_ALIAS ? ANCHOR_ALIAS[name] : name;
    if (!alias) continue;
    const look = TOUR_LOOK[alias] ?? [0, 0];
    const heading = headingToward(ax, az, look[0], look[1]);
    add({ id: alias, label: ANCHOR_LABEL[alias] ?? (alias === "lake-dock" ? "The lake dock" : titleCase(alias)), x: ax, z: az, heading: Number.isFinite(heading) ? heading : 0, source: "anchor" });
  }

  // Every seat: the view a sitter has, taken standing a pace behind the seat.
  for (const s of data.seats) {
    const facing = s.rotY + Math.PI;
    add({
      id: s.id,
      label: SEAT_LABEL[s.id] ?? `Seat: ${titleCase(s.id)}`,
      x: s.x - Math.sin(facing) * 0.9,
      z: s.z - Math.cos(facing) * 0.9,
      heading: facing,
      source: "seat",
    });
  }
  return out;
}

/** The places the brief names; the tour refuses to call itself whole without every one of these ids (see the test). */
export const TOUR_REQUIRED: readonly string[] = [
  "forum", "mainchat", "bench-athena", "athena-cella", "sidechat", "lake-dock", "stars", "bench-cliff",
  "colosseum", "market", "stories", "sounds", "garden", "recipes", "baths", "gate",
];

/**
 * The walkthrough's one door into the page. Only when the address carries
 * `?tour` does the page offer `window.__townTour`: the scene handle (teleport
 * by restoreResume, the sky by skyState / tourSnapSky), the place list built
 * above, and the town's own sun calculator, so the tour can choose clock times
 * for day, golden hour and night. Nothing else changes with the flag.
 */
export function exposeTour(handle: TownSceneHandle): void {
  if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("tour")) return;
  (window as unknown as { __townTour?: unknown }).__townTour = {
    scene: handle,
    places: buildTourPlaces(handle.tourData()),
    solarAngles,
  };
}
