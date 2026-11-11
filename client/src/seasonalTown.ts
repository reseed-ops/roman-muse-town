// The town's year (Task 60): small code-built pieces that stand only in
// their own season, read from the real calendar (shared/seasons.ts). Spring
// brings flower patches on the lawns, summer its fireflies (the scene's
// existing swarm, fullest in summer: `fireflyShare`), autumn a harvest of
// baskets and sheaves by the doors, winter lanterns burning on posts. The
// town tree's seasonal dress, the weather's snow and the critters' seasons
// were already in place; this adds the rest. Everything is low-poly and
// built here (no asset), has no collider, and is hidden, not rebuilt, when
// its season is not the season.
import * as THREE from "three";
import type { Season } from "../../shared/seasons";

type XZ = readonly [number, number];

/** Flower patches: the lawns by their house, the garden, the cliff's verge, the Athena olives. */
export const FLOWER_PATCHES: readonly { at: XZ; r: number; n: number }[] = [
  { at: [-35.2, 20.6], r: 2.2, n: 16 },
  { at: [-35.0, 32.0], r: 2.0, n: 14 },
  { at: [-44.6, 27.5], r: 2.2, n: 14 },
  { at: [-15.8, 4.2], r: 1.8, n: 12 },
  { at: [-15.8, 12.0], r: 1.8, n: 12 },
  { at: [-7.6, 70.0], r: 2.2, n: 14 },
  { at: [7.8, 88.0], r: 2.2, n: 14 },
  { at: [-7.2, 110.0], r: 1.8, n: 12 },
];
/** Harvest baskets (with a sheaf beside each): by their door, by the garden, at the cliff gate. */
export const HARVEST_SPOTS: readonly { at: XZ; fruit: "apples" | "grapes" | "olives" }[] = [
  { at: [-36.2, 23.0], fruit: "apples" },
  { at: [-36.2, 29.2], fruit: "grapes" },
  { at: [-14.6, 6.4], fruit: "olives" },
  { at: [-3.8, 52.4], fruit: "grapes" },
  { at: [6.2, 6.2], fruit: "apples" },
];
/** Winter lanterns on short posts: at their door, by the Athena step, at the cliff gate and on the bench's headland. */
export const WINTER_LANTERNS: readonly XZ[] = [
  [-36.4, 24.2],
  [-36.4, 28.0],
  [-16.2, 6.6],
  [3.8, 50.4],
  [-3.6, 116.8],
];

export const BLOSSOM_COLOURS = [0xf4f1e6, 0xf2d65a, 0xe58fb0, 0xb7a3e0, 0xe9754d] as const;

/** A small deterministic pseudo-random sequence, so the dressing is the same each time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const m = (color: number, opts?: { emissive?: number; intensity?: number; rough?: number; double?: boolean }): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.rough ?? 0.85,
    flatShading: true,
    emissive: opts?.emissive ?? 0,
    emissiveIntensity: opts?.intensity ?? 1,
    side: opts?.double ? THREE.DoubleSide : THREE.FrontSide,
  });

function haloTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,214,130,0.9)");
    grad.addColorStop(0.4, "rgba(255,190,100,0.35)");
    grad.addColorStop(1, "rgba(255,170,80,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface SeasonalTown {
  group: THREE.Group;
  setSeason: (season: Season) => void;
  season: () => Season | null;
  /** Per frame: the winter lanterns burn brighter the darker it gets. */
  update: (nightMix: number) => void;
  dispose: () => void;
}

