import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PAD_PRESS_ALL, PAD_PRESS_RELEASE, padPressOff, padPressOn } from "./padPress";

// Task 97: a face button fills on press while the stick is held, not only standing still.
const el = () => {
  const attrs = new Set<string>();
  return { attrs, currentTarget: { setAttribute: (k: string) => attrs.add(k), removeAttribute: (k: string) => attrs.delete(k) } } as never as {
    attrs: Set<string>;
    currentTarget: HTMLElement;
  };
};

test("a face button shows pressed with the stick pointer held down, and clears on release", () => {
  const stickHeld = 1; // pointer 1 is down and captured by the joystick; it never fires on the button
  const button = el();
  expect(stickHeld).toBe(1);
  PAD_PRESS_ALL.onPointerDown(button as never); // second finger, pointer 2
  expect(button.attrs.has("data-pressed")).toBe(true);
  PAD_PRESS_ALL.onPointerUp(button as never);
  expect(button.attrs.has("data-pressed")).toBe(false);
});

test("standing still: same press and release; cancel, leave and lost capture also clear", () => {
  for (const k of ["onPointerUp", "onPointerCancel", "onPointerLeave", "onLostPointerCapture"] as const) {
    const b = el();
    padPressOn(b as never);
    expect(b.attrs.has("data-pressed")).toBe(true);
    PAD_PRESS_RELEASE[k](b as never);
    expect(b.attrs.has("data-pressed")).toBe(false);
  }
  const b = el();
  padPressOff(b as never);
  expect(b.attrs.size).toBe(0);
});

test("every pad button is wired to the pressed state and styles it", () => {
  const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");
  const from = app.indexOf('aria-label="Xbox controller action buttons"');
  const to = app.indexOf("Back to Gaius\n", from);
  const seg = app.slice(from, to);
  expect((seg.match(/PAD_PRESS_(ALL|RELEASE)/g) ?? []).length).toBe(7);
  expect((seg.match(/data-\[pressed\]:bg-/g) ?? []).length).toBe(7);
});
