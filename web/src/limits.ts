// Bounds for the public town (Task 61): small, in-memory, and bounded
// themselves. A limiter here never grows past `maxKeys` entries and never
// clears everything at once: when it is full it forgets the stalest key
// (expired keys first), so a flood of unique keys cannot reset anyone's
// count by overflowing the map.

export interface WindowLimiter {
  /** Reserve one slot for `key` now; false when the key is out of slots. Atomic (synchronous). */
  take(key: string): boolean;
  /** Give back the most recent slot of `key` (a request that cost nothing). */
  refund(key: string): void;
  /** Slots used by `key` in the window. */
  used(key: string): number;
  size(): number;
}

export function createWindowLimiter(opts: { max: number; windowMs: number; maxKeys?: number; now?: () => number }): WindowLimiter {
  const now = opts.now ?? (() => Date.now());
  const maxKeys = opts.maxKeys ?? 20_000;
  const hits = new Map<string, number[]>();
  const live = (key: string, t: number): number[] => {
    const kept = (hits.get(key) ?? []).filter((at) => t - at < opts.windowMs);
    if (kept.length) hits.set(key, kept);
    else hits.delete(key);
    return kept;
  };
  const makeRoom = (t: number): void => {
    if (hits.size < maxKeys) return;
    for (const [key, list] of hits) {
      if (!list.some((at) => t - at < opts.windowMs)) hits.delete(key);
      if (hits.size < maxKeys) return;
    }
    // All still live: forget the stalest (Map keeps insertion order; take() re-inserts on use).
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  };
  return {
    take(key) {
      const t = now();
      const kept = live(key, t);
      if (kept.length >= opts.max) return false;
      hits.delete(key);
      makeRoom(t);
      hits.set(key, [...kept, t]);
      return true;
    },
    refund(key) {
      const kept = hits.get(key);
      if (kept?.length) {
        kept.pop();
        if (!kept.length) hits.delete(key);
      }
    },
    used: (key) => live(key, now()).length,
    size: () => hits.size,
  };
}

/** A counter of things in flight, per key and overall; `enter` returns a release, or null when full. */
export interface FlightGate {
  enter(key: string): (() => void) | null;
  active(): number;
  activeFor(key: string): number;
}

export function createFlightGate(opts: { perKey: number; total: number }): FlightGate {
  const byKey = new Map<string, number>();
  let total = 0;
  return {
    enter(key) {
      const mine = byKey.get(key) ?? 0;
      if (mine >= opts.perKey || total >= opts.total) return null;
      byKey.set(key, mine + 1);
      total++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        total--;
        const left = (byKey.get(key) ?? 1) - 1;
        if (left <= 0) byKey.delete(key);
        else byKey.set(key, left);
      };
    },
    active: () => total,
    activeFor: (key) => byKey.get(key) ?? 0,
  };
}

/** The caller's address for limiting: the proxy's X-Real-IP only when the
 *  deployment says a trusted proxy fronts it; otherwise the socket's own. */
export function clientAddress(req: Request, socketAddress: string | undefined, trustProxy: boolean): string {
  if (trustProxy) {
    const real = req.headers.get("x-real-ip")?.trim();
    if (real && real.length <= 64) return real;
  }
  return socketAddress || "unknown";
}

export function trustProxyFromEnv(env: Record<string, string | undefined>): boolean {
  const set = env.TRUST_PROXY?.trim().toLowerCase();
  if (set === "1" || set === "true") return true;
  if (set === "0" || set === "false") return false;
  return Boolean(env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_PROJECT_ID);
}
