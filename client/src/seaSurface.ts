// The sea's surface on the GPU (Task 102). All the wave math is seaWaves.ts;
// this file is the only place it meets Three.js, in ONE function,
// `installSeaWaves`, which moves a material's vertices to the wave surface
// (and its normals with them). When the town ports to WebGPU (Task 101) that
// function is the whole of the wave port: a TSL node doing the same
// `seaWave` call. Nothing else in the sea code knows how the waves are drawn.
import * as THREE from "three";
import { seaWaveGLSL } from "./seaWaves";

/** The wave clock, seconds; one object shared by every material that has the waves installed. */
const seaTime = { value: 0 };
export const setSeaTime = (t: number) => {
  seaTime.value = t;
};

const WAVE_FN = seaWaveGLSL();

/**
 * Give `material` the waves: its vertices (any mesh, any rigid transform, any size) are lifted and
 * shoved to where the sea's surface is at their world position, and the normal follows. The mesh
 * needs enough vertices to carry the waves (see `seaGridGeometry`). `shadeFromBelow` also brightens
 * the surface by its slope, for the sheet seen from underneath, which has no lighting of its own.
 */
export function installSeaWaves(material: THREE.Material, opts: { shadeFromBelow?: boolean } = {}): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSeaTime = seaTime;
    const shade = !!opts.shadeFromBelow;
    shader.vertexShader = shader.vertexShader
      .replace(
        "void main() {",
        `uniform float uSeaTime;\n${shade ? "varying float vSeaShade;\n" : ""}${WAVE_FN}
void main() {`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
  {
    vec3 seaD; vec3 seaN;
    seaWave((modelMatrix * vec4(position, 1.0)).xz, uSeaTime, seaD, seaN);
    objectNormal = transpose(mat3(modelMatrix)) * seaN;
  }`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
  {
    vec3 seaD; vec3 seaN;
    seaWave((modelMatrix * vec4(position, 1.0)).xz, uSeaTime, seaD, seaN);
    transformed += transpose(mat3(modelMatrix)) * seaD;
    ${shade ? "vSeaShade = clamp(0.8 + 6.0 * (1.0 - seaN.y) + 0.5 * seaD.y, 0.45, 1.5);" : ""}
  }`,
      );
    if (shade) {
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", "varying float vSeaShade;\nvoid main() {")
        .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb *= vSeaShade;");
    }
  };
  material.customProgramCacheKey = () => `sea-waves-${opts.shadeFromBelow ? "below" : "above"}`;
}

/** Axis coordinates: `inner` metres apart over [a, b], then growing steps out to [lo, hi]. */
function axis(lo: number, a: number, b: number, hi: number, inner: number): number[] {
  const out: number[] = [];
  const n = Math.max(1, Math.round((b - a) / inner));
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  let step = inner * 1.5;
  for (let v = a - step; v > lo; v -= step, step *= 1.5) out.unshift(v);
  out.unshift(lo);
  step = inner * 1.5;
  for (let v = b + step; v < hi; v += step, step *= 1.5) out.push(v);
  out.push(hi);
  return out;
}

/**
 * The sea's grid, in world x/z at height `y`: fine (3 m) where anyone stands or swims, coarser
 * and coarser out to the horizon, about 18 000 vertices. Indexed, upward facing.
 */
export function seaGridGeometry(y: number): THREE.BufferGeometry {
  const xs = axis(-1200, -240, 240, 1200, 3);
  const zs = axis(-900, 40, 290, 1500, 3);
  const nx = xs.length;
  const nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const o = (j * nx + i) * 3;
      pos[o] = xs[i]!;
      pos[o + 1] = y;
      pos[o + 2] = zs[j]!;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let q = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // Counter-clockwise seen from above (+y): a, c, b and b, c, d.
      idx.set([a, c, b, b, c, d], q);
      q += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(Float32Array.from({ length: nx * nz * 3 }, (_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const uv = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      uv[(j * nx + i) * 2] = (xs[i]! + 1200) / 2400;
      uv[(j * nx + i) * 2 + 1] = 1 - (zs[j]! + 900) / 2400;
    }
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  // Waves lift the sea by under a metre: a box with room to spare, so it is never culled wrongly.
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-1200, y - 2, -900), new THREE.Vector3(1200, y + 2, 1500));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, y, 300), 1600);
  return geo;
}
