import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { buildHomeHouse } from "./homeHouse";
import { groundHeightAt, HOME, HOME_BED, HOME_FLOOR_Y, HOME_STEPS, homeToWorld, terrainHeight, YOUNG_OLIVES } from "./town";
import { resolveCollisions } from "./collision";
import { WALK_ROUTES } from "./layout";
import {
  ATRIUM_COLUMNS, BED, COMPLUVIUM, FLOOR_RECTS, H_ATRIUM, IMPLUVIUM, inRect, insideRooms, LAMP_TABLE, PERISTYLE_COLUMNS, PERISTYLE_POOL, PORTICO,
  PORTICO_COLUMNS, ROOFED, ROOMS, shelteredAt, SLABS, SPOTS, WALLS, type Rect,
} from "./homePlan";

// Their house (Task 35), a noble's Roman domus (Task 76): the floor, the door, the
// walls, the rooms, the vista, the bed, the lamp: pinned.

const world = (lx: number, lz: number) => homeToWorld(lx, lz);
const mid = (r: Rect) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
/** The domus's own walls and furniture: where a walker of the town's size is stopped. */
const stoppedAt = (house: ReturnType<typeof buildHomeHouse>, lx: number, lz: number, clear = 0.3) => {
  const p = world(lx, lz);
  const out = resolveCollisions(house.colliders, p.x, p.z, clear);
  return Math.hypot(out.x - p.x, out.z - p.z);
};

describe("the plot and the floor", () => {
  test("the floor stands over the ground everywhere under the plan, and the walker stands on it inside", () => {
    for (const r of FLOOR_RECTS) {
      for (let lx = r.x0 + 0.02; lx <= r.x1 - 0.02; lx += 0.3) {
        for (let lz = r.z0 + 0.02; lz <= r.z1 - 0.02; lz += 0.3) {
          const p = world(lx, lz);
          // The terrain never rises through the floor (the cottage's floor height is kept).
          expect(terrainHeight(p.x, p.z)).toBeLessThan(HOME_FLOOR_Y + 0.03);
          expect(groundHeightAt(p.x, p.z)).toBeCloseTo(HOME_FLOOR_Y);
        }
      }
    }
    for (const r of Object.values(ROOMS)) {
      const c = mid(r);
      const p = world(c.x, c.z);
      expect(HOME_FLOOR_Y).toBeGreaterThan(terrainHeight(p.x, p.z) - 0.001);
      expect(groundHeightAt(p.x, p.z)).toBeCloseTo(HOME_FLOOR_Y);
    }
  });

  test("the house keeps its place: the same position and facing, the door on the same side, the steps kept", () => {
    expect(HOME.position).toEqual([-40, 26]);
    expect(HOME.facing).toBeCloseTo(Math.PI / 2);
    const door = WALLS.find((w) => w.id === "front-w")!;
    expect(door.c).toBeCloseTo(HOME.halfD + HOME.wall / 2);
    expect(door.open[0]).toMatchObject({ from: -HOME.doorWidth / 2, to: HOME.doorWidth / 2 });
    // The front wall's outer face is where the cottage's was: nothing grows out into the lawn but the porch.
    for (const w of WALLS) if (w.axis === "x") expect(w.c + w.t / 2).toBeLessThanOrEqual(HOME.halfD + HOME.wall + 1e-9);
    expect(HOME_STEPS.length).toBeGreaterThan(0);
    // The porch's columns stand clear of the steps (half a metre either side of their width).
    for (const [x] of PORTICO_COLUMNS) expect(Math.abs(x)).toBeGreaterThan(0.95 + 0.17 + 0.2);
  });

  test("it stays in its own plot: inside the town's rim, clear of the young olives, the tree and the lawn", () => {
    // Every room's corner lies within the walkers' disc (radius 52), where the world clamp lets them stand.
    for (const r of Object.values(ROOMS)) {
      for (const [lx, lz] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]] as const) {
        const p = world(lx, lz);
        expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(52.001);
      }
    }
    // Neighbours: the two young olives by the house, and the lawn tree, stay clear of every wall and roof.
    const neighbours: (readonly [number, number])[] = [YOUNG_OLIVES[0]!, YOUNG_OLIVES[1]!, [-34, 22.1]];
    const rects: Rect[] = [...FLOOR_RECTS, PORTICO, ...SLABS.map((s) => s.rect)];
    for (const [nx, nz] of neighbours) {
      const c = Math.cos(HOME.facing), s = Math.sin(HOME.facing);
      const lx = (nx - HOME.position[0]) * c - (nz - HOME.position[1]) * s;
      const lz = (nx - HOME.position[0]) * s + (nz - HOME.position[1]) * c;
      for (const r of rects) {
        const dx = Math.max(r.x0 - lx, 0, lx - r.x1);
        const dz = Math.max(r.z0 - lz, 0, lz - r.z1);
        expect(Math.hypot(dx, dz)).toBeGreaterThan(1.0);
      }
    }
    // The lawn before the door (the fireflies' and the walk's) is not built on: nothing east of the porch.
    expect(PORTICO.z1).toBeLessThan(HOME.halfD + HOME.wall + 1.6);
    for (const r of [...FLOOR_RECTS, ...SLABS.map((s) => s.rect)]) expect(r.z1).toBeLessThanOrEqual(3.8 + 1e-9);
  });

  test("Aelia's walk to the door ends inside the fauces", () => {
    const house = buildHomeHouse(terrainHeight);
    const yard = WALK_ROUTES.nodes.homeYard!;
    const inside = WALK_ROUTES.nodes.homeInside!;
    expect(house.inside(yard[0], yard[1])).toBe(false);
    expect(house.inside(inside[0], inside[1])).toBe(true);
    const c = Math.cos(HOME.facing), s = Math.sin(HOME.facing);
    const lx = (inside[0] - HOME.position[0]) * c - (inside[1] - HOME.position[1]) * s;
    const lz = (inside[0] - HOME.position[0]) * s + (inside[1] - HOME.position[1]) * c;
    expect(inRect(ROOMS.fauces, lx, lz)).toBe(true);
  });
});

