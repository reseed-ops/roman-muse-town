import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { SceneResources } from "./sceneResources";
import { fetchClipBytes, takeClipBytes } from "./characterLoad";

// --- VRM rigs --------------------------------------------------------------
// VRoid skeletons use the J_Bip_* bone names. VRMs export in a T-pose, so
// the arms are posed down to the sides once, and then waved, swung, and
// settled by rotating the arm/leg bones around their rest orientations.

export interface VrmRig {
  lUpperArm: THREE.Object3D | null;
  rUpperArm: THREE.Object3D | null;
  lLowerArm: THREE.Object3D | null;
  rLowerArm: THREE.Object3D | null;
  lUpperLeg: THREE.Object3D | null;
  rUpperLeg: THREE.Object3D | null;
  lLowerLeg: THREE.Object3D | null;
  rLowerLeg: THREE.Object3D | null;
  rHand: THREE.Object3D | null;
  lHand: THREE.Object3D | null;
  head: THREE.Object3D | null;
  rest: Map<THREE.Object3D, THREE.Quaternion>;
}

export function collectRig(root: THREE.Object3D): VrmRig {
  const rig: VrmRig = {
    lUpperArm: root.getObjectByName("J_Bip_L_UpperArm") ?? null,
    rUpperArm: root.getObjectByName("J_Bip_R_UpperArm") ?? null,
    lLowerArm: root.getObjectByName("J_Bip_L_LowerArm") ?? null,
    rLowerArm: root.getObjectByName("J_Bip_R_LowerArm") ?? null,
    lUpperLeg: root.getObjectByName("J_Bip_L_UpperLeg") ?? null,
    rUpperLeg: root.getObjectByName("J_Bip_R_UpperLeg") ?? null,
    lLowerLeg: root.getObjectByName("J_Bip_L_LowerLeg") ?? null,
    rLowerLeg: root.getObjectByName("J_Bip_R_LowerLeg") ?? null,
    rHand: root.getObjectByName("J_Bip_R_Hand") ?? null,
    lHand: root.getObjectByName("J_Bip_L_Hand") ?? null,
    head: root.getObjectByName("J_Bip_Head") ?? null,
    rest: new Map(),
  };
  for (const bone of [
    rig.lUpperArm, rig.rUpperArm, rig.lLowerArm, rig.rLowerArm,
    rig.lUpperLeg, rig.rUpperLeg, rig.lLowerLeg, rig.rLowerLeg, rig.rHand, rig.lHand, rig.head,
  ]) {
    if (bone) rig.rest.set(bone, bone.quaternion.clone());
  }
  return rig;
}

const boneEuler = new THREE.Euler();
const boneDelta = new THREE.Quaternion();

/** Rotate a bone by (x, y, z) in parent space, on top of its rest pose. */
export function poseBone(rig: VrmRig, bone: THREE.Object3D | null, x: number, y: number, z: number) {
  if (!bone) return;
  const rest = rig.rest.get(bone);
  if (!rest) return;
  boneEuler.set(x, y, z);
  boneDelta.setFromEuler(boneEuler);
  bone.quaternion.copy(boneDelta).multiply(rest);
}

/** The shared greet/wave pose for both VRM characters, softened so it
 *  never spears straight: the shoulder peaks lower than the old pose
 *  (hand stays below the fully-speared line), the elbow keeps a
 *  permanent gentle bend through the whole cycle (its wag swings
 *  between about -0.58 and -0.26 and never crosses zero), and the
 *  forearm and wrist trail the shoulder with a phase lag so the
 *  motion reads relaxed instead of rigid. */
export function poseWave(rig: VrmRig, t: number) {
  const shoulderSway = Math.sin(t * 5.5);
  const forearmWag = Math.sin(t * 5.5 - 0.65); // lagging the shoulder
  const wristLag = Math.sin(t * 5.5 - 1.15); // lagging the forearm
  poseBone(rig, rig.rUpperArm, shoulderSway * 0.035, 0, -0.88 + shoulderSway * 0.03);
  poseBone(rig, rig.rLowerArm, 0, 0, -0.42 + forearmWag * 0.16);
  poseBone(rig, rig.rHand, 0, 0, -0.1 + wristLag * 0.12);
}

/** The same softened wave, held still (reduced motion): lowered
 *  shoulder, permanently bent elbow, relaxed wrist. */
export function poseWaveStill(rig: VrmRig) {
  poseBone(rig, rig.rUpperArm, 0, 0, -0.88);
  poseBone(rig, rig.rLowerArm, 0, 0, -0.42);
  poseBone(rig, rig.rHand, 0, 0, -0.1);
}

// --- Umbrella posing ---------------------------------------------------------
// No purchased pack ships an umbrella clip, so the hold is COMPOSED:
// a procedural override layered over whatever the character is doing
// (idle or walk). Over a playing clip it premultiplies a delta onto
// the arm bones' current rotations (the mixer rewrites them every
// frame, so nothing accumulates); over a clip-less body it composes
// from the rest pose, like the other procedural poses.

const umbEuler = new THREE.Euler();
const umbDelta = new THREE.Quaternion();

function umbrellaBone(rig: VrmRig, bone: THREE.Object3D | null, x: number, y: number, z: number, fromRest: boolean) {
  if (!bone) return;
  if (fromRest) {
    poseBone(rig, bone, x, y, z);
    return;
  }
  umbEuler.set(x, y, z);
  umbDelta.setFromEuler(umbEuler);
  bone.quaternion.premultiply(umbDelta);
}

/** Holding an umbrella: right upper arm raised partway and a touch
 *  forward, elbow bent so the forearm lifts the hand to handle
 *  height, wrist easy. Reads at idle and mid-stride alike. */
export function poseUmbrellaArm(rig: VrmRig, amt: number, fromRest: boolean) {
  umbrellaBone(rig, rig.rUpperArm, -0.18 * amt, 0, -0.52 * amt, fromRest);
  umbrellaBone(rig, rig.rLowerArm, -0.1 * amt, 0, -1.02 * amt, fromRest);
  umbrellaBone(rig, rig.rHand, 0, 0, -0.18 * amt, fromRest);
}

/** The stone throw (Nov 1): a composed overarm over the idle/walk
 *  base, in the umbrella tradition, no pack ships us a throwing
 *  clip, so the gesture is built: the arm cocks back with a bent
 *  elbow, sweeps over the top (the stone leaves the hand at the
 *  sweep's front, phase ≈ 0.39, updateRocks times the launch to
 *  it), and follows through into a settle. Phase is 0..1 across
 *  the gesture's 0.62 s; the envelope keeps the ends soft so the
 *  arm never snaps into or out of the throw. */
export function poseThrowArm(rig: VrmRig, phase: number, fromRest: boolean) {
  let x: number;
  let elbow: number;
  if (phase < 0.38) {
    const k = phase / 0.38;
    x = 0.95 * k;
    elbow = -0.95 * k;
  } else if (phase < 0.55) {
    const k = (phase - 0.38) / 0.17;
    x = 0.95 - 2.95 * k;
    elbow = -0.95 + 0.8 * k;
  } else {
    const k = (phase - 0.55) / 0.45;
    x = -2.0 + 2.0 * k * k;
    elbow = -0.15 - 0.25 * k;
  }
  const env = Math.min(1, phase / 0.08) * Math.min(1, (1 - phase) / 0.2 + 0.25);
  umbrellaBone(rig, rig.rUpperArm, x * env, 0, -0.15 * env, fromRest);
  umbrellaBone(rig, rig.rLowerArm, 0, 0, elbow * env, fromRest);
  umbrellaBone(rig, rig.rHand, 0, 0, -0.2 * env, fromRest);
}

