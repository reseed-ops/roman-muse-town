import { afterEach, describe, expect, test } from "bun:test";
import { fetchClipBytes, nextLoadJob, settleWithin, takeClipBytes } from "./characterLoad";

describe("nextLoadJob", () => {
  const queue = [
    { tier: 1, seq: 0 }, // a building, registered first
    { tier: 0, seq: 5 }, // Aelia
    { tier: 0, seq: 4 }, // the Centurion
    { tier: 2, seq: 1 },
  ];

  test("characters go first, whatever order they registered in", () => {
    expect(nextLoadJob(queue, false)).toBe(2);
  });

  test("nothing else starts until the characters have settled", () => {
    expect(nextLoadJob([{ tier: 1, seq: 0 }, { tier: 2, seq: 1 }], false)).toBe(-1);
  });

  test("once they have, the lowest tier goes next", () => {
    expect(nextLoadJob([{ tier: 2, seq: 0 }, { tier: 1, seq: 1 }], true)).toBe(1);
  });

  test("an empty queue waits", () => {
    expect(nextLoadJob([], true)).toBe(-1);
  });
});

describe("settleWithin", () => {
  test("a failed character does not hold the town", async () => {
    await settleWithin([Promise.reject(new Error("no body"))], 1000);
  });

  test("a hung download is abandoned at the deadline", async () => {
    const started = performance.now();
    await settleWithin([new Promise(() => {})], 30);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("clip bytes", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("the early start and the bake share one download", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(new ArrayBuffer(4));
    }) as unknown as typeof fetch;
    void fetchClipBytes("idle.fbx");
    const bytes = await takeClipBytes("idle.fbx");
    expect(bytes.byteLength).toBe(4);
    expect(calls).toBe(1);
  });
});
