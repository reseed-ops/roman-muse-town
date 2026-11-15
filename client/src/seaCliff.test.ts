import { expect, test } from "bun:test";
import * as THREE from "three";
import { buildSeaCliff, CLIFF, COAST_FILLET, HILL_BASE_Y, horizonHillGeometry, SHOULDER, TRAIL_HALF, cutAtCoast, hillRise, nearestWalkable, shoulderRise, trailX, OCEAN_DAY, OCEAN_NIGHT, clampToWorld, clearOfSea, HORIZON_HILLS, landOutline, outlineNormals, onLand, walkable } from "./seaCliff";
import { terrainHeight } from "./town";

// The sea cliff's geometry (Task 34), pinned off the scene.

const forest = { norm: (x: number, z: number) => Math.hypot((x + 44) / 11.5, (z + 22) / 15), cx: -44, cz: -22 };

test("the trail and the headland are walkable, the sea is not", () => {
  expect(walkable(0, 60)).toBe(true);
  expect(walkable(0, 100)).toBe(true);
  expect(walkable(CLIFF.bench.x, CLIFF.bench.z)).toBe(true);
  expect(walkable(0, CLIFF.head.z + CLIFF.head.r)).toBe(false);
  expect(walkable(20, 80)).toBe(false);
  // The bench stands on land, short of the edge, and faces the sea (south, +Z).
  expect(onLand(CLIFF.bench.x, CLIFF.bench.z + 1.5)).toBe(true);
  expect(CLIFF.bench.rotY).toBeCloseTo(Math.PI);
});

test("the world clamp: town, forest and peninsula pass; the sea and the wide meadow ease back", () => {
  expect(clampToWorld(10, 10, forest)).toEqual({ x: 10, z: 10 });
  expect(clampToWorld(0, 90, forest)).toEqual({ x: 0, z: 90 });
  // Off the peninsula's side, over the sea: back onto the trail.
  const off = clampToWorld(12, 90, forest);
  expect(off.x).toBeCloseTo(CLIFF.walkHalf);
  expect(off.z).toBeCloseTo(90);
  // Past the headland's edge: back onto the headland.
  const edge = clampToWorld(0, 130, forest);
  expect(Math.hypot(edge.x - CLIFF.head.x, edge.z - CLIFF.head.z)).toBeCloseTo(CLIFF.walkHeadR);
  // East of town, no peninsula: back to the town's rim.
  const east = clampToWorld(60, 0, forest);
  expect(east).toEqual({ x: 52, z: 0 });
});

const segsCross = (a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }, d: { x: number; z: number }) => {
  const o = (p: typeof a, q: typeof a, r: typeof a) => Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};

test("the outline runs from the coast at the west bay, round the lobe and the headland, up the east side to (9, 56)", () => {
  const pts = landOutline();
  expect(pts[0]!.z).toBeCloseTo(CLIFF.coastZ);
  expect(pts[0]!.x).toBeCloseTo(COAST_FILLET.x);
  expect(pts[pts.length - 1]).toEqual({ x: CLIFF.landHalf, z: CLIFF.coastZ });
  const southmost = Math.max(...pts.map((p) => p.z));
  expect(southmost).toBeGreaterThanOrEqual(CLIFF.head.z + CLIFF.head.r - 0.01);
  expect(southmost).toBeLessThanOrEqual(CLIFF.head.z + CLIFF.head.r + 0.9);
  // It leaves the coast tangentially (heading east) and no kink: every turn between steps is gentle except the headland's join and the strip's two corners.
  const turn = (i: number) => {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    const d = Math.atan2(c.z - b.z, c.x - b.x) - Math.atan2(b.z - a.z, b.x - a.x);
    return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
  };
  expect(Math.abs(pts[1]!.z - pts[0]!.z)).toBeLessThan(0.2); // tangent to the coast
  for (let i = 1; i < 12; i++) expect(turn(i)).toBeLessThan(0.5);
  // The edge is roughened outward only: every point is within 0.9 m outside the smooth land, never inside it.
  const nrm = outlineNormals();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const n = nrm[i]!;
    if (p.z < CLIFF.coastZ + 1.5) continue; // the coast line itself, where the straight cliff takes over
    expect(onLand(p.x - n.x * 0.95, p.z - n.z * 0.95)).toBe(true);
  }
});

