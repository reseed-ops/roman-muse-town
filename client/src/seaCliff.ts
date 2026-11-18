// The sea cliff (Task 34): a path out of the town's south gate, along a
// grassy peninsula, to a headland over the sea, with a stone bench at
// its edge. The owner's place: the trails above the ocean he walked
// alone, built so the two of them can stand there together.
//
// The headland points south, with sea on three sides, so for someone
// walking out along it (facing south) the sun rises over the water on
// the left (east) and sets into it on the right (west), at Rome's true
// bearings, and the true moon lays its path on the sea.
// The town's south edge becomes a coast: a cliff of about 25 metres to
// the water, hidden from inside the town by its own edge, open from the
// headland. Pure geometry here (the outline, what is walkable, the world
// clamp) plus the meshes, built once; townScene places and animates.
import { installSeaWaves, seaGridGeometry } from "./seaSurface";
import * as THREE from "three";
import { applySurfaceVariation } from "./surfaceVariation";
import { hillRise, SHOULDER, shoulderRise } from "./shoulder";
import { nearestStairPoint, stairWalkable } from "./shoreStair";

export { hillRise, SHOULDER, shoulderRise };

/**
 * The sea's colour by day and by night. A true blue, not a teal: the old
 * 0x1f5674 had green in it, and under the warm light of a low sun its
 * green channel won and the sea read as meadow (Task 69).
 */
export const OCEAN_DAY = 0x2260ae;
export const OCEAN_NIGHT = 0x0e2a4a;

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

/**
 * Does a round piece of horizon dressing (a hill of radius r, a tree, a
 * meadow edge) stay on the land north of the coast? South of the coast is
 * the sea, 25 m down, and anything left there stands in the water or
 * swallows the peninsula's trail.
 */
export function clearOfSea(z: number, r = 0): boolean {
  return z + r <= CLIFF.coastZ;
}

/**
 * A horizon hill's base ring sits at this y, below the outer land (-0.05)
 * and the meadow's disc is lower still (-0.6): the dome rises out of the
 * land, and nothing of it lies buried in or coplanar with another layer.
 */
export const HILL_BASE_Y = -0.3;

/**
 * A horizon hill's geometry: the upper half of a sphere only, base ring
 * at y 0 (the scene puts it at HILL_BASE_Y). The old full sphere buried
 * its lower half through the meadow disc, the outer land and, near the
 * coast, the cliff top: layers of surface that flickered at distance.
 */
export function horizonHillGeometry(r: number): THREE.SphereGeometry {
  return new THREE.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
}

/** The meadow's z, cut at the coast: the meadow never reaches over the sea. */
export function cutAtCoast(z: number): number {
  return clearOfSea(z) ? z : CLIFF.coastZ;
}

/**
 * The rolling hills on the town's horizon: [x, z, radius, height]. All
 * on land, west, north and east; the south is the sea. (The eastern one
 * once stood at z 70 and a western one at (-45, 105), over the coast and
 * the peninsula's trail, and the far western one at z 15 reached the sea.)
 */
export const HORIZON_HILLS: readonly (readonly [number, number, number, number])[] = [
  [-70, -80, 46, 13],
  [55, -95, 55, 16],
  [105, -25, 40, 11],
  [-110, 5, 48, 12],
  [20, -120, 60, 15],
  [100, 12, 40, 10],
];

/** The trail's width: its edges are this far either side of its centre. */
export const TRAIL_HALF = 0.75;

/**
 * The trail's centre line at z: down the strip's middle, x between 0 and
 * 1, a slow wander so it reads as a trail and not a road. It never
 * approaches the shoulder, whose foot stays west of x -7 (shoulder.ts).
 */
export function trailX(z: number): number {
  return 0.5 + 0.5 * Math.sin(z * 0.11) * Math.min(1, Math.max(0, (z - 58) / 10));
}

type Pt = { x: number; z: number };

/** Deterministic jitter for the rock faces (no Math.random: the cliff is the same every load). */
const jitter = (i: number, j: number) => {
  const s = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return s - Math.floor(s) - 0.5;
};

/** The coast's bay and the shoulder's lobe: where the outline leaves the straight coast and where it rejoins the strip. */
/** How far the grass overlaps the town plane north of the coast, metres. */
const GRASS_LAP = 0.5;

