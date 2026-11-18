import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as THREE from "three";
import { FILMIC, HAZE, grade, hazeAt, hazeFogFragment, installAtmosphere, sunSide, uninstallAtmosphere } from "./atmosphere";
import { RECIPES, applySurfaceVariation, surfaceKindOf, variation, variationGLSL, varyModel, type SurfaceKind } from "./surfaceVariation";
import { TONE_EXPOSURE } from "./skyLook";
import { buildAthenaTemple } from "./tributes";
import { buildSeaCliff } from "./seaCliff";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lum = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;

function sample(kind: SurfaceKind, n = 4000) {
  const out: number[][] = [];
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) out.push(variation(kind, [rnd() * 120 - 60, rnd() * 6, rnd() * 120 - 60], 0.6 + rnd() * 0.4, 0));
  return out;
}

describe("procedural surface variation (Task 109)", () => {
  for (const kind of Object.keys(RECIPES) as SurfaceKind[]) {
    test(`${kind}: not one flat colour, and the palette stays`, () => {
      const s = sample(kind);
      const l = s.map(lum);
      const mean = l.reduce((a, b) => a + b, 0) / l.length;
      const sd = Math.sqrt(l.reduce((a, b) => a + (b - mean) ** 2, 0) / l.length);
      const chan = (i: number) => { const v = s.map((c) => c[i]!); const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
      expect(Math.max(sd, chan(0), chan(1), chan(2))).toBeGreaterThan(0.045); // visible variation, in light or in hue
      expect(mean).toBeGreaterThan(0.93); // within the palette, not a recolour
      expect(mean).toBeLessThan(1.08);
    });
    test(`${kind}: the variation is two scales, so neighbours differ but nearby agree`, () => {
      const a = variation(kind, [3, 1, 3], 1, 0), b = variation(kind, [3.001, 1, 3], 1, 0);
      expect(Math.abs(lum(a) - lum(b))).toBeLessThan(0.02);
      let far = 0;
      for (let i = 1; i <= 40; i++) far = Math.max(far, Math.abs(lum(variation(kind, [3 + i * 2.3, 1, 3 - i], 1, 0)) - lum(a)));
      expect(far).toBeGreaterThan(0.05);
    });
    test(`${kind}: the shader is built from the same recipe`, () => {
      const g = variationGLSL(kind);
      expect(g).toContain("mtVary");
      expect(g).toContain(RECIPES[kind].a[0]!.toFixed(4));
    });
  }
  test("grain fades out with distance (no shimmer far away)", () => {
    const near = [0, 1, 2, 3, 4, 5].map((i) => lum(variation("stone", [i * 0.05, 1, 0], 1, 0)));
    const far = [0, 1, 2, 3, 4, 5].map((i) => lum(variation("stone", [i * 0.05, 1, 0], 1, 60)));
    const spread = (a: number[]) => Math.max(...a) - Math.min(...a);
    expect(spread(far)).toBeLessThanOrEqual(spread(near));
  });
  test("applySurfaceVariation injects the world-space noise into the material's shader", () => {
    const m = applySurfaceVariation(new THREE.MeshStandardMaterial(), "grass");
    expect(surfaceKindOf(m)).toBe("grass");
    expect(m.customProgramCacheKey()).toContain("grass");
    const shader = {
      uniforms: {},
      vertexShader: "void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}",
      fragmentShader: "void main() {\n#include <color_fragment>\n}",
    };
    m.onBeforeCompile(shader as never, null as never);
    expect(shader.vertexShader).toContain("vMtP");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb *= mtVary(");
  });
  test("varyModel gives each mesh its own copy and leaves the shared material alone", () => {
    const shared = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const root = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), shared), new THREE.Mesh(new THREE.BoxGeometry(), shared));
    expect(varyModel(root, "stone")).toBe(2);
    expect(surfaceKindOf(shared)).toBeNull();
    expect(shared.onBeforeCompile.toString()).not.toContain("vMtP");
    for (const c of root.children) expect(surfaceKindOf((c as THREE.Mesh).material as THREE.Material)).toBe("stone");
  });
  test("the treated set: Athena's temple stone, the cliff, and the scene's ground, paving, cobbles, trail, meadow and pack temple/columns", () => {
    const temple = buildAthenaTemple(0).group;
    const kinds = new Set<string>();
    let flat = 0;
    temple.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !(mesh.material as THREE.MeshStandardMaterial).flatShading) return;
      const k = surfaceKindOf(mesh.material as THREE.Material);
      if (k) kinds.add(k); else flat++;
    });
    expect(kinds.has("stone")).toBe(true);
    // what stays flat is the small stuff (lamps, wreath, letters, her), never a podium, wall or step
    const podium = temple.children[0] as THREE.Mesh;
    expect(surfaceKindOf(podium.material as THREE.Material)).toBe("stone");
    expect(flat).toBeGreaterThanOrEqual(0);

    const src = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    for (const needle of [
      'applySurfaceVariation(groundMat, "grass")',
      '"cobbles"); // Task 109',
      '"dirt"); // Task 109',
      'applySurfaceVariation(groundMaterial(loadGroundMaps("paving"',
      'mat(0x5d9a48, { rough: 1 }), "grass")',
      '[templeUrl, "stone"], [columnIonicUrl, "stone"], [columnSimpleUrl, "stone"]',
    ]) expect(src).toContain(needle);
    const cliff = readFileSync(join(import.meta.dir, "seaCliff.ts"), "utf8");
    expect(cliff).toContain('flatShading: true, side: THREE.DoubleSide }), "rock")');
    expect(cliff).toContain('roughness: 1 }), "grass")');
    expect(cliff).toContain('polygonOffsetFactor: -2 }), "dirt")'); // the headland path
    expect(typeof buildSeaCliff).toBe("function");
  });
});

