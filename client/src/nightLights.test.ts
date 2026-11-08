import { expect, test } from "bun:test";
import * as THREE from "three";
import { createNightLights, FACE_FILL_MAX, MOON_LIGHT_MAX, nightSkinColour } from "./nightLights";

const frame = (over: Partial<Parameters<ReturnType<typeof createNightLights>["update"]>[0]> = {}) => ({
  nightMix: 1,
  rain: 0,
  snow: 0,
  fog: false,
  muse: new THREE.Vector3(0, 0, 0),
  player: new THREE.Vector3(2, 0, 0),
  walking: true,
  camera: new THREE.Vector3(1, 1.7, 6),
  ...over,
});

test("by day both night lights are dark; at night they come up, the moon dimmed by weather", () => {
  const lights = createNightLights(new THREE.Scene());
  lights.update(frame({ nightMix: 0 }));
  expect(lights.moonLight.intensity).toBe(0);
  expect(lights.faceFill.intensity).toBe(0);
  lights.update(frame());
  expect(lights.moonLight.intensity).toBeCloseTo(MOON_LIGHT_MAX);
  expect(lights.faceFill.intensity).toBeCloseTo(FACE_FILL_MAX);
  lights.update(frame({ rain: 1 }));
  expect(lights.moonLight.intensity).toBeCloseTo(MOON_LIGHT_MAX * 0.4);
  lights.update(frame({ fog: true }));
  expect(lights.moonLight.intensity).toBeCloseTo(MOON_LIGHT_MAX * 0.5);
});

test("the warm fill sits between the pair and the camera, at face height", () => {
  const lights = createNightLights(new THREE.Scene());
  lights.update(frame());
  const p = lights.faceFill.position;
  // The pair's midpoint is x 1; the camera is straight ahead along +z.
  expect(p.x).toBeCloseTo(1);
  expect(p.z).toBeCloseTo(1.6);
  expect(p.y).toBeGreaterThan(1.5);
  // Alone (he is not walking), it aims at her.
  lights.update(frame({ walking: false, camera: new THREE.Vector3(0, 1.7, 6) }));
  expect(lights.faceFill.position.x).toBeCloseTo(0);
});

test("her skin takes the warm multiply by the night's share, and only her skin and face", () => {
  const base = new THREE.Color(0xf7e6d8);
  expect(nightSkinColour(base, 0).getHex()).toBe(base.getHex());
  const night = nightSkinColour(base, 1);
  expect(night.b).toBeLessThan(base.b);
  expect(night.r).toBeLessThanOrEqual(base.r);
  const lights = createNightLights(new THREE.Scene());
  const skinMat = new THREE.MeshToonMaterial({ color: 0xf7e6d8 });
  skinMat.name = "N00_000_00_Body_00_SKIN (Instance)";
  const clothMat = new THREE.MeshToonMaterial({ color: 0xffffff });
  clothMat.name = "N00_001_01_Tops_01_CLOTH (Instance)";
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), [skinMat, clothMat]));
  lights.collectNightSkin(root);
  lights.update(frame());
  expect(skinMat.color.getHex()).toBe(night.getHex());
  expect(clothMat.color.getHex()).toBe(0xffffff);
  lights.update(frame({ nightMix: 0 }));
  expect(skinMat.color.getHex()).toBe(base.getHex());
});

test("the moonlight follows the true moon: from its bearing, by its phase, gone while it is down", () => {
  const lights = createNightLights(new THREE.Scene());
  lights.update(frame({ moon: { elev: 40, azim: 90, illuminated: 1 } }));
  expect(lights.moonLight.intensity).toBeCloseTo(MOON_LIGHT_MAX);
  expect(lights.moonLight.position.x).toBeGreaterThan(50); // east
  lights.update(frame({ moon: { elev: 40, azim: 90, illuminated: 0 } }));
  expect(lights.moonLight.intensity).toBeCloseTo(MOON_LIGHT_MAX * 0.3);
  lights.update(frame({ moon: { elev: -10, azim: 90, illuminated: 1 } }));
  expect(lights.moonLight.intensity).toBe(0);
});
