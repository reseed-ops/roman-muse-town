import { expect, test } from "bun:test";
import * as THREE from "three";
import { CLIFF, clampToWorld, onLand, walkable } from "./seaCliff";
import { groundHeightAt, terrainHeight } from "./town";
import { insideStairMass, nearestStairPoint, SEA_Y, shoreStairY, STAIR, STAIR_STEPS, stairWalkable, stairY, treadTop } from "./shoreStair";
import {
  clampToSea,
  companionPace,
  confine,
  depthWish,
  distanceToLand,
  edgeEase,
  inSwimBounds,
  seabedHeight,
  seabedMeshHeight,
  shouldSwim,
  shouldWalk,
  surfaceY,
  SWIM,
  SWIM_EXIT,
  swimCeiling,
  swimCompanionSpot,
  swimFloor,
  swimMove,
  swimPoseAngles,
  swimWish,
  underwaterColor,
  underwaterFog,
  underwaterLightScale,
  underwaterMix,
  waterOverStair,
} from "./swim";
import type { SwimPos } from "./swim";
import { buildSwimWorld, SEABED_EXTENT, swimBoundsCovered } from "./swimScene";
import { buildSeaCliff } from "./seaCliff";

// Swimming in the sea (Task 100), pinned off the scene.

const forest = { norm: (x: number, z: number) => Math.hypot((x + 44) / 11.5, (z + 22) / 15), cx: -44, cz: -22 };

test("the stair's sea level is the cliff's, and its water line falls where the numbers say", () => {
  expect(SEA_Y).toBe(CLIFF.seaY);
  // The stair is a tread of 0.3 by 0.5, 96 of them, down to 28.8 m below the head.
  expect(STAIR_STEPS).toBe(96);
  expect(stairY(STAIR.endZ)).toBeCloseTo(-28.8, 6);
  expect(treadTop(0)).toBeCloseTo(-0.15);
});

test("the way in: from the trail, the landing, then the stair, all walkable and all on the world's clamp", () => {
  // The trail's east edge to the landing to the stair's head.
  for (const [x, z] of [[5.0, 57], [8, 57], [11.9, 57], [11.9, 58.5], [11.9, 80], [11.9, 100]] as const) {
    expect(walkable(x, z)).toBe(true);
    expect(clampToWorld(x, z, forest)).toEqual({ x, z });
  }
  // The trail still joins it: the strip's edge at z 57 is the landing's west end.
  expect(walkable(5.4, 57)).toBe(true);
  // Off the stair's edge, over the sea: eased back onto it, not left in the air.
  const c = clampToWorld(16, 90, forest);
  expect(stairWalkable(c.x, c.z)).toBe(true);
  expect(nearestStairPoint(30, 70).x).toBeCloseTo(STAIR.x1);
});

test("the ground falls with the stair, steadily, to the water and under it; the rest of the ground is unchanged", () => {
  let last = groundHeightAt(11.9, STAIR.topZ);
  expect(last).toBeCloseTo(0, 6);
  for (let z = STAIR.topZ + 0.5; z <= STAIR.endZ; z += 0.5) {
    const y = groundHeightAt(11.9, z);
    expect(y).toBeLessThan(last);
    expect(last - y).toBeLessThan(0.31); // no step taller than a tread
    last = y;
  }
  expect(last).toBeCloseTo(-28.8, 6);
  // Land off the stair still stands at the terrain.
  for (const [x, z] of [[0, 0], [0, 80], [-30, 20], [4, 110], [-3, 56.5]] as const) {
    expect(groundHeightAt(x, z)).toBe(shoreStairY(x, z) ?? groundHeightAt(x, z));
    if (shoreStairY(x, z) === null) expect(groundHeightAt(x, z)).toBeGreaterThanOrEqual(terrainHeight(x, z) - 1e-9);
  }
});

test("the stair stands clear of the rock: off the land's outline, away from the headland", () => {
  for (let z = STAIR.topZ; z <= STAIR.endZ; z += 1) {
    for (const x of [STAIR.x0, (STAIR.x0 + STAIR.x1) / 2, STAIR.x1]) expect(onLand(x, z)).toBe(false);
  }
});

