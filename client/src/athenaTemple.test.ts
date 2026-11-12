// Task 88: Athena's temple is a room you can walk into. A real walker (the
// scene's own collision code, its 0.5 m clearance and the real walk heights)
// climbs the stair, passes the door and stands before her; the walls hold.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { athenaColliders, athenaWorld, ATHENA_LAMP_STANDS } from "./athenaTemple";
import { circ, resolveCollisions, type Obstacle } from "./collision";
import { ATHENA_STATUE, DRESSING_PIECES } from "./idyllicDressing";
import { ATHENA_SEAT, ATHENA_TEMPLE, LUCRETIA, PLACES, WALK_SURFACES, groundHeightAt, terrainHeight } from "./town";
import { buildAthenaTemple } from "./tributes";

const T = ATHENA_TEMPLE;
const C = T.cella;
const [PX, PZ] = T.position;
const OBSTACLES: Obstacle[] = [...athenaColliders(), ...T.olives.map(([x, z]) => circ(x, z, 0.3))];
const WALKER = 0.55; // the clearance the scene's walking step uses

/** Walk from a point toward a target in 0.08 m steps through the real collision resolve; returns the track. */
function walk(from: [number, number], to: [number, number]): { x: number; z: number; y: number }[] {
  let [x, z] = from;
  const track = [{ x, z, y: groundHeightAt(x, z) }];
  for (let i = 0; i < 600; i++) {
    const d = Math.hypot(to[0] - x, to[1] - z);
    if (d < 0.05) break;
    const s = Math.min(0.08, d);
    const r = resolveCollisions(OBSTACLES, x + ((to[0] - x) / d) * s, z + ((to[1] - z) / d) * s, WALKER);
    x = r.x; z = r.z;
    track.push({ x, z, y: groundHeightAt(x, z) });
  }
  return track;
}
const local = (p: { x: number; z: number }): [number, number] => [p.x - PX, p.z - PZ];
const athena = DRESSING_PIECES.find((p) => p.id === "athena")!;
const ground = terrainHeight(PX, PZ);

describe("the plot: a bigger temple that fits (Task 88)", () => {
  test("it grew backward, so the front, the step, the seat and the olives are where they were", () => {
    expect(T.position).toEqual([-20.6, 8.0]);
    expect(T.halfX).toBe(1.85);
    expect(ATHENA_SEAT.x).toBeCloseTo(PX + 1.85 + 0.3);
    expect(T.backX).toBeGreaterThan(T.halfX); // longer than before (3.7 m): 5.15 m now
    expect(T.halfZ).toBeGreaterThan(1.8);
  });
  test("it clears the houses' platforms, the rock behind it and the walking rim", () => {
    const sounds = PLACES.find((p) => p.id === "sounds")!, garden = PLACES.find((p) => p.id === "garden")!;
    const platformHalf = ((sounds.buildingWidth ?? 7.6) + 1.3 + 0.4) / 2; // the lower step, which faces east/west
    expect(PZ - T.halfZ - (sounds.position[1] + platformHalf)).toBeGreaterThan(1);
    expect(garden.position[1] - platformHalf - (PZ + T.halfZ)).toBeGreaterThan(0.6);
    expect(PX - T.backX - (-24.6 + 0.43)).toBeGreaterThan(0.25); // the rock at (-24.6, 7.6), 0.85 wide
    expect(terrainHeight(PX - T.backX - 1, PZ)).toBe(0); // flat to the back wall's foot and a metre past
    expect(Math.hypot(PX - T.backX, PZ)).toBeLessThan(52 - 20); // far inside the rim
    expect(LUCRETIA.position[0] - (PX + T.halfX + 3.35)).toBeGreaterThan(5); // the flights end 5.8 m short of Lucretia
  });
  test("the olives stand clear of the flights", () => {
    for (const [, oz] of T.olives) expect(Math.abs(oz - PZ)).toBeGreaterThan(T.stair.z + T.stair.width / 2 + 0.3 + 0.2);
  });
});

