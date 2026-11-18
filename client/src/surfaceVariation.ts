// Task 109: procedural surface variation, after the O'Neill cylinder's
// recipe. Nothing in the world is one flat colour there: every surface is two
// or three base colours mixed by multi-scale noise, then height and slope
// bands, then a fine grain. Here that is a small shader injection that
// multiplies a material's own colour (its texture included) by a variation
// computed from WORLD position, so it needs no UVs, tiles nowhere, and is
// the same on a box, a ribbon, a terrain or a pack model.
//
// The multipliers hover around 1 (the mean is checked by the tests), so the
// Roman palette stays: this is variation within it, not a recolour.
//
// `variation()` is the plain-TS twin of the GLSL, from the same recipe
// table and the same integer hash, so the tests can sample what the shader
// paints without a GPU.
import * as THREE from "three";

export type SurfaceKind = "paving" | "cobbles" | "dirt" | "grass" | "stone" | "rock";
type V3 = readonly [number, number, number];

export interface Recipe {
  /** 2: noise over world x/z (ground); 3: over x/y/z (columns, walls, rock). */
  dim: 2 | 3;
  /** Two base multipliers, mixed by the large-scale noise, and an accent mixed in by a patch noise. */
  a: V3;
  b: V3;
  accent: V3;
  /** Feature size in metres at the large scale, the mid scale, the accent patches. */
  large: number;
  mid: number;
  patch: number;
  /** How hard the accent shows (0..1) and the noise value above which it starts. */
  accentAmt: number;
  accentFrom: number;
  /** Fine grain amplitude (the cylinder's `.84 + .32 * noise` is 0.16), and its scale in metres. */
  grain: number;
  grainSize: number;
  /** Slope band: steep faces (world normal y below `slopeAt`) take `slopeTint`, by `slopeAmt`. */
  slopeAt: number;
  slopeAmt: number;
  slopeTint: V3;
  /** Height band: strata (rock) or streaks (stone); `bandFreq` per metre of height, 0 for none. */
  bandFreq: number;
  bandAmt: number;
  bandTint: V3;
  /** Stretch of the noise along y (3-D kinds): below 1 draws vertical streaks. */
  stretchY: number;
}

const base: Omit<Recipe, "a" | "b" | "accent" | "dim"> = {
  large: 4, mid: 1, patch: 7, accentAmt: 0.5, accentFrom: 0.55, grain: 0.1, grainSize: 0.12,
  slopeAt: 0, slopeAmt: 0, slopeTint: [1, 1, 1], bandFreq: 0, bandAmt: 0, bandTint: [1, 1, 1], stretchY: 1,
};

