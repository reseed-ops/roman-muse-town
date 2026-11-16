import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { clampToWorld, walkable } from "./seaCliff";
import { companionPace, moonOpacity, museStairStep, shouldSwim, shouldWalk, surfaceY, SWIM_EXIT, swimMove, underwaterMix } from "./swim";
import { SEA_Y } from "./shoreStair";
import { newPadGate, newSwimHeld, padGateBlur, pollPadDepth, releaseAllSwimKeys, swimAggregate } from "./swimHeld";

// Task 104: the three remaining Codex items.
const forest = { norm: (x: number, z: number) => Math.hypot((x + 44) / 11.5, (z + 22) / 15), cx: -44, cz: -22 };
const clamp = (x: number, z: number) => clampToWorld(x, z, forest);
const src = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

test("Aelia walks the stair approach from southern starts too, down, swims, swims out, never standing still", () => {
  const starts = ([[0, 60], [0, 58], [-3, 62], [2, 70], [5, 66], [4.5, 59], [5.3, 80], [0, 52], [8, 50], [13, 56.5], [9, 57.1], [5.2, 56.6]] as [number, number][]).filter(([x, z]) => walkable(x, z));
  expect(starts.length).toBeGreaterThanOrEqual(10);
  expect(starts.some(([x, z]) => x === 0 && z === 60)).toBe(true);
  for (const [sx, sz] of starts) {
    let x = sx;
    let z = sz;
    const dt = 1 / 60;
    let swum = false;
    let still = 0;
    for (let n = 0; n < 60 * 120 && !swum; n++) {
      const s = museStairStep(x, z, dt, clamp);
      expect(s).not.toBeNull();
      still = Math.hypot(s!.x - x, s!.z - z) < 1e-4 ? still + 1 : 0;
      expect(still).toBeLessThan(5);
      x = s!.x;
      z = s!.z;
      swum = shouldSwim(x, z);
    }
    expect(swum).toBe(true);
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
  expect(src).toContain("museStairStep(here.x, here.z, dt");
});

test("blur, then another gamepad poll with the button still down, does not reassert; resumes on a fresh press", () => {
  const h = newSwimHeld();
  const g = newPadGate();
  const sent: [string, boolean][] = [];
  const send = (w: "rise" | "sink", d: boolean) => sent.push([w, d]);
  pollPadDepth(h, g, true, [true, false], send);
  expect(swimAggregate(h, 0)).toBe(true);
  // blur: everything let go, the gate shut
  releaseAllSwimKeys(h, send, g);
  expect(swimAggregate(h, 0)).toBe(false);
  // the very next poll, window still blurred, button still physically down
  sent.length = 0;
  pollPadDepth(h, g, false, [true, false], send);
  expect(swimAggregate(h, 0)).toBe(false);
  expect(sent.some(([, d]) => d)).toBe(false);
  // focus returns, button STILL held: not reasserted
  pollPadDepth(h, g, true, [true, false], send);
  pollPadDepth(h, g, true, [true, false], send);
  expect(swimAggregate(h, 0)).toBe(false);
  // released, then a fresh press: counts
  pollPadDepth(h, g, true, [false, false], send);
  pollPadDepth(h, g, true, [true, false], send);
  expect(swimAggregate(h, 0)).toBe(true);
  // a poll while merely unfocused (no blur event seen) gates by itself
  pollPadDepth(h, g, false, [true, true], send);
  expect(swimAggregate(h, 0) || swimAggregate(h, 1)).toBe(false);
  pollPadDepth(h, g, true, [true, true], send);
  expect(swimAggregate(h, 1)).toBe(false);
  // the other policy parts: padGateBlur alone suppresses both
  padGateBlur(g);
  expect(g.suppressed).toEqual([true, true]);
  // wiring
  expect(app).toContain("pollPadDepth(swimHeld.current, padGate.current, document.hasFocus()");
  expect(app).toContain("releaseAllSwimKeys(swimHeld.current, sendSwimKey, padGate.current)");
  expect(app).not.toMatch(/holdSwim\("pad", 0, !!now\[0\]\)/);
});

test("the moon's final opacity fades on the same curve as the sky: (1 - uwMix)", () => {
  expect(src).toContain("trueSky.moonMaterial.opacity = moonOpacity(moonUp, nightMix, uwMix);");
  expect(moonOpacity(1, 1, 0)).toBeCloseTo(0.95);
  expect(moonOpacity(1, 1, 1)).toBe(0);
  expect(moonOpacity(1, 0, 0)).toBeCloseTo(0.22);
  for (const y of [SEA_Y + 0.5, SEA_Y + 0.2, SEA_Y, SEA_Y - 0.2, SEA_Y - 0.5]) {
    const m = underwaterMix(y);
    expect(moonOpacity(1, 1, m)).toBeCloseTo(0.95 * (1 - m));
  }
});
