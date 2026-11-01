import { expect, test } from "bun:test";
import * as THREE from "three";
import { isRomanPalette, repairRomanMaterials } from "./romanMaterials";

const palette = new THREE.DataTexture(new Uint8Array([200, 180, 140, 255]), 1, 1);
const options = { architecture: true, palette: async () => palette, report: (_message: string) => {} };

test("palette repair accepts exporter suffixes and spelling variants", async () => {
  for (const name of ["M_colorpallete_roman.001", "M_colorpalette_BaseColor", "M_color", "Material #25"]) expect(isRomanPalette(name)).toBe(true);
  expect(isRomanPalette("Greek_Stone_4")).toBe(false);
  const material = new THREE.MeshStandardMaterial({ color: 0x969696 }); material.name = "M_colorpallete_roman.001";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  await repairRomanMaterials(mesh, options);
  expect(material.map).toBe(palette);
  expect(material.color.getHex()).toBe(0xffffff);
});

test("white architecture receives a detailed stone map and noncollapsed coordinates", async () => {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const geometry = new THREE.BoxGeometry(8, 12, 8);
  geometry.deleteAttribute("uv");
  const mesh = new THREE.Mesh(geometry, material);
  await repairRomanMaterials(mesh, options);
  expect(mesh.material.map?.name).toBe("Town travertine fallback");
  expect(mesh.material.map?.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(new Set(mesh.geometry.getAttribute("uv1").array).size).toBeGreaterThan(2);
  expect(new Set((mesh.material.map as THREE.DataTexture).image.data).size).toBeGreaterThan(10);
});

test("preserves working textures, colored surfaces and nonbuilding models", async () => {
  const materials = [new THREE.MeshStandardMaterial({ map: palette }), new THREE.MeshStandardMaterial({ color: 0xa03d2d })];
  const geometry = new THREE.BoxGeometry();
  const mesh = new THREE.Mesh(geometry, materials);
  await repairRomanMaterials(mesh, options);
  expect(mesh.material[0]).toBe(materials[0]!); expect(mesh.material[1]).toBe(materials[1]!);
  expect(mesh.geometry).toBe(geometry);
  const avatar = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  await repairRomanMaterials(avatar, { ...options, architecture: false });
  expect(avatar.material.map).toBeNull();
});

test("failed palette downloads fall back without damaging another material slot's UVs", async () => {
  const material = new THREE.MeshStandardMaterial(); material.name = "M_color";
  const intact = new THREE.MeshStandardMaterial({ map: palette });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [material, intact]);
  const originalUv = mesh.geometry.toNonIndexed().getAttribute("uv").array;
  await repairRomanMaterials(mesh, { ...options, palette: async () => { throw new Error("missing palette"); } });
  expect(mesh.material[0]!.map?.name).toBe("Town travertine fallback");
  expect(mesh.material[1]).toBe(intact);
  expect(mesh.geometry.getAttribute("uv").array).toEqual(originalUv);
});
