import { expect, test } from "bun:test";
import { createCostLedger } from "./costCaps.js";

// Per-day caps: calls, output tokens, frames; a new day resets; persisted.

test("caps hold within a day and reset on the next", () => {
  const saved: unknown[] = [];
  const day = (now: number) => (now < 100 ? "d1" : "d2");
  const ledger = createCostLedger({ dailyCalls: 2, dailyOutputTokens: 100, dailyFrames: 1 }, { dayKey: day, persist: (d) => saved.push(d) });
  expect(ledger.canCall(1)).toBe(true);
  ledger.recordCall(1, { outputTokens: 40 });
  ledger.recordCall(2, { outputTokens: 40 });
  expect(ledger.canCall(3)).toBe(false);
  expect(ledger.canViewFrame(3)).toBe(true);
  ledger.recordFrame(3);
  expect(ledger.canViewFrame(4)).toBe(false);
  expect(ledger.snapshot(4)).toEqual({ day: "d1", calls: 2, outputTokens: 80, frames: 1, caps: { dailyCalls: 2, dailyOutputTokens: 100, dailyFrames: 1 } });
  expect(ledger.canCall(100)).toBe(true);
  expect(ledger.snapshot(100).calls).toBe(0);
  expect(saved.length).toBe(3);
  // The token cap binds on its own.
  const tokens = createCostLedger({ dailyCalls: 99, dailyOutputTokens: 50, dailyFrames: 9 }, { dayKey: day });
  tokens.recordCall(1, { outputTokens: 50 });
  expect(tokens.canCall(2)).toBe(false);
  // A persisted day resumes.
  const resumed = createCostLedger({ dailyCalls: 2, dailyOutputTokens: 100, dailyFrames: 1 }, { dayKey: day, initial: { day: "d1", calls: 2, outputTokens: 0, frames: 0 } });
  expect(resumed.canCall(1)).toBe(false);
});
