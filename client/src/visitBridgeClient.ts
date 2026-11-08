/**
 * The town's bridge leg (Task 7, Nov 2026): the client's call out to
 * the Live Bridge's director face while a visit is open. Gate 0's
 * verdict stands behind this: the bridge never calls into the town;
 * the client is the courier, as it already is for the harness.
 *
 * Each beat (about every BRIDGE_BEAT_MS, and promptly when new mail or
 * a fresh frame lands) posts the slate snapshot (state, the mail not
 * yet handed over, the latest frame when it has not been carried) and
 * pulls the directions and composing state queued since the client's
 * cursor. Pulled directions go onto the slate through the same seam
 * validator harness directions pass today (enqueueDirection), so a
 * shape the seam refuses never reaches the scene.
 *
 * Off unless a bridge URL is set in the visit settings: with none, no
 * call is ever made and the client is exactly the Task 4 client. The
 * URL and token are owner-entered, held in this browser only, and
 * never written anywhere else.
 */
import { BRIDGE_BEAT_MS, type BridgePullResponse, type BridgeSnapshotRequest, type BridgeSnapshotResponse } from "../../shared/visitProtocol";
import { isHostedTown, visitorToken } from "./hosted";
import { emptySlate, enqueueDirection, setComposing, stateView, type VisitSlate } from "./visitSlate";

export const BRIDGE_URL_STORAGE_KEY = "muse-town-visit-bridge-url";
export const BRIDGE_TOKEN_STORAGE_KEY = "muse-town-visit-bridge-token";

export type BridgeSettings = { url: string; token: string };

/** The settings as stored: trimmed, the URL without a trailing slash. */
export function readBridgeSettings(read: (key: string) => string | null): BridgeSettings {
  const url = (read(BRIDGE_URL_STORAGE_KEY) ?? "").trim().replace(/\/+$/, "");
  const token = (read(BRIDGE_TOKEN_STORAGE_KEY) ?? "").trim();
  return { url, token };
}

export function storeBridgeSettings(write: (key: string, value: string | null) => void, settings: BridgeSettings): BridgeSettings {
  const next = { url: settings.url.trim().replace(/\/+$/, ""), token: settings.token.trim() };
  write(BRIDGE_URL_STORAGE_KEY, next.url || null);
  write(BRIDGE_TOKEN_STORAGE_KEY, next.token || null);
  return next;
}

/** A bridge is configured when a URL is set; the token may be missing
 *  (the bridge then refuses, and the menu says so). */
export const bridgeConfigured = (s: BridgeSettings | null | undefined): s is BridgeSettings => !!s && /^https?:\/\/\S+$/.test(s.url);

/** The hosted town's own director door as the default bridge (Task 8):
 *  this origin, the visitor's own token. Null anywhere but the web, so
 *  the artifact and the Android build keep making no call at all. */
export function hostedBridgeSettings(
  hosted: boolean = isHostedTown(),
  origin: string = typeof location === "undefined" ? "" : location.origin,
  token: () => string = visitorToken,
): BridgeSettings | null {
  if (!hosted || !/^https?:\/\/\S+$/.test(origin)) return null;
  return { url: origin.replace(/\/+$/, ""), token: token() };
}

/** The bridge the leg runs against: an owner-entered one first, else
 *  the hosted town's own door, else none. */
export function resolveBridge(entered: BridgeSettings | null | undefined, hosted: BridgeSettings | null): BridgeSettings | null {
  return bridgeConfigured(entered) ? entered : hosted;
}

/** What the client has already handed over, per visit. */
export type BridgeCursor = {
  /** Mail with seq at or below this has been held by the bridge. */
  ackedSeq: number;
  /** The latest frame id the bridge has been offered. */
  sentFrameId: number;
  /** Directions with id at or below this have been pulled. */
  pulledThrough: number;
};

export const emptyBridgeCursor = (): BridgeCursor => ({ ackedSeq: 0, sentFrameId: 0, pulledThrough: 0 });

export type BridgeLegOutcome = "ok" | "unreachable" | "refused";

export type BridgeLegResult = {
  slate: VisitSlate;
  cursor: BridgeCursor;
  outcome: BridgeLegOutcome;
  /** When the director loop last read the bridge's held snapshot. */
  directorSeenAt: number | null;
  /** Directions pulled and queued; refused ones are counted apart. */
  queued: number;
  refused: number;
  /** The director asked the town to end the visit (the hosted door). */
  ended: boolean;
};

type Call = { status: number; json: unknown } | null;

/** How long one call may take before it counts as unreachable (fix
 *  list, Nov 7, 2026). The old cap was the beat itself (1.7 s), which a
 *  phone network misses whenever a 30-second view frame (up to 400 KB)
 *  rides the snapshot: every frame beat then read as "unreachable".
 *  The beat cannot pile up behind a slow call (the caller runs one at
 *  a time), so a generous cap only delays the next beat. */
export const BRIDGE_CALL_TIMEOUT_MS = Math.max(8_000, BRIDGE_BEAT_MS * 4);
export const BRIDGE_FRAME_CALL_TIMEOUT_MS = 20_000;

