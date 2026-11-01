import { expect, test } from "bun:test";
import { AdaptiveQuality } from "./adaptiveQuality";
import { ProximityLoader } from "./proximityLoader";
import { ReliableActions } from "./reliableActions";
import { buildArrivalSummary } from "./arrivalSummary";
import type { TownState } from "./useTownState";

test("streaming defers distant work and respects concurrency", async () => {
  const loader = new ProximityLoader(10, 1);
  const started: string[] = [];
  let finish!: () => void;
  const near = loader.request(() => { started.push("near"); return new Promise<void>((resolve) => { finish = resolve; }); }, () => ({ x: 1, z: 0 }));
  const far = loader.request(async () => { started.push("far"); }, () => ({ x: 100, z: 0 }));
  expect(started).toEqual([]);
  loader.updateFocus({ x: 0, z: 0 });
  expect(started).toEqual(["near"]);
  loader.updateFocus({ x: 100, z: 0 });
  expect(started).toEqual(["near"]);
  finish(); await near; await far;
  loader.updateFocus({ x: 0, z: 0 }, true);
  expect(started).toEqual(["near", "far"]);
  expect(loader.progress().loaded).toBe(2);
});

test("disposing streaming cancels queued work without starting downloads", async () => {
  const loader = new ProximityLoader();
  let started = false;
  const pending = loader.request(async () => { started = true; }, () => ({ x: 0, z: 0 }));
  const rejected = pending.catch((error: Error) => error.message);
  loader.dispose(); expect(await rejected).toBe("Scene disposed");
  loader.updateFocus({ x: 0, z: 0 });
  expect(started).toBe(false);
});

test("adaptive graphics requires sustained slow frames and recovers gradually", () => {
  const quality = new AdaptiveQuality();
  let now = 0;
  const sampleFor = (ms: number, frame: number) => { const end = now + ms; while (now < end) { now += frame; quality.sample(frame, now); } };
  sampleFor(10000, 50); expect(quality.tier).toBe(2);
  sampleFor(6000, 50); expect(quality.tier).toBe(1);
  sampleFor(5000, 50); expect(quality.tier).toBe(1);
  sampleFor(26000, 16); expect(quality.tier).toBe(2);
  quality.setMode("light", now); sampleFor(40000, 16); expect(quality.tier).toBe(0);
  quality.setMode("full", now); sampleFor(40000, 50); expect(quality.tier).toBe(2);
});

test("transport retries reuse an ID; successful intentional repeats get new IDs", async () => {
  let ids = 0;
  const reliable = new ReliableActions(undefined, () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`);
  const sent: unknown[] = [];
  const send = async (args: Record<string, unknown>) => { sent.push(args.request_id); if (sent.length === 1) throw new TypeError("Failed to fetch"); return 1; };
  const first = reliable.call("buySeeds", {}, send);
  expect(reliable.call("buySeeds", {}, send)).toBe(first);
  await first;
  await reliable.call("buySeeds", {}, send);
  expect(sent[0]).toBe(sent[1]); expect(sent[2]).not.toBe(sent[0]);
  expect(reliable.list()).toHaveLength(0);
});

test("uncertain requests survive reload and pausing blocks new mutations", async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const first = new ReliableActions(storage, () => "00000000-0000-4000-8000-000000000001");
  await expect(first.call("buySeeds", {}, async () => { throw new TypeError("offline"); })).rejects.toThrow();
  const reloaded = new ReliableActions(storage);
  await reloaded.call("buySeeds", {}, async (args) => { expect(args.request_id).toBe(first.list()[0]!.requestId); });
  await reloaded.pause();
  await expect(reloaded.call("buySeeds", {}, async () => 1)).rejects.toThrow("Please wait");
  reloaded.resume(); expect(reloaded.list()).toHaveLength(0);
});

test("arrival summary prioritizes letters and handles festivals across New Year", () => {
  const state = { letters: [{ id: 2, read: false }], garden: { planted_on: "2026-12-01", water_days: 3 }, tree: { watered_today: false }, festivals: [{ name: "New Year", month_day: "01-01" }] } as unknown as TownState;
  const summary = buildArrivalSummary(state, { day: "2026-12-29", lastLetterId: 1 }, new Date("2026-12-31T23:00:00Z"));
  expect(summary.destination).toBe("letters");
  expect(summary.lines).toEqual(["1 new letter is waiting at the desk.", "Your garden is ready to harvest.", "New Year is tomorrow."]);
  state.letters = [];
  expect(buildArrivalSummary(state, null).destination).toBe("garden");
});
