import { expect, test } from "bun:test";
import {
  absorbDirections,
  acceptFrame,
  beginVisit,
  captureMail,
  emptySlate,
  endVisit,
  enqueueDirection,
  heartbeat,
  markFramesSent,
  nextDirection,
  recordEvent,
  requestLook,
  setComposing,
  setIntention,
  stateView,
  telemetryEvents,
  threadWithSpeak,
  unsentFrames,
  visitLapsed,
} from "./visitSlate";
import { VISIT_EVENT_CAP, VISIT_FRAME_KEEP, VISIT_INBOX_CAP, VISIT_LAPSE_MS, type VisitTelemetry } from "../../shared/visitProtocol";

// Muse Visits (Task 4): the slate's lifecycle, the listening half's
// inbox cap and its death at visit end, frame retention and the
// metadata-only view, the direction queue, and the event ring.

const T0 = 1_000_000;
const frame = (n: number) => ({ dataUrl: `data:image/jpeg;base64,/9j/${n}`, width: 720, height: 405, bytes: 20_000 + n });

test("a visit begins, keeps a heartbeat, and lapses after a generous stretch", () => {
  const s = beginVisit(emptySlate(), T0);
  expect(s.active).toBe(true);
  expect(s.beganAt).toBe(T0);
  expect(s.events.map((e) => e.text)).toEqual(["visit began"]);
  expect(visitLapsed(s, T0 + VISIT_LAPSE_MS - 1)).toBe(false);
  expect(visitLapsed(s, T0 + VISIT_LAPSE_MS + 1)).toBe(true);
  const beat = heartbeat(s, T0 + VISIT_LAPSE_MS);
  expect(visitLapsed(beat, T0 + VISIT_LAPSE_MS + 1)).toBe(false);
  // Beginning an open visit only refreshes the heartbeat; nothing resets.
  const again = beginVisit(captureMail(s, "hello", T0 + 5).slate, T0 + 10);
  expect(again.inbox.length).toBe(1);
  expect(again.heartbeatAt).toBe(T0 + 10);
  // A closed slate never lapses and never beats.
  expect(visitLapsed(emptySlate(), T0 + VISIT_LAPSE_MS * 2)).toBe(false);
  expect(heartbeat(emptySlate(), T0)).toEqual(emptySlate());
});

test("visit mail is sequence-numbered, capped at the recent twenty, and counts as a heartbeat", () => {
  let s = beginVisit(emptySlate(), T0);
  for (let i = 1; i <= VISIT_INBOX_CAP + 5; i++) s = captureMail(s, `letter ${i}`, T0 + i).slate;
  expect(s.inbox.length).toBe(VISIT_INBOX_CAP);
  expect(s.inbox[0]!.seq).toBe(6);
  expect(s.inbox[s.inbox.length - 1]).toEqual({ seq: VISIT_INBOX_CAP + 5, text: `letter ${VISIT_INBOX_CAP + 5}`, at: T0 + VISIT_INBOX_CAP + 5 });
  expect(s.heartbeatAt).toBe(T0 + VISIT_INBOX_CAP + 5);
  expect(stateView(s).inboxCount).toBe(VISIT_INBOX_CAP);
  expect(stateView(s).latestSeq).toBe(VISIT_INBOX_CAP + 5);
});

test("ending or lapsing clears the slate whole: inbox, frames, intention, queue, events", () => {
  let s = beginVisit(emptySlate(), T0);
  s = captureMail(s, "are you there", T0 + 1).slate;
  s = acceptFrame(s, frame(1), T0 + 2);
  s = setIntention(s, "She means to sit by the lake a while.");
  s = setComposing(s, true);
  s = enqueueDirection(s, { kind: "goto", anchor: "lakeshore" }, T0 + 3).slate;
  s = recordEvent(s, T0 + 4, "Gaius sat");
  expect(s.inbox.length).toBe(1);
  expect(s.frames.length).toBe(1);
  expect(s.queue.length).toBe(1);
  const ended = endVisit(s);
  expect(ended).toEqual(emptySlate());
  expect(stateView(ended)).toEqual({
    active: false, beganAt: null, heartbeatAt: null, intention: null, composing: false, telemetry: null,
    events: [], inboxCount: 0, latestSeq: 0, frames: [], queueLength: 0, enactedThrough: 0,
  });
  // Nothing lands on a closed slate.
  expect(acceptFrame(ended, frame(2), T0 + 9).frames.length).toBe(0);
  expect(setIntention(ended, "x").intention).toBeNull();
  expect(enqueueDirection(ended, { kind: "look" }, T0 + 9).result).toEqual({ ok: false, error: "no visit is open" });
  expect(recordEvent(ended, T0 + 9, "x").events.length).toBe(0);
});