describe("the rooms of the domus", () => {
  test("it holds the rooms a noble's house has, bigger and taller than the cottage", () => {
    for (const id of ["fauces", "atrium", "tablinum", "garden", "triclinium", "cubiculum", "cellS", "cellN", "closet", "passage", "gallery"] as const) {
      expect(ROOMS[id]).toBeDefined();
    }
    const area = (r: Rect) => (r.x1 - r.x0) * (r.z1 - r.z0);
    // The footprint (the walls' outer line, the floor under every room) is over half as big again as the cottage's.
    const footprint = FLOOR_RECTS.reduce((n, r) => n + area(r), 0);
    expect(footprint).toBeGreaterThan(1.5 * (HOME.halfW + HOME.wall) * 2 * (HOME.halfD + HOME.wall) * 2);
    // The atrium is the great hall: the largest roofed room, and its walls stand over the cottage's.
    for (const id of ROOFED) if (id !== "atrium") expect(area(ROOMS.atrium)).toBeGreaterThan(area(ROOMS[id]) - 1e-9);
    expect(H_ATRIUM).toBeGreaterThan(HOME.wallHeight + 1.2);
    // The bedroom holds the bed and the lamp table; the bed no longer stands in the middle of the only room.
    expect(inRect(ROOMS.cubiculum, BED.lx - BED.halfW, BED.lz - BED.halfD)).toBe(true);
    expect(inRect(ROOMS.cubiculum, BED.lx + BED.halfW, BED.lz + BED.halfD)).toBe(true);
    expect(inRect(ROOMS.cubiculum, LAMP_TABLE.x, LAMP_TABLE.z)).toBe(true);
    expect(HOME_BED).toEqual(BED);
  });

  test("the vista runs straight on the door's axis: porch, door, fauces, atrium, tablinum, peristyle", () => {
    // The rooms follow one another along x = 0, front to back, each joining the next.
    const order = ["fauces", "atrium", "tablinum", "gallery", "garden"] as const;
    for (const id of order) expect(ROOMS[id].x0 <= 0 && ROOMS[id].x1 >= 0).toBe(true);
    for (let i = 1; i < order.length; i++) expect(ROOMS[order[i]!].z1).toBeLessThanOrEqual(ROOMS[order[i - 1]!].z0 + 1e-9);
    expect(PORTICO.x0 < 0 && PORTICO.x1 > 0).toBe(true);
    // Every wall that crosses the axis has an opening on it, wide enough, tall enough to see through.
    const crossing = WALLS.filter((w) => w.axis === "x" && w.a <= 0 && w.b >= 0 && w.c < HOME.halfD + HOME.wall && w.c > ROOMS.garden.z1);
    expect(crossing.map((w) => w.id).sort()).toEqual(["atrium-back", "atrium-front", "back-w", "front-w"]);
    for (const w of crossing) {
      const gap = w.open.find((o) => o.from < 0 && o.to > 0);
      expect(gap).toBeDefined();
      expect(gap!.to - gap!.from).toBeGreaterThanOrEqual(1.2);
      expect(gap!.h).toBeGreaterThanOrEqual(2.1);
    }
    // The garden's own walls stand behind it: the vista ends in the peristyle.
    expect(WALLS.some((w) => w.id === "court-s" && w.a <= 0 && w.b >= 0)).toBe(true);
    // Nothing but the pool of the atrium and low furniture lies on the sightline: no wall-high collider on x = 0
    // other than the walls above and the impluvium's low rim.
    const house = buildHomeHouse(terrainHeight);
    const lowRim = world(0, (IMPLUVIUM.z0 + IMPLUVIUM.z1) / 2);
    expect(house.colliders.some((o) => Math.hypot(o.x - lowRim.x, o.z - lowRim.z) < 0.2)).toBe(true);
  });

  test("the compluvium opens over the impluvium, and the sky is open nowhere else under a roof", () => {
    // The opening sits inside the pool's rim, so the rain lands in water.
    expect(COMPLUVIUM.x0).toBeGreaterThan(IMPLUVIUM.x0);
    expect(COMPLUVIUM.x1).toBeLessThan(IMPLUVIUM.x1);
    expect(COMPLUVIUM.z0).toBeGreaterThan(IMPLUVIUM.z0);
    expect(COMPLUVIUM.z1).toBeLessThan(IMPLUVIUM.z1);
    expect(inRect(ROOMS.atrium, COMPLUVIUM.x0, COMPLUVIUM.z0) && inRect(ROOMS.atrium, COMPLUVIUM.x1, COMPLUVIUM.z1)).toBe(true);
    const house = buildHomeHouse(terrainHeight);
    const c = mid(COMPLUVIUM);
    const cw = world(c.x, c.z);
    expect(house.inside(cw.x, cw.z)).toBe(true);
    expect(house.sheltered(cw.x, cw.z)).toBe(false); // rain falls through it
    // Everywhere else in the roofed rooms it is sheltered: a grid over every room.
    let openSpots = 0;
    for (const id of ROOFED) {
      const r = ROOMS[id];
      for (let lx = r.x0 + 0.05; lx < r.x1; lx += 0.1) {
        for (let lz = r.z0 + 0.05; lz < r.z1; lz += 0.1) {
          const p = world(lx, lz);
          expect(house.inside(p.x, p.z)).toBe(true);
          if (!house.sheltered(p.x, p.z)) {
            openSpots++;
            expect(inRect(COMPLUVIUM, lx, lz)).toBe(true);
          }
        }
      }
    }
    expect(openSpots).toBeGreaterThan(20);
    // The porch is roofed but not inside; the peristyle's garden is inside the walls but open to the sky; the lawn is neither.
    const porch = world(0, 4.2);
    expect(house.inside(porch.x, porch.z)).toBe(false);
    expect(house.sheltered(porch.x, porch.z)).toBe(true);
    const g = mid(ROOMS.garden);
    const gw = world(g.x, g.z);
    expect(house.inside(gw.x, gw.z)).toBe(true);
    expect(house.sheltered(gw.x, gw.z)).toBe(false);
    const lawn = world(0, 8);
    expect(house.inside(lawn.x, lawn.z)).toBe(false);
    expect(house.sheltered(lawn.x, lawn.z)).toBe(false);
    expect(shelteredAt(0, 0)).toBe(true);
    expect(insideRooms(9, 9)).toBe(false);
  });

  test("the town's rain follows the house's own shelter, not its walls", () => {
    const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    expect(scene).toContain("homeHouse.sheltered(d.x, d.z)");
    expect(scene).toContain("homeHouse.sheltered(x, z) ? 1 : 0");
    expect(scene).not.toContain("homeHouse.inside(d.x, d.z)");
  });
});

