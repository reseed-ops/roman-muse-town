import { expect, test } from "bun:test";
import * as THREE from "three";
import { armsVisibility, createGaiusArms } from "./gaiusArms";

test("the arms step aside in the bath and the embrace; the shield also while he sits", () => {
  expect(armsVisibility({ bathing: false, embracing: false, seated: false })).toEqual({ sword: true, shield: true });
  expect(armsVisibility({ bathing: false, embracing: false, seated: true })).toEqual({ sword: true, shield: false });
  expect(armsVisibility({ bathing: true, embracing: false, seated: false })).toEqual({ sword: false, shield: false });
  expect(armsVisibility({ bathing: false, embracing: true, seated: false })).toEqual({ sword: false, shield: false });
});

test("the gladius rides his hips at his right side, the scutum his upper chest behind him", () => {
  const frame = new THREE.Group();
  const body = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = "J_Bip_C_Hips";
  hips.position.set(0, 1.0, 0);
  const chest = new THREE.Bone();
  chest.name = "J_Bip_C_UpperChest";
  chest.position.set(0, 0.35, 0);
  hips.add(chest);
  body.add(hips);
  frame.add(body);
  const placed: string[] = [];
  const arms = createGaiusArms({ frame, place: async (url) => { placed.push(url); return null; }, gladiusUrl: "gladius.glb", shieldUrl: "shield.glb" });
  arms.attach(body);
  expect(arms.sword.parent).toBe(hips);
  expect(arms.shield.parent).toBe(chest);
  expect(placed).toEqual(["gladius.glb", "shield.glb"]);
  frame.updateMatrixWorld(true);
  const sword = arms.sword.getWorldPosition(new THREE.Vector3());
  const shield = arms.shield.getWorldPosition(new THREE.Vector3());
  expect(sword.x).toBeLessThan(0); // his right is -X
  expect(shield.z).toBeLessThan(0); // behind him (he faces +Z)
  // No bones, no arms (and no throw).
  const bare = createGaiusArms({ frame, place: async () => null, gladiusUrl: "g", shieldUrl: "s" });
  bare.attach(new THREE.Group());
  expect(bare.sword.parent).toBeNull();
});
