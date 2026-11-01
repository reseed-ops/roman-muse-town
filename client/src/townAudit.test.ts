import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPlaceFootprints } from "./buildingFootprints";
import { circ, obb, obbLocal, type Obstacle } from "./collision";
import { samplePath } from "./pathGeometry";
import * as town from "./town";

// The walking audit. It runs on the REAL obstacle list, read straight out
// of townScene.ts, because a copy of the list is exactly what drifts: the
// scene can't load here (it needs a GPU and the commercial packs), but
// its collider block is plain data. If a marker below moves, this fails
// loudly at `slice` rather than passing on nothing.

const source = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8").replace(/\r\n/g, "\n");

function slice(from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`audit marker moved: ${from} .. ${to}`);
  return source.slice(start, end);
}

function arrayLiteral(name: string): string {
  const start = source.indexOf(`const ${name}:`);
  if (start < 0) throw new Error(`audit marker moved: ${name}`);
  return `const ${name} = ${source.slice(source.indexOf("= [", start) + 2, source.indexOf("\n  ];", start) + 4)};\n`;
}

function buildObstacles(): Obstacle[] {
  const body = [
    arrayLiteral("lampPositions"),
    arrayLiteral("ROMAN_COLUMN_SPOTS"),
    arrayLiteral("treeSpots"),
    arrayLiteral("pineSpots"),
    slice("  const placeFootprints = createPlaceFootprints(PLACES);", "  /** The lake: nobody wades."),
    "return obstacles;",
  ].join("\n");
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(`export function run() {\n${body}\n}`);
  const names = [
    "circ", "obb", "createPlaceFootprints", "treePlacement", "pavilionColliders",
    "piscinaColliders", "bathColliders", ...Object.keys(town),
  ];
  const { BATHS, LAKE_PAVILION, PISCINA } = town;
  const pavilionColliders = [[-1.5, -1.3], [1.5, -1.3], [-1.5, 1.3], [1.5, 1.3]].map(([cx, cz]) =>
    ({ kind: "circle", x: LAKE_PAVILION.position[0] + cx!, z: LAKE_PAVILION.position[1] + cz!, r: 0.3, pad: 0.12 }));
  const piscinaColliders = [obb(PISCINA.position[0], PISCINA.position[1], 3.4, 1.5, 0)];
  const bathSource = slice("  bathColliders.push(\n", "  function enterBath");
  const bathColliders: unknown[] = [];
  new Function("bathColliders", "BATHS", bathSource)(bathColliders, BATHS);
  const values = [
    circ, obb, createPlaceFootprints, { bindCollider: <T>(position: T) => position },
    pavilionColliders, piscinaColliders, bathColliders, ...Object.values(town),
  ];
  const module = new Function(...names, `${js.replace(/export\s+function\s+run/, "return function run")}`)(...values);
  return module() as Obstacle[];
}

const obstacles = buildObstacles().filter((o) => !o.ghost);
const CLEARANCE = 0.5; // the player's own, from updateWalk

const coreDistance = (ob: Obstacle, x: number, z: number): number => {
  if (ob.kind === "circle") return Math.hypot(x - ob.x, z - ob.z) - ob.r;
  const { lx, lz } = obbLocal(ob, x, z);
  const dx = Math.abs(lx) - ob.halfW;
  const dz = Math.abs(lz) - ob.halfD;
  return dx < 0 && dz < 0 ? Math.max(dx, dz) : Math.hypot(Math.max(0, dx), Math.max(0, dz));
};
const clearanceOf = (ob: Obstacle) => (ob.pad === undefined ? CLEARANCE : Math.min(ob.pad, CLEARANCE));
const blocked = (x: number, z: number) => obstacles.some((ob) => coreDistance(ob, x, z) < clearanceOf(ob));
const inLake = (x: number, z: number) =>
  Math.hypot((x - town.LAKE.position[0]) / (town.LAKE.rx + CLEARANCE), (z - town.LAKE.position[1]) / (town.LAKE.rz + CLEARANCE)) < 1 &&
  !(x >= -13.7 && x <= -8.9 && Math.abs(z - town.LAKE.position[1]) <= 0.62);
