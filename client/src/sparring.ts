import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import gladiatorUrl from "./assets/gladiator.vrm";
import { collectRig, litVrmMaterials, PLAYER_TINTS, poseBone, poseThrowArm, poseWave, prepareVrm, type VrmRig } from "./characterAnimation";
import { boutStart, post, rackX, sparringFootprints } from "./sparringSite";
import { advance, challenge, cue, forfeit, idleBout, press } from "./sparringBout";
import type { SceneResources } from "./sceneResources";
import type { Move } from "./sparringStance";

// Archer plays Tuan's Gladiator (VRoid Studio 2.14, redistribution and modification allowed).
export const ARCHER_MODEL_URL = gladiatorUrl;
type Options = {
  resources: SceneResources;
  load: (url: string) => Promise<THREE.Object3D>;
  ground: (model: THREE.Object3D, opts: { height: number }) => THREE.Group;
  height: (x: number, z: number) => number;
  player: () => { x: number; z: number };
  ready: () => boolean;
  positionPlayer: (x: number, z: number, heading: number) => void;
  equip: () => () => void;
  celebrate: () => void;
};

export function buildSparring(o: Options) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.visible = false;
  body.position.set(post.x, o.height(post.x, post.z), post.z);
  group.add(body);
  const wood = new THREE.MeshStandardMaterial({ color: 0x906537 });
  function board(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  const earth = new THREE.Mesh(new THREE.CircleGeometry(2.05, 32), new THREE.MeshStandardMaterial({ color: 0x96774f }));
  earth.rotation.x = -Math.PI / 2;
  earth.position.set(post.x, o.height(post.x, post.z + 0.8) + 0.025, post.z + 0.8);
  group.add(earth);
  const rack = new THREE.Group();
  rack.position.set(rackX, o.height(rackX, post.z), post.z);
  group.add(rack);
  for (const x of [-0.45, 0.45]) board(rack, x, 0.45, 0, 0.09, 0.9, 0.18);
  board(rack, 0, 0.64, 0, 1.05, 0.12, 0.12);
  for (const x of [-0.22, 0.18]) {
    board(rack, x, 0.45, 0.12, 0.07, 0.9, 0.045);
    board(rack, x, 0.76, 0.12, 0.19, 0.045, 0.05);
  }
  const obstacles = sparringFootprints(body, rack);
  let rig: VrmRig | undefined;
  void o.load(ARCHER_MODEL_URL).then(source => {
    if (o.resources.disposed) return;
    const model = clone(source);
    o.resources.adopt(model);
    litVrmMaterials(model, PLAYER_TINTS);
    prepareVrm(model);
    const frame = o.ground(model, { height: 1.88 });
    body.add(frame);
    rig = collectRig(model);
    if (rig.rHand) {
      const sword = new THREE.Group();
      // Attach with world scale preserved even for a differently scaled replacement VRM.
      body.add(sword);
      rig.rHand.attach(sword);
      sword.position.set(0, 0, 0);
      sword.quaternion.identity();
      board(sword, 0, 0, 0.36, 0.07, 0.04, 0.58);
      board(sword, 0, 0, 0.07, 0.18, 0.05, 0.04);
      board(sword, 0, 0, 0, 0.04, 0.04, 0.14);
    }
    body.visible = true;
    pose(performance.now());
  }).catch(error => console.warn("Archer model failed to load", error));

  let bout = idleBout();
  let restore: (() => void) | undefined;
  const distance = () => Math.hypot(o.player().x - post.x, o.player().z - post.z);
  function start(probe = false) {
    if (!body.visible || bout.phase !== "idle" || (!probe && (!o.ready() || distance() > 2.5))) return false;
    o.positionPlayer(boutStart.x, boutStart.z, boutStart.heading);
    restore = o.equip();
    bout = challenge(performance.now());
    return true;
  }
  function pose(now: number) {
    if (!rig) return;
    const phase = bout.phase;
    const sway = Math.sin(now * 0.0017) * 0.027;
    const stagger = phase === "recovery" && bout.lastEvent.startsWith("Clash");
    const block = phase === "pass" && bout.lastEvent === "Archer blocks.";
    const bow = phase === "result" && bout.gaius === 5;
    body.rotation.y = phase === "idle" ? 0 : Math.atan2(o.player().x - post.x, o.player().z - post.z);
    poseBone(rig, rig.chest, stagger ? -0.25 : bow ? 0.17 : sway, 0, sway);
    poseBone(rig, rig.head ?? rig.neck, bow ? 0.35 : 0, 0, -sway); // the VRoid head bone is J_Bip_C_Head, which collectRig does not find; the neck carries the bow
    poseBone(rig, rig.rUpperLeg, stagger ? -0.24 : 0, 0, sway);
    poseBone(rig, rig.lUpperArm, 0, 0, -1.22);
    poseBone(rig, rig.rUpperArm, block ? -0.85 : 0, block ? -0.6 : 0, block ? 0.35 : 1.22);
    poseBone(rig, rig.rLowerArm, 0, block ? -1.0 : 0, 0.18);
    poseBone(rig, rig.rHand, 0, 0, 0);
    const progress = (now - bout.since) / (bout.until - bout.since);
    if (phase === "telegraph") poseThrowArm(rig, progress * 0.38, true);
    if (phase === "parry") poseThrowArm(rig, 0.38 + Math.min(1, progress * 2) * 0.61, true);
    if (phase === "result" && !bow) poseWave(rig, now / 1000);
  }
  /** What Gaius's arms are doing, from the bout: null outside a bout. */
  function gaiusMove(): { move: Move; progress: number } | null {
    if (bout.phase === "idle") return null;
    const progress = Math.min(1, Math.max(0, (performance.now() - bout.since) / (bout.until - bout.since)));
    const event = bout.lastEvent;
    if (bout.phase === "recovery") return { move: event.startsWith("Clash") ? "parry" : "hit", progress };
    if (bout.phase === "pass" && (event.startsWith("Gaius scores") || event === "Archer blocks.")) return { move: "strike", progress };
    return { move: "guard", progress: 0 };
  }
  function update() {
    const now = performance.now();
    if (bout.phase !== "idle" && bout.phase !== "result" && distance() > 6) bout = forfeit(bout, now);
    bout = advance(bout, now);
    if (bout.phase === "idle" && restore) { restore(); restore = undefined; }
    pose(now);
  }
  function action() {
    const now = performance.now();
    const previous = bout.phase;
    bout = press(bout, now, Math.random);
    if (previous !== "result" && bout.phase === "result" && bout.gaius === 5) o.celebrate();
  }
  return { group, obstacles, update, gaiusMove,
    prompt: () => body.visible && (bout.phase !== "idle" || distance() <= 2.5)
      ? { kind: "sparring" as const, id: cue(bout), d: bout.phase === "idle" ? distance() : -1 } : null,
    interact: () => bout.phase === "idle" ? start() : action(),
    tour: { ready: () => body.visible, challenge: () => start(true), press: action, state: () => ({ ...bout }), archerPos: () => ({ ...post }) },
  };
}
