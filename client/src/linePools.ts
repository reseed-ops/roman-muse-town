// No-repeat line pools (japan-life's lesson, brought home): authored
// AMBIENT lines are drawn WITHOUT replacement from a shuffled bag,
// so the most-heard pools stop echoing themselves. Each pool's draw
// state (the bag of unheard line ids + the last 1-2 heard) is kept
// server-side in the line_pools store and hydrated on load; every
// draw marks itself there, so the no-repeat promise survives
// sessions, not just visits.
//
// A line's id is a stable hash of its text: reordering a pool or
// adding lines never invalidates a stored bag (ids that no longer
// exist are filtered out on the next draw; new lines join at the
// next reshuffle).
//
// REFRAINS: the first 1-2 lines of a pool of 4+ are her signature
// phrases for that pool — exempt from the bag, always eligible at a
// low rate, so she keeps her characteristic lines without them ever
// dominating. Pools of 3 or fewer simply rotate (shuffled bag, no
// exclusions), as small pools may.
//
// EXEMPT by design (never routed through here): summit lines, dream
// lines and the dream echo, rank-up letters, first-meeting lines,
// quest-critical lines, festival/date-keyed lines, private-name
// usage, dialogue-CHOICE lines and their replies, and any line
// already gated by a durable flag (kiss/hand-hold moments, the bath
// care line, sky-watch sequences, the scripted fallback voice).

export interface PoolState {
  /** Line ids not yet drawn from the current shuffle. */
  bag: string[];
  /** The last 1-2 drawn line ids, newest last. */
  lastHeard: string[];
}

/** Stable line id: FNV-1a over the text, base-36. */
export function lineId(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** How many signature refrains a pool keeps out of its bag. */
export function refrainCountFor(poolSize: number): number {
  if (poolSize >= 7) return 2;
  if (poolSize >= 4) return 1;
  return 0;
}

function shuffled(ids: string[], rng: () => number): string[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Draw one line from a pool without repeating until exhaustion.
 *  Pure: returns the line and the NEXT pool state (or null when the
 *  pool is empty). On reshuffle, the last 1-2 heard ids are excluded
 *  (pools with more than 3 drawable lines) so a pool never echoes
 *  across its own boundary. */
export function drawFromPool(
  state: PoolState,
  lines: readonly string[],
  rng: () => number = Math.random,
): { line: string; state: PoolState } | null {
  if (lines.length === 0) return null;
  const ids = lines.map(lineId);
  const refrains = ids.slice(0, refrainCountFor(lines.length));
  // Signature refrains stay always-eligible at a low rate and are
  // never marked in the bag.
  if (refrains.length > 0 && rng() < 0.15) {
    const id = refrains[Math.floor(rng() * refrains.length)]!;
    return { line: lines[ids.indexOf(id)]!, state };
  }
  const drawable = ids.filter((id) => !refrains.includes(id));
  // Keep only bag ids that still exist and are still drawable.
  let bag = state.bag.filter((id) => drawable.includes(id));
  if (bag.length === 0) {
    let refill = drawable;
    if (drawable.length > 3) {
      const excluded = state.lastHeard.slice(-2);
      const kept = drawable.filter((id) => !excluded.includes(id));
      if (kept.length > 0) refill = kept;
    }
    bag = shuffled(refill, rng);
  }
  const [next, ...rest] = bag;
  if (next === undefined) return { line: lines[0]!, state };
  return {
    line: lines[ids.indexOf(next)]!,
    state: { bag: rest, lastHeard: [...state.lastHeard, next].slice(-2) },
  };
}

type PersistFn = (poolKey: string, state: PoolState) => void;

/** The shared draw-state manager: App hydrates it from the server
 *  state and gives it a persist callback (the recordLineDraw
 *  action); the 3D scene draws through the same instance. */
class LinePoolManager {
  private states = new Map<string, PoolState>();
  private touched = new Set<string>();
  private persist: PersistFn | null = null;

  setPersist(fn: PersistFn): void {
    this.persist = fn;
  }

  /** Take the server's stored draw states (wire shape). Pools
   *  already drawn from this session keep their fresher state. */
  hydrate(record: Record<string, { bag: string[]; last_heard: string[] }>): void {
    for (const [key, value] of Object.entries(record)) {
      if (this.touched.has(key)) continue;
      if (Array.isArray(value?.bag) && Array.isArray(value?.last_heard)) {
        this.states.set(key, { bag: [...value.bag], lastHeard: [...value.last_heard] });
      }
    }
  }

  draw(poolKey: string, lines: readonly string[]): string | null {
    if (lines.length === 0) return null;
    if (lines.length === 1) return lines[0]!;
    const current = this.states.get(poolKey) ?? { bag: [], lastHeard: [] };
    const result = drawFromPool(current, lines);
    if (!result) return lines[0]!;
    this.states.set(poolKey, result.state);
    this.touched.add(poolKey);
    this.persist?.(poolKey, result.state);
    return result.line;
  }
}

export const linePools = new LinePoolManager();

/** Draw from a named ambient pool, never repeating until it is
 *  exhausted. Falls back to the pool's first line if anything is off. */
export function pickPooled(poolKey: string, lines: readonly string[]): string {
  return linePools.draw(poolKey, lines) ?? lines[0]!;
}
