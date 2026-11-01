import { Box3, Vector3, type Object3D } from "three";

type Position = { x: number; z: number };
type Tree = { object: Object3D; origin: Position; bounds: Box3; moved: Position };

/** Visual clearance uses the entire loaded canopy and roof, independently of
 * the much smaller ground-level shapes used for walking. */
export class TreePlacement {
  private buildings: { name: string; bounds: Box3 }[] = [];
  private trees = new Map<string, Tree>();
  private colliders = new Map<string, { position: Position; original: Position }[]>();
  constructor(private ground: (x: number, z: number) => number, private allowed: (x: number, z: number, radius: number) => boolean) {}
  private key(x: number, z: number) { return `${x},${z}`; }

  addBuilding(object: Object3D, name: string): void {
    object.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(object, true);
    if (bounds.isEmpty()) return;
    this.buildings.push({ name, bounds });
    for (const tree of this.trees.values()) this.clear(tree);
  }

  addTree(object: Object3D, x: number, z: number): void {
    object.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(object, true);
    if (bounds.isEmpty()) return;
    const tree = { object, origin: { x, z }, bounds, moved: { x: 0, z: 0 } };
    this.trees.set(this.key(x, z), tree);
    this.clear(tree);
  }

  /** Retain existing trunk offsets and radii; only move their world positions. */
  bindCollider<T extends Position>(position: T, x: number, z: number): T {
    const key = this.key(x, z);
    const entries = this.colliders.get(key) ?? [];
    entries.push({ position, original: { x: position.x, z: position.z } });
    this.colliders.set(key, entries);
    const tree = this.trees.get(key);
    if (tree) this.sync(tree);
    return position;
  }

  private overlaps(bounds: Box3, dx: number, dz: number): boolean {
    // Extra space for wind sway and a visible gap beside walls/overhangs.
    const margin = 0.6;
    return this.buildings.some(({ bounds: b }) =>
      bounds.max.x + dx + margin > b.min.x && bounds.min.x + dx - margin < b.max.x &&
      bounds.max.z + dz + margin > b.min.z && bounds.min.z + dz - margin < b.max.z);
  }

  private clear(tree: Tree): void {
    if (!this.overlaps(tree.bounds, tree.moved.x, tree.moved.z)) return;
    const radius = Math.hypot(tree.bounds.max.x - tree.bounds.min.x, tree.bounds.max.z - tree.bounds.min.z) / 2;
    // Search from the planted position, smallest displacement first. Buildings
    // can stream in after trees, so every new building reruns this check.
    for (let distance = 0.5; distance <= 20; distance += 0.5) {
      for (let i = 0; i < 64; i++) {
        const angle = i * Math.PI * 2 / 64;
        const dx = Math.cos(angle) * distance, dz = Math.sin(angle) * distance;
        const x = tree.origin.x + dx, z = tree.origin.z + dz;
        if (!this.allowed(x, z, radius) || this.overlaps(tree.bounds, dx, dz)) continue;
        const next = tree.bounds.clone().translate(new Vector3(dx, 0, dz));
        if ([...this.trees.values()].some((other) => other !== tree &&
          next.max.x > other.bounds.min.x + other.moved.x && next.min.x < other.bounds.max.x + other.moved.x &&
          next.max.z > other.bounds.min.z + other.moved.z && next.min.z < other.bounds.max.z + other.moved.z)) continue;
        tree.object.position.x += dx - tree.moved.x;
        tree.object.position.z += dz - tree.moved.z;
        tree.object.position.y += this.ground(x, z) - this.ground(tree.origin.x + tree.moved.x, tree.origin.z + tree.moved.z);
        tree.moved = { x: dx, z: dz };
        tree.object.updateWorldMatrix(true, true);
        this.sync(tree);
        console.info("[muse-town] tree moved clear of buildings", { from: tree.origin, to: { x, z } });
        return;
      }
    }
    console.warn("[muse-town] no clear nearby tree position", tree.origin);
  }

  private sync(tree: Tree) {
    for (const { position, original } of this.colliders.get(this.key(tree.origin.x, tree.origin.z)) ?? []) {
      position.x = original.x + tree.moved.x;
      position.z = original.z + tree.moved.z;
    }
  }
}
