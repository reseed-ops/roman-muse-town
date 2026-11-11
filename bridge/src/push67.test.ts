import { expect, test } from "bun:test";
import type { VisitTelemetry } from "../../shared/visitProtocol.js";
import { createFakeChannel } from "./fakeChannel.js";
import { createPrincipalDesk, type WaitingMarker } from "./principal.js";
import { startPrincipalServer, type PrincipalServerHandle } from "./principalServer.js";
import { createAttemptWindow, createSampledLog, createStreamWriter } from "./streamGuard.js";
import { createSseParser, startWatch, type Ack } from "./watch.js";

// Task 67: the push review fixes. Claim model, dedupe, revocation, caps, backpressure.

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
function town(opts: { now?: () => number; claimMs?: number; heartbeatClaimMs?: number } = {}) {
  const channel = createFakeChannel();
  const log: string[] = [];
  const desk = createPrincipalDesk({ channel, rank: () => 0, log: (l) => log.push(l), ...opts });
  const beat = async () => desk.observe(await channel.readState());
  return { channel, desk, beat, log };
}
const serve = (desk: ReturnType<typeof town>["desk"], extra: Record<string, unknown> = {}, log: (l: string) => void = () => {}) =>
  startPrincipalServer({ desk, token: "owner-token", markerToken: "marker-token", port: 0, host: "127.0.0.1", log, ...extra });
const url = (s: PrincipalServerHandle) => `http://127.0.0.1:${s.port}`;
const open = (s: PrincipalServerHandle, token: string, q = "") => fetch(`${url(s)}/principal/events${q}`, { headers: { authorization: `Bearer ${token}` } });

/** Read a stream's markers into a list; `ended()` says whether the server closed it. */
function listen(res: Response) {
  const markers: WaitingMarker[] = [];
  let over = false;
  const parse = createSseParser((e) => e.event === "marker" && markers.push(JSON.parse(e.data)));
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parse(value);
      }
    } catch {
      /* cancelled */
    }
    over = true;
  })();
  return { markers, ended: () => over, cancel: () => reader.cancel().catch(() => {}) };
}

// ---- 1. the claim model ---------------------------------------------------

test("claim model: a heartbeat never takes the claim; only a real wake does, and the stream then keeps it", async () => {
  const { channel, desk } = town();
  const server = await serve(desk);
  channel.open(Date.now(), tel());
  const s = listen(await open(server, "owner-token", "?claim=1"));
  await until(() => s.markers.length >= 1);
  await sleep(100);
  expect(desk.live()).toBe(false); // claim=1 on a stream with no real wake claims nothing
  await desk.wake({});
  expect(desk.live()).toBe(true);
  expect(desk.keepClaim()).toBe(true);
  await s.cancel();
  await server.close();
});

test("claim model: heartbeats are honoured for about 10 minutes after her last real wake, then the claim lapses", async () => {
  const clock = { t: 1_000_000 };
  const { channel, desk } = town({ now: () => clock.t, claimMs: 180_000, heartbeatClaimMs: 600_000 });
  channel.open(clock.t, tel());
  await desk.wake({});
  for (let i = 0; i < 39; i++) {
    clock.t += 15_000; // 9.75 minutes of heartbeats
    expect(desk.keepClaim()).toBe(true);
  }
  expect(desk.live()).toBe(true);
  clock.t += 15_000; // past 10 minutes since the wake
  expect(desk.keepClaim()).toBe(false);
  clock.t += 180_000; // and no heartbeat renewed it: it lapses, the resident resumes
  expect(desk.live()).toBe(false);
  expect(desk.keepClaim()).toBe(false); // a heartbeat does not take it back
  await desk.wake({}); // only a real wake does
  expect(desk.live()).toBe(true);
});

test("claim model: an explicit release is not undone by the next claiming heartbeat", async () => {
  const { channel, desk } = town();
  channel.open(Date.now(), tel());
  await desk.wake({});
  expect(desk.live()).toBe(true);
  await desk.wake({ attend: false });
  expect(desk.live()).toBe(false);
  expect(desk.keepClaim()).toBe(false);
  expect(desk.live()).toBe(false);
});

