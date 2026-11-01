import * as THREE from "three";

// The Meta Sudans, the "sweating goal": the tall conical fountain of
// brick and concrete that stood south-west of the Colosseum, with water
// sweating down its cone rather than leaping from a jet. Attested in
// existence and position; the detail is reconstruction. The real one
// stood about 17 m, and a true-to-scale cone here would be under 1.5,
// so this is taller than the town's scale so it can read as a landmark.

export const META_SUDANS = { height: 3.4, baseRadius: 0.72, topRadius: 0.1 } as const;

/** The cone and its film of running water, standing on y = 0 at the
 *  origin. `sweat` is what the frame loop keeps moving. */
export function buildMetaSudans(brick: THREE.Material): { group: THREE.Group; sweat: THREE.Mesh } {
  const { height, baseRadius, topRadius } = META_SUDANS;
  const group = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, baseRadius, height, 18), brick);
  cone.position.y = height / 2;
  cone.castShadow = true;
  group.add(cone);
  const sweat = new THREE.Mesh(
    new THREE.CylinderGeometry(topRadius + 0.012, baseRadius + 0.012, height * 0.97, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x9fd4ef,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  sweat.position.y = (height * 0.97) / 2;
  group.add(sweat);
  return { group, sweat };
}

export const META_SUDANS_LINES = [
  "They call it the Meta Sudans: the sweating post. It doesn't leap like other fountains, it just perspires, patiently, like a senator in August.",
  "A cone like the turning posts at the races, weeping water down its sides. The real one stood taller than a house, out by the Colosseum.",
  "Listen close and it barely makes a sound. All that brick, and the water just slides down it.",
];
