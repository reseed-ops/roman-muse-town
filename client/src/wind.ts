// The town wind (Nov 1, user-approved native build — no imported
// shader packs): a vertex-shader sway injected into the town's own
// foliage materials, driven by ONE town-wide wind state that follows
// the weather system. The displacement math lives here ONCE, as a
// pure function the probes can sample, and the GLSL chunk below
// implements exactly the same formula, so what is verified in
// numbers is what blows through the trees.
//
// Shape of the sway, in both implementations:
//   worldPos  — the vertex's world position (phase varies by WORLD
//               position, so merged/instanced trees never sway in
//               lockstep);
//   heightW   — pow(clamp((localY - base) / refHeight, 0, 1), 1.4):
//               ZERO at the trunk base / ground, growing toward the
//               crown, so roots never slide;
//   gust      — a slow sine over world position and time;
//   front     — a second sine that TRAVELS along the wind direction
//               (gust fronts; weighted in as the weather worsens);
//   flutter   — a faster, smaller leaf ripple;
//   disp      — maxAmp(state) × kindAmp(kind) × heightW ×
//               (0.85 × gustMix + 0.15 × flutter), applied along the
//               wind direction. The 0.85/0.15 split makes maxAmp a
//               true cap: |disp| ≤ maxAmp × kindAmp at the crown.

import * as THREE from "three";
import type { WeatherId } from "./town";

export type WindState = "calm" | "breeze" | "rain" | "storm";
export type WindKind =
  | "willow"
  | "tree"
  | "townTree"
  | "bush"
  | "grass"
  | "flower"
  | "crop";

export interface WindStateParams {
  /** Crown displacement cap, in metres, for a kindAmp-1 plant. */
  maxAmp: number;
  gustSpeed: number;
  flutterSpeed: number;
  /** How much of the gust is the travelling front (0 = standing gust). */
  frontWeight: number;
}

export const WIND_STATES: Record<WindState, WindStateParams> = {
  calm: { maxAmp: 0.035, gustSpeed: 0.5, flutterSpeed: 1.2, frontWeight: 0 },
  breeze: { maxAmp: 0.13, gustSpeed: 0.8, flutterSpeed: 2.0, frontWeight: 0.25 },
  rain: { maxAmp: 0.24, gustSpeed: 1.1, flutterSpeed: 2.6, frontWeight: 0.45 },
  storm: { maxAmp: 0.4, gustSpeed: 1.5, flutterSpeed: 3.4, frontWeight: 0.7 },
};

/** Per-kind amplitude and the local-height span the height weight
 *  reads (base = the local Y of the plant's foot, refHeight = the
 *  local Y span up to its crown). The Town Tree's amp is the
 *  smallest of any large tree on purpose: rooted and monumental, a
 *  barely-there breathing at its crown only. */
export const WIND_KINDS: Record<WindKind, { amp: number; baseY: number; refHeight: number }> = {
  willow: { amp: 1.6, baseY: 0, refHeight: 3.2 },
  tree: { amp: 1.0, baseY: 0, refHeight: 3.2 },
  townTree: { amp: 0.35, baseY: 0, refHeight: 3.2 },
  bush: { amp: 0.45, baseY: 0, refHeight: 0.9 },
  grass: { amp: 0.55, baseY: 0, refHeight: 0.42 },
  flower: { amp: 0.6, baseY: -0.13, refHeight: 0.3 },
  crop: { amp: 0.5, baseY: -0.21, refHeight: 0.42 },
};

/** The weather system owns the wind: one state per weather spell. */
export function windStateForWeather(id: WeatherId | string): WindState {
  switch (id) {
    case "storm":
      return "storm";
    case "rain":
      return "rain";
    case "breezy":
    case "rainbow":
    case "sparkles":
    case "snow":
      return "breeze";
    default:
      return "calm";
  }
}

export function windHeightWeight(localY: number, kind: WindKind): number {
  const k = WIND_KINDS[kind];
  const t = Math.min(1, Math.max(0, (localY - k.baseY) / k.refHeight));
  return Math.pow(t, 1.4);
}

/** The pure displacement: exactly the GLSL formula. Returns the
 *  world-space offset (metres) for one vertex. */
