// Task 93: before/after close-ups of a slimmed GLB and its restored-maps twin under the town's
// own tone mapping, for Playwright screenshots. Built by tools/idyllic/maps-preview.py; never shipped.
// ?old=URL&new=URL&look=x,y,z&dist=d&az=deg&el=deg&mode=day|night&fov=deg&scale=s
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const q = new URLSearchParams(location.search);
const night = q.get("mode") === "night";
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 720);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = night ? 1.0 : 1.12;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(night ? 0x0d1230 : 0xa9cfe6);
scene.add(new THREE.HemisphereLight(night ? 0x4a5a9a : 0xffffff, night ? 0x1a1a22 : 0x8a7a5a, night ? 0.35 : 0.95));
const sun = new THREE.DirectionalLight(night ? 0x8a9ad0 : 0xfff1d6, night ? 0.25 : 1.9);
sun.position.set(-20, 40, 30);
sun.castShadow = true;
scene.add(sun);
if (night) {
  const lamp = new THREE.PointLight(0xffb060, 30, 14, 1.6);
  lamp.position.set(-1.2, 2.2, 2.6);
  scene.add(lamp);
}
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6f9a48, roughness: 1 }));
floor.receiveShadow = true;
scene.add(floor);

const loader = new GLTFLoader();
const gap = Number(q.get("gap") ?? 2.6);
async function put(url: string, x: number) {
  const gltf = await loader.loadAsync(url);
  const g = new THREE.Group();
  g.add(gltf.scene);
  const bb = new THREE.Box3().setFromObject(g);
  const c = bb.getCenter(new THREE.Vector3());
  const s = Number(q.get("scale") ?? 1);
  g.scale.setScalar(s);
  g.position.set(x - c.x * s, -bb.min.y * s, -c.z * s);
  g.traverse((m) => { if (m instanceof THREE.Mesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(g);
}
await put(q.get("old")!, -gap / 2);
await put(q.get("new")!, gap / 2);
const look = (q.get("look") ?? "0,1,0").split(",").map(Number) as [number, number, number];
const dist = Number(q.get("dist") ?? 4), az = (Number(q.get("az") ?? 20) * Math.PI) / 180, el = (Number(q.get("el") ?? 8) * Math.PI) / 180;
const cam = new THREE.PerspectiveCamera(Number(q.get("fov") ?? 35), 1280 / 720, 0.05, 400);
cam.position.set(look[0] + dist * Math.sin(az) * Math.cos(el), look[1] + dist * Math.sin(el), look[2] + dist * Math.cos(az) * Math.cos(el));
cam.lookAt(look[0], look[1], look[2]);
renderer.render(scene, cam);
renderer.render(scene, cam);
(window as unknown as { __done: boolean }).__done = true;
