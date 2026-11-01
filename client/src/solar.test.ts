import { describe, expect, test } from "bun:test";
import { solarAngles } from "./town";

/** An independent reference: the standard low-precision solar position
 *  from UTC alone, sharing nothing with the town's function. */
function reference(at: Date, latDeg = 41.9, lonDeg = 12.5): number {
  const rad = Math.PI / 180;
  const n = at.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 4e-7 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const ha = (gmst * 15 + lonDeg) * rad - ra;
  const lat = latDeg * rad;
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) / rad;
}

describe("solarAngles", () => {
  test("agrees with an independent reference all year, day and night", () => {
    for (let month = 0; month < 12; month++) {
      for (let hour = 0; hour < 24; hour += 2) {
        const at = new Date(Date.UTC(2026, month, 15, hour));
        expect(Math.abs(solarAngles(at).elev - reference(at))).toBeLessThan(1.5);
      }
    }
  });

  test("the sun is up at noon and down at midnight in Rome", () => {
    expect(solarAngles(new Date(Date.UTC(2026, 5, 21, 11))).elev).toBeGreaterThan(60);
    expect(solarAngles(new Date(Date.UTC(2026, 5, 21, 23))).elev).toBeLessThan(-15);
  });

  test("it rises in the east, stands south at noon, and sets in the west", () => {
    expect(solarAngles(new Date(Date.UTC(2026, 2, 21, 6, 30))).azim).toBeGreaterThan(70);
    expect(solarAngles(new Date(Date.UTC(2026, 2, 21, 6, 30))).azim).toBeLessThan(120);
    expect(solarAngles(new Date(Date.UTC(2026, 2, 21, 11, 10))).azim).toBeGreaterThan(165);
    expect(solarAngles(new Date(Date.UTC(2026, 2, 21, 11, 10))).azim).toBeLessThan(195);
    expect(solarAngles(new Date(Date.UTC(2026, 2, 21, 16))).azim).toBeGreaterThan(240);
    expect(solarAngles(new Date(Date.UTC(2026, 2, 21, 16))).azim).toBeLessThan(290);
  });
});