test("claim model: a marker-token stream never takes the claim, even with claim=1 and a resident present; it sees only a text-free line signal", async () => {
  const { channel, desk, beat } = town(); // a resident is present: unclaimed lines are hers
  const server = await serve(desk);
  channel.open(Date.now(), tel());
  const s = listen(await open(server, "marker-token", "?claim=1"));
  await until(() => s.markers.length >= 1);
  channel.mail("SENTINEL-67 a line", Date.now());
  await beat();
  await until(() => s.markers.some((m) => m.latestSeq === 1));
  const m = s.markers.find((x) => x.latestSeq === 1)!;
  expect(m.waiting).toBe(false); // the resident answers, nothing waits for her
  expect(m.lastLineAt).not.toBeNull();
  expect(m.claimLive).toBe(false);
  expect(desk.live()).toBe(false); // never claimed
  expect(JSON.stringify(s.markers)).not.toContain("SENTINEL-67");
  await s.cancel();
  await server.close();
});

test("claim model: a non-claiming watcher learns a line exists from latestSeq (work: lines)", async () => {
  const { channel, desk, beat } = town();
  const server = await serve(desk);
  channel.open(Date.now(), tel());
  const got: number[] = [];
  const w = startWatch({ bridgeUrl: url(server), token: "marker-token", claim: false, work: "lines", pollFallbackMs: 60_000, onLine: (m) => void got.push(m.latestSeq) });
  await until(() => w.stats().streams >= 1);
  channel.mail("one", Date.now());
  await beat();
  await until(() => got.length === 1);
  expect(got).toEqual([1]);
  expect(desk.live()).toBe(false);
  w.stop();
  await server.close();
});

test("claim model: a watcher stops asking for the claim after repeated failures (it reconnects without claim=1)", async () => {
  const urls: string[] = [];
  const m = (rev: number, seq: number): WaitingMarker => ({ waiting: true, seq, at: 1, composing: false, claimLive: true, visit: 5, rev, latestSeq: seq, lastLineAt: 1 });
  const fake: typeof fetch = async (input) => {
    const u = String(input);
    urls.push(u);
    if (u.includes("/events")) return new Response(`event: marker\ndata: ${JSON.stringify(m(1, 1))}\n\n`, { status: 200 });
    return new Response(JSON.stringify(m(2, 1)), { status: 200 });
  };
  const w = startWatch({ bridgeUrl: "http://x", token: "t", pollFallbackMs: 30, backoffMs: { min: 10, max: 20 }, claimFailureLimit: 2, fetchImpl: fake, onLine: () => { throw new Error("no composer"); } });
  await until(() => w.stats().failures >= 2);
  await sleep(150);
  const stream = urls.filter((u) => u.includes("/events"));
  expect(stream[0]).toContain("claim=1");
  expect(stream[stream.length - 1]).not.toContain("claim=1");
  expect(urls.filter((u) => u.includes("/waiting")).pop()).not.toContain("claim=1");
  w.stop();
});

// ---- 2. dedupe -------------------------------------------------------------

type Feed = { push(m: WaitingMarker): void; pollAnswers: Array<(m: WaitingMarker) => void> };
/** A fake bridge: one stream the test writes into, and polls the test answers by hand. */
function fakeBridge() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const enc = new TextEncoder();
  const feed: Feed = {
    push: (m) => controller.enqueue(enc.encode(`event: marker\ndata: ${JSON.stringify(m)}\n\n`)),
    pollAnswers: [],
  };
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).includes("/events")) {
      return new Response(new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) }), { status: 200 });
    }
    return new Promise<Response>((resolve) => feed.pollAnswers.push((m) => resolve(new Response(JSON.stringify(m), { status: 200 }))));
  };
  return { feed, fetchImpl };
}
const mk = (visit: number | null, rev: number, seq: number | null, extra: Partial<WaitingMarker> = {}): WaitingMarker => ({
  waiting: seq !== null, seq, at: seq === null ? null : 1, composing: false, claimLive: true, visit, rev, latestSeq: seq ?? 0, lastLineAt: seq === null ? null : 1, ...extra,
});