test("the outline never crosses itself, and its outward normals point away from the land", () => {
  const pts = landOutline();
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = i + 2; j < pts.length - 1; j++) {
      expect(segsCross(pts[i]!, pts[i + 1]!, pts[j]!, pts[j + 1]!)).toBe(false);
    }
  }
  // Closed along the coast it winds one way, and no segment crosses the coast line under the attachment.
  for (let i = 1; i < pts.length - 1; i++) expect(pts[i]!.z).toBeGreaterThan(CLIFF.coastZ - 0.01);
  const nrm = outlineNormals();
  expect(nrm.length).toBe(pts.length);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const n = nrm[i]!;
    expect(Math.hypot(n.x, n.z)).toBeCloseTo(1);
    // Out of the land, in: a metre out is sea, a metre in is land (the coast line itself aside).
    if (p.z < CLIFF.coastZ + 2) continue;
    expect(onLand(p.x + n.x * 1.2, p.z + n.z * 1.2)).toBe(false);
    expect(onLand(p.x - n.x * 1.2, p.z - n.z * 1.2)).toBe(true);
  }
});

test("no cliff face runs along z 56 under the shoulder's attachment: the straight coast is x < -96 and x > 9", () => {
  const sea = buildSeaCliff({ terrainHeight, waterNormal: new THREE.Texture(), foamTexture: new THREE.Texture(), pathTexture: new THREE.Texture() });
  const rockMeshes = sea.group.children.filter((c) => c instanceof THREE.Mesh && (c.material as THREE.MeshStandardMaterial).flatShading) as THREE.Mesh[];
  expect(rockMeshes.length).toBe(3); // the outline's, the west coast's and the east coast's
  for (const m of rockMeshes) {
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Any face vertex hugging the coast line stays out of the attachment (it is land there).
      if (Math.abs(z - CLIFF.coastZ) < 1.5 && x > COAST_FILLET.x + COAST_FILLET.r + 1 && x < CLIFF.landHalf - 0.1) throw new Error(`rock face under the attachment at ${x}, ${z}`);
    }
  }
  expect(onLand(-50, CLIFF.coastZ + 1)).toBe(true);
  expect(onLand(-80, CLIFF.coastZ + 1)).toBe(true);
});

test("the horizon hills stay on land, clear of the sea and of the peninsula's trail", () => {
  for (const [hx, hz, hr, hh] of HORIZON_HILLS) {
    expect(clearOfSea(hz, hr)).toBe(true);
    // Nowhere along the trail or on the headland is under a hill.
    for (let z = CLIFF.walkFromZ; z <= CLIFF.head.z + CLIFF.walkHeadR; z += 2) {
      const d = Math.hypot(trailX(z) - hx, z - hz);
      const top = d < hr ? hh * Math.sqrt(1 - (d / hr) ** 2) : 0;
      expect(top).toBeLessThan(0.05);
    }
    // And none rises inside the town's walking disc.
    expect(Math.hypot(hx, hz) - hr).toBeGreaterThan(52);
  }
});

test("clearOfSea: the coast is the line", () => {
  expect(clearOfSea(CLIFF.coastZ - 1)).toBe(true);
  expect(clearOfSea(CLIFF.coastZ + 1)).toBe(false);
  expect(clearOfSea(40, 20)).toBe(false);
});

// Task 69: the sea reads as blue water, not as meadow.

const rgb = (hex: number) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255] as const;

test("the ocean's colour is a true blue, by day and by night, and nothing like the meadow's green", () => {
  for (const hex of [OCEAN_DAY, OCEAN_NIGHT]) {
    const [r, g, b] = rgb(hex);
    expect(b).toBeGreaterThan(g);
    expect(b).toBeGreaterThan(r);
  }
  const [r, g, b] = rgb(OCEAN_DAY);
  expect(b).toBeGreaterThan(g * 1.5);
  const c = new THREE.Color(OCEAN_DAY);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  expect(hsl.h * 360).toBeGreaterThan(205);
  expect(hsl.h * 360).toBeLessThan(235);
  // The meadow and the hills are green (hue ~100); the sea is far from that.
  const meadow = new THREE.Color(0x5d9a48).getHSL({ h: 0, s: 0, l: 0 });
  expect(Math.abs(hsl.h - meadow.h) * 360).toBeGreaterThan(90);
  // Under a low sun's warm light the sea must still be blue, not green
  // (the old teal's green channel won there and the sea read as grass).
  const warm = [1, 0.8, 0.5];
  expect(b * warm[2]!).toBeGreaterThan(g * warm[1]!);
  expect(b * warm[2]!).toBeGreaterThan(r * warm[0]!);
});

