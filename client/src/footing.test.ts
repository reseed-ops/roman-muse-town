import { expect, test } from "bun:test";
import { footingAt, STRIDE, strideStep } from "./footing";

const open = { onDock: false, lakeNorm: 5, inForest: false, streetDistance: 9, onPaving: false };

test("each surface sounds like itself", () => {
  expect(footingAt(open)).toBe("grass");
  expect(footingAt({ ...open, streetDistance: 1 })).toBe("stone");
  expect(footingAt({ ...open, onPaving: true })).toBe("stone");
  expect(footingAt({ ...open, inForest: true })).toBe("gravel");
  expect(footingAt({ ...open, onDock: true, lakeNorm: 0.5 })).toBe("wood");
  expect(footingAt({ ...open, lakeNorm: 1.1 })).toBe("water");
});

test("a foot falls every stride, at any frame rate", () => {
  for (const moved of [0.04, 0.09, 0.17]) {
    let tally = 0;
    let falls = 0;
    for (let i = 0; i < 1000; i++) {
      const step = strideStep(tally, moved);
      tally = step.tally;
      if (step.fell) falls++;
    }
    expect(Math.abs(falls - (1000 * moved) / STRIDE)).toBeLessThanOrEqual(1);
  }
});