export const RECIPES: Record<SurfaceKind, Recipe> = {
  // Travertine slabs: warm and cool-pale slabs, a brown stain here and there.
  paving: { ...base, dim: 2, a: [1.12, 1.1, 1.03], b: [0.94, 0.92, 0.88], accent: [0.86, 0.82, 0.74], large: 5, mid: 1.3, patch: 3, accentAmt: 0.45, grain: 0.09 },
  // Cobbles: light and dark runs of stone, damp dark patches and a little moss.
  cobbles: { ...base, dim: 2, a: [1.14, 1.12, 1.08], b: [0.9, 0.88, 0.86], accent: [0.9, 1.0, 0.82], large: 3.5, mid: 0.8, patch: 5, accentAmt: 0.5, accentFrom: 0.62, grain: 0.1, grainSize: 0.09 },
  // The forest trails: packed earth, lighter where it dries, darker where it holds water.
  dirt: { ...base, dim: 2, a: [1.2, 1.14, 1.03], b: [0.92, 0.88, 0.82], accent: [0.82, 0.78, 0.72], large: 3, mid: 0.7, patch: 4, accentAmt: 0.45, grain: 0.12, grainSize: 0.1 },
  // Grass: a lush and a yellow-green mixed by value noise, dry warm patches by a second noise,
  // bare earth showing on the steep faces.
  grass: { ...base, dim: 2, a: [0.84, 0.98, 0.84], b: [1.2, 1.14, 0.88], accent: [1.32, 1.12, 0.78], large: 14, mid: 3.2, patch: 30, accentAmt: 0.55, accentFrom: 0.58, grain: 0.07, grainSize: 0.22, slopeAt: 0.93, slopeAmt: 0.5, slopeTint: [1.14, 0.9, 0.74] },
  // Temple stone and plaster: warm and cool blocks, weathering streaks running down, grime on the undersides.
  stone: { ...base, dim: 3, a: [1.12, 1.1, 1.05], b: [0.94, 0.92, 0.88], accent: [0.84, 0.82, 0.76], large: 2.6, mid: 0.55, patch: 1.6, accentAmt: 0.55, accentFrom: 0.5, grain: 0.08, grainSize: 0.08, slopeAt: 0.3, slopeAmt: 0.25, slopeTint: [0.9, 0.88, 0.84], stretchY: 0.3 },
  // The cliff: buff and dark rock, ochre strata, a dark and a bright face.
  rock: { ...base, dim: 3, a: [1.26, 1.16, 1.03], b: [0.88, 0.84, 0.8], accent: [1.0, 0.88, 0.72], large: 6, mid: 1.4, patch: 4, accentAmt: 0.55, accentFrom: 0.5, grain: 0.12, grainSize: 0.18, slopeAt: 0.55, slopeAmt: 0.3, slopeTint: [1.06, 1.02, 0.96], bandFreq: 0.9, bandAmt: 0.5, bandTint: [0.9, 0.78, 0.62] },
};

// ------------------------------------------------------------- the noise
// One integer hash, written twice (GLSL, TS) so the two agree.
const M1 = 1597334673, M2 = 3812015801, M3 = 2798796415;
function hash(x: number, y: number, z: number): number {
  let n = ((Math.imul(x >>> 0, M1) ^ Math.imul(y >>> 0, M2) ^ Math.imul(z >>> 0, M3)) >>> 0);
  n = Math.imul(n ^ (n >>> 16), 2246822519) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 3266489917) >>> 0;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}
