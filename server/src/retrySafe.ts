import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { canonicalJson } from "../../shared/retryActions";
import * as schema from "./schema";

/** Free, daily-capped affection ticks are the one receipt that piles up, and
 * replaying a forgotten one costs nothing, so only those are ever pruned.
 * Anything that spends money stays durable forever. */
const PRUNED_ACTION = "earnAffection";
export const PRUNED_RECEIPTS_KEPT = 500;

export interface RequestIdentity { requestId?: string; action: string; payload: Record<string, unknown> }
type Transaction = Parameters<Parameters<BunSQLiteDatabase<typeof schema>["transaction"]>[0]>[0];

/** A failed transaction leaves no receipt. Replaying a committed ID reads
 * current state without repeating its side effects, even after a server restart. */
export function runRetrySafe(db: BunSQLiteDatabase<typeof schema>, identity: RequestIdentity | undefined, work: (tx: Transaction) => undefined): boolean {
  return db.transaction((tx) => {
    const requestId = identity?.requestId;
    const { request_id: _ignored, ...payload } = identity?.payload ?? {};
    const hash = identity ? createHash("sha256").update(canonicalJson(payload)).digest("hex") : "";
    if (requestId && identity) {
      const previous = tx.select().from(schema.requestReceipts).where(eq(schema.requestReceipts.requestId, requestId)).get();
      if (previous) {
        if (previous.action !== identity.action || previous.payloadHash !== hash) throw new Error("This request ID was already used for a different action.");
        return false;
      }
    }
    work(tx);
    if (requestId && identity) {
      tx.insert(schema.requestReceipts).values({ requestId, action: identity.action, payloadHash: hash }).run();
      // A scan, so run it on about one tick in 256: UUIDs make that stateless.
      if (identity.action === PRUNED_ACTION && requestId.startsWith("00")) {
        tx.run(sql`DELETE FROM request_receipts WHERE action = ${PRUNED_ACTION} AND rowid < (
          SELECT rowid FROM request_receipts WHERE action = ${PRUNED_ACTION} ORDER BY rowid DESC LIMIT 1 OFFSET ${PRUNED_RECEIPTS_KEPT}
        )`);
      }
    }
    return true;
  }, { behavior: "immediate" });
}