export const COAST_FILLET = { x: -96, r: 8 } as const;

/**
 * The land's edge, as a polygon: from the coast in the west (tangent to
 * it, a bay either side of the shoulder), south round the shoulder's
 * lobe, back to the strip's west side, round the headland and up the
 * strip's east side to (9, 56). `rough` roughens the edge, always
 * outward, so the land never overhangs its cliff; the smooth polygon is
 * what `onLand` tests. Normals: see `outlineNormals`.
 */
function buildOutline(step: number, rough: boolean): Pt[] {
  const { head, landHalf, coastZ } = CLIFF;
  const R = COAST_FILLET.r;
  const out: Pt[] = [];
  const jag = (i: number, k: number) => (rough ? (jitter(i, k) + 0.5) * 0.9 : 0);
  // Each part's roughness tapers to nothing at both of its ends, so parts meet without a notch.
  const ends = (i: number, n: number) => Math.min(1, i / 3, (n - i) / 3);
  const parts: { pts: Pt[]; seed: number; taper: boolean }[] = [];
  // 1. The west bay: a quarter arc, tangent to the coast, into the lobe's west side.
  {
    const cx = COAST_FILLET.x;
    const cz = coastZ + R;
    const pts: Pt[] = [];
    for (let i = 0; i <= 8; i++) {
      const f = (i / 8) * (Math.PI / 2);
      pts.push({ x: cx + R * Math.sin(f), z: cz - R * Math.cos(f) });
    }
    parts.push({ pts, seed: 11, taper: false });
  }
  // 2. The lobe: a Hermite chain from the bay's end (heading south) to the
  //    strip's west side (heading east, then a small bay of its own).
  {
    const way: Pt[] = [
      { x: COAST_FILLET.x + R, z: coastZ + R },
      { x: -89, z: 74 },
      { x: -86, z: 84 },
      { x: -79, z: 92 },
      { x: -68, z: 98.5 },
      { x: -54, z: 101.5 },
      { x: -40, z: 102.5 },
      { x: -27, z: 102 },
      { x: -17, z: 101.6 },
      { x: -13, z: 101.5 },
    ];
    const tan = (i: number): Pt => {
      if (i === 0) {
        const d = Math.hypot(way[1]!.x - way[0]!.x, way[1]!.z - way[0]!.z);
        return { x: 0, z: d };
      }
      if (i === way.length - 1) {
        const d = Math.hypot(way[i]!.x - way[i - 1]!.x, way[i]!.z - way[i - 1]!.z);
        return { x: d, z: 0 };
      }
      return { x: (way[i + 1]!.x - way[i - 1]!.x) / 2, z: (way[i + 1]!.z - way[i - 1]!.z) / 2 };
    };
    const pts: Pt[] = [];
    for (let i = 0; i < way.length - 1; i++) {
      const p0 = way[i]!;
      const p1 = way[i + 1]!;
      const m0 = tan(i);
      const m1 = tan(i + 1);
      const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      const n = Math.max(2, Math.round(len / 3));
      for (let k = i === 0 ? 1 : 0; k < n; k++) {
        const t = k / n;
        const h00 = 2 * t ** 3 - 3 * t * t + 1;
        const h10 = t ** 3 - 2 * t * t + t;
        const h01 = -2 * t ** 3 + 3 * t * t;
        const h11 = t ** 3 - t * t;
        pts.push({ x: h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x, z: h00 * p0.z + h10 * m0.z + h01 * p1.z + h11 * m1.z });
      }
    }
    pts.push(way[way.length - 1]!);
    parts.push({ pts, seed: 23, taper: true });
  }
  // 3. The small bay where the lobe's south edge meets the strip's west side.
  {
    const r = 4;
    const cx = -13;
    const cz = 101.5 + r;
    const pts: Pt[] = [];
    for (let i = 1; i <= 6; i++) {
      const f = (i / 6) * (Math.PI / 2);
      pts.push({ x: cx + r * Math.sin(f), z: cz - r * Math.cos(f) });
    }
    parts.push({ pts, seed: 31, taper: false });
  }
  // 4. The headland, round from the strip's west side to its east side.
  {
    const dz = Math.sqrt(head.r * head.r - landHalf * landHalf);
    const a0 = Math.atan2(-dz, -landHalf);
    const a1 = Math.atan2(-dz, landHalf) - 2 * Math.PI;
    const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / ((step * Math.PI) / 180)));
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push({ x: head.x + Math.cos(a) * head.r, z: head.z + Math.sin(a) * head.r });
    }
    parts.push({ pts, seed: 100, taper: true });
  }
  const rr: number[] = [];
  for (const part of parts) {
    const n = part.pts.length - 1;
    part.pts.forEach((p, i) => {
      out.push(p);
      rr.push(part.taper ? jag(i + part.seed, 7) * ends(i, n) : 0);
    });
  }
  // 5. The strip's east side, back north to the coast.
  const turnZ = head.z - Math.sqrt(head.r * head.r - landHalf * landHalf);
  const taper = (z: number) => Math.min(1, Math.max(0, (z - coastZ) / 4), Math.max(0, (turnZ - z) / 6));
  // (the headland's last point is already at turnZ)
  for (let z = turnZ - 4; z >= coastZ; z -= 4) {
    out.push({ x: landHalf, z });
    rr.push(jag(z + 50, 7) * taper(z));
  }
  out.push({ x: landHalf, z: coastZ });
  rr.push(0);
  if (!rough) return out;
  // Push each point outward along the smooth outline's own normal by its roughness.
  const nrm = normalsOf(out);
  return out.map((p, i) => ({ x: p.x + nrm[i]!.x * rr[i]!, z: p.z + nrm[i]!.z * rr[i]!, }));
}

