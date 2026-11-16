import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { clampToWorld, walkable } from "./seaCliff";
import { SEA_Y, STAIR } from "./shoreStair";
import {
  companionPace,
  museStairGoal,
  SEABED_EXTENT,
  seabedHeight,
  seabedMeshHeight,
  shouldSwim,
  shouldWalk,
  surfaceY,
  SWIM,
  SWIM_EXIT,
  swimFloor,
  swimMove,
  underwaterMix,
} from "./swim";
import { buildSeabed } from "./swimScene";
import { holdSwimKey, newSwimHeld, releaseAllSwimKeys, resyncSwimKeys, swimAggregate } from "./swimHeld";

// Task 103: the fixes for Codex's review of the swim.
const forest = { norm: (x: number, z: number) => Math.hypot((x + 44) / 11.5, (z + 22) / 15), cx: -44, cz: -22 };
const src = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");

// ---- 1. Aelia's way down
test("Aelia, walking from before the landing, reaches the stair, goes down it, swims and swims out, never standing still", () => {
  const starts = ([[8, 50], [4, 52], [11, 49], [13, 56.5], [6, 57], [5.2, 56.6], [9, 57.1]] as [number, number][]).filter(([x, z]) => walkable(x, z));
  expect(starts.length).toBeGreaterThanOrEqual(4);
  for (const start of starts) {
    let [x, z] = start;
    const dt = 1 / 60;
    let swum = false;
    let still = 0;
    for (let n = 0; n < 60 * 90 && !swum; n++) {
      const goal = museStairGoal(x, z);
      expect(goal).not.toBeNull();
      const d = Math.hypot(goal!.x - x, goal!.z - z) || 1;
      const step = Math.min(3.6 * dt, d);
      const b = clampToWorld(x + ((goal!.x - x) / d) * step, z + ((goal!.z - z) / d) * step, forest);
      still = Math.hypot(b.x - x, b.z - z) < 1e-4 ? still + 1 : 0;
      expect(still).toBeLessThan(5); // arrived at a waypoint and stopped = the old dead end
      x = b.x;
      z = b.z;
      swum = shouldSwim(x, z);
    }
    expect(swum).toBe(true);
    // In the water she swims out to the steps and walks.
    let p = { x, y: surfaceY(), z };
    let out = false;
    for (let n = 0; n < 60 * 120 && !out; n++) {
      const dx = SWIM_EXIT.x - p.x;
      const dz = SWIM_EXIT.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = companionPace(d, 0) / 60;
      p = swimMove(p, (dx / d) * sp, (dz / d) * sp, 0);
      out = shouldWalk(p.x, p.z);
    }
    expect(out).toBe(true);
  }
  // The waypoint before the steps is inside the region that counts as being on them.
  const g = museStairGoal(8, 57.1)!; // on the landing (Task 104: from the trail, the goal is the landing gate first)
  expect(g.z).toBeGreaterThanOrEqual(STAIR.topZ - 0.5);
  expect(museStairGoal(-20, 55)).toBeNull();
  expect(src).toContain("museStairStep(here.x, here.z, dt");
});

// ---- 2. hand in hand
test("hand-in-hand is suspended, not overridden, while either is swimming", () => {
  expect(src).toContain("const swimTouched = ()");
  expect(src).toMatch(/const wantHold =\s*handInHand[^;]*!swimTouched\(\)/);
  // the positional servo that set her height to the ground, and the follow offsets and cap
  expect(src).toContain("if (walking && !swimTouched() && playerRig?.rHand && museRig?.lHand)");
  expect(src).toContain("handInHand && !swimTouched() ? 0.9");
  expect(src).toContain("followMode && handInHand && !swimTouched()");
  expect(src).toContain("!boatState && !seatPlayer && !swimming) {\n      if (mag > 0.95)");
  // not cleared: the shell's state is untouched, so it resumes on land
  const swimBody = src.slice(src.indexOf("function beginSwim"), src.indexOf("function stepSwim"));
  expect(swimBody).not.toContain("handInHand");
});

