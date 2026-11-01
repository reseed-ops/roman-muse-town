import { expect, test } from "bun:test";
import * as THREE from "three";
import { GraphicsQuality } from "./graphicsQuality";

test("automatic fallback followed by the UI update never recompiles materials", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  const ratios: number[] = [];
  const renderer = { setPixelRatio: (ratio: number) => { ratios.push(ratio); }, shadowMap: { enabled: true } };
  const quality = new GraphicsQuality(renderer, scene, 1.5, false);
  const initialVersion = material.version;
  expect(quality.set(true, false)).toBe(true);
  expect(quality.set(true)).toBe(false);
  expect(material.version).toBe(initialVersion);
  expect(renderer.shadowMap.enabled).toBe(false);
  expect(ratios).toEqual([1]);
  expect(quality.set(false)).toBe(true);
  expect(material.version).toBe(initialVersion + 1);
  expect(renderer.shadowMap.enabled).toBe(true);
  expect(ratios).toEqual([1, 1.5]);
});