test("dedupe: a delayed poll answer older than the pushed marker is discarded (Codex's [2,1,2])", async () => {
  const { feed, fetchImpl } = fakeBridge();
  const got: number[] = [];
  const w = startWatch({ bridgeUrl: "http://x", token: "t", pollFallbackMs: 60_000, fetchImpl, onLine: (m) => void got.push(m.seq!) });
  await until(() => feed.pollAnswers.length === 1 && w.stats().streams === 1);
  feed.push(mk(100, 20, 2)); // pushed: line 2
  await until(() => got.length === 1);
  feed.push(mk(100, 30, null)); // she answered: idle
  await sleep(20);
  feed.pollAnswers[0]!(mk(100, 10, 1)); // the poll, fetched while line 1 waited, lands late
  await sleep(50);
  feed.push(mk(100, 20, 2)); // and a repeat of an old push
  await sleep(50);
  expect(got).toEqual([2]);
  expect(w.stats().stale).toBe(2); // the late poll and the repeated old push
  w.stop();
});

test("dedupe: a new visit with the same line number is new work (a missed visit transition)", async () => {
  const { feed, fetchImpl } = fakeBridge();
  const got: Array<[number | null, number]> = [];
  const w = startWatch({ bridgeUrl: "http://x", token: "t", pollFallbackMs: 60_000, fetchImpl, onLine: (m) => void got.push([m.visit, m.seq!]) });
  await until(() => w.stats().streams === 1);
  feed.push(mk(100, 1, 1));
  await until(() => got.length === 1);
  feed.push(mk(100, 2, 1)); // the same work again: nothing
  await sleep(40);
  feed.push(mk(200, 3, 1)); // the stream missed the close and reopen; same seq, new visit
  await until(() => got.length === 2);
  expect(got).toEqual([[100, 1], [200, 1]]);
  w.stop();
});

test("dedupe: a restart does not repeat acknowledged work (the state is kept, metadata only)", async () => {
  let saved: Ack | null = null;
  const store = { load: () => saved, save: (a: Ack) => void (saved = a) };
  const first = fakeBridge();
  const got: number[] = [];
  const w1 = startWatch({ bridgeUrl: "http://x", token: "t", pollFallbackMs: 60_000, fetchImpl: first.fetchImpl, persist: store, onLine: (m) => void got.push(m.seq!) });
  await until(() => w1.stats().streams === 1);
  first.feed.push(mk(100, 1, 3));
  await until(() => got.length === 1);
  w1.stop();
  expect(saved).toEqual({ visit: 100, seq: 3 });
  expect(JSON.stringify(saved)).not.toMatch(/text|token/i);
  const second = fakeBridge();
  const w2 = startWatch({ bridgeUrl: "http://x", token: "t", pollFallbackMs: 60_000, fetchImpl: second.fetchImpl, persist: store, onLine: (m) => void got.push(m.seq!) });
  await until(() => w2.stats().streams === 1);
  second.feed.push(mk(100, 5, 3)); // the same line, still waiting after the restart
  await sleep(60);
  expect(got).toEqual([3]);
  second.feed.push(mk(100, 6, 4)); // a new one is delivered
  await until(() => got.length === 2);
  w2.stop();
});

test("dedupe: a successful wake followed by a command failure is retried without a second reply", async () => {
  const { channel, desk, beat } = town();
  const server = await serve(desk);
  channel.open(Date.now(), tel());
  await desk.wake({});
  let tries = 0;
  const w = startWatch({
    bridgeUrl: url(server), token: "owner-token", pollFallbackMs: 100,
    onLine: async (m, ctx) => {
      tries += 1;
      const r = await desk.wake({ seen: m.seq, visit: ctx.visit, direction: { kind: "speak", text: "I am here, my dear." } });
      expect(r.ok).toBe(true);
      if (tries === 1) throw new Error("the command failed after the POST went through");
    },
  });
  channel.mail("hello", Date.now());
  await beat();
  await until(() => tries >= 2, 3000);
  await sleep(150);
  const spoken = channel.directions.filter((d) => d.direction.kind === "speak");
  expect(spoken.length).toBe(1); // the retry's wake was a no-op
  w.stop();
  await server.close();
});

