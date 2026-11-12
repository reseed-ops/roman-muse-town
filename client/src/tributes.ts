// Lucretia's statue (Task 54) and Athena's temple (Task 55), built in
// code in the town's low-poly style (the Roman pack has no figure but
// Mars, and its one temple is already the town's). Pure meshes and
// colliders here; townScene places them, picks them and seats them.
import * as THREE from "three";
import { ATHENA_TEMPLE, LUCRETIA } from "./town";

const MARBLE = 0xece6d8;
const PLINTH = 0xd2c7ae;
const TRAVERTINE = 0xd9cfb8;
const PLASTER = 0xe8dcc4;
const TERRACOTTA = 0xb5562f;
const OLIVE_LEAF = 0x7c8a4a;
const ROSE = 0xb3202e;
const STEM = 0x3f6b2f;

const m = (color: number, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });

/** Letters cut into stone: dark letters on a stone-coloured plate. */
function carvedPlate(text: string, w: number, h: number, stone: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  if (typeof document === "undefined") return new THREE.Mesh(geo, m(stone));
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.max(32, Math.round((512 * h) / w));
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = `#${stone.toString(16).padStart(6, "0")}`;
    g.fillRect(0, 0, c.width, c.height);
    let size = Math.round(c.height * 0.62);
    g.font = `600 ${size}px Georgia, 'Times New Roman', serif`;
    while (g.measureText(text).width > c.width * 0.9 && size > 10) g.font = `600 ${(size -= 2)}px Georgia, 'Times New Roman', serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(60,48,34,0.85)";
    g.fillText(text, c.width / 2, c.height / 2 + 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}

/** A rose: a short stem, two leaves, a bloom of a few cupped petals. */
function buildRose(): THREE.Group {
  const rose = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), m(STEM));
  stem.rotation.z = Math.PI / 2;
  stem.position.x = -0.15;
  rose.add(stem);
  for (const [lx, side] of [[-0.12, 1], [-0.22, -1]] as const) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), m(STEM));
    leaf.scale.set(1, 0.25, 0.5);
    leaf.position.set(lx, 0.005, side * 0.025);
    rose.add(leaf);
  }
  const petalMat = m(ROSE, 0.7);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 7, 5), petalMat);
  rose.add(core);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 4), petalMat);
    petal.scale.set(0.5, 1, 1);
    petal.position.set(0.012, Math.cos(a) * 0.028, Math.sin(a) * 0.028);
    rose.add(petal);
  }
  rose.position.y = 0.03;
  return rose;
}

/** A built tribute. Its colliders live in townScene's obstacle list (from the
 *  same constants in town.ts), where the walking audit reads them. */
export type Tribute = { group: THREE.Group };

/**
 * Lucretia: a draped standing figure (stola to the ground, a palla over
 * the shoulders, hands folded at the waist, head a little bowed) on a
 * plinth cut with her name, a rose at her feet. Local frame: her front
 * is +z. `ground` is the ground's height at her place.
 */
export function buildLucretia(ground: number): Tribute {
  const group = new THREE.Group();
  const marble = m(MARBLE, 0.6);
  const stone = m(PLINTH, 0.9);
  const half = LUCRETIA.plinthHalf;
  const base = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.16, 0.14, half * 2 + 0.16), stone);
  base.position.y = 0.07;
  const block = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.86, half * 2), stone);
  block.position.y = 0.14 + 0.43;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.1, 0.1, half * 2 + 0.1), stone);
  cap.position.y = 1.05;
  const name = carvedPlate("LVCRETIA", 0.82, 0.2, PLINTH);
  name.position.set(0, 0.68, half + 0.002);
  group.add(base, block, cap, name);
  const top = 1.1;

  // The figure, about 1.75 m: the stola as a lathe from hem to shoulders.
  const profile = [
    [0.0, 0], [0.27, 0], [0.26, 0.08], [0.22, 0.45], [0.18, 0.85], [0.16, 0.98],
    [0.19, 1.15], [0.21, 1.3], [0.19, 1.4], [0.09, 1.47], [0.0, 1.48],
  ].map(([r, y]) => new THREE.Vector2(r!, y!));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 12), marble);
  body.scale.z = 0.78;
  body.position.y = top;
  // The palla: a mantle over the left shoulder, falling across the body.
  const palla = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.62, 10, 1, true), marble);
  palla.material.side = THREE.DoubleSide;
  palla.scale.z = 0.8;
  palla.rotation.z = 0.32;
  palla.position.set(0.02, top + 1.12, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 8), marble);
  neck.position.y = top + 1.52;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 9), marble);
  head.scale.set(0.9, 1.1, 0.95);
  head.position.set(0, top + 1.66, 0.02);
  head.rotation.x = 0.18; // a little bowed
  // Hair drawn back to a knot, and a veil's edge over the crown.
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), marble);
  knot.position.set(0, top + 1.66, -0.1);
  const veil = new THREE.Mesh(new THREE.SphereGeometry(0.118, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), marble);
  veil.position.copy(head.position);
  veil.rotation.x = -0.35;
  // Arms in the drapery, forearms meeting at the waist, hands folded.
  const arm = (side: 1 | -1) => {
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.26, 3, 8), marble);
    upper.position.set(side * 0.2, top + 1.2, 0.02);
    upper.rotation.z = side * 0.12;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 3, 8), marble);
    fore.position.set(side * 0.1, top + 0.98, 0.12);
    fore.rotation.set(1.25, 0, side * -1.0);
    return [upper, fore];
  };
  const hands = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), marble);
  hands.scale.set(1.4, 0.8, 0.9);
  hands.position.set(0, top + 0.93, 0.19);
  group.add(body, palla, neck, head, knot, veil, ...arm(1), ...arm(-1), hands);
  const rose = buildRose();
  rose.rotation.y = 0.5;
  rose.position.set(0.12, top, half - 0.12);
  group.add(rose);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  group.position.set(LUCRETIA.position[0], ground, LUCRETIA.position[1]);
  group.rotation.y = LUCRETIA.rotY;
  return { group };
}

/**
 * Athena's temple: a small prostyle temple on a podium, four columns
 * before a hollow plastered cella (a real doorway, Athena within, a lamp), a terracotta gable
 * roof, an olive wreath in the pediment and her name on the frieze, a
 * deep front step to sit on. Local frame: the front is +x.
 */
export function buildAthenaTemple(ground: number): Tribute {
  const { halfX, halfZ, podiumY, stepY, stepDepth } = ATHENA_TEMPLE;
  const group = new THREE.Group();
  const trav = m(TRAVERTINE, 0.9);
  const marble = m(MARBLE, 0.65);
  const podium = new THREE.Mesh(new THREE.BoxGeometry(halfX * 2, podiumY, halfZ * 2), trav);
  podium.position.y = podiumY / 2;
  const step = new THREE.Mesh(new THREE.BoxGeometry(stepDepth, stepY, halfZ * 2 - 0.2), trav);
  step.position.set(halfX + stepDepth / 2, stepY / 2, 0);
  group.add(podium, step);

  // The cella (Task 87): a hollow room on the back two-thirds of the podium, its floor at the
  // podium's top, walls a hand thick, and a real doorway in the front wall.
  const C = ATHENA_TEMPLE.cella;
  const cellaH = C.height;
  const plaster = m(PLASTER, 0.95);
  const wallBox = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, mat: THREE.Material = plaster) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    w.position.set((x0 + x1) / 2, podiumY + (y0 + y1) / 2, (z0 + z1) / 2);
    group.add(w);
  };
  wallBox(C.x0, C.x0 + C.wall, -C.halfZ, C.halfZ, 0, cellaH); // back wall
  wallBox(C.x0 + C.wall, C.x1, -C.halfZ, -C.halfZ + C.wall, 0, cellaH); // north wall
  wallBox(C.x0 + C.wall, C.x1, C.halfZ - C.wall, C.halfZ, 0, cellaH); // south wall
  for (const side of [1, -1]) { // the front wall either side of the door
    const z0 = C.doorHalf, z1 = C.halfZ - C.wall;
    wallBox(C.x1 - C.wall, C.x1, side > 0 ? z0 : -z1, side > 0 ? z1 : -z0, 0, cellaH);
  }
  wallBox(C.x1 - C.wall, C.x1, -C.doorHalf, C.doorHalf, C.doorH, cellaH); // the lintel
  // the door's marble frame and sill, and a marble floor inside
  for (const side of [1, -1]) wallBox(C.x1 - C.wall - 0.02, C.x1 + 0.03, side > 0 ? C.doorHalf - 0.08 : -C.doorHalf, side > 0 ? C.doorHalf : -C.doorHalf + 0.08, 0, C.doorH, marble);
  wallBox(C.x1 - C.wall - 0.02, C.x1 + 0.03, -C.doorHalf, C.doorHalf, C.doorH - 0.08, C.doorH, marble);
  wallBox(C.x0 + C.wall, C.x1 + 0.05, -C.doorHalf, C.doorHalf, 0, 0.03, marble); // sill, running in as the floor's runner
  wallBox(C.x0 + C.wall, C.x1 - C.wall, -C.halfZ + C.wall, C.halfZ - C.wall, 0, 0.02, m(0xd9d2c0, 0.6)); // the floor
  // A bronze lamp on a stand in the corner and the warm light it throws, so her marble reads inside.
  const bronze = m(0x8a6a3a, 0.45);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.05, 0.9, 8), bronze);
  stand.position.set(-0.45, podiumY + 0.45, 0.95);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.07, 10), bronze);
  bowl.position.set(-0.45, podiumY + 0.93, 0.95);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc46b }));
  flame.scale.y = 1.6;
  flame.position.set(-0.45, podiumY + 1.0, 0.95);
  const lamp = new THREE.PointLight(0xffd29a, 3, 5, 1.4);
  lamp.position.set(-0.3, podiumY + 1.9, 0.2);
  group.add(stand, bowl, flame, lamp);

  // Four columns across the front.
  const colH = cellaH;
  const colX = halfX - 0.3;
  for (const cz of [-1.35, -0.45, 0.45, 1.35]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.155, colH - 0.2, 10), marble);
    shaft.position.set(colX, podiumY + 0.1 + (colH - 0.2) / 2, cz);
    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10), marble);
    baseRing.position.set(colX, podiumY + 0.05, cz);
    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), marble);
    capital.position.set(colX, podiumY + colH - 0.05, cz);
    group.add(shaft, baseRing, capital);
  }
  // The entablature, with her name on the frieze.
  const entY = podiumY + colH;
  const ent = new THREE.Mesh(new THREE.BoxGeometry(halfX * 2, 0.32, halfZ * 2), marble);
  ent.position.y = entY + 0.16;
  const frieze = carvedPlate("ATHENA · MINERVA", 2.6, 0.22, MARBLE);
  frieze.rotation.y = Math.PI / 2;
  frieze.position.set(halfX + 0.004, entY + 0.16, 0);
  group.add(ent, frieze);

  // The pediment and the roof: a gable running front to back.
  const gableH = 0.75;
  const tri = new THREE.Shape();
  tri.moveTo(-halfZ - 0.08, 0);
  tri.lineTo(halfZ + 0.08, 0);
  tri.lineTo(0, gableH);
  tri.closePath();
  const pedGeo = new THREE.ExtrudeGeometry(tri, { depth: halfX * 2, bevelEnabled: false });
  const pediment = new THREE.Mesh(pedGeo, marble);
  pediment.rotation.y = -Math.PI / 2;
  pediment.position.set(halfX, entY + 0.32, 0);
  const slope = Math.hypot(halfZ + 0.2, gableH);
  const pitch = Math.atan2(gableH, halfZ + 0.2);
  const roofMat = m(TERRACOTTA, 0.8);
  for (const side of [1, -1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(halfX * 2 + 0.2, 0.07, slope), roofMat);
    roof.position.set(0, entY + 0.32 + gableH / 2 + 0.03, (side * (halfZ + 0.2)) / 2);
    roof.rotation.x = side * pitch;
    group.add(roof);
  }
  group.add(pediment);

  // The olive wreath in the pediment: a ring of small leaves round a
  // marble disc, two sprays tied at the foot.
  const leafMat = m(OLIVE_LEAF, 0.8);
  const wreath = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), m(0xe2dccb, 0.7));
  wreath.add(disc);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + 0.35 + (i / 13) * (Math.PI * 2 - 0.7);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), leafMat);
    leaf.scale.set(0.45, 1, 0.3);
    leaf.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.02);
    leaf.rotation.z = a + 0.5;
    wreath.add(leaf);
  }
  wreath.rotation.y = Math.PI / 2;
  wreath.position.set(halfX + 0.03, entY + 0.32 + gableH * 0.36, 0);
  group.add(wreath);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });

  const [cx, cz] = ATHENA_TEMPLE.position;
  group.position.set(cx, ground, cz);
  return { group };
}
