import { expect, test } from "bun:test";
import { dayPart, dayRhythm } from "./dayRhythm";
import type { RomanDate } from "./romanDay";

const plain: RomanDate = { month: 6, day: 10, marked: null, market: false };

test("the Roman day falls into four parts", () => {
  expect([1, 4, 5, 8, 9, 12, null].map(dayPart)).toEqual(["morning", "morning", "midday", "midday", "dusk", "dusk", "night"]);
});

test("each part has its place", () => {
  expect(dayRhythm(2, plain, null).anchor).toBe("market");
  expect(dayRhythm(6, plain, null).anchor).toBe("baths");
  expect(dayRhythm(10, plain, null).anchor).toBe("terrace");
  expect(dayRhythm(null, plain, null).anchor).toBe("lake");
});

test("the terrace hours say afternoon until the light goes gold", () => {
  expect(dayRhythm(9, plain, null).title).toBe("Afternoon on the terrace");
  expect(dayRhythm(10, plain, null).anchor).toBe("terrace");
  expect(dayRhythm(11, plain, null).title).toBe("Dusk on the terrace");
  expect(dayRhythm(12, plain, null).title).toBe("Dusk on the terrace");
});

test("the stalls shutter for the evening", () => {
  expect(dayRhythm(2, plain, null).marketOpen).toBe(true);
  expect(dayRhythm(10, plain, null).marketOpen).toBe(false);
  expect(dayRhythm(null, plain, null).marketOpen).toBe(false);
});

test("a market day holds the day at the stalls until dusk", () => {
  const market = { ...plain, market: true };
  const midday = dayRhythm(6, market, null);
  expect(midday.override).toBe("market");
  expect(midday.anchor).toBe("market");
  expect(midday.marketBusy).toBe(true);
  expect(dayRhythm(10, market, null).override).toBeNull();
});

test("a festival outranks the market, but not the night", () => {
  const market = { ...plain, market: true };
  const feast = dayRhythm(2, market, "Saturnalia");
  expect(feast.override).toBe("festival");
  expect(feast.title).toBe("Saturnalia");
  expect(dayRhythm(null, market, "Saturnalia").override).toBeNull();
});

test("the id only changes when the invitation does", () => {
  expect(dayRhythm(1, plain, null).id).toBe(dayRhythm(4, plain, null).id);
  expect(dayRhythm(4, plain, null).id).not.toBe(dayRhythm(5, plain, null).id);
});
