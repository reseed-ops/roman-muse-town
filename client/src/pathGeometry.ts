import { CatmullRomCurve3, Vector3 } from "three";

export type PathPoint = [number, number];
const sampled = new WeakMap<PathPoint[], { points: PathPoint[]; length: number }>();

/** Shared centreline for drawing, vegetation clearance, and layout checks. */
export function samplePath(controlPoints: PathPoint[]) {
  const cached = sampled.get(controlPoints);
  if (cached) return cached;
  const curve = new CatmullRomCurve3(controlPoints.map(([x, z]) => new Vector3(x, 0, z)));
  const length = curve.getLength();
  const points = curve.getSpacedPoints(Math.max(2, Math.ceil(length / 0.35))).map(p => [p.x, p.z] as PathPoint);
  const result = { points, length };
  sampled.set(controlPoints, result);
  return result;
}

export function distanceToPaths(x: number, z: number, paths: PathPoint[][]): number {
  let best = Infinity;
  for (const path of paths) {
    const { points } = samplePath(path);
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1]!, [bx, bz] = points[i]!;
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
  }
  return best;
}