export function sampleWindDisplacement(opts: {
  localY: number;
  worldX: number;
  worldZ: number;
  time: number;
  kind: WindKind;
  state: WindState;
  dirX: number;
  dirZ: number;
}): { x: number; z: number; scalar: number } {
  const p = WIND_STATES[opts.state];
  const k = WIND_KINDS[opts.kind];
  const hw = windHeightWeight(opts.localY, opts.kind);
  const spatial = opts.worldX * 0.13 + opts.worldZ * 0.09;
  const gust = 0.55 + 0.45 * Math.sin(opts.time * p.gustSpeed + spatial);
  const front =
    0.5 +
    0.5 *
      Math.sin(
        (opts.worldX * opts.dirX + opts.worldZ * opts.dirZ) * 0.16 -
          opts.time * p.gustSpeed * 1.7 +
          spatial * 0.35,
      );
  const gustMix = gust * (1 - p.frontWeight) + front * p.frontWeight;
  const flutter = Math.sin(opts.time * p.flutterSpeed + opts.worldX * 1.7 + opts.worldZ * 1.3);
  const scalar = p.maxAmp * k.amp * hw * (gustMix * 0.85 + flutter * 0.15);
  return { x: opts.dirX * scalar, z: opts.dirZ * scalar, scalar };
}

// --- The shared uniform driver -------------------------------------
// One set of uniform objects shared by every windified material, so
// a frame update touches a handful of values, not a registry. The
// per-spell targets are set when the weather changes; the live
// values ease toward them in step with the weather engine's own
// easing, and the direction turns by the shortest arc.

interface NumUniform {
  value: number;
}
interface Vec2Uniform {
  value: THREE.Vector2;
}

export const windUniforms = {
  uWindTime: { value: 0 } as NumUniform,
  uWindMaxAmp: { value: WIND_STATES.calm.maxAmp } as NumUniform,
  uWindGustSpeed: { value: WIND_STATES.calm.gustSpeed } as NumUniform,
  uWindFlutterSpeed: { value: WIND_STATES.calm.flutterSpeed } as NumUniform,
  uWindFrontWeight: { value: WIND_STATES.calm.frontWeight } as NumUniform,
  uWindDir: { value: new THREE.Vector2(1, 0) } as Vec2Uniform,
};

const windCur: WindStateParams & { dirAngle: number } = {
  ...WIND_STATES.calm,
  dirAngle: 0.6,
};
const windTarget: WindStateParams & { dirAngle: number } = {
  ...WIND_STATES.calm,
  dirAngle: 0.6,
};
let windSpellCount = 0;
let windStateNow: WindState = "calm";

export function currentWindState(): WindState {
  return windStateNow;
}

/** A new weather spell begins: pick its state and its ONE town-wide
 *  direction (the golden-angle step keeps successive spells from
 *  repeating a heading). Called only from the weather setter, so
 *  the wind changes when the weather changes — and the Day/Night
 *  and weather toggles, which route through that setter, carry the
 *  wind with the weather they show. */
export function setTownWindSpell(state: WindState): void {
  windStateNow = state;
  windSpellCount += 1;
  const p = WIND_STATES[state];
  windTarget.maxAmp = p.maxAmp;
  windTarget.gustSpeed = p.gustSpeed;
  windTarget.flutterSpeed = p.flutterSpeed;
  windTarget.frontWeight = p.frontWeight;
  windTarget.dirAngle = 0.6 + windSpellCount * 2.399963;
}

/** Ease the live wind toward the spell's targets and publish the
 *  uniforms. dt in seconds, time the scene's elapsed clock. */
export function updateTownWind(dt: number, time: number): void {
  const k = Math.min(1, dt * 0.55);
  windCur.maxAmp += (windTarget.maxAmp - windCur.maxAmp) * k;
  windCur.gustSpeed += (windTarget.gustSpeed - windCur.gustSpeed) * k;
  windCur.flutterSpeed += (windTarget.flutterSpeed - windCur.flutterSpeed) * k;
  windCur.frontWeight += (windTarget.frontWeight - windCur.frontWeight) * k;
  let d = (windTarget.dirAngle - windCur.dirAngle) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  windCur.dirAngle += d * k;
  windUniforms.uWindTime.value = time;
  windUniforms.uWindMaxAmp.value = windCur.maxAmp;
  windUniforms.uWindGustSpeed.value = windCur.gustSpeed;
  windUniforms.uWindFlutterSpeed.value = windCur.flutterSpeed;
  windUniforms.uWindFrontWeight.value = windCur.frontWeight;
  windUniforms.uWindDir.value.set(Math.cos(windCur.dirAngle), Math.sin(windCur.dirAngle));
}

