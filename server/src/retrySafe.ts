import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { canonicalJson } from "../../shared/retryActions";
import * as schema from "./schema";

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
    if (requestId && identity) tx.insert(schema.requestReceipts).values({ requestId, action: identity.action, payloadHash: hash }).run();
    return true;
  }, { behavior: "immediate" });
}
