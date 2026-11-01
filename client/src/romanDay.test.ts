import { describe, expect, test } from "bun:test";
import { pickRomanPool, ROMAN_PLACE_LINES, romanDate, romanHour, romanPools, type RomanDate } from "./romanDay";
import { solarAngles } from "./town";

// Noon in Rome, so the calendar day is never in doubt.
const on = (month: number, day: number, year = 2026) => new Date(Date.UTC(year, month - 1, day, 11));
const elevation = (at: Date) => solarAngles(at).elev;
const day = (over: Partial<RomanDate> = {}): RomanDate => ({ month: 11, day: 20, marked: null, market: false, ...over });

describe("romanDate", () => {
  test("the Kalends is the first of every month", () => {
    expect(romanDate(on(1, 1)).marked).toBe("kalends");
    expect(romanDate(on(8, 1)).marked).toBe("kalends");
  });

  test("March, May, July and October run late", () => {
    for (const month of [3, 5, 7, 10]) {
      expect(romanDate(on(month, 7)).marked).toBe("nones");
      expect(romanDate(on(month, 15)).marked).toBe("ides");
      expect(romanDate(on(month, 5)).marked).toBeNull();
      expect(romanDate(on(month, 13)).marked).toBeNull();
    }
  });

  test("every other month keeps the 5th and the 13th", () => {
    for (const month of [1, 2, 4, 6, 8, 9, 11, 12]) {
      expect(romanDate(on(month, 5)).marked).toBe("nones");
      expect(romanDate(on(month, 13)).marked).toBe("ides");
      expect(romanDate(on(month, 7)).marked).toBeNull();
    }
  });

  test("market day comes round every eighth day, month ends included", () => {
    const start = Date.UTC(2026, 0, 1, 11);
    const markets: number[] = [];
    for (let i = 0; i < 365; i++) if (romanDate(new Date(start + i * 86400000)).market) markets.push(i);
    expect(markets.length).toBeGreaterThan(44);
    for (let i = 1; i < markets.length; i++) expect(markets[i]! - markets[i - 1]!).toBe(8);
  });

  test("the date is Rome's, whatever the clock says elsewhere", () => {
    // 23:30 UTC on Oct 14 is already the 15th in Rome.
    expect(romanDate(new Date(Date.UTC(2026, 9, 14, 23, 30))).marked).toBe("ides");
  });
});

describe("romanHour", () => {
  test("there are no hours at night", () => {
    expect(romanHour(new Date(Date.UTC(2026, 5, 21, 23)), elevation)).toBeNull();
  });

  test("noon by the sun falls at the turn of the sixth hour, in any season", () => {
    for (const month of [3, 6, 9, 12]) {
      const solarNoon = new Date(Date.UTC(2026, month - 1, 21, 11, 10));
      expect([6, 7]).toContain(romanHour(solarNoon, elevation)!);
    }
  });

  test("the hours stay within 1 to 12 at dawn and dusk", () => {
    for (let h = 0; h < 24; h++) {
      const hour = romanHour(new Date(Date.UTC(2026, 3, 10, h, 30)), elevation);
      if (hour !== null) {
        expect(hour).toBeGreaterThanOrEqual(1);
        expect(hour).toBeLessThanOrEqual(12);
      }
    }
  });

  test("the eighth hour comes earlier by the clock in December than in June", () => {
    const firstEighth = (month: number) => {
      for (let m = 0; m < 24 * 60; m += 10) {
        const at = new Date(Date.UTC(2026, month - 1, 21, 0, m));
        if (romanHour(at, elevation) === 8) return m;
      }
      return -1;
    };
    expect(firstEighth(12)).toBeLessThan(firstEighth(6));
  });
});

describe("romanPools", () => {
  const keys = (d: RomanDate, hour: number | null) => romanPools(d, hour).map((p) => p.key);

  test("an ordinary afternoon has only lore", () => {
    expect(keys(day(), 4)).toEqual(["roman:lore"]);
  });

  test("the day's own news comes first", () => {
    expect(keys(day({ marked: "ides" }), 4)[0]).toBe("roman:ides");
    expect(keys(day({ market: true }), 4)[0]).toBe("roman:market-day");
  });

  test("the bath line only plays at the bath hours", () => {
    expect(keys(day(), 8)).toContain("roman:hour-bath");
    expect(keys(day(), 7)).not.toContain("roman:hour-bath");
    expect(keys(day(), null)).not.toContain("roman:hour-bath");
  });

  test("seasons keep to their months", () => {
    expect(keys(day({ month: 8, day: 1 }), 4)).toContain("roman:season-1");
    expect(keys(day({ month: 12, day: 1 }), 4).filter((k) => k.includes("season"))).toEqual([]);
  });

  test("night brings the night sky, not street lore", () => {
    expect(keys(day(), null)).toEqual(["roman:night-lore"]);
  });

  test("a marked day is usually what she mentions", () => {
    const pools = romanPools(day({ marked: "kalends" }), 4);
    expect(pickRomanPool(pools, () => 0.1).key).toBe("roman:kalends");
    expect(pickRomanPool(pools, () => 0.9).key).toBe("roman:lore");
  });

  test("every line fits her speech bubble, on any day of the year", () => {
    const seen = new Set<string>();
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        for (const marked of ["kalends", "nones", "ides", null] as const) {
          for (const hour of [1, 8, 4, null]) {
            for (const pool of romanPools({ month: m, day: d, marked, market: true }, hour)) {
              expect(pool.lines.length).toBeGreaterThan(0);
              for (const line of pool.lines) seen.add(line);
            }
          }
        }
      }
    }
    for (const lines of Object.values(ROMAN_PLACE_LINES)) for (const line of lines) seen.add(line);
    for (const line of seen) expect(line.length).toBeLessThanOrEqual(210);
    expect(seen.size).toBeGreaterThan(30);
  });
});
