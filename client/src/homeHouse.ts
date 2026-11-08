// Their house (Task 35): a small Roman house of their own, built in the
// town's low-poly style. Plastered walls on a travertine plinth, a
// terracotta gabled roof, a wooden door that swings open as someone
// comes near and closes behind them, and inside: a bed made for two
// against the back wall, an oil lamp on a small table throwing warm
// light, and a rug. Everything is built in the house's local frame
// (HOME in town.ts: local +z is the door side), and the colliders use
// the same frame, so walls and bed stop walkers where they stand.
import * as THREE from "three";
import { obb, type Obstacle } from "./collision";
import { HOME, HOME_BED, HOME_FLOOR_Y, homeToWorld } from "./town";

export type HomeHouse = {
  group: THREE.Group;
  colliders: Obstacle[];
  lamp: THREE.PointLight;
  /** Swing the door by who is near, and set the lamp for the hour. */
  update(dt: number, walkers: { x: number; z: number }[], nightMix: number): void;
  /** Is (x, z) inside the walls? */
  inside(x: number, z: number): boolean;
  /** The bed's edge as a seat: where, which way a sitter faces, and the seat's world height. */
  bedSeat: { x: number; z: number; rotY: number; y: number };
};

const PLASTER = 0xe9dcc3;
const PLINTH = 0xcbbf9f;
const TILE = 0xb5532f;
const WOOD = 0x6b4a2f;

