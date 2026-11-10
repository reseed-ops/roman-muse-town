// The town retention policy (Task 61). A town is a Postgres schema made on
// a visitor's first call. A schema nobody has touched for RETENTION_DAYS
// is dropped, whole: its letters, memories and postcard images with it.
// That is the policy, stated here and in web/README.md:
//
//   - every town is stamped "last seen" (public.town_seen) when it is
//     called, at most once an hour per town per process;
//   - a town with no stamp (made before this policy) is stamped when the
//     reaper first sees it, so nothing is dropped for a full retention
//     period after the policy first runs;
//   - the reaper runs at start and then daily, dropping at most
//     REAP_BATCH towns per pass;
//   - TOWN_RETENTION_DAYS sets the period (default 365); 0 turns the
//     reaper off. A visitor who wants a copy exports a save (the menu).

import { sql } from "drizzle-orm";
import { dropTown, type PgTownDb } from "../../server/src/storage.pg";

export const DEFAULT_RETENTION_DAYS = 365;
export const REAP_BATCH = 200;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
const TOWN_SCHEMA_PATTERN = "^town_[0-9a-f]{24}$";

const rowsOf = (result: unknown): Record<string, unknown>[] => {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
};

export interface TownKeeper {
  /** Note that a town was just used (throttled; never throws). */
  touch(schemaName: string): Promise<void>;
  /** Drop the towns unseen past the retention period; returns how many. */
  reap(): Promise<number>;
  /** How many towns exist (cached for a minute), for the admission cap. */
  townCount(): Promise<number>;
}

export function createTownKeeper(db: PgTownDb, opts: { retentionDays?: number; now?: () => number; log?: (line: string) => void } = {}): TownKeeper {
  const now = opts.now ?? (() => Date.now());
  const log = opts.log ?? (() => {});
  const retentionDays = opts.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const touched = new Map<string, number>();
  let ready: Promise<void> | null = null;
  let count: { at: number; n: number } | null = null;
  const ensure = () =>
    (ready ??= db
      .execute(sql`CREATE TABLE IF NOT EXISTS public.town_seen (schema_name text PRIMARY KEY, seen_at timestamp with time zone NOT NULL DEFAULT now())`)
      .then(() => undefined)
      .catch((error: unknown) => {
        ready = null;
        throw error;
      }));
  return {
    async touch(schemaName) {
      const t = now();
      const last = touched.get(schemaName);
      if (last !== undefined && t - last < TOUCH_EVERY_MS) return;
      if (touched.size > 50_000) touched.clear();
      touched.set(schemaName, t);
      try {
        await ensure();
        await db.execute(
          sql`INSERT INTO public.town_seen (schema_name, seen_at) VALUES (${schemaName}, now())
              ON CONFLICT (schema_name) DO UPDATE SET seen_at = now()`,
        );
      } catch (error) {
        touched.delete(schemaName);
        log(`town touch failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    async reap() {
      if (retentionDays <= 0) return 0;
      await ensure();
      // Stamp every schema that has no stamp yet, so the clock starts now for old towns.
      await db.execute(
        sql`INSERT INTO public.town_seen (schema_name) SELECT schema_name FROM information_schema.schemata WHERE schema_name ~ ${TOWN_SCHEMA_PATTERN} ON CONFLICT DO NOTHING`,
      );
      const stale = rowsOf(
        await db.execute(
          sql`SELECT schema_name FROM public.town_seen WHERE seen_at < now() - (${retentionDays} * interval '1 day') AND schema_name ~ ${TOWN_SCHEMA_PATTERN} ORDER BY seen_at LIMIT ${REAP_BATCH}`,
        ),
      );
      let gone = 0;
      for (const row of stale) {
        const name = String(row.schema_name);
        try {
          await dropTown(db, name);
          await db.execute(sql`DELETE FROM public.town_seen WHERE schema_name = ${name}`);
          touched.delete(name);
          gone++;
        } catch (error) {
          log(`reap of one town failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      // Stamps whose schema is gone (a restore of the database, a manual drop).
      await db.execute(sql`DELETE FROM public.town_seen WHERE schema_name NOT IN (SELECT schema_name FROM information_schema.schemata)`);
      // A dropped town's pairing record goes with it (the table exists once any pairing happened).
      await db.execute(sql`DO $$ BEGIN IF to_regclass('public.town_pairing') IS NOT NULL THEN DELETE FROM public.town_pairing WHERE schema_name NOT IN (SELECT schema_name FROM information_schema.schemata); END IF; END $$`);
      if (gone) log(`reaped ${gone} town(s) unseen for ${retentionDays} days`);
      count = null;
      return gone;
    },
    async townCount() {
      const t = now();
      if (count && t - count.at < 60_000) return count.n;
      const rows = rowsOf(await db.execute(sql`SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name ~ ${TOWN_SCHEMA_PATTERN}`));
      count = { at: t, n: Number(rows[0]?.n) || 0 };
      return count.n;
    },
  };
}
