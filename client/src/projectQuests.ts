// The in-town side of the real-project quests (Task 56), built in code in
// the town's low-poly style: a banner over the forum, a market day, a
// messenger on the road, torches and a feast, lamps by evening, and the
// scroll carried to the Senate. Pure meshes and a small controller; the
// scene places it and ticks it. Nothing here collides (the pieces are
// awnings, cloth and flame, and the road stays open), and nothing pays.
import * as THREE from "three";
import { QUEST_DEFS, pendingCelebrations, type CelebrationKind, type QuestBook, type QuestKind } from "../../shared/projectQuests";
import { terrainHeight } from "./town";

/** Where each piece stands (x, z). */
export const QUEST_SPOTS = {
  /** The banner hangs over the forum's avenue, north of the Town Tree. */
  bannerPoles: [[-3.6, -9], [3.6, -9]] as [number, number][],
  /** The market day, in the market square at the south gate. */
  stalls: [[-6.5, 33.4], [-2.2, 33.4], [2.2, 33.4], [6.5, 33.4]] as [number, number][],
  /** The messenger's road: the axis, gate to forecourt, then up to the forum. */
  road: [[0, 46], [0, 35], [0, 19.6], [-3.7, 15.5], [0, 11.2], [0, 0], [0, -12], [0, -24]] as [number, number][],
  /** The triumph: torches along the avenue and a feast table in the forum. */
  torches: [[-2.6, 6], [2.6, 6], [-2.6, -2], [2.6, -2], [-2.6, -10], [2.6, -10]] as [number, number][],
  feast: [0, 9.2] as [number, number],
  /** The evening lamps, by the forum's bench, and the Senate steps the scroll is carried to. */
  lamps: [[-3, 3], [3, 3], [-3, -5], [3, -5]] as [number, number][],
  senate: [0, -30] as [number, number],
} as const;

/** How long each celebration plays, in seconds. */
export const CELEBRATION_SECONDS: Record<CelebrationKind, number> = {
  "market-day": 90,
  "scroll-to-senate": 45,
  "triumph-feast": 120,
  lamplight: 90,
};

const m = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
const FLAME = () => m(0xffb347, { emissive: 0xff8a1e, emissiveIntensity: 1.6 });

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** A banner on two poles across the avenue: red cloth with a gold border. */
export function buildBanner(): THREE.Group {
  const g = new THREE.Group();
  const [pa, pb] = QUEST_SPOTS.bannerPoles;
  const [ax, az] = pa!;
  const [bx] = pb!;
  for (const [x, z] of QUEST_SPOTS.bannerPoles) {
    g.add(box(0.16, 5.4, 0.16, m(0x6b4a2f), x, terrainHeight(x, z) + 2.7, z));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m(0xd4af37, { metalness: 0.5 }));
    knob.position.set(x, terrainHeight(x, z) + 5.5, z);
    g.add(knob);
  }
  const w = Math.abs(bx - ax) - 0.4;
  const y = terrainHeight(0, az) + 4.2;
  g.add(box(Math.abs(bx - ax), 0.08, 0.08, m(0x6b4a2f), 0, y + 0.8, az));
  g.add(box(w, 1.4, 0.04, m(0xa3302a), 0, y, az));
  g.add(box(w, 0.1, 0.05, m(0xd4af37), 0, y + 0.65, az));
  g.add(box(w, 0.1, 0.05, m(0xd4af37), 0, y - 0.65, az));
  // A gold laurel disc, standing for the Focus Companion's mark.
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 14), m(0xd4af37, { metalness: 0.4 }));
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, y, az + 0.04);
  g.add(disc);
  g.userData.kind = "banner";
  return g;
}

/** A market stall: four posts, a striped awning, a counter with goods. */
function buildStall(i: number): THREE.Group {
  const g = new THREE.Group();
  const stripe = [0xc0392b, 0xe8dcc4];
  for (const [x, z] of [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]]) g.add(box(0.1, 2.2, 0.1, m(0x6b4a2f), x!, 1.1, z!));
  for (let s = 0; s < 6; s++) {
    const band = box(0.36, 0.06, 1.7, m(stripe[(s + i) % 2]!), -0.9 + s * 0.36, 2.28 - (s % 1) * 0, 0);
    band.rotation.z = -0.05;
    g.add(band);
  }
  g.add(box(2, 0.7, 0.6, m(0x8b6b45), 0, 0.35, 0.3));
  const goods = [0xd9a441, 0x6aa84f, 0xb5532f, 0x4d6b7a];
  goods.forEach((c, k) => g.add(box(0.28, 0.2, 0.28, m(c), -0.7 + k * 0.46, 0.8, 0.3)));
  return g;
}