test("swim mode: enters when the water over the stair passes his chest, leaves when it falls to his thighs", () => {
  // Walking down: dry, then shallow, then past 1.15 m.
  const zs: number[] = [];
  for (let z = STAIR.topZ; z <= STAIR.endZ; z += 0.05) zs.push(z);
  let swimming = false;
  let enteredAt = -1;
  for (const z of zs) {
    if (!swimming && shouldSwim(11.9, z)) {
      swimming = true;
      enteredAt = z;
    }
  }
  expect(swimming).toBe(true);
  expect(waterOverStair(11.9, enteredAt)!).toBeGreaterThan(SWIM.enterDepth);
  expect(waterOverStair(11.9, enteredAt - 0.1)!).toBeLessThan(SWIM.enterDepth + 0.1);
  // Dry steps and the landing are never swimming; the exit comes before the entry (a gap, no flicker).
  expect(shouldSwim(11.9, 57)).toBe(false);
  expect(shouldSwim(11.9, 70)).toBe(false);
  let exitAt = -1;
  for (let z = STAIR.endZ; z >= STAIR.topZ; z -= 0.05) {
    if (shouldWalk(11.9, z)) {
      exitAt = z;
      break;
    }
  }
  expect(exitAt).toBeGreaterThan(0);
  expect(exitAt).toBeLessThan(enteredAt);
  expect(waterOverStair(11.9, exitAt)!).toBeLessThanOrEqual(SWIM.exitDepth);
  // Off the stair there is no stair to stand on: neither rule fires.
  expect(shouldSwim(30, 90)).toBe(false);
  expect(shouldWalk(30, 90)).toBe(false);
});

test("a swimmer starts on the surface, and the exit point is shallow enough to walk out", () => {
  expect(surfaceY()).toBeCloseTo(SEA_Y - SWIM.carry);
  expect(shouldWalk(SWIM_EXIT.x, SWIM_EXIT.z)).toBe(true);
  expect(shouldSwim(SWIM_EXIT.x, SWIM_EXIT.z)).toBe(false);
});

test("the stick moves him horizontally, camera-relative, as on land", () => {
  // Camera facing south (yaw 0 looks along +z): up is south, right is west... as on land.
  const up = swimWish(0, 1, 0);
  expect(up.dirX).toBeCloseTo(0);
  expect(up.dirZ).toBeCloseTo(1);
  const right = swimWish(1, 0, 0);
  expect(right.dirX).toBeCloseTo(-1); // screen-right of a south-facing camera, the walk's own rule
  expect(right.dirZ).toBeCloseTo(0);
  // Camera turned a quarter: up is now where the camera faces.
  const q = swimWish(0, 1, Math.PI / 2);
  expect(q.dirX).toBeCloseTo(1);
  expect(q.dirZ).toBeCloseTo(0);
  expect(swimWish(0, 0, 1).tilt).toBe(0);
  // The same rule the walk uses: the stick's tilt scales the pace.
  expect(swimWish(0, 0.5, 0).tilt).toBeCloseTo(0.5);
  // Moving moves x and z, leaves the depth alone.
  const a = { x: 40, y: SEA_Y - 5, z: 140 };
  const b = swimMove(a, 1, 1, 0);
  expect(b.x).toBeCloseTo(41);
  expect(b.z).toBeCloseTo(141);
  expect(b.y).toBe(a.y);
});

test("the depth buttons move him up and down, together they cancel, and he stays where he is with none (neutral buoyancy)", () => {
  expect(depthWish(true, false)).toBe(1);
  expect(depthWish(false, true)).toBe(-1);
  expect(depthWish(true, true)).toBe(0);
  expect(depthWish(false, false)).toBe(0);
  const a = { x: 40, y: SEA_Y - 5, z: 140 };
  expect(swimMove(a, 0, 0, 0.5).y).toBeCloseTo(a.y + 0.5);
  expect(swimMove(a, 0, 0, -0.5).y).toBeCloseTo(a.y - 0.5);
  expect(swimMove(a, 0, 0, 0)).toEqual(a);
});

