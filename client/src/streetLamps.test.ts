import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import {
  LAMP_ARM_Y,
  LAMP_BUNTING_Y,
  LAMP_CAGE_REACH,
  LAMP_CAGE_Y,
  LAMP_MAX_FIXTURES,
  createStreetLampSystem,
  lampIgnition,
  lampLightBudget,
  type LampUpdateOptions,
} from "./streetLamps";

// A canvas stub, as the radial glow texture needs a 2d context only.
const realDocument = (globalThis as { document?: unknown }).document;
beforeAll(() => {
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillStyle: "" }),
    }),
  };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

function setup() {
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const system = createStreetLampSystem(scene, world);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 3, 0);
  camera.updateMatrixWorld(true);
  const listener = new THREE.Vector3(0, 0, 0);
  const opts = (over: Partial<LampUpdateOptions> = {}): LampUpdateOptions => ({
    t: 10,
    lampLevel: 1,
    wetness: 0,
    fog: false,
    rain: 0,
    wind: 0,
    season: "autumn",
    tier: 2,
    camera,
    listener,
    reducedMotion: true,
    falseDream: false,
    ...over,
  });
  const place = (x: number, z: number, o?: Parameters<typeof system.buildPost>[0]) => {
    const post = system.buildPost(o);
    post.position.set(x, 0, z);
    world.add(post);
    post.updateMatrixWorld(true);
    return post;
  };
  const cageOf = (post: THREE.Group) => post.children.find((c) => c.children.some((k) => k.name === "flame"))!;
  const part = (post: THREE.Group, name: string) => cageOf(post).children.find((c) => c.name === name)!;
  const renderLights = () => {
    const out: THREE.PointLight[] = [];
    scene.traverseVisible((o) => {
      if ((o as THREE.PointLight).isPointLight) out.push(o as THREE.PointLight);
    });
    return out;
  };
  const instances = (kind: "pool" | "reflection") =>
    world.children.filter((c): c is THREE.InstancedMesh => (c as THREE.InstancedMesh).isInstancedMesh)[kind === "pool" ? 0 : 1]!;
  const moths = () => world.children.find((c) => (c as THREE.Points).isPoints) as THREE.Points;
  return { scene, world, system, camera, listener, opts, place, cageOf, part, renderLights, instances, moths };
}

/** Four posts at increasing distance from the camera at the origin. */
function fourPosts(h: ReturnType<typeof setup>) {
  return [3, 6, 9, 12].map((z, i) => h.place(0.3, z, { inward: 1, ignitionOrder: 0, variant: (i % 2) as 0 | 1 }));
}

describe("helpers", () => {
  test("dusk travels from the forum toward the avenue", () => {
    expect(lampIgnition(0.3, 0)).toBeGreaterThan(lampIgnition(0.3, 1));
    expect(lampIgnition(0, 0)).toBe(0);
    expect(lampIgnition(1, 1)).toBe(1);
  });
  test("budget by tier", () => {
    expect([0, 1, 2].map(lampLightBudget)).toEqual([1, 2, 4]);
  });
});

