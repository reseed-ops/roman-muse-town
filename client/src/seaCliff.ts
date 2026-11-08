// The sea cliff (Task 34): a path out of the town's south gate, along a
// grassy peninsula, to a headland over the sea, with a stone bench at
// its edge. The owner's place: the trails above the ocean he walked
// alone, built so the two of them can stand there together.
//
// The headland points south, with sea on three sides, so the sun rises
// over the water to the left (east) and sets into it to the right (west)
// at Rome's true bearings, and the true moon lays its path on the sea.
// The town's south edge becomes a coast: a cliff of about 25 metres to
// the water, hidden from inside the town by its own edge, open from the
// headland. Pure geometry here (the outline, what is walkable, the world
// clamp) plus the meshes, built once; townScene places and animates.
import * as THREE from "three";

export const CLIFF = {
  /** The coast: the town ground's south edge, and the sea's level. */
  coastZ: 56,
  seaY: -25,
  /** The peninsula's land: a strip south from the coast to a round headland. */
  landHalf: 9,
  stripEndZ: 106,
  head: { x: 0, z: 113, r: 11.5 },
  /** Where one may walk: the strip a little narrower, the headland short of its edge. */
  walkHalf: 5.4,
  walkFromZ: 46,
  walkHeadR: 8.6,
  /** The bench at the headland's edge, a sitter facing the sea (rotY pi faces +Z, south). */
  bench: { id: "bench-cliff", x: 0, z: 118.4, rotY: Math.PI },
  /** The path's centre line, from the gate to the bench. */
  pathFromZ: 44,
  pathToZ: 117,
} as const;

/** Is (x, z) on the peninsula's land (for meshes)? */
export function onLand(x: number, z: number): boolean {
  if (z >= CLIFF.coastZ - 0.001 && z <= CLIFF.stripEndZ && Math.abs(x) <= CLIFF.landHalf) return true;
  return Math.hypot(x - CLIFF.head.x, z - CLIFF.head.z) <= CLIFF.head.r;
}

/** Is (x, z) where one may walk on the peninsula? */
export function walkable(x: number, z: number): boolean {
  if (z >= CLIFF.walkFromZ && z <= CLIFF.head.z && Math.abs(x) <= CLIFF.walkHalf) return true;
  return Math.hypot(x - CLIFF.head.x, z - CLIFF.head.z) <= CLIFF.walkHeadR;
}

/** The nearest walkable point on the peninsula. */
export function nearestWalkable(x: number, z: number): { x: number; z: number } {
  if (walkable(x, z)) return { x, z };
  const strip = { x: Math.max(-CLIFF.walkHalf, Math.min(CLIFF.walkHalf, x)), z: Math.max(CLIFF.walkFromZ, Math.min(CLIFF.head.z, z)) };
  const dx = x - CLIFF.head.x;
  const dz = z - CLIFF.head.z;
  const d = Math.hypot(dx, dz) || 1;
  const head = { x: CLIFF.head.x + (dx / d) * CLIFF.walkHeadR, z: CLIFF.head.z + (dz / d) * CLIFF.walkHeadR };
  return Math.hypot(x - strip.x, z - strip.z) <= Math.hypot(x - head.x, z - head.z) ? strip : head;
}

/**
 * The world's walking bounds, shared by Gaius and Aelia: the town disc
 * (radius 52), the forest lobe (its normalised distance at most 0.985),
 * and now the peninsula. Outside all three, the walker is eased back to
 * the nearest of them.
 */
export function clampToWorld(
  x: number,
  z: number,
  forest: { norm: (x: number, z: number) => number; cx: number; cz: number },
): { x: number; z: number } {
  const rad = Math.hypot(x, z);
  const fn = forest.norm(x, z);
  if (rad <= 52 || fn <= 0.985 || walkable(x, z)) return { x, z };
  const rim = { x: (x / rad) * 52, z: (z / rad) * 52 };
  const wood = { x: forest.cx + ((x - forest.cx) / fn) * 0.985, z: forest.cz + ((z - forest.cz) / fn) * 0.985 };
  const cape = nearestWalkable(x, z);
  const d = (p: { x: number; z: number }) => Math.hypot(x - p.x, z - p.z);
  return [rim, wood, cape].reduce((best, p) => (d(p) < d(best) ? p : best));
}

/** Deterministic jitter for the rock faces (no Math.random: the cliff is the same every load). */
const jitter = (i: number, j: number) => {
  const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return s - Math.floor(s) - 0.5;
};

