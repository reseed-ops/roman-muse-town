// Gaius's arms (moved out of townScene.ts, Nov 8, 2026).
//
// Gaius's arms (the owner, Nov 8, 2026): the Roman pack's gladius,
// sheathed at his right hip as a legionary wore it, and the
// legionary's scutum slung across his back, face out. Both ride his
// bones (the gladius the hips, the shield the upper chest), so they
// move with every clip; neither is held, which would fight the walk
// and talk clips. The pack has no scabbard, so a plain leather one
// with brass bands is built here and only the hilt shows. They step
// aside where they would pass through someone: both in the bath and
// in the embrace, the shield also while he sits against a bench.
// Task 47 (Nov 8, 2026): the shield is stowed by default, on every load,
// and comes out on his back at a press (RT, or G). The gladius is worn
// by default and LT (or R) stows it or wears it again (Nov 8, 2026).
import * as THREE from "three";

/** `drawn` (Task 131, the sparring bout): the gladius leaves its scabbard for his right hand and the scutum comes off his
 *  back onto his left forearm. */
export type ArmsVisibility = { sword: boolean; shield: boolean; drawn?: boolean };

/** Where each piece would pass through someone, it steps aside. */
export function armsVisibility(state: { bathing: boolean; embracing: boolean; seated: boolean; shieldOut?: boolean; swordWorn?: boolean; drawn?: boolean }): ArmsVisibility {
  return {
    sword: state.swordWorn !== false && !state.bathing && !state.embracing,
    shield: !!state.shieldOut && !state.bathing && !state.embracing && !state.seated,
    drawn: !!state.drawn && !state.bathing && !state.embracing && !state.seated,
  };
}

/** Where the drawn pieces sit in the bone that holds them (his right hand, his left forearm), measured at the guard
 *  pose (sparringStance.ts) and tuned against renders (tools/tour/pose131.ts). Euler XYZ, metres. */
export const HAND_SWORD = { pos: [-0.06, -0.02, 0.0] as [number, number, number], rot: [0, 0, -0.15] as [number, number, number] };
export const FOREARM_SHIELD = { pos: [0.12, 0.0, -0.1] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number], height: 0.8 };

/** The shield's raise as it comes out: from a hand's width low into its
 *  place on his back, over about a quarter second (0 stowed, 1 in place). */
export const SHIELD_RAISE_S = 0.25;
export function shieldRaiseStep(raise: number, shown: boolean, dt: number): number {
  if (!shown) return 0;
  return Math.min(1, raise + dt / SHIELD_RAISE_S);
}

export type GaiusArms = {
  sword: THREE.Group;
  shield: THREE.Group;
  /** Hang both on his loaded body (bind pose); a no-op without the bones. */
  attach(model: THREE.Object3D): void;
  /** The drawn pair: the bare gladius for his right hand and the scutum for his left forearm (Task 131). */
  drawn: { sword: THREE.Group; shield: THREE.Group };
  attachDrawn(model: THREE.Object3D): void;
  /** Show or hide each piece; `dt` (s) eases the shield's raise. */
  setVisible(v: ArmsVisibility, dt?: number): void;
  /** Task 108: while he sits, the sheathed gladius lies along his right thigh, clear of the
   *  seat, instead of hanging blade-down through it; eased over about a quarter second. */
  setSeated(seated: boolean, dt?: number): void;
  /** How far the sword has swung to its seated rest (0 hanging, 1 along the thigh). */
  seatedAmount(): number;
};

/** The seated rest: from hanging (tip down) the blade swings forward about his own X axis
 *  until it points along the thigh and a touch down (radians, about his X axis). */
export const SWORD_SEATED_PITCH = -1.7;
export const SWORD_SEATED_EASE_S = 0.25;