/** Signed area of the closed polygon (the outline closed along the coast), positive for one winding, negative for the other. */
function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

/** Real outward unit normals of an outline: its tangent's perpendicular, signed by the polygon's winding. */
function normalsOf(pts: Pt[]): Pt[] {
  const sign = signedArea(pts) > 0 ? 1 : -1;
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const d = Math.hypot(tx, tz) || 1;
    return { x: (sign * tz) / d, z: (-sign * tx) / d };
  });
}

let smoothCache: Pt[] | null = null;
const smoothOutline = () => (smoothCache ??= buildOutline(6, false));

/** The peninsula's outline, west bay first, round the lobe and the headland, back up the east side. */
export function landOutline(step = 6): Pt[] {
  return buildOutline(step, true);
}

/** Outward unit normals for each point of `landOutline(step)`. Computed from the smooth polygon. */
export function outlineNormals(step = 6): Pt[] {
  return normalsOf(step === 6 ? smoothOutline() : buildOutline(step, false));
}

/** Is (p) inside the polygon (the outline closed along the coast)? */
function insidePolygon(poly: Pt[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Is (x, z) on the peninsula's land (the shoulder, the strip and the headland)? South of the coast only. */
export function onLand(x: number, z: number): boolean {
  if (z < CLIFF.coastZ - 0.001 || z > CLIFF.head.z + CLIFF.head.r || x < COAST_FILLET.x || x > CLIFF.head.x + CLIFF.head.r) return false;
  return insidePolygon(smoothOutline(), x, z);
}

/**
 * Is (x, z) where one may walk on the peninsula? The strip and the
 * headland, as ever. The shoulder is scenery: it is not walkable, and
 * nothing here needs to know where it is.
 */
export function walkable(x: number, z: number): boolean {
  if (stairWalkable(x, z)) return true; // Task 100: the landing and the stair down to the sea
  if (z >= CLIFF.walkFromZ && z <= CLIFF.head.z && Math.abs(x) <= CLIFF.walkHalf) return true;
  return Math.hypot(x - CLIFF.head.x, z - CLIFF.head.z) <= CLIFF.walkHeadR;
}

/** The nearest walkable point on the peninsula: the strip's or the headland's clamp. */
export function nearestWalkable(x: number, z: number): Pt {
  if (walkable(x, z)) return { x, z };
  const strip = { x: Math.max(-CLIFF.walkHalf, Math.min(CLIFF.walkHalf, x)), z: Math.max(CLIFF.walkFromZ, Math.min(CLIFF.head.z, z)) };
  const dx = x - CLIFF.head.x;
  const dz = z - CLIFF.head.z;
  const d = Math.hypot(dx, dz) || 1;
  const hr = CLIFF.walkHeadR - 1e-6; // a hair inside, so rounding never lands it outside
  const head = { x: CLIFF.head.x + (dx / d) * hr, z: CLIFF.head.z + (dz / d) * hr };
  const stair = nearestStairPoint(x, z);
  const away = (p: Pt) => Math.hypot(x - p.x, z - p.z);
  return [strip, head, stair].reduce((best, p) => (away(p) < away(best) ? p : best));
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

/** The nearest point on the peninsula's smooth outline (the swimmer's wall, Task 100). */
export function nearestOnLandEdge(x: number, z: number): Pt {
  return nearestOnOutline(smoothOutline(), x, z);
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
function cliffFace(points: { x: number; z: number }[], top: (x: number, z: number) => number, mat: THREE.Material, outwards: { x: number; z: number }[]): THREE.Mesh {
  const rows = 4;
  const positions: number[] = [];
  const index: number[] = [];
  points.forEach((p, i) => {
    const o = outwards[i]!;
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

/**
 * The rock below the sea (Task 100): the cliff's own foot (the face ends
 * 1.5 m under the surface) carried straight down to below the sea floor,
 * so a swimmer sees rock where the cliff goes on, never a gap under the
 * land. The same points, normals and push as `cliffFace`'s last row.
 */
function cliffSkirt(points: { x: number; z: number }[], outwards: { x: number; z: number }[], mat: THREE.Material): THREE.Mesh {
  const rows = 4;
  const positions: number[] = [];
  const index: number[] = [];
  points.forEach((p, i) => {
    const o = outwards[i]!;
    const push = 0.4 + jitter(i, rows) * 0.9;
    const x = p.x + o.x * push;
    const z = p.z + o.z * push;
    positions.push(x, CLIFF.seaY - 1.5, z, x, SKIRT_BOTTOM, z);
    if (i < points.length - 1) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "cliff-skirt";
  return mesh;
}
/** Below the deepest sea floor (about 20 m under the sea): the skirt ends here, out of sight. */
const SKIRT_BOTTOM = CLIFF.seaY - 30;

/**
 * The town plane is 112 m square, centred on the origin: its uv is the
 * world's x and z over that span. The shoulder's ground continues it, so
 * a shared material shows no seam where they meet.
 */
const planeUV = (x: number, z: number): [number, number] => [(x + 56) / 112, (56 - z) / 112];

export function buildSeaCliff(opts: {
  terrainHeight: (x: number, z: number) => number;
  waterNormal: THREE.Texture;
  foamTexture: THREE.Texture;
  pathTexture: THREE.Texture;
  /** The town's own ground material (its texture, tint and wetness): when given, the shoulder wears it. */
  groundMaterial?: THREE.MeshStandardMaterial;
}): SeaCliff {
  const group = new THREE.Group();
  const { coastZ, seaY } = CLIFF;
  const h = opts.terrainHeight;
  const grass = opts.groundMaterial ?? new THREE.MeshStandardMaterial({ color: 0x7f9a58, roughness: 0.95 });
  const meadow = applySurfaceVariation(new THREE.MeshStandardMaterial({ color: 0x7a9554, roughness: 1 }), "grass"); // Task 109
  const rock = applySurfaceVariation(new THREE.MeshStandardMaterial({ color: 0x8b7f6c, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }), "rock"); // Task 109
  const outline = landOutline();

  // The peninsula's grass (the shoulder, the strip and the headland): a
  // grid whose outside vertices are drawn in onto the outline, so its
  // edge is the cliff's edge. Heights are the town's own terrainHeight,
  // which carries the shoulder's rise: one function for the whole ground.
  // A grid vertex out in the sea snaps to the nearest outline point, and
  // where the outline is concave (the small bay where the lobe meets the
  // strip) two neighbours can snap to opposite walls and span the water,
  // so a triangle whose centre is outside the land is dropped.
  {
    const minX = COAST_FILLET.x - 1;
    const maxX = CLIFF.head.r + 1;
    const maxZ = CLIFF.head.z + CLIFF.head.r + 1;
    // The grid starts GRASS_LAP north of the coast, over the town plane's
    // last row: the plane's vertices (0.875 m apart) and the grass's
    // (0.5 m) do not coincide along z 56, and an edge-to-edge join leaves
    // hairline gaps the sea shows through. The overlap, lifted a hair,
    // covers them.
    const minZ = coastZ - GRASS_LAP;
    // Half-metre cells.
    const nx = Math.ceil(maxX - minX) * 2;
    const nz = Math.ceil(maxZ - minZ) * 2;
    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, nx, nz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const gridX = new Float32Array(pos.count);
    const gridZ = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + (minX + maxX) / 2;
      let z = pos.getZ(i) + (minZ + maxZ) / 2;
      gridX[i] = x;
      gridZ[i] = z;
      let lift = 0.01;
      if (z < coastZ - 1e-6) {
        // The lap, north of the coast: over the attachment as it is, drawn in at its two ends.
        lift = 0.02;
        if (x < COAST_FILLET.x || x > CLIFF.landHalf) {
          x = Math.max(COAST_FILLET.x, Math.min(CLIFF.landHalf, x));
          z = coastZ;
        }
      } else if (!onLand(x, z)) {
        const p = nearestOnOutline(outline, x, z);
        x = p.x;
        z = Math.max(coastZ, p.z);
      }
      pos.setXYZ(i, x, h(x, z) + lift, z);
      const [u, v] = planeUV(x, z);
      geo.attributes.uv!.setXY(i, u, v);
    }
    const idx = geo.getIndex()!;
    const kept: number[] = [];
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      const b = idx.getX(i + 1);
      const c = idx.getX(i + 2);
      const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
      const area = (pos.getX(b) - pos.getX(a)) * (pos.getZ(c) - pos.getZ(a)) - (pos.getX(c) - pos.getX(a)) * (pos.getZ(b) - pos.getZ(a));
      if (Math.abs(area) < 1e-9) continue; // collapsed onto the edge
      // Folded over by the snap (its winding reversed from the grid's own): dropped.
      const native = (gridX[b]! - gridX[a]!) * (gridZ[c]! - gridZ[a]!) - (gridX[c]! - gridX[a]!) * (gridZ[b]! - gridZ[a]!);
      if (Math.sign(area) !== Math.sign(native)) continue;
      if (insidePolygon(outline, cx, cz) || cz <= coastZ + 0.01) kept.push(a, b, c);
    }
    geo.setIndex(kept);
    geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, grass);
    land.receiveShadow = true;
    group.add(land);
  }
  // The west apron: the town plane ends at x -56, but the shoulder's
  // foot reaches the coast west of it, so a strip of ground between the
  // town plane and the coast's flat outer land is displaced by the same
  // heightfield. It falls to the outer land's level (-0.05) wherever the
  // rise is nothing, so it joins it with no step.
  {
    const x0 = COAST_FILLET.x;
    const x1 = -55.5; // overlaps the town plane's edge (x -56) by half a metre, under a hair of lift, so no hairline gap shows
    const z0 = SHOULDER.northZ;
    const geo = new THREE.PlaneGeometry(x1 - x0, coastZ - z0, Math.round((x1 - x0) / 0.875), Math.round((coastZ - z0) / 0.875));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (x0 + x1) / 2;
      const z = pos.getZ(i) + (z0 + coastZ) / 2;
      const k = Math.min(1, shoulderRise(x, z) / 0.3);
      const lap = Math.min(1, Math.max(0, (x + 57.5) / 1.5));
      pos.setXYZ(i, x, h(x, z) - 0.05 * (1 - k * k * (3 - 2 * k)) + 0.02 * lap * lap * (3 - 2 * lap), z);
      const [u, v] = planeUV(x, z);
      geo.attributes.uv!.setXY(i, u, v);
    }
    geo.computeVertexNormals();
    const apron = new THREE.Mesh(geo, opts.groundMaterial ?? meadow);
    apron.receiveShadow = true;
    apron.name = "shoulder-apron";
    group.add(apron);
  }
  // The trail: a worn earth strip from the gate to the bench.
  {
    const len = CLIFF.pathToZ - CLIFF.pathFromZ;
    const geo = new THREE.PlaneGeometry(TRAIL_HALF * 2, len, 1, Math.ceil(len));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) + (CLIFF.pathFromZ + CLIFF.pathToZ) / 2;
      // A gentle wander down the strip's middle, so it reads as a trail, not a road.
      const x = pos.getX(i) + trailX(z);
      pos.setXYZ(i, x, h(x, z) + 0.035, z);
    }
    geo.computeVertexNormals();
    const trail = new THREE.Mesh(geo, applySurfaceVariation(new THREE.MeshStandardMaterial({ color: 0xa48a64, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }), "dirt")); // Task 109
    trail.receiveShadow = true;
    group.add(trail);
  }
  // The peninsula's cliffs (the lobe, the strip, the headland), and the
  // coast's, east and west of it. The straight coast is gone from
  // x -96 to 9: the land is there. Normals are the outline's own.
  const normals = outlineNormals();
  {
    group.add(cliffFace(outline, (x, z) => h(x, z), rock, normals));
    group.add(cliffSkirt(outline, normals, rock));
    for (const side of [-1, 1]) {
      const pts: { x: number; z: number }[] = [];
      const from = side < 0 ? -COAST_FILLET.x : CLIFF.landHalf;
      for (let x = from; x <= 600; x += x < 70 ? 3 : 20) pts.push({ x: side * x, z: coastZ });
      group.add(cliffFace(pts, (x, z) => (Math.abs(x) <= 56 ? h(x, z) : -0.05), rock, pts.map(() => ({ x: 0, z: 1 }))));
      group.add(cliffSkirt(pts, pts.map(() => ({ x: 0, z: 1 })), rock));
    }
  }
  // Land beyond the town's ground, so its edges meet meadow, not sky:
  // west, east and north of the town, out to the fog.
  for (const [w, d, x, z] of [
    [504, 656, -348, -272],
    [40, 644, -76, -278],
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
  // Task 102: the waves carry the big shapes now; the normal map keeps only the fine ripple on them.
  const oceanMat = new THREE.MeshStandardMaterial({ color: OCEAN_DAY, roughness: 0.22, metalness: 0.15, normalMap: oceanTex, normalScale: new THREE.Vector2(0.55, 0.55) });
  installSeaWaves(oceanMat);
  const ocean = new THREE.Mesh(seaGridGeometry(0), oceanMat);
  ocean.position.y = seaY;
  ocean.name = "ocean";
  group.add(ocean);
  // Surf at the cliff's foot: a pale band that swells and falls.
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xf2f6f8, map: opts.foamTexture, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  installSeaWaves(foamMat); // the surf rides the swell with the water
  {
    const band = (pts: { x: number; z: number }[], outs: { x: number; z: number }[]) => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const index: number[] = [];
      pts.forEach((p, i) => {
        const o = outs[i]!;
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
    // The whole outline but its last point, the strip's corner on the coast (the straight band takes over there).
    band(outline.slice(0, -1), normals.slice(0, -1));
    for (const side of [-1, 1]) {
      const pts: { x: number; z: number }[] = [];
      for (let x = (side < 0 ? -COAST_FILLET.x : CLIFF.landHalf) + 2; x <= 260; x += 4) pts.push({ x: side * x, z: coastZ });
      band(pts, pts.map(() => ({ x: 0, z: 1 })));
    }
  }
  // Light on the water: the moon's silver path and, low in the sky, the sun's gold.
  const pathTex = opts.pathTexture;
  const moonPath = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 150, 6, 60),
    new THREE.MeshBasicMaterial({ color: 0xdceaff, map: pathTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  moonPath.rotation.x = -Math.PI / 2;
  moonPath.position.y = seaY + 0.1;
  const sunPath = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 170, 8, 68),
    new THREE.MeshBasicMaterial({ color: 0xffb46a, map: pathTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  );
  sunPath.rotation.x = -Math.PI / 2;
  sunPath.position.y = seaY + 0.09;
  // The light paths lie on the waves too (their vertices ride the same surface).
  installSeaWaves(moonPath.material as THREE.Material);
  installSeaWaves(sunPath.material as THREE.Material);
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
