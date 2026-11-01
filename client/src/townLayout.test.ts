import { expect, test } from "bun:test";
import { createPlaceFootprints } from "./buildingFootprints";
import { circ, obb, obbLocal, obbWorld, type ObbObstacle, type Obstacle } from "./collision";
import { distanceToPaths, samplePath } from "./pathGeometry";
import { BATHS, COLOSSEUM, FOREST_TRAILS, PISCINA, PLACES, STREETS, streetDistance, streetWidth } from "./town";

const buildings = [...createPlaceFootprints(PLACES).entries()];
const constraints: [string, Obstacle][] = [
  ...buildings,
  ["Temple", obb(31, -27, 5.27, 12.86, -0.6)],
  ["Colosseum", circ(...COLOSSEUM.position, 8)],
  ["Piscina water", obb(...PISCINA.position, 3.4, 1.5, 0)],
  ["Bath water", obb(BATHS.position[0], 23.4, 3.4, 1.5, 0)],
  ["Bath west wall", obb(18.5, 24, .15, 4, 0)],
  ["Bath east wall", obb(29.5, 24, .15, 4, 0)],
  ["Bath north wall", obb(24, 20, 5.5, .15, 0)],
  ["Bath south west wall", obb(20.85, 28, 2.35, .15, 0)],
  ["Bath south east wall", obb(27.35, 28, 2.15, .15, 0)],
  ["Market A", obb(6.2, 21.5, 1.73, .86, -.55)],
  ["Market B", obb(-5.5, 16.5, 1.73, .86, .95)],
  ["Market C", obb(10, 6.5, 1.73, .86, -.95)],
];
function clearance(ob: Obstacle, x: number, z: number) {
  if (ob.kind === "circle") return Math.hypot(x - ob.x, z - ob.z) - ob.r;
  const { lx, lz } = obbLocal(ob, x, z);
  const dx = Math.abs(lx) - ob.halfW, dz = Math.abs(lz) - ob.halfD;
  return dx < 0 && dz < 0 ? Math.max(dx, dz) : Math.hypot(Math.max(0, dx), Math.max(0, dz));
}

test("street centrelines never enter buildings, walls or water", () => {
  const conflicts: string[] = [];
  STREETS.forEach((path, i) => {
    for (const [name, shape] of constraints) {
      if (samplePath(path).points.some(([x, z]) => clearance(shape, x, z) < -0.01)) conflicts.push(`${i}: ${name}`);
    }
  });
  expect(conflicts).toEqual([]);
});

test("road edges clear structures except where the final approach meets a doorstep", () => {
  const conflicts: string[] = [];
  STREETS.forEach((path, i) => {
    const { points, length } = samplePath(path);
    const throughRoute = points.filter((_, j) => length * (1 - j / (points.length - 1)) > 2);
    for (const [name, shape] of constraints) {
      if (throughRoute.some(([x, z]) => clearance(shape, x, z) < streetWidth(i) / 2 - 0.01)) conflicts.push(`${i}: ${name}`);
    }
  });
  expect(conflicts).toEqual([]);
});

test("all streets connect to the forum network, including the embassy and pond", () => {
  const connected = new Set(STREETS.flatMap((path, i) => samplePath(path).points.some(([x, z]) => Math.hypot(x, z) < 5.6) ? [i] : []));
  for (let pass = 0; pass < STREETS.length; pass++) STREETS.forEach((path, i) => {
    if (connected.has(i)) return;
    if (samplePath(path).points.some(([x, z]) => [...connected].some(j => distanceToPaths(x, z, [STREETS[j]!]) <= (streetWidth(i) + streetWidth(j)) / 2))) connected.add(i);
  });
  expect(connected.size).toBe(STREETS.length);
  const [x, z] = FOREST_TRAILS[0]![0]!;
  expect(streetDistance(x, z)).toBeLessThan(0.01);
});

test("every building doorstep is reached by paving and the pavilion clears the baths", () => {
  for (const place of PLACES) {
    const [x, z] = place.position, rot = Math.atan2(-x, -z), distance = (place.buildingWidth ?? 7.6) * .52;
    expect(streetDistance(x + Math.sin(rot) * distance, z + Math.cos(rot) * distance)).toBeLessThan(1.35);
  }
  const pavilion = PLACES.find(p => p.id === "stars")!;
  const rot = Math.atan2(-pavilion.position[0], -pavilion.position[1]);
  // Include the rotated rectangular platform, not merely the column circle.
  const w = (pavilion.buildingWidth ?? 7.6) + 1.3;
  const eastEdge = pavilion.position[0] + Math.abs(Math.cos(rot)) * (w + .4) / 2 + Math.abs(Math.sin(rot)) * w * .92 / 2;
  expect(18.35 - eastEdge).toBeGreaterThan(1);
  const platform = obb(...pavilion.position, (w + .4) / 2, w * .92 / 2, rot);
  const corners = (box: ObbObstacle) => [-1, 1].flatMap(x => [-1, 1].map(z => obbWorld(box, x * box.halfW, z * box.halfD)));
  for (const stall of [obb(6.2, 21.5, 1.8, 1.1, -.55), obb(10, 6.5, 1.8, 1.1, -.95)]) {
    const separated = [platform.rot, platform.rot + Math.PI / 2, stall.rot, stall.rot + Math.PI / 2].some(angle => {
      const project = (box: ObbObstacle) => corners(box).map(p => p.x * Math.cos(angle) - p.z * Math.sin(angle));
      const a = project(platform), b = project(stall);
      return Math.min(...a) - Math.max(...b) > .3 || Math.min(...b) - Math.max(...a) > .3;
    });
    expect(separated).toBe(true);
  }
});

test("clearance queries follow the actual curved centreline", () => {
  for (const path of STREETS) for (const [x, z] of samplePath(path).points) expect(streetDistance(x, z)).toBeLessThan(0.00001);
});
