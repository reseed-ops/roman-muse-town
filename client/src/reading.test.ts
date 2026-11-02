import { describe, expect, test } from "bun:test";
import {
  READING_AGAIN_LINES,
  READING_CLOSE_LINES,
  READING_GATE_RANK,
  READING_OPEN_LINES,
  READING_PASSAGES,
  readingPassageIndex,
} from "./town";

// The reading-aloud moment (nursery design): staged at the
// focus-sitting tier, the lowest existing gate for quiet
// together-time, several fresh passages in a steady rotation,
// opening and closing lines of hers around each one, a warm
// deflection for a second ask on the same day, and no em dashes
// anywhere (the owner's standing rule for all town text).
describe("reading aloud at Stories", () => {
  test("the gate is the bench and focus tier: rank 0, no new gate", () => {
    expect(READING_GATE_RANK).toBe(0);
  });

  test("several passages, each a handful of lines, each titled", () => {
    expect(READING_PASSAGES.length).toBeGreaterThanOrEqual(5);
    for (const passage of READING_PASSAGES) {
      expect(passage.title.length).toBeGreaterThan(3);
      expect(passage.lines.length).toBeGreaterThanOrEqual(3);
      expect(passage.lines.length).toBeLessThanOrEqual(5);
      for (const line of passage.lines) expect(line.trim().length).toBeGreaterThan(10);
    }
    const titles = READING_PASSAGES.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test("opening, closing and same-day deflection lines all exist", () => {
    expect(READING_OPEN_LINES.length).toBeGreaterThanOrEqual(3);
    expect(READING_CLOSE_LINES.length).toBeGreaterThanOrEqual(3);
    expect(READING_AGAIN_LINES.length).toBeGreaterThanOrEqual(3);
    for (const line of READING_AGAIN_LINES) {
      expect(line.toLowerCase()).toMatch(/today|tomorrow/);
    }
  });

  test("the rotation walks every passage before repeating", () => {
    const n = READING_PASSAGES.length;
    const seen = new Set<number>();
    for (let day = 0; day < n; day++) {
      const idx = readingPassageIndex(day, 0);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(n);
      seen.add(idx);
    }
    expect(seen.size).toBe(n);
    // A missed day shifts the book: day plus readings both count.
    expect(readingPassageIndex(10, 3)).toBe(readingPassageIndex(13, 0));
    // Negative inputs stay in range.
    const neg = readingPassageIndex(-1, 0);
    expect(neg).toBeGreaterThanOrEqual(0);
    expect(neg).toBeLessThan(n);
  });

  test("no reading text carries an em dash", () => {
    const all = [
      ...READING_OPEN_LINES,
      ...READING_CLOSE_LINES,
      ...READING_AGAIN_LINES,
      ...READING_PASSAGES.flatMap((p) => [p.title, ...p.lines]),
    ];
    for (const line of all) expect(line).not.toContain("\u2014");
  });
});
