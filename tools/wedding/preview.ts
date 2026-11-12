// Task 84: a browser preview of the dressed ceremony area, for a Playwright screenshot.
// It runs the town's own createWeddingScene with a placer that loads the real recoloured GLBs
// (same grounding as townScene's groundModel) onto a plain ground and the avenue's posts.
// Built by tools/wedding/preview.py; never shipped.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WEDDING_RANK, WEDDING_STEPS, emptyWedding, hold, prepare } from "../../shared/romanWedding";
import { createWeddingScene } from "../../client/src/romanWedding";

const params = new URLSearchParams(location.search);
const stage = params.get("stage") ?? "dressed"; // dressed | feast
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1280, 720);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbcd4ea);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 1.1));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(-6, 12, 8);
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xc9b88f }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const loader = new GLTFLoader();
const wedding = createWeddingScene({
  place: async (id, parent, o) => {
    const gltf = await loader.loadAsync(`./assets/${id}.glb`);
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
    wrap.position.set(o.x, o.y, o.z);
    wrap.rotation.y = o.rotY;
    parent.add(wrap);
    return wrap;
  },
});
scene.add(wedding.group);
const R = WEDDING_RANK;
const ready = WEDDING_STEPS.reduce((b, st) => prepare(b, st, R), emptyWedding());
wedding.setBook(stage === "feast" ? hold(ready, R) : ready);
if (stage === "feast") wedding.celebrate();
await wedding.loaded();
wedding.update(0.1, 1);
const cam = new THREE.PerspectiveCamera(48, 1280 / 720, 0.1, 100);
const view = params.get("view") ?? "avenue";
if (view === "avenue") { cam.position.set(1.5, 3.2, 12); cam.lookAt(0, 1.6, -3); }
else { cam.position.set(7.5, 3.4, 2.5); cam.lookAt(0.5, 1.2, -3.2); }
renderer.render(scene, cam);
(window as unknown as { __done: boolean }).__done = true;