test("idempotent wake: a repeat for an answered line sends nothing; a stale visit is refused; a new line is answered", async () => {
  const { channel, desk, beat } = town();
  const began = Date.now();
  channel.open(began, tel());
  await desk.wake({});
  channel.mail("hi", began + 1);
  await beat();
  const say = (text: string, extra: Record<string, unknown> = {}) => desk.wake({ seen: 1, direction: { kind: "speak", text }, ...extra });
  const spoken = () => channel.directions.filter((d) => d.direction.kind === "speak").length;
  expect((await say("Hello, my dear.", { visit: began })).ok).toBe(true);
  expect(spoken()).toBe(1);
  const again = await say("Hello, my dear.", { visit: began });
  expect(again.ok && again.slate.note).toContain("already answered");
  expect(spoken()).toBe(1);
  const stale = await say("Hello again.", { visit: began - 5 });
  expect(stale.ok).toBe(false);
  expect(spoken()).toBe(1);
  channel.mail("and again", began + 2);
  await beat();
  expect((await desk.wake({ seen: 2, direction: { kind: "speak", text: "Yes, my dear." } })).ok).toBe(true);
  expect(spoken()).toBe(2);
});

test("marker: rev rises on every change and across a restart; the visit id and the text-free line signal are in it", async () => {
  const a = town();
  a.channel.open(5_000, tel());
  const m0 = a.desk.marker();
  await a.desk.wake({});
  const m1 = a.desk.marker();
  expect(m1.rev).toBeGreaterThan(m0.rev);
  expect(a.desk.marker().rev).toBe(m1.rev); // unchanged state, unchanged rev
  expect(m1.visit).toBe(5_000);
  a.channel.mail("x", 5_001);
  await a.beat();
  const m2 = a.desk.marker();
  expect(m2).toMatchObject({ latestSeq: 1, visit: 5_000 });
  expect(m2.rev).toBeGreaterThan(m1.rev);
  await sleep(3);
  const b = town(); // a restarted bridge: its revs start higher
  b.channel.open(5_000, tel());
  expect(b.desk.marker().rev).toBeGreaterThan(m2.rev);
});

test("timing: the bridge logs how long after it first observed a line the marker reached the socket, with no text", async () => {
  const log: string[] = [];
  const { channel, desk, beat } = town();
  const server = await serve(desk, {}, (l) => log.push(l));
  channel.open(Date.now(), tel());
  await desk.wake({});
  const s = listen(await open(server, "owner-token"));
  await until(() => s.markers.length >= 1);
  channel.mail("SENTINEL-timing", Date.now());
  await beat();
  await until(() => log.some((l) => /line 1 handed to the socket \d+ ms after the bridge first observed it \(not client receipt\)/.test(l)));
  expect(log.join("\n")).not.toContain("SENTINEL-timing");
  await s.cancel();
  await server.close();
});

// ---- 3. revocation ---------------------------------------------------------

test("revocation: a paired credential that is revoked or expires mid-stream ends the stream, and its claim lapses", async () => {
  const { channel, desk } = town({ claimMs: 400 });
  let valid = true;
  const server = await serve(desk, { streamRecheckMs: 40, streamHeartbeatMs: 20, resolve: (t: string | null) => (t === "paired-token" && valid ? desk : null) });
  channel.open(Date.now(), tel());
  await desk.wake({});
  const paired = listen(await open(server, "paired-token", "?claim=1"));
  const owner = listen(await open(server, "owner-token")); // a control: the owner's stays
  await until(() => paired.markers.length >= 1 && owner.markers.length >= 1);
  await sleep(150);
  expect(paired.ended()).toBe(false);
  expect(desk.live()).toBe(true); // renewed by the paired stream's heartbeat
  valid = false; // unpaired (generation bumped) or expired
  await until(() => paired.ended(), 2000);
  await until(() => !desk.live(), 3000); // nothing renews it any more: it lapses
  expect(owner.ended()).toBe(false);
  await owner.cancel();
  await server.close();
});

