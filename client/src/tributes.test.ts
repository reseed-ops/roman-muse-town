import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { lessonForPlace } from "./HistoryBook";
import { buildAthenaTemple, buildLucretia } from "./tributes";
import { ATHENA_LINES, ATHENA_SEAT, ATHENA_TEMPLE, LUCRETIA, LUCRETIA_LINES, PLACES, VILLA, streetDistance } from "./town";

// Lucretia's statue (Task 54) and Athena's temple (Task 55).

const scene = readFileSync(join(import.meta.dir, "townScene.ts"), "utf8");
const app = readFileSync(join(import.meta.dir, "App.tsx"), "utf8");

test("Lucretia stands in the forum garden facing the evening, a rose at her feet", () => {
  const [x, z] = LUCRETIA.position;
  // Inside the peristyle's colonnade, its west quarter.
  expect(Math.abs(x)).toBeLessThan(VILLA.peristyle.halfX - 1.5);
  expect(Math.abs(z)).toBeLessThan(VILLA.peristyle.halfZ - 1.5);
  expect(x).toBeLessThan(-6);
  // Her front (local +z) turned to the west, where the sun sets.
  const front = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), LUCRETIA.rotY);
  expect(front.x).toBeLessThan(-0.99);
  const { group } = buildLucretia(0);
  const box = new THREE.Box3().setFromObject(group);
  expect(box.max.y).toBeGreaterThan(2.6); // plinth and figure, life size
  expect(box.max.y).toBeLessThan(3.2);
  let rose = 0;
  group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.color && m.color.getHex() === 0xb3202e) rose++;
  });
  expect(rose).toBeGreaterThan(3);
  expect(lessonForPlace("lucretia")?.inscription).toContain("LVCRETIA");
});

test("Athena's temple is just down the way, facing her, olive leaves in the stone and trees at its steps", () => {
  const d = Math.hypot(ATHENA_TEMPLE.position[0] - LUCRETIA.position[0], ATHENA_TEMPLE.position[1] - LUCRETIA.position[1]);
  expect(d).toBeGreaterThan(7);
  expect(d).toBeLessThan(14);
  // Its step faces east, back toward her.
  expect(ATHENA_SEAT.x).toBeGreaterThan(ATHENA_TEMPLE.position[0]);
  expect(-Math.sin(ATHENA_SEAT.rotY)).toBeCloseTo(1);
  // Clear of the streets and the neighbouring houses.
  for (const [px, pz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const cx = ATHENA_TEMPLE.position[0] + px! * (ATHENA_TEMPLE.halfX + 0.6);
    const cz = ATHENA_TEMPLE.position[1] + pz! * ATHENA_TEMPLE.halfZ;
    expect(streetDistance(cx, cz)).toBeGreaterThan(0.8);
  }
  for (const p of PLACES) {
    const half = (p.buildingWidth ?? 7.6) / 2;
    expect(Math.abs(p.position[1] - ATHENA_TEMPLE.position[1]) > half + ATHENA_TEMPLE.halfZ || Math.abs(p.position[0] - ATHENA_TEMPLE.position[0]) > half + ATHENA_TEMPLE.halfX).toBe(true);
  }
  const { group } = buildAthenaTemple(0);
  let leaves = 0;
  group.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.color && m.color.getHex() === 0x7c8a4a) leaves++;
  });
  expect(leaves).toBeGreaterThanOrEqual(12);
  expect(ATHENA_TEMPLE.olives).toHaveLength(2);
  expect(lessonForPlace("athena")?.inscription).toContain("ATHENA");
});

test("both are wired: solid, readable, the step a seat for two, her words when she stands there", () => {
  expect(scene).toContain('["history", "lucretia", LUCRETIA.position[0], LUCRETIA.position[1], 2.6]');
  expect(scene).toContain('"history", "athena"');
  expect(scene).toContain('id: "bench-athena"');
  expect(scene).toContain("circ(LUCRETIA.position[0], LUCRETIA.position[1], LUCRETIA.plinthHalf + 0.12)");
  expect(scene).toContain('pickLine("companion:lucretia", LUCRETIA_LINES)');
  expect(scene).toContain('pickLine("companion:athena", ATHENA_LINES)');
  expect(app).toContain("Read Lucretia's inscription");
  expect(app).toContain("Sit together on the temple step");
  for (const line of [...LUCRETIA_LINES, ...ATHENA_LINES]) {
    expect(line).not.toMatch(/[—–!]/);
    expect(line.length).toBeLessThan(170);
  }
});

test("Athena's cella is a hollow room with a real doorway, lit from inside (Task 87)", () => {
  const { group } = buildAthenaTemple(0);
  group.updateMatrixWorld(true);
  const C = ATHENA_TEMPLE.cella;
  const meshes: THREE.Object3D[] = [];
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o); });
  const shoot = (x: number, y: number, z: number) => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, z).add(group.position), new THREE.Vector3(-1, 0, 0));
    return ray.intersectObjects(meshes, false)[0];
  };
  const eyeX = ATHENA_TEMPLE.halfX + ATHENA_TEMPLE.stepDepth / 2;
  // from the bench, level, down the axis at chest height: nothing until the inner face of the back wall
  const hit = shoot(eyeX, ATHENA_TEMPLE.podiumY + 1.3, 0)!;
  expect(eyeX - hit.distance).toBeCloseTo(C.x0 + C.wall, 2);
  // the same ray beside the door hits the front wall: the door is an opening, not the wall painted dark
  expect(eyeX - shoot(eyeX, ATHENA_TEMPLE.podiumY + 1.3, C.doorHalf + 0.3)!.distance).toBeGreaterThan(C.x1 - 0.1);
  // and above the lintel's underside, under the door's height, is open; at the lintel it is wall
  expect(eyeX - shoot(eyeX, ATHENA_TEMPLE.podiumY + C.doorH + 0.15, 0)!.distance).toBeGreaterThan(C.x1 - 0.1);
  // the room is lit: a point light inside the cella
  const lights: THREE.PointLight[] = [];
  group.traverse((o) => { if ((o as THREE.PointLight).isPointLight) lights.push(o as THREE.PointLight); });
  expect(lights).toHaveLength(1);
  expect(lights[0]!.position.x).toBeGreaterThan(C.x0);
  expect(lights[0]!.position.x).toBeLessThan(C.x1);
  expect(Math.abs(lights[0]!.position.z)).toBeLessThan(C.halfZ);
  expect(lights[0]!.position.y).toBeLessThan(ATHENA_TEMPLE.podiumY + C.height);
});
