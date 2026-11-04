import { expect, test } from "bun:test";
import { beginVisit, captureMail, acceptFrame, emptySlate, stateView } from "../../client/src/visitSlate";
import { createSlateFace, readStateView } from "./slateFace.js";

// Adapter B's held snapshot, pure: intake at the door, the inbox kept
// by seq, one frame validated, directions validated and pulled by
// cursor, the lapse reading as a closed visit, and no pack.

const snapshotOf = (slate: ReturnType<typeof emptySlate>, mail = slate.inbox, frame = slate.frames[slate.frames.length - 1] ?? null) => ({
  state: stateView(slate),
  mail,
  frame,
});

test("a snapshot is held, mail accumulates by seq, the frame is validated at the door, and the director reads it", async () => {
  let t = 5_000_000;
  const face = createSlateFace({ now: () => t, lapseMs: 10_000 });
  expect((await face.channel.readState()).active).toBe(false);
  expect(await face.channel.direct({ kind: "look" })).toEqual({ ok: false, error: "no visit is open" });

  let slate = beginVisit(emptySlate(), t);
  slate = captureMail(slate, "hello", t + 1).slate;
  slate = acceptFrame(slate, { dataUrl: "data:image/jpeg;base64,/9j/QUJD", width: 720, height: 405, bytes: 6 }, t + 2);
  expect(face.intake(snapshotOf(slate))).toEqual({ ok: true, latestSeq: 1, frameId: 1 });
  const state = await face.channel.readState();
  expect(state.active).toBe(true);
  expect(state.frames.map((f) => f.id)).toEqual([1]);
  expect(JSON.stringify(state)).not.toContain("/9j/");
  expect(await face.channel.readInbox(0)).toEqual([{ seq: 1, text: "hello", at: t + 1 }]);
  expect((await face.channel.readFrame())?.dataUrl).toBe("data:image/jpeg;base64,/9j/QUJD");
  expect(await face.channel.readFrame(9)).toBeNull();
  expect(await face.channel.readPack()).toBeNull();

  // A second snapshot with only the new mail (the client's cursor) and
  // no frame offered: the old mail and frame stay held.
  slate = captureMail(slate, "still there?", t + 3).slate;
  expect(face.intake(snapshotOf(slate, slate.inbox.filter((m) => m.seq > 1), null))).toEqual({ ok: true, latestSeq: 2, frameId: 1 });
  expect((await face.channel.readInbox(1)).map((m) => m.text)).toEqual(["still there?"]);
  // Mail re-sent is not held twice.
  face.intake(snapshotOf(slate, slate.inbox, null));
  expect(face.held()?.inbox.length).toBe(2);
  // A frame that is not a JPEG is refused at the door; the snapshot is still held.
  expect(face.intake(snapshotOf(slate, [], { id: 2, at: t, width: 10, height: 10, bytes: 5, dataUrl: "data:image/png;base64,iVBOR" }))).toEqual({ ok: true, latestSeq: 2, frameId: 1 });
  // A bad shape is refused plainly.
  expect(face.intake({ state: { active: "yes" } })).toEqual({ ok: false, error: "state.active is a boolean" });
  expect(face.intake(null)).toEqual({ ok: false, error: "a snapshot is an object" });
  expect(readStateView({ ...stateView(slate), frames: [{ id: "x" }] })).toEqual({ ok: false, error: "a frame entry is metadata" });
});

test("directions are validated, numbered, and pulled by cursor; composing rides the pull", async () => {
  let t = 6_000_000;
  const face = createSlateFace({ now: () => t, lapseMs: 10_000 });
  const slate = beginVisit(emptySlate(), t);
  face.intake(snapshotOf(slate));
  expect(await face.channel.direct({ kind: "speak", text: "By the lake." })).toEqual({ ok: true, id: 1 });
  expect(await face.channel.direct({ kind: "pad", dx: 9, dz: 0, buttons: [], ms: 100 })).toEqual({ ok: false, error: "pad dx and dz are -1..1" });
  await face.channel.setComposing(true);
  expect(await face.channel.direct({ kind: "look" })).toEqual({ ok: true, id: 2 });
  const first = face.pull(0);
  expect(first.directions.map((q) => q.id)).toEqual([1, 2]);
  expect(first.composing).toBe(true);
  expect(first.directorSeenAt).toBe(t);
  // The client has 1 and 2: they are forgotten; a new one is numbered on.
  t += 5;
  await face.channel.direct({ kind: "sit" });
  const next = face.pull(2);
  expect(next.directions).toEqual([{ id: 3, at: t, direction: { kind: "sit" } }]);
  expect(face.pull(3).directions).toEqual([]);
  expect((await face.channel.readState()).queueLength).toBe(0);
});

test("the lapse: snapshots stop, the slate dies, nothing is enqueued; a closed snapshot forgets the visit", async () => {
  let t = 7_000_000;
  const face = createSlateFace({ now: () => t, lapseMs: 10_000 });
  let slate = beginVisit(emptySlate(), t);
  slate = captureMail(slate, "hello", t).slate;
  face.intake(snapshotOf(slate));
  t += 10_000;
  expect((await face.channel.readState()).active).toBe(true);
  t += 1;
  const gone = await face.channel.readState();
  expect(gone.active).toBe(false);
  expect(gone.stale).toBe(true);
  expect(await face.channel.readInbox(0)).toEqual([]);
  expect(await face.channel.readFrame()).toBeNull();
  expect(await face.channel.direct({ kind: "speak", text: "Hello?" })).toEqual({ ok: false, error: "no visit is open" });
  expect(face.pull(0).directions).toEqual([]);
  expect(face.held()).toBeNull();
  expect((await face.channel.readState()).stale).toBe(false); // stale is read once
  // A snapshot arrives again: the visit is held again from what the client sends.
  face.intake(snapshotOf(slate, [], null));
  expect((await face.channel.readState()).active).toBe(true);
  expect((await face.channel.readInbox(0)).length).toBe(0);
  face.intake(snapshotOf(slate));
  expect((await face.channel.readInbox(0)).length).toBe(1);
  await face.channel.direct({ kind: "wave" as "sit" });
  await face.channel.direct({ kind: "sit" });
  await face.channel.setComposing(true);
  // The client reports the visit closed: inbox, frames, queue, composing all die.
  expect(face.intake({ state: stateView(emptySlate()), mail: [], frame: null })).toEqual({ ok: true, latestSeq: 0, frameId: null });
  expect(face.held()).toBeNull();
  expect(face.pull(0)).toEqual({ directions: [], composing: false, directorSeenAt: t });
  // A new visit (a different beganAt) starts clean.
  const fresh = beginVisit(emptySlate(), t + 50);
  face.intake(snapshotOf(fresh));
  expect(await face.channel.readInbox(0)).toEqual([]);
});
