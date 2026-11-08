import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Task 48: tap Aelia to follow, tap again to stay; Y near her; the menu row gone.
const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");

describe("Task 48: the follow switch is on Aelia", () => {
  test("a tap on her body is its own pick; her bubble and the walk-up prompt keep the talk", () => {
    expect(scene).toContain('id: o === museBubble.sprite ? "muse" : "muse-body"');
    expect(scene).toContain('nearCandidates.push({ kind: "muse", id: "muse", d });');
  });

  test("on foot, the body tap toggles following, and nothing else (no talk panel)", () => {
    const branch = app.indexOf('if (kind === "muse" && id === "muse-body" && walkingRef.current) {');
    expect(branch).toBeGreaterThan(0);
    expect(app.slice(branch, branch + 200)).toContain("toggleFollowRef.current();\n        return;");
    // The talk branch still answers the prompt, X and her bubble ("muse").
    expect(app).toContain("talkToAeliaRef.current();");
  });

  test("the toggle starts and stops with her own lines, and stopping releases a held hand", () => {
    const toggle = app.slice(app.indexOf("const toggleFollow = useCallback"), app.indexOf("const toggleFollowRef"));
    expect(toggle).toContain("if (followingRef.current) {\n      stopFollowing();");
    expect(toggle).toContain("} else startFollowing();");
    expect(app).toContain("With pleasure, Centurion. Lead on. I'll keep step beside you.");
    const stop = app.slice(app.indexOf("const stopFollowing = useCallback"), app.indexOf("const toggleFollow = useCallback"));
    expect(stop).toContain("releaseHandHold();");
  });

  test("Y near her toggles; away from her Y keeps stones and hints; T on the keyboard", () => {
    const y = app.slice(app.indexOf("const xboxStone = () => {"), app.indexOf("const xboxBackRef"));
    expect(y).toContain('if (nearbyRef.current?.kind === "muse") {\n      toggleFollowRef.current();');
    expect(y.indexOf("throwStone")).toBeLessThan(y.indexOf('kind === "muse"'));
    expect(y).toContain("scene.pickUpStone();");
    expect(app).toMatch(/key === "t" && !e\.repeat && walkingRef\.current\) \{\n\s+toggleFollowRef\.current\(\);/);
    expect(app).toContain("near Aelia, Y or T asks her to walk with you or to stay");
  });

  test("the menu has no follow row; the chip shows her state and toggles it; the toast shows once", () => {
    expect(app).not.toContain('key: "follow"');
    expect(app).not.toContain('"Walk with Aelia"');
    expect(app).toContain('data-mt-follow-chip="1"');
    expect(app).toContain('{following ? "🚶 Walking with you" : "✦ Aelia is staying"}');
    expect(app).toContain("onClick={() => toggleFollow()}");
    expect(app).toContain("Tap Aelia to walk together, tap again to let her stay");
    expect(app).toContain('localStorage.setItem(FOLLOW_TOAST_KEY, "1")');
    expect(app).toContain("<strong className=\"text-[#ffd34e]\">tap Aelia</strong> (or press Y near her)");
  });

  test("a drag still orbits and a double tap on the open view still recenters", () => {
    const up = scene.slice(scene.indexOf("function onPointerUp(e: PointerEvent) {"), scene.indexOf('canvas.addEventListener("pointerdown", onPointerDown);'));
    // A drag (moved or held) is never a tap, so never a pick.
    expect(up.indexOf("if (moved > 8 || dt > 450) return;")).toBeLessThan(up.indexOf("opts.onPick(pick.kind, pick.id);"));
    // A pick clears the double-tap memory and returns before the recenter check.
    expect(up).toContain("lastOpenTap = null;\n      opts.onPick(pick.kind, pick.id);\n      return;");
    expect(up.indexOf("opts.onPick(pick.kind, pick.id);")).toBeLessThan(up.indexOf("recenterWalkCamera();"));
  });
});
