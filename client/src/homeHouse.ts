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
import { HOME, HOME_BED, HOME_FLOOR_Y, HOME_STEPS, homeToWorld } from "./town";
import type { HomeArrangement, HomeKeepsakeId, HomeSlotId } from "../../shared/homeDecor";

export type HomeHouse = {
  group: THREE.Group;
  colliders: Obstacle[];
  lamp: THREE.PointLight;
  /** Swing the door by who is near, and set the lamp: lit while
   *  anyone is home, an ember when the house stands empty. Returns
   *  true on the frame the lamp is lit (for its sound). */
  update(dt: number, walkers: { x: number; z: number }[], nightMix: number): boolean;
  /** Show the keepsakes where he placed them (Task 40). */
  setDecor(arrangement: HomeArrangement): void;
  /** Where to stand to arrange the keepsakes, and to rest together (world). */
  arrangeSpot: { x: number; z: number };
  restSpot: { x: number; z: number };
  /** Inside, by the door, facing it: where she waits at night. */
  waitSpot: { x: number; z: number; face: number };
  /** Is (x, z) inside the walls? */
  inside(x: number, z: number): boolean;
  /** The bed's edge as a seat: where, which way a sitter faces, and the seat's world height. */
  bedSeat: { x: number; z: number; rotY: number; y: number };
  /** A night together (Task 45): the door held shut, the lamp dimmed
   *  (0 to 1), and the dawn through the window (0 to 1); null lets the
   *  house be itself again. */
  setHush(hush: { doorShut: boolean; lampDim: number; dawn: number } | null): void;
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
  // The steps down to the lawn before the door: the same tops a walker
  // stands on (HOME_STEPS), each a block from its top down into the ground.
  for (const step of HOME_STEPS) {
    const p = homeToWorld(0, step.lz);
    const bottom = Math.min(terrainHeight(p.x, p.z), step.top) - 0.15;
    const h = step.top - bottom;
    box(1.9, h, 0.64, plinth, 0, step.top - HOME_FLOOR_Y - h / 2, step.lz);
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
  const lampAt = lamp.position.clone();
  // A rug between the bed and the door.
  const rug = box(1.9, 0.015, 1.3, m(0x6d3b2a, 1), 0.6, 0.05, 0.6);
  rug.castShadow = false;

  // A small high window (a fenestra) in the wall beside the bed, with
  // a wooden frame and two iron bars; its pane glows with the daylight,
  // and gold with the dawn on a morning together (Task 45).
  const winZ = HOME_BED.lz + 0.45;
  const winY = 1.95;
  const paneMat = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, emissive: 0xffd9a0, emissiveIntensity: 0.2, roughness: 0.6 });
  for (const face of [-1, 1]) {
    // face -1: the room side of the wall; +1: the lawn side.
    const x = -halfW - wall / 2 + face * (wall / 2 + 0.006);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), paneMat);
    pane.position.set(x, winY, winZ);
    pane.rotation.y = face < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(pane);
    for (const [w, h, dy, dz] of [[0.74, 0.07, 0.28, 0], [0.74, 0.07, -0.28, 0], [0.07, 0.62, 0, 0.34], [0.07, 0.62, 0, -0.34]] as const) {
      box(0.05, h, w === 0.74 ? 0.74 : 0.07, m(WOOD, 0.8), x + face * 0.02, winY + dy, winZ + dz);
    }
    for (const dz of [-0.11, 0.11]) box(0.03, 0.5, 0.025, m(0x3a2a1c, 0.6, { metalness: 0.5 }), x + face * 0.03, winY, winZ + dz);
  }
  const lampDawn = new THREE.Vector3(-halfW + 0.5, winY - 0.1, winZ);
  const lampWarm = new THREE.Color(0xffb468);
  const lampMorning = new THREE.Color(0xffe2b8);
  let hush: { doorShut: boolean; lampDim: number; dawn: number } | null = null;

  // A shelf on the side wall, for keepsakes.
  box(0.3, 0.05, 1.4, wood, halfW - 0.15, 1.15, -1.3);
  for (const z of [-1.9, -0.7]) box(0.04, 0.16, 0.04, wood, halfW - 0.04, 1.06, z);

  // Keepsakes (Task 40): where each spot stands, in the house's frame,
  // and the small things themselves, built here in the town's style.
  const SLOT_AT: Record<HomeSlotId, { x: number; y: number; z: number; ry: number }> = {
    "wall-back": { x: bx, y: 1.78, z: -halfD + 0.03, ry: 0 },
    "wall-side": { x: halfW - 0.03, y: 1.6, z: 0.75, ry: -Math.PI / 2 },
    "shelf-left": { x: halfW - 0.15, y: 1.175, z: -1.75, ry: -Math.PI / 2 },
    "shelf-right": { x: halfW - 0.15, y: 1.175, z: -0.85, ry: -Math.PI / 2 },
    table: { x: tx - 0.14, y: 0.645, z: tz + 0.08, ry: 0 },
    floor: { x: halfW - 0.45, y: 0.04, z: halfD - 0.55, ry: -Math.PI / 4 },
  };
  const decorGroup = new THREE.Group();
  group.add(decorGroup);

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
  let lampLevel = 0;
  let wasHome = false;
  const doorWorld = at(0, halfD + wall + 0.6);
  const insideAt = (x: number, z: number) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const lx = (x - hx) * c - (z - hz) * s;
    const lz = (x - hx) * s + (z - hz) * c;
    return Math.abs(lx) < halfW && Math.abs(lz) < halfD;
  };
  const arrangeLocal = at(halfW - 0.85, -1.3);
  const restLocal = at(bx, bz + bd / 2 + 0.45);
  const waitLocal = at(0.35, halfD - 0.85);
  return {
    group,
    colliders,
    lamp,
    bedSeat,
    arrangeSpot: arrangeLocal,
    restSpot: restLocal,
    // Facing the door (local +z), as the house turns.
    waitSpot: { x: waitLocal.x, z: waitLocal.z, face: rot },
    setDecor(arrangement) {
      decorGroup.clear();
      for (const [slot, keepsake] of Object.entries(arrangement) as [HomeSlotId, HomeKeepsakeId][]) {
        const spot = SLOT_AT[slot];
        if (!spot || !keepsake) continue;
        const thing = buildKeepsake(keepsake);
        thing.position.set(spot.x, spot.y, spot.z);
        thing.rotation.y = spot.ry;
        decorGroup.add(thing);
      }
    },
    inside: insideAt,
    setHush(next) {
      hush = next;
    },
    update(dt, walkers, nightMix) {
      // The door opens inward as anyone comes within 3 m of it, inside
      // or out, and closes again behind them (held shut on a night together).
      const near = walkers.some((w) => Math.hypot(w.x - doorWorld.x, w.z - doorWorld.z) < 3);
      const target = near && !hush?.doorShut ? 1 : 0;
      doorOpen += (target - doorOpen) * Math.min(1, dt * 3);
      hinge.rotation.y = doorOpen * 1.75;
      // The lamp: lit while anyone is home (warm by night, soft by day),
      // an ember when the house stands empty; the flame flickers.
      const home = walkers.some((w) => insideAt(w.x, w.z));
      const lit = home && !wasHome;
      wasHome = home;
      const dim = hush ? 1 - 0.85 * hush.lampDim : 1;
      lampLevel += ((home ? dim : 0.08) - lampLevel) * Math.min(1, dt * (home ? (hush ? 0.7 : 2.5) : 0.6));
      const flicker = 0.92 + 0.08 * Math.sin(performance.now() * 0.011) * Math.sin(performance.now() * 0.0037);
      flame.scale.setScalar(0.4 + 0.6 * lampLevel);
      flame.scale.y = (1.6 + 0.4 * flicker) * (0.4 + 0.6 * lampLevel);
      // The morning together: the one light becomes the dawn through the
      // window (no second light, so no shader change), falling on the bed.
      const dawn = hush?.dawn ?? 0;
      lamp.position.lerpVectors(lampAt, lampDawn, dawn);
      lamp.color.copy(lampWarm).lerp(lampMorning, dawn);
      lamp.intensity = (1.2 + nightMix * 4.3) * flicker * lampLevel * (1 - dawn) + dawn * 5.5;
      paneMat.emissiveIntensity = 0.12 + (1 - nightMix) * 0.55 + dawn * 1.6;
      return lit;
    },
  };
}

