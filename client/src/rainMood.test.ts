import { describe, expect, test } from "bun:test";
import { dripDelay, dropletDelay, rainIntensity, rainSwell, wrapAround } from "./rainMood";

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("rainSwell", () => {
  const samples = Array.from({ length: 2000 }, (_, i) => rainSwell(i));

  test("stays in range and truly drifts", () => {
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.7);
  });

  test("changes too slowly to notice from moment to moment", () => {
    for (let i = 1; i < samples.length; i++) {
      expect(Math.abs(samples[i]! - samples[i - 1]!)).toBeLessThan(0.05);
    }
  });
});

describe("rainIntensity", () => {
  test("a lull thins the rain but never stops it", () => {
    expect(rainIntensity(1, 0)).toBe(0.5);
    expect(rainIntensity(1, 1)).toBe(1);
  });

  test("no weather means no rain, whatever the swell", () => {
    expect(rainIntensity(0, 1)).toBe(0);
  });
});

describe("droplets", () => {
  const mean = (intensity: number) => {
    let s = 7;
    const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let sum = 0;
    for (let i = 0; i < 4000; i++) sum += dropletDelay(intensity, random);
    return sum / 4000;
  };

  test("gaps are always positive and bounded", () => {
    for (const r of [0, 0.5, 0.999, 1]) {
      const gap = dropletDelay(0.5, seq([r]));
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(1.2);
      expect(Number.isFinite(gap)).toBe(true);
    }
  });

  test("they fall faster as the rain builds", () => {
    expect(mean(1)).toBeLessThan(mean(0.2));
  });

  test("the gaps vary, so it never reads as a rhythm", () => {
    expect(dropletDelay(0.5, seq([0.9]))).toBeGreaterThan(dropletDelay(0.5, seq([0.1])) * 5);
  });

  test("drips are slow and occasional", () => {
    expect(dripDelay(seq([0]))).toBe(5);
    expect(dripDelay(seq([0.999]))).toBeLessThan(14);
  });
});

describe("wrapAround", () => {
  test("leaves a value inside the box alone", () => {
    expect(wrapAround(3, 0, 20)).toBeCloseTo(3);
  });

  test("a drop left behind reappears ahead, on either side", () => {
    expect(wrapAround(25, 0, 20)).toBeCloseTo(-15);
    expect(wrapAround(-25, 0, 20)).toBeCloseTo(15);
  });

  test("it follows the viewer, however far they walk", () => {
    expect(Math.abs(wrapAround(-40, 50, 20) - 50)).toBeLessThanOrEqual(20);
  });
});
