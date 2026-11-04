/**
 * Adapter B (Task 7): the director channel as a SERVING face. Gate 0's
 * verdict (CLAUDE-TASKS.md, Nov 4, 2026) flipped the direction: the
 * bridge never calls into the town's platform. During a visit the
 * town client calls out, posting its slate snapshot (state, new inbox
 * mail, the latest frame when one is offered) and pulling the
 * directions and composing state queued since its cursor. This file
 * is the held snapshot and the queue, pure over its own closure; the
 * HTTP carrier and the token gate live in bridgeServer.ts.
 *
 * The director loop reads the held snapshot through the same narrow
 * DirectorChannel it reads the harness through, so director.ts is
 * untouched. When no snapshot has arrived inside the lapse window the
 * face reads as a closed visit: the bridge goes quiet, and the town
 * folds the visit by its own heartbeat. The surface stays slate-only:
 * nothing here can reach facts, letters, bond, or digest.
 */
import {
  BRIDGE_SNAPSHOT_LAPSE_MS,
  VISIT_FRAME_KEEP,
  VISIT_INBOX_CAP,
  validateDirection,
  validateFrameDataUrl,
  type BridgePullResponse,
  type BridgeSnapshotResponse,
  type DirectorPack,
  type QueuedDirection,
  type VisitDirection,
  type VisitEvent,
  type VisitFrame,
  type VisitFrameMeta,
  type VisitMail,
  type VisitStateView,
  type VisitTelemetry,
} from "../../shared/visitProtocol.js";
import type { ChannelState, DirectResult, DirectorChannel } from "./channel.js";

export type IntakeResult = BridgeSnapshotResponse | { ok: false; error: string };

export type SlateFace = {
  /** The director channel over the held snapshot. */
  channel: DirectorChannel;
  /** The client's snapshot, raw off the wire: validated at the door. */
  intake(raw: unknown): IntakeResult;
  /** The client's pull: directions queued since its cursor. Directions
   *  at or below the cursor are forgotten (the client has them). */
  pull(since: number): BridgePullResponse;
  /** For tests and logs: what is held right now. */
  held(): { state: VisitStateView; inbox: VisitMail[]; frames: VisitFrame[]; receivedAt: number } | null;
};

export type SlateFaceOptions = { now?: () => number; lapseMs?: number };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const numOrNull = (v: unknown): number | null => (v === null ? null : isNum(v) ? v : NaN);
const DAY_PHASES = ["night", "dawn", "day", "dusk"] as const;
const PAD2 = ["none", "human", "director"] as const;

/** The telemetry the director is shown: every field typed, or nothing. */
function readTelemetry(raw: unknown): VisitTelemetry | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  const strs = ["museZone", "gaiusZone"] as const;
  const bools = ["museSeated", "gaiusSeated", "gaiusWalking"] as const;
  const nums = ["museX", "museZ", "gaiusX", "gaiusZ", "museHeading", "gaiusHeading", "bearingToGaius", "distanceToGaius"] as const;
  for (const k of strs) if (typeof raw[k] !== "string") return null;
  for (const k of bools) if (typeof raw[k] !== "boolean") return null;
  for (const k of nums) if (!isNum(raw[k])) return null;
  if (!(DAY_PHASES as readonly string[]).includes(String(raw.dayPhase))) return null;
  if (!(PAD2 as readonly string[]).includes(String(raw.pad2Source))) return null;
  const t: VisitTelemetry = {
    museZone: raw.museZone as string,
    gaiusZone: raw.gaiusZone as string,
    museSeated: raw.museSeated as boolean,
    gaiusSeated: raw.gaiusSeated as boolean,
    gaiusWalking: raw.gaiusWalking as boolean,
    dayPhase: raw.dayPhase as VisitTelemetry["dayPhase"],
    museX: raw.museX as number,
    museZ: raw.museZ as number,
    gaiusX: raw.gaiusX as number,
    gaiusZ: raw.gaiusZ as number,
    museHeading: raw.museHeading as number,
    gaiusHeading: raw.gaiusHeading as number,
    bearingToGaius: raw.bearingToGaius as number,
    distanceToGaius: raw.distanceToGaius as number,
    pad2Source: raw.pad2Source as VisitTelemetry["pad2Source"],
  };
  return t;
}

