import { expect, test } from "bun:test";
import { HOSTED_BRIDGE_URL, museConnectMessage, checkPairing, connectMuseMenuItem, pairingRow, probePairing, requestPairCode, startPairingCheck, type PairingState } from "./connectMuse";

// Task 29: the town side of Connect my Muse.

test("the message carries the code, the bridge and the repo, and never the visitor key", () => {
  const text = museConnectMessage("ABCDE-FGH23");
  expect(text).toContain('{"code":"ABCDE-FGH23"}');
  expect(text).toContain(`${HOSTED_BRIDGE_URL}/pair`);
  expect(text).toContain("bridge/README.md");
  expect(text).toContain("never write it in our chat");
  expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
});

test("the code is asked of the town's own origin with the visitor key as the bearer", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const fake = (async (url: string, init?: RequestInit) => {
    seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
    return new Response(JSON.stringify({ code: "ABCDE-FGH23", expiresAt: 123 }), { status: 200 });
  }) as unknown as typeof fetch;
  const got = await requestPairCode("https://town.test", () => "visitor-key-0000000000001", fake);
  expect(got).toEqual({ code: "ABCDE-FGH23", expiresAt: 123 });
  expect(seen).toEqual([{ url: "https://town.test/bridge/pair", auth: "Bearer visitor-key-0000000000001" }]);
  const refused = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
  await expect(requestPairCode("https://town.test", () => "k", refused)).rejects.toThrow("HTTP 401");
});

const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const noSleep = async () => {};

test("probe: 200 pairing:true is yes, 404 or other 200 is a definite no, anything else is an error", async () => {
  const f = (r: () => Response | Promise<Response>) => (async () => r()) as unknown as typeof fetch;
  expect(await probePairing(f(() => res(200, { pairing: true })))).toBe("yes");
  expect(await probePairing(f(() => res(404)))).toBe("no");
  expect(await probePairing(f(() => res(200, { ok: true })))).toBe("no");
  expect(await probePairing(f(() => res(503)))).toBe("error");
  expect(await probePairing(f(() => { throw new Error("offline"); }))).toBe("error");
});

test("check: a failed first ask is retried and a later success shows the row", async () => {
  let calls = 0;
  const f = (async () => (++calls < 3 ? res(502) : res(200, { pairing: true }))) as unknown as typeof fetch;
  const pauses: number[] = [];
  expect(await checkPairing({ fetchImpl: f, sleep: async (ms) => void pauses.push(ms) })).toBe("live");
  expect(calls).toBe(3);
  expect(pauses).toEqual([2000, 5000]);
});

test("check: a timeout is retried, with a budget longer than one 6 s attempt", async () => {
  let calls = 0;
  const f = ((_u: string, init?: RequestInit) => {
    calls++;
    if (calls === 1) return new Promise((_r, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("timeout"))));
    return Promise.resolve(res(200, { pairing: true }));
  }) as unknown as typeof fetch;
  expect(await checkPairing({ fetchImpl: f, sleep: noSleep, timeoutMs: 20 })).toBe("live");
  expect(calls).toBe(2);
});

test("check: persistent failure ends unavailable after a bounded number of asks", async () => {
  let calls = 0;
  const f = (async () => { calls++; throw new Error("offline"); }) as unknown as typeof fetch;
  expect(await checkPairing({ fetchImpl: f, sleep: noSleep })).toBe("unavailable");
  expect(calls).toBe(4);
});

test("check: a definite no is not retried and hides the row", async () => {
  let calls = 0;
  const f = (async () => { calls++; return res(404); }) as unknown as typeof fetch;
  expect(await checkPairing({ fetchImpl: f, sleep: noSleep })).toBe("absent");
  expect(calls).toBe(1);
});

