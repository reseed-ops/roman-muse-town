import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { GROUND_TILE_METRES, groundAnisotropy, groundMaterial, loadGroundMaps, repeatedMaps, worldMetricUVs } from "./groundTextures";

const HERE = import.meta.dir;
const fakeLoad = () => new THREE.Texture();

describe("the loom-made ground (Task 93)", () => {
  test("the paving and the cobbles carry albedo, normal, AO and roughness maps", () => {
    for (const kind of ["paving", "cobbles"] as const) {
      const maps = loadGroundMaps(kind, 8, fakeLoad);
      const m = groundMaterial(maps);
      expect(m.map).toBe(maps.albedo);
      expect(m.normalMap).toBe(maps.normal);
      expect(m.aoMap).toBe(maps.orm);
      expect(m.roughnessMap).toBe(maps.orm);
      expect(m.roughness).toBe(1);
      expect(m.map!.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(m.normalMap!.colorSpace).toBe(THREE.NoColorSpace);
    }
  });

  test("anisotropy is set on every ground map, never left at 1 when the GPU offers more", () => {
    const maps = loadGroundMaps("cobbles", groundAnisotropy(16), fakeLoad);
    expect(maps.albedo.anisotropy).toBe(8);
    expect(maps.normal.anisotropy).toBe(8);
    expect(maps.orm.anisotropy).toBe(8);
    expect(groundAnisotropy(4)).toBe(4);
    expect(groundAnisotropy(0)).toBe(1);
    const copy = repeatedMaps(maps, 4.67);
    expect(copy.normal.anisotropy).toBe(8);
    expect(copy.albedo.repeat.x).toBeCloseTo(4.67);
  });

  test("the maps ship as seamless power-of-two PNGs", () => {
    for (const name of ["forum_paving", "cobbles"]) {
      for (const kind of ["albedo", "normal", "orm"]) {
        const bytes = readFileSync(join(HERE, "textures", `${name}_${kind}.png`));
        expect(bytes.subarray(1, 4).toString()).toBe("PNG");
        const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
        expect(w).toBe(h);
        expect(w & (w - 1)).toBe(0);
        expect(w).toBeGreaterThanOrEqual(256);
      }
    }
  });

  test("world-metric UVs give a tile the same size on every slab and face", () => {
    const geo = new THREE.BoxGeometry(8, 0.4, 2).translate(10, 0, 5);
    worldMetricUVs(geo, GROUND_TILE_METRES.paving);
    const pos = geo.getAttribute("position"), nor = geo.getAttribute("normal"), uv = geo.getAttribute("uv");
    for (let i = 0; i < pos.count; i++) {
      if (nor.getY(i) === 1) {
        expect(uv.getX(i)).toBeCloseTo(pos.getX(i) / GROUND_TILE_METRES.paving);
        expect(uv.getY(i)).toBeCloseTo(pos.getZ(i) / GROUND_TILE_METRES.paving);
      }
    }
  });

  test("the town builds its streets, plaza and villa paving from them, not a flat colour", () => {
    const src = readFileSync(join(HERE, "townScene.ts"), "utf8");
    expect(src).toContain('loadGroundMaps("cobbles"');
    expect(src).toContain("const streetMat = groundMaterial(cobbleMaps)");
    expect(src).toContain("const plazaMat = groundMaterial(");
    expect(src).toContain('loadGroundMaps("paving"');
    expect(src).not.toContain("0xd9cfb6");
    expect(src).not.toContain("cobbleTexture");
  });
});

// The licensed GLBs exist only on a machine with the real assets (CI has empty stand-ins).
function glbJson(path: string): { materials: Record<string, any>[]; textures: unknown[] } | null {
  if (!existsSync(path) || statSync(path).size < 1000) return null;
  const d = readFileSync(path);
  return JSON.parse(d.subarray(20, 20 + d.readUInt32LE(12)).toString("utf8"));
}

describe("the statues and the colosseum have their carved-stone maps back (Task 93)", () => {
  const A = join(HERE, "assets");
  const STATUE_MATERIALS = ["M_sculpture_female", "M_sculpture_male", "M_putti_sculpture", "M_cloth_sculptures"];
  const STONE_WITH_MASK = ["M_columns_rome", "M_stoneblocks_small", "M_stoneblocks_large", "M_podests_rome", "M_edges_rome"];
  const base = (m: { name: string }) => m.name.split(".")[0]!;

  for (const f of ["statuary/athena.glb", "statuary/augustus.glb", "statuary/putto.glb"]) {
    test(`${f}: every statue material has a normal map`, () => {
      const j = glbJson(join(A, f));
      if (!j) return;
      const marble = j.materials.filter((m) => STATUE_MATERIALS.includes(base(m as { name: string })));
      expect(marble.length).toBeGreaterThan(0);
      for (const m of marble) expect(m.normalTexture).toBeDefined();
    });
  }

  for (const f of ["idyllic/colosseum.glb", "statuary/podest.glb", "idyllic/podest.glb"]) {
    test(`${f}: the stone materials carry a normal map and an ORM mask`, () => {
      const j = glbJson(join(A, f));
      if (!j) return;
      const stone = j.materials.filter((m) => STONE_WITH_MASK.includes(base(m as { name: string })));
      expect(stone.length).toBeGreaterThan(0);
      for (const m of stone) {
        expect(m.normalTexture).toBeDefined();
        expect(m.occlusionTexture).toBeDefined();
        expect(m.pbrMetallicRoughness.metallicRoughnessTexture).toBeDefined();
      }
    });
  }
});
