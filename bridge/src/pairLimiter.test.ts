import { expect, test } from "bun:test";
import { createPairLimiter, trustProxyFromEnv } from "./pairLimiter.js";
import { startPrincipalServer } from "./principalServer.js";

test("slots are reserved before the upstream call: concurrent guesses cannot pass the same empty counter", () => {
  const lim = createPairLimiter({ missesPerSource: 3, inFlightPerSource: 10, now: () => 0 });
  // Ten attempts start at once, none has settled: only three get a slot.
  const slots = Array.from({ length: 10 }, () => lim.reserve("a"));
  expect(slots.filter((s) => s.ok).length).toBe(3);
  expect(slots.find((s) => !s.ok)).toEqual({ ok: false, reason: "misses" });
});

test("in-flight attempts are limited per source and overall", () => {
  const lim = createPairLimiter({ inFlightPerSource: 2, inFlightTotal: 3, now: () => 0 });
  expect(lim.reserve("a").ok).toBe(true);
  expect(lim.reserve("a").ok).toBe(true);
  expect(lim.reserve("a")).toEqual({ ok: false, reason: "in-flight" });
  expect(lim.reserve("b").ok).toBe(true);
  expect(lim.reserve("c")).toEqual({ ok: false, reason: "busy" });
});

test("a successful pairing refunds the miss budget but has its own limit; a failed upstream gives the slot back", () => {
  const lim = createPairLimiter({ missesPerSource: 1, successesPerSource: 2, now: () => 0 });
  const r = (who: string) => lim.reserve(who) as Extract<ReturnType<typeof lim.reserve>, { ok: true }>;
  r("a").settle("success");
  r("a").settle("success");
  expect(lim.reserve("a")).toEqual({ ok: false, reason: "successes" });
  r("b").settle("release");
  r("b").settle("release");
  expect(lim.reserve("b").ok).toBe(true);
});

test("a flood of sources never clears an existing count, and the map stays bounded", () => {
  const lim = createPairLimiter({ missesPerSource: 1, maxSources: 50, missesTotal: 1_000_000, inFlightTotal: 1_000_000, now: () => 0 });
  const first = lim.reserve("victim") as Extract<ReturnType<typeof lim.reserve>, { ok: true }>;
  first.settle("miss");
  for (let i = 0; i < 49; i++) (lim.reserve(`s${i}`) as Extract<ReturnType<typeof lim.reserve>, { ok: true }>).settle("miss");
  expect(lim.sources()).toBe(50);
  for (let i = 0; i < 500; i++) (lim.reserve(`flood${i}`) as Extract<ReturnType<typeof lim.reserve>, { ok: true }>).settle("miss");
  expect(lim.sources()).toBeLessThanOrEqual(50);
});

test("misses expire with the window", () => {
  let t = 0;
  const lim = createPairLimiter({ missesPerSource: 1, windowMs: 1000, now: () => t });
  (lim.reserve("a") as Extract<ReturnType<typeof lim.reserve>, { ok: true }>).settle("miss");
  expect(lim.reserve("a").ok).toBe(false);
  t = 1500;
  expect(lim.reserve("a").ok).toBe(true);
});

test("proxy headers are trusted only where configured", () => {
  expect(trustProxyFromEnv({})).toBe(false);
  expect(trustProxyFromEnv({ TRUST_PROXY: "1" })).toBe(true);
  expect(trustProxyFromEnv({ RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(true);
  expect(trustProxyFromEnv({ RAILWAY_ENVIRONMENT_NAME: "production", TRUST_PROXY: "0" })).toBe(false);
});

test("on the server, a forged X-Real-IP does not bypass the limiter unless a proxy is trusted; and forging many addresses meets the overall ceiling", async () => {
  const make = (trustProxy: boolean) =>
    startPrincipalServer({
      desk: null,
      token: null,
      pair: async () => ({ ok: false, status: 404, error: "unknown" }),
      trustProxy,
      pairLimits: { missesPerSource: 3, missesTotal: 6 },
      port: 0,
      host: "127.0.0.1",
      log: () => {},
    });
  const post = (port: number, ip: string) => fetch(`http://127.0.0.1:${port}/pair`, { method: "POST", headers: { "x-real-ip": ip }, body: JSON.stringify({ code: "WRONG-CODE0" }) });
  // Not trusted: rotating the header changes nothing, the socket is the caller.
  const closed = await make(false);
  const codes: number[] = [];
  for (let i = 0; i < 5; i++) codes.push((await post(closed.port, `198.51.100.${i}`)).status);
  expect(codes).toEqual([404, 404, 404, 429, 429]);
  await closed.close();
  // Trusted but forged: each fake address gets its own three, yet the overall ceiling holds.
  const open = await make(true);
  const seen: number[] = [];
  for (let i = 0; i < 10; i++) seen.push((await post(open.port, `203.0.113.${i}`)).status);
  expect(seen.filter((s) => s === 404).length).toBe(6);
  expect(seen.slice(6).every((s) => s === 429)).toBe(true);
  await open.close();
});