describe("real lights", () => {
  test("renderer-visible lights follow tier; unused slots are invisible, not merely dark", () => {
    const h = setup();
    fourPosts(h);
    for (const [tier, expected] of [[0, 1], [1, 2], [2, 4]] as const) {
      h.system.update(h.opts({ tier }));
      const lights = h.renderLights();
      expect(lights.length).toBe(expected);
      expect(lights.every((l) => l.intensity > 0)).toBe(true);
    }
  });

  test("daytime leaves no renderer-visible light at all", () => {
    const h = setup();
    fourPosts(h);
    h.system.update(h.opts({ lampLevel: 0, tier: 2 }));
    expect(h.renderLights().length).toBe(0);
  });

  test("lights sit on the nearest fixtures, with colour, reach and fog and false-dream changes", () => {
    const h = setup();
    const posts = fourPosts(h);
    h.system.update(h.opts({ tier: 1 }));
    const lights = h.renderLights();
    const cages = posts.map((p) => h.cageOf(p).getWorldPosition(new THREE.Vector3()));
    // Tier 1 gets the two nearest posts, in order of distance.
    const sorted = [...lights].sort((a, b) => a.position.z - b.position.z);
    expect(sorted[0]!.position.distanceTo(cages[0]!)).toBeLessThan(1e-6);
    expect(sorted[1]!.position.distanceTo(cages[1]!)).toBeLessThan(1e-6);
    expect(lights[0]!.color.getHex()).toBe(0xffb86b);
    expect(lights[0]!.distance).toBeCloseTo(7.8);
    const clear = lights[0]!.intensity;
    h.system.update(h.opts({ tier: 1, fog: true }));
    expect(h.renderLights()[0]!.distance).toBeCloseTo(6.4);
    expect(h.renderLights()[0]!.intensity).toBeLessThan(clear);
    h.system.update(h.opts({ tier: 1, falseDream: true }));
    expect(h.renderLights()[0]!.color.getHex()).toBe(0xff672f);
  });

  test("a hidden parent excludes its fixtures from lights, pools and ignition", () => {
    const h = setup();
    const posts = fourPosts(h);
    posts[0]!.visible = false;
    h.system.update(h.opts({ tier: 2 }));
    expect(h.renderLights().length).toBe(3);
    const cage0 = h.cageOf(posts[0]!).getWorldPosition(new THREE.Vector3());
    expect(h.renderLights().every((l) => l.position.distanceTo(cage0) > 1)).toBe(true);
    const m = new THREE.Matrix4();
    h.instances("pool").getMatrixAt(0, m);
    expect(m.elements[0]).toBe(0);
  });

  test("rank transitions: moving the camera hands lights to the new nearest fixture", () => {
    const h = setup();
    const posts = fourPosts(h);
    h.system.update(h.opts({ tier: 0 }));
    const near = h.renderLights()[0]!.position.clone();
    expect(near.distanceTo(h.cageOf(posts[0]!).getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-6);
    h.camera.position.set(0, 3, 14);
    h.camera.updateMatrixWorld(true);
    h.system.update(h.opts({ tier: 0 }));
    expect(h.renderLights().length).toBe(1);
    expect(h.renderLights()[0]!.position.distanceTo(h.cageOf(posts[3]!).getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-6);
  });

  test("shader light count really follows: the renderer's point-light list, as WebGLRenderer builds it", () => {
    const h = setup();
    fourPosts(h);
    h.system.update(h.opts({ tier: 0 }));
    // WebGLRenderer pushes every visible light object (it never checks intensity).
    const nonzeroButInvisible = h.scene.children.filter((c) => (c as THREE.PointLight).isPointLight && !c.visible);
    expect(nonzeroButInvisible.length).toBe(3);
    expect(nonzeroButInvisible.every((l) => (l as THREE.PointLight).intensity === 0)).toBe(true);
  });
});

describe("ignition sound", () => {
  const ramp = (h: ReturnType<typeof setup>, from: number, to: number, step: number, over: Partial<LampUpdateOptions> = {}) => {
    let events = 0;
    const n = Math.round(Math.abs(to - from) / step);
    for (let i = 0; i <= n; i++) {
      const lampLevel = from + Math.sign(to - from) * step * i;
      if (h.system.update(h.opts({ lampLevel, ...over })).ignitedNear) events += 1;
    }
    return events;
  };

  test("a gradual dusk, in 0.001 steps, rings exactly once per fixture", () => {
    const h = setup();
    h.place(0.3, 3, { ignitionOrder: 0 });
    h.place(0.3, 5, { ignitionOrder: 0.5 });
    h.system.update(h.opts({ lampLevel: 0 }));
    let events = 0;
    for (let i = 0; i <= 1000; i++) if (h.system.update(h.opts({ lampLevel: i / 1000 })).ignitedNear) events += 1;
    expect(events).toBe(2);
  });

  test("flame and halo progress with the dusk, and are lit by the end", () => {
    const h = setup();
    const post = h.place(0.3, 3, { ignitionOrder: 0 });
    const flame = (post: THREE.Group) => ((h.part(post, "flame") as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity;
    const seen: number[] = [];
    for (const l of [0, 0.1, 0.2, 0.3, 0.6, 1]) {
      h.system.update(h.opts({ lampLevel: l }));
      seen.push(flame(post));
    }
    expect(seen[0]).toBe(0);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
    expect(seen.at(-1)!).toBeGreaterThan(0.9);
    const halo = ((h.part(post, "halo") as THREE.Sprite).material as THREE.SpriteMaterial).opacity;
    expect(halo).toBeGreaterThan(0.3);
  });

  test("no sound on a first-night load, none far away, and one more after a dawn reset", () => {
    const first = setup();
    first.place(0.3, 3, { ignitionOrder: 0 });
    expect(first.system.update(first.opts({ lampLevel: 1 })).ignitedNear).toBe(false);
    expect(first.system.update(first.opts({ lampLevel: 1 })).ignitedNear).toBe(false);
    // Dawn, then dusk again: one sound.
    expect(ramp(first, 1, 0, 0.01)).toBe(0);
    expect(ramp(first, 0, 1, 0.01)).toBe(1);
    // Wobbling inside the hysteresis band never re-rings.
    expect(ramp(first, 1, 0.2, 0.01) + ramp(first, 0.2, 1, 0.01)).toBe(0);

    const far = setup();
    far.place(0.3, 40, { ignitionOrder: 0 });
    far.system.update(far.opts({ lampLevel: 0 }));
    expect(ramp(far, 0, 1, 0.01)).toBe(0);
  });

  test("a lamp revealed while already burning is silent; one revealed at dusk rings when it catches", () => {
    const h = setup();
    const post = h.place(0.3, 3, { ignitionOrder: 0 });
    h.system.update(h.opts({ lampLevel: 0 }));
    post.visible = false;
    expect(h.system.update(h.opts({ lampLevel: 1 })).ignitedNear).toBe(false);
    post.visible = true;
    expect(h.system.update(h.opts({ lampLevel: 1 })).ignitedNear).toBe(false);
    post.visible = false;
    h.system.update(h.opts({ lampLevel: 0 }));
    post.visible = true;
    expect(ramp(h, 0, 1, 0.01)).toBe(1);
  });

  test("the crackle drops to zero with no lit fixture and rises when near one", () => {
    const h = setup();
    h.place(0.3, 3, { ignitionOrder: 0 });
    expect(h.system.update(h.opts({ lampLevel: 0 })).crackle).toBe(0);
    expect(h.system.update(h.opts({ lampLevel: 1 })).crackle).toBeGreaterThan(0.5);
    h.listener.set(0, 0, 60);
    expect(h.system.update(h.opts({ lampLevel: 1 })).crackle).toBe(0);
  });
});

describe("town wiring of the audio boundary", () => {
  const source = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
  test("returned ignition and crackle drive the matching audio calls, and disposal silences", () => {
    expect(source).toContain("if (lampState.ignitedNear) playLampIgnite();");
    expect(source).toContain("setLampCrackleLevel(lampState.crackle);");
    expect(source).toContain("setLampCrackleLevel(0);");
  });
  test("production placement keeps the six posts, the four avenue posts and the old colliders", () => {
    expect(source).toContain("[4.6, 8.4],\n    [-4.6, 8.4],\n    [4.6, -8.4],\n    [-4.6, -8.4],\n    [6.4, 19.6],\n    [-6.4, 19.6],");
    expect(source).toContain("[[3, 27.2], [-3, 27.2], [3, 37], [-3, 37]]");
    expect(source).toContain("...lampPositions.map(([x, z]) => circ(x, z, 0.3, 0.14))");
    expect(source).toContain("ignitionOrder: Math.min(1, Math.hypot(lx, lz) / 42)");
    expect(source).toContain("ignitionOrder: 0.62 + i * 0.08");
  });
});

describe("geometry", () => {
  test("posts share geometry and materials; fixtures are the only per-lamp materials", () => {
    const h = setup();
    const [a, b, c, d] = [
      h.place(0, 3, { inward: 1, variant: 0 }),
      h.place(5, 3, { inward: 1, variant: 0 }),
      h.place(10, 3, { inward: -1, variant: 0 }),
      h.place(15, 3, { inward: 1, variant: 1 }),
    ] as const;
    const metal = (p: THREE.Group) => p.children.find((k) => (k as THREE.Mesh).castShadow && (k as THREE.Mesh).geometry.getAttribute("color")) as THREE.Mesh;
    expect(metal(a).geometry).toBe(metal(b).geometry);
    expect(metal(a).material).toBe(metal(c).material);
    expect(metal(a).geometry).not.toBe(metal(c).geometry);
    expect(metal(a).geometry).not.toBe(metal(d).geometry);
    expect((h.part(a, "oil-vessel") as THREE.Mesh).geometry).toBe((h.part(d, "oil-vessel") as THREE.Mesh).geometry);
    expect((h.part(a, "oil-vessel") as THREE.Mesh).material).toBe((h.part(b, "oil-vessel") as THREE.Mesh).material);
    expect((h.part(a, "flame") as THREE.Mesh).material).not.toBe((h.part(b, "flame") as THREE.Mesh).material);
  });

  test("the oil lamp is an open upward bowl with oil, a spout and a wick", () => {
    const h = setup();
    const post = h.place(0, 3);
    const vessel = (h.part(post, "oil-vessel") as THREE.Mesh).geometry;
    const pos = vessel.getAttribute("position");
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = 0; i < pos.count; i++) {
      top = Math.max(top, pos.getY(i));
      bottom = Math.min(bottom, pos.getY(i));
    }
    // The bowl is below its rim (a lower hemisphere): the widest ring is the highest ring.
    const radiusAt = (y: number) => {
      let r = 0;
      for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - y) < 0.004 && pos.getX(i) < 0.07) r = Math.max(r, Math.hypot(pos.getX(i) + 0.015, pos.getZ(i)));
      return r;
    };
    expect(radiusAt(-0.13)).toBeGreaterThan(radiusAt(bottom + 0.004) + 0.03); // the rim (y=-0.13) is the widest ring
    // A spout reaches out past the rim toward +x.
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) maxX = Math.max(maxX, pos.getX(i));
    expect(maxX).toBeGreaterThan(0.085);
    const oil = (h.part(post, "oil-fill") as THREE.Mesh).geometry;
    oil.computeBoundingBox();
    expect(oil.boundingBox!.max.y).toBeLessThan(-0.13);
    expect(oil.boundingBox!.min.y).toBeGreaterThan(bottom);
    const flame = h.part(post, "flame");
    expect(flame.position.y).toBeGreaterThan(oil.boundingBox!.max.y);
    expect(flame.position.x).toBeGreaterThan(0.06);
  });

  test("the cage hangs from a ring clear of its roof, on a chain up to the arm", () => {
    const h = setup();
    for (const variant of [0, 1] as const) {
      for (const inward of [1, -1] as const) {
        const post = h.place(0, 3, { inward, variant });
        const metal = post.children.find((k) => (k as THREE.Mesh).geometry?.getAttribute("color") && (k as THREE.Mesh).castShadow) as THREE.Mesh;
        const pos = metal.geometry.getAttribute("position");
        // Chain vertices: those on the cage axis between the roof and the arm.
        const onAxis: number[] = [];
        for (let i = 0; i < pos.count; i++) {
          if (Math.abs(pos.getX(i) - inward * LAMP_CAGE_REACH) < 0.03 && Math.abs(pos.getZ(i)) < 0.03) onAxis.push(pos.getY(i));
        }
        const cage = h.cageOf(post);
        const scale = cage.scale.x;
        const roofTop = LAMP_CAGE_Y + 0.375 * scale;
        const chainLow = Math.min(...onAxis);
        const chainHigh = Math.max(...onAxis);
        expect(chainLow).toBeGreaterThan(roofTop); // the chain starts above the roof
        expect(chainHigh).toBeGreaterThan(LAMP_ARM_Y - 0.0275 - 0.03); // and reaches the arm underside
        expect(chainHigh).toBeLessThan(LAMP_ARM_Y + 0.03);
        // The ring on the roof sits above the roof and is no deeper than the chain's first link.
        const cageGeo = (cage.children[0] as THREE.Mesh).geometry;
        cageGeo.computeBoundingBox();
        expect(LAMP_CAGE_Y + cageGeo.boundingBox!.max.y * scale).toBeGreaterThan(roofTop + 0.02);
        // No vertical gap between consecutive chain links bigger than a link.
        const sorted = [...new Set(onAxis.map((y) => Math.round(y * 200)))].sort((x, y) => x - y);
        for (let i = 1; i < sorted.length; i++) expect(sorted[i]! - sorted[i - 1]!).toBeLessThanOrEqual(4);
      }
    }
  });

  test("festival bunting ropes end on the post's cleat, at the support's own height", () => {
    const h = setup();
    const post = h.place(0, 3, { inward: 1 });
    const metal = post.children.find((k) => (k as THREE.Mesh).geometry?.getAttribute("color") && (k as THREE.Mesh).castShadow) as THREE.Mesh;
    metal.geometry.computeBoundingBox();
    const pos = metal.geometry.getAttribute("position");
    // The cleat: vertices on the post axis whose height is the bunting height.
    let cleat = false;
    let postTop = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      postTop = Math.max(postTop, pos.getY(i));
      if (Math.abs(pos.getY(i) - LAMP_BUNTING_Y) < 0.016 && Math.abs(pos.getZ(i)) < 0.02) cleat = true;
    }
    expect(cleat).toBe(true);
    // The rope end sits within the support, not 0.36 above it.
    expect(postTop - LAMP_BUNTING_Y).toBeLessThan(0.03);
    expect(postTop).toBeGreaterThanOrEqual(LAMP_BUNTING_Y);
    // The town's rope endpoints come from the same constant.
    const source = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
    expect(source).toContain("new THREE.Vector3(a[0], LAMP_BUNTING_Y, a[1])");
    expect(source).toContain("new THREE.Vector3(b[0], LAMP_BUNTING_Y, b[1])");
    expect(source).not.toContain("a[0], 2.95");
  });

  test("the footprint stays inside the old 0.3 collider and all matrices are finite", () => {
    const h = setup();
    const post = h.place(0, 3, { variant: 0 });
    const q = h.place(4, 3, { variant: 1 });
    for (const p of [post, q]) {
      const box = new THREE.Box3();
      for (const child of p.children) {
        if (child === h.cageOf(p)) continue;
        child.updateWorldMatrix(true, false);
        const geo = (child as THREE.Mesh).geometry;
        geo.computeBoundingBox();
        const b = geo.boundingBox!.clone().applyMatrix4(child.matrixWorld);
        box.union(b);
      }
      // Only the arm and chain reach inward; the standing part is the post's own foot.
      const foot = (p.children[0] as THREE.Mesh).geometry;
      foot.computeBoundingBox();
      expect(Math.max(Math.abs(foot.boundingBox!.min.x), foot.boundingBox!.max.x)).toBeLessThanOrEqual(0.3 + 1e-6);
      expect(foot.boundingBox!.max.y - foot.boundingBox!.min.y).toBeCloseTo(0.5, 5);
      expect(Number.isFinite(box.min.y) && Number.isFinite(box.max.y)).toBe(true);
    }
    p_matrices_finite(h);
  });

  test("the system caps pools and reflections at the fixture capacity", () => {
    const h = setup();
    for (let i = 0; i < LAMP_MAX_FIXTURES + 8; i++) h.place(i * 0.2, 3 + (i % 5));
    h.system.update(h.opts({ wetness: 0.8 }));
    expect(h.instances("pool").count).toBe(LAMP_MAX_FIXTURES);
    expect(h.instances("reflection").count).toBe(LAMP_MAX_FIXTURES);
    expect(h.renderLights().length).toBeLessThanOrEqual(4);
  });
});

