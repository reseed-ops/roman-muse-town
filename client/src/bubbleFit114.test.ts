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
