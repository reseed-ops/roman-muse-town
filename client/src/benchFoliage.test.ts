import { describe, expect, test } from "bun:test";
import { BENCH_FOLIAGE, APPROACH_CLEAR_HALF, SEAT_LINE_MARGIN, SEA_VIEW_HALF_ANGLE_DEG, inSeaView } from "./benchFoliage";
import { CLIFF, trailX } from "./seaCliff";

const B = CLIFF.bench;

describe("bench foliage (Task 98)", () => {
  test("there is planting on the flanks and behind", () => {
    expect(BENCH_FOLIAGE.length).toBeGreaterThanOrEqual(6);
    expect(BENCH_FOLIAGE.some((f) => f.x < -2)).toBe(true);
    expect(BENCH_FOLIAGE.some((f) => f.x > 2)).toBe(true);
  });

  test("nothing stands in the sea-view cone from the bench, or south of the seat line", () => {
    for (const f of BENCH_FOLIAGE) {
      const dx = f.x - B.x;
      const dz = f.z - B.z; // +z is south, the way the sitters face
      expect(dz).toBeLessThanOrEqual(-SEAT_LINE_MARGIN);
      expect(inSeaView(f.x, f.z)).toBe(false);
      if (dz > 0) {
        const angle = (Math.atan2(Math.abs(dx), dz) * 180) / Math.PI;
        expect(angle).toBeGreaterThan(SEA_VIEW_HALF_ANGLE_DEG);
      }
    }
  });

  test("the headland only: on the disc, off the approach slope, clear of the trail's lane", () => {
    for (const f of BENCH_FOLIAGE) {
      expect(Math.hypot(f.x - CLIFF.head.x, f.z - CLIFF.head.z)).toBeLessThan(CLIFF.walkHeadR);
      expect(f.z).toBeGreaterThanOrEqual(CLIFF.head.z - 4); // the proposed shoulder ends by z 100 to 108
      expect(Math.abs(f.x - trailX(f.z))).toBeGreaterThan(APPROACH_CLEAR_HALF);
      expect(Math.abs(f.x - B.x)).toBeGreaterThan(APPROACH_CLEAR_HALF);
    }
  });

  test("the bench's two seats stay clear", () => {
    for (const slot of [-1, 1]) {
      const sx = B.x - slot * 0.42;
      for (const f of BENCH_FOLIAGE) expect(Math.hypot(f.x - sx, f.z - B.z)).toBeGreaterThan(2.5);
    }
  });
});
