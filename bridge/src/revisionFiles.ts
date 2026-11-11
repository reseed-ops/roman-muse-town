// Revision high-water marks on disk (Task 70): one small JSON file per desk, written whole
// to a temporary name and renamed, so a crash leaves the old file or the new one, not half.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type RevisionStore = { load(): number; save(high: number): void };

/** The two filesystem calls a save makes; injectable so a test can fail one. */
export type RevisionFs = { writeFileSync: typeof writeFileSync; renameSync: typeof renameSync };

export function fileRevisionStore(path: string, fs: RevisionFs = { writeFileSync, renameSync }): RevisionStore {
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
      try {
        fs.writeFileSync(tmp, JSON.stringify({ high }));
        fs.renameSync(tmp, path);
      } catch (e) {
        try {
          rmSync(tmp, { force: true }); // the previous file at `path` is untouched either way
        } catch {
          /* best effort */
        }
        throw e;
      }
    },
  };
}

/** Where a paired town's mark lives: beside the owner's file, named by the town's key digest (hex), never the key. */
export const tenantRevisionPath = (ownerPath: string, id: string): string => join(`${ownerPath}.towns`, `${id}.json`);
