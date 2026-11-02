import { expect, test } from "bun:test";
import { AchievementGate } from "./achievementGate";

test("a badge earned on an earlier visit is not announced again", () => {
  const gate = new AchievementGate();
  expect(gate.claim("first-steps")).toBe(false);
  expect(gate.load(["first-steps"]).filter((id) => gate.claim(id))).toEqual([]);
});

test("a new badge claimed before the save arrives is announced once it does", () => {
  const gate = new AchievementGate();
  gate.claim("night-owl");
  gate.claim("night-owl");
  expect(gate.load(["first-steps"]).filter((id) => gate.claim(id))).toEqual(["night-owl"]);
});

test("after loading, a badge announces once", () => {
  const gate = new AchievementGate();
  gate.load([]);
  expect(gate.claim("town-crier")).toBe(true);
  expect(gate.claim("town-crier")).toBe(false);
});

test("a later save update keeps out what it lists", () => {
  const gate = new AchievementGate();
  gate.load([]);
  gate.load(["town-crier"]);
  expect(gate.claim("town-crier")).toBe(false);
});
