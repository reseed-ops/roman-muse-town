// The Postgres storage (Task 8, the web deployment).
//
// One database, one schema per visitor. A visitor's token never reaches
// the database as a name: the schema is named by a hash of it. Every
// request runs inside one transaction that (1) sets search_path to the
// visitor's schema, so the unqualified table names the action layer uses
// resolve there and nowhere else, and (2) takes a transaction-scoped
// advisory lock on that schema, so one visitor's actions run one at a
// time, the rule the action layer relies on (storage.ts). Isolation is
// therefore enforced by the database on every query: nothing a client
// sends can name another visitor's schema.

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { customType, pgTable, text, timestamp, type PgDatabase, type PgQueryResultHKT } from "drizzle-orm/pg-core";
import { PG_MIGRATIONS } from "./pgMigrations";
import * as schema from "./schema.pg";
import type { TownDb, TownStorage } from "./storage";

/** Any drizzle Postgres database: pglite in the tests, Bun's SQL client in
 *  production. The driver's query-result type does not matter here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PgTownDb = PgDatabase<PgQueryResultHKT, any, any>;

/** The web server's blob store runs on the request's transaction, which
 *  it receives under the action layer's type. */
export const asPg = (db: TownDb): PgTownDb => db as unknown as PgTownDb;
const asTown = (db: PgTownDb): TownDb => db as unknown as TownDb;

/** Per-town migration journal; lives inside each town's schema. */
export const townMigrations = pgTable("town_migrations", {
  name: text("name").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date()),
});

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
  toDriver: (value) => value,
  fromDriver: (value) => (value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBufferLike)),
});

/** The postcard images, inside each town's schema (migration 0002): the
 *  web deployment's blob store (web/src/blobStore.ts). Not a town table:
 *  saves carry the images as attachments, never this table. */
export const townBlobs = pgTable("town_blobs", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  bytes: bytea("bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().$defaultFn(() => new Date()),
});

/** Tables whose id is a sequence: a restore inserts explicit ids, and the
 *  sequence must be moved past them or the next insert collides. */
const SERIAL_TABLES = ["journal", "board_entries", "letters", "postcards", "festivals", "goals_entries", "muse_notes", "catches", "aelia_facts", "life_digest", "bottles", "bouquets", "seed_ledger"];

export const postgresStorage: TownStorage = {
  dialect: "postgres",
  // The request's transaction already holds the town's advisory lock.
  serialize: (work) => work(),
  // Inside the request transaction this is a savepoint: the economy
  // transaction rolls back alone, the request goes on.
  transaction: (db, work) => asPg(db).transaction((tx) => work(asTown(tx))),
  async pruneReceipts(tx, action, keep) {
    // Newest by completion time; the id breaks the (millisecond) ties.
    await asPg(tx).execute(sql`DELETE FROM request_receipts WHERE action = ${action} AND (completed_at, request_id) < (
      SELECT completed_at, request_id FROM request_receipts WHERE action = ${action} ORDER BY completed_at DESC, request_id DESC LIMIT 1 OFFSET ${keep}
    )`);
  },
  async afterRestore(tx) {
    for (const table of SERIAL_TABLES) {
      await asPg(tx).execute(sql`SELECT setval(pg_get_serial_sequence(${table}, 'id'), COALESCE((SELECT MAX(id) FROM ${sql.identifier(table)}), 0) + 1, false)`);
    }
  },
};

/** The schema that holds one visitor's town. The token itself is a
 *  secret; its hash is what the catalog and the logs see. */
export function townSchemaName(visitorToken: string): string {
  return `town_${createHash("sha256").update(visitorToken).digest("hex").slice(0, 24)}`;
}

/** Runs work inside one transaction scoped to the town: its search_path,
 *  its advisory lock. This is the only way the web server touches a town. */
export async function withTown<T>(db: PgTownDb, schemaName: string, work: (tx: TownDb) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await enterTown(tx, schemaName);
    return work(asTown(tx));
  });
}

async function enterTown(tx: PgTownDb, schemaName: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${schemaName}))`);
  await tx.execute(sql`SET LOCAL search_path TO ${sql.identifier(schemaName)}`);
}

const readyTowns = new Set<string>();

/** Creates the town's schema on its first call and brings it up to date
 *  with the migrations; the action layer's own first-run seeds do the
 *  rest on the first getState. Returns how many migrations ran. */
export async function ensureTown(db: PgTownDb, schemaName: string): Promise<number> {
  if (readyTowns.has(schemaName)) return 0;
  const ran = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${schemaName}))`);
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)}`);
    await tx.execute(sql`SET LOCAL search_path TO ${sql.identifier(schemaName)}`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS town_migrations (name text PRIMARY KEY, applied_at timestamp with time zone NOT NULL DEFAULT now())`);
    const applied = new Set((await tx.select({ name: townMigrations.name }).from(townMigrations)).map((row) => row.name));
    let count = 0;
    for (const migration of PG_MIGRATIONS) {
      if (applied.has(migration.name)) continue;
      for (const statement of migration.sql.split("--> statement-breakpoint")) {
        if (statement.trim()) await tx.execute(sql.raw(statement));
      }
      await tx.insert(townMigrations).values({ name: migration.name });
      count++;
    }
    return count;
  });
  readyTowns.add(schemaName);
  return ran;
}

/** Test seam: forget which towns this process has seen. */
export function forgetReadyTowns(): void {
  readyTowns.clear();
}

/** The schema's tables, for reflection (the isolation test dumps them). */
export const pgTables = schema;
