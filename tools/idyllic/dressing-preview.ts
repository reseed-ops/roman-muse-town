// Task 86: a browser preview of the statues and the market dressing, for Playwright screenshots.
// The real terrain (town.ts), the real slimmed GLBs, the town's own placement data
// (client/src/idyllicDressing.ts), grounded as townScene's groundModel does, beside the code-built
// temple, Lucretia and domus so the style can be judged. Built by tools/idyllic/dressing-preview.py; never shipped.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRESSING_FILES, DRESSING_PIECES, STALL_CRATES, boothPoint } from "../../client/src/idyllicDressing";
import { ATHENA_TEMPLE, LUCRETIA, HOME, terrainHeight } from "../../client/src/town";
import { MARKET_BOOTHS } from "../../client/src/layout";
import { buildAthenaTemple, buildLucretia } from "../../client/src/tributes";
import { buildHomeHouse } from "../../client/src/homeHouse";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "temple";
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 720);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbcd4ea);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 1.0));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(-20, 50, 30);
sun.castShadow = true;
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const X0 = -50, X1 = 20, Z0 = -14, Z1 = 50, N = 140;
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

const loader = new GLTFLoader();
async function ground_(url: string, o: { x: number; z: number; y?: number; rotY?: number; width?: number; height?: number }, parent: THREE.Object3D = scene) {
  const gltf = await loader.loadAsync(url);
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
  wrap.position.set(o.x, o.y ?? 0, o.z);
  wrap.rotation.y = o.rotY ?? 0;
  wrap.traverse((m) => { if (m instanceof THREE.Mesh) { m.castShadow = true; m.receiveShadow = true; } });
  parent.add(wrap);
  return wrap;
}

// the code-built neighbours
const lucretia = buildLucretia(terrainHeight(LUCRETIA.position[0], LUCRETIA.position[1])).group;
const temple = buildAthenaTemple(terrainHeight(ATHENA_TEMPLE.position[0], ATHENA_TEMPLE.position[1])).group;
const home = buildHomeHouse(terrainHeight);
scene.add(lucretia, temple, home.group);
// the stalls and their crates (roman pack models, grey here: the town textures them at run time)
for (const [i, [bx, bz, rot]] of MARKET_BOOTHS.entries()) await ground_(`./assets/booth_${"abc"[i]}.glb`, { x: bx, z: bz, y: terrainHeight(bx, bz), rotY: rot, width: 3.6 });
for (const c of STALL_CRATES) {
  const [bx, bz] = MARKET_BOOTHS[c.booth]!; const [x, z] = boothPoint(c.booth, c.lx, c.lz);
  await ground_("./assets/crate.glb", { x, z, y: terrainHeight(bx, bz), rotY: MARKET_BOOTHS[c.booth]![2] + c.rot, width: 0.62 });
}

for (const p of DRESSING_PIECES) {
  const url = `./assets/${DRESSING_FILES[p.asset].split("/")[1]}`;
  if (p.frame === "home") { await ground_(url, { x: p.x, z: p.z, y: p.lift ?? 0, rotY: p.rotY, width: p.width, height: p.height }, home.group); continue; }
  const [gx, gz] = p.groundAt ?? [p.x, p.z];
  await ground_(url, { x: p.x, z: p.z, y: (p.lift ?? 0) + terrainHeight(gx, gz), rotY: p.rotY, width: p.width, height: p.height });
}

const cam = new THREE.PerspectiveCamera(48, 1280 / 720, 0.05, 400);
const T = ATHENA_TEMPLE.position;
const th = terrainHeight(T[0], T[1]);
const toWorld = (x: number, y: number, z: number) => home.group.localToWorld(new THREE.Vector3(x, y, z));
const V: Record<string, [THREE.Vector3, THREE.Vector3]> = {
  temple: [new THREE.Vector3(T[0] + 6.5, th + 1.7, T[1] + 1.2), new THREE.Vector3(T[0], th + 1.9, T[1])],
  templeClose: [new THREE.Vector3(T[0] + 4.2, th + 1.6, T[1] - 0.6), new THREE.Vector3(T[0] + 0.5, th + 1.9, T[1])],
  templeSide: [new THREE.Vector3(T[0] + 3, th + 2.2, T[1] + 7), new THREE.Vector3(T[0], th + 1.8, T[1])],
  templeRoof: [new THREE.Vector3(T[0] + 8, th + 6, T[1] + 5), new THREE.Vector3(T[0], th + 2.4, T[1])],
  forum: [new THREE.Vector3(1.5, 2.0, 14), new THREE.Vector3(6.5, 2.0, 7.6)],
  forumClose: [new THREE.Vector3(2.5, 1.8, 11), new THREE.Vector3(6.5, 2.0, 7.6)],
  forumLucretia: [new THREE.Vector3(-2, 2.2, 12.5), new THREE.Vector3(-1, 1.8, 6)],
  forumFront: [new THREE.Vector3(0.8, 1.7, 1.2), new THREE.Vector3(6.5, 2.0, 7.6)],
  forumBack: [new THREE.Vector3(10, 1.7, 13), new THREE.Vector3(6.5, 2.0, 7.6)],
  gardenTop: [toWorld(1.9, 7.5, -6.0), toWorld(1.9, 0.3, -3.9)],
  gardenTopW: [toWorld(-1.5, 6.0, -6.2), toWorld(1.9, 0.3, -3.9)],
  gardenIn: [toWorld(0.35, 1.3, -3.4), toWorld(2.1, 0.5, -3.95)],
  gardenIn2: [toWorld(0.3, 1.0, -4.3), toWorld(1.8, 0.45, -3.9)],
  garden: [toWorld(1.3, 3.2, -1.6), toWorld(1.8, 0.4, -3.9)],
  gardenClose: [toWorld(1.2, 1.6, -2.45), toWorld(1.8, 0.4, -3.95)],
  market: [new THREE.Vector3(2.5, 1.7, 30.5), new THREE.Vector3(8.5, 1.1, 34.5)],
  marketA: [new THREE.Vector3(3.2, 1.5, 33.6), new THREE.Vector3(8.5, 1.0, 33.6)],
  marketB: [new THREE.Vector3(-3.2, 1.5, 33.6), new THREE.Vector3(-8.5, 1.0, 33.6)],
  marketC: [new THREE.Vector3(3.2, 1.5, 38.4), new THREE.Vector3(8.5, 1.0, 38.4)],
  marketAvenue: [new THREE.Vector3(0, 1.7, 44), new THREE.Vector3(0, 1.5, 30)],
};
const [from, to] = V[view] ?? V.temple!;
cam.position.copy(from);
cam.lookAt(to);
renderer.render(scene, cam);
(window as unknown as { __done: boolean }).__done = true;
