// Their house (Task 35, made a noble's Roman domus in Task 76), built in the
// town's low-poly style from code, no new assets. The plan itself (the rooms,
// the walls and their doorways, the roofs, the spots) is data in homePlan.ts,
// with the sources: Vitruvius, De architectura VI, and the houses of Pompeii
// (the House of the Faun, the House of the Vettii). From the lawn: a porch
// with two columns (the vestibulum, distyle in antis) over the steps, the
// door (a wooden leaf that swings open as someone comes near), the fauces,
// the tall atrium with its compluvium and impluvium, the tablinum looking
// straight through to the peristyle's garden; the dining room (triclinium),
// two bedrooms (cubicula) and a closet off the atrium; the bed for two in
// the bedroom of the wing, the one oil lamp beside it. Everything is built in
// the house's local frame (HOME in town.ts: local +z is the door side), and
// the colliders use the same frame, so walls, columns, pools, couches and the
// bed stop walkers where they stand.
//
// Static dressing is batched by material (a few dozen meshes, not a thousand);
// only what moves or changes is its own object: the door, the flames, the lamp,
// the tender props and the keepsakes.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { circ, obb, type Obstacle } from "./collision";
import { HOME, HOME_BED, HOME_FLOOR_Y, HOME_STEPS, homeToWorld } from "./town";
import {
  ATRIUM_COLUMNS, ATRIUM_ROOF, COLUMN_H, COLUMN_R, COMPLUVIUM, H_ATRIUM, H_COMPLUVIUM, IMPLUVIUM, LAMP_TABLE, PERISTYLE_COLUMNS, PERISTYLE_POOL, PERISTYLE_PUTTO,
  PORTICO, PORTICO_COLUMNS, ROOMS, SLABS, SPOTS, WALLS, inRect, insideRooms, shelteredAt, slabAt,
  type Fresco, type Rect, type Slab, type Wall,
} from "./homePlan";
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
  /** Is (x, z) inside the walls (any room, and the peristyle's garden court)? */
  inside(x: number, z: number): boolean;
  /** Is (x, z) under a roof, so that no rain falls on it? Wherever a roof lies above:
   *  the roofed rooms, their thresholds, the eaves, the gallery's overhang and the
   *  porch; but not the compluvium (over the impluvium) and not the garden court,
   *  which stands open to the sky as every peristyle does. */
  sheltered(x: number, z: number): boolean;
  /** The impluvium's built water surface (world y) when (x, z) lies over the water sheet, else null. */
  waterSurfaceAt(x: number, z: number): number | null;
  /** The bed's edge as a seat: where, which way a sitter faces, and the seat's world height. */
  bedSeat: { x: number; z: number; rotY: number; y: number };
  /** A night together (Task 45): the door held shut, the lamp dimmed
   *  (0 to 1), and the dawn through the window (0 to 1); null lets the
   *  house be itself again. */
  setHush(hush: { doorShut: boolean; lampDim: number; dawn: number } | null): void;
  /** A tender moment's small prop (Task 59): "fire" (a low brazier the house's one lamp
   *  turns to), "tray" (bread and warm milk on a stool), "letter" (folded on the pillow);
   *  null puts them all away. No second light, so no shader change. */
  setTender(prop: "fire" | "tray" | "letter" | null): void;
};

// The town's palette: the plaster, the travertine, the terracotta, the oak,
// and the Pompeian reds and ochres of the painted rooms.
const PLASTER = 0xe9dcc3;
const PLINTH = 0xcbbf9f;
const TILE = 0xb5532f;
const WOOD = 0x6b4a2f;
const RED = 0x8a2f24;
const OCHRE = 0xc9923a;
const BLACK = 0x2b2622;
const CREAM = 0xefe3c4;
const MARBLE = 0xece6d8;

type Spec = { color: number; rough?: number; metal?: number; emissive?: number; glow?: number; flat?: boolean; cast?: boolean };
const S = (color: number, rough = 0.9, extra: Partial<Spec> = {}): Spec => ({ color, rough, ...extra });
/** Flat floor and painted layers: they receive shadow but cast none. */
const FLATS = (color: number, rough = 0.85): Spec => ({ color, rough, cast: false });

/** Static geometry, gathered by material and merged: one mesh per material. */
class Batch {
  private map = new Map<string, { spec: Spec; geos: THREE.BufferGeometry[] }>();
  constructor(private root: THREE.Object3D) {}
  put(geo: THREE.BufferGeometry, spec: Spec, matrix: THREE.Matrix4): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.applyMatrix4(matrix);
    const key = JSON.stringify(spec);
    let entry = this.map.get(key);
    if (!entry) this.map.set(key, (entry = { spec, geos: [] }));
    entry.geos.push(g);
  }
  box(w: number, h: number, d: number, spec: Spec, x: number, y: number, z: number, ry = 0, rz = 0, rx = 0): void {
    this.put(new THREE.BoxGeometry(w, h, d), spec, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  }
  cyl(rTop: number, rBottom: number, h: number, spec: Spec, x: number, y: number, z: number, seg = 10): void {
    this.put(new THREE.CylinderGeometry(rTop, rBottom, h, seg), spec, new THREE.Matrix4().makeTranslation(x, y, z));
  }
  sphere(r: number, spec: Spec, x: number, y: number, z: number, sy = 1): void {
    this.put(new THREE.SphereGeometry(r, 8, 6), spec, new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeScale(1, sy, 1)));
  }
  flush(): void {
    for (const { spec, geos } of this.map.values()) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const mat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: spec.rough ?? 0.9, metalness: spec.metal ?? 0, flatShading: spec.flat ?? false });
      if (spec.emissive !== undefined) {
        mat.emissive = new THREE.Color(spec.emissive);
        mat.emissiveIntensity = spec.glow ?? 0.5;
      }
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = spec.cast !== false;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      for (const g of geos) g.dispose();
    }
    this.map.clear();
  }
}

/** Height of the impluvium's water sheet above the court floor (local y). */
export const IMPLUVIUM_WATER_Y = 0.1;
/** Height of the peristyle garden pool's water sheet above the court floor (local y). */
export const PERISTYLE_WATER_Y = 0.17;
/** A splash ring floats this far above the surface it lands on (water or floor). */
export const SPLASH_RING_LIFT = 0.06;

/** Where a ground splash ring may land: null under any roof of the house (no rain falls
 *  there), else the surface's height: the built water of the impluvium where the ring is
 *  over the basin or the round garden pool, otherwise the ground (the floor, in the open court). */
export function splashLanding(house: Pick<HomeHouse, "sheltered" | "waterSurfaceAt">, x: number, z: number, ground: (x: number, z: number) => number): number | null {
  if (house.sheltered(x, z)) return null;
  return house.waterSurfaceAt(x, z) ?? ground(x, z);
}

/** The ring's y: the landing surface plus the explicit visual offset; null when sheltered. */
export function splashRingY(house: Pick<HomeHouse, "sheltered" | "waterSurfaceAt">, x: number, z: number, ground: (x: number, z: number) => number): number | null {
  const y = splashLanding(house, x, z, ground);
  return y === null ? null : y + SPLASH_RING_LIFT;
}

