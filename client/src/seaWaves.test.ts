import { expect, test } from "bun:test";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { CASCADES, MAX_HEIGHT, seaDisplacement, seaHeight, seaNormal, seaWaveGLSL, shipRide, WAVES } from "./seaWaves";
import { installSeaWaves, seaGridGeometry } from "./seaSurface";
import { buildSeaCliff } from "./seaCliff";
import { buildSwimWorld } from "./swimScene";
import { SEA_Y } from "./shoreStair";
import { SHIPS, voyagePose, planVoyage } from "./seaShips";
import { underwaterMix } from "./swim";

// The sea's waves (Task 102), pinned off the scene.

test("four cascades of waves, a gentle to moderate sea (not a storm), never a loop in the surface", () => {
  expect(new Set(WAVES.map((w) => w.cascade)).size).toBe(CASCADES);
  // Each cascade is a smaller size band than the one before it.
  for (let c = 1; c < CASCADES; c++) {
    const prev = Math.max(...WAVES.filter((w) => w.cascade === c).map((w) => w.wavelength));
    const before = Math.min(...WAVES.filter((w) => w.cascade === c - 1).map((w) => w.wavelength));
    expect(prev).toBeLessThan(before);
  }
  expect(MAX_HEIGHT).toBeGreaterThan(0.3); // visible from the cliff
  expect(MAX_HEIGHT).toBeLessThan(1.2); // not a tempest
  // Gerstner crests cross over (a loop) when the summed steepness reaches 1.
  expect(WAVES.reduce((s, w) => s + w.steep * w.k * w.amp, 0)).toBeLessThan(0.7);
  // Deep water: the long waves outrun the short ones.
  const slow = WAVES.find((w) => w.cascade === 3)!;
  const fast = WAVES.find((w) => w.cascade === 0)!;
  expect(fast.omega / fast.k).toBeGreaterThan(slow.omega / slow.k);
});

test("the wave height is defined everywhere on the sea and varies smoothly (no jumps, no spikes)", () => {
  let worst = 0;
  let spike = 0;
  for (let t = 0; t < 30; t += 7.3) {
    for (let x = -1200; x <= 1200; x += 97) {
      for (let z = -900; z <= 1500; z += 113) {
        const h = seaHeight(x, z, t);
        expect(Number.isFinite(h)).toBe(true);
        expect(Math.abs(h)).toBeLessThanOrEqual(MAX_HEIGHT + 1e-9);
        const e = 0.25;
        const a = seaHeight(x - e, z, t);
        const b = seaHeight(x + e, z, t);
        const c = seaHeight(x, z - e, t);
        const d = seaHeight(x, z + e, t);
        worst = Math.max(worst, Math.abs(b - a) / (2 * e), Math.abs(d - c) / (2 * e));
        // Second difference: curvature stays bounded, so no spike.
        spike = Math.max(spike, Math.abs(a + b - 2 * h) / (e * e), Math.abs(c + d - 2 * h) / (e * e));
      }
    }
  }
  expect(worst).toBeLessThan(0.45); // no slope steeper than about 24 degrees
  expect(spike).toBeLessThan(2.5);
  // And it moves: the same place differs over time.
  expect(Math.abs(seaHeight(10, 100, 0) - seaHeight(10, 100, 3))).toBeGreaterThan(0.01);
});

test("seaHeight is the height of the displaced surface itself (what the vertex shader draws)", () => {
  for (const [x0, z0, t] of [[0, 90, 0], [-40, 140, 12.5], [77, 230, 300], [5, 60, 3600]] as const) {
    const d = seaDisplacement(x0, z0, t);
    let y = 0;
    for (const w of WAVES) y += w.amp * Math.sin(w.k * (w.dx * x0 + w.dz * z0) - w.omega * t + w.phase);
    expect(seaHeight(x0 + d.x, z0 + d.z, t)).toBeCloseTo(y, 6);
  }
  const n = seaNormal(10, 120, 4);
  expect(Math.hypot(...n)).toBeCloseTo(1, 9);
  expect(n[1]).toBeGreaterThan(0.85);
});

test("the GLSL carries every wave of the table as literals, one copy of the numbers", () => {
  const src = seaWaveGLSL();
  expect(src.match(/th = /g)!.length).toBe(WAVES.length);
  for (const w of WAVES) expect(src).toContain(w.k.toPrecision(9));
});

test("a ship's height and pitch follow the wave height at its position", () => {
  const L = SHIPS.trade.length;
  let rises = 0;
  for (let t = 0; t < 60; t += 0.7) {
    const x = 12 + t;
    const z = 130;
    const heading = 0.4;
    const r = shipRide(x, z, heading, L, t);
    // Height: the mean surface under the hull, never more than the highest wave.
    expect(Math.abs(r.dy)).toBeLessThanOrEqual(MAX_HEIGHT);
    expect(Math.abs(r.dy - seaHeight(x, z, t))).toBeLessThan(0.35);
    // Pitch: the slope from stern to bow (bow +X faces (cos h, -sin h)).
    const bow = seaHeight(x + Math.cos(heading) * L / 2, z - Math.sin(heading) * L / 2, t);
    const stern = seaHeight(x - Math.cos(heading) * L / 2, z + Math.sin(heading) * L / 2, t);
    expect(r.pitch).toBeCloseTo(Math.atan2(bow - stern, L), 9);
    expect(Math.abs(r.pitch)).toBeLessThan(0.25);
    expect(Math.abs(r.roll)).toBeLessThan(0.25);
    if (Math.abs(r.pitch) > 0.005) rises++;
  }
  expect(rises).toBeGreaterThan(20); // it really pitches, it is not a still hull
  // A hull riding a crest sits above one in a trough: heave follows the wave over a long run.
  let hi = -9;
  let lo = 9;
  for (let t = 0; t < 120; t += 0.5) {
    const dy = shipRide(0, 130, 0, L, t).dy;
    hi = Math.max(hi, dy);
    lo = Math.min(lo, dy);
  }
  expect(hi - lo).toBeGreaterThan(0.1);
});