const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function vn3(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const c = (dx: number, dy: number, dz: number) => hash(ix + dx, iy + dy, iz + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), fx), lerp(c(0, 1, 0), c(1, 1, 0), fx), fy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), fx), lerp(c(0, 1, 1), c(1, 1, 1), fx), fy),
    fz,
  );
}
/** Value noise over a plane: the third lattice axis is fixed, so the ground pays for four lookups, not eight. */
function vn2(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = fade(x - ix), fz = fade(z - iz);
  return lerp(lerp(hash(ix, 0, iz), hash(ix + 1, 0, iz), fx), lerp(hash(ix, 0, iz + 1), hash(ix + 1, 0, iz + 1), fx), fz);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Distance (metres) beyond which the fine grain fades out (it would only shimmer), and where it is gone. */
export const GRAIN_FADE: [number, number] = [34, 12];

/**
 * The colour multiplier at a world position: `p` the position, `ny` the world
 * normal's y, `dist` the distance to the camera (fades the fine grain).
 */
export function variation(kind: SurfaceKind, p: V3, ny = 1, dist = 0): [number, number, number] {
  const r = RECIPES[kind];
  const sy = r.stretchY;
  const n = (scale: number, ox = 0, oy = 0, oz = 0) =>
    r.dim === 2
      ? vn2(p[0] / scale + ox, p[2] / scale + oz)
      : vn3(p[0] / scale + ox, (p[1] / scale) * sy + oy, p[2] / scale + oz);
  // Two scales of noise, 2 octaves each, mixed into one value.
  const big = n(r.large) * 0.65 + n(r.large * 0.5, 17.3, 5.1, 9.7) * 0.35;
  const mid = n(r.mid, 3.7, 11.9, 6.3);
  const mixv = smoothstep(0.36, 0.64, big * 0.7 + mid * 0.3);
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = lerp(r.a[i]!, r.b[i]!, mixv);
  // The accent: patches of a third colour.
  const patch = n(r.patch, 41.1, 23.7, 61.3);
  const acc = smoothstep(r.accentFrom, r.accentFrom + 0.2, patch) * r.accentAmt;
  for (let i = 0; i < 3; i++) out[i] = lerp(out[i]!, r.accent[i]!, acc);
  // Slope band.
  if (r.slopeAmt > 0) {
    const s = smoothstep(r.slopeAt, r.slopeAt - 0.2, ny) * r.slopeAmt;
    for (let i = 0; i < 3; i++) out[i] = lerp(out[i]!, r.slopeTint[i]!, s);
  }
  // Height bands: strata (a warped sine of height).
  if (r.bandFreq > 0) {
    const w = 0.5 + 0.5 * Math.sin(p[1] * r.bandFreq * Math.PI * 2 + big * 5);
    const s = smoothstep(0.62, 0.9, w) * r.bandAmt;
    for (let i = 0; i < 3; i++) out[i] = lerp(out[i]!, r.bandTint[i]!, s);
  }
  // Fine grain, the cylinder's (1 - amp/2 + amp * noise), fading with distance.
  const fade = smoothstep(GRAIN_FADE[0], GRAIN_FADE[1], dist);
  const g = 1 + (n(r.grainSize, 71.9, 3.3, 29.1) - 0.5) * r.grain * 2 * fade;
  return [out[0]! * g, out[1]! * g, out[2]! * g];
}

// ------------------------------------------------------------- the shader
const f = (x: number) => x.toFixed(4);
const v3 = (a: V3) => `vec3(${a.map(f).join(", ")})`;

const NOISE_GLSL = /* glsl */ `
float mtHash(ivec3 p) {
  uint n = (uint(p.x) * 1597334673u) ^ (uint(p.y) * 3812015801u) ^ (uint(p.z) * 2798796415u);
  n = (n ^ (n >> 16u)) * 2246822519u;
  n = n ^ (n >> 13u);
  n = n * 3266489917u;
  n = n ^ (n >> 16u);
  return float(n) * (1.0 / 4294967295.0);
}
float mtVn3(vec3 x) {
  vec3 i = floor(x); vec3 u = x - i; u = u * u * (3.0 - 2.0 * u);
  ivec3 b = ivec3(i);
  return mix(
    mix(mix(mtHash(b), mtHash(b + ivec3(1,0,0)), u.x), mix(mtHash(b + ivec3(0,1,0)), mtHash(b + ivec3(1,1,0)), u.x), u.y),
    mix(mix(mtHash(b + ivec3(0,0,1)), mtHash(b + ivec3(1,0,1)), u.x), mix(mtHash(b + ivec3(0,1,1)), mtHash(b + ivec3(1,1,1)), u.x), u.y),
    u.z);
}
float mtVn2(vec2 x) {
  vec2 i = floor(x); vec2 u = x - i; u = u * u * (3.0 - 2.0 * u);
  ivec3 b = ivec3(int(i.x), 0, int(i.y));
  return mix(mix(mtHash(b), mtHash(b + ivec3(1,0,0)), u.x), mix(mtHash(b + ivec3(0,0,1)), mtHash(b + ivec3(1,0,1)), u.x), u.y);
}
`;

export function variationGLSL(kind: SurfaceKind): string {
  const r = RECIPES[kind];
  const noise = r.dim === 2
    ? (s: number, o: string) => `mtVn2(vec2(mtP.x, mtP.z) / ${f(s)}${o ? ` + ${o}.xz` : ""})`
    : (s: number, o: string) => `mtVn3(vec3(mtP.x, mtP.y * ${f(r.stretchY)}, mtP.z) / ${f(s)}${o ? ` + ${o}` : ""})`;
  return /* glsl */ `
${NOISE_GLSL}
vec3 mtVary(vec3 mtP, float mtNy, float mtDist) {
  float big = ${noise(r.large, "")} * 0.65 + ${noise(r.large * 0.5, "vec3(17.3, 5.1, 9.7)")} * 0.35;
  float mid = ${noise(r.mid, "vec3(3.7, 11.9, 6.3)")};
  float mixv = smoothstep(0.36, 0.64, big * 0.7 + mid * 0.3);
  vec3 c = mix(${v3(r.a)}, ${v3(r.b)}, mixv);
  float mtPatch = ${noise(r.patch, "vec3(41.1, 23.7, 61.3)")};
  c = mix(c, ${v3(r.accent)}, smoothstep(${f(r.accentFrom)}, ${f(r.accentFrom + 0.2)}, mtPatch) * ${f(r.accentAmt)});
  ${r.slopeAmt > 0 ? `c = mix(c, ${v3(r.slopeTint)}, smoothstep(${f(r.slopeAt)}, ${f(r.slopeAt - 0.2)}, mtNy) * ${f(r.slopeAmt)});` : ""}
  ${r.bandFreq > 0 ? `c = mix(c, ${v3(r.bandTint)}, smoothstep(0.62, 0.9, 0.5 + 0.5 * sin(mtP.y * ${f(r.bandFreq * Math.PI * 2)} + big * 5.0)) * ${f(r.bandAmt)});` : ""}
  float fadeG = smoothstep(${f(GRAIN_FADE[0])}, ${f(GRAIN_FADE[1])}, mtDist);
  float g = 1.0 + (${noise(r.grainSize, "vec3(71.9, 3.3, 29.1)")} - 0.5) * ${f(r.grain * 2)} * fadeG;
  return c * g;
}
`;
}

const MARK = "mt-variation";
const kindOf = new WeakMap<THREE.Material, SurfaceKind>();

/** The kind of variation a material carries, if any. */
export function surfaceKindOf(material: THREE.Material): SurfaceKind | null {
  return kindOf.get(material) ?? null;
}

/**
 * Give `material` the variation. Assigns onBeforeCompile outright (the
 * ground, rock and stone materials carry no other injection), and keys the
 * program on the kind so materials of one kind share a program.
 */
export function applySurfaceVariation<T extends THREE.Material>(material: T, kind: SurfaceKind): T {
  kindOf.set(material, kind);
  const glsl = variationGLSL(kind);
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vMtP;\nvarying vec3 vMtN;\nvoid main() {")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
  {
    vec4 mtW = vec4( transformed, 1.0 );
    vec3 mtN = objectNormal;
    #ifdef USE_INSTANCING
      mtW = instanceMatrix * mtW;
      mtN = mat3( instanceMatrix ) * mtN;
    #endif
    vMtP = ( modelMatrix * mtW ).xyz;
    vMtN = normalize( mat3( modelMatrix ) * mtN );
  }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", `varying vec3 vMtP;\nvarying vec3 vMtN;\n${glsl}\nvoid main() {`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
  diffuseColor.rgb *= mtVary( vMtP, normalize( vMtN ).y, distance( vMtP, cameraPosition ) );`,
      );
  };
  material.customProgramCacheKey = () => `${MARK}:${kind}`;
  material.needsUpdate = true;
  return material;
}

/**
 * Variation for a placed pack model. The pack's clones share materials with
 * the loaded scene (and the pieces share a palette), so each mesh gets its own
 * copy first and nothing else that uses the same material changes. Returns the
 * number of materials treated.
 */
export function varyModel(root: THREE.Object3D, kind: SurfaceKind): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const own = mats.map((m) => {
      if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.Material).transparent) return m;
      n++;
      return applySurfaceVariation(m.clone(), kind);
    });
    mesh.material = Array.isArray(mesh.material) ? own : own[0]!;
  });
  return n;
}
