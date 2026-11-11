import { expect, test } from "bun:test";
import type { VisitTelemetry } from "../../shared/visitProtocol.js";
import { createFakeChannel } from "./fakeChannel.js";
import { createPrincipalDesk, type WaitingMarker } from "./principal.js";
import { startPrincipalServer, type PrincipalServerHandle } from "./principalServer.js";
import { createSseParser, startWatch } from "./watch.js";

// Task 66: push delivery. The box subscribes (SSE) and is told the moment a
// line lands; the one-minute poll stays as the fallback; nothing is lost or
// shown twice; only an open visit, only the token's own town; the shared
// gate still governs what her wake says; no text in logs.

const tel = (): VisitTelemetry => ({
  museZone: "tree", gaiusZone: "tree", museSeated: false, gaiusSeated: false, gaiusWalking: false, dayPhase: "day",
  museX: 0, museZ: 0, gaiusX: 1, gaiusZ: 0, museHeading: 0, gaiusHeading: 0, bearingToGaius: 0, distanceToGaius: 1, pad2Source: "none",
});

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 4000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await sleep(5);
  }
}

function town(log: string[] = []) {
  const channel = createFakeChannel();
  const desk = createPrincipalDesk({ channel, rank: () => 0, log: (l) => log.push(l) });
  /** What the bridge's director loop does each beat: read the town, let the desk observe. */
  const beat = async () => desk.observe(await channel.readState());
  return { channel, desk, beat, log };
}

const serve = (desk: ReturnType<typeof town>["desk"], extra: Record<string, unknown> = {}, log: (l: string) => void = () => {}) =>
  startPrincipalServer({ desk, token: "owner-token", markerToken: "marker-token", port: 0, host: "127.0.0.1", log, ...extra });
const url = (s: PrincipalServerHandle) => `http://127.0.0.1:${s.port}`;

test("the SSE parser reassembles events split across chunks and drops comments", () => {
  const got: { event: string; data: string }[] = [];
  const feed = createSseParser((e) => got.push(e));
  feed("retry: 3000\n\n: keepalive\n\nevent: mar");
  feed("ker\ndata: {\"a\":1}\r\n\r\nevent: marker\ndata: x\ndata: y\n\n");
  expect(got).toEqual([{ event: "marker", data: '{"a":1}' }, { event: "marker", data: "x\ny" }]);
});

test("push: a line reaches the subscriber soon after the bridge reads it; latency measured locally", async () => {
  const { channel, desk, beat } = town();
  const server = await serve(desk);
  channel.open(Date.now(), tel());
  const got: { m: WaitingMarker; at: number }[] = [];
  const w = startWatch({ bridgeUrl: url(server), token: "owner-token", pollFallbackMs: 60_000, onLine: (m) => void got.push({ m, at: Date.now() }) });
  await desk.wake({}); // she goes on duty: only a real wake takes the claim, the stream's heartbeat then keeps it
  // (a) the push hop alone: the desk learns of the line, the subscriber is told.
  const hops: number[] = [];
  for (let i = 1; i <= 5; i++) {
    channel.mail(`line ${i}`, Date.now());
    const t0 = Date.now();
    await beat();
    await until(() => got.length === i);
    hops.push(got[i - 1]!.at - t0);
    // she answers, so the next line is a fresh one
    const r = await desk.wake({ seen: i, direction: { kind: "speak", text: "Yes, I am here." } });
    expect(r.ok).toBe(true);
  }
  // (b) with the bridge reading the town on its 2 s beat (POLL_MS default): the line lands 700 ms
  // into a beat, so this one sample waits about 1.3 s. A local, fake-channel figure, not a live one.
  const loop = setInterval(() => void beat(), 2000);
  await sleep(700);
  const t0 = Date.now();
  channel.mail("a line between beats", t0);
  await until(() => got.length === 6, 6000);
  const e2e = got[5]!.at - t0;
  clearInterval(loop);
  console.log(`PUSH LATENCY: hop (desk learns -> subscriber told) ms: ${hops.join(", ")} (max ${Math.max(...hops)}); end to end with the 2 s beat: ${e2e} ms`);
  expect(Math.max(...hops)).toBeLessThan(250);
  expect(e2e).toBeLessThan(2600);
  expect(got.map((g) => g.m.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  w.stop();
  await server.close();
});

test("fallback: with the push channel down, the poll still delivers every line, once", async () => {
  const { channel, desk, beat } = town();
  const server = await serve(desk);
  channel.open(Date.now(), tel());
  const real = fetch;
  const noPush: typeof fetch = (input, init) => (String(input).includes("/principal/events") ? Promise.reject(new Error("blocked")) : real(input, init));
  const got: number[] = [];
  const w = startWatch({ bridgeUrl: url(server), token: "owner-token", pollFallbackMs: 150, backoffMs: { min: 50, max: 100 }, fetchImpl: noPush, onLine: (m) => void got.push(m.seq!) });
  await desk.wake({}); // on duty
  channel.mail("one", Date.now());
  await beat();
  await until(() => got.length === 1);
  await sleep(500); // several more polls: the same unanswered line is not handed over again
  expect(got).toEqual([1]);
  expect(w.stats().streams).toBe(0);
  expect(w.stats().polled).toBe(1);
  w.stop();
  await server.close();
});

test("a stream that drops mid-visit reconnects and the line that landed meanwhile arrives first", async () => {
  const { channel, desk, beat } = town();
  const server = await serve(desk, { streamMaxMs: 300 });
  channel.open(Date.now(), tel());
  await desk.wake({}); // on duty
  const got: number[] = [];
  const w = startWatch({ bridgeUrl: url(server), token: "owner-token", pollFallbackMs: 60_000, backoffMs: { min: 20, max: 40 }, onLine: (m) => void got.push(m.seq!) });
  await until(() => w.stats().streams >= 1);
  await until(() => w.stats().streams >= 2, 3000); // the bridge ended the first, the watcher came back
  channel.mail("while away", Date.now());
  await beat();
  await until(() => got.length === 1);
  expect(got).toEqual([1]);
  w.stop();
  await server.close();
});

test("push and poll together never hand over a line twice; a failed hand-over is retried", async () => {
  const { channel, desk, beat } = town();
  const server = await serve(desk);
  channel.open(Date.now(), tel());
  let tries = 0;
  const got: number[] = [];
  const w = startWatch({
    bridgeUrl: url(server), token: "owner-token", pollFallbackMs: 100,
    onLine: (m) => {
      tries += 1;
      if (tries === 1) throw new Error("the box was busy");
      got.push(m.seq!);
    },
  });
  await desk.wake({}); // on duty
  channel.mail("hello", Date.now());
  await beat();
  await until(() => got.length === 1, 3000); // the poll retried what the push could not hand over
  await sleep(400);
  expect(got).toEqual([1]);
  expect(w.stats().failures).toBe(1);
  w.stop();
  await server.close();
});

test("no visit open: nothing is pushed and the stream says so; a waiting line is never invented", async () => {
  const { channel, desk, beat } = town();
  const server = await serve(desk);
  const seen: WaitingMarker[] = [];
  const res = await fetch(`${url(server)}/principal/events?claim=1`, { headers: { authorization: "Bearer owner-token" } });
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/event-stream");
  const parse = createSseParser((e) => e.event === "marker" && seen.push(JSON.parse(e.data)));
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  void (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      parse(value);
    }
  })();
  await until(() => seen.length >= 1);
  await beat(); // the town reports no visit
  await sleep(100);
  expect(seen.every((m) => m.waiting === false && m.seq === null)).toBe(true);
  // A visit opens and closes: the line is announced only while open, and the close clears it.
  channel.open(Date.now(), tel());
  await desk.wake({}); // on duty, so his line waits for her
  channel.mail("hi", Date.now());
  await beat();
  await until(() => seen.some((m) => m.waiting && m.seq === 1));
  channel.close();
  await beat();
  await until(() => seen[seen.length - 1]!.waiting === false);
  await reader.cancel();
  await server.close();
});

