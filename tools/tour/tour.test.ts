// Task 90: the tour's harness proves itself without a browser: it visits every place on the list, names every shot in the log, and flags what fails.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { buildTourPlaces, TOUR_REQUIRED } from "../../client/src/tourPlaces";

test("the tour harness self-test passes (every place, every shot, flags raised)", () => {
  const r = spawnSync("python3", ["-I", new URL("./tour.py", import.meta.url).pathname, "--self-test"], { encoding: "utf8" });
  expect(r.stdout + r.stderr).toContain("tour self-test ok");
  expect(r.status).toBe(0);
});

test("the list handed to the tour has the places the brief names", () => {
  const ids = buildTourPlaces({ seats: [{ id: "bench-athena", x: 0, z: 0, rotY: 0 }, { id: "bench-cliff", x: 0, z: 0, rotY: 0 }], anchors: { forum: [0, 15], market: [6, 35], boat: [-9, -31], bath: [24, 26], gate: [0, 41] } }).map((p) => p.id);
  for (const id of TOUR_REQUIRED) expect(ids).toContain(id);
});
