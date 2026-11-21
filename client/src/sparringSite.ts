// Where Archer's ring stands and what blocks the walk there. Kept apart from sparring.ts, which imports the licensed
// body, so the walking audit and CI (no licensed files) can read the colliders.
import { circ, obb, whileVisible } from "./collision";

export const post = { x: -3.2, z: 114.5 };
export const rackX = post.x - 2.2;
/** Gaius starts the bout 1.6 m from Archer, on the disc's open east side (the pilot put him due south, 0.9 m from the
 *  bench foliage's bush at (-3.2, 117.0), which then hid the bout from the camera behind him). He faces Archer. */
export const BOUT_DISTANCE = 1.6;
const BOUT_BEARING = 1.2; // radians from south toward east
export const boutStart = {
  x: post.x + BOUT_DISTANCE * Math.sin(BOUT_BEARING),
  z: post.z + BOUT_DISTANCE * Math.cos(BOUT_BEARING),
  heading: Math.atan2(-BOUT_DISTANCE * Math.sin(BOUT_BEARING), -BOUT_DISTANCE * Math.cos(BOUT_BEARING)),
};
export function sparringFootprints(body: { visible: boolean }, rack: { visible: boolean }) {
  return [
    whileVisible(body, circ(post.x, post.z, 0.36)),
    whileVisible(rack, obb(rackX, post.z, 0.53, 0.16, 0)),
  ];
}
