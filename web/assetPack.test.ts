import { describe, expect, test } from "bun:test";
import { buildPacks, mimeFor, packNameFor } from "./assetPack";

const enc = new TextEncoder();
describe("the build's asset packs", () => {
  test("every licensed group has a pack, the bodies and the wolf and the song their own", () => {
    expect(packNameFor("anim/outdoor/f_hug.fbx")).toBe("outdoor");
    expect(packNameFor("anim/m_idle.fbx")).toBe("anim");
    expect(packNameFor("roman/temple.glb")).toBe("roman");
    expect(packNameFor("greek/greek_pot_1.fbx")).toBe("greek");
    expect(packNameFor("pets/cat.fbx")).toBe("pets");
    expect(packNameFor("ships/trireme.glb")).toBe("ships");
    expect(packNameFor("ships/trireme_sail2.png")).toBe("ships");
    expect(packNameFor("centurion.vrm")).toBe("bodies");
    expect(packNameFor("muse-avatar.vrm")).toBe("bodies");
    expect(packNameFor("wolf.glb")).toBe("wolf");
    expect(packNameFor("stars-fall-song.mp3")).toBe("song");
    expect(packNameFor("trees_pack.glb")).toBe("world");
    expect(packNameFor("phoenix_tex.png")).toBe("world");
    expect(mimeFor("a.vrm")).toBe("model/gltf-binary");
    expect(mimeFor("a.mp3")).toBe("audio/mpeg");
  });

  test("packs concatenate their files in path order with exact byte ranges and hashed names", () => {
    const { manifest, packs } = buildPacks(
      [
        { rel: "roman/temple.glb", bytes: enc.encode("TEMPLE") },
        { rel: "roman/apple.glb", bytes: enc.encode("apple") },
        { rel: "centurion.vrm", bytes: enc.encode("gaius") },
      ],
      (bytes) => `h${bytes.byteLength}xxxxxxxxxxxx`,
    );
    expect(Object.keys(manifest.packs)).toEqual(["bodies", "roman"]);
    expect(manifest.packs.roman).toEqual({ file: "packs/roman-h11xxxxxxxxx.pack", bytes: 11, files: 2 });
    expect(manifest.entries["roman/apple.glb"]).toEqual({ pack: "roman", offset: 0, size: 5, type: "model/gltf-binary" });
    expect(manifest.entries["roman/temple.glb"]).toEqual({ pack: "roman", offset: 5, size: 6, type: "model/gltf-binary" });
    const roman = packs.find((p) => p.name === "roman")!;
    expect(new TextDecoder().decode(roman.bytes)).toBe("appleTEMPLE");
    expect(manifest.entries["centurion.vrm"]!.pack).toBe("bodies");
  });
});