test("a voyage's ride keeps the route: the ride only changes height and angles", () => {
  const v = planVoyage("trade", true, () => 0.5);
  const p = voyagePose(v, 0.5);
  const r = shipRide(p.x, p.z, p.heading, SHIPS.trade.length, 10);
  expect(Object.keys(r).sort()).toEqual(["dy", "pitch", "roll"]);
});

test("the sea mesh, its surf and the surface from below all ride the same waves", () => {
  const tex = new THREE.Texture();
  const sea = buildSeaCliff({ terrainHeight: () => 0, waterNormal: tex, foamTexture: tex, pathTexture: tex, groundMaterial: new THREE.MeshStandardMaterial() } as never);
  const swim = buildSwimWorld({ waterNormal: tex });
  const ocean = sea.group.getObjectByName("ocean") as THREE.Mesh;
  const under = swim.underside;
  // Same grid, same level: the underside is the ocean's own surface seen from below.
  expect(under.geometry.attributes.position!.count).toBe(ocean.geometry.attributes.position!.count);
  expect(Array.from(under.geometry.attributes.position!.array.slice(0, 300))).toEqual(Array.from(ocean.geometry.attributes.position!.array.slice(0, 300)));
  expect(under.geometry.attributes.position!.count).toBeLessThan(30000); // phone-sized
  expect((swim.undersideMat as THREE.MeshBasicMaterial).side).toBe(THREE.BackSide);
  expect(sea.oceanMat.side).toBe(THREE.FrontSide);
  // The waves are in the shaders; the underside also shades by slope, the ocean does not.
  const compile = (m: THREE.Material) => {
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: "void main() {\n#include <beginnormal_vertex>\n#include <begin_vertex>\n}", fragmentShader: "void main() {\n#include <color_fragment>\n}" };
    m.onBeforeCompile!(shader as never, null as never);
    return shader;
  };
  const o = compile(sea.oceanMat);
  const u = compile(swim.undersideMat);
  expect(o.vertexShader).toContain("seaWave(");
  expect(u.vertexShader).toContain("seaWave(");
  expect(u.fragmentShader).toContain("vSeaShade");
  expect(o.fragmentShader).not.toContain("vSeaShade");
  expect(o.uniforms.uSeaTime).toBe(u.uniforms.uSeaTime); // one clock
});

test("the sea grid is fine where anyone swims and reaches the horizon", () => {
  const g = seaGridGeometry(SEA_Y);
  g.computeBoundingBox();
  expect(g.boundingBox!.min.x).toBeLessThanOrEqual(-1200);
  expect(g.boundingBox!.max.z).toBeGreaterThanOrEqual(1500);
  const pos = g.attributes.position!;
  const xs = new Set<number>();
  for (let i = 0; i < pos.count; i++) if (pos.getZ(i) === pos.getZ(0)) xs.add(pos.getX(i));
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.filter((x) => Math.abs(x) <= 240);
  for (let i = 1; i < mid.length; i++) expect(mid[i]! - mid[i - 1]!).toBeLessThanOrEqual(3.01);
});

test("from below the surface is where the wave is, and the crossing is clean", () => {
  // The swimmer's view mixes against the camera's height above the local wave: 0 above, 1 below, smooth between.
  const mixAt = (camY: number, x: number, z: number, t: number) => underwaterMix(camY - seaHeight(x, z, t) + 0);
  for (const t of [0, 2.2, 5.1]) {
    const surface = SEA_Y + seaHeight(20, 120, t);
    // Convention of underwaterMix: SEA_Y is the level, so offset by the wave on both sides.
    const m = (y: number) => underwaterMix(y - seaHeight(20, 120, t));
    expect(m(surface + 1)).toBe(0);
    expect(m(surface - 1)).toBe(1);
    let last = 0;
    for (let y = surface + 0.5; y >= surface - 0.5; y -= 0.02) {
      const v = m(y);
      expect(v).toBeGreaterThanOrEqual(last - 1e-12);
      expect(v - last).toBeLessThan(0.1); // no jump at the surface
      last = v;
    }
  }
  expect(mixAt(0, 0, 100, 0)).toBeDefined();
});

test("the lake stays calm: no ocean waves on it (the installer is for the sea only)", () => {
  const scene = readFileSync(new URL("./townScene.ts", import.meta.url), "utf8");
  expect(scene).not.toContain("installSeaWaves");
  expect(scene).not.toContain("seaGridGeometry");
  // The lake's own water is still a plain unlit-by-waves circle on its own material.
  const lakeBlock = scene.slice(scene.indexOf("const waterMat = new THREE.MeshStandardMaterial"), scene.indexOf("const water = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMat)"));
  expect(lakeBlock).not.toContain("seaWave");
  const m = new THREE.MeshStandardMaterial();
  expect(m.onBeforeCompile.toString()).not.toContain("seaWave");
  const sea = new THREE.MeshStandardMaterial();
  installSeaWaves(sea);
  expect(sea.customProgramCacheKey!()).toContain("sea-waves");
});
