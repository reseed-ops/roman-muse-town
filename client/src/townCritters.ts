import * as THREE from "three";

/** Task 46: the town's small life. Bees drifting flower to flower in the
 *  gardens, butterflies over the forum and the fields that sometimes
 *  land, and crickets in the grass at dusk that hop clear of his feet.
 *  All of it is code, a handful of instanced meshes (a few draw calls
 *  in all, no shadows, no model files), with counts set by the quality
 *  tier, so a phone carries only a few of each. */

export type XZ = readonly [number, number];

/** How many of each the town shows at each quality tier (0 light, 1 a
 *  phone's start, 2 full). The builders make the full count once and
 *  draw only the budget. */
export const CRITTER_BUDGET = {
  0: { bees: 3, butterflies: 2, crickets: 4 },
  1: { bees: 5, butterflies: 3, crickets: 7 },
  2: { bees: 9, butterflies: 6, crickets: 12 },
} as const;

export function critterBudget(tier: number): { bees: number; butterflies: number; crickets: number } {
  return CRITTER_BUDGET[tier >= 2 ? 2 : tier >= 1 ? 1 : 0];
}

/** Rome's colours for its butterflies: a cabbage white, a brimstone
 *  yellow, a pale blue. */
export const BUTTERFLY_COLOURS = [0xf4f1e6, 0xf2d65a, 0xa9c8ec] as const;

export interface CritterWorld {
  nightMix: number;
  rain: number;
  snow: number;
  fog: boolean;
  season: string;
}

/** Bees work by day in the warm months, and stay in from rain, snow and fog. */
export function beesOut(w: CritterWorld): boolean {
  return w.nightMix < 0.4 && w.rain < 0.25 && w.snow < 0.25 && !w.fog && w.season !== "winter";
}
/** Butterflies keep the same hours, a little later into the evening. */
export function butterfliesOut(w: CritterWorld): boolean {
  return w.nightMix < 0.5 && w.rain < 0.25 && w.snow < 0.25 && !w.fog && w.season !== "winter";
}
/** Crickets sing from dusk through the night, spring to autumn, not in a downpour. */
export function cricketsOut(w: CritterWorld): boolean {
  return w.nightMix > 0.35 && w.rain < 0.5 && w.snow < 0.1 && w.season !== "winter";
}

/** The hum is heard only close to a bee: full within half a metre, gone past three. */
export function humLevel(dist: number): number {
  return 1 - THREE.MathUtils.smoothstep(dist, 0.5, 3);
}
/** The chirp carries farther, and only as dusk deepens. */
export function chirpLevel(dist: number, nightMix: number): number {
  return THREE.MathUtils.smoothstep(nightMix, 0.35, 0.7) * (1 - THREE.MathUtils.smoothstep(dist, 3, 14));
}

/** Where a cricket lands when he walks too close: away from him, a
 *  short hop, and never more than `leash` metres from its own patch of
 *  grass (a hop that would stray turns back toward home). */
export function hopTarget(at: XZ, home: XZ, player: XZ, rand: () => number, leash = 2.5): [number, number] {
  let dx = at[0] - player[0];
  let dz = at[1] - player[1];
  const len = Math.hypot(dx, dz) || 1;
  const turn = (rand() - 0.5) * 1.2;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const ux = (dx / len) * c - (dz / len) * s;
  const uz = (dx / len) * s + (dz / len) * c;
  const dist = 0.7 + rand() * 0.4;
  let x = at[0] + ux * dist;
  let z = at[1] + uz * dist;
  dx = x - home[0];
  dz = z - home[1];
  const away = Math.hypot(dx, dz);
  if (away > leash) {
    x = home[0] + (dx / away) * leash;
    z = home[1] + (dz / away) * leash;
  }
  return [x, z];
}

/** Height along a hop at progress u (0..1): a little arc of `h` metres. */
export function hopHeight(u: number, h = 0.22): number {
  const k = THREE.MathUtils.clamp(u, 0, 1);
  return 4 * h * k * (1 - k);
}

export interface CritterSites {
  /** Bee patches: each a set of flower tops (x, z) the bees work between. */
  beePatches: readonly (readonly XZ[])[];
  /** Butterfly patches: a centre and reach, and the flowers they may land on. */
  butterflyPatches: readonly { centre: XZ; radius: number; flowers: readonly XZ[] }[];
  /** Cricket homes in the grass. */
  cricketGrass: readonly XZ[];
}

export interface CritterFrame extends CritterWorld {
  t: number;
  dt: number;
  tier: number;
  /** Where Gaius stands while walking (null in the overview). */
  player: XZ | null;
  /** The camera's ground position: nothing farther than VIEW_REACH from it is animated. */
  view: XZ;
}

