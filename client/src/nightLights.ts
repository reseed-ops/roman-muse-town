// Night faces (Tasks 24 and 27; moved out of townScene.ts, Nov 8, 2026).
//
// The moon as a real light, soft and cool, from the moon's own bearing
// beyond the lake, raised to about 30 degrees so it reaches the ground
// and the trees; one warm lamp-coloured fill that keeps to the pair, set
// between them and the camera, short-ranged, so Aelia's and Gaius's
// faces stay warm and readable while the town keeps its night; and
// Aelia's pale toon skin, which under that fill washed flat white-grey,
// taking a warm tan multiply after dark (that also brings back the
// contrast of the eyes and mouth painted on her face texture). Neither
// light casts shadows: no harsh edges on a face, no extra shadow pass.
// Day is untouched.
import * as THREE from "three";

export const MOON_LIGHT_POS = new THREE.Vector3(-50, 62, -97);
export const MOON_LIGHT_MAX = 0.5;
export const FACE_FILL_MAX = 2.6;
export const NIGHT_SKIN_WARM = 0xe8b48c;

export type NightFrame = {
  nightMix: number;
  /** 0..1 each; the moon dims under rain or snow, and halves in fog. */
  rain: number;
  snow: number;
  fog: boolean;
  /** Where her head is aimed from: her group's position. */
  muse: THREE.Vector3;
  /** His group's position, and whether he is on foot (then the fill takes the pair's midpoint). */
  player: THREE.Vector3;
  walking: boolean;
  camera: THREE.Vector3;
};

export type NightLights = {
  moonLight: THREE.DirectionalLight;
  faceFill: THREE.PointLight;
  /** Her skin and face toon materials, remembered with their day colour. */
  collectNightSkin(root: THREE.Object3D): void;
  update(frame: NightFrame): void;
};

/** The day colour multiplied toward warm tan by the night's share. */
export function nightSkinColour(base: THREE.Color, nightMix: number, out = new THREE.Color()): THREE.Color {
  const warm = new THREE.Color(1, 1, 1).lerp(new THREE.Color(NIGHT_SKIN_WARM), Math.min(1, Math.max(0, nightMix)));
  return out.copy(base).multiply(warm);
}

export function createNightLights(scene: THREE.Object3D): NightLights {
  const moonLight = new THREE.DirectionalLight(0xb8ccff, 0);
  moonLight.position.copy(MOON_LIGHT_POS);
  scene.add(moonLight);
  const faceFill = new THREE.PointLight(0xffc796, 0, 6.5, 2);
  scene.add(faceFill);
  const aim = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const skin: { mat: THREE.MeshToonMaterial; base: THREE.Color }[] = [];
  let skinApplied = -1;
  return {
    moonLight,
    faceFill,
    collectNightSkin(root) {
      const seen = new Set<THREE.Material>();
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!(m instanceof THREE.MeshToonMaterial) || seen.has(m) || !/_(SKIN|FACE)(?![A-Za-z])/.test(m.name)) continue;
          seen.add(m);
          skin.push({ mat: m, base: m.color.clone() });
        }
      });
      skinApplied = -1;
    },
    update(f) {
      moonLight.intensity = f.nightMix * MOON_LIGHT_MAX * (1 - Math.min(1, f.rain + f.snow) * 0.6) * (f.fog ? 0.5 : 1);
      faceFill.intensity = f.nightMix * FACE_FILL_MAX;
      if (skin.length > 0 && Math.abs(f.nightMix - skinApplied) > 0.01) {
        skinApplied = f.nightMix;
        for (const n of skin) nightSkinColour(n.base, f.nightMix, n.mat.color);
      }
      if (f.nightMix <= 0.01) return;
      // Aim at her head, or at the pair's midpoint when he walks beside
      // her; the fill sits 1.6 m from that point toward the camera and a
      // little above, a lamp held at face height.
      aim.set(f.muse.x, f.muse.y + 1.55, f.muse.z);
      if (f.walking && f.player.distanceTo(f.muse) < 5) {
        aim.x = (aim.x + f.player.x) / 2;
        aim.z = (aim.z + f.player.z) / 2;
        aim.y = (aim.y + f.player.y + 1.6) / 2;
      }
      toCam.copy(f.camera).sub(aim);
      toCam.y = 0;
      if (toCam.lengthSq() < 1e-4) toCam.set(0, 0, 1);
      toCam.normalize();
      faceFill.position.copy(aim).addScaledVector(toCam, 1.6);
      faceFill.position.y += 0.45;
    },
  };
}
