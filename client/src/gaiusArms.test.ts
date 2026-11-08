import { expect, test } from "bun:test";
import * as THREE from "three";
import { armsVisibility, createGaiusArms } from "./gaiusArms";

test("the arms step aside in the bath and the embrace; the shield also while he sits", () => {
  expect(armsVisibility({ bathing: false, embracing: false, seated: false, shieldOut: true })).toEqual({ sword: true, shield: true });
  expect(armsVisibility({ bathing: false, embracing: false, seated: true, shieldOut: true })).toEqual({ sword: true, shield: false });
  expect(armsVisibility({ bathing: true, embracing: false, seated: false, shieldOut: true })).toEqual({ sword: false, shield: false });
  expect(armsVisibility({ bathing: false, embracing: true, seated: false, shieldOut: true })).toEqual({ sword: false, shield: false });
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

// Task 47: the shield is stowed by default and comes out at a press.
import { SHIELD_RAISE_S, shieldRaiseStep } from "./gaiusArms";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("Task 47: the shield is hidden by default, shown and hidden again by the toggle; the gladius stays", () => {
  const still = { bathing: false, embracing: false, seated: false };
  expect(armsVisibility(still)).toEqual({ sword: true, shield: false });
  expect(armsVisibility({ ...still, shieldOut: true })).toEqual({ sword: true, shield: true });
  expect(armsVisibility({ ...still, shieldOut: false })).toEqual({ sword: true, shield: false });
  // Out, it still steps aside where it would pass through someone or a seat.
  expect(armsVisibility({ ...still, seated: true, shieldOut: true }).shield).toBe(false);
  expect(armsVisibility({ ...still, bathing: true, shieldOut: true }).shield).toBe(false);

  const frame = new THREE.Group();
  const arms = createGaiusArms({ frame, place: async () => null, gladiusUrl: "g", shieldUrl: "s" });
  expect(arms.shield.visible).toBe(false);
  arms.setVisible(armsVisibility({ ...still, shieldOut: true }), 1 / 30);
  expect(arms.shield.visible).toBe(true);
  arms.setVisible(armsVisibility({ ...still, shieldOut: false }), 1 / 30);
  expect(arms.shield.visible).toBe(false);
  expect(arms.sword.visible).toBe(true);
});

test("Task 47: the shield rises into place over a quarter second", () => {
  let r = 0;
  for (let i = 0; i < 3; i++) r = shieldRaiseStep(r, true, 1 / 30);
  expect(r).toBeGreaterThan(0);
  expect(r).toBeLessThan(1);
  for (let i = 0; i < 30; i++) r = shieldRaiseStep(r, true, 1 / 30);
  expect(r).toBe(1);
  expect(shieldRaiseStep(r, false, 1 / 30)).toBe(0);
  expect(SHIELD_RAISE_S).toBeLessThanOrEqual(0.3);
});

test("Task 47: the scene starts stowed; LT and RT sit inside LB and RB; R and G on the keyboard", () => {
  const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
  const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
  expect(scene).toContain("let shieldOut = false;");
  expect(scene).toContain("let swordWorn = true;");
  expect(app).toContain("useState(false);\n  const shieldOutRef = useRef(false);");
  expect(app).toContain('data-mt-triggers={side}');
  expect(app).toContain('if (side === "LT") toggleSword();\n      else toggleShield();');
  expect(app).toMatch(/\(key === "g" \|\| key === "r"\) && !e\.repeat && walkingRef\.current\) \{\n\s+triggerPressRef\.current\(key === "r" \? "LT" : "RT"\);/);
  expect(app).toContain("for (const side of pressedTriggers(was, now)) triggerPressRef.current(side);");
  // Inside LB and RB at the same height, clear of the speech bubble's band (252 px portrait, 212 landscape).
  expect(app).toContain('"absolute left-[84px] bottom-[168px] z-20"');
  expect(app).toContain('"absolute right-[84px] bottom-[168px] z-20"');
  expect(app).not.toContain('data-mt-shield="1"');
});

test("the gladius is worn by default and LT stows it, whatever else hides it", () => {
  const still = { bathing: false, embracing: false, seated: false };
  expect(armsVisibility(still).sword).toBe(true);
  expect(armsVisibility({ ...still, swordWorn: false }).sword).toBe(false);
  expect(armsVisibility({ ...still, swordWorn: true, bathing: true }).sword).toBe(false);
});
