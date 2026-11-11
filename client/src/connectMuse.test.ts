import { expect, test } from "bun:test";
import { HOSTED_BRIDGE_URL, museConnectMessage, checkPairing, pairingRow, probePairing, requestPairCode } from "./connectMuse";

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

test("the menu row is visible while checking and when unavailable, absent when off", () => {
  expect(pairingRow("off")).toBeNull();
  expect(pairingRow("checking")?.busy).toBe(true);
  expect(pairingRow("unavailable")?.detail).toContain("try again");
  expect(pairingRow("live")?.detail).toContain("one-time code");
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