async function call(url: string, token: string, init: RequestInit, fetchImpl: typeof fetch, timeoutMs = BRIDGE_CALL_TIMEOUT_MS): Promise<Call> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${token}` }, signal: controller.signal });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The snapshot this beat carries: the mail past the cursor and the
 *  latest frame when it has not been offered yet. */
export function buildSnapshot(slate: VisitSlate, cursor: BridgeCursor): BridgeSnapshotRequest {
  const latest = slate.frames[slate.frames.length - 1] ?? null;
  return {
    state: stateView(slate),
    mail: slate.inbox.filter((m) => m.seq > cursor.ackedSeq),
    frame: latest && latest.id > cursor.sentFrameId ? latest : null,
  };
}

/**
 * One beat of the leg. `read` is the live slate accessor: the network
 * waits happen before it is read, so a letter sent meanwhile is kept.
 * Returns null, having made no call, when no bridge is configured or
 * no visit is open.
 */
export async function bridgeLeg(input: {
  settings: BridgeSettings | null | undefined;
  read: () => VisitSlate;
  cursor: BridgeCursor;
  now: () => number;
  fetchImpl?: typeof fetch;
}): Promise<BridgeLegResult | null> {
  const { settings, read, now } = input;
  const fetchImpl = input.fetchImpl ?? fetch;
  if (!bridgeConfigured(settings)) return null;
  const before = read();
  if (!before.active) return null;
  const snapshot = buildSnapshot(before, input.cursor);
  const posted = await call(`${settings.url}/bridge/snapshot`, settings.token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(snapshot),
  }, fetchImpl, snapshot.frame ? BRIDGE_FRAME_CALL_TIMEOUT_MS : BRIDGE_CALL_TIMEOUT_MS);
  const fail = (outcome: BridgeLegOutcome): BridgeLegResult => ({ slate: read(), cursor: input.cursor, outcome, directorSeenAt: null, queued: 0, refused: 0, ended: false });
  if (!posted) return fail("unreachable");
  if (posted.status === 401) return fail("refused");
  const ack = posted.json as BridgeSnapshotResponse | null;
  if (posted.status !== 200 || !ack || ack.ok !== true) return fail("unreachable");
  const pulled = await call(`${settings.url}/bridge/directions?since=${encodeURIComponent(String(input.cursor.pulledThrough))}`, settings.token, { method: "GET" }, fetchImpl);
  if (!pulled) return fail("unreachable");
  if (pulled.status === 401) return fail("refused");
  const pull = pulled.json as BridgePullResponse | null;
  if (pulled.status !== 200 || !pull || !Array.isArray(pull.directions)) return fail("unreachable");
  // Past the waits: the slate now, which may have grown meanwhile.
  let slate = read();
  const cursor: BridgeCursor = {
    ackedSeq: Math.max(input.cursor.ackedSeq, ...snapshot.mail.map((m) => m.seq)),
    sentFrameId: Math.max(input.cursor.sentFrameId, snapshot.frame?.id ?? 0),
    pulledThrough: input.cursor.pulledThrough,
  };
  if (!slate.active) return { slate, cursor, outcome: "ok", directorSeenAt: pull.directorSeenAt ?? null, queued: 0, refused: 0, ended: false };
  if (pull.end === true) return { slate, cursor, outcome: "ok", directorSeenAt: typeof pull.directorSeenAt === "number" ? pull.directorSeenAt : null, queued: 0, refused: 0, ended: true };
  let queued = 0;
  let refused = 0;
  const t = now();
  const incoming = [...pull.directions].filter((q) => q && typeof q.id === "number").sort((a, b) => a.id - b.id);
  for (const q of incoming) {
    if (q.id <= cursor.pulledThrough) continue;
    cursor.pulledThrough = q.id;
    // The seam validator, exactly as harness directions pass it: a
    // refused shape is dropped here and never reaches the scene.
    const step = enqueueDirection(slate, q.direction, t);
    slate = step.slate;
    if (step.result.ok) queued += 1;
    else refused += 1;
  }
  slate = setComposing(slate, pull.composing === true);
  return { slate, cursor, outcome: "ok", directorSeenAt: typeof pull.directorSeenAt === "number" ? pull.directorSeenAt : null, queued, refused, ended: false };
}

/** The idle glance (hosted town only): with no visit open, one pull on
 *  a slow cadence to hear a director's begin request through the door.
 *  Null when nothing was heard or the door could not be reached. */
export async function bridgeGlance(settings: BridgeSettings | null | undefined, fetchImpl: typeof fetch = fetch): Promise<{ begin: boolean } | null> {
  if (!bridgeConfigured(settings)) return null;
  const pulled = await call(`${settings.url}/bridge/directions?since=0`, settings.token, { method: "GET" }, fetchImpl);
  if (!pulled || pulled.status !== 200) return null;
  const pull = pulled.json as BridgePullResponse | null;
  return pull ? { begin: pull.begin === true } : null;
}

/** The tab is closing or navigating away (Task 33): tell the bridge,
 *  which ends the visit after a short grace unless the same visit
 *  reports again (a reload). keepalive lets it outlive the page;
 *  sendBeacon cannot carry the bearer header. Best effort. */
export function bridgeLeaving(settings: BridgeSettings | null | undefined, fetchImpl: typeof fetch = fetch): void {
  if (!bridgeConfigured(settings)) return;
  try {
    void fetchImpl(`${settings.url}/bridge/leaving`, { method: "POST", keepalive: true, headers: { authorization: `Bearer ${settings.token}` } }).catch(() => {});
  } catch {
    /* the page is going; nothing to do */
  }
}

/** The visit ended on the town: one closed snapshot so the bridge
 *  forgets it now rather than at the lapse. Best effort, no result. */
export async function bridgeClose(settings: BridgeSettings | null | undefined, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!bridgeConfigured(settings)) return;
  const closed: BridgeSnapshotRequest = { state: stateView(emptySlate()), mail: [], frame: null };
  await call(`${settings.url}/bridge/snapshot`, settings.token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(closed) }, fetchImpl);
}
