// The pairing limiter (Task 61, Codex S1). POST /pair is public, so it
// bounds what any one caller, and all callers together, may attempt.
//
// A slot is reserved BEFORE the upstream call (reserve() is synchronous,
// so a burst of concurrent guesses cannot all read the same empty counter)
// and settled after it:
//   miss     the code was wrong (404): the slot stays spent for the window;
//   success  a pairing was made: counted separately, bounded per window;
//   release  anything else (the town was down, a 5xx): the slot is given back.
// Limits, per source address and overall: misses plus pending attempts in
// the window, attempts in flight, and successes in the window. The map is
// bounded and expiring: when full it forgets the stalest source, never
// everything at once, so a flood of addresses cannot wipe anyone's count.

export interface PairLimits {
  /** Wrong codes (and attempts still pending) one source may have in the window. */
  missesPerSource: number;
  windowMs: number;
  /** Successful pairings one source may make in the window. */
  successesPerSource: number;
  /** Attempts one source may have in flight at once. */
  inFlightPerSource: number;
  /** The same bounds over every source together (a caller forging addresses meets these). */
  missesTotal: number;
  inFlightTotal: number;
  maxSources: number;
}

export const DEFAULT_PAIR_LIMITS: PairLimits = {
  missesPerSource: 8,
  windowMs: 10 * 60 * 1000,
  successesPerSource: 5,
  inFlightPerSource: 2,
  missesTotal: 120,
  inFlightTotal: 16,
  maxSources: 10_000,
};

export type Reserve = { ok: true; settle(outcome: "miss" | "success" | "release"): void } | { ok: false; reason: "misses" | "successes" | "in-flight" | "busy" };

type Entry = { at: number; kind: "pending" | "miss" | "success" };

export function createPairLimiter(opts: Partial<PairLimits> & { now?: () => number } = {}) {
  const lim: PairLimits = { ...DEFAULT_PAIR_LIMITS, ...opts };
  const now = opts.now ?? (() => Date.now());
  const sources = new Map<string, Entry[]>();
  let pendingTotal = 0;
  let missesTotal: number[] = []; // times of every miss and pending attempt, overall

  const live = (who: string, t: number): Entry[] => {
    const kept = (sources.get(who) ?? []).filter((e) => e.kind === "pending" || t - e.at < lim.windowMs);
    if (kept.length) sources.set(who, kept);
    else sources.delete(who);
    return kept;
  };
  const makeRoom = (t: number) => {
    if (sources.size < lim.maxSources) return;
    for (const [who, list] of sources) {
      if (!list.some((e) => e.kind === "pending" || t - e.at < lim.windowMs)) sources.delete(who);
      if (sources.size < lim.maxSources) return;
    }
    for (const [who, list] of sources) {
      if (!list.some((e) => e.kind === "pending")) {
        sources.delete(who);
        return;
      }
    }
  };

  return {
    reserve(who: string): Reserve {
      const t = now();
      missesTotal = missesTotal.filter((at) => t - at < lim.windowMs);
      const list = live(who, t);
      const mine = list.filter((e) => e.kind === "pending").length;
      const spent = list.filter((e) => e.kind !== "success").length;
      const wins = list.length - spent;
      if (pendingTotal >= lim.inFlightTotal || missesTotal.length >= lim.missesTotal) return { ok: false, reason: "busy" };
      if (mine >= lim.inFlightPerSource) return { ok: false, reason: "in-flight" };
      if (spent >= lim.missesPerSource) return { ok: false, reason: "misses" };
      if (wins >= lim.successesPerSource) return { ok: false, reason: "successes" };
      const entry: Entry = { at: t, kind: "pending" };
      sources.delete(who);
      makeRoom(t);
      sources.set(who, [...list, entry]);
      pendingTotal++;
      missesTotal.push(t);
      let settled = false;
      return {
        ok: true,
        settle(outcome) {
          if (settled) return;
          settled = true;
          pendingTotal--;
          const mineNow = sources.get(who);
          if (outcome === "miss") entry.kind = "miss";
          else if (outcome === "success") {
            entry.kind = "success";
            const i = missesTotal.indexOf(t);
            if (i >= 0) missesTotal.splice(i, 1);
          } else {
            const i = mineNow?.indexOf(entry) ?? -1;
            if (i >= 0) mineNow!.splice(i, 1);
            if (mineNow && !mineNow.length) sources.delete(who);
            const j = missesTotal.indexOf(t);
            if (j >= 0) missesTotal.splice(j, 1);
          }
          entry.at = now();
        },
      };
    },
    sources: () => sources.size,
    pending: () => pendingTotal,
  };
}

export type PairLimiter = ReturnType<typeof createPairLimiter>;

/** Trust X-Real-IP only where a proxy is configured to set it. */
export function trustProxyFromEnv(env: Record<string, string | undefined>): boolean {
  const set = env.TRUST_PROXY?.trim().toLowerCase();
  if (set === "1" || set === "true") return true;
  if (set === "0" || set === "false") return false;
  return Boolean(env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_PROJECT_ID);
}