// ---- 4. rate limits, caps, backpressure ------------------------------------

test("limits: failed auth on the principal routes is limited per address; the log line is sampled; the owner still gets in", async () => {
  const { desk } = town();
  const log: string[] = [];
  const server = await serve(desk, { authLimits: { missesPerSource: 3 } }, (l) => log.push(l));
  const codes: number[] = [];
  for (let i = 0; i < 6; i++) codes.push((await fetch(`${url(server)}/principal/waiting`, { headers: { authorization: `Bearer wrong-${i}` } })).status);
  expect(codes).toEqual([401, 401, 401, 429, 429, 429]);
  expect(log.filter((l) => l.startsWith("principal: refused")).length).toBe(1); // sampled
  expect((await fetch(`${url(server)}/principal/waiting`, { headers: { authorization: "Bearer owner-token" } })).status).toBe(200);
  await server.close();
});

test("limits: stream attempts are limited per credential and per source", async () => {
  const { desk } = town();
  const a = await serve(desk, { eventAttempts: { perCredential: 3, perSource: 100 } });
  const codes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await open(a, "owner-token");
    codes.push(r.status);
    await r.body?.cancel();
  }
  expect(codes).toEqual([200, 200, 200, 429, 429]);
  await a.close();
  const b = await serve(desk, { eventAttempts: { perCredential: 100, perSource: 2 } });
  const c: number[] = [];
  for (const t of ["owner-token", "marker-token", "owner-token"]) {
    const r = await open(b, t);
    c.push(r.status);
    await r.body?.cancel();
  }
  expect(c).toEqual([200, 200, 429]);
  await b.close();
});

test("limits: marker-token streams are capped at 1 and can never evict a claim holder", async () => {
  const { channel, desk } = town();
  const server = await serve(desk);
  channel.open(Date.now(), tel());
  const holders = [] as ReturnType<typeof listen>[];
  for (let i = 0; i < 3; i++) holders.push(listen(await open(server, "owner-token")));
  const o1 = listen(await open(server, "marker-token"));
  await until(() => o1.markers.length >= 1);
  const o2 = listen(await open(server, "marker-token"));
  await until(() => o1.ended(), 2000); // the older observer made room for the newer
  await sleep(50);
  expect(o2.ended()).toBe(false);
  expect(holders.every((h) => !h.ended())).toBe(true);
  expect(server.streams().open).toBe(4);
  // And a fourth holder replaces the oldest holder, never an observer.
  const h4 = listen(await open(server, "owner-token"));
  await until(() => holders[0]!.ended(), 2000);
  expect(o2.ended()).toBe(false);
  for (const x of [...holders, o2, h4]) await x.cancel();
  await server.close();
});

test("limits: the total cap counts what eviction frees; another desk is refused when full", async () => {
  const a = town();
  const b = town();
  const server = await serve(a.desk, { streamsTotal: 3, resolve: (t: string | null) => (t === "town-b" ? b.desk : null) });
  const held = [] as ReturnType<typeof listen>[];
  for (let i = 0; i < 3; i++) held.push(listen(await open(server, "owner-token")));
  await until(() => held.every((h) => h.markers.length >= 1));
  // full (3 of 3), but the desk's per-desk cap is 3: its own reconnect replaces its oldest
  const again = await open(server, "owner-token");
  expect(again.status).toBe(200);
  await until(() => held[0]!.ended(), 2000);
  const refused = await open(server, "town-b");
  expect(refused.status).toBe(503);
  await refused.body?.cancel();
  await again.body?.cancel();
  for (const h of held) await h.cancel();
  await server.close();
});

test("limits: closing the last stream deletes the desk's entry", async () => {
  const { desk } = town();
  const server = await serve(desk);
  const s = listen(await open(server, "owner-token"));
  await until(() => s.markers.length >= 1);
  expect(server.streams()).toEqual({ open: 1, desks: 1 });
  await s.cancel();
  await until(() => server.streams().open === 0, 2000);
  expect(server.streams()).toEqual({ open: 0, desks: 0 });
  await server.close();
});

