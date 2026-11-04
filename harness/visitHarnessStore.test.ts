import { expect, test } from "bun:test";
import {
  CLIENT_STALE_MS,
  clientSync,
  directorBegin,
  directorComposing,
  directorEnd,
  directorEnqueue,
  directorFrame,
  directorInbox,
  directorState,
  emptyStore,
  putPack,
} from "./visitHarnessStore";
import { beginVisit, captureMail, acceptFrame, emptySlate, stateView, unsentFrames, endVisit } from "../client/src/visitSlate";
import type { ClientSyncRequest } from "../shared/visitProtocol";

// The director seam's store: what a client beat carries in, what a
// director may read (never bytes), what it may enqueue, and when the
// slate forgets.

const T0 = 2_000_000;
const frame = (n: number) => ({ dataUrl: `data:image/jpeg;base64,/9j/${n}`, width: 720, height: 405, bytes: 20_000 + n });
const beatOf = (slate: ReturnType<typeof emptySlate>): ClientSyncRequest => ({
  state: stateView(slate),
  inbox: slate.inbox,
  newFrames: unsentFrames(slate),
  enactedThrough: slate.enactedThrough,
});

test("a director reads state and inbox, one frame at a time, and never bytes through state", () => {
  let slate = beginVisit(emptySlate(), T0);
  slate = captureMail(slate, "are you there", T0 + 1).slate;
  slate = acceptFrame(slate, frame(1), T0 + 2);
  slate = acceptFrame(slate, frame(2), T0 + 3);
  const synced = clientSync(emptyStore(), beatOf(slate), T0 + 4);
  const stateRead = directorState(synced.store, T0 + 5);
  expect(stateRead.view.active).toBe(true);
  expect(stateRead.view.inboxCount).toBe(1);
  expect(stateRead.view.frames.map((f) => f.id)).toEqual([1, 2]);
  expect(JSON.stringify(stateRead.view)).not.toContain("/9j/");
  expect(stateRead.view.stale).toBe(false);
  expect(stateRead.store.directorSeenAt).toBe(T0 + 5);
  const inbox = directorInbox(stateRead.store, 0, T0 + 6);
  expect(inbox.mail).toEqual([{ seq: 1, text: "are you there", at: T0 + 1 }]);
  expect(directorInbox(stateRead.store, 1, T0 + 6).mail).toEqual([]);
  expect(directorFrame(stateRead.store, null, T0 + 7).frame?.id).toBe(2);
  expect(directorFrame(stateRead.store, 1, T0 + 7).frame?.dataUrl).toBe(frame(1).dataUrl);
  expect(directorFrame(stateRead.store, 9, T0 + 7).frame).toBeNull();
});

test("directions are validated and numbered, carried on the next beat, and dropped once enacted", () => {
  const slate = beginVisit(emptySlate(), T0);
  let store = clientSync(emptyStore(), beatOf(slate), T0 + 1).store;
  const bad = directorEnqueue(store, { kind: "goto", anchor: "moon" }, T0 + 2);
  expect(bad.result).toEqual({ ok: false, error: "unknown anchor: moon" });
  expect(bad.id).toBeNull();
  const one = directorEnqueue(bad.store, { kind: "speak", text: "There you are." }, T0 + 3);
  const two = directorEnqueue(one.store, { kind: "goto", anchor: "gaius" }, T0 + 4);
  expect([one.id, two.id]).toEqual([1, 2]);
  store = directorComposing(two.store, true, T0 + 5);
  const beat = clientSync(store, beatOf(slate), T0 + 6);
  expect(beat.response.directions.map((d) => d.id)).toEqual([1, 2]);
  expect(beat.response.composing).toBe(true);
  expect(beat.response.directorSeenAt).toBe(T0 + 5);
  // The client reports enactment through 1: only 2 remains.
  const next = clientSync(beat.store, { ...beatOf(slate), enactedThrough: 1 }, T0 + 7);
  expect(next.response.directions.map((d) => d.id)).toEqual([2]);
  expect(directorState(next.store, T0 + 8).view.queueLength).toBe(1);
});

test("no visit, no directions: a closed or stale client refuses enqueues and reads as closed", () => {
  const closed = directorEnqueue(emptyStore(), { kind: "look" }, T0);
  expect(closed.result).toEqual({ ok: false, error: "no visit is open" });
  const slate = beginVisit(emptySlate(), T0);
  const store = clientSync(emptyStore(), beatOf(slate), T0 + 1).store;
  const stale = directorState(store, T0 + 1 + CLIENT_STALE_MS + 1);
  expect(stale.view.active).toBe(false);
  expect(stale.view.stale).toBe(true);
  expect(directorEnqueue(store, { kind: "look" }, T0 + 1 + CLIENT_STALE_MS + 1).result).toEqual({ ok: false, error: "no visit is open" });
});

test("the slate dies at visit end; the pack and a begin request survive it", () => {
  let slate = beginVisit(emptySlate(), T0);
  slate = captureMail(slate, "hello", T0 + 1).slate;
  slate = acceptFrame(slate, frame(1), T0 + 2);
  let store = clientSync(emptyStore(), beatOf(slate), T0 + 3).store;
  store = directorEnqueue(store, { kind: "look" }, T0 + 4).store;
  store = putPack(store, "# Aelia\n\nvoice rules", T0 + 5);
  const ended = clientSync(store, beatOf(endVisit(slate)), T0 + 6);
  expect(ended.response.directions).toEqual([]);
  expect(ended.store.inbox).toEqual([]);
  expect(ended.store.frames).toEqual([]);
  expect(ended.store.queue).toEqual([]);
  expect(ended.store.composing).toBe(false);
  expect(ended.store.pack).toEqual({ text: "# Aelia\n\nvoice rules", updatedAt: T0 + 5 });
  expect(directorState(ended.store, T0 + 7).view.active).toBe(false);
  // A director asks for a visit: the idle client hears it once.
  const asked = directorBegin(ended.store, T0 + 8);
  const idle = clientSync(asked, beatOf(emptySlate()), T0 + 9);
  expect(idle.response.begin).toBe(true);
  const opened = clientSync(idle.store, beatOf(beginVisit(emptySlate(), T0 + 10)), T0 + 11);
  expect(opened.response.begin).toBe(false);
  expect(opened.store.beginRequested).toBe(false);
  // And asks it to end: carried once, then cleared.
  const ending = directorEnd(opened.store, T0 + 12);
  const told = clientSync(ending, beatOf(beginVisit(emptySlate(), T0 + 10)), T0 + 13);
  expect(told.response.end).toBe(true);
  expect(told.store.endRequested).toBe(false);
});
