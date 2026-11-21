import { expect, test } from "bun:test";
import { INCENDIARY_SPOT, incendiaryFootprints } from "./incendiary";
import { sparringFootprints } from "./sparringSite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (name: string) => readFileSync(join(import.meta.dir, name), "utf8");

test("Task 131: Archer's body is Tuan's Gladiator, never the centurion placeholder", () => {
  const source = read("sparring.ts");
  expect(source).toContain('import gladiatorUrl from "./assets/gladiator.vrm";');
  expect(source).toContain("export const ARCHER_MODEL_URL = gladiatorUrl;");
  expect(source).not.toContain("centurion");
});

test("Task 131: Archer and his rack collide with the pilot's measures, and the ballista's colliders stand beside them", () => {
  const owner = { visible: true };
  const [archer, rack] = sparringFootprints(owner, owner) as [any, any];
  expect([archer.kind, archer.x, archer.z, archer.r]).toEqual(["circle", -3.2, 114.5, 0.36]);
  expect([rack.kind, rack.x, rack.z, rack.halfW, rack.halfD]).toEqual(["obb", -5.4, 114.5, 0.53, 0.16]);
  expect(incendiaryFootprints().length).toBe(2); // the machine's runners and its foot, untouched
  // the ring's colliders and the machine's do not overlap one another
  const machine = incendiaryFootprints()[0] as any;
  expect(Math.hypot(archer.x - INCENDIARY_SPOT.x, archer.z - INCENDIARY_SPOT.z)).toBeGreaterThan(machine.halfW + archer.r);
});

test("Task 131: a hidden Archer (model not arrived) is a ghost, so he blocks nobody until he stands there", () => {
  const owner = { visible: false };
  const [archer, rack] = sparringFootprints(owner, owner) as [any, any];
  expect([archer.ghost, rack.ghost]).toEqual([true, true]);
  owner.visible = true;
  expect([archer.ghost, rack.ghost]).toEqual([false, false]);
});

test("Task 131: the scene wires the bout once: one sparring build, its colliders, its prompt and its tour hook, and the town's other colliders stay", () => {
  const scene = read("townScene.ts");
  const count = (needle: string) => scene.split(needle).length - 1;
  expect(count("buildSparring({")).toBe(1);
  expect(count("...sparring.obstacles")).toBe(1);
  expect(count("...incendiaryFootprints()")).toBe(1);
  expect(count("...movementFootprints(PLACES, placeReferences)")).toBe(1);
  expect(count("tourWindow.__sparring = sparring.tour")).toBe(1);
  expect(scene).toContain('get("tour") === "1"');
});

test("Task 131: Gaius starts 1.6 m from Archer, facing him, on the disc and clear of the bench foliage that sits south of Archer", async () => {
  const { boutStart, post, BOUT_DISTANCE } = await import("./sparringSite");
  const { BENCH_FOLIAGE } = await import("./benchFoliage");
  expect(Math.hypot(boutStart.x - post.x, boutStart.z - post.z)).toBeCloseTo(1.6, 9);
  expect(BOUT_DISTANCE).toBe(1.6);
  // heading h faces (sin h, cos h): that is the way to Archer
  expect(Math.sin(boutStart.heading)).toBeCloseTo((post.x - boutStart.x) / 1.6, 9);
  expect(Math.cos(boutStart.heading)).toBeCloseTo((post.z - boutStart.z) / 1.6, 9);
  expect(Math.hypot(boutStart.x - post.x, boutStart.z - (post.z + 0.8))).toBeLessThan(2.05); // on the worn-earth disc
  for (const piece of BENCH_FOLIAGE.filter((f) => f.kind.startsWith("bush"))) {
    expect(Math.hypot(boutStart.x - piece.x, boutStart.z - piece.z)).toBeGreaterThan(piece.value / 2 + 0.6); // not in a bush
  }
  const owner = { visible: true };
  const [archer] = sparringFootprints(owner, owner) as [any];
  const machine = incendiaryFootprints()[0] as any;
  expect(Math.abs(boutStart.x - machine.x)).toBeGreaterThan(machine.halfW + 0.5); // nor in the ballista
  expect(Math.hypot(boutStart.x - archer.x, boutStart.z - archer.z)).toBeGreaterThan(archer.r + 0.5);
});
