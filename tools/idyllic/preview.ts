// Task 85: a browser preview of the Colosseum's corner, for Playwright screenshots.
// Real terrain (town.ts terrainHeight), the real slimmed GLBs, and the town's own
// placement data (client/src/colosseumSetting.ts), grounded as townScene's groundModel does.
// Built by tools/idyllic/preview.py; never shipped.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { COLOSSEUM_PLACEMENT, SETTING_PIECES, ROAD_END, type SettingAsset } from "../../client/src/colosseumSetting";
import { STREETS, terrainHeight } from "../../client/src/town";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "front";
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 720);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbcd4ea);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 1.0));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(-30, 50, 20);
sun.target.position.set(40, 0, 13);
sun.castShadow = true;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun, sun.target);

// terrain over the corner, flat meadow beyond the town's 112 m ground
const X0 = 8, X1 = 84, Z0 = -30, Z1 = 56, N = 150;
const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, N, N);
g.rotateX(-Math.PI / 2);
const pos = g.attributes.position as THREE.BufferAttribute;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i) + (X0 + X1) / 2, z = pos.getZ(i) + (Z0 + Z1) / 2;
  pos.setXYZ(i, x, terrainHeight(x, z), z);
}
g.computeVertexNormals();
const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x6f9a48, roughness: 1 }));
ground.receiveShadow = true;
scene.add(ground);
for (const path of STREETS) {
  const pts = path.map(([x, z]) => new THREE.Vector3(x, terrainHeight(x, z) + 0.08, z));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xb08a5a })));
}

const loader = new GLTFLoader();
async function place(asset: SettingAsset | string, o: { x: number; z: number; rotY: number; width?: number; height?: number; lift?: number; squashY?: number; pole?: number }) {
  const gltf = await loader.loadAsync(`./assets/${asset}.glb`);
  const inner = new THREE.Group();
  inner.add(gltf.scene);
  const wrap = new THREE.Group();
  wrap.add(inner);
  const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
  const s = o.height && size.y > 0.01 ? o.height / size.y : o.width && size.x > 0.01 ? o.width / size.x : 1;
  inner.scale.setScalar(s);
  const bb = new THREE.Box3().setFromObject(inner);
  const c = bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -bb.min.y, -c.z);
  wrap.position.set(o.x, terrainHeight(o.x, o.z) + (o.lift ?? 0), o.z);
  wrap.rotation.y = o.rotY;
  if (o.squashY) wrap.scale.y = o.squashY;
  if (o.pole) {
    // a vexillum: the pole stands, the banner hangs from its top
    inner.position.y += o.pole - 1.2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, o.pole, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 }));
    pole.position.y = o.pole / 2;
    wrap.add(pole);
  }
  wrap.traverse((m) => { if (m instanceof THREE.Mesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(wrap);
  return wrap;
}
const col = await place("colosseum", { ...COLOSSEUM_PLACEMENT });
if (params.get("compare")) {
  // the town's own banner (palette-textured at runtime) beside the pack's
  const palette = await new THREE.TextureLoader().loadAsync("./assets/palette.png");
  palette.flipY = false; palette.colorSpace = THREE.SRGBColorSpace;
  const town = await loader.loadAsync("./assets/banner_town.glb");
  town.scene.traverse((m) => { if (m instanceof THREE.Mesh) { const mm = m.material as THREE.MeshStandardMaterial; mm.map = palette; mm.color.setRGB(1, 1, 1); mm.needsUpdate = true; } });
  const bb = new THREE.Box3().setFromObject(town.scene); const k = 3.1 / (bb.max.y - bb.min.y);
  town.scene.scale.setScalar(k); town.scene.position.set(29, terrainHeight(29, 13) - bb.min.y * k, 13); scene.add(town.scene);
  await place("banner", { x: 29, z: 15.5, rotY: -Math.PI / 2, height: 1.3, lift: 1.9 });
  await place("banner", { x: 29, z: 16.8, rotY: -Math.PI / 2, height: 3.1, lift: 0 });
}
for (const p of SETTING_PIECES) await place(p.asset, p);
// the road's end marker
const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
marker.position.set(ROAD_END[0], terrainHeight(ROAD_END[0], ROAD_END[1]) + 1.5, ROAD_END[1]);
if (params.get("marker")) scene.add(marker);

const cam = new THREE.PerspectiveCamera(48, 1280 / 720, 0.1, 400);
const [cx, cz] = [COLOSSEUM_PLACEMENT.x, COLOSSEUM_PLACEMENT.z];
const V: Record<string, [number[], number[]]> = {
  rimN: [[40, 16, -18], [44, 2, 10]],
  rimS: [[36, 14, 40], [44, 2, 18]],
  // from the road, as a walker coming east
  front: [[22, 3.4, 4], [38, 3.5, 12]],
  walk: [[27, 2.0, 5.8], [36, 3.5, 10]],
  overview: [[8, 36, 40], [44, 0, 8]],
  north: [[44, 12, -22], [44, 2, 12]],
  south: [[40, 14, 48], [44, 2, 14]],
  stair: [[21, 2.8, 13], [31, 1.8, 13]],
  compare: [[22, 2.2, 15], [29, 1.8, 14.5]],
  east: [[75, 9, 10], [42, 3, 12]],
};
const [from, to] = V[view] ?? V.front!;
cam.position.set(from[0]!, from[1]!, from[2]!);
cam.lookAt(to[0]!, to[1]!, to[2]!);
renderer.render(scene, cam);
(window as unknown as { __done: boolean }).__done = true;
void col; void cx; void cz;
