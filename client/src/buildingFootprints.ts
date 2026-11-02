import { circ, obb, type Obstacle } from "./collision";
import type { Place } from "./town";

/** Ground footprints shared by movement and route validation. */
export function createPlaceFootprints(places: Place[]): Map<string, Obstacle> {
  const BUILDING_GROUND: Record<string, { gw: number; gd: number; ox: number; oz: number }> = {
    stories: { gw: 0.9587, gd: 1.255, ox: 0.0045, oz: -0.044 },
    sounds: { gw: 0.995, gd: 0.7477, ox: 0.0025, oz: -0.1123 },
    garden: { gw: 0.8603, gd: 0.8477, ox: 0.0094, oz: -0.0013 },
    recipes: { gw: 0.9489, gd: 0.7689, ox: 0.0051, oz: 0.0124 },
    mainchat: { gw: 1, gd: 0.7092, ox: 0, oz: 0 },
    sidechat: { gw: 0.8956, gd: 1.1564, ox: 0.0019, oz: -0.0139 },
  };
  const placeFootprints = new Map<string, Obstacle>();
  for (const p of places) {
    const [hx, hz] = p.position;
    const rot = p.facing;
    const width = p.buildingWidth ?? 7.6;
    // Building centre in world space (house-local (0, -0.3)).
    const bcx = hx - 0.3 * Math.sin(rot);
    const bcz = hz - 0.3 * Math.cos(rot);
    if (p.id === "stars") {
      // The round pavilion: a circle fitted to its column ring.
      placeFootprints.set(p.id, circ(bcx, bcz, 3.5));
      continue;
    }
    const g = BUILDING_GROUND[p.id] ?? { gw: 1, gd: 1, ox: 0, oz: 0 };
    const inset = p.id === "mainchat" ? 1.5 : 0.9;
    // Ground-footprint centre in house-local space: the building's
    // own (0, -0.3) plus the ground plan's offset from the bbox
    // centre, then pulled toward the back by half the doorstep
    // inset (the inset shrinks the front face only, as before).
    const clx = g.ox * width;
    const clz = -0.3 + g.oz * width - inset / 2;
    placeFootprints.set(p.id, obb(
      hx + clx * Math.cos(rot) + clz * Math.sin(rot),
      hz - clx * Math.sin(rot) + clz * Math.cos(rot),
      (width * g.gw) / 2,
      (width * g.gd) / 2 - inset / 2,
      rot,
    ));
  }
  return placeFootprints;
}
