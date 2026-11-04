import { expect, test } from "bun:test";
import { startBridgeServer } from "../../bridge/src/bridgeServer";
import { createSlateFace } from "../../bridge/src/slateFace";
import { beginVisit, captureMail, acceptFrame, emptySlate, nextDirection, type VisitSlate } from "./visitSlate";
import { BRIDGE_TOKEN_STORAGE_KEY, BRIDGE_URL_STORAGE_KEY, bridgeClose, bridgeConfigured, bridgeLeg, buildSnapshot, emptyBridgeCursor, readBridgeSettings, storeBridgeSettings } from "./visitBridgeClient";

// The town's bridge leg: no bridge configured means no call, ever; a
// configured leg posts the snapshot and pulls directions through the
// seam validator (a refused shape never reaches the queue); the token
// is held in this browser only; a refused token reads as refused.

const countingFetch = () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
};

test("with no bridge URL configured the client makes no bridge call at all", async () => {
  const { calls, fetchImpl } = countingFetch();
  let slate = beginVisit(emptySlate(), 1);
  slate = captureMail(slate, "hello", 2).slate;
  const read = () => slate;
  const cursor = emptyBridgeCursor();
  expect(await bridgeLeg({ settings: null, read, cursor, now: () => 3, fetchImpl })).toBeNull();
  expect(await bridgeLeg({ settings: { url: "", token: "t" }, read, cursor, now: () => 3, fetchImpl })).toBeNull();
  expect(await bridgeLeg({ settings: { url: "not a url", token: "t" }, read, cursor, now: () => 3, fetchImpl })).toBeNull();
  expect(bridgeConfigured(readBridgeSettings(() => null))).toBe(false);
  // Configured, but no visit open: still no call.
  expect(await bridgeLeg({ settings: { url: "https://bridge.example", token: "t" }, read: () => emptySlate(), cursor, now: () => 3, fetchImpl })).toBeNull();
  await bridgeClose(null, fetchImpl);
  await bridgeClose({ url: "", token: "t" }, fetchImpl);
  expect(calls).toEqual([]);
});

test("the settings live in this browser only, trimmed, and the token never rides anywhere but the header", () => {
  const store = new Map<string, string>();
  const write = (k: string, v: string | null) => (v === null ? store.delete(k) : store.set(k, v));
  const saved = storeBridgeSettings(write, { url: " https://bridge.example/ ", token: " secret-value " });
  expect(saved).toEqual({ url: "https://bridge.example", token: "secret-value" });
  expect(store.get(BRIDGE_URL_STORAGE_KEY)).toBe("https://bridge.example");
  expect(store.get(BRIDGE_TOKEN_STORAGE_KEY)).toBe("secret-value");
  expect(readBridgeSettings((k) => store.get(k) ?? null)).toEqual(saved);
  storeBridgeSettings(write, { url: "", token: "" });
  expect(store.size).toBe(0);
  const slate = beginVisit(emptySlate(), 1);
  expect(JSON.stringify(buildSnapshot(slate, emptyBridgeCursor()))).not.toContain("secret");
});

