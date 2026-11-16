import { expect, test } from "bun:test";
import * as THREE from "three";
import { applyLakeRipple, lakeRipple } from "./skyLook";

test("day lake ripple is exactly the original", () => {
  expect(lakeRipple(0)).toEqual({ normalScale: 0.4, roughness: 0.14 });
});

test("ripple strength falls and roughness rises as night comes", () => {
  let prev = lakeRipple(0);
  for (let n = 0.1; n <= 1.0001; n += 0.1) {
    const r = lakeRipple(n);
    expect(r.normalScale).toBeLessThan(prev.normalScale);
    expect(r.roughness).toBeGreaterThan(prev.roughness);
    prev = r;
  }
  expect(lakeRipple(1).normalScale).toBeCloseTo(0.1);
  expect(lakeRipple(5)).toEqual(lakeRipple(1));
});

test("the material update sets the lake material, day untouched", () => {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.14, normalScale: new THREE.Vector2(0.4, 0.4) });
  applyLakeRipple(m, 1);
  expect(m.normalScale.x).toBeCloseTo(0.1);
  expect(m.normalScale.y).toBeCloseTo(0.1);
  expect(m.roughness).toBeCloseTo(0.4);
  applyLakeRipple(m, 0);
  expect(m.normalScale.x).toBeCloseTo(0.4);
  expect(m.roughness).toBeCloseTo(0.14);
});

test("townScene calls it from the per-frame sky update", async () => {
  const src = await Bun.file(new URL("./townScene.ts", import.meta.url)).text();
  expect(src).toContain("applyLakeRipple(waterMat, nightMix);");
});
