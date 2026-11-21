import { circ, obb, obbWorld, type Obstacle } from "./collision";
import type { Place } from "./town";

/** One reference envelope per place for prompt distance. */
export function createPlaceReferences(places: Place[]): Map<string, Obstacle> {
  const BUILDING_GROUND: Record<string, { gw: number; gd: number; ox: number; oz: number }> = {
    stories: { gw: 0.9587, gd: 1.255, ox: 0.0045, oz: -0.044 },
    sounds: { gw: 0.995, gd: 0.7477, ox: 0.0025, oz: -0.1123 },
    garden: { gw: 0.8603, gd: 0.8477, ox: 0.0094, oz: -0.0013 },
    recipes: { gw: 0.9489, gd: 0.7689, ox: 0.0051, oz: 0.0124 },
    mainchat: { gw: 1, gd: 0.7092, ox: 0, oz: 0 },
    sidechat: { gw: 0.8956, gd: 1.1564, ox: 0.0019, oz: -0.0139 },
  };
  const placeReferences = new Map<string, Obstacle>();
  for (const p of places) {
    const [hx, hz] = p.position;
    const rot = p.facing;
    const width = p.buildingWidth ?? 7.6;
    // Building centre in world space (house-local (0, -0.3)).
    const bcx = hx - 0.3 * Math.sin(rot);
    const bcz = hz - 0.3 * Math.cos(rot);
    if (p.id === "stars") {
      // Prompt distance is measured from the outside of the pavilion.
      placeReferences.set(p.id, circ(bcx, bcz, 3.5));
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
    placeReferences.set(p.id, obb(
      hx + clx * Math.cos(rot) + clz * Math.sin(rot),
      hz - clx * Math.sin(rot) + clz * Math.cos(rot),
      (width * g.gw) / 2,
      (width * g.gd) / 2 - inset / 2,
      rot,
    ));
  }
  return placeReferences;
}

/** The two open structures need finer movement geometry than their prompt envelopes. */
export function movementFootprints(places: Place[], references = createPlaceReferences(places)): Obstacle[] {
  return places.flatMap((p): Obstacle[] => {
    const rot = p.facing;
    const frame = obb(...p.position, 0, 0, rot);
    const wall = (u: number, v: number, halfW: number, halfD: number, yaw = rot) => {
      const { x, z } = obbWorld(frame, u, v);
      return obb(x, z, halfW, halfD, yaw);
    };
    if (p.id === "embassy") {
      // Back wall, flanks, gate pillars and the face of the closed double door.
      return [
        wall(0, -2.1, 2.8, 0.4), wall(-2.4, -0.8, 0.4, 1.7), wall(2.4, -0.8, 0.4, 1.7),
        wall(-1.85, 1.05, 0.475, 0.475), wall(1.85, 1.05, 0.475, 0.475), wall(0, 0.92, 1.33, 0.07),
      ];
    }
    if (p.id === "stars") {
      // Eight square plinths on the 2.46 m ring, each 0.538 m across at placed width 7.6.
      const scale = (p.buildingWidth ?? 7.6) / 7.6;
      return Array.from({ length: 8 }, (_, i) => {
        const angle = i * Math.PI / 4;
        const u = 2.46 * scale * Math.sin(angle), v = 2.46 * scale * Math.cos(angle) - 0.3;
        return wall(u, v, 0.269 * scale, 0.269 * scale, rot + angle);
      });
    }
    return [references.get(p.id)!];
  });
}