test("frames: the latest two are kept, the view carries metadata only, and unsent bookkeeping follows retention", () => {
  let s = beginVisit(emptySlate(), T0);
  s = acceptFrame(s, frame(1), T0 + 1);
  s = acceptFrame(s, frame(2), T0 + 2);
  s = acceptFrame(s, frame(3), T0 + 3);
  expect(s.frames.map((f) => f.id)).toEqual([2, 3]);
  expect(s.frames.length).toBe(VISIT_FRAME_KEEP);
  const view = stateView(s);
  expect(view.frames).toEqual([
    { id: 2, at: T0 + 2, width: 720, height: 405, bytes: 20_002 },
    { id: 3, at: T0 + 3, width: 720, height: 405, bytes: 20_003 },
  ]);
  expect(JSON.stringify(view)).not.toContain("dataUrl");
  expect(JSON.stringify(view)).not.toContain("/9j/");
  // Unsent follows retention: frame 1 fell off before it was carried.
  expect(unsentFrames(s).map((f) => f.id)).toEqual([2, 3]);
  s = markFramesSent(s, [2]);
  expect(unsentFrames(s).map((f) => f.id)).toEqual([3]);
  // A look request is answered by the next accepted frame.
  s = requestLook(s);
  expect(s.lookRequested).toBe(true);
  s = acceptFrame(s, frame(4), T0 + 4);
  expect(s.lookRequested).toBe(false);
});

test("directions are validated on the way in, numbered, taken in order, and absorbed from the harness without duplicates", () => {
  let s = beginVisit(emptySlate(), T0);
  expect(enqueueDirection(s, { kind: "fly" }, T0).result).toEqual({ ok: false, error: "unknown direction kind: fly" });
  s = enqueueDirection(s, { kind: "speak", text: "There you are." }, T0 + 1).slate;
  s = enqueueDirection(s, { kind: "goto", anchor: "gaius" }, T0 + 2).slate;
  expect(s.queue.map((q) => q.id)).toEqual([1, 2]);
  expect(s.heartbeatAt).toBe(T0 + 2);
  const first = nextDirection(s);
  expect(first.next?.direction).toEqual({ kind: "speak", text: "There you are." });
  expect(first.slate.enactedThrough).toBe(1);
  // From the harness: ids below enactedThrough or already queued are dropped, bad shapes too.
  const absorbed = absorbDirections(first.slate, [
    { id: 1, at: T0, direction: { kind: "look" } },
    { id: 2, at: T0, direction: { kind: "goto", anchor: "gaius" } },
    { id: 7, at: T0, direction: { kind: "emote", emote: "wave" } },
    { id: 8, at: T0, direction: { kind: "emote", emote: "cartwheel" } as never },
  ], T0 + 5);
  expect(absorbed.queue.map((q) => q.id)).toEqual([2, 7]);
  expect(absorbed.nextDirectionId).toBe(8);
  const drained = nextDirection(nextDirection(absorbed).slate);
  expect(drained.next?.id).toBe(7);
  expect(nextDirection(drained.slate).next).toBeNull();
});

test("the event ring is capped and derived from telemetry turning over", () => {
  let s = beginVisit(emptySlate(), T0);
  for (let i = 0; i < VISIT_EVENT_CAP + 10; i++) s = recordEvent(s, T0 + i, `event ${i}`);
  expect(s.events.length).toBe(VISIT_EVENT_CAP);
  expect(s.events[0]!.text).toBe(`event ${10}`);
  const base: VisitTelemetry = {
    museZone: "forum", gaiusZone: "roaming", museSeated: false, gaiusSeated: false, gaiusWalking: true, dayPhase: "night",
    museX: 0, museZ: 0, gaiusX: 1, gaiusZ: 1, museHeading: 0, gaiusHeading: 0, bearingToGaius: 0, distanceToGaius: 1.4, pad2Source: "none",
  };
  expect(telemetryEvents(null, base)).toEqual([]);
  expect(telemetryEvents(base, { ...base, gaiusZone: "lakeshore", gaiusSeated: true, museSeated: true, dayPhase: "dawn" })).toEqual([
    "Gaius arrived at the lakeshore", "Gaius sat", "Aelia sat", "daybreak",
  ]);
  expect(telemetryEvents({ ...base, dayPhase: "dusk", gaiusSeated: true }, { ...base, dayPhase: "night", gaiusZone: "away" })).toEqual(["Gaius stood", "nightfall"]);
});

test("the panel thread grows a partial line in place by its lineId", () => {
  let thread = threadWithSpeak([], "There", "L1", true);
  thread = threadWithSpeak(thread, "There you", "L1", true);
  thread = threadWithSpeak(thread, "There you are.", "L1", false);
  expect(thread).toEqual([{ who: "her", text: "There you are.", lineId: "L1", partial: false }]);
  thread = threadWithSpeak(thread, "A second line.", undefined, false);
  expect(thread.length).toBe(2);
});