// ---- 3. held depth controls
test("held depth keys: focus loss releases, exit and re-entry while held keep the button, sources union", () => {
  const h = newSwimHeld();
  const sent: [string, boolean][] = [];
  const send = (w: "rise" | "sink", d: boolean) => sent.push([w, d]);
  holdSwimKey(h, "kb", 0, true, send);
  holdSwimKey(h, "touch", 0, true, send);
  expect(swimAggregate(h, 0)).toBe(true);
  holdSwimKey(h, "kb", 0, false, send); // keyboard up, the on-screen button is still down
  expect(sent.at(-1)).toEqual(["rise", true]);
  holdSwimKey(h, "touch", 0, false, send);
  expect(sent.at(-1)).toEqual(["rise", false]);
  // focus lost with both held: both buttons go up
  holdSwimKey(h, "kb", 0, true, send);
  holdSwimKey(h, "pad", 1, true, send);
  sent.length = 0;
  releaseAllSwimKeys(h, send);
  expect(sent).toEqual([["rise", false], ["sink", false]]);
  expect(swimAggregate(h, 0) || swimAggregate(h, 1)).toBe(false);
  // a key whose keyup went elsewhere does not stay logically down: pressing again sends
  sent.length = 0;
  holdSwimKey(h, "kb", 0, true, send);
  expect(sent).toEqual([["rise", true]]);
  // a scene built while held hears the buttons as they stand
  sent.length = 0;
  resyncSwimKeys(h, send);
  expect(sent).toEqual([["rise", true], ["sink", false]]);
  // the scene does not clear them on leaving the water (its mirror is the shell's)
  const end = src.slice(src.indexOf("function endSwim"), src.indexOf("function stepSwim"));
  expect(end).not.toContain("swimRise = false");
  expect(end).not.toContain("swimSink = false");
});

// ---- 4. the rendered floor
test("the swimmer's floor is the rendered mesh: triangle interiors checked against independent mesh intersections", () => {
  const mesh = buildSeabed();
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  let worstFn = 0;
  let n = 0;
  // Irregular samples: interiors of both triangles of many cells, across the swimmable sea.
  for (let i = 0; i < 1500; i++) {
    const x = -105 + ((i * 7919) % 2100) / 10 + (i % 13) * 0.0137;
    const z = 52 + ((i * 104729) % 1480) / 10 + (i % 7) * 0.0291;
    ray.set(new THREE.Vector3(x, 50, z), down);
    const hit = ray.intersectObject(mesh, false)[0];
    if (!hit) continue;
    n++;
    expect(seabedMeshHeight(x, z)).toBeCloseTo(hit.point.y, 4);
    worstFn = Math.max(worstFn, Math.abs(seabedHeight(x, z) - hit.point.y));
    // clearance: at the collision limit the swimmer's axis is at least 0.5 m above the drawn floor
    const p = swimMove({ x, y: SEA_Y - 0.5, z }, 0, 0, -50);
    if (Math.abs(p.x - x) < 1e-9 && Math.abs(p.z - z) < 1e-9 && swimFloor(x, z) + SWIM.floorClear < SEA_Y - SWIM.carry) {
      expect(p.y - hit.point.y).toBeGreaterThanOrEqual(SWIM.floorClear - 1e-4);
    }
  }
  expect(n).toBeGreaterThan(1200);
  // The old collision (the function) was off the mesh by a visible margin: the test would have caught it.
  expect(worstFn).toBeGreaterThan(0.05);
  expect(SEABED_EXTENT.cell).toBe(2);
}, 60000);

// ---- 5. the sky blend
test("the sky is blended with the water on one curve: no switch, no step", () => {
  expect(src).not.toContain("skyAnchor.visible = uwMix");
  expect(src).toContain("sunDiscMat.opacity = discVis * 0.95 * skyKeep");
  expect(src).toContain("sunGlowMat.opacity = discVis * 0.4 * skyKeep");
  expect(src).toContain("* (1 - uwMix));");
  expect(src).toContain("skyUniforms.horizonColor.value.lerp(uwTint, uwMix)");
  // The curve every element rides is continuous across the surface (a fine sweep, no jump above 3%).
  let last = underwaterMix(SEA_Y + 1);
  for (let y = SEA_Y + 1; y >= SEA_Y - 1; y -= 0.005) {
    const m = underwaterMix(y);
    expect(Math.abs(m - last)).toBeLessThan(0.03);
    last = m;
  }
});

// ---- 6. easing width
test("the ease spans the spec's half metre each side: 1 m in all", () => {
  expect(underwaterMix(SEA_Y + 0.5)).toBe(0);
  expect(underwaterMix(SEA_Y - 0.5)).toBe(1);
  expect(underwaterMix(SEA_Y + 0.49)).toBeGreaterThan(0);
  expect(underwaterMix(SEA_Y - 0.49)).toBeLessThan(1);
});