describe("what stops a walker, and what lets them through", () => {
  test("the door lets a walker in, the walls do not, and the bed is a seat inside", () => {
    const house = buildHomeHouse(terrainHeight);
    const doorway = world(0, HOME.halfD + HOME.wall / 2);
    const kept = resolveCollisions(house.colliders, doorway.x, doorway.z, 0.3);
    expect(Math.hypot(kept.x - doorway.x, kept.z - doorway.z)).toBeLessThan(0.05);
    // The outer walls: the south wall, the wing's east wall, the front wall beside the door, the back of the court.
    for (const [lx, lz] of [[-2.71, 0.4], [6.31, 1.5], [2.0, 3.31], [-2.0, 3.31], [-0.8, -4.0]] as const) expect(stoppedAt(house, lx, lz)).toBeGreaterThan(0.2);
    expect(house.inside(world(0, 0).x, world(0, 0).z)).toBe(true);
    expect(house.inside(doorway.x + 5, doorway.z)).toBe(false);
    expect(house.inside(house.bedSeat.x, house.bedSeat.z)).toBe(true);
    expect(house.bedSeat.y).toBeGreaterThan(HOME_FLOOR_Y + 0.4);
  });

  test("the inner walls, the columns, the pools, the couches and the bed stop walkers; every doorway lets them pass", () => {
    const house = buildHomeHouse(terrainHeight);
    // Solid wall pieces: the atrium's front wall beside the cells' doors, a tablinum side wall, the wing's partition.
    for (const [lx, lz] of [[-2.5, 1.9], [1.0, 1.9], [-1.4, -1.2], [1.4, -1.6], [3.0, 0.7], [-0.75, 2.6]] as const) expect(stoppedAt(house, lx, lz)).toBeGreaterThan(0.2);
    for (const [lx, lz] of [...ATRIUM_COLUMNS, ...PERISTYLE_COLUMNS, ...PORTICO_COLUMNS]) expect(stoppedAt(house, lx, lz, 0.2)).toBeGreaterThan(0.1);
    // The impluvium and the garden's pool are basins: nobody wades.
    const imp = mid(IMPLUVIUM);
    expect(stoppedAt(house, imp.x, imp.z)).toBeGreaterThan(0.3);
    expect(stoppedAt(house, PERISTYLE_POOL.x, PERISTYLE_POOL.z)).toBeGreaterThan(0.3);
    // The bed, the lamp table, and the dining couches.
    expect(stoppedAt(house, BED.lx, BED.lz)).toBeGreaterThan(0.3);
    expect(stoppedAt(house, LAMP_TABLE.x, LAMP_TABLE.z)).toBeGreaterThan(0.2);
    expect(stoppedAt(house, 4.6, 2.85)).toBeGreaterThan(0.2);
    // Every doorway is passable at a walker's size: its middle stays put.
    for (const w of WALLS) {
      for (const o of w.open) {
        const u = (o.from + o.to) / 2;
        const [lx, lz] = w.axis === "x" ? [u, w.c] : [w.c, u];
        expect(stoppedAt(house, lx, lz, 0.3)).toBeLessThan(0.05);
      }
    }
  });

  test("a visitor can walk from the lawn to every room, through the door, the fauces and the atrium to the peristyle", () => {
    const house = buildHomeHouse(terrainHeight);
    const CELL = 0.1;
    const x0 = -3.2, z0 = -5.2, nx = Math.round((6.8 - x0) / CELL), nz = Math.round((5.6 - z0) / CELL);
    const blocked = (i: number, j: number) => {
      const lx = x0 + i * CELL, lz = z0 + j * CELL;
      // Out in the open (beyond the walls) is free; the walls are the colliders' business.
      return stoppedAt(house, lx, lz, 0.3) > 0.02;
    };
    const seen = new Uint8Array(nx * nz);
    const start = [Math.round((0 - x0) / CELL), Math.round((5.2 - z0) / CELL)] as const; // out on the steps' lawn
    expect(blocked(start[0], start[1])).toBe(false);
    const queue: number[] = [start[1] * nx + start[0]];
    seen[queue[0]!] = 1;
    for (let h = 0; h < queue.length; h++) {
      const c = queue[h]!;
      const i = c % nx, j = Math.floor(c / nx);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz || seen[nj * nx + ni] || blocked(ni, nj)) continue;
        seen[nj * nx + ni] = 1;
        queue.push(nj * nx + ni);
      }
    }
    const reached = (r: Rect) => {
      for (let lz = r.z0 + 0.35; lz <= r.z1 - 0.35; lz += CELL) {
        for (let lx = r.x0 + 0.35; lx <= r.x1 - 0.35; lx += CELL) {
          const i = Math.round((lx - x0) / CELL), j = Math.round((lz - z0) / CELL);
          if (seen[j * nx + i]) return true;
        }
      }
      return false;
    };
    for (const id of ["fauces", "atrium", "tablinum", "garden", "triclinium", "cubiculum", "gallery", "cellS", "cellN"] as const) expect(reached(ROOMS[id])).toBe(true);
    // And the walk is a true walk: the garden is not reached without the doorway (a walker stopped at the shut tablinum's side wall stays out).
    expect(blocked(Math.round((-1.4 - x0) / CELL), Math.round((-1.2 - z0) / CELL))).toBe(true);
  });
});

