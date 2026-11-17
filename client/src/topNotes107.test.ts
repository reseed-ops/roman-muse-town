import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Task 107: instructional text lives in one thin box at the top; action prompts and talk stay put.
const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
const box = app.slice(app.indexOf("{/* Task 107: the one thin message box."));
const boxEnd = box.indexOf('data-mt-top-notes="1"');

describe("Task 107: the thin top message box", () => {
  test("the box sits at the top, under the top bar, and is two rows at most", () => {
    expect(boxEnd).toBeGreaterThan(0);
    const tag = box.slice(boxEnd - 260, boxEnd);
    expect(tag).toContain("top-[calc(env(safe-area-inset-top,0px)+60px)]");
    expect(tag).not.toContain("bottom-");
    expect(box).toContain("rows.slice(0, 2)");
  });

  test("every instructional note is a row of the box", () => {
    for (const n of ["hint", "follow", "rejoin", "tour", "focus", "place"]) expect(box).toContain(`data-mt-note="${n}"`);
    expect(box).toContain("Tap Aelia to walk together, tap again to let her stay");
    expect(box).toContain("(or press Y near her)");
    expect(box).toContain("{tourStop.label}");
  });

  test("none of them is left at the bottom of the screen", () => {
    expect(app).not.toContain('data-mt-follow-toast="1">\n          <div className="pointer-events-auto flex max-w-[92vw]');
    expect(app).not.toMatch(/bottom-\[(18|64|104)px\][^\n]*\n[^\n]*\n?[^\n]*(rounded-2xl bg-\[#22332b\]\/85|Tap Aelia|Aelia will keep)/);
    expect(app).not.toContain("{/* Tour caption */}");
    expect(app).not.toContain("Sitting with Aelia, about {focusLeft} min of quiet left</span>\n            <button");
  });

  test("the box steps aside for Aelia's bubble and the summit scene", () => {
    expect(box.slice(0, 600)).toContain("{!museBubble && !summitScene && (() => {");
  });

  test("the action prompts and the conversation stay where they were", () => {
    expect(app).toContain('? "absolute inset-x-0 bottom-[76px] z-10 flex justify-center px-4"');
    expect(app).toContain(': "absolute inset-x-0 bottom-[132px] z-10 flex justify-center px-4"');
    expect(app).toContain("onClick={nearby.kind === \"stone\" ? xboxStone : xboxInteract}");
    expect(app).toContain('data-mt-quiet-boat="1"');
    expect(app).toContain('data-mt-tender-letter="1"');
    expect(app).toContain('className={`pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4 ${isLandscape ? "top-[62px]" : "top-[96px]"}`}');
  });

  test("no follow chip comes back", () => {
    expect(app).not.toContain("data-mt-follow-chip");
  });
});
