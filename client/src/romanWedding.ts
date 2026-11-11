// The town dressed for the wedding day (Task 58), built in code in the
// town's low-poly style (as client/src/projectQuests.ts and tributes.ts):
// green garlands swagged between posts down the forum's avenue, torches
// at the posts, a saffron banner, an arch of flowers and drifting petals
// for the celebration. Nothing collides (cloth, leaves and flame, the
// road stays open). It shows from the dressing until the day is held,
// plays on through the celebration, and is then taken down entirely: the
// only lasting thing is the keepsake in the house (homeHouse.ts).
import * as THREE from "three";
import { townDressed, weddingPending, type WeddingBook } from "../../shared/romanWedding";
import { terrainHeight } from "./town";

/** Posts down both sides of the avenue (x, z); garlands swag between neighbours. */
export const WEDDING_POSTS: readonly (readonly [number, number])[] = [
  [-4.2, 14], [-4.2, 8.5], [-4.2, 0.5], [-4.2, -7], [-4.2, -14],
  [4.2, 14], [4.2, 8.5], [4.2, 0.5], [4.2, -7], [4.2, -14],
];
/** The flowered arch the couple stand under, and the banner's poles. */
export const WEDDING_ARCH = { z: -1.5, halfWidth: 1.9, height: 3.1 } as const;
/** How long the celebration plays, in seconds, before the town is undressed. */
export const WEDDING_CELEBRATION_SECONDS = 150;

const m = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
const FLAME = () => m(0xffb347, { emissive: 0xff8a1e, emissiveIntensity: 1.6 });
const BLOOMS = [0xf4eee0, 0xe9a4b8, 0xf2c14e, 0xd9667a];

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** A garland sagging between two points: green leaves with a bloom every third. */
export function buildGarland(ax: number, ay: number, az: number, bx: number, by: number, bz: number, n = 9): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const sag = Math.sin(t * Math.PI) * 0.45;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t - sag;
    const z = az + (bz - az) * t;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), m(i % 2 ? 0x4f7f3a : 0x6aa04b));
    leaf.position.set(x, y, z);
    g.add(leaf);
    if (i % 3 === 1) {
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), m(BLOOMS[Math.floor(i / 3) % 4]!));
      bloom.position.set(x, y + 0.1, z + 0.08);
      g.add(bloom);
    }
  }
  return g;
}

/** A post with a torch: a wooden pole, a gold knob, a flame (flickers in `update`). */
export function buildWeddingPost(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.14, 3.4, 0.14, m(0x6b4a2f), 0, 1.7, 0));
  g.add(box(0.26, 0.1, 0.26, m(0x2f2a26, { metalness: 0.4 }), 0, 2.05, 0));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 6), FLAME());
  flame.position.y = 2.3;
  flame.name = "flame";
  g.add(flame);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), m(0xd4af37, { metalness: 0.5 }));
  knob.position.y = 3.45;
  g.add(knob);
  return g;
}

/** The arch: two posts and a bow of leaves and blooms, with the saffron banner hung from it. */
export function buildWeddingArch(): THREE.Group {
  const g = new THREE.Group();
  const { halfWidth: w, height: h } = WEDDING_ARCH;
  for (const x of [-w, w]) g.add(box(0.16, h, 0.16, m(0x6b4a2f), x, h / 2, 0));
  g.add(buildGarland(-w, h, 0, w, h, 0, 14));
  // The banner: saffron cloth, the colour of the veil, with a gold border.
  g.add(box(2.4, 0.9, 0.04, m(0xe9a23b), 0, h + 0.85, 0));
  g.add(box(2.4, 0.08, 0.05, m(0xd4af37), 0, h + 1.3, 0));
  g.add(box(2.4, 0.08, 0.05, m(0xd4af37), 0, h + 0.4, 0));
  g.add(box(2.7, 0.07, 0.07, m(0x6b4a2f), 0, h + 1.38, 0));
  return g;
}