export function createGaiusArms(opts: {
  /** His facing frame (the avatar group: forward +Z, up +Y, his right -X). */
  frame: THREE.Object3D;
  /** The scene's cached model placer. */
  place: (url: string, parent: THREE.Object3D, o: { x: number; z: number; height: number }) => Promise<unknown>;
  gladiusUrl: string;
  shieldUrl: string;
}): GaiusArms {
  const { frame } = opts;
  const sword = new THREE.Group();
  const shield = new THREE.Group();
  shield.visible = false;
  // Drawn for the bout: the bare gladius in his hand, the scutum on his forearm (each rides its bone like the worn pair).
  const handSword = new THREE.Group();
  const handShield = new THREE.Group();
  handSword.visible = false;
  handShield.visible = false;
  let hipGladius: THREE.Object3D | null = null;
  let shieldInner: THREE.Group | null = null;
  let raise = 0;
  let seatedK = 0;
  const bindQ = new THREE.Quaternion();
  const seatedQ = new THREE.Quaternion();
  return {
    sword,
    shield,
    attach(model) {
      const hips = model.getObjectByName("J_Bip_C_Hips");
      const back =
        model.getObjectByName("J_Bip_C_UpperChest") ?? model.getObjectByName("J_Bip_C_Chest") ?? model.getObjectByName("J_Bip_C_Spine");
      if (!hips || !back) return;
      // Offsets are set in his facing frame (the avatar group: forward
      // +Z, up +Y, his right -X), at bind pose, then handed to the bone
      // with attach(), which keeps the world placement.
      const mount = (holder: THREE.Object3D, bone: THREE.Object3D, offset: THREE.Vector3, rot: THREE.Quaternion) => {
        frame.updateWorldMatrix(true, true);
        const at = frame.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
        holder.position.copy(at).add(offset);
        holder.quaternion.copy(rot);
        frame.add(holder);
        holder.updateMatrixWorld(true);
        bone.attach(holder);
      };
      // The gladius, built blade up from the pommel at y 0, then turned
      // blade down so it hangs from the hilt.
      const SWORD_LEN = 0.74;
      const HILT = 0.19;
      const blade = new THREE.Group();
      const leather = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.85 });
      const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.4, metalness: 0.6 });
      const sheath = new THREE.Mesh(new THREE.BoxGeometry(0.075, SWORD_LEN - HILT + 0.02, 0.032), leather);
      sheath.position.y = (HILT + SWORD_LEN + 0.02) / 2;
      const locket = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.035, 0.038), brass);
      locket.position.y = HILT + 0.03;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.025, 0.037), brass);
      band.position.y = HILT + 0.24;
      const chape = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.038), brass);
      chape.position.y = SWORD_LEN;
      for (const m of [sheath, locket, band, chape]) {
        m.castShadow = true;
        blade.add(m);
      }
      void opts.place(opts.gladiusUrl, blade, { x: 0, z: 0, height: SWORD_LEN }).then((g) => { hipGladius = (g as THREE.Object3D | null) ?? null; });
      blade.rotation.z = Math.PI;
      sword.clear();
      sword.add(blade);
      mount(
        sword,
        hips,
        new THREE.Vector3(-0.21, 0.17, 0.08),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, -0.12, "XYZ")),
      );
      // The seated rest, in the hips bone's own frame: the same world swing about his X axis
      // applied to the worn orientation (hipsRel is the bone's bind orientation in his frame).
      {
        frame.updateWorldMatrix(true, true);
        const frameInv = frame.getWorldQuaternion(new THREE.Quaternion()).invert();
        const hipsRel = frameInv.clone().multiply(hips.getWorldQuaternion(new THREE.Quaternion()));
        const swordRel = frameInv.clone().multiply(sword.getWorldQuaternion(new THREE.Quaternion()));
        const swing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), SWORD_SEATED_PITCH);
        bindQ.copy(sword.quaternion);
        seatedQ.copy(hipsRel).invert().multiply(swing).multiply(swordRel);
      }
      // The scutum: centred on the holder, face (boss) turned backward,
      // its curve hugging his back, hung a touch askew like a sling.
      const SHIELD_H = 1.0;
      shieldInner = new THREE.Group();
      shieldInner.position.y = -SHIELD_H / 2;
      void opts.place(opts.shieldUrl, shieldInner, { x: 0, z: 0, height: SHIELD_H });
      shield.clear();
      shield.add(shieldInner);
      mount(
        shield,
        back,
        new THREE.Vector3(0, -0.22, -0.22),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.1)),
      );
    },
    drawn: { sword: handSword, shield: handShield },
    attachDrawn(model) {
      const hand = model.getObjectByName("J_Bip_R_Hand");
      const forearm = model.getObjectByName("J_Bip_L_LowerArm");
      if (!hand || !forearm) return;
      // Holders ride the bones directly; the bone's world scale (the grounded body is scaled) is divided out so the
      // pieces keep their real size.
      const hold = (holder: THREE.Object3D, bone: THREE.Object3D, at: { pos: [number, number, number]; rot: [number, number, number] }) => {
        frame.updateWorldMatrix(true, true);
        const k = 1 / (bone.getWorldScale(new THREE.Vector3()).x || 1);
        holder.scale.setScalar(k);
        holder.position.set(at.pos[0], at.pos[1], at.pos[2]).multiplyScalar(k);
        holder.quaternion.setFromEuler(new THREE.Euler(at.rot[0], at.rot[1], at.rot[2], "XYZ"));
        bone.add(holder);
      };
      const bare = new THREE.Group();
      void opts.place(opts.gladiusUrl, bare, { x: 0, z: 0, height: 0.74 });
      handSword.clear();
      handSword.add(bare);
      bare.position.y = -0.09; // the grip sits in the palm, the pommel just behind it
      hold(handSword, hand, HAND_SWORD);
      const face = new THREE.Group();
      void opts.place(opts.shieldUrl, face, { x: 0, z: 0, height: FOREARM_SHIELD.height });
      handShield.clear();
      handShield.add(face);
      face.position.y = -FOREARM_SHIELD.height / 2;
      hold(handShield, forearm, FOREARM_SHIELD);
    },
    setSeated(seated, dt = 1) {
      seatedK = seated ? Math.min(1, seatedK + dt / SWORD_SEATED_EASE_S) : Math.max(0, seatedK - dt / SWORD_SEATED_EASE_S);
      const e = seatedK * seatedK * (3 - 2 * seatedK);
      sword.quaternion.copy(bindQ).slerp(seatedQ, e);
    },
    seatedAmount() {
      return seatedK;
    },
    setVisible(v, dt = 1) {
      const drawn = !!v.drawn && v.sword;
      sword.visible = v.sword;
      if (hipGladius) hipGladius.visible = !drawn; // only the empty scabbard stays at his hip
      handSword.visible = drawn;
      const held = !!v.drawn && v.shield;
      shield.visible = v.shield && !held;
      handShield.visible = held;
      raise = shieldRaiseStep(raise, v.shield, dt);
      if (shieldInner) {
        const e = raise * raise * (3 - 2 * raise);
        shieldInner.position.y = -0.5 - 0.12 * (1 - e);
      }
    },
  };
}