/** Beyond this distance from the camera nothing is animated or drawn. */
export const VIEW_REACH = 55;
/** He startles a cricket when he comes this close. */
export const CRICKET_STARTLE = 1.4;

const FLOWER_TOP = 0.5;

/** Builds the bees, butterflies and crickets into `world` and returns their per-frame update. */
export function createCritters(
  world: THREE.Object3D,
  sites: CritterSites,
  groundY: (x: number, z: number) => number,
  rand: () => number = Math.random,
) {
  const full = CRITTER_BUDGET[2];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const keep = <G extends THREE.BufferGeometry>(g: G) => (geos.push(g), g);
  const keepM = <M extends THREE.Material>(m: M) => (mats.push(m), m);
  const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number) => {
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.castShadow = false;
    m.receiveShadow = false;
    m.frustumCulled = false; // the instances move; their own bounds would go stale
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    world.add(m);
    return m;
  };

  // Shapes. A bee's body is striped by vertex colour; a wing is a small
  // disc laid flat beside the body's axis (z), hinged at the body.
  const beeBodyGeo = keep(new THREE.SphereGeometry(1, 8, 6));
  beeBodyGeo.scale(0.032, 0.03, 0.06);
  {
    const pos = beeBodyGeo.getAttribute("position");
    const colours = new Float32Array(pos.count * 3);
    const gold = new THREE.Color(0xe7b52c);
    const dark = new THREE.Color(0x2a2116);
    for (let i = 0; i < pos.count; i++) {
      const band = Math.floor((pos.getZ(i) / 0.06 + 1) * 2.5) % 2 === 1;
      (band ? dark : gold).toArray(colours, i * 3);
    }
    beeBodyGeo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  }
  const wingGeo = (r: number) => {
    const g = keep(new THREE.CircleGeometry(r, 8));
    g.rotateX(-Math.PI / 2);
    g.translate(r * 0.9, 0, 0);
    return g;
  };
  const beeWingGeo = wingGeo(0.04);
  const flyWingGeo = wingGeo(0.1);
  const flyBodyGeo = keep(new THREE.SphereGeometry(1, 6, 5));
  flyBodyGeo.scale(0.022, 0.022, 0.07);
  const cricketGeo = keep(new THREE.SphereGeometry(1, 6, 5));
  cricketGeo.scale(0.026, 0.02, 0.06);
  const legGeo = keep(new THREE.BoxGeometry(0.008, 0.008, 0.07));
  legGeo.rotateX(-0.6);

  const beeBodies = instanced(beeBodyGeo, keepM(new THREE.MeshLambertMaterial({ vertexColors: true })), full.bees);
  const beeWings = instanced(
    beeWingGeo,
    keepM(new THREE.MeshBasicMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })),
    full.bees * 2,
  );
  const flyBodies = instanced(flyBodyGeo, keepM(new THREE.MeshLambertMaterial({ color: 0x2e2a24 })), full.butterflies);
  const flyWings = instanced(flyWingGeo, keepM(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })), full.butterflies * 2);
  const crickets = instanced(cricketGeo, keepM(new THREE.MeshLambertMaterial({ color: 0x2b2418 })), full.crickets);
  const cricketLegs = instanced(legGeo, keepM(new THREE.MeshLambertMaterial({ color: 0x1f1a12 })), full.crickets * 2);

  // Bees: round-robin over the patches, so even a phone's few cover each garden.
  const bees = Array.from({ length: full.bees }, (_, i) => {
    const patch = sites.beePatches.length ? sites.beePatches[i % sites.beePatches.length]! : [];
    const at = patch.length ? Math.floor(rand() * patch.length) : 0;
    return { patch, from: at, to: at, u: 1, hoverUntil: rand() * 3, phase: rand() * 10, pos: new THREE.Vector3() };
  });
  // Butterflies: likewise over their patches, each a colour of the three.
  const flies = Array.from({ length: full.butterflies }, (_, i) => {
    const patch = sites.butterflyPatches.length ? sites.butterflyPatches[i % sites.butterflyPatches.length]! : null;
    const c = patch?.centre ?? [0, 0];
    return {
      patch,
      pos: new THREE.Vector3(c[0], groundY(c[0], c[1]) + 1.2, c[1]),
      target: new THREE.Vector3(c[0], groundY(c[0], c[1]) + 1.2, c[1]),
      landing: false,
      restUntil: 0,
      heading: rand() * Math.PI * 2,
      phase: rand() * 10,
    };
  });
  const flyColours = BUTTERFLY_COLOURS.map((c) => new THREE.Color(c));
  for (let i = 0; i < full.butterflies; i++) {
    const colour = flyColours[i % flyColours.length]!;
    flyWings.setColorAt(i * 2, colour);
    flyWings.setColorAt(i * 2 + 1, colour);
  }
  if (flyWings.instanceColor) flyWings.instanceColor.needsUpdate = true;
  const cricketHomes = sites.cricketGrass.slice(0, full.crickets);
  const hoppers = cricketHomes.map((home) => ({
    home,
    at: [home[0], home[1]] as [number, number],
    from: [home[0], home[1]] as [number, number],
    to: [home[0], home[1]] as [number, number],
    hopU: 1,
    heading: rand() * Math.PI * 2,
    phase: rand() * 10,
  }));

  const m4 = new THREE.Matrix4();
  const body = new THREE.Matrix4();
  const hinge = new THREE.Matrix4();
  const mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const near = (x: number, z: number, view: XZ) => Math.hypot(x - view[0], z - view[1]) < VIEW_REACH;
  const setBody = (x: number, y: number, z: number, heading: number) => {
    q.setFromAxisAngle(yAxis, heading);
    body.compose(v.set(x, y, z), q, one);
  };
  const setWings = (mesh: THREE.InstancedMesh, slot: number, flap: number) => {
    hinge.makeRotationZ(flap);
    mesh.setMatrixAt(slot * 2, m4.multiplyMatrices(body, hinge));
    hinge.makeRotationZ(-flap).multiply(mirror);
    mesh.setMatrixAt(slot * 2 + 1, m4.multiplyMatrices(body, hinge));
  };
  const flowerTop = (p: XZ) => groundY(p[0], p[1]) + FLOWER_TOP;

  function update(f: CritterFrame): { hum: number; chirp: number } {
    const budget = critterBudget(f.tier);
    let hum = 0;
    let chirp = 0;

    // Bees.
    let nb = 0;
    if (beesOut(f)) {
      for (let i = 0; i < Math.min(budget.bees, bees.length); i++) {
        const b = bees[i]!;
        if (!b.patch.length) continue;
        const home = b.patch[b.to]!;
        if (!near(home[0], home[1], f.view)) continue;
        if (b.u < 1) {
          b.u = Math.min(1, b.u + f.dt * 0.55);
          const a = b.patch[b.from]!;
          const k = b.u * b.u * (3 - 2 * b.u);
          b.pos.set(
            a[0] + (home[0] - a[0]) * k + Math.sin(f.t * 3 + b.phase) * 0.08,
            flowerTop(a) + (flowerTop(home) - flowerTop(a)) * k + 0.12 + Math.sin(Math.PI * b.u) * 0.3,
            a[1] + (home[1] - a[1]) * k + Math.cos(f.t * 2.6 + b.phase) * 0.08,
          );
          if (b.u >= 1) b.hoverUntil = f.t + 2 + rand() * 3;
        } else {
          // Working a flower: small loops just above it.
          b.pos.set(
            home[0] + Math.cos(f.t * 2.2 + b.phase) * 0.12,
            flowerTop(home) + 0.1 + Math.sin(f.t * 3.1 + b.phase) * 0.04,
            home[1] + Math.sin(f.t * 1.9 + b.phase) * 0.12,
          );
          if (f.t > b.hoverUntil && b.patch.length > 1) {
            b.from = b.to;
            do b.to = Math.floor(rand() * b.patch.length);
            while (b.to === b.from);
            b.u = 0;
          }
        }
        const target = b.patch[b.to]!;
        setBody(b.pos.x, b.pos.y, b.pos.z, Math.atan2(target[0] - b.pos.x, target[1] - b.pos.z) + Math.sin(f.t * 4 + b.phase) * 0.6);
        beeBodies.setMatrixAt(nb, body);
        setWings(beeWings, nb, Math.sin(f.t * 47 + b.phase * 7) * 0.7);
        nb++;
        if (f.player) hum = Math.max(hum, humLevel(Math.hypot(b.pos.x - f.player[0], b.pos.z - f.player[1])));
      }
    }
    beeBodies.count = nb;
    beeWings.count = nb * 2;

    // Butterflies.
    let nf = 0;
    if (butterfliesOut(f)) {
      for (let i = 0; i < Math.min(budget.butterflies, flies.length); i++) {
        const b = flies[i]!;
        const patch = b.patch;
        if (!patch || !near(patch.centre[0], patch.centre[1], f.view)) continue;
        let flap: number;
        if (f.t < b.restUntil) {
          // Resting on a flower: wings folding open and shut, slowly.
          flap = 0.25 + Math.abs(Math.sin(f.t * 1.4 + b.phase)) * 0.9;
        } else {
          v.subVectors(b.target, b.pos);
          const dist = v.length();
          if (dist < 0.08) {
            if (b.landing) {
              b.restUntil = f.t + 3 + rand() * 3;
              b.landing = false;
            }
            // The next aim: a flower now and then, else a drift across the patch.
            const flower = patch.flowers.length && rand() < 0.35 ? patch.flowers[Math.floor(rand() * patch.flowers.length)]! : null;
            if (flower) {
              b.target.set(flower[0], flowerTop(flower) + 0.04, flower[1]);
              b.landing = true;
            } else {
              const a = rand() * Math.PI * 2;
              const r = Math.sqrt(rand()) * patch.radius;
              const x = patch.centre[0] + Math.cos(a) * r;
              const z = patch.centre[1] + Math.sin(a) * r;
              b.target.set(x, groundY(x, z) + 0.9 + rand() * 0.8, z);
            }
          } else {
            const step = Math.min(dist, f.dt * 0.7);
            b.pos.addScaledVector(v.normalize(), step);
            b.heading = Math.atan2(v.x, v.z);
          }
          flap = Math.sin(f.t * 11 + b.phase) * 0.9;
        }
        const bob = f.t < b.restUntil ? 0 : Math.sin(f.t * 2.3 + b.phase) * 0.12;
        setBody(b.pos.x, b.pos.y + bob, b.pos.z, b.heading);
        flyBodies.setMatrixAt(nf, body);
        setWings(flyWings, nf, flap);
        // The wing colours were set by slot; keep each butterfly in its own slot.
        if (nf !== i) {
          const c = flyColours[i % flyColours.length]!;
          flyWings.setColorAt(nf * 2, c);
          flyWings.setColorAt(nf * 2 + 1, c);
          if (flyWings.instanceColor) flyWings.instanceColor.needsUpdate = true;
        }
        nf++;
      }
    }
    flyBodies.count = nf;
    flyWings.count = nf * 2;

    // Crickets.
    let nc = 0;
    if (cricketsOut(f)) {
      for (let i = 0; i < Math.min(budget.crickets, hoppers.length); i++) {
        const c = hoppers[i]!;
        if (!near(c.home[0], c.home[1], f.view)) continue;
        if (c.hopU >= 1 && f.player && Math.hypot(c.at[0] - f.player[0], c.at[1] - f.player[1]) < CRICKET_STARTLE) {
          c.from = [c.at[0], c.at[1]];
          c.to = hopTarget(c.at, c.home, f.player, rand);
          c.heading = Math.atan2(c.to[0] - c.from[0], c.to[1] - c.from[1]);
          c.hopU = 0;
        }
        let lift = 0;
        if (c.hopU < 1) {
          c.hopU = Math.min(1, c.hopU + f.dt / 0.45);
          c.at[0] = c.from[0] + (c.to[0] - c.from[0]) * c.hopU;
          c.at[1] = c.from[1] + (c.to[1] - c.from[1]) * c.hopU;
          lift = hopHeight(c.hopU);
        }
        const gy = groundY(c.at[0], c.at[1]) + 0.02 + lift;
        // Singing: a tiny lift of the body in time with the chirp.
        const sing = c.hopU >= 1 && Math.sin(f.t * 14 + c.phase) > 0.6 && Math.sin(f.t * 1.7 + c.phase) > 0 ? 0.006 : 0;
        setBody(c.at[0], gy + sing, c.at[1], c.heading);
        crickets.setMatrixAt(nc, body);
        hinge.makeTranslation(0.022, 0.01, -0.03);
        cricketLegs.setMatrixAt(nc * 2, m4.multiplyMatrices(body, hinge));
        hinge.makeTranslation(-0.022, 0.01, -0.03);
        cricketLegs.setMatrixAt(nc * 2 + 1, m4.multiplyMatrices(body, hinge));
        nc++;
        if (f.player) chirp = Math.max(chirp, chirpLevel(Math.hypot(c.at[0] - f.player[0], c.at[1] - f.player[1]), f.nightMix));
      }
    }
    crickets.count = nc;
    cricketLegs.count = nc * 2;

    for (const mesh of [beeBodies, beeWings, flyBodies, flyWings, crickets, cricketLegs]) {
      mesh.visible = mesh.count > 0;
      if (mesh.count > 0) mesh.instanceMatrix.needsUpdate = true;
    }
    return { hum, chirp };
  }

  return {
    update,
    /** The counts drawn on the last frame, for tests and the perf report. */
    get drawn() {
      return { bees: beeBodies.count, butterflies: flyBodies.count, crickets: crickets.count };
    },
    /** Where the drawn crickets sit now. */
    cricketsAt: () => hoppers.map((c) => [c.at[0], c.at[1]] as [number, number]),
    dispose() {
      for (const mesh of [beeBodies, beeWings, flyBodies, flyWings, crickets, cricketLegs]) {
        world.remove(mesh);
        mesh.dispose();
      }
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