test("he cannot pass above the surface nor through the sea floor", () => {
  let p = { x: 40, y: surfaceY() - 0.05, z: 140 };
  for (let i = 0; i < 20; i++) p = swimMove(p, 0, 0, 0.3);
  expect(p.y).toBeCloseTo(swimCeiling());
  expect(p.y).toBeLessThan(SEA_Y);
  // Sink for good: he stops half a metre over the floor.
  for (let i = 0; i < 200; i++) p = swimMove(p, 0, 0, -0.3);
  // (the floor as drawn, Task 103: the mesh's triangle, not the continuous function)
  expect(p.y).toBeCloseTo(seabedMeshHeight(40, 140) + SWIM.floorClear, 5);
  expect(p.y).toBeGreaterThan(seabedMeshHeight(40, 140));
  // Swimming along the bottom he rides up and over a rise of the floor, never into it.
  for (let x = -100; x <= 100; x += 0.7) {
    p = swimMove({ ...p, x }, 0, 0, -1);
    expect(p.y).toBeGreaterThanOrEqual(swimFloor(p.x, p.z) + SWIM.floorClear - 1e-9);
  }
});

test("the sea floor: under the whole swimmable sea, below the surface everywhere, deeper offshore, rippled and sculpted", () => {
  expect(swimBoundsCovered()).toBe(true);
  let lo = 0;
  let hi = -1e9;
  for (let x = SEABED_EXTENT.xMin; x <= SEABED_EXTENT.xMax; x += 3) {
    for (let z = SEABED_EXTENT.zMin; z <= SEABED_EXTENT.zMax; z += 3) {
      const y = seabedHeight(x, z);
      expect(y).toBeLessThan(SEA_Y - 2);
      expect(Number.isFinite(y)).toBe(true);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  }
  // Sculpted: more than 12 m of relief, from a shelf a few metres under the sea to the deep.
  expect(hi - lo).toBeGreaterThan(12);
  expect(SEA_Y - hi).toBeLessThan(4.5);
  // Shallower at the cliff's foot than far out.
  expect(seabedHeight(30, 60)).toBeGreaterThan(seabedHeight(30, 180));
  // The foot of the stair lands on the shelf: the last tread is above the sea floor's mass but the floor is within a few metres.
  expect(Math.abs(seabedHeight(11.9, 106) - stairY(106))).toBeLessThan(1.5);
});

test("the floor mesh is the floor function: every vertex on seabedHeight, built under the whole sea", () => {
  const world = buildSwimWorld({ waterNormal: new THREE.Texture() });
  const pos = world.seabed.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 97) expect(pos.getY(i)).toBeCloseTo(seabedHeight(pos.getX(i), pos.getZ(i)), 4);
  const box = new THREE.Box3().setFromObject(world.seabed);
  expect(box.min.x).toBeLessThan(SWIM.bounds.xMin);
  expect(box.max.x).toBeGreaterThan(SWIM.bounds.xMax);
  expect(box.max.z).toBeGreaterThan(SWIM.bounds.zMax);
  expect(box.max.y).toBeLessThan(SEA_Y - 1.9);
  // No kelp, no fish, no props, no lights: the water holds the floor, the stair and the surface, nothing else.
  expect(world.group.children.map((c) => c.name).sort()).toEqual(["sea-underside", "seabed", "shore-stair"]);
  let lights = 0;
  world.group.traverse((o) => {
    if ((o as THREE.Light).isLight) lights += 1;
  });
  expect(lights).toBe(0);
});

test("the surface seen from below is the sea plane's back face only, so above and below never overlap", () => {
  const world = buildSwimWorld({ waterNormal: new THREE.Texture() });
  expect(world.undersideMat.side).toBe(THREE.BackSide);
  expect(world.underside.position.y).toBe(SEA_Y);
  const sea = buildSeaCliff({ terrainHeight: () => 0, waterNormal: new THREE.Texture(), foamTexture: new THREE.Texture(), pathTexture: new THREE.Texture() });
  expect(sea.oceanMat.side).toBe(THREE.FrontSide);
  // The cliff's rock goes on below the sea: skirts to below the floor.
  const skirts: THREE.Object3D[] = [];
  sea.group.traverse((o) => {
    if (o.name === "cliff-skirt") skirts.push(o);
  });
  expect(skirts.length).toBe(3);
  for (const k of skirts) expect(new THREE.Box3().setFromObject(k).min.y).toBeLessThan(SEA_Y - 20);
});