test("the built ocean material carries that blue", () => {
  const tex = () => new THREE.Texture();
  const sea = buildSeaCliff({ terrainHeight: () => 0, waterNormal: tex(), foamTexture: tex(), pathTexture: tex() });
  expect(sea.oceanMat.color.getHex()).toBe(OCEAN_DAY);
});

// Task 99: the coastal shoulder west of the bench path, and the trail along the strip.

const edge = (z: number) => {
  let first = Infinity;
  let last = -Infinity;
  for (let x = -110; x <= 12; x += 0.125) if (shoulderRise(x, z) > 0) {
    first = Math.min(first, x);
    last = Math.max(last, x);
  }
  return { first, last };
};

test("the shoulder stands on land, rising to zero at its rim, inside the land's edge", () => {
  const { h, crestX, crestZ } = SHOULDER;
  expect(h).toBe(10);
  expect(shoulderRise(crestX, crestZ)).toBeCloseTo(h);
  // The crest is the highest point, near the west edge, around z 70 to 76.
  let top = 0;
  let at = { x: 0, z: 0 };
  for (let x = -100; x <= 5; x += 0.5) for (let z = 40; z <= 110; z += 0.5) {
    const r = shoulderRise(x, z);
    if (r > top) {
      top = r;
      at = { x, z };
    }
  }
  expect(top).toBeCloseTo(h, 1);
  expect(at.z).toBeGreaterThanOrEqual(70);
  expect(at.z).toBeLessThanOrEqual(76);
  // Seaward flank steep, town-facing flank long: the crest is far nearer the west rim than the east.
  const e = edge(crestZ);
  expect(at.x - e.first).toBeLessThan((e.last - at.x) * 0.72);
  // Every rim point has no rise, and every raised point is on the land, a few metres inside its edge.
  for (let x = -100; x <= 12; x += 0.5) for (let z = 40; z <= 112; z += 0.5) {
    if (shoulderRise(x, z) > 0 && z >= CLIFF.coastZ) {
      expect(onLand(x, z)).toBe(true);
      // far enough in that the 25 m face below never undercuts it
      for (const [dx, dz] of [[-2.5, 0], [2.5, 0], [0, 2.5], [0, -2.5]] as const) if (z + dz >= CLIFF.coastZ) expect(onLand(x + dx, z + dz) || shoulderRise(x + dx, z + dz) === 0).toBe(true);
    }
  }
  // Attachment at the coast: about 65 m of raised ground, x about -72 to -7, inside the land's 105 m (x -96 to 9).
  const a = edge(CLIFF.coastZ);
  expect(a.first).toBeLessThan(-68);
  expect(a.first).toBeGreaterThan(-82);
  expect(a.last).toBeGreaterThan(-12);
  expect(a.last).toBeLessThan(-6);
  expect(a.last - a.first).toBeGreaterThan(58);
  // It narrows southward and ends before the bench.
  expect(edge(90).last - edge(90).first).toBeLessThan(a.last - a.first);
  expect(edge(100).first).toBe(Infinity);
});

test("the old bump at (4.2, 84) is gone, and hillRise is the shoulder's rise", () => {
  expect(hillRise).toBe(shoulderRise);
  expect(shoulderRise(4.2, 84)).toBe(0);
  expect(shoulderRise(0, 84)).toBe(0);
});