// --- The shader injection -------------------------------------------
// Vertex-only and cheap: a handful of sines per vertex, no textures,
// no extra draws, no per-frame CPU cost beyond the uniform driver
// above. Characters, animals, water, and buildings never receive
// it — only the foliage materials named at the call sites.

const WIND_BEGIN = /* glsl */ `
#include <begin_vertex>
vec4 twWorld4 = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
twWorld4 = instanceMatrix * twWorld4;
#endif
twWorld4 = modelMatrix * twWorld4;
vec3 twWorld = twWorld4.xyz;
float twHw = pow(clamp((position.y - uWindBase) / uWindRef, 0.0, 1.0), 1.4);
float twSpatial = twWorld.x * 0.13 + twWorld.z * 0.09;
float twGust = 0.55 + 0.45 * sin(uWindTime * uWindGustSpeed + twSpatial);
float twFront = 0.5 + 0.5 * sin(dot(twWorld.xz, uWindDir) * 0.16 - uWindTime * uWindGustSpeed * 1.7 + twSpatial * 0.35);
float twMix = mix(twGust, twFront, uWindFrontWeight);
float twFlutter = sin(uWindTime * uWindFlutterSpeed + twWorld.x * 1.7 + twWorld.z * 1.3);
float twDisp = uWindMaxAmp * uWindKindAmp * twHw * (twMix * 0.85 + twFlutter * 0.15);
`;

const WIND_PROJECT = /* glsl */ `
vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
vec3 twViewDir = (viewMatrix * vec4(uWindDir.x, 0.0, uWindDir.y, 0.0)).xyz;
mvPosition.xyz += twViewDir * twDisp;
gl_Position = projectionMatrix * mvPosition;
`;

/** Inject the town wind into one foliage material. Idempotent per
 *  material instance (a WeakSet guards re-entry), and each kind
 *  gets its own program cache key so kinds never share a program
 *  with the wrong per-kind uniforms. */
const windified = new WeakSet<object>();
export function applyWindToMaterial<T extends THREE.Material>(material: T, kind: WindKind): T {
  if (windified.has(material)) return material;
  windified.add(material);
  const k = WIND_KINDS[kind];
  const kindAmp = { value: k.amp };
  const baseY = { value: k.baseY };
  const refHeight = { value: k.refHeight };
  // Assigned outright, never chained: a material cloned from an
  // already-windified one must end up with exactly ONE injection
  // (the chunk replaces its own #include markers, so a second pass
  // would redeclare its variables and break the program). None of
  // the town's foliage materials carry any other onBeforeCompile.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.uniforms.uWindMaxAmp = windUniforms.uWindMaxAmp;
    shader.uniforms.uWindGustSpeed = windUniforms.uWindGustSpeed;
    shader.uniforms.uWindFlutterSpeed = windUniforms.uWindFlutterSpeed;
    shader.uniforms.uWindFrontWeight = windUniforms.uWindFrontWeight;
    shader.uniforms.uWindDir = windUniforms.uWindDir;
    shader.uniforms.uWindKindAmp = kindAmp;
    shader.uniforms.uWindBase = baseY;
    shader.uniforms.uWindRef = refHeight;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uWindTime;
uniform float uWindMaxAmp;
uniform float uWindGustSpeed;
uniform float uWindFlutterSpeed;
uniform float uWindFrontWeight;
uniform vec2 uWindDir;
uniform float uWindKindAmp;
uniform float uWindBase;
uniform float uWindRef;`,
      )
      .replace("#include <begin_vertex>", WIND_BEGIN)
      .replace("#include <project_vertex>", WIND_PROJECT);
  };
  material.customProgramCacheKey = () => `town-wind:${kind}`;
  return material;
}