describe("the stair (Task 88)", () => {
  test("the treads climb to the podium in even steps of 0.15, ground to floor, with a real height under every foot", () => {
    expect(T.stair.treads * T.stair.rise + T.stair.rise).toBeCloseTo(T.podiumY, 6);
    for (const side of [-1, 1]) {
      let last = ground;
      for (let k = 1; k <= T.stair.treads; k++) {
        const x = PX + T.halfX + (T.stair.treads - k) * T.stair.run + T.stair.run / 2;
        const h = groundHeightAt(x, PZ + side * T.stair.z);
        expect(h - last).toBeCloseTo(T.stair.rise, 6);
        last = h;
      }
      expect(groundHeightAt(PX + T.halfX - 0.2, PZ + side * T.stair.z) - last).toBeCloseTo(T.stair.rise, 6); // the last riser, onto the podium
    }
    expect(groundHeightAt(PX - 1, PZ)).toBeCloseTo(ground + T.podiumY); // inside the cella: the floor at podium height
  });
  test("a walker goes up from the lawn without a jump: no foot rises more than 0.16 m between two steps", () => {
    const track = walk([PX + 5, PZ + T.stair.z], [PX + 1.5, PZ + T.stair.z]);
    for (let i = 1; i < track.length; i++) expect(track[i]!.y - track[i - 1]!.y).toBeLessThanOrEqual(0.16);
    expect(track[track.length - 1]!.y).toBeCloseTo(ground + T.podiumY);
  });
  test("both flights are open to a walker and the seat step is not in their way", () => {
    for (const side of [-1, 1]) {
      const p = resolveCollisions(OBSTACLES, PX + 2.8, PZ + side * T.stair.z, WALKER);
      expect(p.x).toBeCloseTo(PX + 2.8, 2);
      expect(p.z).toBeCloseTo(PZ + side * T.stair.z, 2);
    }
  });
  test("the stair does not block the bench: the seat, both slots and the step in front of the sitters are unobstructed by treads", () => {
    for (const slot of [-1, 0, 1]) {
      const z = ATHENA_SEAT.z + slot * 0.42;
      expect(Math.abs(z - PZ)).toBeLessThan(T.stepHalfZ - 0.3); // each slot is on the step's own width
    }
    expect(T.stair.z - T.stair.width / 2).toBeGreaterThan(T.stepHalfZ); // the flights start beyond the step
    expect(ATHENA_SEAT.z).toBe(PZ);
    expect(ATHENA_SEAT.x).toBeGreaterThan(PX + T.halfX);
    expect(ATHENA_SEAT.x).toBeLessThan(PX + T.halfX + T.stepDepth);
    const scene = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
    expect(scene).toContain('{ id: "bench-athena", x: ATHENA_SEAT.x, z: ATHENA_SEAT.z, rotY: ATHENA_SEAT.rotY, seatTop: ATHENA_TEMPLE.stepY');
  });
});

