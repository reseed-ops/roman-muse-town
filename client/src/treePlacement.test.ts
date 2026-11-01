import { expect, test } from "bun:test";
import { Box3, BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { TreePlacement } from "./treePlacement";

function mesh(w: number, h: number, d: number, x: number, z: number) {
  const object = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial());
  object.position.set(x, h / 2, z);
  return object;
}
function gap(a: Mesh, b: Mesh) {
  const aa = new Box3().setFromObject(a), bb = new Box3().setFromObject(b);
  return Math.max(bb.min.x - aa.max.x, aa.min.x - bb.max.x, bb.min.z - aa.max.z, aa.min.z - bb.max.z);
}

test("moves the full canopy outside rotated roofs, retaining trunk offsets", () => {
  const placement = new TreePlacement((x) => x / 10, (x) => x >= 0);
  const roof = mesh(8, 3, 12, 0, 0); roof.rotation.y = Math.PI / 4;
  placement.addBuilding(roof, "Villa roof");
  const tree = mesh(4, 5, 4, 5, 0);
  const trunk = placement.bindCollider({ x: 5.4, z: -0.2 }, 5, 0);
  const oldY = tree.position.y;
  placement.addTree(tree, 5, 0);
  expect(gap(tree, roof)).toBeGreaterThanOrEqual(0.6 - 1e-9);
  expect(trunk.x).toBeCloseTo(tree.position.x + 0.4);
  expect(trunk.z).toBeCloseTo(tree.position.z - 0.2);
  expect(tree.position.y).toBeCloseTo(oldY + (tree.position.x - 5) / 10);
});

test("a building arriving after the tree also triggers clearance", () => {
  const placement = new TreePlacement(() => 0, (_x, z) => z >= 0);
  const tree = mesh(3, 5, 3, 4, 0);
  placement.addTree(tree, 4, 0);
  const roof = mesh(10, 4, 10, 0, 0);
  placement.addBuilding(roof, "Late building");
  expect(gap(tree, roof)).toBeGreaterThanOrEqual(0.6 - 1e-9);
  expect(tree.position.z).toBeGreaterThanOrEqual(0);
  const trunk = placement.bindCollider({ x: 4, z: 0 }, 4, 0);
  expect(trunk.x).toBe(tree.position.x);
  expect(trunk.z).toBe(tree.position.z);
});

test("trees already clear remain at their planted positions", () => {
  const placement = new TreePlacement(() => 0, () => true);
  placement.addBuilding(mesh(4, 4, 4, 0, 0), "House");
  const tree = mesh(2, 5, 2, 10, 10);
  placement.addTree(tree, 10, 10);
  expect(tree.position.x).toBe(10);
  expect(tree.position.z).toBe(10);
});
