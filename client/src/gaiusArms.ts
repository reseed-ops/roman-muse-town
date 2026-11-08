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

export type ArmsVisibility = { sword: boolean; shield: boolean };

/** Where each piece would pass through someone, it steps aside. */
export function armsVisibility(state: { bathing: boolean; embracing: boolean; seated: boolean; shieldOut?: boolean; swordWorn?: boolean }): ArmsVisibility {
  return {
    sword: state.swordWorn !== false && !state.bathing && !state.embracing,
    shield: !!state.shieldOut && !state.bathing && !state.embracing && !state.seated,
  };
}

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
  /** Show or hide each piece; `dt` (s) eases the shield's raise. */
  setVisible(v: ArmsVisibility, dt?: number): void;
};

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
  let shieldInner: THREE.Group | null = null;
  let raise = 0;
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
      void opts.place(opts.gladiusUrl, blade, { x: 0, z: 0, height: SWORD_LEN });
      blade.rotation.z = Math.PI;
      sword.clear();
      sword.add(blade);
      mount(
        sword,
        hips,
        new THREE.Vector3(-0.21, 0.17, 0.08),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, -0.12, "XYZ")),
      );
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
    setVisible(v, dt = 1) {
      sword.visible = v.sword;
      shield.visible = v.shield;
      raise = shieldRaiseStep(raise, v.shield, dt);
      if (shieldInner) {
        const e = raise * raise * (3 - 2 * raise);
        shieldInner.position.y = -0.5 - 0.12 * (1 - e);
      }
    },
  };
}
