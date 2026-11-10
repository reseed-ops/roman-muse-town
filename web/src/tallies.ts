// A simple anonymous count (Task 52): how many towns exist, how many
// were created since counting began, and how many pairing codes were
// minted and redeemed. Counts only. Nothing here holds a name, a
// visitor key, a schema name, an address or anything else that could
// tell one person or one town from another: a tally is a kind, a day
// and a number. No cookies, no scripts, no third party.
//
// The owner's own towns are included (every browser he opened the town
// in is a town), and the page says so.

import { sql } from "drizzle-orm";
import type { PgTownDb } from "../../server/src/storage.pg";

export type TallyKind = "town-created" | "pair-minted" | "pair-redeemed";
export const TALLY_KINDS: readonly TallyKind[] = ["town-created", "pair-minted", "pair-redeemed"];

export interface TallyCounts {
  total: number;
  lastDay: number;
  lastWeek: number;
}

export interface TallyReport {
  /** Every town in the database, counted by its schema, since the town went up. */
  townsInAll: number;
  /** The first day anything was counted (YYYY-MM-DD, UTC), or null before the first count. */
  countingSince: string | null;
  kinds: Record<TallyKind, TallyCounts>;
}

/** Town schemas are `town_` plus 24 hex characters (storage.pg.ts townSchemaName). */
const TOWN_SCHEMA_PATTERN = "^town_[0-9a-f]{24}$";

const rowsOf = (result: unknown): Record<string, unknown>[] => {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
};

export interface Tallies {
  bump(kind: TallyKind): Promise<void>;
  report(): Promise<TallyReport>;
}

export function createTallies(db: PgTownDb, log: (line: string) => void = () => {}): Tallies {
  let ready: Promise<void> | null = null;
  const ensure = () =>
    (ready ??= db
      .execute(sql`CREATE TABLE IF NOT EXISTS public.town_tallies (kind text NOT NULL, day date NOT NULL, n integer NOT NULL DEFAULT 0, PRIMARY KEY (kind, day))`)
      .then(() => undefined)
      .catch((error: unknown) => {
        ready = null;
        throw error;
      }));

  return {
    async bump(kind) {
      try {
        await ensure();
        await db.execute(
          sql`INSERT INTO public.town_tallies (kind, day, n) VALUES (${kind}, (now() AT TIME ZONE 'UTC')::date, 1)
              ON CONFLICT (kind, day) DO UPDATE SET n = public.town_tallies.n + 1`,
        );
      } catch (error) {
        // A count must never cost a visitor anything: log it and go on.
        log(`tally ${kind} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    async report() {
      await ensure();
      const towns = rowsOf(
        await db.execute(sql`SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name ~ ${TOWN_SCHEMA_PATTERN}`),
      );
      const rows = rowsOf(
        await db.execute(sql`SELECT kind,
            sum(n)::int AS total,
            coalesce(sum(n) FILTER (WHERE day >= (now() AT TIME ZONE 'UTC')::date - 1), 0)::int AS last_day,
            coalesce(sum(n) FILTER (WHERE day >= (now() AT TIME ZONE 'UTC')::date - 7), 0)::int AS last_week,
            to_char(min(day), 'YYYY-MM-DD') AS since
          FROM public.town_tallies GROUP BY kind`),
      );
      const kinds = Object.fromEntries(TALLY_KINDS.map((k) => [k, { total: 0, lastDay: 0, lastWeek: 0 }])) as Record<TallyKind, TallyCounts>;
      let since: string | null = null;
      for (const row of rows) {
        const kind = row.kind as TallyKind;
        if (!TALLY_KINDS.includes(kind)) continue;
        kinds[kind] = { total: Number(row.total) || 0, lastDay: Number(row.last_day) || 0, lastWeek: Number(row.last_week) || 0 };
        const s = typeof row.since === "string" ? row.since : null;
        if (s && (!since || s < since)) since = s;
      }
      return { townsInAll: Number(towns[0]?.n) || 0, countingSince: since, kinds };
    },
  };
}

/** The page the owner opens: plain text, a few lines, nothing about anyone. */
export function formatTallies(r: TallyReport): string {
  const line = (label: string, c: TallyCounts) => `${label}: ${c.total} (last day ${c.lastDay}, last 7 days ${c.lastWeek})`;
  return [
    "Muse Town, anonymous counts",
    "",
    `Towns in all: ${r.townsInAll}`,
    line("Towns created", r.kinds["town-created"]),
    line("Pairing codes minted", r.kinds["pair-minted"]),
    line("Pairings redeemed", r.kinds["pair-redeemed"]),
    "",
    `Counting since: ${r.countingSince ?? "the first count (none yet)"} (UTC days). "Towns in all" also holds the towns from before counting began.`,
    "Your own towns are included: every browser you opened the town in is one.",
    "Counts only: no names, no keys, no addresses, no cookies.",
    "",
  ].join("\n");
}
