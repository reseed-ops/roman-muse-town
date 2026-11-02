import { expect, test } from "bun:test";
import { endSlide, newSlide, SLIDE_SEC, slideSpeed, sliding, startSlide } from "./slide";

test("it starts faster than a run and ends slower than a walk", () => {
  const slide = newSlide();
  startSlide(slide, 0, 2, 0);
  expect(slide.dirZ).toBe(1);
  expect(slideSpeed(slide)).toBeGreaterThan(5.2);
  slide.left = 0.01;
  expect(slideSpeed(slide)).toBeLessThan(5.2);
});

test("it can't be chained, and waits out its cooldown", () => {
  const slide = newSlide();
  expect(startSlide(slide, 1, 0, 0)).toBe(true);
  expect(startSlide(slide, 1, 0, 0.1)).toBe(false);
  endSlide(slide, SLIDE_SEC);
  expect(sliding(slide)).toBe(false);
  expect(startSlide(slide, 1, 0, SLIDE_SEC + 0.1)).toBe(false);
  expect(startSlide(slide, 1, 0, SLIDE_SEC + 0.5)).toBe(true);
});

test("no direction, no slide", () => {
  expect(startSlide(newSlide(), 0, 0, 0)).toBe(false);
});
