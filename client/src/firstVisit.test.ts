import { expect, test } from "bun:test";
import { arrivalDue, FIRST_VISIT_HOLD_MS, PAST_ARCH_Z, RETURN_HOLD_MS } from "./firstVisit";

test("a first visit keeps the view clear until he walks in", () => {
  expect(arrivalDue(true, 43, 5000)).toBe(false);
  expect(arrivalDue(true, PAST_ARCH_Z - 1, 5000)).toBe(true);
});

test("a first visit doesn't wait forever on someone who stands still", () => {
  expect(arrivalDue(true, 43, FIRST_VISIT_HOLD_MS)).toBe(true);
});

test("a return waits a moment, wherever he stands", () => {
  expect(arrivalDue(false, 43, RETURN_HOLD_MS - 1)).toBe(false);
  expect(arrivalDue(false, 43, RETURN_HOLD_MS)).toBe(true);
});
