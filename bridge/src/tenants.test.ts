import { expect, test } from "bun:test";
import { createFakeChannel, type FakeChannel } from "./fakeChannel.js";
import { createPrincipalDesk } from "./principal.js";
import { DEFAULT_PAIR_LIMITS, startPrincipalServer } from "./principalServer.js";
import { createTenantRegistry, PAIRED_TOKEN_PREFIX, sealKey, sealVisitorKey, unsealVisitorKey } from "./tenants.js";

// Task 29: many towns, each with its own Muse.

const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const OWNER = "cccccccc-3333-4333-8333-cccccccccccc";
const DIRECTOR = "director-secret-for-tests-0001";

test("a paired token unseals to its own town only; an edit, another key or a plain string reads as nothing", () => {
  const key = sealKey({ directorToken: DIRECTOR });
  const tokenA = sealVisitorKey(key, A);
  expect(tokenA.startsWith(PAIRED_TOKEN_PREFIX)).toBe(true);
  expect(tokenA).not.toContain(A);
  expect(unsealVisitorKey(key, tokenA)).toBe(A);
  // Two seals of one town differ (fresh IV), both read.
  expect(sealVisitorKey(key, A)).not.toBe(tokenA);
  // Tampered: flip one character in the body.
  const body = tokenA.slice(PAIRED_TOKEN_PREFIX.length);
  const flipped = PAIRED_TOKEN_PREFIX + (body[3] === "A" ? "B" : "A") + body.slice(1, 3) + body.slice(3);
  expect(unsealVisitorKey(key, PAIRED_TOKEN_PREFIX + body.slice(0, 10) + (body[10] === "x" ? "y" : "x") + body.slice(11))).toBeNull();
  expect(unsealVisitorKey(key, flipped === tokenA ? "nope" : flipped)).toBeNull();
  // Another bridge (another secret) cannot read it.
  expect(unsealVisitorKey(sealKey({ directorToken: "another-director" }), tokenA)).toBeNull();
  expect(unsealVisitorKey(sealKey({ pairingSecret: "s", directorToken: DIRECTOR }), tokenA)).toBeNull();
  expect(unsealVisitorKey(key, "not-a-token")).toBeNull();
  expect(unsealVisitorKey(key, null)).toBeNull();
});

function world() {
  const clock = { t: 1_000_000 };
  const channels = new Map<string, FakeChannel>();
  const logs: string[] = [];
  const registry = createTenantRegistry({
    channelFor: (vk) => {
      const c = createFakeChannel();
      channels.set(vk, c);
      return c;
    },
    claimMs: 3 * 60 * 1000,
    idleMs: 15 * 60 * 1000,
    now: () => clock.t,
    log: (l) => logs.push(l),
  });
  return { clock, channels, registry, logs };
}

test("two paired towns keep their own desks: a line in one never reaches the other", async () => {
  const { clock, channels, registry, logs } = world();
  const deskA = registry.deskFor(A);
  const deskB = registry.deskFor(B);
  expect(registry.deskFor(A)).toBe(deskA);
  expect(deskA).not.toBe(deskB);
  const chA = channels.get(A)!;
  const chB = channels.get(B)!;
  chA.open(clock.t);
  chB.open(clock.t);
  chA.mail("Hello from town A", clock.t);
  await registry.observeAll();
  expect(deskA.marker().waiting).toBe(true);
  expect(deskB.marker().waiting).toBe(false);
  const slateA = await deskA.wake({ direction: { kind: "speak", text: "Only for A." } });
  expect(slateA.ok).toBe(true);
  await registry.pumpAll();
  const spoken = (c: FakeChannel) => c.directions.filter((d) => d.direction.kind === "speak").map((d) => (d.direction as { text: string }).text);
  expect(spoken(chA)).toContain("Only for A.");
  expect(spoken(chB)).toEqual([]);
  // B's slate shows none of A's lines.
  const slateB = await deskB.wake({});
  expect(JSON.stringify(slateB)).not.toContain("Hello from town A");
  expect(JSON.stringify(slateB)).not.toContain("Only for A.");
  // Logs name towns by a label, never by key.
  for (const line of logs) {
    expect(line).not.toContain(A);
    expect(line).not.toContain(B);
  }
});

test("a quiet town is dropped after the idle time, and wakes again on its next call", async () => {
  const { clock, registry } = world();
  registry.deskFor(A);
  expect(registry.size()).toBe(1);
  clock.t += 16 * 60 * 1000;
  await registry.observeAll();
  expect(registry.size()).toBe(0);
  registry.deskFor(A);
  expect(registry.size()).toBe(1);
});