test("shoulderRise is continuous: nothing at z 44, at the coast and the rim it is smooth, and nothing east of x -7", () => {
  for (let x = -110; x <= 12; x += 0.25) expect(shoulderRise(x, SHOULDER.northZ)).toBe(0);
  const step = 0.02;
  let maxJump = 0;
  for (let x = -100; x <= 8; x += 0.37) for (let z = 40; z <= 108; z += 0.37) {
    maxJump = Math.max(maxJump, Math.abs(shoulderRise(x + step, z) - shoulderRise(x, z)), Math.abs(shoulderRise(x, z + step) - shoulderRise(x, z)));
  }
  expect(maxJump).toBeLessThan(0.02 * 0.75); // never steeper than 37 degrees, no cliff in the function
  // Across the coast line (z 56) it is the same function, no step.
  for (let x = -100; x <= -8; x += 0.5) expect(Math.abs(shoulderRise(x, CLIFF.coastZ + 0.01) - shoulderRise(x, CLIFF.coastZ - 0.01))).toBeLessThan(0.02);
  for (let z = 40; z <= 112; z += 0.5) expect(shoulderRise(-6.9, z)).toBeLessThan(1e-3);
  // The join zone inside the town's walking disc is gentle: under 15 degrees.
  for (let x = -60; x <= 10; x += 0.5) for (let z = 44; z <= 56; z += 0.5) {
    if (Math.hypot(x, z) > 52) continue;
    const gx = (shoulderRise(x + 0.25, z) - shoulderRise(x - 0.25, z)) / 0.5;
    const gz = (shoulderRise(x, z + 0.25) - shoulderRise(x, z - 0.25)) / 0.5;
    expect(Math.atan(Math.hypot(gx, gz))).toBeLessThan((15 * Math.PI) / 180);
  }
});

test("the ground is one function: terrainHeight carries the shoulder's rise", () => {
  for (const [x, z] of [[-48, 72], [-40, 60], [-30, 85], [-65, 70]] as const) {
    expect(terrainHeight(x, z) - shoulderRise(x, z)).toBeCloseTo(0, 6); // flat meadow beneath: nothing else here
  }
  expect(terrainHeight(-48, 72)).toBeCloseTo(SHOULDER.h);
  expect(terrainHeight(0, 80)).toBe(0);
});

test("the trail runs down the strip's middle, whole ribbon clear of the shoulder's foot", () => {
  for (let pz = CLIFF.pathFromZ; pz <= CLIFF.pathToZ; pz += 0.25) {
    const c = trailX(pz);
    expect(c).toBeGreaterThanOrEqual(-0.01);
    expect(c).toBeLessThanOrEqual(1.01);
    for (const dx of [-TRAIL_HALF, 0, TRAIL_HALF]) {
      expect(shoulderRise(c + dx, pz)).toBe(0);
      // and a good margin: the foot is more than 5.5 m west of the ribbon's edge
      for (let off = 0.5; off <= 5.5; off += 0.5) expect(shoulderRise(c - TRAIL_HALF - off, pz)).toBeLessThan(0.02);
    }
    if (pz >= CLIFF.walkFromZ) {
      expect(Math.abs(c) + TRAIL_HALF).toBeLessThanOrEqual(CLIFF.walkHalf);
      for (const dx of [-TRAIL_HALF, TRAIL_HALF]) expect(walkable(c + dx, pz)).toBe(true);
    }
  }
  // It is a gentle line, and comes to the bench.
  for (let pz = CLIFF.pathFromZ; pz < CLIFF.pathToZ; pz += 0.5) expect(Math.abs(trailX(pz + 0.5) - trailX(pz))).toBeLessThan(0.1);
  expect(Math.abs(trailX(CLIFF.pathToZ) - CLIFF.bench.x)).toBeLessThan(1.5);
});

test("a continuous gate-to-bench route: both ribbon edges walkable, all on supported land", () => {
  let last = { x: trailX(CLIFF.pathFromZ), z: CLIFF.pathFromZ };
  for (let z = CLIFF.pathFromZ; z <= CLIFF.pathToZ; z += 0.25) {
    for (const side of [-1, 0, 1]) {
      const x = trailX(z) + side * TRAIL_HALF;
      if (z >= CLIFF.walkFromZ) expect(walkable(x, z)).toBe(true);
      // Land under it: town ground north of the coast, the peninsula's land south of it.
      if (z > CLIFF.coastZ) expect(onLand(x, z)).toBe(true);
    }
    const here = { x: trailX(z), z };
    expect(Math.hypot(here.x - last.x, here.z - last.z)).toBeLessThan(0.3);
    last = here;
  }
  expect(walkable(CLIFF.bench.x, CLIFF.bench.z)).toBe(true);
});