export function buildHomeHouse(terrainHeight: (x: number, z: number) => number): HomeHouse {
  const { wall, doorWidth } = HOME;
  const group = new THREE.Group();
  const [hx, hz] = HOME.position;
  group.position.set(hx, HOME_FLOOR_Y, hz);
  group.rotation.y = HOME.facing;
  const m = (color: number, rough = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const b = new Batch(group);
  const frontZ = HOME.halfD + wall / 2; // the front wall's centre: the door's plane

  // The door: a plank leaf hinged at the doorway's left jamb. The first Group
  // the house holds (the night-together test finds it by that).
  const hinge = new THREE.Group();
  hinge.position.set(-doorWidth / 2 + 0.03, 0, frontZ);
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

  // ---- The podium: travertine down to the lowest ground under each block, the
  // floors on it (the same floor height as the cottage's), the steps to the lawn.
  const podium = (r: Rect) => {
    let low = Infinity;
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const p = homeToWorld(r.x0 + ((r.x1 - r.x0) * i) / 4, r.z0 + ((r.z1 - r.z0) * j) / 4);
        low = Math.min(low, terrainHeight(p.x, p.z));
      }
    }
    const h = HOME_FLOOR_Y - low + 0.18;
    b.box(r.x1 - r.x0, h, r.z1 - r.z0, S(PLINTH, 0.95), (r.x0 + r.x1) / 2, -h / 2 - 0.03, (r.z0 + r.z1) / 2);
  };
  podium({ x0: -2.97, x1: 6.57, z0: -2.55, z1: 3.57 });
  podium({ x0: -0.95, x1: 4.25, z0: -3.5, z1: -2.45 });
  podium({ x0: -0.95, x1: 3.55, z0: -4.85, z1: -3.45 });
  // The steps down to the lawn before the door: the same tops a walker
  // stands on (HOME_STEPS), each a block from its top down into the ground.
  for (const step of HOME_STEPS) {
    const p = homeToWorld(0, step.lz);
    const bottom = Math.min(terrainHeight(p.x, p.z), step.top) - 0.15;
    const h = step.top - bottom;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.9, h, 0.64), m(PLINTH, 0.95));
    block.position.set(0, step.top - HOME_FLOOR_Y - h / 2, step.lz);
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
  }

  // ---- Walls, with their doorways, their frescoes, and their colliders.
  const rot = HOME.facing;
  const at = (lx: number, lz: number) => homeToWorld(lx, lz);
  const ob = (lx: number, lz: number, hw: number, hd: number, pad = 0.3): Obstacle => {
    const p = at(lx, lz);
    return { ...obb(p.x, p.z, hw, hd, rot), pad };
  };
  const co = (lx: number, lz: number, r: number, pad = 0.12): Obstacle => {
    const p = at(lx, lz);
    return circ(p.x, p.z, r, pad);
  };
  const colliders: Obstacle[] = [];
  const plaster = S(PLASTER, 0.95);
  const topAt = (w: Wall, u: number) => w.top[0] + ((w.top[1] - w.top[0]) * (u - w.a)) / (w.b - w.a);
  /** A wall piece from u0 to u1, its foot at y0 (0, or an opening's lintel height), its top following the roof. */
  const piece = (w: Wall, u0: number, u1: number, y0: number) => {
    if (u1 - u0 < 0.01) return;
    const shape = new THREE.Shape([new THREE.Vector2(u0, y0), new THREE.Vector2(u1, y0), new THREE.Vector2(u1, topAt(w, u1)), new THREE.Vector2(u0, topAt(w, u0))]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: w.t, bevelEnabled: false });
    const mat4 = w.axis === "x"
      ? new THREE.Matrix4().makeTranslation(0, 0, w.c - w.t / 2)
      : new THREE.Matrix4().makeTranslation(w.c + w.t / 2, 0, 0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
    b.put(geo, plaster, mat4);
  };
  /** One flat painted layer on a wall's face between u0 and u1 and y0..y1; later layers sit proud of earlier. */
  const paint = (w: Wall, side: 1 | -1, u0: number, u1: number, y0: number, y1: number, color: number, layer: number) => {
    if (u1 - u0 < 0.005 || y1 - y0 < 0.005) return;
    const th = 0.006;
    const face = w.c + side * (w.t / 2 + th / 2 + layer * 0.004);
    if (w.axis === "x") b.box(u1 - u0, y1 - y0, th, FLATS(color), (u0 + u1) / 2, (y0 + y1) / 2, face);
    else b.box(th, y1 - y0, u1 - u0, FLATS(color), face, (y0 + y1) / 2, (u0 + u1) / 2);
  };
  const diamond = (w: Wall, side: 1 | -1, u: number, y: number, size: number, color: number, layer: number) => {
    const th = 0.006;
    const face = w.c + side * (w.t / 2 + th / 2 + layer * 0.004);
    if (w.axis === "x") b.box(size, size, th, FLATS(color), u, y, face, 0, Math.PI / 4);
    else b.box(th, size, size, FLATS(color), face, y, u, 0, 0, Math.PI / 4);
  };
  /** The fresco on one solid piece's face: a dado, panels of frame and field with
   *  black or red candelabra between, a cornice band; or the garden of the peristyle. */
  const fresco = (w: Wall, side: 1 | -1, style: Fresco, u0: number, u1: number) => {
    const len = u1 - u0;
    if (style === "plain" || len < 0.3) return;
    const topMin = Math.min(topAt(w, u0), topAt(w, u1));
    if (style === "outer") {
      paint(w, side, u0, u1, 0, 0.55, RED, 0);
      paint(w, side, u0, u1, 0.55, 0.6, OCHRE, 1);
      return;
    }
    const fieldTop = Math.min(2.4, topMin - 0.12);
    if (fieldTop < 1.2) return;
    if (style === "garden") {
      paint(w, side, u0, u1, 0, 0.5, 0x4d6e3a, 0);
      paint(w, side, u0, u1, 0.5, fieldTop, 0xbfd8e2, 0);
      const n = Math.max(1, Math.round(len / 1.0));
      const pw = len / n;
      for (let k = 0; k < n; k++) {
        const c = u0 + (k + 0.5) * pw;
        paint(w, side, c - pw * 0.4, c + pw * 0.4, 0.5, 1.1, 0x6a9448, 1);
        paint(w, side, c - pw * 0.2, c + pw * 0.2, 1.1, 1.35, 0x5a8040, 1);
        diamond(w, side, c - 0.18, 1.5, 0.12, k % 2 ? 0xd9473a : 0xf0cf4a, 2);
        diamond(w, side, c + 0.16, 1.4, 0.1, 0xf5f0e6, 2);
        paint(w, side, c + 0.05 * (k % 2 ? 1 : -1) - 0.07, c + 0.05 * (k % 2 ? 1 : -1) + 0.07, 1.9, 1.96, CREAM, 2);
      }
      paint(w, side, u0, u1, fieldTop, fieldTop + 0.06, OCHRE, 1);
      return;
    }
    const field = style === "red" ? RED : style === "ochre" ? 0xd6a647 : 0x26211f;
    const frame = style === "red" ? OCHRE : RED;
    const sep = style === "ochre" ? RED : BLACK;
    const dado = style === "red" ? 0x2f2824 : RED;
    paint(w, side, u0, u1, 0, 0.8, dado, 0);
    paint(w, side, u0, u1, 0.8, 0.86, OCHRE, 1);
    const n = Math.max(1, Math.round((len - 0.1) / 1.1));
    const pw = len / n;
    for (let k = 0; k < n; k++) {
      const s0 = u0 + k * pw;
      const s1 = s0 + pw;
      paint(w, side, s0 + 0.07, s1 - 0.07, 0.92, fieldTop, frame, 0);
      paint(w, side, s0 + 0.13, s1 - 0.13, 0.98, fieldTop - 0.06, field, 1);
      if (pw > 0.7) diamond(w, side, (s0 + s1) / 2, (0.98 + fieldTop) / 2, Math.min(0.3, pw * 0.28), CREAM, 2);
      if (k > 0) paint(w, side, s0 - 0.04, s0 + 0.04, 0.86, fieldTop + 0.04, sep, 2);
    }
    paint(w, side, u0, u1, fieldTop + 0.04, fieldTop + 0.16, 0xe5d8b8, 1);
  };
  for (const w of WALLS) {
    let cursor = w.a;
    const solids: [number, number][] = [];
    for (const o of [...w.open].sort((p, q) => p.from - q.from)) {
      if (o.from > cursor) solids.push([cursor, o.from]);
      piece(w, o.from, o.to, o.h); // the lintel over the doorway
      cursor = o.to;
    }
    solids.push([cursor, w.b]);
    for (const [u0, u1] of solids) {
      if (u1 - u0 < 0.01) continue;
      piece(w, u0, u1, 0);
      if (w.pos) fresco(w, 1, w.pos, u0, u1);
      if (w.neg) fresco(w, -1, w.neg, u0, u1);
      const mid = (u0 + u1) / 2;
      colliders.push(w.axis === "x" ? ob(mid, w.c, (u1 - u0) / 2, w.t / 2) : ob(w.c, mid, w.t / 2, (u1 - u0) / 2));
    }
  }
  // The door's stone frame, and the porch's antae against the front wall.
  const stone = S(MARBLE, 0.6);
  for (const sx of [-1, 1]) b.box(0.14, 2.22, 0.3, stone, sx * (doorWidth / 2 + 0.07), 1.11, frontZ + 0.05);
  b.box(doorWidth + 0.42, 0.14, 0.32, stone, 0, 2.29, frontZ + 0.05);

  // ---- Floors: each room's slab (its top is the walkers' floor), and the mosaics.
  const slab = (r: Rect, spec: Spec) => b.box(r.x1 - r.x0, 0.06, r.z1 - r.z0, spec, (r.x0 + r.x1) / 2, -0.03, (r.z0 + r.z1) / 2);
  const white = 0xe3dac4;
  const flat = (w: number, d: number, color: number, x: number, z: number, layer: number, ry = 0) =>
    b.box(w, 0.004, d, FLATS(color, 0.55), x, 0.002 + layer * 0.0025, z, ry);
  const strips = (r: Rect, inset: number, width: number, color: number, layer: number) => {
    const x0 = r.x0 + inset, x1 = r.x1 - inset, z0 = r.z0 + inset, z1 = r.z1 - inset;
    flat(x1 - x0, width, color, (x0 + x1) / 2, z0 + width / 2, layer);
    flat(x1 - x0, width, color, (x0 + x1) / 2, z1 - width / 2, layer);
    flat(width, z1 - z0 - 2 * width, color, x0 + width / 2, (z0 + z1) / 2, layer);
    flat(width, z1 - z0 - 2 * width, color, x1 - width / 2, (z0 + z1) / 2, layer);
  };
  /** A band of alternating black and white tesserae (a chequer border). */
  const checker = (r: Rect, inset: number, size: number, layer: number) => {
    const x0 = r.x0 + inset, x1 = r.x1 - inset, z0 = r.z0 + inset, z1 = r.z1 - inset;
    const nx = Math.max(1, Math.floor((x1 - x0) / size));
    const nz = Math.max(1, Math.floor((z1 - z0) / size));
    const sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
    for (let i = 0; i < nx; i++) for (const z of [z0 + sz / 2, z1 - sz / 2]) flat(sx, sz, (i + (z < (z0 + z1) / 2 ? 0 : 1)) % 2 ? BLACK : white, x0 + (i + 0.5) * sx, z, layer);
    for (let j = 1; j < nz - 1; j++) for (const x of [x0 + sx / 2, x1 - sx / 2]) flat(sx, sz, (j + (x < (x0 + x1) / 2 ? 0 : 1)) % 2 ? BLACK : white, x, z0 + (j + 0.5) * sz, layer);
  };
  /** A central emblem: a black diamond, a white one, a red square, a gold boss. */
  const emblem = (x: number, z: number, r: number) => {
    flat(r * 1.9, r * 1.9, BLACK, x, z, 3, Math.PI / 4);
    flat(r * 1.35, r * 1.35, white, x, z, 4, Math.PI / 4);
    flat(r * 0.8, r * 0.8, RED, x, z, 5);
    b.cyl(r * 0.22, r * 0.22, 0.004, FLATS(0xc9a24a, 0.4), x, 0.0125, z, 12);
  };
  const mosaic = (r: Rect, opts: { checker?: boolean; emblem?: number }) => {
    flat(r.x1 - r.x0 - 0.12, r.z1 - r.z0 - 0.12, white, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, 1);
    strips(r, 0.08, 0.1, BLACK, 2);
    strips(r, 0.2, 0.06, RED, 2);
    if (opts.checker) checker(r, 0.3, 0.2, 2);
    if (opts.emblem) emblem((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, opts.emblem);
  };
  slab({ x0: -2.82, x1: 6.42, z0: -2.4, z1: 3.42 }, FLATS(0x9c8b70, 0.9)); // under every wall and room
  slab({ x0: -0.9, x1: 4.1, z0: -3.4, z1: -2.4 }, FLATS(0x9c8b70, 0.9));
  slab({ x0: -0.9, x1: 3.4, z0: -4.8, z1: -3.4 }, FLATS(0x9c8b70, 0.9));
  for (const id of ["cellS", "cellN", "closet", "passage"] as const) flat(ROOMS[id].x1 - ROOMS[id].x0, ROOMS[id].z1 - ROOMS[id].z0, 0xb58a64, (ROOMS[id].x0 + ROOMS[id].x1) / 2, (ROOMS[id].z0 + ROOMS[id].z1) / 2, 0);
  mosaic(ROOMS.fauces, { emblem: 0.28 });
  mosaic(ROOMS.atrium, { checker: true });
  mosaic(ROOMS.tablinum, { emblem: 0.45 });
  mosaic(ROOMS.triclinium, { checker: true, emblem: 0.55 });
  mosaic(ROOMS.cubiculum, {});
  // The peristyle's gallery: terracotta paving with a white border; the garden: lawn and stepping stones.
  flat(ROOMS.gallery.x1 - ROOMS.gallery.x0, ROOMS.gallery.z1 - ROOMS.gallery.z0, 0xb98f6e, (ROOMS.gallery.x0 + ROOMS.gallery.x1) / 2, (ROOMS.gallery.z0 + ROOMS.gallery.z1) / 2, 0);
  strips(ROOMS.gallery, 0.06, 0.06, white, 1);
  const g = ROOMS.garden;
  b.box(g.x1 - g.x0, 0.03, g.z1 - g.z0, FLATS(0x6f9a4a, 1), (g.x0 + g.x1) / 2, 0.0, (g.z0 + g.z1) / 2);
  for (let i = 0; i < 4; i++) flat(0.5, 0.34, 0xcbbf9f, 0.15 + (i % 2) * 0.12, -3.35 - i * 0.28, 4, 0.1);
  // The porch's pavement, its top a hair under the steps' (HOME_STEPS stays the walker's ground).
  const porchTop = (HOME_STEPS.length ? Math.min(...HOME_STEPS.map((s) => s.top)) - HOME_FLOOR_Y : -0.05) - 0.012;
  b.box(PORTICO.x1 - PORTICO.x0, 0.3, PORTICO.z1 - PORTICO.z0 - 0.06, S(PLINTH, 0.95), 0, porchTop - 0.15, (PORTICO.z0 + PORTICO.z1) / 2 + 0.03);

  // ---- Columns: white marble shafts with a red foot (Pompeii), a flared capital, an abacus.
  const column = (x: number, z: number, topY: number, y0 = 0) => {
    const total = topY - y0;
    const shaft = total - 0.29;
    b.box(0.42, 0.09, 0.42, S(MARBLE, 0.5), x, y0 + 0.045, z);
    const foot = shaft * 0.3;
    b.cyl(COLUMN_R, COLUMN_R + 0.015, foot, S(0x9a3328, 0.6), x, y0 + 0.09 + foot / 2, z);
    b.cyl(COLUMN_R - 0.015, COLUMN_R, shaft - foot, S(MARBLE, 0.5), x, y0 + 0.09 + foot + (shaft - foot) / 2, z);
    b.cyl(0.23, COLUMN_R - 0.015, 0.14, S(MARBLE, 0.5), x, y0 + 0.09 + shaft + 0.07, z);
    b.box(0.5, 0.06, 0.5, S(MARBLE, 0.5), x, y0 + 0.09 + shaft + 0.17, z);
  };
  for (const [x, z] of ATRIUM_COLUMNS) {
    column(x, z, COLUMN_H);
    colliders.push(co(x, z, COLUMN_R + 0.03));
  }
  // Beams over the atrium's side columns, from the wall to the inner column.
  for (const sx of [-1, 1]) b.box(1.3, 0.16, 0.2, S(WOOD, 0.8), sx * 1.95, COLUMN_H + 0.08, 0.5);
  // The compluvium's frame of beams, at the opening's edge.
  const cx = (COMPLUVIUM.x0 + COMPLUVIUM.x1) / 2;
  const cz = (COMPLUVIUM.z0 + COMPLUVIUM.z1) / 2;
  const cw = COMPLUVIUM.x1 - COMPLUVIUM.x0;
  const cd = COMPLUVIUM.z1 - COMPLUVIUM.z0;
  for (const sz of [-1, 1]) b.box(cw + 0.3, 0.14, 0.16, S(WOOD, 0.8), cx, H_COMPLUVIUM, cz + (sz * (cd + 0.16)) / 2);
  for (const sx of [-1, 1]) b.box(0.16, 0.14, cd + 0.3, S(WOOD, 0.8), cx + (sx * (cw + 0.16)) / 2, H_COMPLUVIUM, cz);
  // The peristyle's colonnade along the gallery's garden edge, and its architrave.
  const galleryTop = 2.62;
  for (const [x, z] of PERISTYLE_COLUMNS) {
    column(x, z, galleryTop - 0.2);
    colliders.push(co(x, z, COLUMN_R + 0.03));
  }
  b.box(4.4, 0.2, 0.26, S(MARBLE, 0.55), 1.55, galleryTop - 0.1, -3.15);
  // The porch: two columns before the antae, an architrave, a gabled roof, a pediment.
  const porchTopY = 2.55;
  for (const [x, z] of PORTICO_COLUMNS) {
    column(x, z, porchTopY, porchTop);
    colliders.push(co(x, z, COLUMN_R + 0.03));
  }
  for (const sx of [-1, 1]) b.box(0.34, porchTopY + porchTop + 0.1, 0.22, S(MARBLE, 0.55), sx * 1.75, (porchTopY + porchTop + 0.1) / 2 - 0.05, PORTICO.z0 + 0.11);
  b.box(3.9, 0.26, 0.3, S(MARBLE, 0.55), 0, porchTopY + 0.13, 4.65);
  {
    const run = 1.95;
    const rise = 0.55;
    const len = Math.hypot(run, rise);
    const phi = Math.atan2(rise, run);
    const depth = PORTICO.z1 + 0.1 - PORTICO.z0;
    for (const sx of [-1, 1]) b.box(len, 0.1, depth, S(TILE, 0.8, { flat: true }), (sx * run) / 2, 2.95 + rise / 2 + 0.07, (PORTICO.z0 + PORTICO.z1 + 0.1) / 2, 0, -sx * phi);
    const ped = new THREE.Shape([new THREE.Vector2(-run, 2.78), new THREE.Vector2(run, 2.78), new THREE.Vector2(0, 2.95 + rise)]);
    const tym = new THREE.Shape([new THREE.Vector2(-run + 0.35, 2.9), new THREE.Vector2(run - 0.35, 2.9), new THREE.Vector2(0, 2.95 + rise - 0.14)]);
    b.put(new THREE.ShapeGeometry(ped), S(PLASTER, 0.95), new THREE.Matrix4().makeTranslation(0, 0, PORTICO.z1 + 0.02));
    b.put(new THREE.ShapeGeometry(tym), FLATS(RED, 0.9), new THREE.Matrix4().makeTranslation(0, 0, PORTICO.z1 + 0.025));
    b.box(0.2, 0.2, 0.06, S(OCHRE, 0.7), 0, 3.35, PORTICO.z1 + 0.05, 0, Math.PI / 4); // a boss in the tympanum
  }

  // ---- The roofs: terracotta slabs with their tile ribs, the atrium's four slopes falling to the compluvium.
  const tile = S(TILE, 0.8, { flat: true });
  const rib = S(0x984326, 0.85, { flat: true });
  const slabMesh = (s: Slab) => {
    const r = s.rect;
    const dy = s.y1 - s.y0;
    const du = s.u1 - s.u0;
    const L = Math.hypot(du, dy);
    const ang = Math.atan2(dy, du);
    const mx = (r.x0 + r.x1) / 2;
    const mz = (r.z0 + r.z1) / 2;
    const my = (s.y0 + s.y1) / 2;
    const lift = (0.07 / Math.cos(ang));
    if (s.axis === "x") {
      b.box(L, 0.12, r.z1 - r.z0, tile, mx, my + lift, mz, 0, ang);
      for (let z = r.z0 + 0.25; z < r.z1 - 0.1; z += 0.5) b.box(L, 0.05, 0.05, rib, mx, my + lift + 0.07, z, 0, ang);
    } else {
      b.box(r.x1 - r.x0, 0.12, L, tile, mx, my + lift, mz, 0, 0, -ang);
      for (let x = r.x0 + 0.25; x < r.x1 - 0.1; x += 0.5) b.box(0.05, 0.05, L, rib, x, my + lift + 0.07, mz, 0, 0, -ang);
    }
  };
  for (const s of SLABS) slabMesh(s);
  {
    // The atrium's roof: outer rim at the walls' top, inner rim at the compluvium.
    const o = ATRIUM_ROOF;
    const i = COMPLUVIUM;
    const P = (x: number, y: number, z: number) => [x, y, z];
    const yo = H_ATRIUM;
    const yi = H_COMPLUVIUM;
    const quads = [
      [P(o.x0, yo, o.z0), P(o.x1, yo, o.z0), P(i.x1, yi, i.z0), P(i.x0, yi, i.z0)],
      [P(o.x1, yo, o.z1), P(o.x0, yo, o.z1), P(i.x0, yi, i.z1), P(i.x1, yi, i.z1)],
      [P(o.x0, yo, o.z1), P(o.x0, yo, o.z0), P(i.x0, yi, i.z0), P(i.x0, yi, i.z1)],
      [P(o.x1, yo, o.z0), P(o.x1, yo, o.z1), P(i.x1, yi, i.z1), P(i.x1, yi, i.z0)],
    ];
    const pos: number[] = [];
    for (const q of quads) for (const k of [0, 1, 2, 0, 2, 3]) pos.push(...q[k]!);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const roofMat = new THREE.MeshStandardMaterial({ color: TILE, roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(geo, roofMat);
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);
    // A terracotta cornice crowns the tall atrium walls.
    const rimY = H_ATRIUM + 0.06;
    b.box(5.76, 0.12, 0.26, tile, 0, rimY, o.z0 + 0.05);
    b.box(5.76, 0.12, 0.26, tile, 0, rimY, o.z1 - 0.05);
    for (const sx of [-1, 1]) b.box(0.26, 0.12, 2.96, tile, sx * (o.x1 - 0.05), rimY, 0.5);
  }
  // Antefixes: upright palmette tiles along the eaves (Vitruvius's Etruscan temple gave them to the house).
  const ante = (x: number, y: number, z: number, ry = 0) => {
    b.box(0.1, 0.18, 0.04, S(OCHRE, 0.7), x, y + 0.09, z, ry);
    b.box(0.07, 0.07, 0.04, S(0xd9b25a, 0.6), x, y + 0.2, z, ry, Math.PI / 4);
  };
  for (let x = -3.0; x <= 2.6; x += 0.4) ante(x, slabAt(SLABS[0]!, x, 3.8) || 2.84, 3.8);
  for (let x = 2.9; x <= 6.7; x += 0.4) ante(x, slabAt(SLABS[3]!, x, 3.8) || 2.93, 3.8);
  for (let z = -2.5; z <= 3.6; z += 0.4) ante(6.8, 2.93, z, Math.PI / 2);
  for (let x = 2.9; x <= 6.7; x += 0.4) ante(x, slabAt(SLABS[3]!, x, -2.7) || 2.93, -2.7);
  for (let z = 2.0; z <= 3.7; z += 0.4) ante(-3.1, slabAt(SLABS[0]!, -3.1, z) || 2.9, z, Math.PI / 2);
  for (let z = -2.6; z <= -1.0; z += 0.4) ante(-3.1, slabAt(SLABS[1]!, -3.1, z) || 2.9, z, Math.PI / 2);
  for (let x = -3.0; x <= -1.0; x += 0.4) ante(x, slabAt(SLABS[1]!, x, -2.7) || 2.87, -2.7);
  for (let x = -1.6; x <= 1.7; x += 0.4) ante(x, 3.5 - Math.abs(x) * 0.282, PORTICO.z1 + 0.05);

  // ---- The atrium: the impluvium (the rain pool) under the compluvium, its marble rim and water.
  const water = new THREE.MeshStandardMaterial({ color: 0x4f8ea5, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88 });
  {
    const r = IMPLUVIUM;
    const x = (r.x0 + r.x1) / 2, z = (r.z0 + r.z1) / 2, w = r.x1 - r.x0, d = r.z1 - r.z0;
    const rimSpec = S(MARBLE, 0.45);
    for (const sz of [-1, 1]) b.box(w, 0.17, 0.14, rimSpec, x, 0.085, z + (sz * (d - 0.14)) / 2);
    for (const sx of [-1, 1]) b.box(0.14, 0.17, d - 0.28, rimSpec, x + (sx * (w - 0.14)) / 2, 0.085, z);
    b.box(w - 0.28, 0.02, d - 0.28, S(0x5f6f6c, 0.9), x, 0.01, z);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.28, d - 0.28), water);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(x, IMPLUVIUM_WATER_Y, z);
    sheet.receiveShadow = true;
    group.add(sheet);
    colliders.push(ob(x, z, w / 2, d / 2, 0.15));
  }
  // The lararium (the household shrine): a small aedicula on the atrium's west wall, two
  // columns and a pediment over a niche, the two Lares in bronze, a lamp before them.
  {
    const x = -2.45, z = -0.25;
    b.box(0.34, 0.55, 0.76, S(MARBLE, 0.55), x, 0.275, z);
    b.box(0.04, 0.62, 0.5, S(0x6e231c, 0.9), -2.585, 0.86, z); // the niche, painted dark red
    for (const sz of [-1, 1]) b.cyl(0.035, 0.04, 0.58, S(MARBLE, 0.5), x + 0.02, 0.84, z + sz * 0.24, 8);
    b.box(0.4, 0.07, 0.7, S(MARBLE, 0.55), x, 1.165, z);
    const ped = new THREE.Shape([new THREE.Vector2(z - 0.36, 1.2), new THREE.Vector2(z + 0.36, 1.2), new THREE.Vector2(z, 1.38)]);
    b.put(new THREE.ExtrudeGeometry(ped, { depth: 0.36, bevelEnabled: false }), S(MARBLE, 0.55), new THREE.Matrix4().makeTranslation(x + 0.18, 0, 0).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)));
    for (const sz of [-1, 1]) {
      b.cyl(0.0, 0.035, 0.14, S(0xb08d57, 0.4, { metal: 0.55 }), -2.55, 0.65, z + sz * 0.09, 6);
      b.sphere(0.03, S(0xb08d57, 0.4, { metal: 0.55 }), -2.55, 0.75, z + sz * 0.09);
    }
    b.box(0.12, 0.03, 0.12, S(0xb5532f, 0.7), x + 0.1, 0.57, z); // a clay lamp's dish
    colliders.push(ob(x, z, 0.17, 0.38, 0.12));
  }

  // ---- The tablinum: the master's room, a desk with scrolls, a cabinet, drapes tied back.
  {
    const wood = S(WOOD, 0.8);
    b.box(0.5, 0.05, 0.9, wood, -0.95, 0.74, -1.65);
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) b.box(0.06, 0.72, 0.06, wood, -0.95 + sx * 0.2, 0.36, -1.65 + sz * 0.38);
    b.cyl(0.03, 0.03, 0.3, S(0xe8dcb8, 0.9), -0.95, 0.81, -1.55, 8);
    colliders.push(ob(-0.95, -1.65, 0.27, 0.47, 0.12));
    b.box(0.3, 1.0, 0.9, wood, 1.1, 0.5, -1.65);
    for (let i = 0; i < 6; i++) b.cyl(0.03, 0.03, 0.12, S(0xe8dcb8, 0.9), 0.93, 0.25 + (i >> 1) * 0.32, -1.9 + (i % 2) * 0.5 + 0.2, 8);
    colliders.push(ob(1.1, -1.65, 0.17, 0.47, 0.12));
    for (const sx of [-1, 1]) b.box(0.1, 2.5, 0.3, S(0x9a3328, 0.95), sx * 0.9, 1.35, -1.12); // the drapes
  }
  // ---- The dining room: a couch on three sides about a low table (Vitruvius's triclinium).
  {
    const wood = S(WOOD, 0.8);
    const cloth = S(0x8e2f27, 0.95);
    const couch = (x: number, z: number, w: number, d: number) => {
      b.box(w, 0.28, d, wood, x, 0.2, z);
      b.box(w - 0.06, 0.12, d - 0.06, cloth, x, 0.4, z);
      colliders.push(ob(x, z, w / 2, d / 2, 0.12));
    };
    couch(4.6, 2.85, 2.2, 0.62);
    couch(4.6, 1.2, 2.2, 0.62);
    couch(5.88, 2.02, 0.6, 1.4);
    b.box(0.8, 0.05, 0.7, wood, 4.5, 0.46, 2.02);
    b.cyl(0.04, 0.04, 0.45, wood, 4.5, 0.22, 2.02, 6);
    b.cyl(0.11, 0.09, 0.05, S(0xe9e1d0, 0.7), 4.35, 0.51, 2.0, 8);
    b.sphere(0.07, S(0xc88a4a, 0.9), 4.65, 0.52, 2.05, 0.6);
    colliders.push(ob(4.5, 2.02, 0.4, 0.35, 0.12));
  }
  // ---- A cubiculum off the front: a daybed. The pantry: amphorae and a crate. The closet: a chest.
  {
    const wood = S(WOOD, 0.8);
    b.box(1.4, 0.28, 0.55, wood, -1.75, 0.2, 2.9);
    b.box(1.34, 0.12, 0.5, S(0xcdb48a, 1), -1.75, 0.4, 2.9);
    b.box(1.34, 0.04, 0.3, S(0x8e2f27, 0.95), -1.75, 0.47, 2.97);
    colliders.push(ob(-1.75, 2.9, 0.7, 0.28, 0.12));
    for (const [ax, az] of [[1.2, 3.0], [1.5, 3.0], [1.8, 3.0]] as const) {
      b.cyl(0.13, 0.08, 0.7, S(0xb5532f, 0.85), ax, 0.35, az);
      b.cyl(0.06, 0.1, 0.12, S(0xb5532f, 0.85), ax, 0.76, az);
      colliders.push(co(ax, az, 0.14, 0.08));
    }
    b.box(0.5, 0.4, 0.4, wood, 2.25, 0.2, 2.6);
    colliders.push(ob(2.25, 2.6, 0.25, 0.2, 0.12));
    b.box(0.6, 0.45, 0.4, wood, -2.15, 0.225, -1.6);
    b.box(0.62, 0.06, 0.42, S(0x3a2a1c, 0.6, { metal: 0.4 }), -2.15, 0.46, -1.6);
    colliders.push(ob(-2.15, -1.6, 0.3, 0.2, 0.12));
  }

  // ---- The peristyle's garden: the pool with its small fountain, planters, hedges, flowers.
  {
    const P = PERISTYLE_POOL;
    b.cyl(P.r + 0.1, P.r + 0.1, 0.2, S(MARBLE, 0.45), P.x, 0.1, P.z, 16);
    const sheet = new THREE.Mesh(new THREE.CircleGeometry(P.r, 16), water);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(P.x, PERISTYLE_WATER_Y, P.z);
    group.add(sheet);
    b.cyl(0.07, 0.09, 0.4, S(MARBLE, 0.5), P.x, 0.4, P.z, 8);
    b.cyl(0.16, 0.05, 0.1, S(0xb08d57, 0.4, { metal: 0.55 }), P.x, 0.65, P.z, 10);
    b.cyl(0.015, 0.015, 0.2, S(0xcfe6ee, 0.2), P.x, 0.77, P.z, 5);
    colliders.push(co(P.x, P.z, P.r + 0.1, 0.12));
    // The putto's plinth (the putto itself is the pack's statue, placed by townScene.ts).
    const U = PERISTYLE_PUTTO;
    b.box(U.plinthHalf * 2 + 0.06, 0.05, U.plinthHalf * 2 + 0.06, S(MARBLE, 0.55), U.x, 0.025, U.z);
    b.box(U.plinthHalf * 2, U.plinth - 0.1, U.plinthHalf * 2, S(MARBLE, 0.5), U.x, 0.05 + (U.plinth - 0.1) / 2, U.z);
    b.box(U.plinthHalf * 2 + 0.06, 0.05, U.plinthHalf * 2 + 0.06, S(MARBLE, 0.55), U.x, U.plinth - 0.025, U.z);
    colliders.push(ob(U.x, U.z, U.plinthHalf + 0.03, U.plinthHalf + 0.03, 0.12));
    const planter = (x: number, z: number, w: number, d: number, shrub: number, flower: number) => {
      b.box(w, 0.32, d, S(MARBLE, 0.6), x, 0.16, z);
      b.box(w - 0.1, 0.02, d - 0.1, S(0x4a3220, 1), x, 0.33, z);
      for (let i = 0; i < 3; i++) b.sphere(0.13, S(shrub, 0.95), x + (i - 1) * (w * 0.28), 0.46 + (i % 2) * 0.05, z + (i % 2 ? 0.03 : -0.03), 0.9);
      b.sphere(0.04, S(flower, 0.8), x - w * 0.2, 0.6, z);
      b.sphere(0.04, S(0xf5f0e6, 0.8), x + w * 0.2, 0.6, z + 0.04);
      colliders.push(ob(x, z, w / 2, d / 2, 0.12));
    };
    planter(-0.25, -4.33, 0.7, 0.4, 0x5e8c3a, 0xd9473a);
    planter(2.75, -4.33, 0.7, 0.4, 0x6aa84f, 0xf0cf4a);
    planter(2.8, -3.5, 0.5, 0.5, 0x5e8c3a, 0xd9473a);
    for (const hx2 of [0.7, 1.8]) {
      b.box(0.9, 0.34, 0.26, S(0x4f7a38, 1), hx2, 0.17, -4.47);
      colliders.push(ob(hx2, -4.47, 0.45, 0.13, 0.1));
    }
  }

  // ---- The bed for two (in the bedroom): a wooden frame, a mattress, two pillows, a red blanket.
  const bx = HOME_BED.lx;
  const bz = HOME_BED.lz;
  const bw = HOME_BED.halfW * 2;
  const bd = HOME_BED.halfD * 2;
  const wood = S(WOOD, 0.8);
  b.box(bw + 0.1, 0.32, bd + 0.1, wood, bx, 0.24, bz);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.box(0.1, 0.12, 0.1, wood, bx + px * (bw / 2), 0.04, bz + pz * (bd / 2));
  b.box(bw + 0.14, 0.95, 0.09, wood, bx, 0.58, bz - bd / 2 - 0.05); // headboard
  b.box(bw, 0.16, bd, S(0xeee3cc, 1), bx, 0.48, bz); // mattress, its top at HOME_BED.top
  for (const px of [-0.38, 0.38]) b.box(0.62, 0.12, 0.36, S(0xf7f3ea, 1), bx + px, HOME_BED.top + 0.05, bz - bd / 2 + 0.26);
  b.box(bw + 0.04, 0.05, bd * 0.62, S(0x8e2f27, 0.95), bx, HOME_BED.top + 0.01, bz + bd * 0.19); // the blanket
  // The lamp: an oil lamp on a small table beside the bed, a warm flame.
  const tx = LAMP_TABLE.x;
  const tz = LAMP_TABLE.z;
  b.box(0.5, 0.05, 0.5, wood, tx, 0.62, tz);
  b.box(0.06, 0.6, 0.06, wood, tx, 0.3, tz);
  b.box(0.24, 0.07, 0.12, S(0xb07a3e, 0.5, { metal: 0.5 }), tx, 0.68, tz);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), flameMat);
  flame.position.set(tx + 0.1, 0.75, tz);
  flame.scale.y = 1.8;
  group.add(flame);
  // The house's other small flames, lit with the lamp (no light of their own): the
  // lararium's lamp and the tablinum's hanging lamp.
  const littleFlames: THREE.Mesh[] = [];
  for (const [fx, fy, fz] of [[-2.35, 0.62, -0.25], [0.0, 2.55, -1.6]] as const) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), flameMat);
    fl.position.set(fx, fy, fz);
    group.add(fl);
    littleFlames.push(fl);
  }
  b.cyl(0.005, 0.005, 0.5, S(0x3a2a1c, 0.6), 0.0, 2.85, -1.6, 4);
  b.cyl(0.07, 0.04, 0.05, S(0xb07a3e, 0.5, { metal: 0.5 }), 0.0, 2.5, -1.6, 8);
  // A rug between the bed and the bedroom's doors.
  b.box(1.5, 0.015, 1.1, FLATS(0x6d3b2a, 1), 3.55, 0.008, -0.55);
  colliders.push(ob(bx, bz, bw / 2 + 0.05, bd / 2 + 0.05, 0.12));
  colliders.push(ob(tx, tz, 0.25, 0.25, 0.12));
  const lamp = new THREE.PointLight(0xffb468, 0, 9, 2);
  lamp.position.set(tx + 0.1, 0.95, tz);
  group.add(lamp);
  const lampAt = lamp.position.clone();

  // A small high window (a fenestra) in the bedroom's east wall, above the bed's head, with
  // a wooden frame and two iron bars; its pane glows with the daylight,
  // and gold with the dawn on a morning together (Task 45).
  const winZ = -1.2;
  const winY = 1.95;
  const paneMat = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, emissive: 0xffd9a0, emissiveIntensity: 0.2, roughness: 0.6 });
  const eastIn = 6.2;
  const eastOut = 6.42;
  for (const face of [-1, 1]) {
    // face -1: the room side of the wall; +1: the lawn side.
    const x = face < 0 ? eastIn - 0.02 : eastOut + 0.006;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), paneMat);
    pane.position.set(x, winY, winZ);
    pane.rotation.y = face < 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(pane);
    for (const [fh, fd, dy, dz] of [[0.07, 0.74, 0.28, 0], [0.07, 0.74, -0.28, 0], [0.62, 0.07, 0, 0.34], [0.62, 0.07, 0, -0.34]] as const) {
      b.box(0.05, fh, fd, S(WOOD, 0.8), x + face * 0.02, winY + dy, winZ + dz);
    }
    for (const dz of [-0.11, 0.11]) b.box(0.03, 0.5, 0.025, S(0x3a2a1c, 0.6, { metal: 0.5 }), x + face * 0.03, winY, winZ + dz);
  }
  const lampDawn = new THREE.Vector3(eastIn - 0.5, winY - 0.1, winZ);
  const lampWarm = new THREE.Color(0xffb468);
  const lampMorning = new THREE.Color(0xffe2b8);
  const fireAt = new THREE.Vector3(3.7, 0, bz + 0.25);
  const fireLamp = new THREE.Vector3(fireAt.x, 0.9, fireAt.z);
  const fireWarm = new THREE.Color(0xff8a3c);
  let hush: { doorShut: boolean; lampDim: number; dawn: number } | null = null;

  // A shelf on the bedroom's east wall, for keepsakes.
  b.box(0.3, 0.05, 1.4, wood, eastIn - 0.15, 1.15, -1.3);
  for (const z of [-1.9, -0.7]) b.box(0.04, 0.16, 0.04, wood, eastIn - 0.04, 1.06, z);

  // Tender props (Task 59), built once, hidden until a moment calls for them.
  const tenderGroup = new THREE.Group();
  group.add(tenderGroup);
  const tbox = (parent: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  // The brazier: a ring of stones, three logs, two small flames, in front of the bed's edge.
  const fireGroup = new THREE.Group();
  fireGroup.position.copy(fireAt);
  const stoneMat = m(0x8d867a, 0.95);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rock = tbox(fireGroup, 0.16, 0.14, 0.16, stoneMat, Math.cos(a) * 0.3, 0.09, Math.sin(a) * 0.3);
    rock.rotation.y = a;
  }
  for (let i = 0; i < 3; i++) {
    const log = tbox(fireGroup, 0.4, 0.07, 0.07, m(0x4a3220, 0.9), 0, 0.09 + (i % 2) * 0.06, 0);
    log.rotation.y = (i / 3) * Math.PI;
  }
  const fireMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
  const flames: THREE.Mesh[] = [];
  for (const [fx, fz, fh] of [[0, 0, 0.34], [0.07, -0.05, 0.22]] as const) {
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.1, fh, 6), fireMat);
    fl.position.set(fx, 0.2 + fh / 2, fz);
    fireGroup.add(fl);
    flames.push(fl);
  }
  fireGroup.visible = false;
  tenderGroup.add(fireGroup);
  // The tray: a stool, a wooden tray with a round loaf and a cup of warm milk, at the bed's foot.
  const trayGroup = new THREE.Group();
  trayGroup.position.set(bx + 0.1, 0, bz + bd / 2 + 0.28);
  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.38, 8), m(WOOD, 0.8));
  stool.position.y = 0.21;
  trayGroup.add(stool);
  tbox(trayGroup, 0.5, 0.03, 0.34, m(0x8a5e38, 0.8), 0, 0.41, 0);
  const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), m(0xc88a4a, 0.9));
  loaf.scale.y = 0.6;
  loaf.position.set(-0.1, 0.48, 0);
  trayGroup.add(loaf);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 8), m(0xe9e1d0, 0.7));
  cup.position.set(0.11, 0.48, 0.03);
  trayGroup.add(cup);
  const milk = new THREE.Mesh(new THREE.CircleGeometry(0.043, 8), m(0xfaf6ec, 0.6));
  milk.rotation.x = -Math.PI / 2;
  milk.position.set(0.11, 0.527, 0.03);
  trayGroup.add(milk);
  trayGroup.visible = false;
  tenderGroup.add(trayGroup);
  // The letter: folded paper on the right-hand pillow, a dot of red wax.
  const letterGroup = new THREE.Group();
  letterGroup.position.set(bx + 0.38, HOME_BED.top + 0.115, bz - bd / 2 + 0.26);
  letterGroup.rotation.y = 0.35;
  tbox(letterGroup, 0.22, 0.012, 0.15, m(0xf3ead2, 1), 0, 0, 0);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 8), m(0x8e1f1a, 0.6));
  wax.position.set(0, 0.012, 0);
  letterGroup.add(wax);
  letterGroup.visible = false;
  tenderGroup.add(letterGroup);
  let fireOn = false;
  let fireLevel = 0;

  b.flush();

  // Keepsakes (Task 40): where each spot stands, in the house's frame,
  // and the small things themselves, built here in the town's style. The
  // wall above the bed, the bedroom's side wall and shelf, the lamp table
  // are the bedroom's; the floor spot is in the fauces, by the door.
  const SLOT_AT: Record<HomeSlotId, { x: number; y: number; z: number; ry: number }> = {
    "wall-back": { x: bx, y: 1.78, z: -2.2 + 0.03, ry: 0 },
    "wall-side": { x: 2.8 + 0.03, y: 1.6, z: -1.5, ry: Math.PI / 2 },
    "shelf-left": { x: eastIn - 0.15, y: 1.175, z: -1.75, ry: -Math.PI / 2 },
    "shelf-right": { x: eastIn - 0.15, y: 1.175, z: -0.85, ry: -Math.PI / 2 },
    table: { x: tx - 0.14, y: 0.645, z: tz + 0.08, ry: 0 },
    floor: { x: 0.38, y: 0, z: 2.3, ry: -Math.PI / 4 },
  };
  const decorGroup = new THREE.Group();
  group.add(decorGroup);

  // The bed's edge as a seat: on the side toward the room (the bed lies against the
  // east wall, so its west edge), facing out (local -x); a sitter at rotY faces
  // (-sin, -cos) of rotY, so this is the house's turn plus a quarter.
  const seatLocal = { x: bx - bw / 2 + 0.22, z: bz + 0.25 };
  const seatWorld = at(seatLocal.x, seatLocal.z);
  const bedSeat = { x: seatWorld.x, z: seatWorld.z, rotY: rot + Math.PI / 2, y: HOME_FLOOR_Y + HOME_BED.top };

  let doorOpen = 0;
  let lampLevel = 0;
  let wasHome = false;
  const doorWorld = at(0, HOME.halfD + wall + 0.6);
  const toLocal = (x: number, z: number) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return { lx: (x - hx) * c - (z - hz) * s, lz: (x - hx) * s + (z - hz) * c };
  };
  const insideAt = (x: number, z: number) => {
    const { lx, lz } = toLocal(x, z);
    return insideRooms(lx, lz);
  };
  const shelterOf = (x: number, z: number) => {
    const { lx, lz } = toLocal(x, z);
    return shelteredAt(lx, lz) || inRect(PORTICO, lx, lz);
  };
  const arrangeLocal = at(SPOTS.arrange.x, SPOTS.arrange.z);
  const restLocal = at(SPOTS.rest.x, SPOTS.rest.z);
  const waitLocal = at(SPOTS.wait.x, SPOTS.wait.z);
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
    sheltered: shelterOf,
    waterSurfaceAt(x, z) {
      const { lx, lz } = toLocal(x, z);
      const P = PERISTYLE_POOL;
      if ((lx - P.x) ** 2 + (lz - P.z) ** 2 <= P.r * P.r) return HOME_FLOOR_Y + PERISTYLE_WATER_Y;
      const r = IMPLUVIUM;
      return lx >= r.x0 + 0.14 && lx <= r.x1 - 0.14 && lz >= r.z0 + 0.14 && lz <= r.z1 - 0.14 ? HOME_FLOOR_Y + IMPLUVIUM_WATER_Y : null;
    },
    setHush(next) {
      hush = next;
    },
    setTender(prop) {
      fireOn = prop === "fire";
      fireGroup.visible = fireOn;
      trayGroup.visible = prop === "tray";
      letterGroup.visible = prop === "letter";
    },
    update(dt, walkers, nightMix) {
      // The door opens inward as anyone comes within 3 m of it, inside
      // or out, and closes again behind them (held shut on a night together).
      // It swings back flat against the fauces' west wall.
      const near = walkers.some((w) => Math.hypot(w.x - doorWorld.x, w.z - doorWorld.z) < 3);
      const target = near && !hush?.doorShut ? 1 : 0;
      doorOpen += (target - doorOpen) * Math.min(1, dt * 3);
      hinge.rotation.y = doorOpen * 1.45;
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
      for (const fl of littleFlames) {
        fl.scale.setScalar(0.4 + 0.6 * lampLevel);
        fl.scale.y = (1.5 + 0.4 * flicker) * (0.4 + 0.6 * lampLevel);
      }
      // The morning together: the one light becomes the dawn through the
      // window (no second light, so no shader change), falling on the bed.
      const dawn = hush?.dawn ?? 0;
      // An evening by the fire (Task 59): the same light turns to the brazier.
      fireLevel += ((fireOn ? 1 : 0) - fireLevel) * Math.min(1, dt * 1.5);
      for (const [i, fl] of flames.entries()) fl.scale.set(1, 0.85 + 0.25 * Math.sin(performance.now() * (0.013 + i * 0.006)), 1);
      lamp.position.lerpVectors(lampAt, lampDawn, dawn).lerp(fireLamp, fireLevel);
      lamp.color.copy(lampWarm).lerp(lampMorning, dawn).lerp(fireWarm, fireLevel * 0.7);
      lamp.intensity = (1.2 + nightMix * 4.3) * flicker * lampLevel * (1 - dawn) * (1 + fireLevel * 0.5) + dawn * 5.5;
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
