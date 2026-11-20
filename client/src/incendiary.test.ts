import { expect, test } from "bun:test";
import { Group, Mesh, Vector3 } from "three";
import { animateIncendiary, buildIncendiary, INCENDIARY_SPOT, solveShot } from "./incendiary";
import { CLIFF, trailX } from "./seaCliff";

for (const speed of [0, 1.6]) {
  test(`pot reaches the animated endpoint at speed ${speed}`, () => {
    const p = new Vector3(4.6, 1, 115.5);
    const aim = new Vector3(0, -24, 168);
    const drift = new Vector3(speed, 0, -speed / 10);
    const time = 2.4, step = time / 240;
    const v = solveShot(p, aim, drift, time, 12)!;
    for (let i = 0; i < 240; i++) {
      p.addScaledVector(v, step);
      p.y -= 6 * step * step;
      v.y -= 12 * step;
    }
    expect(p.distanceTo(aim.addScaledVector(drift, time))).toBeLessThan(1e-8);
  });
}

test("machine fits the headland and clears the path and bench", () => {
  const { x, z } = INCENDIARY_SPOT;
  expect(Math.hypot(x - CLIFF.head.x, z - CLIFF.head.z)).toBeLessThanOrEqual(CLIFF.walkHeadR);
  expect(Math.hypot(x - CLIFF.bench.x, z - CLIFF.bench.z)).toBeGreaterThanOrEqual(2);
  for (let pathZ = CLIFF.pathFromZ; pathZ <= CLIFF.pathToZ; pathZ += 0.1) {
    if (Math.hypot(x - trailX(pathZ), z - pathZ) < 2.5) throw new Error("Too close to trail");
  }
});

test("machine triangle budget and empty-lane firing cycle", () => {
  const machine = buildIncendiary();
  let triangles = 0;
  machine.traverse(o => {
    if (o instanceof Mesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  expect(triangles).toBeLessThanOrEqual(8000);
  const fx = animateIncendiary(machine, new Group(), () => null);
  fx.loose();
  for (let i = 1; i <= 150; i++) fx.update(i / 60, 1 / 60);
  expect(fx.state()).toEqual({ phase: "reloading", lastImpact: "water", burns: 1 });
  fx.loose();
  fx.update(8.6, 6.1);
  expect(fx.state()).toEqual({ phase: "ready", lastImpact: "water", burns: 0 });
});

test("deck fire follows a moving hull and expires", () => {
  const hull = { kind: "trade" as const, x: 0, y: -26.1, z: 168, vx: 1.6, vz: 0, length: 14 };
  const effects = new Group();
  const fx = animateIncendiary(buildIncendiary(), effects, () => hull, () => 0.5);
  fx.loose();
  for (let i = 1; i <= 150; i++) {
    hull.x += hull.vx / 60;
    fx.update(i / 60, 1 / 60);
  }
  expect(fx.state().lastImpact).toBe("deck");
  const patch = effects.children[effects.children.length - 1]!;
  const offset = patch.position.x - hull.x;
  hull.x += 8;
  fx.update(7.5, 5);
  expect(patch.position.x - hull.x).toBeCloseTo(offset);
  fx.update(23, 15.5);
  expect(fx.state().burns).toBe(0);
});

test("an edge of the dispersion range can splash beside a sailing hull", () => {
  const hull = { kind: "trade" as const, x: 35, y: -26.1, z: 168, vx: 1.6, vz: 0, length: 14 };
  const fx = animateIncendiary(buildIncendiary(), new Group(), () => hull, () => 1);
  fx.loose();
  for (let i = 1; i <= 180; i++) {
    hull.x += hull.vx / 60;
    fx.update(i / 60, 1 / 60);
  }
  expect(fx.state().lastImpact).toBe("water");
});
