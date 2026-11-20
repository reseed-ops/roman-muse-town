import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CLIFF } from "./seaCliff";
import type { ShipKind } from "./seaShips";

export const INCENDIARY_SPOT = { x: 4.6, z: 115.5 } as const;
// Task 127: a bolder pass on the pilot: 1.35x the frame in paler oak with pale skeins, so it reads from gameplay distance.
const BOLD_SCALE = 1.35;
const gravity = 12; // The town's thrown stones use the same scene acceleration.

export function solveShot(origin: THREE.Vector3, targetPos: THREE.Vector3, targetVel: THREE.Vector3, flightTime: number, gravity: number) {
  if (!(flightTime > 0 && Number.isFinite(flightTime) && gravity >= 0)) return null;
  const velocity = targetPos.clone().sub(origin).divideScalar(flightTime).add(targetVel);
  velocity.y += gravity * flightTime / 2;
  return Number.isFinite(velocity.lengthSq()) ? velocity : null;
}

function colored(geometry: THREE.BufferGeometry, tint: number) {
  const count = geometry.getAttribute("position").count;
  const rgb = new Float32Array(count * 3);
  const color = new THREE.Color(tint);
  for (let i = 0; i < count; i++) color.toArray(rgb, i * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
  return geometry;
}

function flame() {
  const geo = colored(new THREE.ConeGeometry(0.11, 0.34, 7), 0xffad38);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xff780d }));
}

function pot() {
  const profile = [[0.06, 0], [0.16, 0.09], [0.17, 0.18], [0.08, 0.27], [0.09, 0.30]];
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 12);
  return new THREE.Mesh(colored(geometry, 0xac583a), new THREE.MeshStandardMaterial({ vertexColors: true }));
}

export function buildIncendiary() {
  const group = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  const wood = 0xc2985f, iron = 0x3b3633;
  function beam(x: number, y: number, z: number, w: number, h: number, l: number, color = wood, turn = 0) {
    parts.push(colored(new THREE.BoxGeometry(w, h, l).rotateY(turn).translate(x, y, z), color));
  }
  for (const side of [-1, 1]) {
    beam(side * 0.42, 0.11, 0, 0.2, 0.22, 2.2);
    for (const z of [-0.72, 0.57]) {
      beam(side * 0.42, 0.48, z, 0.17, 0.78, 0.2);
      beam(side * 0.42, 0.72, z, 0.19, 0.08, 0.22, iron);
    }
    beam(side * 0.16, 0.95, 0, 0.09, 0.17, 2.12);
    parts.push(colored(new THREE.CylinderGeometry(0.14, 0.14, 0.47, 12).translate(side * 0.56, 1.12, 0.48), 0xeadbb4));
    beam(side * 0.82, 1.16, 0.70, 0.13, 0.14, 0.78, wood, side * 0.87);
  }
  for (const z of [-0.72, 0.48]) beam(0, 0.82, z, 1.48, 0.16, 0.24);
  beam(0, 0.88, 0, 0.30, 0.11, 2.12);
  for (const y of [0.84, 1.39]) beam(0, y, 0.48, 1.45, 0.12, 0.28);
  parts.push(colored(new THREE.CylinderGeometry(0.12, 0.21, 0.38, 10).translate(1.43, 0.19, -0.6), iron));
  parts.push(colored(new THREE.CylinderGeometry(0.29, 0.13, 0.18, 10).translate(1.43, 0.45, -0.6), iron));
  const frame = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true }));
  frame.castShadow = true;
  group.add(frame);
  group.scale.setScalar(BOLD_SCALE);
  const brazier = flame();
  brazier.name = "brazier";
  brazier.position.set(1.43, 0.69, -0.6);
  group.add(brazier);
  const loaded = pot();
  loaded.name = "loaded";
  loaded.position.set(0, 0.95, -0.42);
  const wick = flame();
  wick.position.y = 0.40;
  loaded.add(wick);
  group.add(loaded);
  for (const [x, y] of [[1.24, 0], [1.56, 0], [1.40, 0.23]] as const) {
    const spare = new THREE.Mesh(loaded.geometry, loaded.material);
    spare.position.set(x, y, 0.04);
    group.add(spare);
  }
  return group;
}

export interface HullTarget {
  x: number; y: number; z: number; vx: number; vz: number; length: number; kind: ShipKind;
}