/** Arm in arm (the shared-umbrella arrangement): her near: left,
 *  arm bends so her hand tucks into the crook of his umbrella arm,
 *  resting at his elbow. Mirror-signed to the right arm's poses. */
export function poseLinkArm(rig: VrmRig, amt: number, fromRest: boolean) {
  umbrellaBone(rig, rig.lUpperArm, -0.12 * amt, 0, 0.34 * amt, fromRest);
  umbrellaBone(rig, rig.lLowerArm, 0, 0, 1.08 * amt, fromRest);
  umbrellaBone(rig, rig.lHand, 0, 0, 0.15 * amt, fromRest);
}

// --- Hand-in-hand wandering ------------------------------------------------
// No pack ships a hand-hold clip either, so the joined hands are
// COMPOSED the same way as the umbrella hold: his inner (right) arm
// and her inner (left) arm ease down and slightly toward each other,
// elbows softly bent, so the hands meet at the seam between them and
// stay met, a hand-contact servo in driveClipAnims (the same light
// touch as the arm-in-arm one) eases her stance so the hands stay
// registered while they walk. She walks on his right, so right/left
// are the inner arms; signs mirror, as in poseLinkArm.

/** His half of the joined hands: right arm down, a touch across
 *  toward her, elbow gently bent, wrist easy. */
export function poseHoldHandPlayer(rig: VrmRig, amt: number, fromRest: boolean) {
  umbrellaBone(rig, rig.rUpperArm, -0.04 * amt, 0, -0.17 * amt, fromRest);
  umbrellaBone(rig, rig.rLowerArm, -0.06 * amt, 0, -0.34 * amt, fromRest);
  umbrellaBone(rig, rig.rHand, 0, 0, -0.12 * amt, fromRest);
}

/** Her half: the mirror: left arm down and toward him. */
export function poseHoldHandMuse(rig: VrmRig, amt: number, fromRest: boolean) {
  umbrellaBone(rig, rig.lUpperArm, -0.04 * amt, 0, 0.17 * amt, fromRest);
  umbrellaBone(rig, rig.lLowerArm, -0.06 * amt, 0, 0.34 * amt, fromRest);
  umbrellaBone(rig, rig.lHand, 0, 0, 0.12 * amt, fromRest);
}

// --- Retargeted motion clips -------------------------------------------------
// Real animation clips replace the formula-swung limbs for locomotion
// and idle. The clips come from the owner's purchased "Human Basic Motions"
// pack (Kevin Iglesias): in-place Idle01 / Walk01_Forward /
// Run01_Forward / HandWave01 FBX files for each sex, stored under
// assets/anim/. Their skeleton uses B-* bone names on a Y-up T-pose
// rig; the VRoid bodies use J_Bip_* names on a near-identical T-pose,
// so at load time each clip is re-baked onto the VRM bone-for-bone:
// for every mapped bone, the clip's world-space rotation DELTA from
// the source's bind pose is re-expressed in the target's space (via
// anatomical frames built from each rig's own bind pose, which also
// absorbs any facing difference) and applied on top of the target's
// bind pose. Hip sway/bob transfers too, scaled by hip height. The
// source clips' own root-node track is never allowed to drive the
// measurement root (three's FBXLoader leaves those Z-up rigs twisted;
// the bones' local tracks are clean Y-up data).
//
// Playback is a per-character AnimationMixer blended by ACTUAL ground
// speed: idle at rest, walk at a stroll, run when a character really
// moves fast (the Centurion's full tilt, Muse hurrying to catch up).
// Clip playback rates scale so the feet match the ground: the clips'
// authored speeds were measured from the pack's root-motion twins
// (walk 160 cm per 0.8 s cycle = 2.0 m/s; run 240 cm per 0.6 s =
// 4.0 m/s), rescaled by each body's displayed hip height. A baked
// clip is only trusted after a numeric sanity check (thighs and arms
// must point DOWN in the retargeted idle); on any failure the
// character simply keeps the procedural posing below, untouched.

const ANIM_BONE_MAP: Record<string, string> = {
  J_Bip_C_Hips: "B-hips",
  J_Bip_C_Spine: "B-spine",
  J_Bip_C_Chest: "B-chest",
  J_Bip_C_Neck: "B-neck",
  J_Bip_C_Head: "B-head",
  J_Bip_L_Shoulder: "B-shoulderL",
  J_Bip_L_UpperArm: "B-upperArmL",
  J_Bip_L_LowerArm: "B-forearmL",
  J_Bip_L_Hand: "B-handL",
  J_Bip_R_Shoulder: "B-shoulderR",
  J_Bip_R_UpperArm: "B-upperArmR",
  J_Bip_R_LowerArm: "B-forearmR",
  J_Bip_R_Hand: "B-handR",
  J_Bip_L_UpperLeg: "B-thighL",
  J_Bip_L_LowerLeg: "B-shinL",
  J_Bip_L_Foot: "B-footL",
  J_Bip_L_ToeBase: "B-toeL",
  J_Bip_R_UpperLeg: "B-thighR",
  J_Bip_R_LowerLeg: "B-shinR",
  J_Bip_R_Foot: "B-footR",
  J_Bip_R_ToeBase: "B-toeR",
};
const ANIM_HIPS_T = "J_Bip_C_Hips";
const ANIM_HIPS_S = "B-hips";

/** A source rig for the retarget bake: which source bone drives each
 *  VRM bone, plus the bones the anatomical frame is built from. The
 *  locomotion clips speak the Iglesias B-* names, so the bake takes
 *  the map as a parameter. */
interface AnimRigSpec {
  map: Record<string, string>;
  hips: string;
  chest: string;
  thighL: string;
  thighR: string;
}
const IGLESIAS_RIG: AnimRigSpec = {
  map: ANIM_BONE_MAP,
  hips: ANIM_HIPS_S,
  chest: "B-chest",
  thighL: "B-thighL",
  thighR: "B-thighR",
};
/** The Outdoor library's rig: the same humanoid shape under plain
 *  names (Hips, Left_UpperArm, ...). One skeleton serves both the
 *  He and She files, gender lives in the motion, not the bones,
 *  verified by dumping the bind pose of sampled files (all 21
 *  mapped bones present, hip height 98.1 in source units). */
const OUTDOOR_RIG: AnimRigSpec = {
  map: {
    J_Bip_C_Hips: "Hips",
    J_Bip_C_Spine: "Spine",
    J_Bip_C_Chest: "Chest",
    J_Bip_C_Neck: "Neck",
    J_Bip_C_Head: "Head",
    J_Bip_L_Shoulder: "Left_Shoulder",
    J_Bip_L_UpperArm: "Left_UpperArm",
    J_Bip_L_LowerArm: "Left_LowerArm",
    J_Bip_L_Hand: "Left_Hand",
    J_Bip_R_Shoulder: "Right_Shoulder",
    J_Bip_R_UpperArm: "Right_UpperArm",
    J_Bip_R_LowerArm: "Right_LowerArm",
    J_Bip_R_Hand: "Right_Hand",
    J_Bip_L_UpperLeg: "Left_UpperLeg",
    J_Bip_L_LowerLeg: "Left_LowerLeg",
    J_Bip_L_Foot: "Left_Foot",
    J_Bip_L_ToeBase: "Left_Toes",
    J_Bip_R_UpperLeg: "Right_UpperLeg",
    J_Bip_R_LowerLeg: "Right_LowerLeg",
    J_Bip_R_Foot: "Right_Foot",
    J_Bip_R_ToeBase: "Right_Toes",
  },
  hips: "Hips",
  chest: "Chest",
  thighL: "Left_UpperLeg",
  thighR: "Right_UpperLeg",
};
const ANIM_WALK_MPS = 2.0; // measured from the pack's root-motion walk
const ANIM_RUN_MPS = 4.0; // measured from the pack's root-motion run

