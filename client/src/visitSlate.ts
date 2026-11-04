/**
 * The visit slate (Task 4, Nov 2026): runtime-only visit state for the
 * town client, mirroring the private line's shapes. Pure functions over
 * a plain object, so the lifecycle (begin, end, heartbeat lapse), the
 * listening half (visit mail, capped, slate-only), the sight half
 * (frame retention, metadata-only views), and the direction queue are
 * each pinned by a test without a scene.
 *
 * Nothing here touches the save. Ending or lapsing a visit clears the
 * slate whole: inbox, frames, intention, queue, events, all of it.
 */
import {
  VISIT_EVENT_CAP,
  VISIT_FRAME_KEEP,
  VISIT_INBOX_CAP,
  VISIT_LAPSE_MS,
  validateDirection,
  type DirectionValidation,
  type QueuedDirection,
  type VisitEvent,
  type VisitFrame,
  type VisitFrameMeta,
  type VisitMail,
  type VisitStateView,
  type VisitTelemetry,
} from "../../shared/visitProtocol";

export type VisitSlate = {
  active: boolean;
  beganAt: number | null;
  heartbeatAt: number | null;
  intention: string | null;
  composing: boolean;
  telemetry: VisitTelemetry | null;
  events: VisitEvent[];
  inbox: VisitMail[];
  nextSeq: number;
  frames: VisitFrame[];
  nextFrameId: number;
  /** Frames not yet carried to the director (ids). */
  unsentFrameIds: number[];
  /** A director asked for a look: the next beat captures promptly. */
  lookRequested: boolean;
  queue: QueuedDirection[];
  nextDirectionId: number;
  enactedThrough: number;
};

export const emptySlate = (): VisitSlate => ({
  active: false,
  beganAt: null,
  heartbeatAt: null,
  intention: null,
  composing: false,
  telemetry: null,
  events: [],
  inbox: [],
  nextSeq: 1,
  frames: [],
  nextFrameId: 1,
  unsentFrameIds: [],
  lookRequested: false,
  queue: [],
  nextDirectionId: 1,
  enactedThrough: 0,
});

/** Begin a visit now. Beginning an open visit only refreshes the heartbeat. */
export function beginVisit(s: VisitSlate, now: number): VisitSlate {
  if (s.active) return { ...s, heartbeatAt: now };
  const fresh = emptySlate();
  return {
    ...fresh,
    active: true,
    beganAt: now,
    heartbeatAt: now,
    events: [{ at: now, text: "visit began" }],
  };
}

/** End a visit: the slate dies whole. Idempotent. */
export function endVisit(_s: VisitSlate): VisitSlate {
  return emptySlate();
}

export function heartbeat(s: VisitSlate, now: number): VisitSlate {
  return s.active ? { ...s, heartbeatAt: now } : s;
}

/** The heartbeat has gone quiet for a generous stretch. */
export function visitLapsed(s: VisitSlate, now: number, lapseMs = VISIT_LAPSE_MS): boolean {
  return s.active && s.heartbeatAt !== null && now - s.heartbeatAt > lapseMs;
}

export function recordEvent(s: VisitSlate, now: number, text: string): VisitSlate {
  if (!s.active) return s;
  const events = [...s.events, { at: now, text }].slice(-VISIT_EVENT_CAP);
  return { ...s, events };
}

/** A panel send while a visit is open: laid on the slate as mail,
 *  sequence-numbered, capped at the recent VISIT_INBOX_CAP. Mail
 *  counts as a chat turn for the heartbeat. */
export function captureMail(s: VisitSlate, text: string, now: number): { slate: VisitSlate; mail: VisitMail } {
  const mail: VisitMail = { seq: s.nextSeq, text, at: now };
  const inbox = [...s.inbox, mail].slice(-VISIT_INBOX_CAP);
  return { slate: { ...s, inbox, nextSeq: s.nextSeq + 1, heartbeatAt: now }, mail };
}

export function setIntention(s: VisitSlate, text: string | null): VisitSlate {
  return s.active ? { ...s, intention: text } : s;
}

export function setComposing(s: VisitSlate, on: boolean): VisitSlate {
  return s.active ? { ...s, composing: on } : s;
}

export function setTelemetry(s: VisitSlate, telemetry: VisitTelemetry): VisitSlate {
  return s.active ? { ...s, telemetry } : s;
}

/** Accept a captured frame: numbered, stamped, retained with the
 *  latest VISIT_FRAME_KEEP only, and marked unsent. */
export function acceptFrame(
  s: VisitSlate,
  frame: { dataUrl: string; width: number; height: number; bytes: number },
  now: number,
): VisitSlate {
  if (!s.active) return s;
  const id = s.nextFrameId;
  const full: VisitFrame = { id, at: now, ...frame };
  const frames = [...s.frames, full].slice(-VISIT_FRAME_KEEP);
  const kept = new Set(frames.map((f) => f.id));
  const unsentFrameIds = [...s.unsentFrameIds, id].filter((fid) => kept.has(fid));
  return { ...s, frames, nextFrameId: id + 1, unsentFrameIds, lookRequested: false };
}