/** The peninsula's outline, west side north to south, round the headland, east side back north. */
export function landOutline(step = 6): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const { head, landHalf, coastZ } = CLIFF;
  const dz = Math.sqrt(head.r * head.r - landHalf * landHalf);
  const turnZ = head.z - dz;
  // The edge is roughened a little, always outward, so the land never overhangs it.
  const rough = (i: number) => (jitter(i, 7) + 0.5) * 0.9;
  // Roughness tapers to nothing at the coast and at the turn, so the
  // strip's cliff meets the coast's and the headland's without a notch.
  const taper = (z: number) => Math.min(1, Math.max(0, (z - coastZ) / 4), Math.max(0, (turnZ - z) / 6));
  for (let z = coastZ; z < turnZ; z += 4) pts.push({ x: -landHalf - rough(z) * taper(z), z });
  const a0 = Math.atan2(-dz, -landHalf);
  const a1 = Math.atan2(-dz, landHalf) - 2 * Math.PI;
  const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / ((step * Math.PI) / 180)));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const r = head.r + rough(i + 100) * Math.min(1, i / 3, (n - i) / 3);
    pts.push({ x: head.x + Math.cos(a) * r, z: head.z + Math.sin(a) * r });
  }
  for (let z = turnZ; z >= coastZ; z -= 4) pts.push({ x: landHalf + rough(z + 50) * taper(z), z });
  pts.push({ x: landHalf, z: coastZ });
  return pts;
}

function nearestOnOutline(outline: { x: number; z: number }[], x: number, z: number): { x: number; z: number } {
  let best = outline[0]!;
  let bestD = Infinity;
  for (let i = 0; i < outline.length - 1; i++) {
    const a = outline[i]!;
    const b = outline[i + 1]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2));
    const p = { x: a.x + abx * t, z: a.z + abz * t };
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}


/** Outward from the peninsula's spine (x 0, coast to the headland's centre):
 *  sideways along the strip, radial round the headland, turning smoothly. */
export function outwardFromSpine(p: { x: number; z: number }): { x: number; z: number } {
  const sz = Math.max(CLIFF.coastZ, Math.min(CLIFF.head.z, p.z));
  const dx = p.x;
  const dz = p.z - sz;
  const d = Math.hypot(dx, dz) || 1;
  return { x: dx / d, z: dz / d };
}

export type SeaCliff = {
  group: THREE.Group;
  oceanMat: THREE.MeshStandardMaterial;
  foamMat: THREE.MeshBasicMaterial;
  moonPath: THREE.Mesh;
  sunPath: THREE.Mesh;
  /** The grass of the peninsula and the outer land, tinted with the town's ground. */
  landMats: THREE.MeshStandardMaterial[];
};

