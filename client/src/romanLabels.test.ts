import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLACES } from "./town";

// Task 44: no "Main Chat" or "Side Chat" anywhere in the town's text.
describe("Task 44: Roman names only", () => {
  const files = [
    ...readdirSync(import.meta.dir)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test."))
      .map((f) => join(import.meta.dir, f)),
    join(import.meta.dir, "..", "..", "server", "src", "actions.ts"),
  ];

  test("no source file the town speaks from names a chat", () => {
    const hits = files.filter((f) => /main chat|side chat/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  test("the two buildings keep their places under Roman names", () => {
    const basilica = PLACES.find((p) => p.id === "mainchat")!;
    const domus = PLACES.find((p) => p.id === "sidechat")!;
    expect(basilica.name).toBe("The Basilica");
    expect(basilica.position).toEqual([0, -35.7]);
    expect(domus.name).toBe("Domus Architecti, the Builder's House");
    expect(domus.chipLabel).toBe("Domus");
    expect(domus.position).toEqual([19, 15.5]);
    for (const p of [basilica, domus]) {
      expect(`${p.name} ${p.chipLabel} ${p.greeting} ${p.body} ${p.tip} ${p.resident}`).not.toMatch(/\bchat\b/i);
    }
  });
});
