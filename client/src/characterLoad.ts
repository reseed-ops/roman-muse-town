// Characters load before anything else: the order is decided here, in
// pure code with no scene in it, so it can be tested on its own.

/** How long the rest of the town will wait on the characters. A slow or
 *  dead file must cost the buildings a pause, never the visit. */
export const CHARACTER_WAIT_MS = 8000;

import { assetBytes } from "./assetPack";

const clipBytes = new Map<string, Promise<ArrayBuffer>>();

/** Raw bytes of an animation clip, fetched once per URL, so the early
 *  start and the bake that consumes the file share one download. */
export function fetchClipBytes(url: string): Promise<ArrayBuffer> {
  let pending = clipBytes.get(url);
  if (!pending) {
    pending = assetBytes(url).catch((err: unknown) => {
      throw new Error(`clip fetch failed: ${url} (${err instanceof Error ? err.message : String(err)})`);
    });
    clipBytes.set(url, pending);
  }
  return pending;
}

/** The bake's half of the above: hands the bytes over and lets go of them. */
export function takeClipBytes(url: string): Promise<ArrayBuffer> {
  const pending = fetchClipBytes(url);
  clipBytes.delete(url);
  return pending;
}

/** Resolves when every task has settled, failed or not, or after `ms`. */
export function settleWithin(tasks: Promise<unknown>[], ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    void Promise.allSettled(tasks).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export interface QueuedLoad {
  tier: number;
  seq: number;
}

/** Index of the next job to start, or -1 to wait. Lowest tier first,
 *  registration order within a tier. Tier 0 is the characters: until
 *  they have settled, nothing else takes a slot. */
export function nextLoadJob(queue: readonly QueuedLoad[], charactersSettled: boolean): number {
  let best = -1;
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i]!;
    if (!charactersSettled && job.tier > 0) continue;
    const cur = best < 0 ? null : queue[best]!;
    if (!cur || job.tier < cur.tier || (job.tier === cur.tier && job.seq < cur.seq)) best = i;
  }
  return best;
}