describe("the doorway and the walk in (Task 88)", () => {
  test("a walker climbs the stair, crosses the portico, passes the door and stands before Athena", () => {
    const legs: [number, number][] = [
      [PX + 5, PZ + T.stair.z], [PX + 1.5, PZ + T.stair.z], [PX + 1.5, PZ], [PX + C.x1 + 0.4, PZ], [PX + C.x1 - 0.6, PZ],
      [PX + T.statueX + 0.35 + 0.5 + 0.1, PZ], // just in front of her collision circle
    ];
    let at = legs[0]!;
    const all: { x: number; z: number; y: number }[] = [];
    for (const leg of legs.slice(1)) {
      const t = walk(at, leg);
      all.push(...t);
      const end = t[t.length - 1]!;
      expect(Math.hypot(end.x - leg[0], end.z - leg[1])).toBeLessThan(0.1); // arrived, never stuck
      at = [end.x, end.z];
    }
    for (let i = 1; i < all.length; i++) expect(all[i]!.y - all[i - 1]!.y).toBeLessThanOrEqual(0.16);
    const end = all[all.length - 1]!;
    expect(end.y).toBeCloseTo(ground + T.podiumY); // on her floor
    const [lx] = local(end);
    expect(lx).toBeGreaterThan(C.x0 + C.wall); // inside the cella
    expect(lx).toBeLessThan(C.x1 - C.wall);
    expect(lx - T.statueX).toBeGreaterThan(0.4); // before her, not in her
    expect(lx - T.statueX).toBeLessThan(1.5); // and near enough to stand before her
  });
  test("there is room to spare inside: a walker keeps a clear floor of 1.5 m by 2 m or more", () => {
    // the interior, less the wall pad on each side (0.2 m) and the statue's circle
    expect(C.x1 - C.wall - (C.x0 + C.wall) - 2 * 0.2).toBeGreaterThan(2.2);
    expect(2 * (C.halfZ - C.wall) - 2 * 0.2).toBeGreaterThanOrEqual(3);
    expect(C.x1 - C.wall - (T.statueX + 0.35 + 0.1) - 0.2).toBeGreaterThan(1.5);
  });
  test("the doorway is a passable opening: 1.4 m wide, 2.05 m high, a walker goes through anywhere across its middle", () => {
    expect(C.doorHalf * 2).toBeGreaterThanOrEqual(1.4);
    expect(C.doorH).toBeGreaterThanOrEqual(2.0);
    expect(C.doorH).toBeLessThan(C.height);
    for (const dz of [-0.4, -0.2, 0, 0.2, 0.4]) {
      const t = walk([PX + 1.5, PZ + dz], [PX - 1.2, PZ + dz]);
      const end = t[t.length - 1]!;
      expect(Math.abs(end.x - (PX - 1.2))).toBeLessThan(0.1);
    }
  });
  test("the wall either side of the door is a wall: a walker aimed at it at any point stops outside", () => {
    for (const dz of [0.9, 1.2, 1.5, -0.9, -1.2, -1.5]) {
      const t = walk([PX + 1.5, PZ + dz], [PX - 1.2, PZ + dz]);
      const [lx] = local(t[t.length - 1]!);
      expect(lx).toBeGreaterThan(C.x1 - 0.1 - 0.0); // held at the front wall, not inside the room
    }
  });
  test("the cella's walls hold: walked at from every side, nobody ends inside a wall or on the podium from the lawn's sides and back", () => {
    const walls: [number, number, number, number][] = [
      [C.x0, C.x0 + C.wall, -C.halfZ, C.halfZ], [C.x0, C.x1, -C.halfZ, -C.halfZ + C.wall], [C.x0, C.x1, C.halfZ - C.wall, C.halfZ],
      [C.x1 - C.wall, C.x1, C.doorHalf, C.halfZ], [C.x1 - C.wall, C.x1, -C.halfZ, -C.doorHalf],
    ];
    for (let a = 0; a < 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      const from: [number, number] = [PX - 0.7 + Math.cos(rad) * 8, PZ + Math.sin(rad) * 8];
      const t = walk(from, [PX - 1.5, PZ + 0.25]); // aimed at the middle of the room
      let maxY = 0;
      for (const p of t) {
        const [lx, lz] = local(p);
        for (const [x0, x1, z0, z1] of walls) expect(lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1).toBe(false);
        maxY = Math.max(maxY, p.y - ground);
      }
      // from the back and the sides the podium's rail keeps them off it; from the front the stair is the way up
      const fromFront = from[0] > PX + T.halfX + 0.5 && Math.abs(from[1] - PZ) < 4.5;
      if (!fromFront) expect(maxY).toBeLessThan(0.5);
    }
  });
  test("she is a solid figure and the lamps are stands: nobody walks through her", () => {
    const t = walk([PX - 0.6, PZ], [PX + T.statueX, PZ]);
    const [lx] = local(t[t.length - 1]!);
    expect(lx - T.statueX).toBeGreaterThan(0.35);
    for (const [lx2, lz2] of ATHENA_LAMP_STANDS) {
      const e = walk([PX + lx2 + 1, PZ + lz2], [PX + lx2, PZ + lz2]);
      expect(Math.hypot(e[e.length - 1]!.x - (PX + lx2), e[e.length - 1]!.z - (PZ + lz2))).toBeGreaterThan(0.08);
    }
  });
});

