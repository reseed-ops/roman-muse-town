import { expect, test } from "bun:test";
import * as THREE from "three";
import { retainSharedModel, SceneResources } from "./sceneResources";

function disposalCount(resource: THREE.EventDispatcher<{ dispose: {} }>) {
  let count = 0;
  resource.addEventListener("dispose", () => count++);
  return () => count;
}

test("disposes sprite textures, detached objects, and render targets once", () => {
  const scope = new SceneResources();
  const root = new THREE.Group();
  const texture = new THREE.Texture();
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  root.add(sprite);
  const target = scope.track(new THREE.WebGLRenderTarget());
  const counts = [disposalCount(texture), disposalCount(material), disposalCount(target)];
  scope.adopt(root);
  root.remove(sprite);
  scope.dispose();
  scope.dispose();
  expect(counts.map((count) => count())).toEqual([1, 1, 1]);
});

test("shared assets stay alive for other scenes and release GPU allocations after the last user", () => {
  const texture = new THREE.Texture();
  const model = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: texture }));
  const counts = [disposalCount(texture), disposalCount(model.material), disposalCount(model.geometry)];
  retainSharedModel(model);
  const first = new SceneResources();
  const second = new SceneResources();
  first.adopt(model.clone());
  second.adopt(model.clone());
  first.dispose();
  expect(counts.map((count) => count())).toEqual([0, 0, 0]);
  second.dispose();
  expect(counts.map((count) => count())).toEqual([1, 1, 1]);
  const next = new SceneResources();
  next.adopt(model.clone());
  expect(model.geometry.attributes.position?.count).toBeGreaterThan(0);
  expect(model.material.map).toBe(texture);
  next.dispose();
  expect(counts.map((count) => count())).toEqual([2, 2, 2]);
});

test("late loads are disposed immediately and cannot be attached", () => {
  const scope = new SceneResources();
  scope.dispose();
  const material = new THREE.MeshBasicMaterial({ map: new THREE.Texture() });
  const model = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const count = disposalCount(material);
  expect(scope.adopt(model)).toBe(false);
  expect(count()).toBe(1);
});

test("cleanup includes textures assigned after adoption and shader uniforms", () => {
  const scope = new SceneResources();
  const material = new THREE.ShaderMaterial({ uniforms: {} });
  const model = new THREE.Mesh(new THREE.BoxGeometry(), material);
  scope.adopt(model);
  const texture = new THREE.Texture();
  const count = disposalCount(texture);
  material.uniforms.surface = { value: texture };
  scope.dispose();
  expect(count()).toBe(1);
});
