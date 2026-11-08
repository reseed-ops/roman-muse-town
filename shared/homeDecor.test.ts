import { expect, test } from "bun:test";
import { arrange, fits, HOME_KEEPSAKES, HOME_SLOTS, readArrangement } from "./homeDecor";

test("every spot has keepsakes that can stand in it, and the mounts keep to their spots", () => {
  for (const slot of HOME_SLOTS) expect(HOME_KEEPSAKES.some((k) => k.mount === slot.mount)).toBe(true);
  expect(fits("wall-back", "star-chart")).toBe(true);
  expect(fits("floor", "star-chart")).toBe(false);
  expect(fits("table", "golden-carp-bowl")).toBe(true);
});

test("placing moves, clearing empties, and nothing invalid gets in", () => {
  let a = arrange({}, "shelf-left", "letter-bundle");
  a = arrange(a, "shelf-right", "letter-bundle");
  expect(a).toEqual({ "shelf-right": "letter-bundle" });
  expect(arrange(a, "floor", "letter-bundle")).toEqual(a);
  expect(arrange(a, "attic", "letter-bundle")).toEqual(a);
  expect(arrange(a, "shelf-right", null)).toEqual({});
  expect(readArrangement({ "wall-back": "star-chart", floor: "star-chart", nonsense: 3 })).toEqual({ "wall-back": "star-chart" });
  expect(readArrangement("nope")).toEqual({});
});