export function createSeasonalTown(opts: { world: THREE.Object3D; terrainHeight: (x: number, z: number) => number }): SeasonalTown {
  const { terrainHeight: h } = opts;
  const group = new THREE.Group();
  group.name = "seasonal-town";
  opts.world.add(group);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // --- Spring: flower patches (instanced stems and blossoms) ---
  const spring = new THREE.Group();
  spring.name = "season-spring";
  {
    const total = FLOWER_PATCHES.reduce((a, p) => a + p.n, 0);
    const stems = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.012, 0.016, 0.26, 4)), keep(m(0x5d8a3c)), total);
    const heads = new THREE.InstancedMesh(keep(new THREE.IcosahedronGeometry(0.075, 0)), keep(m(0xffffff)), total);
    const rnd = seeded(60);
    const mtx = new THREE.Matrix4();
    const col = new THREE.Color();
    let i = 0;
    for (const p of FLOWER_PATCHES) {
      for (let k = 0; k < p.n; k++, i++) {
        const a = rnd() * Math.PI * 2;
        const d = Math.sqrt(rnd()) * p.r;
        const x = p.at[0] + Math.cos(a) * d;
        const z = p.at[1] + Math.sin(a) * d;
        const y = h(x, z);
        const tall = 0.8 + rnd() * 0.5;
        mtx.makeScale(1, tall, 1).setPosition(x, y + 0.13 * tall, z);
        stems.setMatrixAt(i, mtx);
        mtx.makeScale(1, 1, 1).setPosition(x, y + 0.27 * tall, z);
        heads.setMatrixAt(i, mtx);
        heads.setColorAt(i, col.setHex(BLOSSOM_COLOURS[Math.floor(rnd() * BLOSSOM_COLOURS.length)]!));
      }
    }
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    stems.frustumCulled = false;
    heads.frustumCulled = false;
    spring.add(stems, heads);
  }

  // --- Autumn: harvest baskets and sheaves ---
  const autumn = new THREE.Group();
  autumn.name = "season-autumn";
  {
    const wicker = keep(m(0x9a7444, { double: true }));
    const basketGeo = keep(new THREE.CylinderGeometry(0.34, 0.26, 0.3, 8, 1, true));
    const baseGeo = keep(new THREE.CircleGeometry(0.26, 8));
    const fruitGeo = keep(new THREE.IcosahedronGeometry(0.09, 0));
    const fruitMats = { apples: keep(m(0xb8372f)), grapes: keep(m(0x5b3c7a)), olives: keep(m(0x6e7a3b)) };
    const strawMat = keep(m(0xd7b05a));
    const strawGeo = keep(new THREE.ConeGeometry(0.2, 0.9, 7));
    const bandGeo = keep(new THREE.CylinderGeometry(0.115, 0.115, 0.06, 7));
    const bandMat = keep(m(0x7a5a2c));
    const rnd = seeded(61);
    for (const s of HARVEST_SPOTS) {
      const [x, z] = s.at;
      const basket = new THREE.Group();
      basket.position.set(x, h(x, z), z);
      basket.rotation.y = rnd() * Math.PI;
      const wall = new THREE.Mesh(basketGeo, wicker);
      wall.position.y = 0.15;
      const base = new THREE.Mesh(baseGeo, wicker);
      base.rotation.x = -Math.PI / 2;
      base.position.y = 0.01;
      basket.add(wall, base);
      for (let k = 0; k < 9; k++) {
        const f = new THREE.Mesh(fruitGeo, fruitMats[s.fruit]);
        const a = rnd() * Math.PI * 2;
        const d = rnd() * 0.2;
        f.position.set(Math.cos(a) * d, 0.28 + rnd() * 0.07, Math.sin(a) * d);
        basket.add(f);
      }
      // A sheaf of wheat standing beside it.
      const sheaf = new THREE.Group();
      sheaf.position.set(x + 0.75, h(x + 0.75, z + 0.3), z + 0.3);
      const cone = new THREE.Mesh(strawGeo, strawMat);
      cone.position.y = 0.45;
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = 0.42;
      sheaf.add(cone, band);
      autumn.add(basket, sheaf);
    }
  }

  // --- Winter: lanterns on posts, burning warm ---
  const winter = new THREE.Group();
  winter.name = "season-winter";
  const lanternMats: THREE.MeshStandardMaterial[] = [];
  const halos: THREE.SpriteMaterial[] = [];
  {
    const postGeo = keep(new THREE.CylinderGeometry(0.045, 0.06, 1.15, 6));
    const postMat = keep(m(0x4a3a2a));
    const capGeo = keep(new THREE.ConeGeometry(0.2, 0.16, 4));
    const boxGeo = keep(new THREE.BoxGeometry(0.2, 0.26, 0.2));
    const halo = keep(haloTexture());
    for (const [x, z] of WINTER_LANTERNS) {
      const g = new THREE.Group();
      g.position.set(x, h(x, z), z);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 0.575;
      const lampMat = keep(m(0xffd9a0, { emissive: 0xffa94d, intensity: 0.6, rough: 0.5 }));
      lanternMats.push(lampMat);
      const lamp = new THREE.Mesh(boxGeo, lampMat);
      lamp.position.y = 1.28;
      const cap = new THREE.Mesh(capGeo, postMat);
      cap.position.y = 1.5;
      cap.rotation.y = Math.PI / 4;
      const sm = keep(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      halos.push(sm);
      const sprite = new THREE.Sprite(sm);
      sprite.position.y = 1.28;
      sprite.scale.set(1.9, 1.9, 1);
      g.add(post, lamp, cap, sprite);
      winter.add(g);
    }
  }

  group.add(spring, autumn, winter);
  spring.visible = autumn.visible = winter.visible = false;
  let current: Season | null = null;
  let night = 0;
  const burn = () => {
    // Lamplight is lit through the winter's short days, and brightest at night.
    const k = Math.max(0.18, night);
    for (const lm of lanternMats) lm.emissiveIntensity = 0.5 + 1.7 * k;
    for (const hm of halos) hm.opacity = 0.18 + 0.55 * k;
  };

  return {
    group,
    season: () => current,
    setSeason(season) {
      current = season;
      spring.visible = season === "spring";
      autumn.visible = season === "autumn";
      winter.visible = season === "winter";
      burn();
    },
    update(nightMix) {
      if (!winter.visible || Math.abs(nightMix - night) < 0.01) return;
      night = nightMix;
      burn();
    },
    dispose() {
      opts.world.remove(group);
      for (const d of disposables) d.dispose();
    },
  };
}
