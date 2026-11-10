// The per-town pairing generation (Task 63). A principal token (bridge/src/
// tenants.ts) is sealed with the generation current when it was made, and
// the bridge refuses it once the town's generation has moved on. The
// generation moves when:
//   - a code is redeemed (pairing again retires every earlier token, so
//     "rotate" is simply pairing again);
//   - the visitor disconnects from their own, authenticated town
//     (POST /bridge/disconnect).
// It lives in public.town_pairing, beside the town's own schema and not in
// it: a save restore, an export or a migration never touches it, and a
// disconnect cannot be undone by restoring an older save. Counts only; no
// key, no token.

import { sql } from "drizzle-orm";
import type { PgTownDb } from "../../server/src/storage.pg";

const rowsOf = (result: unknown): Record<string, unknown>[] => {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
};

export interface PairingState {
  /** The town's current generation (0 before any pairing). */
  generation(schemaName: string): Promise<number>;
  /** Move the generation on, retiring every token sealed before; returns the new one. */
  bump(schemaName: string): Promise<number>;
}

export function createPairingState(db: PgTownDb): PairingState {
  let ready: Promise<void> | null = null;
  const ensure = () =>
    (ready ??= db
      .execute(sql`CREATE TABLE IF NOT EXISTS public.town_pairing (schema_name text PRIMARY KEY, generation integer NOT NULL DEFAULT 0, changed_at timestamp with time zone NOT NULL DEFAULT now())`)
      .then(() => undefined)
      .catch((error: unknown) => {
        ready = null;
        throw error;
      }));
  return {
    async generation(schemaName) {
      await ensure();
      const rows = rowsOf(await db.execute(sql`SELECT generation FROM public.town_pairing WHERE schema_name = ${schemaName}`));
      return Number(rows[0]?.generation) || 0;
    },
    async bump(schemaName) {
      await ensure();
      const rows = rowsOf(
        await db.execute(
          sql`INSERT INTO public.town_pairing (schema_name, generation) VALUES (${schemaName}, 1)
              ON CONFLICT (schema_name) DO UPDATE SET generation = public.town_pairing.generation + 1, changed_at = now()
              RETURNING generation`,
        ),
      );
      return Number(rows[0]?.generation) || 1;
    },
  };
}