interface AnimBind {
  obj: THREE.Object3D;
  worldQuat: THREE.Quaternion;
  worldPos: THREE.Vector3;
  localQuat: THREE.Quaternion;
  localPos: THREE.Vector3;
  depth: number;
}

const _animInv = new THREE.Matrix4();
const _animRel = new THREE.Matrix4();
function animRootSpace(root: THREE.Object3D, obj: THREE.Object3D): THREE.Matrix4 {
  _animInv.copy(root.matrixWorld).invert();
  _animRel.multiplyMatrices(_animInv, obj.matrixWorld);
  return _animRel;
}

function collectAnimBind(root: THREE.Object3D, names: Iterable<string>): Map<string, AnimBind> {
  root.updateMatrixWorld(true);
  const out = new Map<string, AnimBind>();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  for (const name of names) {
    const obj = root.getObjectByName(name);
    if (!obj) continue;
    animRootSpace(root, obj).decompose(p, q, s);
    let depth = 0;
    let par = obj.parent;
    while (par && par !== root) {
      depth++;
      par = par.parent;
    }
    out.set(name, {
      obj,
      worldQuat: q.clone(),
      worldPos: p.clone(),
      localQuat: obj.quaternion.clone(),
      localPos: obj.position.clone(),
      depth,
    });
  }
  return out;
}

/** A rotation whose axes are the rig's own anatomical directions at
 *  bind: X = right-thigh -> left-thigh, Y = hips -> chest (re-
 *  orthogonalised), Z = facing. Two rigs' frames divide out whatever
 *  facing/axis difference exists between them. */
function animAnatomicalFrame(
  bind: Map<string, AnimBind>,
  hips: string,
  chest: string,
  thighL: string,
  thighR: string,
): THREE.Quaternion | null {
  const h = bind.get(hips);
  const c = bind.get(chest);
  const l = bind.get(thighL);
  const r = bind.get(thighR);
  if (!h || !c || !l || !r) return null;
  const x = l.worldPos.clone().sub(r.worldPos).normalize();
  const up = c.worldPos.clone().sub(h.worldPos).normalize();
  const z = new THREE.Vector3().crossVectors(x, up).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Bake one source clip onto the target VRM skeleton. Returns the
 *  retargeted clip plus the source rig's bind hip height (source
 *  units, centimetres), or null if the rigs don't line up. */
function bakeRetargetedClip(
  srcRoot: THREE.Object3D,
  srcClip: THREE.AnimationClip,
  tgtRoot: THREE.Object3D,
  rig: AnimRigSpec = IGLESIAS_RIG,
): { clip: THREE.AnimationClip; srcHipHeight: number } | null {
  // Target chain: every mapped bone plus its ancestors up to the
  // model root (the VRoid UpperChest rides along this way, unmapped
  // but correctly carried by its animated parent).
  const chain = new Set<THREE.Object3D>();
  for (const tgtName of Object.keys(rig.map)) {
    let obj: THREE.Object3D | null = tgtRoot.getObjectByName(tgtName) ?? null;
    while (obj && obj !== tgtRoot) {
      chain.add(obj);
      obj = obj.parent;
    }
  }
  if (chain.size === 0) return null;
  const chainNames = [...chain].map((o) => o.name);
  const tgtBind = collectAnimBind(tgtRoot, chainNames);
  const srcBind = collectAnimBind(srcRoot, Object.values(rig.map));
  const srcHipsBind = srcBind.get(rig.hips);
  const tgtHipsBind = tgtBind.get(ANIM_HIPS_T);
  if (!srcHipsBind || !tgtHipsBind) return null;
  const frameS = animAnatomicalFrame(srcBind, rig.hips, rig.chest, rig.thighL, rig.thighR);
  const frameT = animAnatomicalFrame(tgtBind, ANIM_HIPS_T, "J_Bip_C_Chest", "J_Bip_L_UpperLeg", "J_Bip_R_UpperLeg");
  if (!frameS || !frameT) return null;
  const corr = frameT.clone().multiply(frameS.clone().invert()); // src space -> tgt space
  const corrInv = corr.clone().invert();
  const hipScale = tgtHipsBind.worldPos.y / srcHipsBind.worldPos.y;

  const ordered = [...chain].sort(
    (a, b) => (tgtBind.get(a.name)?.depth ?? 0) - (tgtBind.get(b.name)?.depth ?? 0),
  );
  const srcByName = new Map<string, THREE.Object3D>();
  for (const srcName of Object.values(rig.map)) {
    const o = srcRoot.getObjectByName(srcName);
    if (o) srcByName.set(srcName, o);
  }

  const fps = 30;
  const frames = Math.max(2, Math.round(srcClip.duration * fps));
  const times = new Float32Array(frames);
  const quatData = new Map<string, Float32Array>();
  const hipPos = new Float32Array(frames * 3);
  const mixer = new THREE.AnimationMixer(srcRoot);
  mixer.clipAction(srcClip).play();

  const worldQ = new Map<THREE.Object3D, THREE.Quaternion>();
  const worldP = new Map<THREE.Object3D, THREE.Vector3>();
  const tmpM = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);

  for (let f = 0; f < frames; f++) {
    times[f] = f / fps;
    mixer.setTime(f / fps);
    // Pin the measurement root: the clip's own root-node track (the
    // Z-up Rig rotation) must not leak into the bone measurements.
    srcRoot.quaternion.identity();
    srcRoot.position.set(0, 0, 0);
    srcRoot.scale.set(1, 1, 1);
    srcRoot.updateMatrixWorld(true);
    tgtRoot.updateMatrixWorld(true);
    worldQ.clear();
    worldP.clear();
    for (const obj of ordered) {
      const bind = tgtBind.get(obj.name);
      if (!bind) continue;
      const parent = obj.parent;
      const pq = (parent && worldQ.get(parent)) || bind.worldQuat.clone().multiply(bind.localQuat.clone().invert());
      const pp = (parent && worldP.get(parent)) || bind.worldPos.clone().sub(bind.localPos.clone().applyQuaternion(pq));
      const srcName = rig.map[obj.name];
      const srcObj = srcName ? srcByName.get(srcName) : undefined;
      const srcBindEntry = srcName ? srcBind.get(srcName) : undefined;
      let wq: THREE.Quaternion;
      let wp: THREE.Vector3;
      if (srcObj && srcBindEntry) {
        const sw = new THREE.Quaternion();
        animRootSpace(srcRoot, srcObj).decompose(new THREE.Vector3(), sw, new THREE.Vector3());
        const delta = sw.multiply(srcBindEntry.worldQuat.clone().invert());
        const deltaT = corr.clone().multiply(delta).multiply(corrInv);
        wq = deltaT.multiply(bind.worldQuat);
        if (obj.name === ANIM_HIPS_T) {
          const sp = new THREE.Vector3();
          animRootSpace(srcRoot, srcObj).decompose(sp, new THREE.Quaternion(), new THREE.Vector3());
          const d = sp.sub(srcBindEntry.worldPos).applyQuaternion(corr).multiplyScalar(hipScale);
          wp = bind.worldPos.clone().add(d);
        } else {
          wp = pp.clone().add(bind.localPos.clone().applyQuaternion(pq));
        }
      } else {
        wq = pq.clone().multiply(bind.localQuat);
        wp = pp.clone().add(bind.localPos.clone().applyQuaternion(pq));
      }
      worldQ.set(obj, wq);
      worldP.set(obj, wp);
      if (srcName && srcBindEntry) {
        const local = pq.clone().invert().multiply(wq);
        let arr = quatData.get(obj.name);
        if (!arr) {
          arr = new Float32Array(frames * 4);
          quatData.set(obj.name, arr);
        }
        arr[f * 4] = local.x;
        arr[f * 4 + 1] = local.y;
        arr[f * 4 + 2] = local.z;
        arr[f * 4 + 3] = local.w;
        if (obj.name === ANIM_HIPS_T) {
          // Hip local position through the parent's animated frame.
          tmpM.compose(pp, pq, one).invert();
          const lp = wp.clone().applyMatrix4(tmpM);
          hipPos[f * 3] = lp.x;
          hipPos[f * 3 + 1] = lp.y;
          hipPos[f * 3 + 2] = lp.z;
        }
      }
    }
  }
  mixer.uncacheAction(srcClip);
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [name, vals] of quatData) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, vals));
  }
  tracks.push(new THREE.VectorKeyframeTrack(`${ANIM_HIPS_T}.position`, times, hipPos));
  return {
    clip: new THREE.AnimationClip(`${srcClip.name}->vrm`, frames / fps, tracks),
    srcHipHeight: srcHipsBind.worldPos.y,
  };
}

