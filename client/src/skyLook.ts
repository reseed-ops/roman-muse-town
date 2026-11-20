// Task 96 (Task 89 audit fixes #1 and #4): the few constants that decide
// whether light stone reads warm or clips to chalk, and the fog colour that
// closes the seam where the sea meets the sky.
import * as THREE from "three";
import { OCEAN_NIGHT } from "./seaCliff";

/** Task 96: was 1.12. ACES at 1.12 plus hemisphere, sun and environment pushed travertine and marble to chalk. */
export const TONE_EXPOSURE = 0.92;
/** Day levels of the light rig (the night and weather terms are applied by the scene). Were 0.95 / 1.9 / 0.35. */
export const HEMI_DAY = 0.74;
/** Night takes this much off the day hemisphere light (Task 126: was 0.55, so night ambient was 0.19; now 0.54). */
export const HEMI_NIGHT_DROP = 0.2;
export const SUN_DAY = 1.7;
export const ENV_DAY = 0.26;

/**
 * The sky dome's shader writes its uniform straight to the screen: no sRGB
 * encode, no tone mapping. A uniform colour is stored linear, so the dome
 * shows those linear numbers as if they were sRGB, darker and more saturated
 * than the same colour on a lit, fogged surface. Fog must therefore use the
 * colour the dome DISPLAYS at the horizon: the same numbers read as sRGB.
 */
export function domeDisplayedHorizon(horizonUniform: THREE.Color, out = new THREE.Color()): THREE.Color {
  return out.setRGB(horizonUniform.r, horizonUniform.g, horizonUniform.b, THREE.SRGBColorSpace);
}

/** The sea takes its full night colour (it was a 0.8 blend toward a near-black). */
export const SEA_NIGHT_BLEND = 1;
/**
 * The far sea is all fog, so the sea's own colour cannot show at the horizon:
 * at night the fog leans toward the sea's night colour (a dark sea under the
 * sky's lighter glow) instead of matching the sky and swallowing the sea.
 */
export const SEA_FOG_NIGHT = 0.9;

/** The scene fog's colour: the dome's displayed horizon by day, leaning to the sea's night colour as darkness comes. */
export function seaFogColor(horizonUniform: THREE.Color, nightMix: number, out = new THREE.Color()): THREE.Color {
  domeDisplayedHorizon(horizonUniform, out);
  return out.lerp(_sea.setHex(OCEAN_NIGHT), SEA_FOG_NIGHT * Math.min(1, Math.max(0, nightMix)));
}
const _sea = new THREE.Color();

/** Travertine, the warm multiplier for a pack piece whose own colour is near white. */
export const WARM_STONE_TINT = 0xe6d2ae;

/**
 * Warm a model's stone in place. The pack's clones share materials with the
 * loaded scene, so each mesh gets its own copy first; nothing else that uses
 * the same model changes. Returns the number of materials tinted.
 */
export function warmStone(root: THREE.Object3D, tint = WARM_STONE_TINT): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const own = mats.map((m) => {
      const c = m.clone() as THREE.MeshStandardMaterial;
      if (c.color) {
        c.color.multiply(new THREE.Color(tint));
        n++;
      }
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? own : own[0]!;
  });
  return n;
}

/** Task 105: the lake's day ripple strength and roughness (unchanged), and what they ease to at full night. */
export const LAKE_RIPPLE_DAY = 0.4;
export const LAKE_RIPPLE_NIGHT = 0.1;
export const LAKE_ROUGH_DAY = 0.14;
export const LAKE_ROUGH_NIGHT = 0.4;

/**
 * Task 105: the lake's ripples flatten as night falls. Against a dark sky the
 * moonlit ripple facets read as bold parallel bands on a bright phone GPU;
 * a weaker normal and a rougher surface spread the specular instead.
 * nightMix 0 (day) returns exactly the original 0.4 / 0.14.
 */
export function lakeRipple(nightMix: number): { normalScale: number; roughness: number } {
  const k = Math.min(1, Math.max(0, nightMix));
  return {
    normalScale: LAKE_RIPPLE_DAY + (LAKE_RIPPLE_NIGHT - LAKE_RIPPLE_DAY) * k,
    roughness: LAKE_ROUGH_DAY + (LAKE_ROUGH_NIGHT - LAKE_ROUGH_DAY) * k,
  };
}

/** Applies lakeRipple to the lake's material (the one owner of its ripple strength). */
export function applyLakeRipple(m: { normalScale: { set(x: number, y: number): unknown }; roughness: number }, nightMix: number): void {
  const r = lakeRipple(nightMix);
  m.normalScale.set(r.normalScale, r.normalScale);
  m.roughness = r.roughness;
}