test("probe: a 200 whose body is null, not an object, or unreadable; other statuses; a stalled body", async () => {
  const f = (r: () => Response | Promise<Response>) => (async () => r()) as unknown as typeof fetch;
  const raw = (status: number, text: string) => new Response(text, { status });
  expect(await probePairing(f(() => raw(200, "null")))).toBe("no");
  expect(await probePairing(f(() => raw(200, "false")))).toBe("no");
  expect(await probePairing(f(() => raw(200, "7")))).toBe("no");
  expect(await probePairing(f(() => raw(200, '{"pairing":"true"}')))).toBe("no");
  expect(await probePairing(f(() => raw(200, "<html>")))).toBe("error");
  expect(await probePairing(f(() => raw(200, "")))).toBe("error");
  for (const status of [429, 500, 502, 503]) expect(await probePairing(f(() => raw(status, "{}")))).toBe("error");
  // headers arrive, the body never does: the timeout aborts the read
  const stalled = ((_u: string, init?: RequestInit) =>
    Promise.resolve({
      status: 200,
      json: () => new Promise((_r, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted")))),
    })) as unknown as typeof fetch;
  expect(await probePairing(stalled, 20)).toBe("error");
});

test("check: cancellation stops further asks and reports unavailable", async () => {
  let calls = 0;
  let stop = false;
  const f = (async () => { calls++; return res(503); }) as unknown as typeof fetch;
  const out = await checkPairing({ fetchImpl: f, sleep: async () => void (stop = true), cancelled: () => stop });
  expect(out).toBe("unavailable");
  expect(calls).toBe(1);
});

test("check: the retry budget is four asks with 2/5/10 s pauses (57 s nominal worst case)", async () => {
  const pauses: number[] = [];
  const f = (async () => res(500)) as unknown as typeof fetch;
  expect(await checkPairing({ fetchImpl: f, sleep: async (ms) => void pauses.push(ms) })).toBe("unavailable");
  expect(pauses).toEqual([2000, 5000, 10000]);
  expect(4 * 10000 + pauses.reduce((a, b) => a + b, 0)).toBe(57000);
});

test("the menu row texts: visible while checking and when unavailable, absent when off", () => {
  expect(pairingRow("off")).toBeNull();
  expect(pairingRow("checking")?.busy).toBe(true);
  expect(pairingRow("unavailable")?.detail).toBe("Could not check whether pairing is ready. Tap to try again.");
  expect(pairingRow("unavailable")?.detail).not.toContain("reach");
  expect(pairingRow("live")?.detail).toContain("one-time code");
});

test("the hook's effect: not hosted never asks and shows no row; hosted goes checking, then live, hidden or unavailable", async () => {
  const run = async (hosted: boolean, result: "live" | "absent" | "unavailable") => {
    const seen: PairingState[] = [];
    let asked = 0;
    const check = (async () => { asked++; return result; }) as unknown as typeof import("./connectMuse").checkPairing;
    startPairingCheck(hosted, (s) => seen.push(s), check);
    await Promise.resolve();
    await Promise.resolve();
    return { seen, asked };
  };
  expect(await run(false, "live")).toEqual({ seen: [], asked: 0 });
  expect(await run(true, "live")).toEqual({ seen: ["checking", "live"], asked: 1 });
  expect(await run(true, "absent")).toEqual({ seen: ["checking", "off"], asked: 1 });
  expect(await run(true, "unavailable")).toEqual({ seen: ["checking", "unavailable"], asked: 1 });
});

test("the hook's effect: cleanup cancels, and a cancelled check never sets state", async () => {
  const seen: PairingState[] = [];
  let release!: (r: "live") => void;
  let cancelled!: () => boolean;
  const check = ((o: { cancelled: () => boolean }) => { cancelled = o.cancelled; return new Promise((r) => (release = r as never)); }) as unknown as typeof import("./connectMuse").checkPairing;
  const stop = startPairingCheck(true, (s) => seen.push(s), check);
  expect(cancelled()).toBe(false);
  stop();
  expect(cancelled()).toBe(true);
  release("live");
  await Promise.resolve();
  await Promise.resolve();
  expect(seen).toEqual(["checking"]);
});

test("the menu item: what each state shows and what a tap does, including tap to retry", () => {
  const calls: string[] = [];
  const h = { openConnectMuse: () => void calls.push("open"), retryPairing: () => void calls.push("retry") };
  expect(connectMuseMenuItem("off", h, false)).toBeNull();
  const checking = connectMuseMenuItem("checking", h, false)!;
  checking.action();
  expect(checking.detail).toContain("Checking");
  const bad = connectMuseMenuItem("unavailable", h, false)!;
  expect(bad.detail).toContain("Could not check whether pairing is ready");
  expect(bad.aria).not.toContain("reached");
  bad.action();
  const live = connectMuseMenuItem("live", h, false)!;
  live.action();
  expect(calls).toEqual(["retry", "open"]);
  expect(live.active).toBe(false);
  expect(connectMuseMenuItem("live", h, true)!.active).toBe(true);
  expect(connectMuseMenuItem("unavailable", h, true)!.active).toBe(false);
});

test("Task 63: disconnect is a POST to the town's own origin with the visitor key as the bearer; a refusal throws", async () => {
  const { disconnectMuse } = await import("./connectMuse");
  const seen: { url: string; method?: string; auth: string | null }[] = [];
  const ok = (async (url: string, init?: RequestInit) => {
    seen.push({ url, method: init?.method, auth: new Headers(init?.headers).get("authorization") });
    return new Response(JSON.stringify({ ok: true, generation: 3 }), { status: 200 });
  }) as unknown as typeof fetch;
  await disconnectMuse("https://town.test", () => "visitor-key-0000000000001", ok);
  expect(seen).toEqual([{ url: "https://town.test/bridge/disconnect", method: "POST", auth: "Bearer visitor-key-0000000000001" }]);
  const refused = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
  await expect(disconnectMuse("https://town.test", () => "k", refused)).rejects.toThrow("HTTP 401");
});