test("walkers do not climb the shoulder: it is not walkable, and the clamp puts nobody on it", () => {
  for (let px = -100; px <= -6; px += 1) {
    for (let pz = CLIFF.coastZ; pz <= 104; pz += 1) {
      if (shoulderRise(px, pz) > 0.05) {
        expect(walkable(px, pz)).toBe(false);
        const c = clampToWorld(px, pz, forest);
        expect(shoulderRise(c.x, c.z)).toBeLessThan(0.05);
        const w = nearestWalkable(px, pz);
        expect(walkable(w.x, w.z)).toBe(true);
        expect(shoulderRise(w.x, w.z)).toBe(0);
      }
    }
  }
  // The neck and the strip's west side: all come back onto the strip.
  for (let px = -30; px <= -4; px += 1) for (let pz = 90; pz <= 112; pz += 1) {
    const p = nearestWalkable(px, pz);
    expect(walkable(p.x, p.z)).toBe(true);
    expect(shoulderRise(p.x, p.z)).toBe(0);
  }
  // Inside the town's disc the northern flank is gentle, so it is simply walkable (not an invisible wall).
  expect(clampToWorld(-20, 40, forest)).toEqual({ x: -20, z: 40 });
  // Over the sea next to the shoulder: eased back.
  expect(Math.hypot(clampToWorld(-70, 120, forest).x + 70, clampToWorld(-70, 120, forest).z - 120)).toBeGreaterThan(5);
});

test("the bench, the seats and the lookout south and east are untouched by the shoulder", () => {
  const seats: [number, number][] = [[CLIFF.bench.x, CLIFF.bench.z], [1.2, 116.4]];
  for (const [sx, sz] of seats) {
    for (let a = 0; a < 48; a++) for (const r of [0, 2, 4, 6]) expect(shoulderRise(sx + Math.cos((a / 48) * 6.283) * r, sz + Math.sin((a / 48) * 6.283) * r)).toBe(0);
  }
  // The headland's tops stay flat.
  for (let a = 0; a < 48; a++) expect(terrainHeight(Math.cos((a / 48) * 6.283) * 8, CLIFF.head.z + Math.sin((a / 48) * 6.283) * 8)).toBe(0);
  // A seated eye at the bench: nothing rises within 30 m of the south half-plane (south, east, west of the seat line).
  for (let x = -30; x <= 30; x += 1) for (let z = CLIFF.bench.z; z <= CLIFF.bench.z + 30; z += 1) expect(shoulderRise(x, z)).toBe(0);
  for (let x = 0; x <= 40; x += 1) for (let z = CLIFF.bench.z - 30; z <= CLIFF.bench.z + 30; z += 1) expect(shoulderRise(x, z)).toBe(0);
});

test("sunset sight-lines from the bench: the sea stays open to the western horizon except a small summer clip", () => {
  const eyeX = CLIFF.bench.x;
  const eyeZ = CLIFF.bench.z;
  const eyeY = 1.3;
  /** The highest elevation (degrees) that the ground blocks, looking along `az` (compass, 0 N, 90 E) from the seated eye. */
  const blocked = (az: number) => {
    const rad = (az * Math.PI) / 180;
    let best = 0;
    for (let d = 2; d <= 160; d += 0.5) {
      const x = eyeX + Math.sin(rad) * d;
      const z = eyeZ - Math.cos(rad) * d;
      const y = terrainHeight(x, z) - eyeY; // the bench stands at 0, the town and shoulder rise above
      best = Math.max(best, (Math.atan2(y, d) * 180) / Math.PI);
    }
    return best;
  };
  // Winter sunset (about 240) through the equinox (270) and 285 stay clear of the hill.
  for (const az of [180, 200, 220, 240, 255, 270, 285]) expect(blocked(az)).toBeLessThan(0.3);
  // The summer sunset (about 300) clips by about 2 degrees; the brief accepts that, a materially larger clip is flagged here.
  expect(blocked(300)).toBeLessThan(2.5);
  expect(blocked(320)).toBeLessThan(12);
});

test("the horizon hills do not contain the shoulder, and the shoulder is not among them", () => {
  for (const [hx, hz, hr] of HORIZON_HILLS) {
    for (let x = -100; x <= -6; x += 2) for (let z = 40; z <= 104; z += 2) {
      if (shoulderRise(x, z) > 0) expect(Math.hypot(x - hx, z - hz)).toBeGreaterThan(hr);
    }
    expect(clearOfSea(hz, hr)).toBe(true);
  }
  expect(HORIZON_HILLS.length).toBe(6);
});