export function animateIncendiary(machine: THREE.Group, effects: THREE.Group, target: () => HullTarget | null, random = Math.random) {
  const loaded = machine.getObjectByName("loaded")!;
  const brazier = machine.getObjectByName("brazier")!;
  const shot = loaded.clone();
  shot.scale.setScalar(machine.scale.x);
  const trailGeometry = new THREE.BufferGeometry();
  const trail = new THREE.Points(trailGeometry, new THREE.PointsMaterial({ color: 0xffa132, size: 0.19 }));
  const trailPositions = new THREE.Float32BufferAttribute(new Float32Array(12 * 3), 3);
  trailGeometry.setAttribute("position", trailPositions);
  trail.frustumCulled = false;
  effects.add(shot, trail);
  shot.visible = trail.visible = false;
  const origin = new THREE.Vector3(), velocity = new THREE.Vector3();
  const deckHeight = (hull: HullTarget) => hull.y + (hull.kind === "trade" ? 2.1 : 4.3);
  let phase: "ready" | "flying" | "reloading" = "ready";
  let elapsed = 0, duration = 0;
  let lastImpact: "deck" | "water" | null = null;
  const burns: { group: THREE.Group; deck: boolean; age: number; dx: number; dz: number }[] = [];
  const smoke = new THREE.Mesh(colored(new THREE.IcosahedronGeometry(0.36), 0x605851), new THREE.MeshStandardMaterial({ vertexColors: true }));
  function loose() {
    if (phase !== "ready") return;
    const hull = target();
    loaded.getWorldPosition(origin);
    duration = hull?.kind === "trireme" ? 3.5 : 2.4;
    const aim = new THREE.Vector3(0, CLIFF.seaY, 168);
    const drift = new THREE.Vector3();
    if (hull) {
      // Height scatter changes where the arc crosses the deck plane.
      const scatter = () => (random() * 2 - 1) * 3;
      aim.set(hull.x + scatter(), deckHeight(hull) + scatter(), hull.z + scatter());
      drift.set(hull.vx, 0, hull.vz);
    }
    velocity.copy(solveShot(origin, aim, drift, duration, gravity)!);
    shot.position.copy(origin);
    shot.visible = trail.visible = true;
    trailGeometry.setDrawRange(0, 0);
    loaded.visible = false;
    phase = "flying";
    elapsed = 0;
  }
  function positionAt(time: number, out: THREE.Vector3) {
    out.copy(origin).addScaledVector(velocity, time);
    out.y -= gravity * time * time / 2;
  }
  const sample = new THREE.Vector3();
  function update(t: number, dt: number) {
    brazier.scale.y = 1 + 0.18 * Math.sin(t * 12);
    loaded.children[0]!.scale.y = 1 + 0.15 * Math.sin(t * 16);
    const hull = target();
    for (let i = burns.length - 1; i >= 0; i--) {
      const b = burns[i]!;
      b.age += dt;
      if (b.age >= (b.deck ? 20 : 4) || (b.deck && !hull)) {
        b.group.removeFromParent();
        burns.splice(i, 1);
        continue;
      }
      if (b.deck && hull) b.group.position.set(hull.x + b.dx, deckHeight(hull), hull.z + b.dz);
      b.group.scale.y = 1 + 0.18 * Math.sin(b.age * 11);
      if (b.deck) b.group.children[3]!.position.y = 1.1 + (b.age % 1.6);
      else {
        b.group.scale.x = 1 + 0.16 * Math.sin(b.age * 5);
        const splash = b.group.children[3]!;
        splash.visible = b.age < 0.65;
        splash.scale.set(2 + 4 * b.age, Math.max(0.1, 1.8 - 2.7 * b.age), 2 + 4 * b.age);
      }
    }
    elapsed += dt;
    if (phase === "reloading" && elapsed >= 6) {
      phase = "ready";
      loaded.visible = true;
    }
    if (phase !== "flying") return;
    // Sample the intended deck crossing even when a long frame spans it.
    const time = elapsed >= duration && elapsed - dt < duration ? duration : elapsed;
    positionAt(time, shot.position);
    for (let i = 0; i < trailPositions.count; i++) {
      positionAt(Math.max(0, time - i * 0.023), sample);
      trailPositions.setXYZ(i, sample.x, sample.y + 0.3, sample.z);
    }
    trailPositions.needsUpdate = true;
    trailGeometry.setDrawRange(0, trailPositions.count);
    const p = shot.position;
    const deck = !!hull && Math.abs(p.x - hull.x) <= hull.length / 2 + 2 && Math.abs(p.z - hull.z) <= 4 && Math.abs(p.y - deckHeight(hull)) < 0.8;
    if (!deck && p.y > CLIFF.seaY) return;
    lastImpact = deck ? "deck" : "water";
    const patch = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const tongue = brazier.clone();
      tongue.position.set((i - 1) * 0.4, 0.36, i % 2 * 0.31);
      tongue.scale.set(3.2, 2.8 - i * 0.45, 3.2);
      patch.add(tongue);
    }
    if (deck) patch.add(smoke.clone());
    else {
      const splash = smoke.clone();
      splash.material = splashMaterial;
      splash.position.y = 0.06;
      splash.scale.set(3.5, 0.32, 2.4);
      patch.add(splash);
    }
    patch.position.set(p.x, deck ? deckHeight(hull!) : CLIFF.seaY, p.z);
    effects.add(patch);
    burns.push({ group: patch, age: 0, deck, dx: p.x - (hull?.x ?? 0), dz: p.z - (hull?.z ?? 0) });
    shot.visible = trail.visible = false;
    phase = "reloading";
    elapsed = 0;
  }
  const splashMaterial = new THREE.MeshStandardMaterial({ color: 0xafddd4 });
  return { loose, update, state: () => ({ phase, lastImpact, burns: burns.length }), dispose() {
    trailGeometry.dispose();
    trail.material.dispose();
    smoke.geometry.dispose();
    smoke.material.dispose();
    splashMaterial.dispose();
  } };
}
