// The storage layer: where the town's database dialect lives.
//
// The action layer (actions.ts, saveService.ts, retrySafe.ts) is written
// once against TownDb and runs on two engines:
//
//   - bun:sqlite, the artifact runtime's own database and the standalone
//     Android build's. One process, one connection, one town.
//   - PostgreSQL, the web deployment (web/ and storage.pg.ts): one
//     database, one schema per visitor, many towns at once.
//
// Drizzle's query builder is the same on both for everything the actions
// do (select, insert, update, delete, onConflict, orderBy, limit,
// returning), as long as every query is awaited and no synchronous
// driver call (.all(), .get(), .run()) remains; storage.test.ts pins that.
// What differs is below: how a write transaction opens, how work is kept
// one-at-a-time per town, and the two statements with dialect-specific
// SQL.
//
// One rule makes the awaits safe on SQLite: a town runs one action at a
// time. A handler may await (SQLite work resolves in microtasks, so this
// costs nothing), and because no other handler runs on the same
// connection until it finishes, a transaction holds exactly its own
// writes. On Postgres each request already runs inside its own
// transaction holding that visitor's advisory lock (storage.pg.ts), so
// serialize() there is a pass-through.

import { sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "./schema";

/** The database the action layer is written against. On the web line a
 *  Postgres database is handed over under this same type (storage.pg.ts),
 *  which is honest only while the actions use the dialect-neutral surface
 *  described above. */
export type TownDb = BunSQLiteDatabase<typeof schema>;

export type TownDialect = "sqlite" | "postgres";

/** Set once per process. The artifact runtime and the Android build never
 *  set it and get SQLite; the web server sets TOWN_DIALECT=postgres (web/
 *  refuses to start without it). schema.ts reads the same answer, so the
 *  tables and the storage always agree. */
export function townDialect(): TownDialect {
  return process.env.TOWN_DIALECT === "postgres" ? "postgres" : "sqlite";
}

export interface TownStorage {
  readonly dialect: TownDialect;
  /** Runs one unit of town work with no other unit of the same town
   *  interleaving. Every action handler is wrapped in this. */
  serialize<T>(work: () => Promise<T>): Promise<T>;
  /** A write transaction: commits when work resolves, rolls back when it
   *  throws. Joining an open transaction on the same database is allowed
   *  and commits with it. */
  transaction<T>(db: TownDb, work: (tx: TownDb) => Promise<T>): Promise<T>;
  /** Keep the newest `keep` receipts of one action, drop the rest. */
  pruneReceipts(tx: TownDb, action: string, keep: number): Promise<void>;
  /** Runs inside the restore transaction after every table is refilled. */
  afterRestore(tx: TownDb): Promise<void>;
}

/** The context an action handler receives. The artifact runtime's Ctx
 *  carries db, blobs and invalidateQueries; the web server adds storage.
 *  Anything without a storage is the SQLite line. */
export interface StorageCtx {
  storage?: TownStorage;
}

export function storageOf(ctx: object): TownStorage {
  return (ctx as StorageCtx).storage ?? sqliteStorage;
}

/** One queue per process: the SQLite line has one town per process. */
function createMutex() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const run = tail.then(work, work);
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

const open = new WeakSet<object>();

export const sqliteStorage: TownStorage = {
  dialect: "sqlite",
  serialize: createMutex(),
  async transaction(db, work) {
    if (open.has(db)) return work(db);
    db.run(sql`BEGIN IMMEDIATE`);
    open.add(db);
    try {
      const result = await work(db);
      db.run(sql`COMMIT`);
      return result;
    } catch (error) {
      db.run(sql`ROLLBACK`);
      throw error;
    } finally {
      open.delete(db);
    }
  },
  async pruneReceipts(tx, action, keep) {
    // rowid is insertion order, which is what "newest" means here.
    tx.run(sql`DELETE FROM request_receipts WHERE action = ${action} AND rowid < (
      SELECT rowid FROM request_receipts WHERE action = ${action} ORDER BY rowid DESC LIMIT 1 OFFSET ${keep}
    )`);
  },
  async afterRestore() {
    // AUTOINCREMENT reads sqlite_sequence, which a delete-and-insert restore
    // leaves ahead of every restored id. Nothing to do.
  },
};

/** Every town action runs one at a time per town. Wraps a definition's
 *  handler; actions.ts and saveActions.ts route defineAction through it. */
export function oneTownAtATime<D extends { handler: (ctx: never, args: never) => unknown }>(definition: D): D {
  const handler = definition.handler as (ctx: StorageCtx, args: unknown) => Promise<unknown>;
  return {
    ...definition,
    handler: (ctx: StorageCtx, args: unknown) => storageOf(ctx).serialize(() => handler(ctx, args)),
  } as D;
}
