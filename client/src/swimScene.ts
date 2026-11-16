// The meshes of the swimmable sea (Task 100): the sea floor, the stair
// down to the water, and the surface seen from below. All built once
// from the pure numbers in shoreStair.ts and swim.ts, so what is drawn is
// what is walked and swum on. The cliff's rock carried down to the floor
// is built with the cliff itself (seaCliff.ts, `cliffSkirt`).
//
// Nothing else lives in the water in this first version: no plants, no
// fish, no props, no lights.
import * as THREE from "three";
import { SEA_Y, STAIR, STAIR_STEPS, treadTop } from "./shoreStair";
import { SEABED_EXTENT, seabedHeight, SWIM } from "./swim";
import { installSeaWaves, seaGridGeometry } from "./seaSurface";

export { SEABED_EXTENT };

const SAND_SHALLOW = new THREE.Color(0xd8c590);
const SAND_DEEP = new THREE.Color(0x7d8f8c);

/**
 * The sea floor: a heightfield of two-metre facets in warm sand toward the
 * shore, cooling to blue-grey in the deep, lit flat like the rest of the
 * town's low poly stone. Its own seabedHeight is the swimmer's floor.
 */
export function buildSeabed(): THREE.Mesh {
  const E = SEABED_EXTENT;
  const nx = Math.round((E.xMax - E.xMin) / E.cell);
  const nz = Math.round((E.zMax - E.zMin) / E.cell);
  const geo = new THREE.PlaneGeometry(E.xMax - E.xMin, E.zMax - E.zMin, nx, nz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (E.xMin + E.xMax) / 2;
    const z = pos.getZ(i) + (E.zMin + E.zMax) / 2;
    const y = seabedHeight(x, z);
    pos.setXYZ(i, x, y, z);
    const depth = SEA_Y - y;
    // Sand banded by faint ripples, cooler and darker in the deep.
    const ripple = 0.5 + 0.5 * Math.sin(x * 0.8 + Math.sin(z * 0.35) * 2.4);
    c.copy(SAND_SHALLOW).lerp(SAND_DEEP, Math.min(1, Math.max(0, (depth - 4) / 11)));
    c.multiplyScalar(0.9 + 0.12 * ripple);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }));
  mesh.name = "seabed";
  mesh.receiveShadow = false;
  return mesh;
}

/** A box's five outer faces (no underside) into a position list; double-sided material, so winding is free. */
function box(out: number[], x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const q = (a: number[], b: number[], c: number[], d: number[]) => out.push(...a, ...b, ...c, ...a, ...c, ...d);
  q([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]); // top
  q([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]); // north
  q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]); // south
  q([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]); // east
  q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]); // west
}

/**
 * The stair down to the sea: a landing off the trail, then 96 steps of
 * 0.3 m by 0.5 m hugging the strip's east face, each a block that goes
 * down into the mass below it, with a low kerb along the open side. It
 * runs on into the water, where the last steps stand under the surface.
 * Built of one travertine, flat shaded.
 */
export function buildShoreStair(): THREE.Mesh {
  const pos: number[] = [];
  const L = STAIR.landing;
  // The landing: a flat apron, laid a hair over the grass.
  box(pos, L.x0, STAIR.meshX1, -STAIR.thick, 0.03, L.z0, STAIR.topZ);
  // The kerb round the landing's east edge, and the stair's.
  box(pos, STAIR.x1 - 0.1, STAIR.meshX1, 0.03, 0.48, L.z0, STAIR.topZ);
  for (let i = 0; i < STAIR_STEPS; i++) {
    const z0 = STAIR.topZ + i * STAIR.run;
    const top = treadTop(i);
    // The mass deepens toward the foot, where the sea floor is far below.
    const bottom = top - STAIR.thick - 0.6 * Math.max(0, z0 - 86);
    box(pos, STAIR.meshX0, STAIR.meshX1, bottom, top, z0, z0 + STAIR.run);
    box(pos, STAIR.x1 - 0.1, STAIR.meshX1, top, top + 0.45, z0, z0 + STAIR.run);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.92, flatShading: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "shore-stair";
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

export type SwimWorld = {
  group: THREE.Group;
  /** The sea's surface seen from below. */
  underside: THREE.Mesh;
  undersideMat: THREE.MeshBasicMaterial;
  seabed: THREE.Mesh;
  stair: THREE.Mesh;
};

/**
 * Everything the swim adds to the scene. The underside is the sea's own
 * plane again, seen only from below (back faces only), a bright sheet
 * that ripples with the water's normal map; the ocean above is front
 * faces only, so the two never meet.
 */
export function buildSwimWorld(opts: { waterNormal: THREE.Texture }): SwimWorld {
  const group = new THREE.Group();
  const seabed = buildSeabed();
  const stair = buildShoreStair();
  const tex = opts.waterNormal.clone();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(70, 70);
  tex.needsUpdate = true;
  const undersideMat = new THREE.MeshBasicMaterial({ color: 0xa5d8ff, map: tex, side: THREE.BackSide, fog: true });
  installSeaWaves(undersideMat, { shadeFromBelow: true });
  const underside = new THREE.Mesh(seaGridGeometry(0), undersideMat);
  underside.position.y = SEA_Y;
  underside.name = "sea-underside";
  group.add(seabed, stair, underside);
  return { group, underside, undersideMat, seabed, stair };
}

/** Where the floor's edge lies: for tests, that the floor reaches past the swimmable sea. */
export const swimBoundsCovered = () =>
  SEABED_EXTENT.xMin < SWIM.bounds.xMin && SEABED_EXTENT.xMax > SWIM.bounds.xMax && SEABED_EXTENT.zMax > SWIM.bounds.zMax;