function readFrameMeta(raw: unknown): VisitFrameMeta | null {
  if (!isRecord(raw)) return null;
  const { id, at, width, height, bytes } = raw;
  if (!isNum(id) || !isNum(at) || !isNum(width) || !isNum(height) || !isNum(bytes)) return null;
  return { id, at, width, height, bytes };
}

function readEvents(raw: unknown): VisitEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: VisitEvent[] = [];
  for (const e of raw) {
    if (isRecord(e) && isNum(e.at) && typeof e.text === "string") out.push({ at: e.at, text: e.text.slice(0, 200) });
  }
  return out.slice(-24);
}

/** A state view off the wire: the fields the director reads, each
 *  typed, or an error. Strict and total, like validateDirection. */
export function readStateView(raw: unknown): { ok: true; state: VisitStateView } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "a snapshot carries state" };
  if (typeof raw.active !== "boolean") return { ok: false, error: "state.active is a boolean" };
  const beganAt = numOrNull(raw.beganAt);
  const heartbeatAt = numOrNull(raw.heartbeatAt);
  if (Number.isNaN(beganAt) || Number.isNaN(heartbeatAt)) return { ok: false, error: "state stamps are numbers or null" };
  if (raw.intention !== null && typeof raw.intention !== "string") return { ok: false, error: "state.intention is a string or null" };
  if (!isNum(raw.latestSeq) || !isNum(raw.inboxCount) || !isNum(raw.queueLength) || !isNum(raw.enactedThrough)) {
    return { ok: false, error: "state counters are numbers" };
  }
  if (!Array.isArray(raw.frames)) return { ok: false, error: "state.frames is a list" };
  const frames: VisitFrameMeta[] = [];
  for (const f of raw.frames) {
    const meta = readFrameMeta(f);
    if (!meta) return { ok: false, error: "a frame entry is metadata" };
    frames.push(meta);
  }
  return {
    ok: true,
    state: {
      active: raw.active,
      beganAt,
      heartbeatAt,
      intention: raw.intention === null ? null : String(raw.intention).slice(0, 200),
      composing: raw.composing === true,
      telemetry: readTelemetry(raw.telemetry),
      events: readEvents(raw.events),
      inboxCount: raw.inboxCount,
      latestSeq: raw.latestSeq,
      frames,
      queueLength: raw.queueLength,
      enactedThrough: raw.enactedThrough,
    },
  };
}

function readMail(raw: unknown): VisitMail[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const out: VisitMail[] = [];
  for (const m of raw) {
    if (!isRecord(m) || !isNum(m.seq) || typeof m.text !== "string" || !isNum(m.at)) return null;
    out.push({ seq: m.seq, text: m.text, at: m.at });
  }
  return out;
}

const closedView = (): VisitStateView => ({
  active: false,
  beganAt: null,
  heartbeatAt: null,
  intention: null,
  composing: false,
  telemetry: null,
  events: [],
  inboxCount: 0,
  latestSeq: 0,
  frames: [],
  queueLength: 0,
  enactedThrough: 0,
});

