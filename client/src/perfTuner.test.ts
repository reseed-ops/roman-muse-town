import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PixelRatioTuner, formatPerfLine, p95Of, ratioLadder } from "./perfTuner";

// The v44 swing tuner: the older adaptive pass watched the MEAN
// frame time and needed five sustained slow seconds, so a short
// camera swing, a burst of bad frames inside an otherwise fine
// average, never moved it. These tests pin the p95 behaviour: a
// burst the mean would hide still steps the ratio down, recovery
// takes three comfortable windows, and the floor is 1.

function feed(tuner: PixelRatioTuner, frames: number, ms: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < frames; i++) out.push(tuner.sample(ms));
  return out;
}

test("the ladder runs from the cap to the floor of 1 in quarter steps", () => {
  expect(ratioLadder(1.5)).toEqual([1.5, 1.25, 1]);
  expect(ratioLadder(2)).toEqual([2, 1.75, 1.5, 1.25, 1]);
  expect(ratioLadder(1.25)).toEqual([1.25, 1]);
  expect(ratioLadder(1)).toEqual([1]);
  expect(ratioLadder(0.8)).toEqual([1]);
});

test("p95 reads the tail, not the average", () => {
  const samples = [...Array(80).fill(10), ...Array(10).fill(60)];
  expect(p95Of(samples)).toBe(60);
  expect(p95Of([])).toBe(0);
  expect(p95Of([16])).toBe(16);
});

test("a swing burst the mean would hide still steps the ratio down", () => {
  const tuner = new PixelRatioTuner(1.5);
  // 80 fine frames and 10 bad ones per window: mean about 15.5 ms
  // (the old tuner saw nothing), p95 is 60 ms (the swing is real).
  let stepped: number | null = null;
  for (let w = 0; w < 90; w++) {
    const r = tuner.sample(w % 9 === 0 ? 60 : 10);
    if (r !== null) stepped = r;
  }
  expect(stepped).toBe(1.25);
  expect(tuner.ratio).toBe(1.25);
  expect(tuner.tierLabel).toBe("balanced");
});

test("sustained slow frames step down window by window to the floor", () => {
  const tuner = new PixelRatioTuner(1.5);
  expect(feed(tuner, 90, 30).at(-1)).toBe(1.25);
  expect(feed(tuner, 90, 30).at(-1)).toBe(1);
  expect(feed(tuner, 90, 30).at(-1)).toBeNull();
  expect(tuner.ratio).toBe(1);
  expect(tuner.tierLabel).toBe("light");
});

test("recovery needs three comfortable windows and steps up once", () => {
  const tuner = new PixelRatioTuner(1.5);
  feed(tuner, 90, 30);
  expect(tuner.ratio).toBe(1.25);
  expect(feed(tuner, 90, 8).at(-1)).toBeNull();
  expect(feed(tuner, 90, 8).at(-1)).toBeNull();
  expect(feed(tuner, 90, 8).at(-1)).toBe(1.5);
  expect(tuner.tierLabel).toBe("full");
  // Already at the cap: comfortable windows change nothing.
  expect(feed(tuner, 270, 8).every((r) => r === null)).toBe(true);
});

test("a middling window resets the recovery streak", () => {
  const tuner = new PixelRatioTuner(1.5);
  feed(tuner, 90, 30);
  feed(tuner, 90, 8);
  feed(tuner, 90, 8);
  feed(tuner, 90, 16); // neither over budget nor headroom
  expect(feed(tuner, 90, 8).at(-1)).toBeNull();
  expect(feed(tuner, 90, 8).at(-1)).toBeNull();
  expect(feed(tuner, 90, 8).at(-1)).toBe(1.5);
});

test("suspended or absurd frames reset the window instead of poisoning it", () => {
  const tuner = new PixelRatioTuner(1.5);
  feed(tuner, 80, 30);
  expect(tuner.sample(5000)).toBeNull();
  expect(tuner.sample(30, false)).toBeNull();
  // The 80 slow frames are forgotten: a fresh full window is needed.
  expect(feed(tuner, 89, 30).every((r) => r === null)).toBe(true);
  expect(tuner.sample(30)).toBe(1.25);
});

test("the perf line format is stable, whole numbers, no em dash", () => {
  const line = formatPerfLine({ fps: 57.6, p95Ms: 18.4 }, "full");
  expect(line).toBe("Perf: 58 fps · p95 18 ms · quality full");
  expect(formatPerfLine({ fps: 0, p95Ms: 0 }, "light")).toBe("Perf: 0 fps · p95 0 ms · quality light");
  expect(line).not.toContain("\u2014");
});

const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8").replace(/\r\n/g, "\n");
const runtime = readFileSync(join(import.meta.dir, "sceneRuntime.ts"), "utf8").replace(/\r\n/g, "\n");
const menu = readFileSync(join(import.meta.dir, "TownMenu.tsx"), "utf8").replace(/\r\n/g, "\n");
const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8").replace(/\r\n/g, "\n");

function slice(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`audit marker moved: ${from} .. ${to}`);
  return source.slice(start, end);
}

test("the runtime wires the tuner to ratio only steps at full tier", () => {
  expect(runtime).toContain("new PixelRatioTuner(fullRatio)");
  expect(runtime).toContain("this.tuner.sample(dt, visible)");
  expect(runtime).toContain("setPixelRatioOnly(stepped)");
  expect(runtime).toContain("perfLine(): string");
});

test("the scene pre-warms compiled shaders once after load", () => {
  expect(scene).toContain("renderer.compile(scene, camera)");
  expect(scene).toContain("Load-time pre-warm (v44)");
});

test("placed static models freeze their matrices, trees never do", () => {
  const placed = slice(scene, "Static scenery freeze (v44)", "return group;");
  expect(placed).toContain("if (!treeUrls.has(url))");
  expect(placed).toContain("o.matrixAutoUpdate = false");
  expect(placed).toContain("group.updateWorldMatrix(true, true)");
});

test("the bubble clamp reuses scratch vectors instead of allocating", () => {
  const clamp = slice(scene, "function clampBubbleToScreen", "function updateBubbles");
  expect(clamp).not.toContain("new THREE.Vector3");
  expect(clamp).not.toContain(".clone()");
  expect(clamp).toContain("bubbleRight.setFromMatrixColumn");
  expect(clamp).toContain("bubblePx.copy(bubbleTmpV)");
});

test("the menu carries the perf line under the motion line", () => {
  expect(menu).toContain("perfNote?: string");
  const motionAt = menu.indexOf("{footerNote &&");
  const perfAt = menu.indexOf("{perfNote &&");
  expect(motionAt).toBeGreaterThan(-1);
  expect(perfAt).toBeGreaterThan(motionAt);
  expect(app).toContain("perfNote={perfLine ?? undefined}");
  expect(app).toContain("sceneRef.current?.perfLine()");
  expect(scene).toContain("perfLine: () => runtime.perfLine()");
});
