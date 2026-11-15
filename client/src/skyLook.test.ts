import { describe, expect, test } from "bun:test";
import * as THREE from "three";
import { seaFogColor, SEA_FOG_NIGHT, domeDisplayedHorizon, ENV_DAY, HEMI_DAY, SEA_NIGHT_BLEND, SUN_DAY, TONE_EXPOSURE, warmStone } from "./skyLook";
import { OCEAN_DAY, OCEAN_NIGHT } from "./seaCliff";

describe("tame the whites (Task 96)", () => {
  test("the day rig is below the levels that clipped light stone", () => {
    expect(TONE_EXPOSURE).toBeLessThan(1.12);
    expect(HEMI_DAY).toBeLessThan(0.95);
    expect(SUN_DAY).toBeLessThan(1.9);
    expect(ENV_DAY).toBeLessThan(0.35);
    // Not so low that noon goes dim: the sun still carries the scene.
    expect(TONE_EXPOSURE).toBeGreaterThan(0.8);
    expect(SUN_DAY).toBeGreaterThan(1.4);
  });
  test("warmStone tints a copy and leaves the shared material alone", () => {
    const shared = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const a = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const b = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const root = new THREE.Group().add(a, b);
    expect(warmStone(root)).toBe(2);
    expect(shared.color.getHex()).toBe(0xffffff);
    const m = a.material as THREE.MeshStandardMaterial;
    expect(m).not.toBe(shared);
    expect(m.color.r).toBeGreaterThan(m.color.b); // warm, not neutral
    expect(m.color.r).toBeLessThan(1);
  });
});

describe("close the horizon seam (Task 96)", () => {
  test("the fog colour is the colour the dome displays: the uniform's numbers read as sRGB", () => {
    const horizon = new THREE.Color(0xf78d5f); // stored linear
    const fog = domeDisplayedHorizon(horizon);
    // The dome writes horizon.rgb to the screen raw; the fog, once encoded to sRGB, must equal those numbers.
    const shown = fog.clone().convertLinearToSRGB();
    expect(shown.r).toBeCloseTo(horizon.r, 4);
    expect(shown.g).toBeCloseTo(horizon.g, 4);
    expect(shown.b).toBeCloseTo(horizon.b, 4);
    expect(shown.g).toBeGreaterThan(fog.g);
  });
  test("the sea has its own night colour, distinct from the night horizon", () => {
    expect(SEA_NIGHT_BLEND).toBe(1);
    const night = new THREE.Color(OCEAN_DAY).lerp(new THREE.Color(OCEAN_NIGHT), SEA_NIGHT_BLEND);
    expect(night.getHex()).toBe(new THREE.Color(OCEAN_NIGHT).getHex());
    const horizonNight = domeDisplayedHorizon(new THREE.Color(0x33436b));
    // The sea must stand apart from the sky it meets: at least a third brighter in blue, and still blue.
    expect(night.b).toBeGreaterThan(horizonNight.b * 1.3);
    expect(night.b).toBeGreaterThan(night.g);
  });
  test("fog is the dome's displayed horizon by day and leans to the sea's night colour at night", () => {
    const horizon = new THREE.Color(0x33436b);
    const day = seaFogColor(horizon, 0);
    expect(day.getHex()).toBe(domeDisplayedHorizon(horizon).getHex());
    const night = seaFogColor(horizon, 1);
    const sea = new THREE.Color(OCEAN_NIGHT);
    expect(Math.abs(night.b - sea.b)).toBeLessThan(Math.abs(day.b - sea.b));
    expect(night.b).toBeCloseTo(day.b + (sea.b - day.b) * SEA_FOG_NIGHT, 6);
    expect(seaFogColor(horizon, 5).b).toBeCloseTo(night.b, 9); // clamped
  });
});
