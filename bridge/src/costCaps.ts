/**
 * Cost and consent (Task 6): per-day caps on what the director may
 * spend, from configuration. Calls, output tokens, and frames viewed
 * (sight being the expensive sense) are each counted against a day
 * key; when a cap is reached the director stops that kind of work and
 * the visit simply carries on, or lapses, without it. The ledger can
 * persist to a small JSON file so a restart does not reset the day.
 */
export type CostCaps = { dailyCalls: number; dailyOutputTokens: number; dailyFrames: number };

export type LedgerDay = { day: string; calls: number; outputTokens: number; frames: number };

export type CostLedger = {
  canCall(now: number): boolean;
  recordCall(now: number, usage: { outputTokens: number }): void;
  canViewFrame(now: number): boolean;
  recordFrame(now: number): void;
  snapshot(now: number): LedgerDay & { caps: CostCaps };
};

export const dayKeyUtc = (now: number): string => new Date(now).toISOString().slice(0, 10);

export function createCostLedger(
  caps: CostCaps,
  opts: { dayKey?: (now: number) => string; initial?: LedgerDay | null; persist?: (day: LedgerDay) => void } = {},
): CostLedger {
  const dayKey = opts.dayKey ?? dayKeyUtc;
  let day: LedgerDay = opts.initial ?? { day: "", calls: 0, outputTokens: 0, frames: 0 };
  const roll = (now: number) => {
    const key = dayKey(now);
    if (day.day !== key) day = { day: key, calls: 0, outputTokens: 0, frames: 0 };
  };
  const save = () => opts.persist?.(day);
  return {
    canCall(now) {
      roll(now);
      return day.calls < caps.dailyCalls && day.outputTokens < caps.dailyOutputTokens;
    },
    recordCall(now, usage) {
      roll(now);
      day = { ...day, calls: day.calls + 1, outputTokens: day.outputTokens + Math.max(0, usage.outputTokens | 0) };
      save();
    },
    canViewFrame(now) {
      roll(now);
      return day.frames < caps.dailyFrames;
    },
    recordFrame(now) {
      roll(now);
      day = { ...day, frames: day.frames + 1 };
      save();
    },
    snapshot(now) {
      roll(now);
      return { ...day, caps };
    },
  };
}
