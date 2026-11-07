/**
 * Keeping a visit across a reload (owner's fix list, Nov 7, 2026).
 *
 * A phone that switches away from the town tab often reloads it on the
 * way back. Before this, the reload ended the visit, reset latestSeq to
 * 0 and emptied the transcript. Now the open visit is held in this
 * tab's sessionStorage (never the save, never the server, never
 * another tab) and picked up again on load if it is fresh enough:
 * the slate's counters, the bridge cursor and the transcript come back,
 * so the director sees the same visit (same beganAt, same latestSeq)
 * carry on. Frames are not kept (they are large and quickly stale);
 * the next beat takes a fresh one.
 *
 * Pure over an injected storage, so the round trip is pinned by a test.
 */
import { VISIT_LAPSE_MS } from "../../shared/visitProtocol";
import type { BridgeCursor } from "./visitBridgeClient";
import type { VisitSlate, VisitThreadEntry } from "./visitSlate";

export const VISIT_RESUME_KEY = "muse-town-visit-resume";
/** The transcript kept across a reload: the panel shows the last 8. */
export const RESUME_THREAD_KEEP = 40;

export type VisitResume = {
  slate: VisitSlate;
  thread: VisitThreadEntry[];
  cursor: BridgeCursor;
  savedAt: number;
};

type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

/** Save the open visit, or clear the record when none is open. */
export function saveVisitResume(store: Store | null, slate: VisitSlate, thread: readonly VisitThreadEntry[], cursor: BridgeCursor, now: number): void {
  if (!store) return;
  try {
    if (!slate.active) {
      store.removeItem(VISIT_RESUME_KEY);
      return;
    }
    const lean: VisitSlate = { ...slate, frames: [], unsentFrameIds: [], lookRequested: false };
    const record: VisitResume = { slate: lean, thread: thread.slice(-RESUME_THREAD_KEEP), cursor, savedAt: now };
    store.setItem(VISIT_RESUME_KEY, JSON.stringify(record));
  } catch {
    /* storage full or blocked: the visit simply will not survive a reload */
  }
}

/** The visit to pick up on load, or null. A record older than the
 *  visit lapse is dropped, as the visit would have lapsed anyway. The
 *  heartbeat is refreshed: the reload itself is the tab saying it is
 *  still here. */
export function loadVisitResume(store: Store | null, now: number, lapseMs = VISIT_LAPSE_MS): VisitResume | null {
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(VISIT_RESUME_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as VisitResume;
    const s = r?.slate;
    const ok =
      s && s.active === true && typeof s.beganAt === "number" && typeof s.nextSeq === "number" &&
      Array.isArray(s.inbox) && Array.isArray(s.queue) && Array.isArray(r.thread) &&
      r.cursor && typeof r.cursor.ackedSeq === "number" && typeof r.cursor.pulledThrough === "number" &&
      typeof r.savedAt === "number" && now - r.savedAt <= lapseMs;
    if (!ok) {
      store.removeItem(VISIT_RESUME_KEY);
      return null;
    }
    return { ...r, slate: { ...s, frames: [], unsentFrameIds: [], composing: false, heartbeatAt: now } };
  } catch {
    try {
      store.removeItem(VISIT_RESUME_KEY);
    } catch {
      /* nothing to do */
    }
    return null;
  }
}

export function clearVisitResume(store: Store | null): void {
  try {
    store?.removeItem(VISIT_RESUME_KEY);
  } catch {
    /* nothing to do */
  }
}

export function sessionStore(): Store | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}