function p_matrices_finite(h: ReturnType<typeof setup>) {
  h.system.update(h.opts({ wetness: 0.8 }));
  for (const kind of ["pool", "reflection"] as const) {
    const mesh = h.instances(kind);
    for (let i = 0; i < mesh.count; i++) {
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(i, m);
      expect(m.elements.every(Number.isFinite)).toBe(true);
    }
  }
}

describe("weather", () => {
  const matrix = (mesh: THREE.InstancedMesh, i = 0) => {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(i, m);
    return m;
  };
  const scaleOf = (m: THREE.Matrix4) => new THREE.Vector3().setFromMatrixScale(m);

  test("dry: pools lie under the cage, reflections are collapsed; wet: reflections and opacity appear", () => {
    const h = setup();
    const post = h.place(0.3, 3, { ignitionOrder: 0 });
    const cage = h.cageOf(post).getWorldPosition(new THREE.Vector3());
    h.system.update(h.opts({ wetness: 0 }));
    const pool = matrix(h.instances("pool"));
    const p = new THREE.Vector3().setFromMatrixPosition(pool);
    expect(p.x).toBeCloseTo(cage.x);
    expect(p.z).toBeCloseTo(cage.z);
    expect(p.y).toBeCloseTo(cage.y - LAMP_CAGE_Y + 0.025);
    expect(scaleOf(pool).x).toBeGreaterThan(3);
    expect(scaleOf(matrix(h.instances("reflection"))).x).toBe(0);
    expect((h.instances("reflection").material as THREE.MeshBasicMaterial).opacity).toBe(0);
    h.system.update(h.opts({ wetness: 1 }));
    expect(scaleOf(matrix(h.instances("reflection"))).y).toBeGreaterThan(5);
    expect((h.instances("reflection").material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.28);
    h.system.update(h.opts({ wetness: 1, fog: true }));
    expect((h.instances("reflection").material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.19);
  });

  test("hidden fixtures and decorative cages cast no pool or reflection", () => {
    const h = setup();
    const post = h.place(0.3, 3, { ignitionOrder: 0 });
    const deco = h.system.buildCage(0.6);
    deco.position.set(2, 2, 3);
    h.world.add(deco);
    deco.updateMatrixWorld(true);
    h.system.update(h.opts({ wetness: 1 }));
    expect(scaleOf(matrix(h.instances("reflection"), 1)).x).toBe(0); // decorative: no reflection
    expect(scaleOf(matrix(h.instances("pool"), 1)).x).toBeGreaterThan(0);
    post.visible = false;
    h.system.update(h.opts({ wetness: 1 }));
    expect(scaleOf(matrix(h.instances("pool"), 0)).x).toBe(0);
    expect(scaleOf(matrix(h.instances("reflection"), 0)).x).toBe(0);
  });

  test("moths: only lit, dry, clear spring and summer nights", () => {
    const h = setup();
    h.place(0.3, 3, { ignitionOrder: 0 });
    const count = (o: Partial<LampUpdateOptions>) => {
      h.system.update(h.opts({ reducedMotion: false, ...o }));
      return h.moths().geometry.drawRange.count;
    };
    expect(count({ season: "summer" })).toBeGreaterThan(0);
    expect(count({ season: "spring" })).toBeGreaterThan(0);
    expect(count({ season: "autumn" })).toBe(0);
    expect(count({ season: "winter" })).toBe(0);
    expect(count({ season: "summer", rain: 0.5 })).toBe(0);
    expect(count({ season: "summer", fog: true })).toBe(0);
    expect(count({ season: "summer", lampLevel: 0.3 })).toBe(0);
  });

  test("reduced motion hides the moths; otherwise two times give two different positions", () => {
    const h = setup();
    h.place(0.3, 3, { ignitionOrder: 0 });
    h.system.update(h.opts({ season: "summer", reducedMotion: false, t: 1 }));
    const a = Array.from(h.moths().geometry.getAttribute("position").array).slice(0, 12);
    h.system.update(h.opts({ season: "summer", reducedMotion: false, t: 3 }));
    const b = Array.from(h.moths().geometry.getAttribute("position").array).slice(0, 12);
    expect(a).not.toEqual(b);
    h.system.update(h.opts({ season: "summer", reducedMotion: true, t: 1 }));
    expect(h.moths().geometry.drawRange.count).toBe(0);
    h.system.update(h.opts({ season: "summer", reducedMotion: true, t: 3 }));
    expect(h.moths().geometry.drawRange.count).toBe(0);
  });

  test("reduced motion freezes flicker; full motion varies it with time", () => {
    const h = setup();
    const post = h.place(0.3, 3, { ignitionOrder: 0 });
    const op = () => ((h.part(post, "flame") as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity;
    h.system.update(h.opts({ reducedMotion: true, t: 1 }));
    const a = op();
    h.system.update(h.opts({ reducedMotion: true, t: 2.2 }));
    expect(op()).toBe(a);
    h.system.update(h.opts({ reducedMotion: false, t: 1 }));
    const c = op();
    h.system.update(h.opts({ reducedMotion: false, t: 2.2 }));
    expect(op()).not.toBe(c);
  });
});
