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

test("Task 62: a paired town's rank is its own town's entitlement, and two towns with different ranks never share one", async () => {
  const clock = { t: 1_000_000 };
  const ranks: Record<string, number | undefined> = { [A]: 8, [B]: 2 };
  const channels = new Map<string, FakeChannel>();
  const registry = createTenantRegistry({
    channelFor: (vk) => {
      const fake = createFakeChannel();
      channels.set(vk, fake);
      return {
        ...fake,
        directions: undefined,
        readState: async () => ({ ...(await fake.readState()), ...(ranks[vk] === undefined ? {} : { entitlement: { rank: ranks[vk]! } }) }),
        readInbox: (s: number) => fake.readInbox(s),
        readFrame: (i?: number) => fake.readFrame(i),
        direct: (d) => fake.direct(d),
        setComposing: (o: boolean) => fake.setComposing(o),
        readPack: () => fake.readPack(),
      } as never;
    },
    claimMs: 3 * 60 * 1000,
    idleMs: 15 * 60 * 1000,
    now: () => clock.t,
  });
  const deskA = registry.deskFor(A);
  const deskB = registry.deskFor(B);
  channels.get(A)!.open(clock.t);
  channels.get(B)!.open(clock.t);
  await registry.observeAll();
  const line = (text: string) => ({ direction: { kind: "speak", text } });
  const said = (c: FakeChannel) => c.directions.filter((d) => d.direction.kind === "speak").map((d) => (d.direction as { text: string }).text);
  await deskA.wake(line("Kiss me by the lake."));
  await deskB.wake(line("Kiss me by the lake."));
  await deskA.wake(line("Let us make love tonight."));
  await registry.pumpAll();
  // Rank 8 town: the tender kiss is carried; rank 2 town: it is not; explicit in neither.
  expect(said(channels.get(A)!)).toContain("Kiss me by the lake.");
  expect(said(channels.get(B)!).join(" ")).not.toContain("Kiss me by the lake.");
  expect(said(channels.get(A)!).join(" ")).not.toContain("make love");
  // A town that gives no entitlement stays at rank 0.
  ranks[B] = undefined;
  await registry.observeAll();
  await deskB.wake(line("Kiss me again."));
  await registry.pumpAll();
  expect(said(channels.get(B)!).join(" ")).not.toContain("Kiss me again.");
});

// Task 63: expiring, revocable principal capabilities.
import { createCipheriv, randomBytes } from "node:crypto";
import { PAIRED_TOKEN_AUDIENCE, readPairedToken, resolvePairedToken } from "./tenants.js";

const sealRaw = (key: Buffer, payload: unknown): string => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(typeof payload === "string" ? payload : JSON.stringify(payload), "utf8"), c.final()]);
  return PAIRED_TOKEN_PREFIX + Buffer.concat([iv, body, c.getAuthTag()]).toString("base64url");
};

test("Task 63: a token carries town, id, issue and expiry times, audience and generation; expired, legacy and foreign-audience tokens are refused", () => {
  const key = sealKey({ directorToken: DIRECTOR });
  const t0 = 1_000_000;
  const token = sealVisitorKey(key, A, { generation: 4, ttlMs: 1000, now: t0 });
  const claim = readPairedToken(key, token, t0 + 10)!;
  expect(claim).toMatchObject({ visitorToken: A, generation: 4, issuedAt: t0, expiresAt: t0 + 1000 });
  expect(claim.tokenId).toMatch(/^[0-9a-f]{16}$/);
  expect(sealVisitorKey(key, A, { now: t0 })).not.toBe(sealVisitorKey(key, A, { now: t0 }));
  // Expired.
  expect(readPairedToken(key, token, t0 + 1000)).toBeNull();
  expect(unsealVisitorKey(key, token, t0 + 5000)).toBeNull();
  // The old v1 shape (the bare visitor key) is refused: it never expired.
  expect(readPairedToken(key, sealRaw(key, A), t0)).toBeNull();
  // Another audience, version, or a missing field.
  const good = { v: 2, vk: A, tid: "ab", iat: t0, exp: t0 + 1000, aud: PAIRED_TOKEN_AUDIENCE, gen: 0 };
  expect(readPairedToken(key, sealRaw(key, good), t0)).not.toBeNull();
  expect(readPairedToken(key, sealRaw(key, { ...good, aud: "someone-else" }), t0)).toBeNull();
  expect(readPairedToken(key, sealRaw(key, { ...good, v: 3 }), t0)).toBeNull();
  expect(readPairedToken(key, sealRaw(key, { ...good, gen: undefined }), t0)).toBeNull();
  expect(readPairedToken(key, sealRaw(key, { ...good, iat: t0 + 10 * 60_000 }), t0)).toBeNull();
});