/** One sampled moment of a baked clip posed on the real model: the
 *  world-space Y of each limb's direction (-1 = pointing straight
 *  down, +1 = straight up), the head's height above the hips, and
 *  whether every measured position was finite. A missing or
 *  degenerate limb reports NaN, callers must treat ANY non-finite
 *  measurement as a failure, never as a pass. (The old gate compared
 *  with `v > -0.35`, which NaN silently slips past, and a single
 *  NaN track in a blended mixer collapses the whole skinned body,
 *  which is how a character can end up invisible.) */
interface ClipMeasure {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  headAboveHips: number;
  /** Upper-arm joint height above the chest joint (world units),
   *  the shoulder-pivot check: at bind this is ≈ +0.23 for both
   *  bodies (the arm pivots from the clavicle, top of the torso).
   *  A pivot that has slipped to the ribs measures ≈ 0 or less. */
  pivotHeightL: number;
  pivotHeightR: number;
  /** Shoulder -> upper-arm joint distance (world units). Nothing
   *  in a baked clip animates joint offsets, so this must stay at
   *  its bind value; a drift means the arm chain's positions, not
   *  just its rotations, were baked from a wrong skeleton state. */
  pivotDistL: number;
  pivotDistR: number;
  finite: boolean;
}

/** Pose the model with a baked clip at each of `times` and measure
 *  where its limbs actually point. Restores the model's prior pose
 *  afterwards, whatever happens. */
function measureRetargetedClip(
  model: THREE.Object3D,
  clip: THREE.AnimationClip,
  times: number[],
): ClipMeasure[] {
  const saved = new Map<THREE.Object3D, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  for (const track of clip.tracks) {
    const boneName = track.name.split(".")[0] ?? "";
    const obj = model.getObjectByName(boneName);
    if (obj && !saved.has(obj)) saved.set(obj, { q: obj.quaternion.clone(), p: obj.position.clone() });
  }
  const posOf = (name: string): THREE.Vector3 | null => {
    const o = model.getObjectByName(name);
    if (!o) return null;
    const v = new THREE.Vector3();
    o.getWorldPosition(v);
    return v;
  };
  const dirY = (a: string, b: string): number => {
    const pa = posOf(a);
    const pb = posOf(b);
    if (!pa || !pb) return NaN;
    const d = pb.sub(pa);
    return d.lengthSq() > 0 ? d.normalize().y : NaN;
  };
  const out: ClipMeasure[] = [];
  try {
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clip).play();
    for (const at of times) {
      mixer.setTime(at);
      model.updateWorldMatrix(true, true);
      const hips = posOf("J_Bip_C_Hips");
      const head = posOf("J_Bip_C_Head");
      const chest = posOf("J_Bip_C_Chest");
      const shL = posOf("J_Bip_L_Shoulder");
      const shR = posOf("J_Bip_R_Shoulder");
      const uaL = posOf("J_Bip_L_UpperArm");
      const uaR = posOf("J_Bip_R_UpperArm");
      const m: ClipMeasure = {
        legL: dirY("J_Bip_L_UpperLeg", "J_Bip_L_LowerLeg"),
        legR: dirY("J_Bip_R_UpperLeg", "J_Bip_R_LowerLeg"),
        armL: dirY("J_Bip_L_UpperArm", "J_Bip_L_LowerArm"),
        armR: dirY("J_Bip_R_UpperArm", "J_Bip_R_LowerArm"),
        headAboveHips: hips && head ? head.y - hips.y : NaN,
        pivotHeightL: chest && uaL ? uaL.y - chest.y : NaN,
        pivotHeightR: chest && uaR ? uaR.y - chest.y : NaN,
        pivotDistL: shL && uaL ? shL.distanceTo(uaL) : NaN,
        pivotDistR: shR && uaR ? shR.distanceTo(uaR) : NaN,
        finite: false,
      };
      m.finite =
        Number.isFinite(m.legL) &&
        Number.isFinite(m.legR) &&
        Number.isFinite(m.armL) &&
        Number.isFinite(m.armR) &&
        Number.isFinite(m.headAboveHips) &&
        Number.isFinite(m.pivotHeightL) &&
        Number.isFinite(m.pivotHeightR) &&
        Number.isFinite(m.pivotDistL) &&
        Number.isFinite(m.pivotDistR) &&
        !!hips &&
        Number.isFinite(hips.x + hips.y + hips.z);
      out.push(m);
    }
    mixer.uncacheAction(clip);
  } catch {
    out.length = 0;
  }
  for (const [obj, s] of saved) {
    obj.quaternion.copy(s.q);
    obj.position.copy(s.p);
  }
  return out;
}

/** Numeric sanity check on a baked idle clip before it is trusted.
 *  Legs and arms are judged SEPARATELY: a clip whose legs are right
 *  but whose arms are wrong must not take the whole animator down
 *  with it, the caller strips just the arm tracks and lets the
 *  procedural arm posing (which runs earlier every frame) own the
 *  arms instead. Thresholds from measuring the real models: a clean
 *  bake puts both upper arms at dirY -0.78..-0.93 in idle, while the
 *  old capture-pose bake (arms already procedurally lowered when the
 *  "bind" was read) landed at -0.59..-0.66, arms splayed, hands
 *  sticking out. -0.7 sits between those two populations. */
function checkRetargetedClip(
  model: THREE.Object3D,
  clip: THREE.AnimationClip,
): { finite: boolean; legsOk: boolean; armsOk: boolean; bodyOk: boolean; pivotOk: boolean } {
  // Bind reference for the pivot check, read from the model as it
  // stands NOW, the caller restores the true bind pose before
  // gating, so these distances are the skeleton's own truth.
  model.updateWorldMatrix(true, true);
  const jointDist = (a: string, b: string): number => {
    const oa = model.getObjectByName(a);
    const ob = model.getObjectByName(b);
    if (!oa || !ob) return NaN;
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();
    oa.getWorldPosition(pa);
    ob.getWorldPosition(pb);
    return pa.distanceTo(pb);
  };
  const bindDistL = jointDist("J_Bip_L_Shoulder", "J_Bip_L_UpperArm");
  const bindDistR = jointDist("J_Bip_R_Shoulder", "J_Bip_R_UpperArm");
  const ms = measureRetargetedClip(model, clip, [0.3, 1.4]);
  const finite = ms.length > 0 && ms.every((m) => m.finite);
  return {
    finite,
    legsOk: finite && ms.every((m) => m.legL <= -0.35 && m.legR <= -0.35),
    armsOk: finite && ms.every((m) => m.armL <= -0.7 && m.armR <= -0.7),
    bodyOk: finite && ms.every((m) => m.headAboveHips > 0.3),
    // The arms must pivot FROM THE SHOULDER: the upper-arm joint
    // stays at clavicle height (well above the chest joint, where
    // bind puts it at ≈ +0.23 world units for both bodies, rib
    // height would be ≈ 0) and at its bind distance from the
    // shoulder joint. A failed pivot retires the whole animator,
    // because the procedural fallback never touches the chest or
    // shoulder chain at all, so its pivots are the bind's own.
    pivotOk:
      finite &&
      Number.isFinite(bindDistL) &&
      Number.isFinite(bindDistR) &&
      ms.every(
        (m) =>
          m.pivotHeightL >= 0.1 &&
          m.pivotHeightR >= 0.1 &&
          Math.abs(m.pivotDistL - bindDistL) <= bindDistL * 0.35 &&
          Math.abs(m.pivotDistR - bindDistR) <= bindDistR * 0.35,
      ),
  };
}

