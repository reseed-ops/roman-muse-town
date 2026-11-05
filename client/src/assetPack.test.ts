import { describe, expect, test } from "bun:test";
import { assetUrlSync, createPackStore, isPackUrl, packPath, type PackManifest } from "./assetPack";

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