test("the underwater view: none above the surface, full below it, a short ease across it", () => {
  expect(underwaterMix(SEA_Y + 3)).toBe(0);
  // Task 103: the spec's half metre either side of the surface (it had been a quarter).
  expect(underwaterMix(SEA_Y + 0.5)).toBe(0);
  expect(underwaterMix(SEA_Y + 0.4)).toBeGreaterThan(0);
  expect(underwaterMix(SEA_Y)).toBeCloseTo(0.5, 6);
  expect(underwaterMix(SEA_Y - 0.4)).toBeLessThan(1);
  expect(underwaterMix(SEA_Y - 0.5)).toBe(1);
  expect(underwaterMix(SEA_Y - 12)).toBe(1);
  // Monotone across the surface: no flash, no pop (each step a small change).
  let last = underwaterMix(SEA_Y + 0.6);
  for (let y = SEA_Y + 0.6; y >= SEA_Y - 0.6; y -= 0.01) {
    const m = underwaterMix(y);
    expect(m).toBeGreaterThanOrEqual(last);
    expect(m - last).toBeLessThan(0.03);
    last = m;
  }
  // Blue fog that closes in, dimmed light.
  const [r, g, b] = underwaterColor(1, 0);
  expect(b).toBeGreaterThan(g);
  expect(g).toBeGreaterThan(r);
  const fog = underwaterFog(0);
  expect(fog.far).toBeLessThan(60);
  expect(fog.near).toBeLessThan(2);
  expect(underwaterFog(1).far).toBeLessThan(fog.far);
  const dim = underwaterLightScale(1);
  expect(dim.sun).toBeLessThan(0.6);
  expect(dim.sun).toBeGreaterThan(0);
  expect(dim.hemi).toBeLessThan(1);
  expect(underwaterLightScale(0)).toEqual({ sun: 1, hemi: 1 });
  // Deeper is darker, and night is darker than day.
  const sum = (c: readonly number[]) => c[0]! + c[1]! + c[2]!;
  expect(sum(underwaterColor(12, 0))).toBeLessThan(sum(underwaterColor(1, 0)));
  expect(sum(underwaterColor(1, 1))).toBeLessThan(sum(underwaterColor(1, 0)));
});

test("the swimmer stays within the sea's bounds, however he pushes", () => {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, -1]] as const) {
    let p = { x: 12, y: surfaceY(), z: 120 };
    for (let i = 0; i < 4000; i++) p = swimMove(p, dx * 0.1, dz * 0.1, 0);
    expect(inSwimBounds(p.x, p.z)).toBe(true);
    expect(p.z).toBeGreaterThanOrEqual(CLIFF.coastZ);
    expect(onLand(p.x, p.z)).toBe(false);
  }
  expect(clampToSea(500, 900)).toEqual({ x: SWIM.bounds.xMax, z: SWIM.bounds.zMax });
  // The soft edge: full in the open, none at the boundary.
  expect(edgeEase(0, 120)).toBe(1);
  expect(edgeEase(SWIM.bounds.xMax, 120)).toBe(0);
  expect(edgeEase(SWIM.bounds.xMax - 6, 120)).toBeGreaterThan(0);
  expect(edgeEase(SWIM.bounds.xMax - 6, 120)).toBeLessThan(1);
});

test("the swimmer cannot swim into the cliff, and keeps off its foot", () => {
  // From the open water toward the headland, the strip, the shoulder's coast, the straight coast.
  for (const [sx, sz, tx, tz] of [[30, 130, 0, 113], [-40, 125, -40, 90], [-80, 120, -80, 60], [60, 90, 60, 40], [20, 100, 0, 100]] as const) {
    let p: SwimPos = { x: sx, y: surfaceY(), z: sz };
    const n = 600;
    for (let i = 0; i < n; i++) {
      p = swimMove(p, ((tx - sx) / n) * 1.2, ((tz - sz) / n) * 1.2, 0);
      const inStairZone = p.x >= 9 && p.x <= 14 && p.z <= 107; // the stair's own water, where the walkway's edge is the wall
      if (!inStairZone) expect(distanceToLand(p.x, p.z)).toBeGreaterThanOrEqual(SWIM.landMargin - 0.05);
    }
  }
  // Confining is idempotent in open water.
  expect(confine(40, 140)).toEqual({ x: 40, z: 140 });
});

