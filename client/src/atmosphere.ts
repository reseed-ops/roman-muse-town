// Task 109: the town's atmosphere, after the O'Neill cylinder's recipe,
// translated to Three.js. Two pieces, both installed once by overriding
// three's own shader chunks (so every material, wind or sea injection
// included, gets them without being touched):
//
//   1. Sun-aware haze. The fog keeps its near/far (weather and night still
//      drive those) but its colour and thickness lean on how directly the
//      view looks at the sun: a Henyey-Greenstein forward-scattering phase
//      warms and thickens the haze toward the sun, and cools and thins it
//      away from it. The sun is the scene's first directional light (the
//      shadow caster), so the strength follows its colour times intensity:
//      noon is full, dusk warms it, night, rain and fog weather quiet it.
//   2. A filmic grade before ACES: white balance, a gamma pivoted at middle
//      grey (0.18), and a luminance tint (shadows cool, highlights warm).
//
// Each piece has a plain-TS twin (hazeAt, grade) written from the same
// constants the GLSL is built from, so the tests can measure what the shader
// does without a GPU.
import * as THREE from "three";

// ---------------------------------------------------------------- haze
export const HAZE = {
  /** Henyey-Greenstein asymmetry: 0 is even, toward 1 is a tight glow around the sun. */
  g: 0.5,
  /** The phase is 4 pi normalised; w = hg / (hg + K) maps it to 0..1 (about 0.1 behind, 0.75 into the sun). */
  k: 2.0,
  /** w below / above these is "away from" / "into" the sun. */
  wBack: 0.1,
  wFwd: 0.75,
  /** Extra thickness into the sun, and the thinning away from it, at full sun. */
  denseFwd: 0.5,
  thinBack: 0.12,
  /** The haze colour multiplied onto the fog colour: warm into the sun, cool away from it. */
  warm: [1.1, 0.96, 0.78] as const,
  cool: [0.93, 0.98, 1.06] as const,
  /** Sun colour*intensity luminance that counts as "no sun" and as "full sun". */
  sunLo: 0.25,
  sunHi: 1.4,
  /** The share of the tint kept at a fully fogged pixel, so the far sea still meets the sky dome (Task 96). */
  farKeep: 0.12,
  /** The fog factor over which the tint fades from full to farKeep: gone well before the far plane, so no warm line shows at the horizon. */
  keepFrom: 0.3,
  keepTo: 0.9,
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Henyey-Greenstein, 4 pi normalised (1 for an even scatterer), cosine of the angle between view and sun. */
export function henyeyGreenstein(cosTheta: number, g: number = HAZE.g): number {
  return (1 - g * g) / Math.pow(1 + g * g - 2 * g * cosTheta, 1.5);
}

/** 0 looking away from the sun .. 1 looking into it. */
export function sunSide(cosTheta: number): number {
  const hg = henyeyGreenstein(cosTheta);
  const w = hg / (hg + HAZE.k);
  return clamp01((w - HAZE.wBack) / (HAZE.wFwd - HAZE.wBack));
}

/** 0 (no sun) .. 1 (full sun) from the sun light's colour times intensity, as a luminance. */
export function sunStrength(lum: number): number {
  return smooth(HAZE.sunLo, HAZE.sunHi, lum);
}

export interface HazeSample {
  /** The new fog factor, from the plain one. */
  factor: number;
  /** Multiplier for the fog colour. */
  tint: [number, number, number];
}

/** What the shader does to the fog at one pixel. `baseFactor` is the plain near/far fog (0..1). */
export function hazeAt(baseFactor: number, cosTheta: number, sunLum: number): HazeSample {
  const side = sunSide(cosTheta);
  const sun = sunStrength(sunLum);
  const factor = clamp01(baseFactor * (1 + sun * (HAZE.denseFwd * side - HAZE.thinBack * (1 - side))));
  const keep = 1 - (1 - HAZE.farKeep) * smooth(HAZE.keepFrom, HAZE.keepTo, baseFactor);
  const amt = sun * keep;
  const tint = [0, 1, 2].map((i) => 1 + amt * (HAZE.cool[i]! + (HAZE.warm[i]! - HAZE.cool[i]!) * side - 1)) as [number, number, number];
  return { factor, tint };
}

const f = (x: number) => x.toFixed(4);
const v3 = (a: readonly number[]) => `vec3(${a.map(f).join(", ")})`;

export function hazeFogFragment(): string {
  return /* glsl */ `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		vec3 hazeColor = fogColor;
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		vec3 hazeColor = fogColor;
		#if ( defined( STANDARD ) || defined( PHONG ) || defined( LAMBERT ) ) && NUM_DIR_LIGHTS > 0
		{
			float hzC = dot( normalize( vFogDir ), directionalLights[ 0 ].direction );
			float hzG = ${f(HAZE.g)};
			float hzHg = ( 1.0 - hzG * hzG ) / pow( 1.0 + hzG * hzG - 2.0 * hzG * hzC, 1.5 );
			float hzW = hzHg / ( hzHg + ${f(HAZE.k)} );
			float hzSide = clamp( ( hzW - ${f(HAZE.wBack)} ) / ${f(HAZE.wFwd - HAZE.wBack)}, 0.0, 1.0 );
			vec3 hzCol = directionalLights[ 0 ].color;
			float hzSun = smoothstep( ${f(HAZE.sunLo)}, ${f(HAZE.sunHi)}, dot( hzCol, vec3( 0.2126, 0.7152, 0.0722 ) ) );
			float hzKeep = 1.0 - ${f(1 - HAZE.farKeep)} * smoothstep( ${f(HAZE.keepFrom)}, ${f(HAZE.keepTo)}, fogFactor );
			fogFactor = clamp( fogFactor * ( 1.0 + hzSun * ( ${f(HAZE.denseFwd)} * hzSide - ${f(HAZE.thinBack)} * ( 1.0 - hzSide ) ) ), 0.0, 1.0 );
			hazeColor *= vec3( 1.0 ) + hzSun * hzKeep * ( mix( ${v3(HAZE.cool)}, ${v3(HAZE.warm)}, hzSide ) - vec3( 1.0 ) );
		}
		#endif
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, hazeColor, fogFactor );
#endif
`;
}

export const hazeFogParsVertex = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogDir;
#endif
`;
export const hazeFogVertex = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogDir = mvPosition.xyz;
#endif
`;
export const hazeFogParsFragment = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogDir;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
`;

// ---------------------------------------------------------------- filmic
export const FILMIC = {
  /** Warm white balance, a few percent: a little more red, a little less blue. */
  whiteBalance: [1.03, 1.0, 0.955] as const,
  /** Gamma pivoted at middle grey: above 1 adds a touch of contrast around 0.18. */
  gamma: 1.04,
  pivot: 0.18,
  /** Luminance tint: shadows cool, highlights warm (multipliers). */
  shadowTint: [0.97, 0.99, 1.03] as const,
  highlightTint: [1.03, 1.0, 0.96] as const,
  /** Luminance range over which the tint passes from shadow to highlight. */
  tintLo: 0.05,
  tintHi: 0.9,
} as const;

/** The grade the shader runs on linear colour just before ACES (no GPU needed to read it). */
export function grade(rgb: readonly [number, number, number]): [number, number, number] {
  const wb = rgb.map((c, i) => Math.max(c, 0) * FILMIC.whiteBalance[i]!) as [number, number, number];
  const pv = wb.map((c) => FILMIC.pivot * Math.pow(Math.max(c, 1e-5) / FILMIC.pivot, FILMIC.gamma)) as [number, number, number];
  const lum = 0.2126 * pv[0] + 0.7152 * pv[1] + 0.0722 * pv[2];
  const t = smooth(FILMIC.tintLo, FILMIC.tintHi, lum);
  return pv.map((c, i) => c * (FILMIC.shadowTint[i]! + (FILMIC.highlightTint[i]! - FILMIC.shadowTint[i]!) * t)) as [number, number, number];
}

export function filmicToneParsFragment(): string {
  return /* glsl */ `
vec3 mtGrade( vec3 c ) {
	c = max( c, vec3( 0.0 ) ) * ${v3(FILMIC.whiteBalance)};
	c = ${f(FILMIC.pivot)} * pow( max( c, vec3( 1e-5 ) ) / ${f(FILMIC.pivot)}, vec3( ${f(FILMIC.gamma)} ) );
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	return c * mix( ${v3(FILMIC.shadowTint)}, ${v3(FILMIC.highlightTint)}, smoothstep( ${f(FILMIC.tintLo)}, ${f(FILMIC.tintHi)}, l ) );
}
`;
}

export const filmicToneFragment = /* glsl */ `
#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( mtGrade( gl_FragColor.rgb ) );
#endif
`;

// ---------------------------------------------------------------- install
let installed = false;
const original: Record<string, string> = {};

/** Override the fog and tone-mapping chunks. Idempotent; call before the first material compiles. */
export function installAtmosphere(): void {
  if (installed) return;
  installed = true;
  const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
  for (const k of ["fog_pars_vertex", "fog_vertex", "fog_pars_fragment", "fog_fragment", "tonemapping_pars_fragment", "tonemapping_fragment"]) original[k] = chunks[k]!;
  chunks.fog_pars_vertex = hazeFogParsVertex;
  chunks.fog_vertex = hazeFogVertex;
  chunks.fog_pars_fragment = hazeFogParsFragment;
  chunks.fog_fragment = hazeFogFragment();
  chunks.tonemapping_pars_fragment = original.tonemapping_pars_fragment + filmicToneParsFragment();
  chunks.tonemapping_fragment = filmicToneFragment;
}

/** Put three's own chunks back (tests). */
export function uninstallAtmosphere(): void {
  if (!installed) return;
  installed = false;
  const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
  for (const k of Object.keys(original)) chunks[k] = original[k]!;
}
