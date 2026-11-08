import { expect, test } from "bun:test";
import { HISTORY_BOOK_INTRO, HISTORY_LESSONS } from "./romanHistory";
import { lessonForPlace } from "./HistoryBook";

// The history book's rules (Task 37), pinned: sourced, short, plain, and
// the town's own story said apart.

test("every lesson is sourced, short and plain, and the forum and temple have theirs", () => {
  expect(lessonForPlace("forum")).toBeDefined();
  expect(lessonForPlace("temple")).toBeDefined();
  const ids = new Set<string>();
  for (const l of HISTORY_LESSONS) {
    expect(ids.has(l.id)).toBe(false);
    ids.add(l.id);
    expect(l.sources.length).toBeGreaterThanOrEqual(2);
    const words = l.text.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThan(50);
    expect(words).toBeLessThan(160);
    for (const text of [l.title, l.period, l.text, l.townNote ?? ""]) {
      expect(text).not.toMatch(/[—–!]/);
    }
    for (const s of l.sources) if (s.url) expect(s.url).toMatch(/^https:\/\//);
  }
  expect(HISTORY_BOOK_INTRO).toContain("fiction");
});