export function buildHomeHouse(terrainHeight: (x: number, z: number) => number): HomeHouse {
  const { halfW, halfD, wallHeight, wall, doorWidth } = HOME;
  const group = new THREE.Group();
  const [hx, hz] = HOME.position;
  group.position.set(hx, HOME_FLOOR_Y, hz);
  group.rotation.y = HOME.facing;
  const m = (color: number, rough = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const plaster = m(PLASTER, 0.95);
  const plinth = m(PLINTH, 0.95);
  // The plinth, down to the lowest ground under the house, and the floor on it.
  const lowest = Math.min(
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
      const p = homeToWorld(sx! * (halfW + wall), sz! * (halfD + wall));
      return terrainHeight(p.x, p.z);
    }),
  );
  const plinthH = HOME_FLOOR_Y - lowest + 0.15;
  box((halfW + wall) * 2 + 0.3, plinthH, (halfD + wall) * 2 + 0.3, plinth, 0, -plinthH / 2, 0);
  const floor = box(halfW * 2, 0.04, halfD * 2, m(0xb89a72, 0.85), 0, 0.02, 0);
  floor.castShadow = false;
  // Two steps down to the lawn before the door.
  for (const i of [1, 2]) {
    box(1.9, 0.2, 0.64, plinth, 0, -0.1 - 0.2 * (i - 1), halfD + wall + 0.32 * (2 * i - 1));
  }
  // Walls: back, the two sides, and the front either side of the door.
  const wy = wallHeight / 2;
  box(halfW * 2 + wall * 2, wallHeight, wall, plaster, 0, wy, -halfD - wall / 2);
  for (const sx of [-1, 1]) box(wall, wallHeight, halfD * 2, plaster, sx * (halfW + wall / 2), wy, 0);
  const sideW = halfW + wall - doorWidth / 2;
  for (const sx of [-1, 1]) box(sideW, wallHeight, wall, plaster, sx * (doorWidth / 2 + sideW / 2), wy, halfD + wall / 2);
  // Over the door, a lintel of wall.
  box(doorWidth, wallHeight - 2.15, wall, plaster, 0, 2.15 + (wallHeight - 2.15) / 2, halfD + wall / 2);
  // A painted dado band inside, Pompeian red, at knee height.
  const dado = m(0x8a2f24, 0.9);
  box(halfW * 2 - 0.02, 0.9, 0.02, dado, 0, 0.45, -halfD + 0.01);
  for (const sx of [-1, 1]) box(0.02, 0.9, halfD * 2 - 0.02, dado, sx * (halfW - 0.01), 0.45, 0);
  // The roof: two terracotta slopes over a ridge running front to back.
  const tile = m(TILE, 0.8, { flatShading: true });
  const pitch = 0.5;
  const span = halfW + wall + 0.45;
  const slope = span / Math.cos(pitch);
  for (const sx of [-1, 1]) {
    // Lowered by the overhang's rise, so the gables meet the tiles and the eaves overhang the walls.
    const roof = box(slope, 0.14, (halfD + wall) * 2 + 0.7, tile, (sx * span) / 2, wallHeight + Math.tan(pitch) * (span / 2 - 0.45) + 0.07, 0);
    roof.rotation.z = -sx * pitch;
  }
  // The gables, plaster triangles front and back.
  const gableShape = new THREE.Shape([new THREE.Vector2(-halfW - wall, 0), new THREE.Vector2(halfW + wall, 0), new THREE.Vector2(0, Math.tan(pitch) * (halfW + wall))]);
  for (const sz of [-1, 1]) {
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(gableShape), plaster);
    gable.position.set(0, wallHeight, sz * (halfD + wall / 2));
    gable.material = plaster;
    (gable.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    group.add(gable);
  }
  // The door: a plank leaf hinged at the doorway's left jamb.
  const hinge = new THREE.Group();
  hinge.position.set(-doorWidth / 2 + 0.03, 0, halfD + wall / 2);
  group.add(hinge);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.06, 2.1, 0.08), m(WOOD, 0.85));
  leaf.position.set((doorWidth - 0.06) / 2, 1.05, 0);
  leaf.castShadow = true;
  hinge.add(leaf);
  for (const y of [0.4, 1.7]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.1, 0.07, 0.1), m(0x3a2a1c, 0.6, { metalness: 0.4 }));
    band.position.set((doorWidth - 0.06) / 2, y, 0);
    hinge.add(band);
  }
  // The bed for two: a wooden frame, a mattress, two pillows, a red blanket.
  const bx = HOME_BED.lx;
  const bz = HOME_BED.lz;
  const bw = HOME_BED.halfW * 2;
  const bd = HOME_BED.halfD * 2;
  const wood = m(WOOD, 0.8);
  box(bw + 0.1, 0.32, bd + 0.1, wood, bx, 0.24, bz);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.1, 0.12, 0.1, wood, bx + px! * (bw / 2), 0.04, bz + pz! * (bd / 2));
  box(bw + 0.14, 0.95, 0.09, wood, bx, 0.58, bz - bd / 2 - 0.05); // headboard
  box(bw, 0.16, bd, m(0xeee3cc, 1), bx, 0.48, bz); // mattress, its top at HOME_BED.top
  for (const px of [-0.38, 0.38]) {
    const pillow = box(0.62, 0.12, 0.36, m(0xf7f3ea, 1), bx + px, HOME_BED.top + 0.05, bz - bd / 2 + 0.26);
    pillow.scale.set(1, 1, 1);
  }
  box(bw + 0.04, 0.05, bd * 0.62, m(0x8e2f27, 0.95), bx, HOME_BED.top + 0.01, bz + bd * 0.19); // the blanket
  // The lamp: an oil lamp on a small table beside the bed, a warm flame.
  const tx = bx + bw / 2 + 0.55;
  const tz = -halfD + 0.45;
  box(0.5, 0.05, 0.5, wood, tx, 0.62, tz);
  box(0.06, 0.6, 0.06, wood, tx, 0.3, tz);
  box(0.24, 0.07, 0.12, m(0xb07a3e, 0.5, { metalness: 0.5 }), tx, 0.68, tz);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
  flame.position.set(tx + 0.1, 0.75, tz);
  flame.scale.y = 1.8;
  group.add(flame);
  const lamp = new THREE.PointLight(0xffb468, 0, 7.5, 2);
  lamp.position.set(tx + 0.1, 0.95, tz);
  group.add(lamp);
  // A rug between the bed and the door.
  const rug = box(1.9, 0.015, 1.3, m(0x6d3b2a, 1), 0.6, 0.05, 0.6);
  rug.castShadow = false;

  // Colliders, in the house's frame turned into the world's.
  const rot = HOME.facing;
  const at = (lx: number, lz: number) => homeToWorld(lx, lz);
  const ob = (lx: number, lz: number, hw: number, hd: number) => {
    const p = at(lx, lz);
    return obb(p.x, p.z, hw, hd, rot);
  };
  const colliders: Obstacle[] = [
    ob(0, -halfD - wall / 2, halfW + wall, wall / 2),
    ob(-(halfW + wall / 2), 0, wall / 2, halfD + wall),
    ob(halfW + wall / 2, 0, wall / 2, halfD + wall),
    ob(-(doorWidth / 2 + sideW / 2), halfD + wall / 2, sideW / 2, wall / 2),
    ob(doorWidth / 2 + sideW / 2, halfD + wall / 2, sideW / 2, wall / 2),
    ob(bx, bz, bw / 2 + 0.05, bd / 2 + 0.05),
    ob(tx, tz, 0.25, 0.25),
  ];
  // The bed's edge as a seat: on the side toward the room, facing out
  // (local +x); a sitter at rotY faces (-sin, -cos) of rotY, so this is
  // the house's turn less a quarter.
  const seatLocal = { x: bx + bw / 2 - 0.22, z: bz + 0.25 };
  const seatWorld = at(seatLocal.x, seatLocal.z);
  const bedSeat = { x: seatWorld.x, z: seatWorld.z, rotY: rot - Math.PI / 2, y: HOME_FLOOR_Y + HOME_BED.top };

  let doorOpen = 0;
  const doorWorld = at(0, halfD + wall + 0.6);
  return {
    group,
    colliders,
    lamp,
    bedSeat,
    inside(x, z) {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const dx = x - hx;
      const dz = z - hz;
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      return Math.abs(lx) < halfW && Math.abs(lz) < halfD;
    },
    update(dt, walkers, nightMix) {
      // The door opens inward as anyone comes within 3 m of it, inside
      // or out, and closes again behind them.
      const near = walkers.some((w) => Math.hypot(w.x - doorWorld.x, w.z - doorWorld.z) < 3);
      const target = near ? 1 : 0;
      doorOpen += (target - doorOpen) * Math.min(1, dt * 3);
      hinge.rotation.y = doorOpen * 1.75;
      // The lamp burns warm by night, softly by day; the flame flickers.
      const flicker = 0.92 + 0.08 * Math.sin(performance.now() * 0.011) * Math.sin(performance.now() * 0.0037);
      lamp.intensity = (1.2 + nightMix * 4.3) * flicker;
      flame.scale.y = 1.6 + 0.4 * flicker;
    },
  };
}