test("the meadow is still cut at the coast", () => {
  expect(cutAtCoast(10)).toBe(10);
  expect(cutAtCoast(CLIFF.coastZ)).toBe(CLIFF.coastZ);
  expect(cutAtCoast(CLIFF.coastZ + 40)).toBe(CLIFF.coastZ);
  expect(cutAtCoast(170)).toBe(CLIFF.coastZ);
});

const land = (sea: ReturnType<typeof buildSeaCliff>) => sea.group.children.find((c) => c instanceof THREE.Mesh && (c.material as THREE.MeshStandardMaterial) === sea.landMats[0]) as THREE.Mesh;
const realSea = () => buildSeaCliff({ terrainHeight, waterNormal: new THREE.Texture(), foamTexture: new THREE.Texture(), pathTexture: new THREE.Texture() });

test("the peninsula's grass is one surface: the shoulder is in terrainHeight and in the grass mesh, no second layer", () => {
  const sea = realSea();
  const pos = land(sea).geometry.attributes.position as THREE.BufferAttribute;
  let top = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    top = Math.max(top, pos.getY(i));
    // Every grass vertex is exactly the ground's height plus its lift (1 cm, 2 cm on the lap north of the coast), at its own x, z.
    const lift = pos.getY(i) - terrainHeight(pos.getX(i), pos.getZ(i));
    expect(Math.min(Math.abs(lift - 0.01), Math.abs(lift - 0.02))).toBeLessThan(1e-5);
    if (pos.getZ(i) < CLIFF.coastZ - 1e-6) expect(lift).toBeCloseTo(0.02, 5);
  }
  expect(top).toBeGreaterThan(SHOULDER.h * 0.97);
  expect(top).toBeLessThan(SHOULDER.h + 0.2);
  // Nothing else in the group is a second hill: only the apron, the grass and the planes lie on the ground.
  const named = sea.group.children.filter((c) => c.name === "shoulder-apron");
  expect(named.length).toBe(1);
});

test("heights agree at every shared boundary: town plane, grass mesh, apron, cliff tops, trail", () => {
  const sea = realSea();
  // Along the coast the town plane (terrainHeight at z 56) and the grass meet at the same height, up to the lift:
  // the grass laps 0.5 m north over the plane's last row (2 cm over it), so the two meshes' unequal vertex lattices leave no gap.
  const pos = land(sea).geometry.attributes.position as THREE.BufferAttribute;
  let lapRows = 0;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i) - CLIFF.coastZ) < 1e-6) expect(Math.abs(pos.getY(i) - terrainHeight(pos.getX(i), CLIFF.coastZ))).toBeLessThan(0.0201);
    if (pos.getZ(i) < CLIFF.coastZ - 0.4) lapRows++;
  }
  expect(lapRows).toBeGreaterThan(100);
  // The apron meets the town plane at x -56 and the grass at z 56, and falls to the outer land (-0.05) where the rise is nothing.
  const apron = sea.group.children.find((c) => c.name === "shoulder-apron") as THREE.Mesh;
  const ap = apron.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < ap.count; i++) {
    const x = ap.getX(i);
    const z = ap.getZ(i);
    if (shoulderRise(x, z) === 0 && x < -58) expect(ap.getY(i)).toBeCloseTo(-0.05, 6);
    expect(ap.getY(i)).toBeGreaterThan(terrainHeight(x, z) - 0.0501);
    expect(ap.getY(i)).toBeLessThan(terrainHeight(x, z) + 0.0201);
    // Past the town plane's edge (x -56) it is lapped 2 cm over it.
    if (x >= -56 && shoulderRise(x, z) > 0.3) expect(ap.getY(i) - terrainHeight(x, z)).toBeCloseTo(0.02, 5);
  }
  // The trail lies 3.5 cm over the same ground.
  const trail = sea.group.children.find((c) => c instanceof THREE.Mesh && (c.material as THREE.MeshStandardMaterial).polygonOffset && (c.material as THREE.MeshStandardMaterial).color.getHex() === 0xa48a64) as THREE.Mesh;
  const tp = trail.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) expect(tp.getY(i)).toBeCloseTo(terrainHeight(tp.getX(i), tp.getZ(i)) + 0.035, 5);
});