test("the stair is solid under the tread: a swimmer cannot enter it from the side, but skims the submerged steps", () => {
  expect(insideStairMass(12, SEA_Y - 5, 90)).toBe(true); // under the dry steps
  expect(insideStairMass(12, SEA_Y - 0.12, 104)).toBe(false); // above the last steps
  // From the open east, at depth, he is stopped at the stair's outer wall.
  let p = { x: 20, y: SEA_Y - 6, z: 90 };
  for (let i = 0; i < 400; i++) p = swimMove(p, -0.05, 0, 0);
  expect(p.x).toBeGreaterThanOrEqual(STAIR.meshX1 - 1e-6);
  // And along the surface he can swim up the submerged steps to the exit and no further than the dry ones.
  let q = { x: 12.6, y: surfaceY(), z: 108 };
  for (let i = 0; i < 400; i++) q = swimMove(q, 0, -0.05, 0);
  expect(q.z).toBeGreaterThan(60);
  expect(shouldWalk(q.x, q.z)).toBe(true);
  expect(q.z).toBeLessThan(102);
});

test("down the stair, into the sea, and back out onto the steps: the whole round trip", () => {
  // Walk down (mode switch by the rules), swim out and back, climb out.
  let swimming = false;
  let pos = { x: 11.9, z: 57.5 };
  let y = 0;
  for (let z = 58; z <= 104; z += 0.1) {
    pos = { x: 11.9, z };
    if (!swimming && shouldSwim(pos.x, pos.z)) {
      swimming = true;
      y = surfaceY();
      break;
    }
  }
  expect(swimming).toBe(true);
  // The swimmer starts at the surface, a hair over the steps.
  expect(y).toBeGreaterThan(stairFloor(pos.x, pos.z));
  let b = { x: pos.x, y, z: pos.z };
  // Out to sea, east then south.
  for (let i = 0; i < 100; i++) b = swimMove(b, 0.06, 0.03, -0.03);
  expect(b.x).toBeGreaterThan(14);
  expect(b.y).toBeLessThan(surfaceY());
  // Back: up to the surface, west to the stair, north up the steps.
  for (let i = 0; i < 120; i++) b = swimMove(b, 0, 0, 0.05);
  for (let i = 0; i < 200; i++) b = swimMove(b, -0.06, -0.01, 0);
  for (let i = 0; i < 400 && !shouldWalk(b.x, b.z); i++) b = swimMove(b, 0, -0.05, 0);
  expect(shouldWalk(b.x, b.z)).toBe(true);
  expect(walkable(b.x, b.z)).toBe(true);
});

function stairFloor(x: number, z: number) {
  void x;
  return stairY(z);
}

test("Aelia: she swims at his right and a little behind, as she walks, and takes the same water rules he does", () => {
  const him = { x: 30, z: 130, heading: 0 }; // swimming south
  const spot = swimCompanionSpot(him);
  expect(spot.x).toBeCloseTo(30 - SWIM.companion.side * 1); // his right, facing south, is west
  expect(spot.z).toBeCloseTo(130 - SWIM.companion.back);
  // She enters and leaves the water at the same depths he does.
  expect(shouldSwim(SWIM_EXIT.x, 103)).toBe(true);
  expect(shouldWalk(SWIM_EXIT.x, 101)).toBe(true);
});