describe("the spots, the bed, the lamp, the keepsakes", () => {
  test("every spot is inside the house, clear of the furniture, in the room it belongs to", () => {
    const house = buildHomeHouse(terrainHeight);
    for (const spot of [house.arrangeSpot, house.restSpot, house.waitSpot]) {
      expect(house.inside(spot.x, spot.z)).toBe(true);
      const out = resolveCollisions(house.colliders, spot.x, spot.z, 0.3);
      expect(Math.hypot(out.x - spot.x, out.z - spot.z)).toBeLessThan(0.05);
    }
    expect(inRect(ROOMS.fauces, SPOTS.wait.x, SPOTS.wait.z)).toBe(true);
    expect(inRect(ROOMS.cubiculum, SPOTS.arrange.x, SPOTS.arrange.z)).toBe(true);
    expect(inRect(ROOMS.cubiculum, SPOTS.rest.x, SPOTS.rest.z)).toBe(true);
    // She waits by the door, facing it (local +z, as the house turns).
    expect(house.waitSpot.face).toBeCloseTo(HOME.facing);
    const wait = world(SPOTS.wait.x, SPOTS.wait.z);
    expect(house.waitSpot.x).toBeCloseTo(wait.x);
    expect(house.waitSpot.z).toBeCloseTo(wait.z);
    // The bed's edge is a seat in the bedroom, on the side toward the room, facing out.
    expect(inRect(ROOMS.cubiculum, BED.lx - BED.halfW + 0.22, BED.lz + 0.25)).toBe(true);
    const faceX = -Math.sin(house.bedSeat.rotY), faceZ = -Math.cos(house.bedSeat.rotY);
    const west = world(-1, 0); // local -x in the world: the seat looks that way
    const origin = world(0, 0);
    expect(faceX * (west.x - origin.x) + faceZ * (west.z - origin.z)).toBeGreaterThan(0.99);
  });

  test("the keepsakes all have a proper place inside the new rooms", () => {
    const house = buildHomeHouse(terrainHeight);
    house.setDecor({
      "wall-back": "star-chart", "wall-side": "fish-plaque", "shelf-left": "golden-carp-bowl",
      "shelf-right": "wedding-hands", table: "night-lamp", floor: "tree-cutting",
    });
    house.group.updateMatrixWorld(true);
    const decor = house.group.children.filter((c) => c instanceof THREE.Group && c.children.length >= 1 && c !== house.group.children.find((g) => g instanceof THREE.Group)).slice(-1)[0]!;
    expect(decor.children.length).toBe(6);
    const rooms: Rect[] = [ROOMS.cubiculum, ROOMS.cubiculum, ROOMS.cubiculum, ROOMS.cubiculum, ROOMS.cubiculum, ROOMS.fauces];
    decor.children.forEach((thing, i) => {
      const lx = thing.position.x, lz = thing.position.z;
      const r = rooms[i]!;
      expect(lx).toBeGreaterThan(r.x0 - 0.1);
      expect(lx).toBeLessThan(r.x1 + 0.1);
      expect(lz).toBeGreaterThan(r.z0 - 0.1);
      expect(lz).toBeLessThan(r.z1 + 0.1);
      const p = new THREE.Vector3(lx, 0, lz).applyMatrix4(house.group.matrixWorld);
      expect(house.inside(p.x, p.z)).toBe(true);
    });
  });

  test("the lamp stands on its table in the bedroom, and there is only the one light", () => {
    const house = buildHomeHouse(terrainHeight);
    let lights = 0;
    house.group.traverse((o) => {
      if (o instanceof THREE.Light) lights++;
    });
    expect(lights).toBe(1);
    expect(inRect(ROOMS.cubiculum, house.lamp.position.x, house.lamp.position.z)).toBe(true);
    expect(Math.hypot(house.lamp.position.x - LAMP_TABLE.x, house.lamp.position.z - LAMP_TABLE.z)).toBeLessThan(0.3);
  });

  test("it is a few dozen meshes, not a thousand (the static dressing is batched)", () => {
    const house = buildHomeHouse(terrainHeight);
    let meshes = 0;
    house.group.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes++;
    });
    expect(meshes).toBeLessThan(140);
  });
});