/** Bunting strung between the stalls. */
function buildBunting(): THREE.Group {
  const g = new THREE.Group();
  const [first, , , last] = QUEST_SPOTS.stalls;
  const z = first![1];
  const flags = [0xc0392b, 0xe0a030, 0x2aa79b, 0xf1e6cc];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = first![0] + (last![0] - first![0]) * t;
    const y = terrainHeight(x, z) + 2.9 - Math.sin(t * Math.PI) * 0.35;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 3), m(flags[i % 4]!));
    flag.rotation.x = Math.PI;
    flag.position.set(x, y, z);
    g.add(flag);
  }
  return g;
}

/** A standing torch: an iron stand and a flame (the flame flickers in `update`). */
function buildTorch(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.08, 1.8, 0.08, m(0x2f2a26, { metalness: 0.4 }), 0, 0.9, 0));
  g.add(box(0.22, 0.12, 0.22, m(0x2f2a26, { metalness: 0.4 }), 0, 1.82, 0));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 6), FLAME());
  flame.position.y = 2.08;
  flame.name = "flame";
  g.add(flame);
  return g;
}

/** A feast table: long boards, bowls, bread, a jug, a bunch of grapes. */
function buildFeastTable(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(3.6, 0.1, 1.1, m(0x8b6b45), 0, 0.95, 0));
  for (const x of [-1.6, 1.6]) g.add(box(0.12, 0.95, 0.9, m(0x6b4a2f), x, 0.47, 0));
  g.add(box(3.7, 0.01, 0.5, m(0xf1e6cc), 0, 1.005, 0));
  const goods = [0xd9a441, 0xa3302a, 0x6aa84f, 0x7a3b69, 0xe0a030, 0xb5532f];
  goods.forEach((c, i) => {
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.1, 8), m(0xe8dcc4));
    dish.position.set(-1.45 + i * 0.58, 1.07, i % 2 ? 0.2 : -0.2);
    g.add(dish);
    const food = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 5), m(c));
    food.position.set(dish.position.x, 1.16, dish.position.z);
    g.add(food);
  });
  return g;
}

/** A small lamp on a stool: clay body, a glowing wick. */
function buildLampStand(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.3, 0.45, 0.3, m(0x6b4a2f), 0, 0.22, 0));
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), m(0xb5532f));
  lamp.scale.set(1.3, 0.55, 0.9);
  lamp.position.y = 0.5;
  g.add(lamp);
  const wick = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), FLAME());
  wick.scale.y = 1.6;
  wick.position.set(0.1, 0.56, 0);
  wick.name = "flame";
  g.add(wick);
  return g;
}

/** A messenger: a small figure in a red tunic and a hat, a satchel on his back. */
export function buildMessenger(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.34, 0.6, 0.22, m(0xa3302a), 0, 1.0, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), m(0xe0b48a));
  head.position.y = 1.45;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 8), m(0x4d3a2a));
  hat.position.y = 1.62;
  g.add(hat);
  g.add(box(0.28, 0.24, 0.1, m(0x8b6b45), 0, 1.0, -0.17));
  for (const x of [-0.09, 0.09]) {
    const leg = box(0.1, 0.55, 0.1, m(0x4d3a2a), x, 0.3, 0);
    leg.name = "leg";
    g.add(leg);
  }
  return g;
}

/** A rolled scroll with a red seal. */
export function buildScroll(): THREE.Group {
  const g = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), m(0xf1e6cc));
  roll.rotation.z = Math.PI / 2;
  g.add(roll);
  g.add(box(0.06, 0.2, 0.2, m(0xa3302a), 0, 0, 0));
  return g;
}

/** Points along a polyline at distance `d` (ground-following). */
export function alongRoad(road: readonly (readonly [number, number])[], d: number): { x: number; z: number; heading: number; done: boolean } {
  let left = Math.max(0, d);
  for (let i = 0; i + 1 < road.length; i++) {
    const [ax, az] = road[i]!;
    const [bx, bz] = road[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    if (left <= len) {
      const t = len ? left / len : 0;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, heading: Math.atan2(bx - ax, bz - az), done: false };
    }
    left -= len;
  }
  const [lx, lz] = road[road.length - 1]!;
  return { x: lx, z: lz, heading: 0, done: true };
}

export interface QuestScene {
  group: THREE.Group;
  /** Show what the book leaves standing (the banner), and read what is new. */
  setBook(book: QuestBook): { messengers: number; celebrations: QuestKind[] };
  /** Send one messenger down the road. */
  sendMessenger(): void;
  /** Play a celebration (it removes itself when its time is up). */
  celebrate(kind: CelebrationKind): void;
  update(dt: number, now: number): void;
  /** What is playing, for tests. */
  playing(): CelebrationKind[];
  messengersOnRoad(): number;
}

/**
 * The controller. `setBook` is idempotent: the banner stands while its
 * quest has been finished; a messenger goes out only for a step that is
 * new since the last book it saw (never at the first look, so a reload
 * does not replay history); a celebration is reported only for a finish
 * whose `celebrated` flag is still false, so it plays once.
 */
