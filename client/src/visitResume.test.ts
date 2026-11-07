import { expect, test } from "bun:test";
import { VISIT_LAPSE_MS } from "../../shared/visitProtocol";
import { emptyBridgeCursor } from "./visitBridgeClient";
import { acceptFrame, beginVisit, captureMail, emptySlate } from "./visitSlate";
import { VISIT_RESUME_KEY, loadVisitResume, saveVisitResume } from "./visitResume";
import { composingVisible, COMPOSING_SETTLE_MS, COMPOSING_STALE_MS, visitStatusLine, visitClosedLine } from "./visitStatus";
import { createSlateFace } from "../../shared/slateFace";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

test("an open visit survives a reload: counters, cursor and transcript come back, frames do not", () => {
  const store = memory();
  let s = beginVisit(emptySlate(), 1000);
  s = captureMail(s, "hello", 2000).slate;
  s = captureMail(s, "still here", 3000).slate;
  s = acceptFrame(s, { dataUrl: "data:image/jpeg;base64,AAAA", width: 4, height: 4, bytes: 3 }, 3500);
  const cursor = { ...emptyBridgeCursor(), ackedSeq: 2, pulledThrough: 7, sentFrameId: 1 };
  saveVisitResume(store, s, [{ who: "him", text: "hello", seq: 1 }, { who: "her", text: "There you are." }], cursor, 4000);
  const back = loadVisitResume(store, 60_000)!;
  expect(back.slate.active).toBe(true);
  expect(back.slate.beganAt).toBe(1000);
  expect(back.slate.nextSeq).toBe(3);
  expect(back.slate.frames).toEqual([]);
  expect(back.slate.heartbeatAt).toBe(60_000);
  expect(back.cursor.pulledThrough).toBe(7);
  expect(back.thread.map((e) => e.text)).toEqual(["hello", "There you are."]);
});

test("a stale record is dropped, and an ended visit clears it", () => {
  const store = memory();
  const s = beginVisit(emptySlate(), 0);
  saveVisitResume(store, s, [], emptyBridgeCursor(), 0);
  expect(loadVisitResume(store, VISIT_LAPSE_MS + 1)).toBeNull();
  expect(store.m.has(VISIT_RESUME_KEY)).toBe(false);
  saveVisitResume(store, s, [], emptyBridgeCursor(), 0);
  saveVisitResume(store, emptySlate(), [], emptyBridgeCursor(), 10);
  expect(store.m.has(VISIT_RESUME_KEY)).toBe(false);
  store.setItem(VISIT_RESUME_KEY, "{not json");
  expect(loadVisitResume(store, 0)).toBeNull();
});

test("the writing line clears after her final line and cannot stick", () => {
  expect(composingVisible(true, 0, null, 1000)).toBe(true);
  expect(composingVisible(true, 0, 1000, 1000 + COMPOSING_SETTLE_MS - 1)).toBe(false);
  expect(composingVisible(true, 0, null, COMPOSING_STALE_MS + 1)).toBe(false);
  expect(composingVisible(false, 0, null, 10)).toBe(false);
});

test("status lines name what is unreachable, and a close says why", () => {
  expect(visitStatusLine("unreachable", { kind: "door", host: "town.reseed.net" })).toContain("the town's own director door (town.reseed.net)");
  expect(visitStatusLine("unreachable", { kind: "bridge", host: "b.example" })).toContain("the Live Bridge (b.example)");
  expect(visitStatusLine("live", { kind: "door", host: "t" })).toContain("Muse is directing");
  expect(visitClosedLine("lapse", VISIT_LAPSE_MS)).toContain("20 minutes");
  expect(visitClosedLine("director", VISIT_LAPSE_MS)).toContain("Muse ended");
});

test("a face carries its numbering above a resumed client's cursor", async () => {
  let t = 1000;
  const face = createSlateFace({ now: () => t });
  const state = { active: true, beganAt: 5, heartbeatAt: 5, intention: null, composing: false, telemetry: null, events: [], inboxCount: 0, latestSeq: 0, frames: [], queueLength: 0, enactedThrough: 0 };
  expect(face.intake({ state, mail: [], frame: null }).ok).toBe(true);
  // The resumed client pulls with a cursor past the face's numbering.
  expect(face.pull(9).directions).toEqual([]);
  t += 100;
  expect(await face.channel.direct({ kind: "stand" })).toEqual({ ok: true, id: 10 });
  expect(face.pull(9).directions.map((q) => q.id)).toEqual([10]);
});