test("the server: the owner's token reaches the owner's desk, a paired token its own town, the marker token never a paired town; /pair hands out a token", async () => {
  const key = sealKey({ directorToken: DIRECTOR });
  const { clock, channels, registry } = world();
  const ownerChannel = createFakeChannel();
  ownerChannel.open(clock.t);
  const ownerDesk = createPrincipalDesk({ channel: ownerChannel, rank: () => 0, now: () => clock.t });
  const lines: string[] = [];
  const server = await startPrincipalServer({
    desk: ownerDesk,
    token: "owner-principal-token",
    markerToken: "owner-marker-token",
    resolve: (presented) => {
      const vk = unsealVisitorKey(key, presented);
      if (!vk) return null;
      return vk === OWNER ? ownerDesk : registry.deskFor(vk);
    },
    pair: async (code) => (code === "GOODC-ODE22" ? { ok: true, principalToken: sealVisitorKey(key, A) } : { ok: false, status: 404, error: "that code is unknown or has expired" }),
    port: 0,
    host: "127.0.0.1",
    log: (l) => lines.push(l),
  });
  const at = (path: string) => `http://127.0.0.1:${server.port}${path}`;
  const bearer = (t: string) => ({ authorization: `Bearer ${t}`, "content-type": "application/json" });
  // Pairing: the capability answer the town asks for, then a code.
  expect(await (await fetch(at("/pair"))).json()).toEqual({ pairing: true });
  expect((await fetch(at("/pair"), { method: "POST", body: JSON.stringify({ code: "WRONG-CODE0" }) })).status).toBe(404);
  const paired = await fetch(at("/pair"), { method: "POST", body: JSON.stringify({ code: "GOODC-ODE22" }) });
  expect(paired.status).toBe(200);
  const { principalToken } = (await paired.json()) as { principalToken: string };
  expect(unsealVisitorKey(key, principalToken)).toBe(A);
  // The paired token wakes town A, not the owner's.
  const wakeA = await fetch(at("/principal/wake"), { method: "POST", headers: bearer(principalToken), body: JSON.stringify({ direction: { kind: "intend", text: "Town A only." } }) });
  expect(wakeA.status).toBe(200);
  expect(registry.size()).toBe(1);
  expect(ownerDesk.live()).toBe(false);
  expect(channels.get(A)).toBeDefined();
  // The owner's token still reaches the owner's desk.
  expect((await fetch(at("/principal/wake"), { method: "POST", headers: bearer("owner-principal-token"), body: "{}" })).status).toBe(200);
  expect(ownerDesk.live()).toBe(true);
  // A paired token for the owner's own town reaches the owner's desk.
  const ownerPaired = sealVisitorKey(key, OWNER);
  expect((await fetch(at("/principal/waiting"), { headers: bearer(ownerPaired) })).status).toBe(200);
  expect(registry.size()).toBe(1);
  // The marker token cannot wake anyone, and garbage is refused.
  expect((await fetch(at("/principal/wake"), { method: "POST", headers: bearer("owner-marker-token"), body: "{}" })).status).toBe(401);
  expect((await fetch(at("/principal/waiting"), { headers: bearer("mtp1.garbage") })).status).toBe(401);
  await server.close();
  expect(lines.join("\n")).not.toContain(principalToken);
  expect(lines.join("\n")).not.toContain(A);
});

test("/pair limits wrong codes per caller: a guesser is refused, another caller still pairs", async () => {
  const key = sealKey({ directorToken: DIRECTOR });
  const lines: string[] = [];
  const server = await startPrincipalServer({
    desk: null,
    token: null,
    pair: async (code) => (code === "GOODC-ODE22" ? { ok: true, principalToken: sealVisitorKey(key, A) } : { ok: false, status: 404, error: "unknown" }),
    trustProxy: true,
    port: 0,
    host: "127.0.0.1",
    log: (l) => lines.push(l),
  });
  const pair = (code: string, realIp: string, forwarded = "1.2.3.4") =>
    fetch(`http://127.0.0.1:${server.port}/pair`, { method: "POST", headers: { "x-real-ip": realIp, "x-forwarded-for": forwarded }, body: JSON.stringify({ code }) });
  for (let i = 0; i < DEFAULT_PAIR_LIMITS.missesPerSource; i++) expect((await pair("WRONG-CODE0", "203.0.113.7", `10.0.0.${i}`)).status).toBe(404);
  // The guesser is now refused, even with the right code...
  expect((await pair("GOODC-ODE22", "203.0.113.7")).status).toBe(429);
  // ...and no X-Forwarded-For value, however varied, escapes it: only X-Real-IP counts.
  expect((await pair("WRONG-CODE0", "203.0.113.7", "198.51.100.99, 198.51.100.20")).status).toBe(429);
  // Someone else pairs as normal, even while forging the guesser's X-Forwarded-For.
  expect((await pair("GOODC-ODE22", "198.51.100.20", "203.0.113.7")).status).toBe(200);
  // Without X-Real-IP the socket address is the caller (a different source from the two above).
  const bare = await fetch(`http://127.0.0.1:${server.port}/pair`, { method: "POST", headers: { "x-forwarded-for": "203.0.113.7" }, body: JSON.stringify({ code: "GOODC-ODE22" }) });
  expect(bare.status).toBe(200);
  await server.close();
  expect(lines.join("\n")).not.toContain("203.0.113.7");
});
