// Revision high-water marks on disk (Task 70): one small JSON file per desk, written whole
// to a temporary name and renamed, so a crash leaves the old file or the new one, not half.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type RevisionStore = { load(): number; save(high: number): void };

export function fileRevisionStore(path: string): RevisionStore {
  return {
    load: () => {
      try {
        const n = Number((JSON.parse(readFileSync(path, "utf8")) as { high?: unknown }).high);
        return Number.isFinite(n) && n > 0 ? n : 0;
      } catch {
        return 0;
      }
    },
    save: (high) => {
      mkdirSync(dirname(path), { recursive: true });
      const tmp = `${path}.tmp`;
      writeFileSync(tmp, JSON.stringify({ high }));
      renameSync(tmp, path);
    },
  };
}

/** Where a paired town's mark lives: beside the owner's file, named by the town's key digest (hex), never the key. */
export const tenantRevisionPath = (ownerPath: string, id: string): string => join(`${ownerPath}.towns`, `${id}.json`);
