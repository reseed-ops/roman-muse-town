// Guards for the push channel (Task 67): a bounded, expiring attempt counter, a
// sampled logger, and a writer that survives a slow reader. No text, no tokens.
import { createHash } from "node:crypto";

/** Attempts per key in a sliding window; the key table is bounded (the stalest key goes first). */
export function createAttemptWindow(limit: number, windowMs: number, opts: { maxKeys?: number; now?: () => number } = {}) {
  const now = opts.now ?? (() => Date.now());
  const maxKeys = opts.maxKeys ?? 10_000;
  const keys = new Map<string, number[]>();
  return {
    /** Count an attempt; false when the key is over its limit (the attempt is not counted then). */
    hit(key: string): boolean {
      const t = now();
      const list = (keys.get(key) ?? []).filter((at) => t - at < windowMs);
      keys.delete(key);
      if (list.length >= limit) {
        keys.set(key, list);
        return false;
      }
      if (keys.size >= maxKeys) keys.delete(keys.keys().next().value as string);
      list.push(t);
      keys.set(key, list);
      return true;
    },
    size: () => keys.size,
  };
}

/** A digest of a credential, only ever used as a counter key: never logged, never sent. */
export const credentialKey = (presented: string): string => createHash("sha256").update(presented).digest("hex").slice(0, 32);

/** Log the first of a kind at once, then at most one line per interval saying how many were held back. */
export function createSampledLog(log: (line: string) => void, intervalMs = 10_000, now: () => number = () => Date.now()) {
  const kinds = new Map<string, { at: number; held: number }>();
  return (kind: string, line: string): void => {
    const t = now();
    const e = kinds.get(kind);
    if (!e || t - e.at >= intervalMs) {
      log(e && e.held ? `${line} (${e.held} similar held back)` : line);
      kinds.set(kind, { at: t, held: 0 });
    } else e.held += 1;
  };
}

export type WritableLike = {
  write(chunk: string): boolean;
  readonly writableLength: number;
  on(event: "drain", listener: () => void): unknown;
};

/**
 * Writes to one stream without letting a slow reader grow the buffer:
 * - a marker is STATE, so while the socket is full only the latest is kept
 *   (coalesced) and written when it drains; comments are simply skipped;
 * - the stream is abandoned when the unsent bytes pass `maxBuffer`, or when it
 *   has been full for `stallMs` (checked by `check()` on the heartbeat).
 */
export function createStreamWriter(res: WritableLike, opts: { maxBuffer: number; stallMs: number; abandon: (why: "buffer" | "stalled") => void; now?: () => number }) {
  const now = opts.now ?? (() => Date.now());
  let blockedSince: number | null = null;
  let latest: { chunk: string; onWrite?: () => void } | null = null;
  let dead = false;
  const send = (chunk: string, onWrite?: () => void) => {
    if (dead) return;
    const ok = res.write(chunk);
    if (ok === false && blockedSince === null) blockedSince = now();
    onWrite?.(); // the chunk has been handed to the socket (not: received by the client)
    if (res.writableLength > opts.maxBuffer) opts.abandon("buffer");
  };
  res.on("drain", () => {
    if (dead) return;
    blockedSince = null;
    if (latest !== null) {
      const { chunk, onWrite } = latest;
      latest = null;
      send(chunk, onWrite);
    }
  });
  return {
    /** `onWrite` runs when this marker is actually handed to the socket; a coalesced-away marker never calls it. */
    marker(chunk: string, onWrite?: () => void) {
      if (dead) return;
      if (blockedSince !== null) latest = { chunk, onWrite };
      else send(chunk, onWrite);
    },
    comment(chunk: string) {
      if (blockedSince === null) send(chunk);
    },
    /** After this nothing more is written, and a pending marker is forgotten. */
    close() {
      dead = true;
      latest = null;
    },
    check() {
      if (!dead && blockedSince !== null && now() - blockedSince >= opts.stallMs) opts.abandon("stalled");
    },
    blocked: () => blockedSince !== null,
  };
}
