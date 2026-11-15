// Task 95: the asset inventory is complete and the search finds things. Reads the committed INVENTORY.json, so it
// runs on a clone without the licensed files; where they are present, it also holds the file current.
import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { search } from "./search";

const inv = JSON.parse(readFileSync(join(import.meta.dir, "INVENTORY.json"), "utf8"));
const names: string[] = inv.assets.map((a: { file: string }) => a.file);

test("the inventory lists the 157 asset files, the ships, the wedding pack and the six loom textures", () => {
  expect(inv.summary.assetsFolder).toBe(157);
  expect(inv.summary.totalFiles).toBe(163);
  expect(names.filter((n) => n.startsWith("ships/")).length).toBe(4);
  expect(names.filter((n) => n.startsWith("wedding/")).length).toBe(6);
  expect(names.filter((n) => n.startsWith("textures/")).length).toBe(6);
  expect(new Set(names).size).toBe(names.length);
});

test("every file names a pack, a size, and (when unused) says so", () => {
  for (const a of inv.assets) {
    expect(a.pack).not.toBe("unknown");
    expect(a.bytes).toBeGreaterThan(0);
    if (a.status === "used") expect(a.uses.length).toBeGreaterThan(0);
  }
  expect(inv.summary.unusedInFolder.length + inv.summary.used).toBe(163);
});

test("search finds by name, kind and place, and --used/--unused split", () => {
  expect(search(inv, ["athena"]).map((a) => a.file)).toContain("statuary/athena.glb");
  expect(search(inv, ["--kind", "ship"]).length).toBe(2);
  expect(search(inv, ["forum", "augustus"]).length).toBeGreaterThan(0);
  expect(search(inv, ["--unused"]).map((a) => a.file)).toContain("roman/apple.glb");
  expect(search(inv, ["--used", "apple"]).length).toBe(0);
});

test("with the licensed files present, INVENTORY is current", () => {
  if (!existsSync(join(import.meta.dir, "../../client/src/assets/centurion.vrm"))) return; // CI: no licensed assets
  const r = Bun.spawnSync(["bun", join(import.meta.dir, "build.ts"), "--check"]);
  expect(new TextDecoder().decode(r.stdout)).toContain("current");
});