describe("the door, the lamp, the hush and the tender props still work", () => {
  const first = (house: ReturnType<typeof buildHomeHouse>) => house.group.children.find((c) => c.type === "Group" && c.children.length >= 3)!;

  test("the door swings open as someone comes near, and closes behind them", () => {
    const house = buildHomeHouse(terrainHeight);
    const hinge = first(house);
    const far = world(0, 30);
    for (let i = 0; i < 60; i++) house.update(1 / 30, [far], 0);
    expect(hinge.rotation.y).toBeLessThan(0.05);
    const near = world(0, 5);
    for (let i = 0; i < 60; i++) house.update(1 / 30, [near], 0);
    expect(hinge.rotation.y).toBeGreaterThan(1.2);
    for (let i = 0; i < 90; i++) house.update(1 / 30, [far], 0);
    expect(hinge.rotation.y).toBeLessThan(0.05);
  });

  test("the lamp is lit while anyone is home in any room, an ember when the house is empty", () => {
    const house = buildHomeHouse(terrainHeight);
    const away = world(0, 30);
    for (let i = 0; i < 60; i++) house.update(1 / 30, [away], 1);
    const ember = house.lamp.intensity;
    // Someone in the peristyle's gallery, far from the lamp, is still home.
    const p = world(1.2, -2.8);
    expect(house.update(1 / 30, [p], 1)).toBe(true);
    for (let i = 0; i < 90; i++) house.update(1 / 30, [p], 1);
    expect(house.lamp.intensity).toBeGreaterThan(ember * 5);
    expect(house.lamp.intensity).toBeGreaterThan(3);
  });

  test("a night together: door shut, lamp dimmed, dawn through the window; and the house is itself again", () => {
    const house = buildHomeHouse(terrainHeight);
    const hinge = first(house);
    const inside = world(SPOTS.rest.x, SPOTS.rest.z);
    const atDoor = world(0, 2.6);
    for (let i = 0; i < 60; i++) house.update(1 / 30, [inside, atDoor], 1);
    const lit = house.lamp.intensity;
    house.setHush({ doorShut: true, lampDim: 1, dawn: 0 });
    for (let i = 0; i < 150; i++) house.update(1 / 30, [inside, atDoor], 1);
    expect(house.lamp.intensity).toBeLessThan(lit * 0.4);
    expect(hinge.rotation.y).toBeLessThan(0.05);
    house.setHush({ doorShut: true, lampDim: 1, dawn: 1 });
    house.update(1 / 30, [inside], 1);
    expect(house.lamp.intensity).toBeGreaterThan(4);
    // The dawn comes from the window above the bed, in the bedroom.
    expect(inRect(ROOMS.cubiculum, house.lamp.position.x, house.lamp.position.z)).toBe(true);
    house.setHush(null);
    for (let i = 0; i < 150; i++) house.update(1 / 30, [inside, atDoor], 1);
    expect(hinge.rotation.y).toBeGreaterThan(1);
  });

  test("the tender props (fire, tray, letter) show one at a time and are put away", () => {
    const house = buildHomeHouse(terrainHeight);
    const tender = house.group.children.filter((c) => c.type === "Group")[1]!;
    expect(tender.children.length).toBe(3);
    const shown = () => tender.children.map((c) => c.visible);
    expect(shown()).toEqual([false, false, false]);
    house.setTender("fire");
    expect(shown()).toEqual([true, false, false]);
    house.setTender("tray");
    expect(shown()).toEqual([false, true, false]);
    house.setTender("letter");
    expect(shown()).toEqual([false, false, true]);
    house.setTender(null);
    expect(shown()).toEqual([false, false, false]);
    // They stand in the bedroom, by the bed.
    for (const prop of tender.children) expect(inRect(ROOMS.cubiculum, prop.position.x, prop.position.z)).toBe(true);
    // The fire turns the one lamp to the brazier.
    house.setTender("fire");
    const home = world(SPOTS.rest.x, SPOTS.rest.z);
    for (let i = 0; i < 120; i++) house.update(1 / 30, [home], 1);
    const brazier = tender.children[0]!.position;
    expect(Math.hypot(house.lamp.position.x - brazier.x, house.lamp.position.z - brazier.z)).toBeLessThan(0.1);
  });
});

