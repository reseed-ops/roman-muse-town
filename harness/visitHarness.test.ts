import { expect, test } from "bun:test";
import { startHarness } from "./visitHarness";
import { beginVisit, captureMail, acceptFrame, emptySlate, stateView, unsentFrames } from "../client/src/visitSlate";

// The harness over HTTP: the Gate 0 walk a non-agent process takes,
// read state and enqueue one direction, and the client's beat.

test("a plain HTTP client reads the seam and enqueues a direction; frames are validated at the door", async () => {
  let t = 3_000_000;
  const h = await startHarness({ port: 0, now: () => t, log: () => {} });
  const base = `http://127.0.0.1:${h.port}`;
  try {
    const closed = await (await fetch(`${base}/visit/state`)).json();
    expect(closed.active).toBe(false);
    const refused = await fetch(`${base}/visit/direct`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "look" }) });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ ok: false, error: "no visit is open" });

    let slate = beginVisit(emptySlate(), t);
    slate = captureMail(slate, "where are you", t + 1).slate;
    slate = acceptFrame(slate, { dataUrl: "data:image/jpeg;base64,/9j/QUJD", width: 720, height: 405, bytes: 6 }, t + 2);
    slate = acceptFrame(slate, { dataUrl: "data:image/png;base64,iVBOR", width: 720, height: 405, bytes: 5 }, t + 3);
    const beat = await (await fetch(`${base}/visit/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: stateView(slate), inbox: slate.inbox, newFrames: unsentFrames(slate), enactedThrough: 0 }),
    })).json();
    expect(beat.directions).toEqual([]);
    const state = await (await fetch(`${base}/visit/state`)).json();
    expect(state.active).toBe(true);
    expect(state.inboxCount).toBe(1);
    // Only the real JPEG made it through the door.
    expect(h.store().frames.map((f) => f.id)).toEqual([1]);
    expect(JSON.stringify(state)).not.toContain("/9j/");
    const mail = await (await fetch(`${base}/visit/inbox?since=0`)).json();
    expect(mail).toEqual([{ seq: 1, text: "where are you", at: t + 1 }]);
    const frame = await (await fetch(`${base}/visit/frame`)).json();
    expect(frame.dataUrl).toBe("data:image/jpeg;base64,/9j/QUJD");
    expect((await fetch(`${base}/visit/frame?id=2`)).status).toBe(404);

    const direct = await (await fetch(`${base}/visit/direct`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "speak", text: "By the lake, love." }) })).json();
    expect(direct).toEqual({ ok: true, id: 1 });
    const bad = await fetch(`${base}/visit/direct`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "pad", dx: 9, dz: 0, ms: 100 }) });
    expect(bad.status).toBe(400);
    await fetch(`${base}/visit/composing`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ on: true }) });
    const pack = await (await fetch(`${base}/visit/pack`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "# pack" }) })).json();
    expect(pack).toEqual({ text: "# pack", updatedAt: t });
    expect(await (await fetch(`${base}/visit/pack`)).json()).toEqual(pack);

    t += 10;
    const next = await (await fetch(`${base}/visit/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: stateView(slate), inbox: slate.inbox, newFrames: [], enactedThrough: 0 }),
    })).json();
    expect(next.directions).toEqual([{ id: 1, at: t - 10, direction: { kind: "speak", text: "By the lake, love." } }]);
    expect(next.composing).toBe(true);
    expect((await fetch(`${base}/nowhere`)).status).toBe(404);
    const cors = await fetch(`${base}/visit/state`, { method: "OPTIONS" });
    expect(cors.headers.get("access-control-allow-origin")).toBe("*");
  } finally {
    await h.close();
  }
});
