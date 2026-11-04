/**
 * The director seam's store (Task 4, Nov 2026): the local dev harness
 * that stands in, on this line, for the private town's slate. One
 * in-memory slate, two faces:
 *
 *  - the CLIENT face: the town pushes its slate view, inbox and any new
 *    frames each beat (clientSync) and pulls the directions a director
 *    left, plus the composing flag and begin/end requests;
 *  - the DIRECTOR face: a director (the Live Bridge, or curl) reads
 *    state (frame metadata only), the inbox, one frame at a time, and
 *    enqueues directions; it may set composing, ask the client to begin
 *    or end a visit, and keep its context pack here for the town to
 *    read through the seam.
 *
 * The store never sees the save, never writes anywhere, and forgets a
 * visit the moment the client reports it closed (or stops reporting
 * for a stretch). Pure over its own object, pinned by tests; the HTTP
 * carrier lives in visitHarness.ts.
 */
import {
  validateDirection,
  type ClientSyncRequest,
  type ClientSyncResponse,
  type DirectionValidation,
  type DirectorPack,
  type QueuedDirection,
  type VisitFrame,
  type VisitMail,
  type VisitStateView,
} from "../shared/visitProtocol";

/** Without a client beat for this long, the store treats the client as gone. */
export const CLIENT_STALE_MS = 30_000;

export type HarnessStore = {
  state: VisitStateView | null;
  inbox: VisitMail[];
  frames: VisitFrame[];
  queue: QueuedDirection[];
  nextDirectionId: number;
  composing: boolean;
  beginRequested: boolean;
  endRequested: boolean;
  clientSeenAt: number | null;
  directorSeenAt: number | null;
  pack: DirectorPack;
};

export const emptyStore = (): HarnessStore => ({
  state: null,
  inbox: [],
  frames: [],
  queue: [],
  nextDirectionId: 1,
  composing: false,
  beginRequested: false,
  endRequested: false,
  clientSeenAt: null,
  directorSeenAt: null,
  pack: { text: "", updatedAt: null },
});

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

/** The client's beat. Returns the store and what the client takes home. */
export function clientSync(store: HarnessStore, req: ClientSyncRequest, now: number): { store: HarnessStore; response: ClientSyncResponse } {
  let s: HarnessStore = { ...store, clientSeenAt: now };
  if (!req.state.active) {
    // The visit is closed on the client: the slate dies here too,
    // except the pack (the director's, not the visit's) and a pending
    // begin request, which the client is answering by its next beat.
    s = { ...emptyStore(), pack: s.pack, clientSeenAt: now, directorSeenAt: s.directorSeenAt, beginRequested: s.beginRequested, state: req.state };
    return {
      store: s,
      response: { directions: [], composing: false, directorSeenAt: s.directorSeenAt, begin: s.beginRequested, end: false },
    };
  }
  // The client reached an open visit: a begin request is answered.
  const keptFrames = new Map(s.frames.map((f) => [f.id, f] as const));
  for (const f of req.newFrames) keptFrames.set(f.id, f);
  const liveIds = new Set(req.state.frames.map((m) => m.id));
  const frames = [...keptFrames.values()].filter((f) => liveIds.has(f.id)).sort((a, b) => a.id - b.id);
  const queue = s.queue.filter((q) => q.id > req.enactedThrough);
  s = {
    ...s,
    state: { ...req.state, composing: s.composing },
    inbox: req.inbox,
    frames,
    queue,
    beginRequested: false,
  };
  const response: ClientSyncResponse = {
    directions: queue,
    composing: s.composing,
    directorSeenAt: s.directorSeenAt,
    begin: false,
    end: s.endRequested,
  };
  if (s.endRequested) s = { ...s, endRequested: false };
  return { store: s, response };
}

export const clientStale = (store: HarnessStore, now: number): boolean =>
  store.clientSeenAt === null || now - store.clientSeenAt > CLIENT_STALE_MS;

/** What a director reads: never frame bytes, never anything the client
 *  did not put on the slate. A stale client reads as a closed visit. */
export function directorState(store: HarnessStore, now: number): { store: HarnessStore; view: VisitStateView & { clientSeenAt: number | null; stale: boolean } } {
  const stale = clientStale(store, now);
  const base = store.state && !stale ? store.state : closedView();
  return {
    store: { ...store, directorSeenAt: now },
    view: { ...base, composing: store.composing, queueLength: store.queue.length, clientSeenAt: store.clientSeenAt, stale },
  };
}

export function directorInbox(store: HarnessStore, since: number, now: number): { store: HarnessStore; mail: VisitMail[] } {
  return { store: { ...store, directorSeenAt: now }, mail: store.inbox.filter((m) => m.seq > since) };
}

/** One frame at a time, by id; the latest when no id is given. */
export function directorFrame(store: HarnessStore, id: number | null, now: number): { store: HarnessStore; frame: VisitFrame | null } {
  const frame = id === null ? (store.frames[store.frames.length - 1] ?? null) : (store.frames.find((f) => f.id === id) ?? null);
  return { store: { ...store, directorSeenAt: now }, frame };
}

export function directorEnqueue(store: HarnessStore, raw: unknown, now: number): { store: HarnessStore; result: DirectionValidation; id: number | null } {
  const result = validateDirection(raw);
  const touched = { ...store, directorSeenAt: now };
  if (!result.ok) return { store: touched, result, id: null };
  if (!store.state?.active || clientStale(store, now)) return { store: touched, result: { ok: false, error: "no visit is open" }, id: null };
  const id = store.nextDirectionId;
  return {
    store: { ...touched, queue: [...store.queue, { id, at: now, direction: result.direction }], nextDirectionId: id + 1 },
    result,
    id,
  };
}

export function directorComposing(store: HarnessStore, on: boolean, now: number): HarnessStore {
  return { ...store, composing: on, directorSeenAt: now };
}

export function directorBegin(store: HarnessStore, now: number): HarnessStore {
  return { ...store, beginRequested: true, directorSeenAt: now };
}

export function directorEnd(store: HarnessStore, now: number): HarnessStore {
  return { ...store, endRequested: true, directorSeenAt: now };
}

export function putPack(store: HarnessStore, text: string, now: number): HarnessStore {
  return { ...store, pack: { text, updatedAt: now }, directorSeenAt: now };
}