describe("the temple as built: Athena, the lamp, the sightline, the ridge (Task 88)", () => {
  const { group } = buildAthenaTemple(0);
  group.position.set(0, 0, 0); // the temple's own frame: front +x, floor at 0
  group.updateMatrixWorld(true);
  const meshes: THREE.Object3D[] = [];
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o); });
  const blocked = (from: THREE.Vector3, to: THREE.Vector3) => {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const hit = new THREE.Raycaster(from, dir.normalize()).intersectObjects(meshes, false)[0];
    return hit !== undefined && hit.distance < len - 0.02;
  };

  test("Athena is against the back wall on the axis, facing east, full size, with headroom", () => {
    expect(athena.x - PX).toBe(T.statueX);
    expect(athena.z).toBe(PZ);
    expect(Math.sin(athena.rotY)).toBeCloseTo(1); // her front is local +z, rotated to east
    expect(athena.height).toBe(1.8);
    expect(ATHENA_STATUE.height).toBe(1.8); // not scaled down
    expect(athena.lift).toBe(T.podiumY);
    expect(T.statueX - 0.31 - (C.x0 + C.wall)).toBeLessThan(0.2); // a hand from the back wall
    expect(T.statueX - 0.31 - (C.x0 + C.wall)).toBeGreaterThan(0);
    expect(T.podiumY + C.height - (athena.lift! + athena.height!)).toBeGreaterThanOrEqual(0.15); // 0.5 m of air over her head
  });
  test("the bench sees her through the doorway: both sitters, her chest and her head, nothing in the way", () => {
    for (const slot of [-0.42, 0, 0.42]) {
      const eye = new THREE.Vector3(ATHENA_SEAT.x - PX, T.stepY + 0.85, slot);
      for (const y of [T.podiumY + 1.0, T.podiumY + 1.4, T.podiumY + 1.7]) {
        expect(blocked(eye, new THREE.Vector3(T.statueX + 0.3, y, 0))).toBe(false);
      }
    }
    // and the door is the only way: the same view toward the wall beside the door is blocked
    expect(blocked(new THREE.Vector3(ATHENA_SEAT.x - PX, T.stepY + 0.85, 0), new THREE.Vector3(T.statueX + 0.3, T.podiumY + 1.4, 1.5))).toBe(true);
  });
  test("one warm light inside, between the lamps, under the ceiling, near her; two bronze stands against the back wall", () => {
    const lights: THREE.PointLight[] = [];
    group.traverse((o) => { if ((o as THREE.PointLight).isPointLight) lights.push(o as THREE.PointLight); });
    expect(lights).toHaveLength(1);
    const l = lights[0]!;
    expect(l.position.x).toBeGreaterThan(C.x0 + C.wall);
    expect(l.position.x).toBeLessThan(C.x1 - C.wall);
    expect(Math.abs(l.position.z)).toBeLessThan(C.halfZ - C.wall);
    expect(l.position.y).toBeLessThan(T.podiumY + C.height);
    expect(Math.hypot(l.position.x - T.statueX, l.position.y - (T.podiumY + 1.2))).toBeLessThan(l.distance); // she is in its reach
    expect(l.intensity).toBeGreaterThan(0);
    expect(ATHENA_LAMP_STANDS).toHaveLength(2);
    for (const [x, z] of ATHENA_LAMP_STANDS) { expect(x).toBeGreaterThan(C.x0 + C.wall); expect(Math.abs(z)).toBeLessThan(C.halfZ - C.wall); }
  });
  test("the four columns, the frieze, the wreath and the terracotta roof are still there; the roof is as high as it was", () => {
    expect(T.columnZ).toHaveLength(4);
    const ridgeAt = (lx: number) => {
      const ray = new THREE.Raycaster(new THREE.Vector3(lx, 10, 0), new THREE.Vector3(0, -1, 0));
      return ray.intersectObjects(meshes, false)[0]!.point.y;
    };
    // the old ridge: podium 0.9 + cella 2.3 + entablature 0.32 + gable 0.75 (+ the slab's thickness)
    expect(ridgeAt(0.9)).toBeGreaterThan(0.9 + 2.3 + 0.32 + 0.75);
    expect(ridgeAt(0.9)).toBeLessThan(0.9 + 2.3 + 0.32 + 0.75 + 0.12);
    // the roof runs the length of the longer temple: the perch's x (0.9) and the whole ridge are under it
    expect(ridgeAt(-2.5)).toBeGreaterThan(3.9);
    let titles = 0, leaves = 0;
    group.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === "CylinderGeometry") titles++; if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === "SphereGeometry") leaves++; });
    expect(titles).toBeGreaterThanOrEqual(4 * 2);
    expect(leaves).toBeGreaterThanOrEqual(14);
  });
  test("the phoenix perches on the same ridge, within the longer roof", () => {
    const scene = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
    expect(scene).toContain("ATHENA_TEMPLE.position[0] + 0.9,");
    expect(scene).toContain("terrainHeight(ATHENA_TEMPLE.position[0], ATHENA_TEMPLE.position[1]) + 0.9 + 2.3 + 0.32 + 0.75 - 0.35");
    expect(0.9).toBeLessThan(T.halfX);
    expect(0.9).toBeGreaterThan(-T.backX);
  });
  test("the walking height is registered once: the podium and ten treads, nothing else of the temple", () => {
    const mine = WALK_SURFACES.filter((w) => w.label.startsWith("athena temple"));
    expect(mine).toHaveLength(1 + 2 * T.stair.treads);
    expect(mine.filter((w) => w.label.includes("stair"))).toHaveLength(2 * T.stair.treads);
    expect(athenaWorld(0, 0)).toEqual([PX, PZ]);
  });
});