test("only the token's own town: wrong, missing and other-town tokens are refused; a town's stream never carries another's lines", async () => {
  const a = town();
  const b = town();
  const log: string[] = [];
  const server = await serve(a.desk, { resolve: (t: string | null) => (t === "town-b-token" ? b.desk : null) }, (l) => log.push(l));
  const at = (path: string, token?: string) => fetch(`${url(server)}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  expect((await at("/principal/events")).status).toBe(401);
  expect((await at("/principal/events", "nonsense")).status).toBe(401);
  expect((await fetch(`${url(server)}/principal/events`, { method: "POST", headers: { authorization: "Bearer owner-token" } })).status).toBe(405);
  a.channel.open(Date.now(), tel());
  b.channel.open(Date.now(), tel());
  const gotA: number[] = [];
  const gotB: number[] = [];
  const wa = startWatch({ bridgeUrl: url(server), token: "owner-token", pollFallbackMs: 60_000, onLine: (m) => void gotA.push(m.seq!) });
  const wb = startWatch({ bridgeUrl: url(server), token: "town-b-token", pollFallbackMs: 60_000, onLine: (m) => void gotB.push(m.seq!) });
  await a.desk.wake({});
  await b.desk.wake({});
  b.channel.mail("for B only", Date.now());
  await b.beat();
  await until(() => gotB.length === 1);
  await a.beat();
  await sleep(150);
  expect(gotA).toEqual([]);
  a.channel.mail("for A only", Date.now());
  a.channel.mail("for A only, again", Date.now());
  await a.beat();
  await until(() => gotA.length === 1);
  expect(gotA).toEqual([2]);
  expect(gotB).toEqual([1]);
  wa.stop();
  wb.stop();
  await server.close();
});

test("the gate still holds on a pushed line: her explicit reply is refused, a plain one performed; no text in the logs", async () => {
  const log: string[] = [];
  const { channel, desk, beat } = town(log);
  const server = await serve(desk, {}, (l) => log.push(l));
  channel.open(Date.now(), tel());
  const SENTINEL = "SENTINEL-PRIVATE-91c2";
  let woke = 0;
  const w = startWatch({
    bridgeUrl: url(server), token: "owner-token", pollFallbackMs: 60_000,
    onLine: async (m) => {
      woke += 1;
      const r = await desk.wake({ seen: m.seq, direction: { kind: "speak", text: `Let us make love tonight ${SENTINEL}.` } });
      expect(r.ok).toBe(true);
    },
  });
  await desk.wake({}); // on duty
  channel.mail(`His words ${SENTINEL}`, Date.now());
  await beat();
  await until(() => woke === 1);
  await sleep(50);
  const spoken = () => channel.directions.flatMap((d) => (d.direction.kind === "speak" ? [d.direction.text] : []));
  // The shared gate turns the explicit words into the gentle refusal; they are never performed.
  expect(spoken().length).toBe(1);
  expect(spoken()[0]).not.toContain("make love");
  expect(spoken()[0]).toContain("tender");
  channel.mail("Another line", Date.now());
  await beat();
  const plain = await desk.wake({ seen: 2, direction: { kind: "speak", text: "I heard you, my dear." } });
  expect(plain.ok).toBe(true);
  expect(spoken()).toContain("I heard you, my dear.");
  const text = log.join("\n");
  expect(text).not.toContain(SENTINEL);
  expect(text).not.toContain("owner-token");
  expect(text).toContain("principal events: a stream opened");
  w.stop();
  await server.close();
});
