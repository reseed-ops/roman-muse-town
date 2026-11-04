import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { canonicalJson } from "../../shared/retryActions";
import * as schema from "./schema";
import type { TownDb, TownStorage } from "./storage";

/** Free, daily-capped affection ticks are the one receipt that piles up, and
 * replaying a forgotten one costs nothing, so only those are ever pruned.
 * Anything that spends money stays durable forever. */
const PRUNED_ACTION = "earnAffection";
export const PRUNED_RECEIPTS_KEPT = 500;

export interface RequestIdentity { requestId?: string; action: string; payload: Record<string, unknown> }

/** A failed transaction leaves no receipt. Replaying a committed ID reads
 * current state without repeating its side effects, even after a server restart.
 * The work may await its queries; the storage keeps the town one-at-a-time
 * so the transaction still holds exactly its own writes (see storage.ts). */
export async function runRetrySafe(storage: TownStorage, db: TownDb, identity: RequestIdentity | undefined, work: (tx: TownDb) => Promise<void>): Promise<boolean> {
  return storage.transaction(db, async (tx) => {
    const requestId = identity?.requestId;
    const { request_id: _ignored, ...payload } = identity?.payload ?? {};
    const hash = identity ? createHash("sha256").update(canonicalJson(payload)).digest("hex") : "";
    if (requestId && identity) {
      const previous = (await tx.select().from(schema.requestReceipts).where(eq(schema.requestReceipts.requestId, requestId)).limit(1))[0];
      if (previous) {
        if (previous.action !== identity.action || previous.payloadHash !== hash) throw new Error("This request ID was already used for a different action.");
        return false;
      }
    }
    await work(tx);
    if (requestId && identity) {
      await tx.insert(schema.requestReceipts).values({ requestId, action: identity.action, payloadHash: hash });
      // A scan, so run it on about one tick in 256: UUIDs make that stateless.
      if (identity.action === PRUNED_ACTION && requestId.startsWith("00")) {
        await storage.pruneReceipts(tx, PRUNED_ACTION, PRUNED_RECEIPTS_KEPT);
      }
    }
    return true;
  });
}
