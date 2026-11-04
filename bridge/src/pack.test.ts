import { expect, test } from "bun:test";
import { createPackLoader, parsePack } from "./pack.js";

// The context pack: parsed by section, the rank read, re-read on change.

const PACK = `# Aelia, for the Live Bridge
rank: 6

## Identity
She is the hostess.

## Voice
Warm, lively.

## Constitution
Direction moves her body.

## Life digest
Today it rained.

## Rendezvous log
The cove has a shrine.
`;

test("the pack parses by heading, forgiving of case and extra sections, and reads the rank", () => {
  const p = parsePack(PACK);
  expect(p.identity).toBe("She is the hostest.".replace("hostest", "hostess"));
  expect(p.voice).toBe("Warm, lively.");
  expect(p.constitution).toBe("Direction moves her body.");
  expect(p.digest).toBe("Today it rained.");
  expect(p.extra).toEqual({ "Rendezvous log": "The cove has a shrine." });
  expect(p.rank).toBe(6);
  expect(parsePack("## IDENTITY\nx\n## digest\ny").digest).toBe("y");
  expect(parsePack("rank: 99\n## Voice\nv").rank).toBeNull();
  expect(parsePack("").rank).toBeNull();
  expect(parsePack("").identity).toBe("");
});

test("the loader re-reads when the file's mtime changes and survives the file going missing", async () => {
  let file: { text: string; mtimeMs: number } | null = { text: PACK, mtimeMs: 1 };
  let reads = 0;
  const log: string[] = [];
  const loader = createPackLoader({ read: async () => { reads += 1; return file; } }, { log: (l) => log.push(l) });
  expect(loader.current().rank).toBeNull();
  expect(await loader.check()).toBe(true);
  expect(loader.current().rank).toBe(6);
  expect(await loader.check()).toBe(false); // same mtime, nothing re-parsed
  file = { text: PACK.replace("rank: 6", "rank: 8").replace("Today it rained.", "Sunny."), mtimeMs: 2 };
  expect(await loader.check()).toBe(true);
  expect(loader.current().rank).toBe(8);
  expect(loader.current().digest).toBe("Sunny.");
  expect(loader.updatedAt()).toBe(2);
  file = null;
  expect(await loader.check()).toBe(true);
  expect(loader.current().rank).toBeNull();
  expect(await loader.check()).toBe(false);
  expect(reads).toBe(5);
  expect(log.some((l) => l.includes("rank 8"))).toBe(true);
  // A read error is logged, not thrown.
  const broken = createPackLoader({ read: async () => { throw new Error("disk"); } }, { log: (l) => log.push(l) });
  expect(await broken.check()).toBe(false);
  expect(log[log.length - 1]).toContain("unreadable");
});
