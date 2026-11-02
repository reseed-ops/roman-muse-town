import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The reduced-motion audit (the frozen-town fix). A phone with system
// animations off reports prefers-reduced-motion: reduce, and the scene
// once read that as "never create the character animators at all", so
// no FBX clip was ever requested and both characters stood in a stiff
// near-bind pose for four releases while desktop Chrome animated the
// identical code. The scene cannot load here (it needs a GPU), so
// these tests read the sources the way townAudit and controlsOverview
// do: they pin the decoupling, the loud animator path, and the slide
// latch wiring. If a marker below moves, the test fails loudly rather
// than passing on nothing.

const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8").replace(/\r\n/g, "\n");
const anim = readFileSync(join(import.meta.dir, "characterAnimation.ts"), "utf8").replace(/\r\n/g, "\n");
const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8").replace(/\r\n/g, "\n");
const menu = readFileSync(join(import.meta.dir, "TownMenu.tsx"), "utf8").replace(/\r\n/g, "\n");

function slice(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`audit marker moved: ${from} .. ${to}`);
  return source.slice(start, end);
}

test("her animator is created whatever the preference says", () => {
  const muse = slice(scene, "// Her real motion clips", "poseBone(museRig, museRig.lUpperArm");
  expect(muse).toContain("museAnim = createCharAnimator({");
  expect(muse).not.toContain("opts.reducedMotion");
});

test("his animator is created whatever the preference says", () => {
  const gaius = slice(scene, "// His real motion clips", "poseBone(playerRig, playerRig.lUpperArm");
  expect(gaius).toContain("playerAnim = createCharAnimator({");
  expect(gaius).not.toContain("opts.reducedMotion");
});

test("the procedural walk posing is not gated on the preference either", () => {
  const posing = slice(scene, "// Walk cycle on the Centurion's bones", "// Follow camera (third-person)");
  expect(posing).toContain("playerPose.legL = ease(");
  expect(posing).not.toContain("opts.reducedMotion");
});

test("the flag still governs what it was meant for", () => {
  // Dust stays calmed, camera flights stay instant cuts, and the
  // shell still reads the system preference and passes it in.
  expect(scene).toContain("if (opts.reducedMotion) return;");
  expect(scene).toContain("if (opts.reducedMotion || durationMs <= 0)");
  expect(app).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
});

test("the animator catch is loud and the scene reports the settle", () => {
  expect(anim).toContain('console.error("[muse-town] character clips failed:", err)');
  expect(anim).not.toContain("clips unavailable, procedural posing carries on");
  expect(scene).toContain("[muse-town] animators: gaius=");
  expect(scene).toContain("logAnimSummaryOnce();");
});

test("the settle is also one quiet line in the town menu", () => {
  // The console line alone never reaches a phone's owner, so the
  // scene hands the same verdict to the shell, and the shell shows
  // it at the foot of the town menu.
  expect(scene).toContain("onMotionStatus?: (status: string) => void;");
  expect(scene).toContain("opts.onMotionStatus?.(");
  expect(scene).toContain('"Motion: full (both animators ready)"');
  expect(app).toContain("onMotionStatus: (status) => setMotionStatus(status),");
  expect(app).toContain("footerNote={motionStatus ?? undefined}");
  expect(menu).toContain("footerNote?: string;");
  expect(menu).toContain("{footerNote && <p");
});

test("the slide gate takes the latch, fed by the walk loop", () => {
  const slide = slice(scene, "    slide: () => {", "    setRhythm:");
  expect(slide).toContain("wasMovingRecently(lastMovingAt, now)");
  // The standing gates are untouched: the latch widens only the
  // motion term, never the boat, air, or hand-in-hand refusals.
  expect(slide).toContain("boatState || airborne(hop) || (handInHand && followMode)");
  expect(scene).toContain("let lastMovingAt = -Infinity;");
  expect(scene).toContain("if (isMoving) lastMovingAt = t;");
});