export interface WeddingScene {
  group: THREE.Group;
  /** Read the book: dress or undress the town; true when the celebration is owed and has not yet played. */
  setBook(book: WeddingBook): boolean;
  /** Play the celebration (the dressing stays up for it, then comes down). */
  celebrate(): void;
  update(dt: number, now: number): void;
  /** Is the dressing standing now (dressed, or celebrating)? For tests. */
  dressed(): boolean;
  celebrating(): boolean;
}

/**
 * The controller. `setBook` is idempotent: the dressing stands from the
 * dressing step until the day is held, and never from a held and
 * celebrated day, so a reload after the day finds the town ordinary.
 */
export function createWeddingScene(): WeddingScene {
  const group = new THREE.Group();
  const dressing = new THREE.Group();
  dressing.visible = false;
  group.add(dressing);
  for (const [x, z] of WEDDING_POSTS) {
    const post = buildWeddingPost();
    post.position.set(x, terrainHeight(x, z), z);
    dressing.add(post);
  }
  // Garlands along each side, post to post, hung from just under the torch.
  for (const side of [0, 1]) {
    const posts = WEDDING_POSTS.slice(side * 5, side * 5 + 5);
    for (let i = 0; i + 1 < posts.length; i++) {
      const [ax, az] = posts[i]!;
      const [bx, bz] = posts[i + 1]!;
      dressing.add(buildGarland(ax, terrainHeight(ax, az) + 2.9, az, bx, terrainHeight(bx, bz) + 2.9, bz));
    }
  }
  const arch = buildWeddingArch();
  arch.position.set(0, terrainHeight(0, WEDDING_ARCH.z), WEDDING_ARCH.z);
  dressing.add(arch);

  // Petals drift down while the celebration plays.
  const petals = new THREE.Group();
  petals.visible = false;
  const petalMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 28; i++) {
    const petal = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.07), m(BLOOMS[i % 4]!, { side: THREE.DoubleSide }));
    petal.userData = { x: ((i * 37) % 17) / 17 * 6 - 3, z: ((i * 53) % 29) / 29 * 20 - 11, phase: i * 0.7 };
    petalMeshes.push(petal);
    petals.add(petal);
  }
  group.add(petals);

  let dressed = false;
  let celebrationAge: number | null = null;

  const refresh = () => {
    dressing.visible = dressed || celebrationAge !== null;
    petals.visible = celebrationAge !== null;
  };

  return {
    group,
    setBook(book) {
      dressed = townDressed(book);
      // A day already held and celebrated leaves nothing standing.
      if (celebrationAge === null) refresh();
      else dressing.visible = true;
      return weddingPending(book);
    },
    celebrate() {
      if (celebrationAge !== null) return;
      celebrationAge = 0;
      refresh();
    },
    update(dt, now) {
      if (!dressing.visible) return;
      dressing.traverse((o) => {
        if (o.name === "flame") o.scale.y = 1 + 0.2 * Math.sin(now * 11 + o.parent!.position.x * 3 + o.parent!.position.z);
      });
      if (celebrationAge !== null) {
        celebrationAge += dt;
        for (const p of petalMeshes) {
          const u = p.userData as { x: number; z: number; phase: number };
          const fall = (now * 0.35 + u.phase) % 1;
          p.position.set(u.x + Math.sin(now * 0.8 + u.phase) * 0.6, 4.2 - fall * 4.1 + terrainHeight(u.x, u.z), u.z);
          p.rotation.set(now + u.phase, u.phase, now * 0.7);
        }
        if (celebrationAge >= WEDDING_CELEBRATION_SECONDS) {
          celebrationAge = null;
          // The town is ordinary again unless the dressing has not yet been undone by the book.
          refresh();
        }
      }
    },
    dressed: () => dressing.visible,
    celebrating: () => celebrationAge !== null,
  };
}