test("Task 63: re-pairing retires the old token and a disconnect retires them all; an unreachable town fails closed", async () => {
  const key = sealKey({ directorToken: DIRECTOR });
  const clock = { t: 5_000_000 };
  // The town holds each town's generation; the registry reads it with the state.
  const generation: Record<string, number> = { [A]: 1, [B]: 1 };
  let townUp = true;
  const registry = createTenantRegistry({
    channelFor: (vk) => {
      const fake = createFakeChannel();
      return { ...fake, readState: async () => { if (!townUp) throw new Error("down"); return { ...(await fake.readState()), entitlement: { rank: 0, pairingGeneration: generation[vk] ?? 0 } }; } } as never;
    },
    claimMs: 1000,
    now: () => clock.t,
  });
  const resolve = (token: string) => resolvePairedToken({ key, registry, presented: token, now: () => clock.t });
  const first = sealVisitorKey(key, A, { generation: 1, now: clock.t });
  expect(await resolve(first)).not.toBeNull();
  // Pair again: the town moves to generation 2 and seals the new token with it.
  clock.t += 5000;
  generation[A] = 2;
  const second = sealVisitorKey(key, A, { generation: 2, now: clock.t });
  expect(await resolve(first)).toBeNull();
  expect(await resolve(second)).not.toBeNull();
  // Another town's token is untouched by A's re-pairing.
  expect(await resolve(sealVisitorKey(key, B, { generation: 1, now: clock.t }))).not.toBeNull();
  // The visitor disconnects (the town moves on again): both A tokens are refused.
  clock.t += 5000;
  generation[A] = 3;
  expect(await resolve(second)).toBeNull();
  // Expiry is checked with the clock.
  clock.t += 100 * 86_400_000;
  expect(await resolve(sealVisitorKey(key, B, { generation: 1, now: clock.t - 100 * 86_400_000 }))).toBeNull();
  // An unreachable town reads as refused, never as allowed.
  townUp = false;
  clock.t += 10_000;
  expect(await resolve(sealVisitorKey(key, B, { generation: 1, now: clock.t }))).toBeNull();
});

test("Task 63: the server refuses a revoked principal token", async () => {
  const key = sealKey({ directorToken: DIRECTOR });
  const generation = { A: 1 };
  const registry = createTenantRegistry({
    channelFor: () => {
      const fake = createFakeChannel();
      return { ...fake, readState: async () => ({ ...(await fake.readState()), entitlement: { rank: 0, pairingGeneration: generation.A } }) } as never;
    },
    claimMs: 1000,
  });
  const server = await startPrincipalServer({
    desk: null,
    token: null,
    resolve: (presented) => resolvePairedToken({ key, registry, presented }),
    port: 0,
    host: "127.0.0.1",
    log: () => {},
  });
  const token = sealVisitorKey(key, A, { generation: 1 });
  const waiting = () => fetch(`http://127.0.0.1:${server.port}/principal/waiting`, { headers: { authorization: `Bearer ${token}` } });
  expect((await waiting()).status).toBe(200);
  generation.A = 2; // the visitor disconnected
  await new Promise((r) => setTimeout(r, 3100)); // the bridge's 3 s look at the town
  expect((await waiting()).status).toBe(401);
  await server.close();
});