export function createSlateFace(opts: SlateFaceOptions = {}): SlateFace {
  const now = opts.now ?? (() => Date.now());
  const lapseMs = opts.lapseMs ?? BRIDGE_SNAPSHOT_LAPSE_MS;
  let held: ReturnType<SlateFace["held"]> = null;
  let queue: QueuedDirection[] = [];
  let nextDirectionId = 1;
  let composing = false;
  let directorSeenAt: number | null = null;

  const forget = () => {
    held = null;
    queue = [];
    composing = false;
  };
  const lapsed = (t: number): boolean => held !== null && t - held.receivedAt > lapseMs;
  /** The lapse, settled lazily on every touch: once no snapshot has
   *  arrived inside the window the whole slate dies here, directions
   *  queued for the gone client included. The next touch reads it as
   *  closed and stale; the one after that, as simply closed. */
  let staleOnce = false;
  const settle = (t: number): void => {
    if (!lapsed(t)) return;
    forget();
    staleOnce = true;
  };
  const open = (t: number): boolean => held !== null && held.state.active && !lapsed(t);

  const intake = (raw: unknown): IntakeResult => {
    if (!isRecord(raw)) return { ok: false, error: "a snapshot is an object" };
    const state = readStateView(raw.state);
    if (!state.ok) return state;
    const t = now();
    settle(t);
    staleOnce = false;
    if (!state.state.active) {
      // The visit is closed on the client: the slate dies here too.
      forget();
      return { ok: true, latestSeq: 0, frameId: null };
    }
    const mail = readMail(raw.mail);
    if (!mail) return { ok: false, error: "mail is a list of { seq, text, at }" };
    // A different visit (or none held): everything of the old one dies.
    if (!held || held.state.beganAt !== state.state.beganAt) forget();
    let inbox = held?.inbox ?? [];
    const top = inbox.length > 0 ? inbox[inbox.length - 1]!.seq : 0;
    const fresh = mail.filter((m) => m.seq > top).sort((a, b) => a.seq - b.seq);
    if (fresh.length > 0) inbox = [...inbox, ...fresh].slice(-VISIT_INBOX_CAP);
    // The frame: validated at the door (a real JPEG head, the byte cap),
    // kept only while the client's own metadata still lists it.
    const kept = new Map((held?.frames ?? []).map((f) => [f.id, f] as const));
    if (raw.frame !== null && raw.frame !== undefined) {
      const meta = readFrameMeta(raw.frame);
      const dataUrl = isRecord(raw.frame) ? raw.frame.dataUrl : undefined;
      const check = validateFrameDataUrl(dataUrl);
      if (meta && check.ok) kept.set(meta.id, { ...meta, bytes: check.bytes, dataUrl: dataUrl as string });
    }
    const liveIds = new Set(state.state.frames.map((m) => m.id));
    const frames = [...kept.values()].filter((f) => liveIds.has(f.id)).sort((a, b) => a.id - b.id).slice(-VISIT_FRAME_KEEP);
    held = { state: state.state, inbox, frames, receivedAt: t };
    return { ok: true, latestSeq: inbox.length > 0 ? inbox[inbox.length - 1]!.seq : 0, frameId: frames.length > 0 ? frames[frames.length - 1]!.id : null };
  };

  const pull = (since: number): BridgePullResponse => {
    settle(now());
    const cursor = Number.isFinite(since) ? since : 0;
    queue = queue.filter((q) => q.id > cursor);
    return { directions: queue, composing, directorSeenAt };
  };

  const channel: DirectorChannel = {
    async readState(): Promise<ChannelState> {
      const t = now();
      directorSeenAt = t;
      settle(t);
      if (!held || !held.state.active) {
        const stale = staleOnce;
        staleOnce = false;
        return { ...closedView(), stale };
      }
      return { ...held.state, composing, queueLength: queue.length, stale: false };
    },
    async readInbox(since: number): Promise<VisitMail[]> {
      const t = now();
      directorSeenAt = t;
      settle(t);
      return open(t) ? held!.inbox.filter((m) => m.seq > since) : [];
    },
    async readFrame(id?: number): Promise<VisitFrame | null> {
      const t = now();
      directorSeenAt = t;
      settle(t);
      if (!open(t)) return null;
      const frames = held!.frames;
      return id === undefined ? (frames[frames.length - 1] ?? null) : (frames.find((f) => f.id === id) ?? null);
    },
    async direct(direction: VisitDirection): Promise<DirectResult> {
      const t = now();
      directorSeenAt = t;
      settle(t);
      const check = validateDirection(direction);
      if (!check.ok) return { ok: false, error: check.error };
      if (!open(t)) return { ok: false, error: "no visit is open" };
      const id = nextDirectionId++;
      queue = [...queue, { id, at: t, direction: check.direction }];
      return { ok: true, id };
    },
    async setComposing(on: boolean): Promise<void> {
      directorSeenAt = now();
      composing = on;
    },
    async readPack(): Promise<DirectorPack | null> {
      // The pack lives beside the bridge (pack.ts), not on the town.
      return null;
    },
  };

  return { channel, intake, pull, held: () => held };
}
