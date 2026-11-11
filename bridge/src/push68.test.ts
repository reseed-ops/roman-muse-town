import { expect, test } from "bun:test";
import type { VisitTelemetry } from "../../shared/visitProtocol.js";
import { createFakeChannel } from "./fakeChannel.js";
import { createPrincipalDesk } from "./principal.js";
import { startPrincipalServer, type PrincipalServerHandle } from "./principalServer.js";
import { createStreamWriter } from "./streamGuard.js";

// Task 68: Codex review fixes for Task 67.

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
const serve = (desk: ReturnType<typeof createPrincipalDesk>, extra: Record<string, unknown> = {}) =>
  startPrincipalServer({ desk, token: "owner-token", markerToken: "marker-token", port: 0, host: "127.0.0.1", log: () => {}, ...extra });
const open = (s: PrincipalServerHandle, token: string) => fetch(`http://127.0.0.1:${s.port}/principal/events`, { headers: { authorization: `Bearer ${token}` } });
/** Reads a stream; `how()` says whether it ended cleanly, was cut off abruptly, or is still open. */
function watchStream(res: Response) {
  let how: "open" | "clean" | "cut" = "open";
  const reader = res.body!.getReader();
  void (async () => {
    try {
      for (;;) if ((await reader.read()).done) break;
      how = "clean";
    } catch {
      how = "cut";
    }
  })();
  return { how: () => how, cancel: () => reader.cancel().catch(() => {}) };
}

test("1. failed send then retry with the same work identity is accepted, not discarded", async () => {
  const channel = createFakeChannel();
  const desk = createPrincipalDesk({ channel, rank: () => 0, log: () => {} });
  const began = Date.now();
  channel.open(began, tel());
  await desk.wake({});
  channel.mail("hello", began + 1);
  await desk.observe(await channel.readState());
  const realDirect = channel.direct.bind(channel);
  let failing = true;
  channel.direct = async (d) => (failing ? { ok: false, error: "the town is unreachable" } : realDirect(d));
  const say = () => desk.wake({ seen: 1, visit: began, direction: { kind: "speak", text: "Here I am, my dear." } });
  await say(); // the town refuses: nothing was delivered
  expect(channel.directions.filter((d) => d.direction.kind === "speak").length).toBe(0);
  failing = false;
  const retry = await say(); // same visit, same line
  expect(retry.ok && retry.slate.note).toBeUndefined();
  expect(channel.directions.filter((d) => d.direction.kind === "speak").length).toBe(1);
  const again = await say(); // now it was delivered: a repeat is a no-op
  expect(again.ok && again.slate.note).toContain("already answered");
  expect(channel.directions.filter((d) => d.direction.kind === "speak").length).toBe(1);
});

test("1b. a thrown send and a delayed beat that never ran also stay retryable", async () => {
  const channel = createFakeChannel();
  let t = 1_000_000;
  const desk = createPrincipalDesk({ channel, rank: () => 0, log: () => {}, now: () => t });
  channel.open(t, tel());
  await desk.wake({});
  channel.mail("hello", t + 1);
  await desk.observe(await channel.readState());
  const realDirect = channel.direct.bind(channel);
  channel.direct = async () => {
    throw new Error("socket hang up");
  };
  await desk.wake({ seen: 1, visit: 1_000_000, direction: { kind: "speak", text: "Here." } });
  channel.direct = realDirect;
  // a delayed beat, then superseded before it runs: nothing was spoken, so the line is still open
  await desk.wake({ seen: 1, visit: 1_000_000, beats: [{ delayS: 30, direction: { kind: "speak", text: "Later." } }] });
  expect(channel.directions.filter((d) => d.direction.kind === "speak").length).toBe(0);
  const r = await desk.wake({ seen: 1, visit: 1_000_000, direction: { kind: "speak", text: "Now." } });
  expect(r.ok && r.slate.note).toBeUndefined();
  expect(channel.directions.filter((d) => d.direction.kind === "speak").length).toBe(1);
});

test("2. observer replacement keeps the one-observer cap: A, B, C leave exactly one open", async () => {
  const desk = createPrincipalDesk({ channel: createFakeChannel(), rank: () => 0, log: () => {} });
  const server = await serve(desk);
  const a = watchStream(await open(server, "marker-token"));
  await until(() => server.streams().open === 1);
  const b = watchStream(await open(server, "marker-token"));
  await until(() => a.how() !== "open");
  const c = watchStream(await open(server, "marker-token"));
  await until(() => b.how() !== "open");
  await sleep(50);
  expect(c.how()).toBe("open");
  expect(server.streams()).toEqual({ open: 1, desks: 1 });
  await c.cancel();
  await until(() => server.streams().open === 0);
  expect(server.streams()).toEqual({ open: 0, desks: 0 });
  await server.close();
});

test("3. a cut slow reader's socket is destroyed, not politely ended, and the writer goes quiet", async () => {
  const desk = createPrincipalDesk({ channel: createFakeChannel(), rank: () => 0, log: () => {} });
  // maxBuffer -1: the first marker written is already "too much", so the cut happens at once
  const server = await serve(desk, { streamMaxBuffer: -1 });
  const s = watchStream(await open(server, "owner-token"));
  await until(() => s.how() !== "open");
  expect(s.how()).toBe("cut"); // an abrupt end (no closing chunk), as a destroyed socket gives
  await until(() => server.streams().open === 0);
  await server.close();

  // and the writer, once closed, writes nothing more, even on a drain
  const writes: string[] = [];
  let drain = () => {};
  const res = { full: true, write(c: string) { writes.push(c); return !this.full; }, writableLength: 0, on(_e: "drain", l: () => void) { drain = l; } };
  const w = createStreamWriter(res, { maxBuffer: 1000, stallMs: 1000, abandon: () => {} });
  w.marker("m1");
  w.marker("m2"); // held
  w.close();
  drain();
  w.marker("m3");
  expect(writes).toEqual(["m1"]);
});

test("4. revisions stay above the old desk's across a restart, even with the clock fixed or gone back", async () => {
  let saved = 0;
  const store = { load: () => saved, save: (n: number) => void (saved = n) };
  const channel = createFakeChannel();
  // a fixed clock and many changes: the old counter runs far past the clock
  const old = createPrincipalDesk({ channel, rank: () => 0, log: () => {}, now: () => 1000, revisionStore: store });
  channel.open(1000, tel());
  let top = 0;
  for (let i = 0; i < 2500; i++) {
    channel.mail(`line ${i}`, 1001 + i);
    await old.observe(await channel.readState());
    top = old.marker().rev!;
  }
  expect(top).toBeGreaterThan(3000); // well past the clock value
  // restart: the clock is the same, or earlier; the new desk still starts above everything issued
  for (const clock of [1000, 1001, 400]) {
    const fresh = createPrincipalDesk({ channel: createFakeChannel(), rank: () => 0, log: () => {}, now: () => clock, revisionStore: store });
    expect(fresh.marker().rev!).toBeGreaterThan(top);
  }
  // a store that throws does not break the desk
  const broken = createPrincipalDesk({
    channel: createFakeChannel(), rank: () => 0, log: () => {}, now: () => 5,
    revisionStore: { load: () => { throw new Error("no file"); }, save: () => { throw new Error("read-only"); } },
  });
  expect(broken.marker().rev!).toBeGreaterThan(5);
});
