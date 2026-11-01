import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FESTIVALS_SEED } from "./festivals";

const migration = readFileSync(join(import.meta.dir, "../../drizzle/0026_roman_festivals.sql"), "utf8");
const added = FESTIVALS_SEED.slice(3);

function town(rows: [string, string][]) {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE festivals (id integer PRIMARY KEY AUTOINCREMENT, sort integer DEFAULT 0 NOT NULL, month_day text NOT NULL, name text NOT NULL, dressing text NOT NULL, colors text NOT NULL)");
  for (const [day, name] of rows) db.run("INSERT INTO festivals (month_day, name, dressing, colors) VALUES (?, ?, 'd', 'c')", [day, name]);
  for (const part of migration.split("--> statement-breakpoint")) db.exec(part);
  return db.query("SELECT month_day, name FROM festivals").all() as { month_day: string; name: string }[];
}

describe("the festival seed", () => {
  test("dates are real and never repeat", () => {
    const days = FESTIVALS_SEED.map((f) => f.month_day);
    expect(new Set(days).size).toBe(days.length);
    for (const day of days) expect(Number.isNaN(Date.parse(`2024-${day}T00:00:00Z`))).toBe(false);
  });

  test("every entry fits what updateFestivals accepts, three colours each", () => {
    expect(FESTIVALS_SEED.length).toBeLessThanOrEqual(40);
    for (const f of FESTIVALS_SEED) {
      expect(f.name.length).toBeLessThanOrEqual(120);
      expect(f.dressing.length).toBeLessThanOrEqual(200);
      expect(f.colors.length).toBeLessThanOrEqual(120);
      expect(f.colors).toMatch(/^#[0-9a-f]{6},#[0-9a-f]{6},#[0-9a-f]{6}$/);
    }
  });
});

describe("migration 0026", () => {
  test("an existing town gains the Roman year", () => {
    const rows = town([["10-31", "Halloween"]]);
    expect(rows.length).toBe(added.length + 1);
  });

  test("it agrees with the seed, name for name", () => {
    const rows = town([["10-31", "Halloween"]]);
    for (const f of added) expect(rows.find((r) => r.month_day === f.month_day)?.name).toBe(f.name);
  });

  test("a date the town already keeps is left alone", () => {
    const rows = town([["04-21", "Our anniversary"]]);
    expect(rows.filter((r) => r.month_day === "04-21")).toEqual([{ month_day: "04-21", name: "Our anniversary" }]);
  });

  test("a brand-new town stays empty, for the seed to fill", () => {
    expect(town([])).toEqual([]);
  });
});
