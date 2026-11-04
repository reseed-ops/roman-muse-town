import { expect, test } from "bun:test";
import { startHarness } from "../../harness/visitHarness";
import { beginVisit, captureMail, acceptFrame, emptySlate, stateView, unsentFrames } from "../../client/src/visitSlate";
import { createSeamAdapter } from "./seamAdapter.js";

// Adapter A against Task 4's harness over real HTTP. Adapter B, the
// serving face, is pinned in slateFace.test.ts and bridgeServer.test.ts.

test("the seam adapter reads state, inbox and one frame, directs, composes and reads the pack", async () => {
  let t = 4_000_000;
  const h = await startHarness({ port: 0, now: () => t, log: () => {} });
  const channel = createSeamAdapter({ baseUrl: `http://127.0.0.1:${h.port}` });
  try {
    expect((await channel.readState()).active).toBe(false);
    expect(await channel.direct({ kind: "look" })).toEqual({ ok: false, error: "no visit is open" });
    let slate = beginVisit(emptySlate(), t);
    slate = captureMail(slate, "hello", t + 1).slate;
    slate = acceptFrame(slate, { dataUrl: "data:image/jpeg;base64,/9j/QUJD", width: 720, height: 405, bytes: 6 }, t + 2);
    await fetch(`http://127.0.0.1:${h.port}/visit/sync`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: stateView(slate), inbox: slate.inbox, newFrames: unsentFrames(slate), enactedThrough: 0 }),
    });
    const state = await channel.readState();
    expect(state.active).toBe(true);
    expect(state.frames.map((f) => f.id)).toEqual([1]);
    expect(await channel.readInbox(0)).toEqual([{ seq: 1, text: "hello", at: t + 1 }]);
    expect((await channel.readFrame())?.dataUrl).toBe("data:image/jpeg;base64,/9j/QUJD");
    expect(await channel.readFrame(5)).toBeNull();
    expect(await channel.direct({ kind: "speak", text: "By the lake." })).toEqual({ ok: true, id: 1 });
    await channel.setComposing(true);
    expect((await channel.readState()).composing).toBe(true);
    expect(await channel.readPack()).toEqual({ text: "", updatedAt: null });
    expect(h.store().queue.map((q) => q.direction)).toEqual([{ kind: "speak", text: "By the lake." }]);
  } finally {
    await h.close();
  }
  // Dead: a closed harness throws, which the director folds.
  await expect(channel.readState()).rejects.toThrow();
});