test("Aelia follows him into the water, keeps his side while he swims, and swims out to the steps when he has gone ashore", () => {
  // The same step her hook takes, run as a sim: she starts where she turned swimmer, at the stair's foot.
  let her = { x: 11.9, y: surfaceY(), z: 104 };
  let heading = 0;
  let speed = 0;
  let hisPace = 0;
  const dt = 1 / 30;
  const stepToward = (target: { x: number; z: number }, wantY: number) => {
    const dx = target.x - her.x;
    const dz = target.z - her.z;
    const dist = Math.hypot(dx, dz);
    const want = companionPace(dist, hisPace);
    speed += (want - speed) * (1 - Math.exp(-dt * 5));
    const dy = Math.max(-SWIM.vSpeed * dt, Math.min(SWIM.vSpeed * dt, wantY - her.y));
    her = swimMove(her, dist > 1e-6 ? (dx / dist) * speed * dt : 0, dist > 1e-6 ? (dz / dist) * speed * dt : 0, dy);
  };
  // He swims out south-east at 2.3 m/s for 12 s, 3 m down.
  let him = { x: 14, y: surfaceY(), z: 104 };
  heading = Math.atan2(0.6, 0.8);
  for (let i = 0; i < 12 * 30; i++) {
    hisPace = SWIM.speed;
    him = swimMove(him, Math.sin(heading) * SWIM.speed * dt, Math.cos(heading) * SWIM.speed * dt, i < 60 ? -SWIM.vSpeed * dt : 0);
    stepToward(swimCompanionSpot({ x: him.x, z: him.z, heading }), him.y);
  }
  const spot = swimCompanionSpot({ x: him.x, z: him.z, heading });
  expect(Math.hypot(her.x - spot.x, her.z - spot.z)).toBeLessThan(0.5);
  expect(Math.abs(her.y - him.y)).toBeLessThan(0.3);
  expect(distanceToLand(her.x, her.z)).toBeGreaterThanOrEqual(SWIM.landMargin - 0.05);
  // He goes ashore: she turns for the steps and is shallow enough to walk out.
  for (let i = 0; i < 60 * 30 && !shouldWalk(her.x, her.z); i++) stepToward({ x: SWIM_EXIT.x, z: SWIM_EXIT.z }, surfaceY());
  expect(shouldWalk(her.x, her.z)).toBe(true);
});

test("the swimming pose: a clear crawl, arms in turn, legs flutter, head up, lying a quarter turn over", () => {
  const a = swimPoseAngles(0, 1);
  const b = swimPoseAngles(Math.PI / 2, 1);
  expect(a.bodyPitch).toBeCloseTo(Math.PI / 2);
  expect(a.headX).toBeLessThan(0);
  // Arms are opposite: when one is overhead the other is at the side (each arm's own raise is its roll, mirrored).
  const lift = (p: ReturnType<typeof swimPoseAngles>) => [p.lArmZ, -p.rArmZ] as const;
  expect(Math.sign(lift(b)[0] - 0.25)).toBe(-Math.sign(lift(b)[1] - 0.25));
  expect(lift(a)[0]).not.toBeCloseTo(lift(b)[0], 2);
  // Modest: no limb past a plausible range.
  for (let ph = 0; ph < 7; ph += 0.2) {
    const p = swimPoseAngles(ph, 1);
    for (const v of lift(p)) {
      expect(v).toBeGreaterThan(-1.3);
      expect(v).toBeLessThan(1.6);
    }
    expect(Math.abs(p.lLegX)).toBeLessThan(0.2);
  }
  // Floating is gentler than swimming.
  const fl = swimPoseAngles(Math.PI / 2, 0);
  const sw = swimPoseAngles(Math.PI / 2, 1);
  expect(Math.abs(fl.lArmZ - 0.25)).toBeLessThan(Math.abs(sw.lArmZ - 0.25));
});

test("walking on land is unchanged: the trail, the headland and the town's ground answer as before", () => {
  expect(walkable(0, 60)).toBe(true);
  expect(walkable(0, CLIFF.head.z + CLIFF.head.r)).toBe(false);
  expect(walkable(20, 80)).toBe(false);
  expect(clampToWorld(0, 90, forest)).toEqual({ x: 0, z: 90 });
  expect(clampToWorld(10, 10, forest)).toEqual({ x: 10, z: 10 });
  expect(clampToWorld(60, 0, forest)).toEqual({ x: 52, z: 0 });
  expect(shouldSwim(0, 90)).toBe(false); // the trail is never water
  expect(shouldSwim(0, 0)).toBe(false);
});