/** True when every keyframed value in the clip is a finite number.
 *  A blended mixer samples even weight-0 actions, so one NaN frame
 *  in ANY clip (a run or wave clip the idle gate never sees) can
 *  poison every bone it touches, such clips are dropped whole. */
function clipHasFiniteValues(clip: THREE.AnimationClip): boolean {
  for (const track of clip.tracks) {
    const values = track.values as ArrayLike<number>;
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) return false;
    }
  }
  return true;
}

const ARM_TRACK_BONES = new Set([
  "J_Bip_L_Shoulder",
  "J_Bip_R_Shoulder",
  "J_Bip_L_UpperArm",
  "J_Bip_R_UpperArm",
  "J_Bip_L_LowerArm",
  "J_Bip_R_LowerArm",
  "J_Bip_L_Hand",
  "J_Bip_R_Hand",
]);

/** Remove the arm chains' tracks from a baked clip, leaving its
 *  legs, spine, and hips untouched. With no arm tracks the mixer
 *  never writes the arm bones, so the procedural posing that runs
 *  earlier each frame (arms lowered to the sides, the softened
 *  greeting wave) owns them outright. */
function stripArmTracks(clip: THREE.AnimationClip) {
  clip.tracks = clip.tracks.filter((t) => !ARM_TRACK_BONES.has(t.name.split(".")[0] ?? ""));
}

/** Pin a baked clip's hip XZ to its first frame, keeping the Y
 *  profile. The Outdoor SEATED clips were authored with the sitter
 *  travelling to an imagined bench (≈0.4 m of root drift, measured);
 *  the town's own sit clip carries zero XZ drift because the SCENE
 *  owns seat placement. Pinning makes the library's seated clips
 *  behave the same way: the pose (legs, spine, gesture) is theirs,
 *  the placement stays the bench slot's. */
function pinHipXZInPlace(clip: THREE.AnimationClip) {
  const track = clip.tracks.find((t) => t.name === `${ANIM_HIPS_T}.position`);
  if (!track) return;
  const v = track.values as ArrayLike<number> as Float32Array;
  const x0 = v[0] ?? 0;
  const z0 = v[2] ?? 0;
  for (let i = 0; i + 2 < v.length; i += 3) {
    v[i] = x0;
    v[i + 2] = z0;
  }
}

type CharMode = "dance" | "poseA" | "poseB" | "talk" | "flirt" | "hug" | "jumpUp" | "jumpFall" | "jumpLand" | "slide" | null;

export interface CharAnimator {
  /** The core clips are baked and the body can be shown animated. The
   *  rest of the library keeps arriving behind it (see createCharAnimator). */
  ready: boolean;
  /** The core clips will never be ready: procedural posing owns the body. */
  failed: boolean;
  /** Verbatim "Name: message" of the error that retired this animator,
   *  when the failure arrived as a thrown error. Null while the animator
   *  is fine, and null when a gate retired it quietly (nothing was
   *  thrown, so there is nothing honest to quote). */
  failureReason: string | null;
  /** Core actions that were asked for (a URL was supplied) but never
   *  earned an action, named the way the menu's motion line names them:
   *  "walk", "run", "jump start", "jump air", "jump land", "slide".
   *  Filled as each stage settles; final once librarySettled is true.
   *  (Idle is not on this list: without idle the animator is failed,
   *  not partial.) */
  missingActions: string[];
  /** Stage two has finished arriving, or failed trying: the
   *  missingActions list is final and the animator's story is complete. */
  librarySettled: boolean;
  hasWave: boolean;
  hasSit: boolean;
  /** Festival dance + Sounds-house pose loops (Kevin Iglesias dance
   *  pack, retargeted like the basic motions). The dance gate is
   *  deliberately looser than idle's, a dance legitimately lifts
   *  arms and leaves the ground plane of an idle's thresholds, it
   *  still demands finite values, an upright body, and a sane pivot. */
  hasDance: boolean;
  danceDuration: number;
  /** Outdoor pair clips (flirt / hug): both bodies must have the
   *  clip before the scene stages the moment; the scene plays them
   *  for the shorter of the two durations. */
  hasPair: (kind: "flirt" | "hug") => boolean;
  pairDuration: (kind: "flirt" | "hug") => number;
  update: (dt: number, speed: number, waving: boolean, seated?: boolean, mode?: CharMode, benchSeated?: boolean) => void;
  /** Apply the idle clip NOW, so a body revealed in the same tick is
   *  already standing in its idle pose, never the bind pose, never a
   *  leftover measurement pose from the bake. No-op until the animator
   *  is ready. */
  prime: () => void;
}

const animFbxLoader = new FBXLoader();

/** Load a character's clips, retarget them onto the model, and build
 *  the speed-blended mixer. Everything is failure-tolerant, and the
 *  failure is logged, never hidden: if anything does not check out,
 *  `ready` stays false, `failed` goes true, and the caller keeps the
 *  procedural posing, the model itself is rendered either way, so a
 *  failed gate can never make a character invisible.
 *
 *  It comes in two stages. The core set (idle, walk, run, wave, sit) is
 *  all a character needs to stand and move, so `ready` goes true as
 *  soon as those are in; the old code waited for the whole library,
 *  dozens of files baked one at a time, which outlasted the reveal
 *  gate's grace and showed the body mid-bake. The rest then join the
 *  live mixer one by one as they arrive.
 *
 *  The bake's "bind pose" is read from a snapshot taken HERE, at
 *  animator creation, while the model still stands in its true
 *  bind pose. That timing matters: the load handler lowers the arms
 *  procedurally the moment this returns, and the frame loop keeps
 *  posing the whole body while the FBX files download, the old
 *  code read the bind fresh inside each bake, so it baked the
 *  clips on top of an already-posed skeleton (the arms' lowering
 *  delta applied twice, splaying them out sideways, hands forever
 *  sticking out). The snapshot is restored before every bake and
 *  before the gate measures, so a bake never sees a posed bone. */
const LIBRARY_PATIENCE_MS = 20000;
const SLIDE_SEC = 0.75;

