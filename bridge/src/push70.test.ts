import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeChannel } from "./fakeChannel.js";
import { createPrincipalDesk } from "./principal.js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync as rf, writeFileSync as wf } from "node:fs";
import { fileRevisionStore, tenantRevisionPath } from "./revisionFiles.js";
import type { VisitTelemetry } from "../../shared/visitProtocol.js";
import { createLineTimer, createStreamWriter } from "./streamGuard.js";
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

test("5b. a failed replacement keeps the previous valid file (temp write, then rename)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rev72-"));
  try {
    const path = join(dir, "m.json");
    fileRevisionStore(path).save(100);
    const seen: string[] = [];
    // failure during the rename: the whole temp file was written, the target must be untouched
    const failRename = fileRevisionStore(path, { writeFileSync: (p: any, d: any) => (seen.push(String(p)), wf(p, d)), renameSync: () => { throw new Error("EXDEV"); } } as any);
    expect(() => failRename.save(200)).toThrow("EXDEV");
    expect(seen).toEqual([`${path}.tmp`]); // written beside, never to the target itself
    expect(fileRevisionStore(path).load()).toBe(100);
    expect(existsSync(`${path}.tmp`)).toBe(false);
    // failure mid-write: half the bytes reach the temp file; the target is untouched
    const failWrite = fileRevisionStore(path, { writeFileSync: (p: any, d: any) => { wf(p, String(d).slice(0, 4)); throw new Error("ENOSPC"); }, renameSync: () => { throw new Error("not reached"); } } as any);
    expect(() => failWrite.save(300)).toThrow("ENOSPC");
    expect(rf(path, "utf8")).toBe('{"high":100}');
    expect(existsSync(`${path}.tmp`)).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("5c. end to end: the registry names a town's file by the sha256 of its key, and the key is nowhere on disk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rev72-"));
  try {
    const base = join(dir, "revision.json");
    const w = world({ revisionStoreFor: (id) => fileRevisionStore(tenantRevisionPath(base, id)) });
    await churn(w, A, 3);
    const names = readdirSync(`${base}.towns`);
    expect(names).toEqual([`${createHash("sha256").update(A).digest("hex")}.json`]);
    for (const n of names) expect(rf(join(`${base}.towns`, n), "utf8").includes(A)).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const filler = (i: number) => `filler-${i}-`.padEnd(30, "x");

test("2b. cache pressure (Codex's case): an awake or retained mark holds; an evicted one falls back to the clock", async () => {
  const noDisk = () => { throw new Error("no disk"); };
  // A is reserved first, then used last: with many towns about, its mark is not evicted ahead of idle ones
  const w = world({ revisionStoreFor: noDisk, markCap: 5 }, { t: 5000 });
  const top = await churn(w, A, 3);
  for (let i = 0; i < 20; i++) { w.registry.deskFor(filler(i)).marker(); w.clock.t += 1; }
  expect(w.registry.size()).toBe(21); // all awake: nothing awake is evicted, the cap yields to them
  w.registry.deskFor(A); // A is used last, so it is the most recently used mark
  w.clock.t += 61_000;
  await w.registry.observeAll(); // every desk idles out; marks trim back to the cap (5), the oldest first, A's kept
  expect(w.registry.size()).toBe(0);
  w.clock.t = 100;
  expect(w.registry.deskFor(A).marker().rev!).toBeGreaterThan(top);
});

test("2c. past the cap, the least recently used idle town's mark is the one dropped", async () => {
  const noDisk = () => { throw new Error("no disk"); };
  const w = world({ revisionStoreFor: noDisk, markCap: 3 }, { t: 5000 });
  const topA = await churn(w, A, 3);
  w.clock.t += 61_000;
  await w.registry.observeAll(); // A idles out
  expect(w.registry.size()).toBe(0);
  for (let i = 0; i < 4; i++) { w.registry.deskFor(filler(i)).marker(); w.clock.t += 1; await w.registry.observeAll(); }
  w.clock.t += 61_000;
  await w.registry.observeAll(); // fillers idle out; only 3 marks fit
  w.clock.t = 100;
  expect(w.registry.deskFor(A).marker().rev!).toBeLessThan(topA); // the stated fallback: the clock
});

test("2d. last-use order: A, B, then A used again; under pressure B loses its mark, A keeps its own", async () => {
  const noDisk = () => { throw new Error("no disk"); };
  const w = world({ revisionStoreFor: noDisk, markCap: 3 }, { t: 5000 });
  const topA = await churn(w, A, 3);
  const topB = await churn(w, B, 3);
  w.registry.deskFor(A); // an existing desk reused after B's reservation: A is now the most recently used
  w.clock.t += 61_000;
  await w.registry.observeAll(); // both idle out; marks kept in last-use order B, A
  expect(w.registry.size()).toBe(0);
  for (let i = 0; i < 2; i++) { w.registry.deskFor(filler(i)).marker(); w.clock.t += 1; await w.registry.observeAll(); w.clock.t += 61_000; await w.registry.observeAll(); }
  w.clock.t = 100;
  expect(w.registry.deskFor(A).marker().rev!).toBeGreaterThan(topA); // kept
  expect(w.registry.deskFor(B).marker().rev!).toBeLessThan(topB); // dropped: the clock fallback
});

test("2e. overflow recovers: after an awake burst idles out, retention returns to the cap, and holds under churn", async () => {
  const noDisk = () => { throw new Error("no disk"); };
  const w = world({ revisionStoreFor: noDisk, markCap: 3 }, { t: 5000 });
  const retainedOf = async (keys: string[], tops: number[]) => {
    w.clock.t = 100; // the clock fallback sits far below every churned top
    let n = 0;
    for (let i = keys.length - 1; i >= 0; i--) if (w.registry.deskFor(keys[i]!).marker().rev! > tops[i]!) n++;
    return n;
  };
  const burst = Array.from({ length: 8 }, (_, i) => `burst-${i}-`.padEnd(30, "x"));
  const burstTops: number[] = [];
  for (const k of burst) burstTops.push(await churn(w, k, 3)); // eight awake towns: the cap yields to them
  w.clock.t += 61_000;
  await w.registry.observeAll(); // all idle out
  expect(w.registry.size()).toBe(0);
  expect(await retainedOf(burst, burstTops)).toBe(3); // back to the cap, not the historical peak of 8

  // Codex's reproduction: eight awake, all idle, then twenty more towns created and idled in turn.
  const w2 = world({ revisionStoreFor: noDisk, markCap: 3 }, { t: 5000 });
  Object.assign(w, w2);
  const old = burst.map((k) => `old-${k}`);
  const oldTops: number[] = [];
  for (const k of old) oldTops.push(await churn(w, k, 3));
  w.clock.t += 61_000;
  await w.registry.observeAll();
  const later = Array.from({ length: 20 }, (_, i) => filler(i));
  const laterTops: number[] = [];
  for (const k of later) {
    laterTops.push(await churn(w, k, 3));
    w.clock.t += 61_000;
    await w.registry.observeAll();
  }
  expect(w.registry.size()).toBe(0);
  expect((await retainedOf(old, oldTops)) + (await retainedOf(later, laterTops))).toBeLessThanOrEqual(3);
});

// ---- timing through coalescing ----

function blockedWriter() {
  const writes: string[] = [];
  let full = false;
  let drainFn = () => {};
  const res = { write: (c: string) => (writes.push(c), !full), writableLength: 0, on: (_e: "drain", f: () => void) => void (drainFn = f) };
  const w = createStreamWriter(res, { maxBuffer: 1e9, stallMs: 1e9, abandon: () => {} });
  return { w, writes, block: () => (full = true), drain: () => { full = false; drainFn(); } };
}

const mk = (visit: number | null, latestSeq: number, lastLineAt: number | null) => ({ visit, latestSeq, lastLineAt });

test("6. Codex's case: a queued line-1 marker replaced by a same-line marker still yields one timing entry", () => {
  const logs: string[] = [];
  const timer = createLineTimer((l) => logs.push(l), () => 1500);
  const { w, writes, block, drain } = blockedWriter();
  w.marker("initial", timer(mk(7, 0, null))); // the snapshot
  block();
  w.marker("a", undefined);
  drain();
  block();
  w.marker("blocking", undefined); // fills the socket
  w.marker("line1", timer(mk(7, 1, 1000))); // queued, with a callback
  w.marker("line1-composing", timer(mk(7, 1, 1000))); // replaces it
  drain();
  expect(writes.slice(-1)).toEqual(["line1-composing"]);
  expect(logs.length).toBe(1);
  expect(logs[0]).toContain("line 1 handed to the socket 500 ms");
  // a later same-line marker, written at once, does not time the line twice
  w.marker("line1-again", timer(mk(7, 1, 1000)));
  expect(logs.length).toBe(1);
  // the next line, and the same number in a new visit, are each timed
  w.marker("line2", timer(mk(7, 2, 1200)));
  w.marker("v8l2", timer(mk(8, 2, 1300)));
  expect(logs.length).toBe(3);
  expect(logs.join("\n")).not.toMatch(/line1|text|token/);
});

test("7. the snapshot line is never timed, and a marker coalesced away by a newer LINE is not (sampled)", () => {
  const logs: string[] = [];
  const timer = createLineTimer((l) => logs.push(l));
  const { w, block, drain } = blockedWriter();
  w.marker("snap", timer(mk(7, 3, 1000))); // first marker already names line 3
  w.marker("snap-compose", timer(mk(7, 3, 1000)));
  expect(logs.length).toBe(0);
  block();
  w.marker("full", undefined);
  w.marker("l4", timer(mk(7, 4, 1100)));
  w.marker("l5", timer(mk(7, 5, 1200)));
  drain();
  expect(logs.length).toBe(1);
  expect(logs[0]).toContain("line 5");
});