export function createQuestScene(): QuestScene {
  const group = new THREE.Group();
  const banner = buildBanner();
  banner.visible = false;
  group.add(banner);

  const messengers: { mesh: THREE.Group; d: number }[] = [];
  const shows = new Map<CelebrationKind, { root: THREE.Group; age: number; scroll?: THREE.Group }>();
  let lastSteps: Partial<Record<QuestKind, number>> | null = null;
  const ROAD_SPEED = 3.4;

  const build = (kind: CelebrationKind): THREE.Group => {
    const root = new THREE.Group();
    if (kind === "market-day") {
      QUEST_SPOTS.stalls.forEach(([x, z], i) => {
        const stall = buildStall(i);
        stall.position.set(x, terrainHeight(x, z), z);
        root.add(stall);
      });
      root.add(buildBunting());
    } else if (kind === "triumph-feast") {
      for (const [x, z] of QUEST_SPOTS.torches) {
        const t = buildTorch();
        t.position.set(x, terrainHeight(x, z), z);
        root.add(t);
      }
      const [fx, fz] = QUEST_SPOTS.feast;
      const table = buildFeastTable();
      table.position.set(fx, terrainHeight(fx, fz), fz);
      root.add(table);
    } else if (kind === "lamplight") {
      for (const [x, z] of QUEST_SPOTS.lamps) {
        const l = buildLampStand();
        l.position.set(x, terrainHeight(x, z), z);
        root.add(l);
      }
    }
    return root;
  };

  const start = (kind: CelebrationKind) => {
    if (shows.has(kind)) return;
    const root = build(kind);
    const entry: { root: THREE.Group; age: number; scroll?: THREE.Group } = { root, age: 0 };
    if (kind === "scroll-to-senate") {
      entry.scroll = buildScroll();
      root.add(entry.scroll);
    }
    group.add(root);
    shows.set(kind, entry);
  };

  return {
    group,
    setBook(book) {
      const rec = (k: QuestKind) => book.find((r) => r.kind === k);
      banner.visible = (rec("focus-companion")?.completed ?? 0) > 0;
      const steps: Partial<Record<QuestKind, number>> = {};
      for (const r of book) steps[r.kind] = r.steps;
      let sent = 0;
      if (lastSteps) {
        const now = steps["job-hunt"] ?? 0;
        const before = lastSteps["job-hunt"] ?? 0;
        // A step carried in since the last look: one messenger each, at most a few at once.
        for (let i = 0; i < Math.min(3, Math.max(0, now - before)); i++) {
          this.sendMessenger();
          sent++;
        }
      }
      lastSteps = steps;
      return { messengers: sent, celebrations: pendingCelebrations(book) };
    },
    sendMessenger() {
      const mesh = buildMessenger();
      group.add(mesh);
      messengers.push({ mesh, d: -messengers.length * 2.5 });
    },
    celebrate: start,
    update(dt, now) {
      for (let i = messengers.length - 1; i >= 0; i--) {
        const w = messengers[i]!;
        w.d += dt * ROAD_SPEED;
        const p = alongRoad(QUEST_SPOTS.road, w.d);
        // He runs the road out, then stays a moment at the end and is gone.
        w.mesh.visible = w.d >= 0;
        w.mesh.position.set(p.x, terrainHeight(p.x, p.z), p.z);
        w.mesh.rotation.y = p.heading;
        const swing = Math.sin(now * 9) * 0.5;
        w.mesh.children.filter((c) => c.name === "leg").forEach((leg, k) => (leg.rotation.x = k ? swing : -swing));
        if (p.done) {
          group.remove(w.mesh);
          messengers.splice(i, 1);
        }
      }
      for (const [kind, show] of shows) {
        show.age += dt;
        if (show.scroll) {
          const t = Math.min(1, show.age / (CELEBRATION_SECONDS[kind] * 0.8));
          const [sx, sz] = QUEST_SPOTS.senate;
          const x = 0 * (1 - t) + sx * t;
          const z = 6 * (1 - t) + sz * t;
          show.scroll.position.set(x, terrainHeight(x, z) + 1.5 + Math.sin(now * 3) * 0.04, z);
        }
        show.root.traverse((o) => {
          if (o.name === "flame") o.scale.y = 1 + 0.2 * Math.sin(now * 11 + o.position.x * 3);
        });
        if (show.age >= CELEBRATION_SECONDS[kind]) {
          group.remove(show.root);
          shows.delete(kind);
        }
      }
    },
    playing: () => [...shows.keys()],
    messengersOnRoad: () => messengers.length,
  };
}

/** Which celebration a quest kind stages. */
export const celebrationFor = (kind: QuestKind): CelebrationKind => QUEST_DEFS.find((q) => q.kind === kind)!.celebration;