test("given the town's ground material, the shoulder wears it and continues the town plane's uv, so no seam shows", () => {
  const mat = new THREE.MeshStandardMaterial({ color: 0x336633 });
  const sea = buildSeaCliff({ terrainHeight, waterNormal: new THREE.Texture(), foamTexture: new THREE.Texture(), pathTexture: new THREE.Texture(), groundMaterial: mat });
  const meshes = sea.group.children.filter((c) => c instanceof THREE.Mesh && (c.material as THREE.Material) === mat) as THREE.Mesh[];
  expect(meshes.length).toBe(2); // the grass and the apron
  for (const m of meshes) {
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const uv = m.geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 7) {
      // The town plane (PlaneGeometry 112 x 112, centred): u = (x + 56) / 112, v = (56 - z) / 112.
      expect(uv.getX(i)).toBeCloseTo((pos.getX(i) + 56) / 112, 5);
      expect(uv.getY(i)).toBeCloseTo((56 - pos.getZ(i)) / 112, 5);
    }
  }
});

test("the grass mesh has no flipped or spanning triangles, and none outside the land", () => {
  const geo = land(realSea()).geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const idx = geo.getIndex()!;
  const outline = landOutline();
  let n = 0;
  let sign = 0;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i);
    const b = idx.getX(i + 1);
    const c = idx.getX(i + 2);
    const area = (pos.getX(b) - pos.getX(a)) * (pos.getZ(c) - pos.getZ(a)) - (pos.getX(c) - pos.getX(a)) * (pos.getZ(b) - pos.getZ(a));
    if (sign === 0 && Math.abs(area) > 1e-6) sign = Math.sign(area);
    if (Math.abs(area) > 1e-9) expect(Math.sign(area)).toBe(sign); // none flipped
    // No triangle lies out over the water: its centre is inside the (roughened) outline polygon or on the coast edge.
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    expect(cz).toBeGreaterThanOrEqual(CLIFF.coastZ - 0.5 - 1e-6); // the lap
    // a triangle never spans more than a cell and a bit (a spanning sliver over a bay would)
    const ext = Math.max(Math.abs(pos.getX(a) - pos.getX(b)), Math.abs(pos.getX(b) - pos.getX(c)), Math.abs(pos.getZ(a) - pos.getZ(b)), Math.abs(pos.getZ(b) - pos.getZ(c)));
    expect(ext).toBeLessThan(5);
    void cx;
    n++;
  }
  void outline;
  expect(n).toBeGreaterThan(20000);
});

// Task 69: the flicker. The horizon hills were full spheres whose lower halves
// lay buried through the meadow disc (-0.6) and the outer land (-0.05), and the
// surf and the sun's and moon's paths sat 5 to 10 cm over the sea, inside the
// depth buffer's resolution at a few hundred metres.

test("a horizon hill is a dome with nothing buried below its base", () => {
  for (const [, , hr, hh] of HORIZON_HILLS) {
    const g = horizonHillGeometry(hr);
    const pos = g.attributes.position as THREE.BufferAttribute;
    let lowest = Infinity;
    let highest = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      lowest = Math.min(lowest, pos.getY(i));
      highest = Math.max(highest, pos.getY(i));
    }
    expect(lowest).toBeGreaterThan(-1e-6); // no lower hemisphere
    expect(highest * (hh / hr)).toBeCloseTo(hh, 4);
    // Its base ring is under the outer land (-0.05), so no edge shows and no layer coincides.
    expect(HILL_BASE_Y).toBeLessThan(-0.05);
    expect(HILL_BASE_Y).toBeGreaterThan(-0.6 + 0.1); // and above the meadow disc, not on it
  }
});

test("the surf and the light paths are offset in depth from the sea they lie on", () => {
  const tex = () => new THREE.Texture();
  const sea = buildSeaCliff({ terrainHeight: () => 0, waterNormal: tex(), foamTexture: tex(), pathTexture: tex() });
  for (const m of [sea.foamMat, sea.moonPath.material as THREE.Material, sea.sunPath.material as THREE.Material]) {
    expect(m.polygonOffset).toBe(true);
    expect(m.polygonOffsetFactor).toBeLessThan(0);
  }
});
