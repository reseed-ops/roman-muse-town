// Task 131 dev harness: a bare VRM on a floor, posed with the town's own poseBone, to tune Gaius's drawn sword and shield
// and Archer's poses without loading the town. Build: bun build tools/tour/pose131.ts --outfile /tmp/pose131/pose.js --target browser
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { collectRig, litVrmMaterials, PLAYER_TINTS, poseBone, prepareVrm } from "../../client/src/characterAnimation";
import { createGaiusArms, HAND_SWORD, FOREARM_SHIELD } from "../../client/src/gaiusArms";
import { gaiusStance, applyStance } from "../../client/src/sparringStance";

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(Number(q.get("w") ?? 900), Number(q.get("h") ?? 900));
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb8d0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x665544, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(2, 4, 3); scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshStandardMaterial({ color: 0x8a7a55 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const loader = new GLTFLoader();
const load = (url: string) => loader.loadAsync(url).then(g => g.scene);
const ground = (m: THREE.Object3D, height: number) => {
  const wrap = new THREE.Group(), inner = new THREE.Group(); inner.add(m); wrap.add(inner);
  const s = height / new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3()).y;
  inner.scale.setScalar(s);
  const bb = new THREE.Box3().setFromObject(inner), c = bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -bb.min.y, -c.z); return wrap;
};
const place = async (url: string, parent: THREE.Object3D, o: { x: number; z: number; height: number }) => {
  const w = ground((await load(url)).clone(true), o.height); w.position.set(o.x, 0, o.z); parent.add(w); return w;
};
const avatar = new THREE.Group(); scene.add(avatar); // his facing frame
const model = q.get("model") ?? "centurion";
const m = clone(await load(`assets/${model}.vrm`));
litVrmMaterials(m, PLAYER_TINTS); prepareVrm(m);
const body = ground(m, model === "centurion" ? 1.94 : 1.88);
avatar.add(body);
avatar.rotation.y = Number(q.get("face") ?? 0);
const rig = collectRig(m);
for (const [key, target] of [["hs", HAND_SWORD], ["fs", FOREARM_SHIELD]] as const) {
  const v = q.get(key)?.split(",").map(Number);
  if (v) { target.pos = [v[0]!, v[1]!, v[2]!]; target.rot = [v[3]!, v[4]!, v[5]!]; }
}
const arms = createGaiusArms({ frame: avatar, place, gladiusUrl: "assets/roman/gladius.glb", shieldUrl: "assets/roman/shield_legionaire.glb" });
if (model === "centurion") { arms.attach(m); arms.attachDrawn(m); }
await new Promise(r => setTimeout(r, 1500));
const pose = q.get("pose") ?? "idle";
const drawn = pose !== "idle" && pose !== "worn";
arms.setVisible({ sword: true, shield: pose !== "worn", drawn }, 1);
// base idle arm values as townScene writes them
poseBone(rig, rig.lUpperArm, 0, 0, -1.22); poseBone(rig, rig.rUpperArm, 0, 0, 1.22);
poseBone(rig, rig.lLowerArm, 0, 0, -0.13); poseBone(rig, rig.rLowerArm, 0, 0, 0.27);
if (drawn) {
  const k = Number(q.get("t") ?? 0.5);
  const st = q.get("st") ? JSON.parse(q.get("st")!) : gaiusStance(pose as never, k);
  applyStance(rig, st, 1);
}
const cam = new THREE.PerspectiveCamera(Number(q.get("fov") ?? 30), 1, 0.1, 50);
const yaw = Number(q.get("yaw") ?? 0), dist = Number(q.get("d") ?? 4.5), ty = Number(q.get("ty") ?? 1.1);
cam.position.set(Math.sin(yaw) * dist, ty + 0.2, Math.cos(yaw) * dist); cam.lookAt(0, ty, 0);
renderer.render(scene, cam);
document.title = "ready";
