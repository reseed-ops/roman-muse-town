import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COLOSSEUM, terrainHeight } from "./town";

// The town is not a reconstruction, and the wolf and the phoenix stay.
// This only holds the line on things that plainly could not be there:
// New World crops, the telescope (1608), and the morning coffee.
const ABSENT = /tomato|sunflower|telescope|coffee|maize|potato/i;

test("no plain anachronisms in the town's writing or its scene", () => {
  for (const file of ["town.ts", "townScene.ts", "romanDay.ts"]) {
    const text = readFileSync(join(import.meta.dir, file), "utf8")
      .split(/\r?\n/)
      // Saved games know the soup by this id, so it stays.
      .map((line) => line.replaceAll("tomato-soup", ""));
    expect(text.filter((line) => ABSENT.test(line))).toEqual([]);
  }
});

const [cx, cz] = COLOSSEUM.position;
const around = (r: number, i: number): [number, number] => [cx + Math.cos(i * 0.5) * r, cz + Math.sin(i * 0.5) * r];

test("the Colosseum sits in a basin: every approach descends", () => {
  const floor = terrainHeight(cx, cz);
  for (let i = 0; i < 12; i++) expect(terrainHeight(...around(16, i))).toBeGreaterThan(floor + 0.3);
});

test("the Colosseum stands level: no part of its base is buried", () => {
  const floor = terrainHeight(cx, cz);
  for (let i = 0; i < 12; i++) expect(terrainHeight(...around(8, i))).toBeCloseTo(floor);
});