test("a configured leg posts the snapshot, pulls directions through the seam validator, and carries composing", async () => {
  let t = 9_000_000;
  const face = createSlateFace({ now: () => t, lapseMs: 10_000 });
  const server = await startBridgeServer({ face, token: "the-token", port: 0, host: "127.0.0.1", log: () => {} });
  const settings = { url: `http://127.0.0.1:${server.port}`, token: "the-token" };
  try {
    let slate: VisitSlate = beginVisit(emptySlate(), t);
    slate = captureMail(slate, "where are you", t + 1).slate;
    slate = acceptFrame(slate, { dataUrl: "data:image/jpeg;base64,/9j/QUJD", width: 720, height: 405, bytes: 6 }, t + 2);
    const read = () => slate;
    let cursor = emptyBridgeCursor();
    const first = await bridgeLeg({ settings, read, cursor, now: () => t, fetchImpl: fetch });
    expect(first?.outcome).toBe("ok");
    expect(first?.cursor).toEqual({ ackedSeq: 1, sentFrameId: 1, pulledThrough: 0 });
    expect(first?.queued).toBe(0);
    cursor = first!.cursor;
    slate = first!.slate;
    expect(face.held()?.inbox.map((m) => m.text)).toEqual(["where are you"]);
    expect(face.held()?.frames.map((f) => f.id)).toEqual([1]);
    // The next beat carries nothing twice: no mail past the cursor, no frame.
    expect(buildSnapshot(slate, cursor)).toMatchObject({ mail: [], frame: null });

    // The director leaves a speak, a look, composing on, and (through a
    // raw pull body) a shape the seam refuses.
    await face.channel.direct({ kind: "speak", text: "By the lake, love.", lineId: "L1", partial: true });
    await face.channel.direct({ kind: "look" });
    await face.channel.setComposing(true);
    const tampered = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await fetch(input, init);
      if (!String(input).includes("/bridge/directions")) return res;
      const body = (await res.json()) as { directions: unknown[] };
      body.directions.push({ id: 99, at: t, direction: { kind: "pad", dx: 9, dz: 0, buttons: [], ms: 100 } });
      body.directions.push({ id: 100, at: t, direction: { kind: "write_fact", text: "never" } });
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const second = await bridgeLeg({ settings, read, cursor, now: () => t, fetchImpl: tampered });
    expect(second?.outcome).toBe("ok");
    expect(second?.queued).toBe(2);
    expect(second?.refused).toBe(2);
    expect(second?.cursor.pulledThrough).toBe(100);
    slate = second!.slate;
    expect(slate.composing).toBe(true);
    expect(slate.queue.map((q) => q.direction)).toEqual([
      { kind: "speak", text: "By the lake, love.", lineId: "L1", partial: true },
      { kind: "look" },
    ]);
    // Enacting drains the queue in order; the bridge forgets what was pulled.
    const step = nextDirection(slate);
    expect(step.next?.direction.kind).toBe("speak");
    expect(face.pull(second!.cursor.pulledThrough).directions).toEqual([]);

    // A letter sent while the leg was in flight is kept: the slate read
    // after the waits is the one the directions land on.
    let live = slate;
    const reading = () => live;
    const slowFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await fetch(input, init);
      live = captureMail(live, "sent meanwhile", t + 5).slate;
      return res;
    }) as unknown as typeof fetch;
    const third = await bridgeLeg({ settings, read: reading, cursor: second!.cursor, now: () => t, fetchImpl: slowFetch });
    expect(third?.slate.inbox.map((m) => m.text)).toContain("sent meanwhile");
    expect(third?.cursor.ackedSeq).toBe(1); // not yet carried; the next beat carries it
    expect(buildSnapshot(third!.slate, third!.cursor).mail.map((m) => m.text)).toEqual(["sent meanwhile", "sent meanwhile"]);
    // The visit ends on the town: one closed snapshot, and the bridge forgets it now.
    await bridgeClose(settings);
    expect(face.held()).toBeNull();
  } finally {
    await server.close();
  }
});

test("a wrong token reads as refused and an unreachable bridge as unreachable; nothing is acknowledged either way", async () => {
  let t = 9_500_000;
  const face = createSlateFace({ now: () => t, lapseMs: 10_000 });
  const server = await startBridgeServer({ face, token: "right", port: 0, host: "127.0.0.1", log: () => {} });
  try {
    let slate = beginVisit(emptySlate(), t);
    slate = captureMail(slate, "hello", t + 1).slate;
    const read = () => slate;
    const refused = await bridgeLeg({ settings: { url: `http://127.0.0.1:${server.port}`, token: "wrong" }, read, cursor: emptyBridgeCursor(), now: () => t, fetchImpl: fetch });
    expect(refused?.outcome).toBe("refused");
    expect(refused?.cursor).toEqual(emptyBridgeCursor());
    expect(face.held()).toBeNull();
    await server.close();
    const gone = await bridgeLeg({ settings: { url: `http://127.0.0.1:${server.port}`, token: "right" }, read, cursor: emptyBridgeCursor(), now: () => t, fetchImpl: fetch });
    expect(gone?.outcome).toBe("unreachable");
    expect(gone?.cursor).toEqual(emptyBridgeCursor());
  } finally {
    await server.close();
  }
});