const inBounds = (x: number, z: number) => Math.hypot(x, z) <= 52 || town.forestNorm(x, z) <= 0.985;

// Walkable cells on a grid fine enough to catch a player-sized gap.
const STEP = 0.2;
const MIN = -64;
const SIZE = Math.round(128 / STEP);
const at = (v: number) => Math.round((v - MIN) / STEP);
const walkable = new Uint8Array(SIZE * SIZE);
for (let j = 0; j < SIZE; j++) {
  for (let i = 0; i < SIZE; i++) {
    const x = MIN + i * STEP;
    const z = MIN + j * STEP;
    if (inBounds(x, z) && !inLake(x, z) && !blocked(x, z)) walkable[j * SIZE + i] = 1;
  }
}
const region = new Int32Array(SIZE * SIZE).fill(-1);
const sizes: number[] = [];
for (let k = 0; k < walkable.length; k++) {
  if (!walkable[k] || region[k]! >= 0) continue;
  const id = sizes.length;
  const queue = [k];
  region[k] = id;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    for (const n of [c + 1, c - 1, c + SIZE, c - SIZE]) {
      if (n >= 0 && n < walkable.length && walkable[n] && region[n]! < 0) {
        region[n] = id;
        queue.push(n);
      }
    }
  }
  sizes.push(queue.length);
}
const town_ = sizes.indexOf(Math.max(...sizes));
/** Can you stand within `reach` of this spot, on the town's walkable ground? */
const reachable = (x: number, z: number, reach: number) => {
  for (let r = 0; r <= reach; r += STEP) {
    for (let a = 0; a < 16; a++) {
      const i = at(x + Math.cos(a * 0.3927) * r);
      const j = at(z + Math.sin(a * 0.3927) * r);
      if (region[j * SIZE + i] === town_) return true;
    }
  }
  return false;
};

test("the audit is reading the whole world, not an empty list", () => {
  expect(obstacles.length).toBeGreaterThan(150);
  expect(obstacles.some((o) => o.kind === "obb")).toBe(true);
});

test("no street runs through anything solid, however small", () => {
  const hits = new Set<string>();
  town.STREETS.forEach((path, i) => {
    for (const [x, z] of samplePath(path).points) {
      for (const ob of obstacles) {
        // The main street meets at the forum, and walkers go round the
        // Town Tree in the middle of it: that one's the design.
        if (ob.x === 0 && ob.z === 0) continue;
        if (coreDistance(ob, x, z) < 0) hits.add(`street ${i}: ${ob.kind} at ${ob.x.toFixed(1)},${ob.z.toFixed(1)}`);
      }
    }
  });
  expect([...hits]).toEqual([]);
});

test("every street end and every doorstep can actually be walked to", () => {
  const stranded: string[] = [];
  town.STREETS.forEach((path, i) => {
    for (const [x, z] of [path[0]!, path[path.length - 1]!]) {
      if (!reachable(x, z, 3)) stranded.push(`street ${i} end ${x},${z}`);
    }
  });
  for (const place of town.PLACES) {
    const [x, z] = place.position;
    const rot = Math.atan2(-x, -z);
    const out = (place.buildingWidth ?? 7.6) * 0.52 + 0.6;
    if (!reachable(x + Math.sin(rot) * out, z + Math.cos(rot) * out, 2)) stranded.push(`door of ${place.id}`);
  }
  expect(stranded).toEqual([]);
});

test("no pocket of open ground is sealed off from the town", () => {
  const cell = STEP * STEP;
  const pockets = sizes
    .map((size, id) => ({ id, area: size * cell }))
    // Under 2 square units is a sliver between trees, not a place.
    .filter(({ id, area }) => id !== town_ && area >= 2)
    .map(({ id, area }) => {
      const k = region.indexOf(id);
      return `${area.toFixed(1)} at ${(MIN + (k % SIZE) * STEP).toFixed(1)},${(MIN + Math.floor(k / SIZE) * STEP).toFixed(1)}`;
    });
  expect(pockets).toEqual([]);
});