export const frameMeta = (f: VisitFrame): VisitFrameMeta => ({ id: f.id, at: f.at, width: f.width, height: f.height, bytes: f.bytes });

export function unsentFrames(s: VisitSlate): VisitFrame[] {
  return s.frames.filter((f) => s.unsentFrameIds.includes(f.id));
}

export function markFramesSent(s: VisitSlate, ids: readonly number[]): VisitSlate {
  return { ...s, unsentFrameIds: s.unsentFrameIds.filter((id) => !ids.includes(id)) };
}

export function requestLook(s: VisitSlate): VisitSlate {
  return s.active ? { ...s, lookRequested: true } : s;
}

/** Enqueue a direction after validation. Refused when no visit is open. */
export function enqueueDirection(s: VisitSlate, raw: unknown, now: number): { slate: VisitSlate; result: DirectionValidation } {
  if (!s.active) return { slate: s, result: { ok: false, error: "no visit is open" } };
  const result = validateDirection(raw);
  if (!result.ok) return { slate: s, result };
  const queued: QueuedDirection = { id: s.nextDirectionId, at: now, direction: result.direction };
  return {
    slate: { ...s, queue: [...s.queue, queued], nextDirectionId: s.nextDirectionId + 1, heartbeatAt: now },
    result,
  };
}

/** Take the next direction off the queue. */
export function nextDirection(s: VisitSlate): { slate: VisitSlate; next: QueuedDirection | null } {
  const [next, ...rest] = s.queue;
  if (!next) return { slate: s, next: null };
  return { slate: { ...s, queue: rest, enactedThrough: Math.max(s.enactedThrough, next.id) }, next };
}

/** Absorb directions the harness carried in (already validated there;
 *  validated again here, the client trusts no wire). Ids come from the
 *  harness, so the enactedThrough bookkeeping matches both sides. */
export function absorbDirections(s: VisitSlate, incoming: readonly QueuedDirection[], now: number): VisitSlate {
  if (!s.active || incoming.length === 0) return s;
  const known = new Set(s.queue.map((q) => q.id));
  const queue = [...s.queue];
  let touched = false;
  for (const q of incoming) {
    if (q.id <= s.enactedThrough || known.has(q.id)) continue;
    const check = validateDirection(q.direction);
    if (!check.ok) continue;
    queue.push({ id: q.id, at: q.at, direction: check.direction });
    touched = true;
  }
  queue.sort((a, b) => a.id - b.id);
  return touched ? { ...s, queue, heartbeatAt: now, nextDirectionId: Math.max(s.nextDirectionId, (queue[queue.length - 1]?.id ?? 0) + 1) } : s;
}

/** What a director may see: frame metadata only, never bytes. */
export function stateView(s: VisitSlate): VisitStateView {
  return {
    active: s.active,
    beganAt: s.beganAt,
    heartbeatAt: s.heartbeatAt,
    intention: s.intention,
    composing: s.composing,
    telemetry: s.telemetry,
    events: s.events,
    inboxCount: s.inbox.length,
    latestSeq: s.nextSeq - 1,
    frames: s.frames.map(frameMeta),
    queueLength: s.queue.length,
    enactedThrough: s.enactedThrough,
  };
}

/** Small world events, derived from telemetry turning over: arrived,
 *  sat, stood, daybreak, nightfall. Pure, so the ring is pinned. */
export function telemetryEvents(prev: VisitTelemetry | null, next: VisitTelemetry): string[] {
  const out: string[] = [];
  if (!prev) return out;
  if (prev.gaiusZone !== next.gaiusZone && next.gaiusZone !== "roaming" && next.gaiusZone !== "away") out.push(`Gaius arrived at the ${next.gaiusZone}`);
  if (prev.museZone !== next.museZone && next.museZone !== "roaming") out.push(`Aelia arrived at the ${next.museZone}`);
  if (!prev.gaiusSeated && next.gaiusSeated) out.push("Gaius sat");
  if (prev.gaiusSeated && !next.gaiusSeated) out.push("Gaius stood");
  if (!prev.museSeated && next.museSeated) out.push("Aelia sat");
  if (prev.museSeated && !next.museSeated) out.push("Aelia stood");
  if (prev.dayPhase === "night" && next.dayPhase !== "night") out.push("daybreak");
  if (prev.dayPhase !== "night" && next.dayPhase === "night") out.push("nightfall");
  return out;
}

/** The panel thread while a visit is open: his mail and her answers,
 *  a growing line replaced in place by its lineId. */
export type VisitThreadEntry = { who: "him" | "her"; text: string; seq?: number; lineId?: string; partial?: boolean };

export function threadWithSpeak(thread: readonly VisitThreadEntry[], text: string, lineId: string | undefined, partial: boolean): VisitThreadEntry[] {
  if (lineId) {
    const idx = thread.findIndex((e) => e.who === "her" && e.lineId === lineId);
    if (idx >= 0) {
      const next = [...thread];
      next[idx] = { who: "her", text, lineId, partial };
      return next;
    }
  }
  return [...thread, { who: "her", text, lineId, partial }];
}