test("backpressure: a full socket keeps only the latest marker; a stalled or swollen one is cut", () => {
  const writes: string[] = [];
  let drain = () => {};
  const res = { written: 0, length: 0, full: false, write(c: string) { writes.push(c); return !this.full; }, get writableLength() { return this.length; }, on(_e: "drain", l: () => void) { drain = l; } };
  const abandoned: string[] = [];
  const clock = { t: 0 };
  const w = createStreamWriter(res, { maxBuffer: 1000, stallMs: 30_000, abandon: (why) => abandoned.push(why), now: () => clock.t });
  w.marker("m1");
  res.full = true;
  w.marker("m2"); // accepted but the socket is full now
  w.marker("m3"); // coalesced
  w.marker("m4"); // coalesced: only the latest waits
  w.comment("k"); // skipped
  expect(writes).toEqual(["m1", "m2"]);
  res.full = false;
  drain();
  expect(writes).toEqual(["m1", "m2", "m4"]);
  // stalled: full for 30 s
  res.full = true;
  w.marker("m5");
  clock.t = 29_000;
  w.check();
  expect(abandoned).toEqual([]);
  clock.t = 31_000;
  w.check();
  expect(abandoned).toEqual(["stalled"]);
  // swollen
  const w2 = createStreamWriter(res, { maxBuffer: 1000, stallMs: 30_000, abandon: (why) => abandoned.push(why), now: () => clock.t });
  res.length = 5000;
  w2.marker("x");
  expect(abandoned).toEqual(["stalled", "buffer"]);
});

test("helpers: the attempt window slides and the sampled log holds back repeats", () => {
  const clock = { t: 0 };
  const win = createAttemptWindow(2, 1000, { now: () => clock.t });
  expect([win.hit("a"), win.hit("a"), win.hit("a"), win.hit("b")]).toEqual([true, true, false, true]);
  clock.t = 1500;
  expect(win.hit("a")).toBe(true);
  const lines: string[] = [];
  const log = createSampledLog((l) => lines.push(l), 1000, () => clock.t);
  log("k", "first");
  log("k", "second");
  log("k", "third");
  clock.t += 1200;
  log("k", "fourth");
  expect(lines).toEqual(["first", "fourth (2 similar held back)"]);
});

test("watcher: a silent stream is dropped after the idle limit and reconnected", async () => {
  let opened = 0;
  const fake: typeof fetch = async (input, init) => {
    if (String(input).includes("/events")) {
      opened += 1;
      // never sends a byte; like a real fetch, it errors when the caller aborts
      return new Response(new ReadableStream<Uint8Array>({ start: (c) => init?.signal?.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError"))) }), { status: 200 });
    }
    return new Response(JSON.stringify(mk(null, 1, null)), { status: 200 });
  };
  const w = startWatch({ bridgeUrl: "http://x", token: "t", pollFallbackMs: 60_000, idleMs: 80, backoffMs: { min: 10, max: 20 }, fetchImpl: fake, onLine: () => {} });
  await until(() => opened >= 3, 3000);
  w.stop();
});

test("watcher: a stuck command is aborted at its deadline, does not block the newest line, and only the newest is kept", async () => {
  const { feed, fetchImpl } = fakeBridge();
  const got: number[] = [];
  const aborted: number[] = [];
  const w = startWatch({
    bridgeUrl: "http://x", token: "t", pollFallbackMs: 60_000, fetchImpl, commandTimeoutMs: 100,
    onLine: (m, ctx) => {
      if (m.seq === 1) return new Promise<void>(() => ctx.signal.addEventListener("abort", () => void aborted.push(1))); // hangs forever
      got.push(m.seq!);
    },
  });
  await until(() => w.stats().streams === 1);
  feed.push(mk(100, 1, 1));
  await sleep(20);
  feed.push(mk(100, 2, 2));
  feed.push(mk(100, 3, 3)); // coalesced with 2: only the newest waits
  await until(() => got.length === 1, 2000);
  expect(got).toEqual([3]);
  expect(aborted).toEqual([1]);
  expect(w.stats().failures).toBe(1);
  expect(w.stats().coalesced).toBeGreaterThanOrEqual(1);
  w.stop();
});
