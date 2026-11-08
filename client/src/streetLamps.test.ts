import { describe, expect, test } from "bun:test";
import { lampIgnition, lampLightBudget } from "./streetLamps";

describe("street lamps", () => {
  test("dusk travels from the forum toward the avenue", () => {
    expect(lampIgnition(0.3, 0)).toBeGreaterThan(lampIgnition(0.3, 1));
    expect(lampIgnition(0, 0)).toBe(0);
    expect(lampIgnition(1, 1)).toBe(1);
  });

  test("real lights are budgeted by adaptive quality", () => {
    expect(lampLightBudget(0)).toBe(1);
    expect(lampLightBudget(1)).toBe(2);
    expect(lampLightBudget(2)).toBe(4);
  });
});
