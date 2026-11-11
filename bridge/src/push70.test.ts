import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeChannel } from "./fakeChannel.js";
import { createPrincipalDesk } from "./principal.js";
import { fileRevisionStore, tenantRevisionPath } from "./revisionFiles.js";
import type { VisitTelemetry } from "../../shared/visitProtocol.js";
import { createTenantRegistry } from "./tenants.js";

// Task 70: paired-desk revision persistence, and timing through same-line coalescing.

const tel = (): VisitTelemetry => ({
  museZone: "tree", gaiusZone: "tree", museSeated: false, gaiusSeated: false, gaiusWalking: false, dayPhase: "day",
  museX: 0, museZ: 0, gaiusX: 1, gaiusZ: 0, museHeading: 0, gaiusHeading: 0, bearingToGaius: 0, distanceToGaius: 1, pad2Source: "none",
});

const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

function memStores() {
  const disk = new Map<string, number>();
  const calls: string[] = [];
  return {
    disk,
    calls,
    revisionStoreFor: (id: string) => {
      calls.push(id);
      return { load: () => disk.get(id) ?? 0, save: (n: number) => void disk.set(id, n) };
    },
  };
}

function world(extra: Partial<Parameters<typeof createTenantRegistry>[0]> = {}, clock = { t: 1_000_000 }) {
  const channels = new Map<string, ReturnType<typeof createFakeChannel>>();
  const registry = createTenantRegistry({
    channelFor: (vk) => {
      const c = createFakeChannel();
      channels.set(vk, c);
      return c;
    },
    claimMs: 180_000,
    idleMs: 60_000,
    now: () => clock.t,
    ...extra,
  });
  return { clock, channels, registry };
}

async function churn(w: ReturnType<typeof world>, vk: string, n: number) {
  const desk = w.registry.deskFor(vk);
  const ch = w.channels.get(vk)!;
  ch.open(1000, tel());
  for (let i = 0; i < n; i++) {
    ch.mail(`line ${i}`, 1001 + i);
    await w.registry.observeAll();
    desk.marker(); // a rev is issued when the marker is read (a stream's subscriber does this)
  }
  return desk.marker().rev!;
}

test("1. a paired desk gets its own namespaced revision store, never another town's", async () => {
  const s = memStores();
  const w = world({ revisionStoreFor: s.revisionStoreFor });
  w.registry.deskFor(A);
  w.registry.deskFor(B);
  w.registry.deskFor(A);
  expect(s.calls.length).toBe(2);
  expect(new Set(s.calls).size).toBe(2);
  expect(s.calls.every((id) => /^[0-9a-f]{64}$/.test(id) && !id.includes(A) && !id.includes(B))).toBe(true);
  expect(s.disk.size).toBe(2); // each desk reserved its block under its own id
});

test("2. a paired desk recreated after idle eviction stays above its predecessor, with a fixed clock and no disk", async () => {
  const w = world({}, { t: 5000 }); // no store at all: the registry's memory mark carries it
  const top = await churn(w, A, 1500);
  expect(top).toBeGreaterThan(5000 + 1000);
  w.clock.t += 120_000; // idle past idleMs: the desk is dropped
  await w.registry.observeAll();
  expect(w.registry.size()).toBe(0);
  w.clock.t = 5000; // and the clock is back where it was, so only the kept mark carries the order
  expect(w.registry.deskFor(A).marker().rev!).toBeGreaterThan(top);
});

test("3. a paired desk survives a restart through the durable store, also with the clock gone back", async () => {
  const s = memStores();
  const first = world({ revisionStoreFor: s.revisionStoreFor }, { t: 5000 });
  const top = await churn(first, A, 1500);
  const second = world({ revisionStoreFor: s.revisionStoreFor }, { t: 100 });
  expect(second.registry.deskFor(A).marker().rev!).toBeGreaterThan(top);
  // another town is unaffected by A's mark
  expect(second.registry.deskFor(B).marker().rev!).toBeLessThan(top);
});

test("4. a throwing or missing tenant store never breaks the desk", () => {
  const w = world({ revisionStoreFor: () => { throw new Error("no disk"); } });
  expect(w.registry.deskFor(A).marker().rev!).toBeGreaterThan(0);
  const w2 = world({ revisionStoreFor: () => ({ load: () => { throw new Error("x"); }, save: () => { throw new Error("y"); } }) });
  expect(w2.registry.deskFor(A).marker().rev!).toBeGreaterThan(0);
});

test("5. the file store writes atomically, reads back, and the tenant path holds only a digest", () => {
  const dir = mkdtempSync(join(tmpdir(), "rev70-"));
  try {
    const path = tenantRevisionPath(join(dir, "revision.json"), "ab".repeat(32));
    const store = fileRevisionStore(path);
    expect(store.load()).toBe(0);
    store.save(4321);
    expect(store.load()).toBe(4321);
    expect(readdirSync(join(dir, "revision.json.towns"))).toEqual([`${"ab".repeat(32)}.json`]); // no stray .tmp
    expect(readFileSync(path, "utf8")).toBe('{"high":4321}');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

