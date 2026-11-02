import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The per-action motion audit (the wrong-pack jump fix). An animator
// reports ready once its core set bakes, but a stage-two clip the bake
// refuses earns no action and throws nothing, so through v0.6.1 the
// menu could read "Motion: full" over a jump that did not exist: the
// shipped jump files were Unreal Mannequin clips, and the Iglesias
// bake returned null for each of them in silence. These tests pin the
// honesty machinery the way reducedMotion.test.ts pins the decoupling:
// the animator records refused core actions by name, keeps a thrown
// error verbatim, and the scene waits for stage two before it rules,
// so the menu line can say "partial" and name what is missing.

const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8").replace(/\r\n/g, "\n");
const anim = readFileSync(join(import.meta.dir, "characterAnimation.ts"), "utf8").replace(/\r\n/g, "\n");

function slice(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`audit marker moved: ${from} .. ${to}`);
  return source.slice(start, end);
}

test("the animator records refused core actions by name", () => {
  expect(anim).toContain("missingActions: string[];");
  expect(anim).toContain('out.missingActions.push("walk")');
  expect(anim).toContain('out.missingActions.push("run")');
  expect(anim).toContain('out.missingActions.push("jump start")');
  expect(anim).toContain('out.missingActions.push("jump air")');
  expect(anim).toContain('out.missingActions.push("jump land")');
  expect(anim).toContain('out.missingActions.push("slide")');
});

test("the animator keeps a thrown error verbatim for the menu line", () => {
  expect(anim).toContain("failureReason: string | null;");
  expect(anim).toContain("`${err.name}: ${err.message}`");
  expect(scene).toContain("a.failureReason");
});

test("the summary waits for stage two before it rules", () => {
  const summary = slice(scene, "function logAnimSummaryOnce()", "function driveClipAnims");
  expect(summary).toContain("a.failed || (a.ready && a.librarySettled)");
  expect(anim).toContain("librarySettled: boolean;");
  expect(anim).toContain("out.librarySettled = true;");
});

test("the menu line can say partial and name what is missing", () => {
  const summary = slice(scene, "function logAnimSummaryOnce()", "function driveClipAnims");
  expect(summary).toContain("Motion: partial (");
  expect(summary).toContain("missingActions");
  expect(summary).toContain('"Motion: full (both animators ready)"');
});
