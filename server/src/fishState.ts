import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

/** Recent history is bounded; live inventory and permanent progress are not. */
export function loadFishState(db: BunSQLiteDatabase<typeof schema>) {
  const recentIds = db.select({ id: schema.catches.id }).from(schema.catches)
    .orderBy(desc(schema.catches.id)).limit(60);
  const catchRows = db.select().from(schema.catches)
    .where(or(
      inArray(schema.catches.id, recentIds),
      and(eq(schema.catches.sold, 0), eq(schema.catches.released, 0)),
    ))
    .orderBy(desc(schema.catches.id)).all();
  const releasedFish = db.select({ fishId: schema.catches.fishId }).from(schema.catches)
    .where(eq(schema.catches.released, 1)).orderBy(asc(schema.catches.id)).all();
  const hasGoldenCarp = db.select({ id: schema.catches.id }).from(schema.catches)
    .where(eq(schema.catches.fishId, "golden-carp")).limit(1).get() !== undefined;
  return { catchRows, releasedFish, hasGoldenCarp };
}