export function createCharAnimator(args: {
  model: THREE.Object3D;
  resources: SceneResources;
  /** The walker is moving: a clip parse now would be felt in the stick. */
  isBusy?: () => boolean;
  urls: {
    idle: string; walk: string; run: string; wave: string; sit: string; dance?: string; poseA?: string; poseB?: string;
    /** Outdoor library sets (rig: OUTDOOR_RIG). talk = standing
     *  conversation gestures, cycled no-repeat while the talk bubble
     *  is open; sitTalk = the same idea seated; benchSit = bench
     *  idle variety while bench-seated; flirt/hug = one-shot pair
     *  clips the scene stages only inside already-gated moments. */
    outdoor?: { talk: string[]; sitTalk: string[]; benchSit: string[]; flirt?: string; hug?: string };
    /** His hop, in three parts. Their motion is his own: the scene lifts him. */
    jump?: { start: string; air: string; end: string };
    slide?: string;
  };
}): CharAnimator {
  const { model, urls } = args;
  const out: CharAnimator = {
    ready: false,
    failed: false,
    failureReason: null,
    missingActions: [],
    librarySettled: false,
    hasWave: false,
    hasSit: false,
    hasDance: false,
    danceDuration: 0,
    hasPair: () => false,
    pairDuration: () => 0,
    update: () => {},
    prime: () => {},
  };
  const bindPose = new Map<THREE.Object3D, { q: THREE.Quaternion; p: THREE.Vector3 }>();
  model.traverse((o) => {
    bindPose.set(o, { q: o.quaternion.clone(), p: o.position.clone() });
  });
  const restoreBindPose = () => {
    for (const [o, s] of bindPose) {
      o.quaternion.copy(s.q);
      o.position.copy(s.p);
    }
  };
  /** Run a synchronous bake or measurement against the true bind pose,
   *  then put the body back exactly as it stood. Nothing can paint in
   *  between, so a character already on screen never shows it. */
  const onBindPose = <T>(work: () => T): T => {
    const live = new Map<THREE.Object3D, { q: THREE.Quaternion; p: THREE.Vector3 }>();
    for (const o of bindPose.keys()) live.set(o, { q: o.quaternion.clone(), p: o.position.clone() });
    restoreBindPose();
    try {
      return work();
    } finally {
      for (const [o, s] of live) {
        o.quaternion.copy(s.q);
        o.position.copy(s.p);
      }
    }
  };
  void (async () => {
    try {
      // Displayed hip height (world units) for authored-speed scaling:
      // the model's native hip height times its world scale.
      model.updateWorldMatrix(true, true);
      const scaleV = new THREE.Vector3();
      model.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scaleV);
      const hipsBind = collectAnimBind(model, [ANIM_HIPS_T]).get(ANIM_HIPS_T);
      if (!hipsBind) return;
      const displayedHip = hipsBind.worldPos.y * scaleV.x;

      let srcHipMeters = 0;
      const loadClip = async (url: string, rig: AnimRigSpec = IGLESIAS_RIG): Promise<THREE.AnimationClip | null> => {
        if (args.resources.disposed) throw new Error("Scene disposed");
        const bytes = await takeClipBytes(url);
        if (args.resources.disposed) throw new Error("Scene disposed");
        const group = animFbxLoader.parse(bytes, THREE.LoaderUtils.extractUrlBase(url));
        const clipResources = new SceneResources();
        clipResources.adopt(group);
        try {
          if (args.resources.disposed) throw new Error("Scene disposed");
          const src = group.animations[0];
          if (!src) return null;
          // The frame loop has been posing this body while the file
          // downloaded; the bake must read its true bind (see the note
          // above).
          const baked = onBindPose(() => bakeRetargetedClip(group, src, model, rig));
          if (!baked) return null;
          if (srcHipMeters === 0) srcHipMeters = baked.srcHipHeight / 100;
          // A clip carrying even one non-finite value can poison the
          // blended mixer and collapse the body, drop it whole.
          if (!clipHasFiniteValues(baked.clip)) return null;
          return baked.clip;
        } finally {
          clipResources.dispose();
        }
      };
      // The core set downloads side by side; the bakes stay in turn.
      for (const url of [urls.idle, urls.walk, urls.run, urls.wave, urls.sit]) {
        fetchClipBytes(url).catch(() => {
          /* loadClip below surfaces the failure */
        });
      }
      const idle = await loadClip(urls.idle);
      if (!idle) return;
      const walk = await loadClip(urls.walk);
      const run = await loadClip(urls.run);
      let wave = await loadClip(urls.wave);
      let sit = await loadClip(urls.sit);
      if (srcHipMeters <= 0) return;
      // The gate measures the idle clip on the true bind pose. Legs
      // or body failing (or anything non-finite) retires the whole
      // animator to procedural posing; ARMS failing only retires
      // the arms (below), never the character.
      const check = onBindPose(() => checkRetargetedClip(model, idle));
      if (!check.finite || !check.legsOk || !check.bodyOk || !check.pivotOk) return;
      let useWave = wave !== null;
      if (!check.armsOk) {
        // Per-arm fallback: strip the arm chains from every clip.
        // The mixer then never writes the arm bones, the procedural
        // posing owns them (arms hang at the sides, swing with the
        // stride), and greetings use the procedural wave, a wave
        // clip without trustworthy arms is no wave at all.
        stripArmTracks(idle);
        if (walk) stripArmTracks(walk);
        if (run) stripArmTracks(run);
        if (sit) stripArmTracks(sit);
        wave = null;
        useWave = false;
      } else if (wave) {
        // The wave earns its place only if it truly raises an arm:
        // sampled mid-gesture, one upper arm must point UP, not
        // merely leave the body's side.
        const waveClip = wave;
        const wm = onBindPose(() => measureRetargetedClip(model, waveClip, [1.0, 1.4]));
        const raised = wm.some((m) => m.finite && (m.armL > 0.15 || m.armR > 0.15));
        if (!raised) {
          wave = null;
          useWave = false;
        }
      }
      // The sit clip earns its place only if it truly SEATS the
      // body: sampled across the loop, both thighs must point
      // mostly FORWARD (direction Y near 0), not down like a
      // standing leg (Y ≈ -1). A failed gate just means sitting
      // falls back to the procedural seated pose, never a broken
      // or standing-in-the-bench sit.
      let useSit = false;
      if (sit) {
        const sitClip = sit;
        const sm = onBindPose(() => measureRetargetedClip(model, sitClip, [0.4, 0.9, 1.4]));
        useSit =
          sm.length > 0 && sm.every((m) => m.finite && m.legL > -0.45 && m.legR > -0.45);
        if (!useSit) sit = null;
      }
      const walkTown = ANIM_WALK_MPS * (displayedHip / srcHipMeters);
      const runTown = ANIM_RUN_MPS * (displayedHip / srcHipMeters);

      if (args.resources.disposed) return;
      const mixer = new THREE.AnimationMixer(model);
      args.resources.track({ dispose: () => { mixer.stopAllAction(); mixer.uncacheRoot(model); } });
      const mk = (clip: THREE.AnimationClip | null) => {
        if (!clip) return null;
        const a = mixer.clipAction(clip);
        a.setLoop(THREE.LoopRepeat, Infinity);
        a.enabled = true;
        a.weight = 0;
        a.play();
        return a;
      };
      const idleA = mk(idle);
      const walkA = mk(walk);
      const runA = mk(run);
      const waveA = mk(useWave ? wave : null);
      const sitA = mk(useSit ? sit : null);
      let danceA: THREE.AnimationAction | null = null;
      let poseAA: THREE.AnimationAction | null = null;
      let poseBA: THREE.AnimationAction | null = null;
      const mkOnce = (clip: THREE.AnimationClip | null, clamp: boolean) => {
        if (!clip) return null;
        const a = mixer.clipAction(clip);
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = clamp;
        a.enabled = true;
        a.weight = 0;
        a.play();
        return a;
      };
      const talkActs: THREE.AnimationAction[] = [];
      const sitTalkActs: THREE.AnimationAction[] = [];
      const benchActs: THREE.AnimationAction[] = [];
      let flirtClip: THREE.AnimationClip | null = null;
      let hugClip: THREE.AnimationClip | null = null;
      let flirtA: THREE.AnimationAction | null = null;
      let hugA: THREE.AnimationAction | null = null;
      let jumpUpA: THREE.AnimationAction | null = null;
      let jumpAirA: THREE.AnimationAction | null = null;
      let jumpLandA: THREE.AnimationAction | null = null;
      let slideA: THREE.AnimationAction | null = null;
      out.hasPair = (kind) => (kind === "flirt" ? flirtA : hugA) !== null;
      out.pairDuration = (kind) => (kind === "flirt" ? flirtClip : hugClip)?.duration ?? 0;
      if (!idleA) return;
      idleA.weight = 1;
      out.hasWave = useWave && waveA !== null;
      out.hasSit = sitA !== null;
      if (!walkA) out.missingActions.push("walk");
      if (!runA) out.missingActions.push("run");

      const weights = { idle: 1, walk: 0, run: 0, wave: 0, sit: 0, dance: 0, pose: 0, talk: 0, sitTalk: 0, bench: 0, pair: 0, jump: 0 };
      let prevWaving = false;
      let prevMode: string | null = null;
      let poseFlipAt = 0;
      let benchFlipAt = 0;
      let benchActive = 0;
      // Shuffled-bag cycling for the talk gesture families: no clip
      // repeats until the bag is spent, and the clip just played is
      // kept out of the next bag's first slot.
      const shuffleBag = (n: number, avoidFirst: number): number[] => {
        const arr = Array.from({ length: n }, (_, i) => i);
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = arr[i]!;
          arr[i] = arr[j]!;
          arr[j] = tmp;
        }
        if (n > 1 && arr[0] === avoidFirst) {
          const tmp = arr[0]!;
          arr[0] = arr[1]!;
          arr[1] = tmp;
        }
        return arr;
      };
      const makeBag = (acts: THREE.AnimationAction[]) => {
        let order: number[] = [];
        let ptr = 0;
        let startedAt = 0;
        const start = (now: number) => {
          order = shuffleBag(acts.length, -1);
          ptr = 0;
          startedAt = now;
          const a = acts[order[0] ?? 0];
          if (a) a.time = 0;
        };
        const active = (now: number): THREE.AnimationAction | null => {
          if (acts.length === 0) return null;
          if (order.length === 0) start(now);
          let a = acts[order[ptr] ?? 0] ?? null;
          if (a && now - startedAt > a.getClip().duration * 1000 - 250) {
            const last = order[ptr] ?? 0;
            ptr++;
            if (ptr >= order.length) {
              order = shuffleBag(acts.length, last);
              ptr = 0;
            }
            startedAt = now;
            a = acts[order[ptr] ?? 0] ?? null;
            if (a) a.time = 0;
          }
          return a;
        };
        return { start, active };
      };
      const talkBag = makeBag(talkActs);
      const sitTalkBag = makeBag(sitTalkActs);
      const ss = (a: number, b: number, x: number) => {
        const k = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
        return k * k * (3 - 2 * k);
      };
      out.update = (dt: number, speed: number, waving: boolean, seated = false, mode: CharMode = null, benchSeated = false) => {
        const step = Math.min(dt, 0.05);
        const idleT = 1 - ss(0.12, 0.55, speed);
        const runT = ss(3.1, 3.9, speed);
        const walkT = Math.max(0, 1 - idleT - runT);
        const waveT = waving && waveA ? 1 : 0;
        const sitT = seated && sitA ? 1 : 0;
        const danceT = mode === "dance" && danceA ? 1 : 0;
        const poseT = (mode === "poseA" || mode === "poseB") && (poseAA || poseBA) ? 1 : 0;
        // Outdoor families. Talk gestures own the body only while
        // standing (nearly) still, walk-and-talk keeps the walk,
        // and the gestures take over when the pair stops. Seated
        // talk swaps the plain sit for the seated gesture clips;
        // bench idles own bench time when nobody is talking.
        const pairT = (mode === "flirt" && flirtA) || (mode === "hug" && hugA) ? 1 : 0;
        const talkT = mode === "talk" && !seated && talkActs.length > 0 && speed < 0.6 ? 1 : 0;
        const sitTalkT = mode === "talk" && seated && sitTalkActs.length > 0 ? 1 : 0;
        const benchT = seated && benchSeated && mode !== "talk" && benchActs.length > 0 ? 1 : 0;
        const jumpMode = mode === "jumpUp" ? jumpUpA : mode === "jumpFall" ? jumpAirA : mode === "jumpLand" ? jumpLandA : mode === "slide" ? slideA : null;
        weights.jump += ((jumpMode ? 1 : 0) - weights.jump) * (1 - Math.exp(-step * 22));
        const locoRate = 1 - Math.exp(-step * 7);
        const waveRate = 1 - Math.exp(-step * 10);
        const sitRate = 1 - Math.exp(-step * 6);
        weights.idle += (idleT - weights.idle) * locoRate;
        weights.walk += (walkT - weights.walk) * locoRate;
        weights.run += (runT - weights.run) * locoRate;
        weights.wave += (waveT - weights.wave) * waveRate;
        weights.sit += (sitT - weights.sit) * sitRate;
        weights.dance += (danceT - weights.dance) * sitRate;
        weights.pose += (poseT - weights.pose) * sitRate;
        weights.talk += (talkT - weights.talk) * sitRate;
        weights.sitTalk += (sitTalkT - weights.sitTalk) * sitRate;
        weights.bench += (benchT - weights.bench) * sitRate;
        weights.pair += (pairT - weights.pair) * sitRate;
        if (waving && !prevWaving && waveA) waveA.time = 0;
        prevWaving = waving;
        // The pair starts the step together: entering dance mode
        // rewinds her clip and his in the same frame.
        if (mode === "dance" && prevMode !== "dance" && danceA) danceA.time = 0;
        // Pair moments likewise: both clips rewind on entry and
        // clamp on their final frame until the scene releases them.
        if ((mode === "flirt" || mode === "hug") && prevMode !== mode) {
          const a = mode === "flirt" ? flirtA : hugA;
          if (a) a.time = 0;
        }
        // reset, not a rewind: a one-shot that has run out stays finished otherwise.
        if (jumpMode && prevMode !== mode) jumpMode.reset();
        if (mode === "talk" && prevMode !== "talk") {
          talkBag.start(performance.now());
          sitTalkBag.start(performance.now());
        }
        if ((mode === "poseA" || mode === "poseB") && prevMode !== mode) {
          const a = mode === "poseA" ? poseAA : poseBA;
          if (a) a.time = 0;
          poseFlipAt = performance.now() + 9000 + Math.random() * 6000;
        }
        prevMode = mode;
        // Her Sounds-house variety: alternate the two pose loops
        // every little while without the shell knowing or caring.
        let activePose = mode === "poseA" ? poseAA : mode === "poseB" ? poseBA : null;
        if ((mode === "poseA" || mode === "poseB") && performance.now() > poseFlipAt) {
          activePose = activePose === poseAA ? poseBA : poseAA;
          poseFlipAt = performance.now() + 9000 + Math.random() * 6000;
        }
        const locoScale = (1 - weights.wave) * (1 - weights.sit) * (1 - weights.dance) * (1 - weights.pose) * (1 - weights.talk) * (1 - weights.sitTalk) * (1 - weights.bench) * (1 - weights.pair) * (1 - weights.jump);
        idleA.weight = weights.idle * locoScale;
        if (walkA) {
          walkA.weight = weights.walk * locoScale;
          walkA.timeScale = THREE.MathUtils.clamp(speed / Math.max(0.4, walkTown), 0.7, 1.9);
        }
        if (runA) {
          runA.weight = weights.run * locoScale;
          runA.timeScale = THREE.MathUtils.clamp(speed / Math.max(0.4, runTown), 0.7, 1.6);
        }
        if (waveA) waveA.weight = weights.wave * (1 - weights.sit) * (1 - weights.pair);
        if (sitA) sitA.weight = weights.sit * (1 - weights.sitTalk) * (1 - weights.bench);
        if (danceA) danceA.weight = weights.dance;
        if (poseAA) poseAA.weight = poseAA === activePose ? weights.pose : 0;
        if (poseBA) poseBA.weight = poseBA === activePose ? weights.pose : 0;
        const nowMs = performance.now();
        const activeTalk = talkT ? talkBag.active(nowMs) : null;
        for (const a of talkActs) a.weight = a === activeTalk ? weights.talk : 0;
        const activeSitTalk = sitTalkT ? sitTalkBag.active(nowMs) : null;
        for (const a of sitTalkActs) a.weight = a === activeSitTalk ? weights.sitTalk : 0;
        if (benchT && benchFlipAt === 0) benchFlipAt = nowMs + 12000 + Math.random() * 6000;
        if (benchT && nowMs > benchFlipAt) {
          benchActive = (benchActive + 1) % Math.max(1, benchActs.length);
          benchFlipAt = nowMs + 12000 + Math.random() * 6000;
        }
        if (!benchT) benchFlipAt = 0;
        const activeBench = benchT ? benchActs[benchActive] ?? null : null;
        for (const a of benchActs) a.weight = a === activeBench ? weights.bench : 0;
        if (flirtA) flirtA.weight = mode === "flirt" ? weights.pair : 0;
        if (hugA) hugA.weight = mode === "hug" ? weights.pair : 0;
        for (const a of [jumpUpA, jumpAirA, jumpLandA, slideA]) {
          if (a) a.weight = a === jumpMode ? weights.jump : 0;
        }
        mixer.update(step);
      };
      out.prime = () => {
        // Reveal path: apply the idle clip so the skeleton stands in
        // a true idle pose before the body is shown. Two steps settle
        // the weight lerps. (Clips start at full weight, always: the
        // old fade-in ramp left the mixer blending in the bones'
        // original values, and those are the T-pose, so a body shown
        // before its clips landed visibly lifted its arms.)
        out.update(1 / 30, 0, false);
        out.update(1 / 30, 0, false);
      };
      out.ready = true;

      // Stage two: the character is live; the rest of the library joins
      // the running mixer as it arrives, each behind its own gate.
      // Dance + pose clips: same bake, a gate fitted to dancing,
      // finite, upright, sane pivot; arms and legs may go where the
      // music takes them.
      const passes = (clip: THREE.AnimationClip): boolean => {
        const c = onBindPose(() => checkRetargetedClip(model, clip));
        return c.finite && c.bodyOk && c.pivotOk;
      };
      // Nothing waits on the library the moment the town appears, and each
      // parse holds the frame, so a clip takes its turn while he stands
      // still, however long a walk runs short of LIBRARY_PATIENCE_MS.
      const quietTurn = async (): Promise<void> => {
        const deadline = performance.now() + LIBRARY_PATIENCE_MS;
        do {
          await new Promise((resolve) => window.setTimeout(resolve, 400));
        } while (args.isBusy?.() && performance.now() < deadline && !args.resources.disposed);
      };
      const lenient = async (url?: string): Promise<THREE.AnimationClip | null> => {
        if (!url) return null;
        await quietTurn();
        const clip = await loadClip(url);
        return clip && passes(clip) ? clip : null;
      };
      // Fit for a body brought low: a slide or a landing folds him far past
      // what the standing gates allow, so only broken numbers are refused.
      const action = async (url?: string): Promise<THREE.AnimationClip | null> => {
        if (!url) return null;
        await quietTurn();
        const clip = await loadClip(url);
        return clip && onBindPose(() => checkRetargetedClip(model, clip)).finite ? clip : null;
      };
      // First in line: a press of the jump button is likelier than a dance.
      // A clip the bake refuses earns no action, and nothing throws:
      // the refusal is recorded by name, so the menu's motion line can
      // say "jump missing" instead of reporting full motion over a
      // jump that does not exist. (That false "full" is how the
      // wrong-pack jump clips hid through the v0.6.1 build.)
      if (urls.jump) {
        jumpUpA = mkOnce(await lenient(urls.jump.start), true);
        // Hurried, so the crouch-and-spring fits the rise of a short hop.
        if (jumpUpA) jumpUpA.timeScale = jumpUpA.getClip().duration / 0.28;
        else out.missingActions.push("jump start");
        jumpAirA = mk(await lenient(urls.jump.air));
        if (!jumpAirA) out.missingActions.push("jump air");
        jumpLandA = mkOnce(await action(urls.jump.end), true);
        if (!jumpLandA) out.missingActions.push("jump land");
      }
      slideA = mkOnce(await action(urls.slide), true);
      if (slideA) slideA.timeScale = slideA.getClip().duration / SLIDE_SEC;
      else if (urls.slide) out.missingActions.push("slide");
      const dance = await lenient(urls.dance);
      danceA = mk(dance);
      out.hasDance = danceA !== null;
      out.danceDuration = dance?.duration ?? 0;
      poseAA = mk(await lenient(urls.poseA));
      poseBA = mk(await lenient(urls.poseB));
      // Outdoor library clips: same lenient gate (finite, upright
      // body, sane shoulder pivots, a seated clip's head still
      // clears its hips by half a metre), baked through OUTDOOR_RIG.
      // Seated families get their hip XZ pinned (the scene owns
      // seat placement; see pinHipXZInPlace).
      const lenientOutdoor = async (url: string | undefined, pinHipXZ: boolean): Promise<THREE.AnimationClip | null> => {
        if (!url) return null;
        await quietTurn();
        const clip = await loadClip(url, OUTDOOR_RIG);
        if (!clip) return null;
        if (pinHipXZ) pinHipXZInPlace(clip);
        return passes(clip) ? clip : null;
      };
      if (urls.outdoor) {
        for (const u of urls.outdoor.talk) {
          const a = mkOnce(await lenientOutdoor(u, false), false);
          if (a) talkActs.push(a);
        }
        for (const u of urls.outdoor.sitTalk) {
          const a = mkOnce(await lenientOutdoor(u, true), false);
          if (a) sitTalkActs.push(a);
        }
        for (const u of urls.outdoor.benchSit) {
          const a = mk(await lenientOutdoor(u, true));
          if (a) benchActs.push(a);
        }
        flirtClip = await lenientOutdoor(urls.outdoor.flirt, false);
        flirtA = mkOnce(flirtClip, true);
        hugClip = await lenientOutdoor(urls.outdoor.hug, false);
        hugA = mkOnce(hugClip, true);
      }
    } catch (err) {
      // Loud on purpose: this catch used to be silent, and its
      // silence hid a missing slide clip for one release and a
      // frozen town for four. Procedural posing still carries on.
      // The error is also kept verbatim, so the menu's motion line
      // can quote it to the phone's owner, who has no console.
      out.failureReason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error("[muse-town] character clips failed:", err);
    } finally {
      if (!out.ready) out.failed = true;
      out.librarySettled = true;
    }
  })();
  return out;
}

/** Skinned VRM meshes need frustum culling off, or they vanish when their
 *  bind-pose bounds leave the frame. */
export function prepareVrm(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.frustumCulled = false;
      o.castShadow = true;
    }
  });
}

/** Best-effort eyelid morphs (VRoid's Fcl_EYE_Close family), used to let
 *  a character close their eyes for the secret-place kiss. Returns an
 *  empty list when the model has none, posture alone then carries the
 *  moment, exactly as designed. */
export function collectBlinkMorphs(root: THREE.Object3D): { mesh: THREE.Mesh; index: number }[] {
  const out: { mesh: THREE.Mesh; index: number }[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.morphTargetDictionary) {
      for (const [name, index] of Object.entries(o.morphTargetDictionary)) {
        if (/eye/i.test(name) && /close|blink/i.test(name)) out.push({ mesh: o, index });
      }
    }
  });
  return out;
}

export function setBlink(morphs: { mesh: THREE.Mesh; index: number }[], amount: number) {
  for (const m of morphs) {
    if (m.mesh.morphTargetInfluences) m.mesh.morphTargetInfluences[m.index] = amount;
  }
}