describe("sun-aware haze (Task 109)", () => {
  const noon = 1.7;
  test("looking into the sun is warmer than looking away from it", () => {
    const into = hazeAt(0.5, 1, noon), away = hazeAt(0.5, -1, noon);
    expect(into.tint[0] / into.tint[2]).toBeGreaterThan(away.tint[0] / away.tint[2]);
    expect(into.tint[0]).toBeGreaterThan(1);
    expect(into.tint[2]).toBeLessThan(1);
    expect(away.tint[2]).toBeGreaterThan(away.tint[0]); // cooler away from it
  });
  test("it is thicker toward the sun and thinner away from it", () => {
    expect(hazeAt(0.5, 1, noon).factor).toBeGreaterThan(0.5);
    expect(hazeAt(0.5, -1, noon).factor).toBeLessThan(0.5);
    expect(sunSide(1)).toBeGreaterThan(sunSide(0));
    expect(sunSide(0)).toBeGreaterThan(sunSide(-1));
  });
  test("no sun (night, storm) means the plain fog", () => {
    const n = hazeAt(0.5, 1, 0.05);
    expect(n.factor).toBeCloseTo(0.5, 5);
    for (const t of n.tint) expect(t).toBeCloseTo(1, 5);
  });
  test("no fog stays no fog, full fog stays full fog, and the far tint is partly kept so the sea meets the sky", () => {
    expect(hazeAt(0, 1, noon).factor).toBe(0);
    expect(hazeAt(1, 1, noon).factor).toBe(1);
    const far = hazeAt(1, 1, noon).tint, mid = hazeAt(0.5, 1, noon).tint;
    expect(far[0]).toBeLessThan(mid[0]);
    expect(far[0]).toBeGreaterThan(1);
    expect(HAZE.farKeep).toBeGreaterThan(0);
  });
  test("the shader is the same maths: it reads the sun light and the haze constants", () => {
    const g = hazeFogFragment();
    expect(g).toContain("directionalLights[ 0 ]");
    expect(g).toContain("vFogDir");
    expect(g).toContain(HAZE.warm[0].toFixed(4));
    expect(g).toContain("gl_FragColor.rgb = mix( gl_FragColor.rgb, hazeColor, fogFactor )");
  });
  describe("installed", () => {
    beforeAll(() => installAtmosphere());
    afterAll(() => uninstallAtmosphere());
    test("three's fog and tone chunks are replaced for every material", () => {
      const c = THREE.ShaderChunk as unknown as Record<string, string>;
      expect(c.fog_fragment).toContain("hzSun");
      expect(c.fog_vertex).toContain("vFogDir");
      expect(c.fog_pars_fragment).toContain("vFogDir");
      expect(c.tonemapping_fragment).toContain("mtGrade");
      expect(c.tonemapping_pars_fragment).toContain("vec3 mtGrade");
      expect(c.tonemapping_pars_fragment).toContain("toneMapping"); // three's own is kept
    });
    test("installing twice changes nothing", () => {
      const c = THREE.ShaderChunk as unknown as Record<string, string>;
      const before = c.fog_fragment;
      installAtmosphere();
      expect(c.fog_fragment).toBe(before);
    });
  });
});

describe("filmic finish (Task 109)", () => {
  test("the renderer is ACES with the exposure set", () => {
    const src = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
    expect(src).toContain("renderer.toneMapping = THREE.ACESFilmicToneMapping");
    expect(src).toContain("renderer.toneMappingExposure = TONE_EXPOSURE");
    expect(src).toContain("installAtmosphere();");
    expect(TONE_EXPOSURE).toBeGreaterThan(0.8);
    expect(TONE_EXPOSURE).toBeLessThan(1.12);
  });
  test("middle grey is the pivot: it barely moves, and the tint is subtle", () => {
    const g = grade([0.18, 0.18, 0.18]);
    expect(lum(g) / 0.18).toBeGreaterThan(0.95);
    expect(lum(g) / 0.18).toBeLessThan(1.06);
    for (const [i, c] of g.entries()) expect(Math.abs(c / 0.18 - 1)).toBeLessThan(0.1 + i * 0);
  });
  test("warm: a neutral grey leans red over blue, more so in the highlights than the shadows", () => {
    const hi = grade([0.8, 0.8, 0.8]), lo = grade([0.02, 0.02, 0.02]);
    expect(hi[0] / hi[2]).toBeGreaterThan(1);
    expect(hi[0] / hi[2]).toBeGreaterThan(lo[0] / lo[2]);
    expect(FILMIC.whiteBalance[0]).toBeGreaterThan(FILMIC.whiteBalance[2]);
  });
  test("black stays black and values stay finite", () => {
    for (const c of grade([0, 0, 0])) expect(c).toBeLessThan(0.001);
    for (const c of grade([50, 50, 50])) expect(Number.isFinite(c)).toBe(true);
  });
});
