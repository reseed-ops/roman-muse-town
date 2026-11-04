import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import * as schema from "./schema";
import type { TownDb } from "./storage";

/** Recent history is bounded; live inventory and permanent progress are not. */
export async function loadFishState(db: TownDb) {
  const recentIds = db.select({ id: schema.catches.id }).from(schema.catches)
    .orderBy(desc(schema.catches.id)).limit(60);
  const catchRows = await db.select().from(schema.catches)
    .where(or(
      inArray(schema.catches.id, recentIds),
      and(eq(schema.catches.sold, 0), eq(schema.catches.released, 0)),
    ))
    .orderBy(desc(schema.catches.id));
  const releasedFish = await db.select({ fishId: schema.catches.fishId }).from(schema.catches)
    .where(eq(schema.catches.released, 1)).orderBy(asc(schema.catches.id));
  const golden = await db.select({ id: schema.catches.id }).from(schema.catches)
    .where(eq(schema.catches.fishId, "golden-carp")).limit(1);
  return { catchRows, releasedFish, hasGoldenCarp: golden.length > 0 };
}