test("the steps a walker stands on are the steps the scene draws, and they climb from the lawn to the floor", () => {
  const house = buildHomeHouse(terrainHeight);
  let below = -Infinity;
  for (const step of [...HOME_STEPS].reverse()) {
    const p = homeToWorld(0, step.lz);
    // The walker stands on the step's top.
    expect(groundHeightAt(p.x, p.z)).toBeCloseTo(Math.max(step.top, terrainHeight(p.x, p.z)), 5);
    // Each step is above the ground at it and below the floor, rising toward the door.
    expect(step.top).toBeGreaterThan(terrainHeight(p.x, p.z));
    expect(step.top).toBeLessThan(HOME_FLOOR_Y);
    expect(step.top).toBeGreaterThan(below);
    below = step.top;
  }
  // The drawn step blocks' tops match (house-local y + the floor height).
  const tops = house.group.children
    .filter((o) => o instanceof THREE.Mesh && (o.geometry as THREE.BoxGeometry).parameters?.depth === 0.64)
    .map((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.BoxGeometry;
      return +(o.position.y + g.parameters.height / 2 + HOME_FLOOR_Y).toFixed(4);
    })
    .sort();
  expect(tops).toEqual(HOME_STEPS.map((s) => +s.top.toFixed(4)).sort());
});
