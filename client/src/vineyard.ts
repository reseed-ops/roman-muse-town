import { circ, type Obstacle } from "./collision";

/** The vineyard's stakes: one generator for the visual stakes and their colliders,
 *  so a layout edit moves both. Six rows each side of the avenue, five stakes a row. */
export function vineyardStakes(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const side of [-1, 1]) {
    for (let row = 0; row < 6; row++) {
      const x = side * (11.5 + row * 1.5);
      for (let k = 0; k < 5; k++) out.push({ x, z: 31.1 + k * 1.4 });
    }
  }
  return out;
}

/** Each 0.08 m stake blocks as a small post, so the rows between stay walkable. */
export function vineyardFootprints(): Obstacle[] {
  return vineyardStakes().map(({ x, z }) => circ(x, z, 0.06, 0.10));
}
