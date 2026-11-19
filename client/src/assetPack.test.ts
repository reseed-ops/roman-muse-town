import { describe, expect, test } from "bun:test";
import { assetUrlSync, createPackStore, fetchBytesWithStallRetry, isPackUrl, packPath, type PackManifest } from "./assetPack";

// The hosted build's packed assets: one fetch per pack, byte ranges
// sliced per file, the pack let go once every file in it is taken, and
// plain URLs untouched.
const enc = new TextEncoder();
const files: Record<string, Uint8Array> = {
  "anim/f_idle.fbx": enc.encode("IDLE-BYTES"),
  "anim/f_walk.fbx": enc.encode("walk"),
  "roman/temple.glb": enc.encode("a temple"),
};
function manifestAndPacks(): { manifest: PackManifest; packs: Record<string, ArrayBuffer> } {
  const packs: Record<string, ArrayBuffer> = {};
  const manifest: PackManifest = { version: 1, packs: {}, entries: {} };
  const groups: Record<string, string[]> = { anim: ["anim/f_idle.fbx", "anim/f_walk.fbx"], roman: ["roman/temple.glb"] };
  for (const [name, paths] of Object.entries(groups)) {
    let offset = 0;
    const parts: Uint8Array[] = [];
    for (const path of paths) {
      const bytes = files[path]!;
      manifest.entries[path] = { pack: name, offset, size: bytes.byteLength, type: path.endsWith(".glb") ? "model/gltf-binary" : "application/octet-stream" };
      parts.push(bytes);
      offset += bytes.byteLength;
    }
    const whole = new Uint8Array(offset);
    let at = 0;
    for (const part of parts) {
      whole.set(part, at);
      at += part.byteLength;
    }
    packs[`packs/${name}-abc.pack`] = whole.buffer as ArrayBuffer;
    manifest.packs[name] = { file: `packs/${name}-abc.pack`, bytes: offset, files: paths.length };
  }
  return { manifest, packs };
}

describe("asset packs", () => {
  test("a pack is fetched once and each file comes back byte for byte", async () => {
    const { manifest, packs } = manifestAndPacks();
    const fetched: string[] = [];
    const store = createPackStore({
      manifestUrl: "packs/manifest.json",
      fetchJson: async () => manifest,
      fetchBytes: async (url) => {
        fetched.push(url);
        return packs[url]!;
      },
      makeObjectUrl: (buf, type) => `blob:${type}:${buf.byteLength}`,
    });
    const idle = new TextDecoder().decode(await store.bytes("pack:anim/f_idle.fbx"));
    const walk = new TextDecoder().decode(await store.bytes("pack:anim/f_walk.fbx"));
    expect(idle).toBe("IDLE-BYTES");
    expect(walk).toBe("walk");
    expect(fetched).toEqual(["packs/anim-abc.pack"]);
    // Both files taken: the anim pack is let go, a third request fetches it again.
    await store.bytes("pack:anim/f_idle.fbx");
    expect(fetched).toEqual(["packs/anim-abc.pack", "packs/anim-abc.pack"]);
    // Object URLs carry the entry's type and are made once.
    const url = await store.objectUrl("pack:roman/temple.glb");
    expect(url).toBe("blob:model/gltf-binary:8");
    expect(await store.objectUrl("pack:roman/temple.glb")).toBe(url);
    expect(store.objectUrlSync("pack:roman/temple.glb")).toBe(url);
    expect(store.objectUrlSync("pack:anim/f_idle.fbx")).toBeNull();
  });

  test("a file missing from the manifest and a short pack are refused loudly", async () => {
    const { manifest, packs } = manifestAndPacks();
    const store = createPackStore({
      manifestUrl: "m",
      fetchJson: async () => manifest,
      fetchBytes: async (url) => packs[url]!.slice(0, 3),
    });
    await expect(store.bytes("pack:greek/none.fbx")).rejects.toThrow("not in any pack");
    await expect(store.bytes("pack:anim/f_idle.fbx")).rejects.toThrow("expected 14 bytes");
  });

  test("plain URLs are left alone", () => {
    expect(isPackUrl("./assets/x.fbx")).toBe(false);
    expect(isPackUrl("pack:anim/x.fbx")).toBe(true);
    expect(packPath("pack:anim/x.fbx")).toBe("anim/x.fbx");
    expect(assetUrlSync("./assets/x-abc.fbx")).toBe("./assets/x-abc.fbx");
  });
});

// Task 112: a restart left the loader at 0/4 behind a download that never moved.
describe("a pack that stops arriving is asked for again", () => {
  const hangingResponse = (signal: AbortSignal) =>
    new Response(new ReadableStream({ start(c) { signal.addEventListener("abort", () => c.error(new Error("aborted"))); } }));
  test("a stalled first attempt is dropped and the second one completes", async () => {
    let calls = 0;
    const fetchImpl = ((_: unknown, init?: RequestInit) => {
      calls++;
      if (calls === 1) return Promise.resolve(hangingResponse(init!.signal!));
      expect(init?.cache).toBe("reload");
      return Promise.resolve(new Response(new Uint8Array([1, 2, 3])));
    }) as unknown as typeof fetch;
    const out = await fetchBytesWithStallRetry("packs/x.pack", { fetchImpl, stallMs: 30 });
    expect(new Uint8Array(out)).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls).toBe(2);
  });
  test("a request that never answers does not hang forever: it fails after the attempts", async () => {
    const fetchImpl = ((_: unknown, init?: RequestInit) =>
      new Promise((_res, rej) => init!.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    await expect(fetchBytesWithStallRetry("packs/x.pack", { fetchImpl, stallMs: 20, attempts: 2 })).rejects.toThrow(/stalled/);
  });
  test("a 404 is final, not retried", async () => {
    let calls = 0;
    const fetchImpl = (() => { calls++; return Promise.resolve(new Response("no", { status: 404 })); }) as unknown as typeof fetch;
    await expect(fetchBytesWithStallRetry("packs/x.pack", { fetchImpl })).rejects.toThrow(/404/);
    expect(calls).toBe(1);
  });
  test("a failed pack fetch is not remembered: the next asker fetches again", async () => {
    const { manifest, packs } = manifestAndPacks();
    let tries = 0;
    const store = createPackStore({
      manifestUrl: "m",
      fetchJson: async () => manifest,
      fetchBytes: async (url) => {
        tries++;
        if (tries === 1) throw new Error("dropped");
        return packs[url]!;
      },
    });
    await expect(store.bytes("pack:roman/temple.glb")).rejects.toThrow();
    expect(new TextDecoder().decode(await store.bytes("pack:roman/temple.glb"))).toBe("a temple");
  });
});
