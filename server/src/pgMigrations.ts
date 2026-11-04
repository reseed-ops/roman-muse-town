// The Postgres migrations, in order, bundled as text so the web server
// needs no files beside it at runtime. One town (one schema) records
// what it has run in its own town_migrations table (storage.pg.ts).
//
// Adding one: write drizzle-pg/NNNN_name.sql (statements separated by
// `--> statement-breakpoint`, like drizzle/), import it here, append it.
// Never edit a migration that has shipped: every existing town has run it.

import town0001 from "../../drizzle-pg/0001_town.sql" with { type: "text" };
import blobs0002 from "../../drizzle-pg/0002_blobs.sql" with { type: "text" };

export interface PgMigration { name: string; sql: string }

export const PG_MIGRATIONS: readonly PgMigration[] = [
  { name: "0001_town", sql: town0001 },
  { name: "0002_blobs", sql: blobs0002 },
];