/** A cliff face from a polyline: from each point's ground height down past the sea. */
function cliffFace(points: { x: number; z: number }[], top: (x: number, z: number) => number, mat: THREE.Material, outward: (p: { x: number; z: number }) => { x: number; z: number }): THREE.Mesh {
  const rows = 4;
  const positions: number[] = [];
  const index: number[] = [];
  points.forEach((p, i) => {
    const o = outward(p);
    const yTop = top(p.x, p.z);
    for (let r = 0; r <= rows; r++) {
      const k = r / rows;
      const y = yTop + (CLIFF.seaY - 1.5 - yTop) * k;
      // Rock bulges a little outward at mid-height, ragged, never inward past the land's edge.
      const push = (0.4 + 0.9 * Math.sin(k * Math.PI) + jitter(i, r) * 0.9) * (r === 0 ? 0 : 1);
      positions.push(p.x + o.x * push, y + jitter(r, i) * (r === 0 || r === rows ? 0 : 0.8), p.z + o.z * push);
    }
  });
  for (let i = 0; i < points.length - 1; i++) {
    for (let r = 0; r < rows; r++) {
      const a = i * (rows + 1) + r;
      const b = (i + 1) * (rows + 1) + r;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildSeaCliff(opts: { terrainHeight: (x: number, z: number) => number; waterNormal: THREE.Texture; foamTexture: THREE.Texture; pathTexture: THREE.Texture }): SeaCliff {
  const group = new THREE.Group();
  const { coastZ, seaY } = CLIFF;
  const h = opts.terrainHeight;
  const grass = new THREE.MeshStandardMaterial({ color: 0x7f9a58, roughness: 0.95 });
  const meadow = new THREE.MeshStandardMaterial({ color: 0x7a9554, roughness: 1 });
  const rock = new THREE.MeshStandardMaterial({ color: 0x8b7f6c, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
  const outline = landOutline();

  // The peninsula's grass: a grid whose outside vertices are drawn in
  // onto the outline, so its edge is the cliff's edge.
  {
    const minX = -CLIFF.head.r - 1;
    const maxX = CLIFF.head.r + 1;
    const maxZ = CLIFF.head.z + CLIFF.head.r + 1;
    const nx = Math.ceil(maxX - minX);
    const nz = Math.ceil(maxZ - coastZ);
    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - coastZ, nx, nz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + (minX + maxX) / 2;
      let z = pos.getZ(i) + (coastZ + maxZ) / 2;
      if (!onLand(x, z)) {
        const p = nearestOnOutline(outline, x, z);
        x = p.x;
        z = Math.max(coastZ, p.z);
      }
      pos.setXYZ(i, x, h(x, z) + 0.01, z);
    }
    geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, grass);
    land.receiveShadow = true;
    group.add(land);
  }
  // The trail: a worn earth strip from the gate to the bench.
  {
    const len = CLIFF.pathToZ - CLIFF.pathFromZ;
    const geo = new THREE.PlaneGeometry(1.5, len, 1, Math.ceil(len));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) + (CLIFF.pathFromZ + CLIFF.pathToZ) / 2;
      // A gentle wander, so it reads as a trail, not a road.
      const x = pos.getX(i) + Math.sin(z * 0.11) * 1.1 * Math.min(1, Math.max(0, (z - 58) / 10));
      pos.setXYZ(i, x, h(x, z) + 0.035, z);
    }
    geo.computeVertexNormals();
    const trail = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xa48a64, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    trail.receiveShadow = true;
    group.add(trail);
  }
  // The peninsula's cliffs, and the coast's, east and west of it.
  {
    group.add(cliffFace(outline, (x, z) => h(x, z), rock, outwardFromSpine));
    for (const side of [-1, 1]) {
      const pts: { x: number; z: number }[] = [];
      for (let x = CLIFF.landHalf; x <= 600; x += x < 70 ? 3 : 20) pts.push({ x: side * x, z: coastZ });
      group.add(cliffFace(side < 0 ? pts : pts, (x, z) => (Math.abs(x) <= 56 ? h(x, z) : -0.05), rock, () => ({ x: 0, z: 1 })));
    }
  }
  // Land beyond the town's ground, so its edges meet meadow, not sky:
  // west, east and north of the town, out to the fog.
  for (const [w, d, x, z] of [
    [544, 656, -328, -272],
    [544, 656, 328, -272],
    [112, 544, 0, -328],
  ] as [number, number, number, number][]) {
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, meadow);
    m.position.set(x, -0.05, z);
    m.receiveShadow = true;
    group.add(m);
  }
  // The sea: wide, below everything, moving under its normal map.
  const oceanTex = opts.waterNormal.clone();
  oceanTex.wrapS = THREE.RepeatWrapping;
  oceanTex.wrapT = THREE.RepeatWrapping;
  oceanTex.repeat.set(160, 160);
  oceanTex.needsUpdate = true;
  const oceanMat = new THREE.MeshStandardMaterial({ color: 0x1f5674, roughness: 0.22, metalness: 0.15, normalMap: oceanTex, normalScale: new THREE.Vector2(0.9, 0.9) });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, seaY, 300);
  group.add(ocean);
  // Surf at the cliff's foot: a pale band that swells and falls.
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xf2f6f8, map: opts.foamTexture, transparent: true, opacity: 0.5, depthWrite: false });
  {
    const band = (pts: { x: number; z: number }[], out: (p: { x: number; z: number }) => { x: number; z: number }) => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const index: number[] = [];
      pts.forEach((p, i) => {
        const o = out(p);
        positions.push(p.x + o.x * 1.6, seaY + 0.06, p.z + o.z * 1.6, p.x + o.x * 4.2, seaY + 0.05, p.z + o.z * 4.2);
        uvs.push(i * 0.35, 0, i * 0.35, 1);
        if (i < pts.length - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(index);
      const mesh = new THREE.Mesh(geo, foamMat);
      mesh.renderOrder = 1;
      group.add(mesh);
    };
    band(outline.filter((p) => p.z > CLIFF.coastZ + 0.5), outwardFromSpine);
    for (const side of [-1, 1]) {
      const pts: { x: number; z: number }[] = [];
      for (let x = CLIFF.landHalf + 2; x <= 260; x += 4) pts.push({ x: side * x, z: coastZ });
      band(pts, () => ({ x: 0, z: 1 }));
    }
  }
  // Light on the water: the moon's silver path and, low in the sky, the sun's gold.
  const pathTex = opts.pathTexture;
  const moonPath = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 150),
    new THREE.MeshBasicMaterial({ color: 0xdceaff, map: pathTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  moonPath.rotation.x = -Math.PI / 2;
  moonPath.position.y = seaY + 0.1;
  const sunPath = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 170),
    new THREE.MeshBasicMaterial({ color: 0xffb46a, map: pathTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sunPath.rotation.x = -Math.PI / 2;
  sunPath.position.y = seaY + 0.09;
  group.add(moonPath, sunPath);
  return { group, oceanMat, foamMat, moonPath, sunPath, landMats: [grass, meadow] };
}

/** Lay a light path on the sea from the viewer toward a body's bearing. */
export function aimSeaPath(mesh: THREE.Mesh, viewX: number, viewZ: number, azimDeg: number): void {
  const az = (azimDeg * Math.PI) / 180;
  const dx = Math.sin(az);
  const dz = -Math.cos(az);
  const half = (mesh.geometry as THREE.PlaneGeometry).parameters.height / 2;
  mesh.position.x = viewX + dx * (half + 14);
  mesh.position.z = viewZ + dz * (half + 14);
  mesh.rotation.z = Math.atan2(-dx, -dz);
}