/** One keepsake, small and built in the town's style; its origin sits
 *  where it rests (a wall item's back on the wall, facing +z). */
export function buildKeepsake(id: HomeKeepsakeId): THREE.Group {
  const g = new THREE.Group();
  const m = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const frame = (w: number, h: number, inner: number) => {
    add(new THREE.BoxGeometry(w, h, 0.04), m(0x5a3d26), 0, 0, 0.02);
    add(new THREE.BoxGeometry(w - 0.08, h - 0.08, 0.01), m(inner), 0, 0, 0.045);
  };
  switch (id) {
    case "star-chart": {
      frame(0.8, 0.56, 0x1d2747);
      const star = m(0xfff3c8, { emissive: 0xfff3c8, emissiveIntensity: 0.6 });
      for (const [x, y] of [[-0.22, 0.1], [-0.12, 0.14], [-0.05, 0.05], [0.12, 0.12], [0.2, 0.03], [0.04, -0.1], [-0.18, -0.12], [0.24, -0.15]]) {
        add(new THREE.BoxGeometry(0.018, 0.018, 0.01), star, x!, y!, 0.052);
      }
      break;
    }
    case "inscription-rubbings": {
      frame(0.62, 0.74, 0xe8e0cc);
      for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.4 - (i % 2) * 0.1, 0.022, 0.006), m(0x6d6559), 0, 0.22 - i * 0.09, 0.052);
      break;
    }
    case "fish-plaque": {
      add(new THREE.BoxGeometry(0.66, 0.3, 0.04), m(0x6b4a2f), 0, 0, 0.02);
      const fish = add(new THREE.SphereGeometry(0.1, 10, 8), m(0xb8c2c8, { metalness: 0.5, roughness: 0.4 }), -0.04, 0, 0.06);
      fish.scale.set(2.2, 0.8, 0.4);
      const tail = add(new THREE.ConeGeometry(0.07, 0.12, 4), m(0xb8c2c8, { metalness: 0.5, roughness: 0.4 }), 0.24, 0, 0.06);
      tail.rotation.z = Math.PI / 2;
      break;
    }
    case "postcard-frame": {
      frame(0.5, 0.38, 0xe0965a);
      add(new THREE.BoxGeometry(0.42, 0.1, 0.006), m(0x4d6b7a), 0, -0.09, 0.052);
      add(new THREE.CircleGeometry(0.05, 12), m(0xffe0a0, { emissive: 0xffc070, emissiveIntensity: 0.4 }), 0.1, 0.05, 0.052);
      break;
    }
    case "golden-carp-bowl": {
      add(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd7ecf2, transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0.14, 0);
      const carp = add(new THREE.SphereGeometry(0.04, 10, 8), m(0xf0a020, { emissive: 0xa05000, emissiveIntensity: 0.3 }), 0.02, 0.12, 0);
      carp.scale.set(1.8, 0.8, 0.6);
      break;
    }
    case "letter-bundle": {
      for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.24, 0.025, 0.16), m(0xf1e6cc), 0, 0.0125 + i * 0.025, 0).rotation.y = i * 0.12;
      add(new THREE.BoxGeometry(0.03, 0.09, 0.17), m(0xa3302a), 0, 0.04, 0);
      break;
    }
    case "phoenix-feather": {
      add(new THREE.CylinderGeometry(0.05, 0.07, 0.18, 10), m(0x9a5b34), 0, 0.09, 0);
      const feather = add(new THREE.ConeGeometry(0.035, 0.38, 6), m(0xff7a2a, { emissive: 0xff5a10, emissiveIntensity: 0.6 }), 0.02, 0.36, 0);
      feather.rotation.z = -0.15;
      break;
    }
    case "terrace-lantern": {
      add(new THREE.BoxGeometry(0.14, 0.02, 0.14), m(0x3a2a1c, { metalness: 0.4 }), 0, 0.01, 0);
      add(new THREE.BoxGeometry(0.1, 0.16, 0.1), m(0xffd889, { emissive: 0xffb84d, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }), 0, 0.1, 0);
      add(new THREE.ConeGeometry(0.1, 0.07, 4), m(0x3a2a1c, { metalness: 0.4 }), 0, 0.215, 0).rotation.y = Math.PI / 4;
      break;
    }
    case "harvest-basket": {
      add(new THREE.CylinderGeometry(0.22, 0.17, 0.2, 12), m(0xa07a44), 0, 0.1, 0);
      const fruit = [0xc0392b, 0x6aa84f, 0xe0a030, 0x8e44ad];
      fruit.forEach((c, i) => add(new THREE.SphereGeometry(0.06, 8, 6), m(c), Math.cos(i * 1.6) * 0.09, 0.22, Math.sin(i * 1.6) * 0.09));
      break;
    }
    case "night-lamp": {
      // A small clay oil lamp, its wick still glowing (Task 45).
      add(new THREE.SphereGeometry(0.09, 10, 6), m(0xb5532f), 0, 0.05, 0).scale.set(1.3, 0.55, 0.9);
      add(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 8), m(0xb5532f), 0.11, 0.06, 0).rotation.z = Math.PI / 2.4;
      add(new THREE.SphereGeometry(0.022, 8, 6), m(0xffc46b, { emissive: 0xffa040, emissiveIntensity: 1.4 }), 0.14, 0.1, 0).scale.y = 1.6;
      break;
    }
    case "wedding-hands": {
      // Two clasped bronze hands on a small stone base: the dextrarum iunctio of
      // Roman wedding art (Task 58). No garland: the town takes those down.
      add(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 12), m(0x8d8576), 0, 0.02, 0);
      const bronze = m(0xb08d57, { metalness: 0.55, roughness: 0.4 });
      add(new THREE.BoxGeometry(0.16, 0.06, 0.07), bronze, 0, 0.09, 0).rotation.y = 0.2;
      add(new THREE.BoxGeometry(0.16, 0.05, 0.06), bronze, 0.01, 0.12, 0.01).rotation.y = -0.2;
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 8), bronze, -0.1, 0.1, 0).rotation.z = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 8), bronze, 0.1, 0.1, 0).rotation.z = Math.PI / 2;
      break;
    }
    case "first-coin": {
      // The merchant's first coin, standing on its edge in a small clay dish (Task 56).
      add(new THREE.CylinderGeometry(0.11, 0.08, 0.04, 12), m(0xb5532f), 0, 0.02, 0);
      const coin = add(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 16), m(0xd4af37, { metalness: 0.6, roughness: 0.35 }), 0, 0.09, 0.02);
      coin.rotation.x = Math.PI / 2 - 0.25;
      break;
    }
    case "tree-cutting": {
      add(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 12), m(0xb5532f), 0, 0.12, 0);
      add(new THREE.CylinderGeometry(0.02, 0.025, 0.3, 6), m(0x6b4a2f), 0, 0.38, 0);
      add(new THREE.SphereGeometry(0.18, 10, 8), m(0x5e8c3a), 0, 0.58, 0).scale.y = 0.85;
      break;
    }
  }
  return g;
}
