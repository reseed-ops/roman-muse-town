// Walker collision: pure geometry, with no scene in it, so it can be
// tested on its own. The town's actual shapes are listed in townScene.ts.

export type CircleObstacle = { kind: "circle"; x: number; z: number; r: number; pad?: number; ghost?: boolean };
export type ObbObstacle = { kind: "obb"; x: number; z: number; halfW: number; halfD: number; rot: number; pad?: number; ghost?: boolean };
export type Obstacle = CircleObstacle | ObbObstacle;

/** A live body that is not in the static list: Aelia, as he walks. */
export type LiveBody = { x: number; z: number; r: number; pad?: number };

export const circ = (x: number, z: number, r: number, pad?: number): CircleObstacle => ({ kind: "circle", x, z, r, pad });
export const obb = (x: number, z: number, halfW: number, halfD: number, rot: number): ObbObstacle => ({ kind: "obb", x, z, halfW, halfD, rot });

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Point in an OBB's local frame (lx along its width, lz along its depth). */
export function obbLocal(ob: ObbObstacle, x: number, z: number): { lx: number; lz: number } {
  const dx = x - ob.x;
  const dz = z - ob.z;
  const c = Math.cos(ob.rot);
  const s = Math.sin(ob.rot);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}

/** Local-frame point (or direction, when dx/dz are deltas) back to world. */
export function obbWorld(ob: ObbObstacle, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(ob.rot);
  const s = Math.sin(ob.rot);
  return { x: ob.x + lx * c + lz * s, z: ob.z - lx * s + lz * c };
}

/** How far a character with clearance `defAdd` keeps from a shape. */
function clearanceFor(ob: Obstacle, defAdd: number): number {
  return ob.pad === undefined ? defAdd : Math.min(ob.pad, defAdd);
}

/** Push a point out of ONE obstacle (circle or OBB). Positional
 *  push-out only ever removes the penetrating component, so a
 *  diagonal push against a wall keeps its tangential part, that
 *  is what makes walls slide instead of stick. */
export function pushOutOf(ob: Obstacle, x: number, z: number, defAdd: number): { x: number; z: number } {
  const add = clearanceFor(ob, defAdd);
  if (ob.kind === "circle") {
    const dx = x - ob.x;
    const dz = z - ob.z;
    const dist = Math.hypot(dx, dz);
    const minDist = ob.r + add;
    if (dist < minDist && dist > 0.0001) {
      return { x: ob.x + (dx / dist) * minDist, z: ob.z + (dz / dist) * minDist };
    }
    if (dist <= 0.0001) return { x: ob.x + minDist, z };
    return { x, z };
  }
  const { lx, lz } = obbLocal(ob, x, z);
  const qx = clamp(lx, -ob.halfW, ob.halfW);
  const qz = clamp(lz, -ob.halfD, ob.halfD);
  if (qx !== lx || qz !== lz) {
    // Outside the box: keep `add` clearance from the closest point
    // (face or corner) of the rectangle.
    const ddx = lx - qx;
    const ddz = lz - qz;
    const d = Math.hypot(ddx, ddz);
    if (d >= add || d <= 0.0001) return { x, z };
    return obbWorld(ob, qx + (ddx / d) * add, qz + (ddz / d) * add);
  }
  // Inside the box: leave by the axis of least penetration.
  const penX = ob.halfW - Math.abs(lx) + add;
  const penZ = ob.halfD - Math.abs(lz) + add;
  if (penX < penZ) return obbWorld(ob, lx >= 0 ? ob.halfW + add : -ob.halfW - add, lz);
  return obbWorld(ob, lx, lz >= 0 ? ob.halfD + add : -ob.halfD - add);
}

/** Resolve a character at (x, z) out of every obstacle, iterating a
 *  few passes so being pushed out of one shape into another (a booth
 *  against a lamp, two walls at a corner) still settles outside both.
 *  The live body goes FIRST in each pass, so the static shapes always
 *  have the last word: a body can crowd a walker but never shove him
 *  into a wall. `fence` is the final say on ground nobody may stand on.
 *  Ghosts never block anyone. */
export function resolveCollisions(
  obstacles: readonly Obstacle[],
  x: number,
  z: number,
  defAdd: number,
  body?: LiveBody,
  fence?: (x: number, z: number) => { x: number; z: number },
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 3; pass++) {
    if (body) {
      const out = pushOutOf(circ(body.x, body.z, body.r, body.pad), px, pz, defAdd);
      px = out.x;
      pz = out.z;
    }
    for (const ob of obstacles) {
      if (ob.ghost) continue;
      const out = pushOutOf(ob, px, pz, defAdd);
      px = out.x;
      pz = out.z;
    }
    if (fence) {
      const out = fence(px, pz);
      px = out.x;
      pz = out.z;
    }
  }
  return { x: px, z: pz };
}

/** Does the straight step from A to B enter a box it did not start in?
 *  The walker's last line of defence: however a step was pushed around,
 *  it may not end up on or across a wall. A step that starts inside a
 *  box is let go, so a walker placed in one can always get out. */
export function stepEntersBox(obstacles: readonly Obstacle[], ax: number, az: number, bx: number, bz: number): boolean {
  for (const ob of obstacles) {
    if (ob.kind !== "obb" || ob.ghost) continue;
    const a = obbLocal(ob, ax, az);
    if (Math.abs(a.lx) <= ob.halfW && Math.abs(a.lz) <= ob.halfD) continue;
    const b = obbLocal(ob, bx, bz);
    // Slab test: clip the segment to both of the box's axes.
    let t0 = 0;
    let t1 = 1;
    let misses = false;
    for (const [from, to, half] of [[a.lx, b.lx, ob.halfW], [a.lz, b.lz, ob.halfD]] as const) {
      const d = to - from;
      if (Math.abs(d) < 1e-9) {
        if (Math.abs(from) > half) misses = true;
        continue;
      }
      const t2 = (-half - from) / d;
      const t3 = (half - from) / d;
      t0 = Math.max(t0, Math.min(t2, t3));
      t1 = Math.min(t1, Math.max(t2, t3));
    }
    if (!misses && t0 <= t1) return true;
  }
  return false;
}
