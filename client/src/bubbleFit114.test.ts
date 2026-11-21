import { describe, expect, test } from "bun:test";
import { bubbleTargetPx } from "./bubblePlate";

// The bubble plate is 2:1: width = 2 x height.
const fits = (cw: number, ch: number, land: boolean, top: number, bottom: number) => {
  const h = bubbleTargetPx(cw, ch, land, top, bottom);
  return { h, w: h * 2, ok: h * 2 <= cw * 0.9 + 0.001 && h <= ch - top - bottom + 0.001 };
};

describe("Task 114: the stay-note bubble fits the viewport", () => {
  test("portrait phones, with and without the stacked notes", () => {
    for (const [cw, ch] of [[390, 844], [360, 640], [320, 568], [430, 932]] as [number, number][]) {
      for (const top of [100, 150]) expect(fits(cw, ch, false, top, 252).ok).toBe(true);
    }
  });
  test("a narrow desktop window in portrait stays capped", () => {
    expect(bubbleTargetPx(400, 1400, false, 100, 252)).toBeLessThanOrEqual(168);
  });
  test("landscape phones, including the short 390 px one", () => {
    for (const [cw, ch] of [[844, 390], [740, 360], [932, 430], [1280, 720]] as [number, number][]) expect(fits(cw, ch, true, 54, 212).ok).toBe(true);
  });
  test("landscape keeps a readable size when there is room", () => {
    expect(bubbleTargetPx(1280, 720, true, 54, 212)).toBeGreaterThanOrEqual(132);
  });
});

describe("Task 129: no message bubble ever fills the screen", () => {
  test("the sprite bubble is capped in height and width at any viewport, even absurd ones", () => {
    for (const [cw, ch] of [[320, 568], [390, 844], [844, 390], [1280, 720], [2560, 1440], [3000, 600], [600, 3000]] as [number, number][]) {
      for (const land of [true, false]) {
        const h = bubbleTargetPx(cw, ch, land, land ? 54 : 100, land ? 212 : 252);
        expect(h).toBeLessThanOrEqual(200);
        expect(h).toBeLessThanOrEqual(ch * 0.36 + 0.001);
        expect(h * 2).toBeLessThanOrEqual(cw * 0.9 + 0.001);
      }
    }
  });
});
