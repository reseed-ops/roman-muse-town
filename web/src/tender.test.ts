// The town as the last boundary for the tender-only line (Task 62): the
// director door gates every line at the town's own rank for that visitor,
// whatever director calls it, and tells a director that rank from the
// town's database, never from the caller.

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { DIRECTOR_TOKEN_HEADER, VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { forgetReadyTowns, townSchemaName, withTown, type PgTownDb } from "../../server/src/storage.pg";
import { createTownServer, type TownAction, type TownServer } from "./server";

const onPostgres = process.env.TOWN_DIALECT === "postgres";
const DIRECTOR = "director-secret-token-0002";
const HIGH = "tender-high-0000-aaaa-1111-aaaaaaaa";
const LOW = "tender-low--0000-bbbb-2222-bbbbbbbb";

describe.skipIf(!onPostgres)("the town's door holds the tender-only line", () => {
  let client: { close(): Promise<void> };
  let db: PgTownDb;
  let server: TownServer;

  beforeAll(async () => {
    mock.module("@hatch/space-sdk", () => ({ z, defineAction: (definition: unknown) => definition }));
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const pglite = new PGlite();
    client = pglite;
    db = drizzle(pglite) as unknown as PgTownDb;
    const { Actions, readAffectionRank } = await import("../../server/src/actions");
    const { visitActions } = await import("../../server/src/visitActions");
    forgetReadyTowns();
    server = createTownServer({
      db,
      actions: Actions as unknown as Record<string, TownAction>,
      door: visitActions,
      directorToken: DIRECTOR,
      readRank: readAffectionRank as never,
      blobSecret: "s",
      distDir: null,
      limits: { actionsPerTown: 10_000, actionsPerAddress: 10_000 },
      retentionDays: 0,
    });
    // Two towns: one at rank 8 (800 points), one new (rank 0).
    for (const t of [HIGH, LOW]) await server.fetch(new Request("http://t/actions", { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: t, "content-type": "application/json" }, body: JSON.stringify({ action: "getState", args: {} }) }));
    // Each town opens a visit, as its own client does.
    const { beginVisit, emptySlate, stateView } = await import("../../client/src/visitSlate");
    for (const t of [HIGH, LOW]) {
      const res = await server.fetch(new Request("http://t/bridge/snapshot", { method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ state: stateView(beginVisit(emptySlate(), Date.now())), mail: [], frame: null }) }));
      expect(res.status).toBe(200);
    }
    await withTown(db, townSchemaName(HIGH), (tx) => (tx as unknown as { execute(q: unknown): Promise<unknown> }).execute(sql`UPDATE affection_state SET points = 850, last_contact_at = now() WHERE id = 1`));
  });
  afterAll(async () => { await client?.close(); });

  const door = (visitor: string, action: string, args: Record<string, unknown>, director: string | null = DIRECTOR) =>
    server.fetch(new Request("http://t/actions", { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: visitor, ...(director ? { [DIRECTOR_TOKEN_HEADER]: director } : {}), "content-type": "application/json" }, body: JSON.stringify({ action, args }) }));
  const direct = async (visitor: string, direction: unknown) => ((await (await door(visitor, "visitdirect", { direction })).json()) as { result: { ok: boolean; error?: string } }).result;

  test("the door reports each town's own rank, and a caller cannot supply one", async () => {
    const high = (await (await door(HIGH, "visitstate", { since: 0, rank: 10 })).json()) as { result: { entitlement: { rank: number } } };
    const low = (await (await door(LOW, "visitstate", { since: 0, rank: 10 })).json()) as { result: { entitlement: { rank: number } } };
    expect(high.result.entitlement.rank).toBe(8);
    expect(low.result.entitlement.rank).toBe(0);
  });

  test("a direction straight to the door is gated: explicit at every rank, intimacy by the town's rank, intentions too", async () => {
    for (const visitor of [HIGH, LOW]) {
      for (const kind of ["speak", "intend"] as const) {
        const r = await direct(visitor, { kind, text: "Let us make love tonight." });
        expect(r).toEqual({ ok: false, error: "refused by the town: explicit" });
      }
    }
    expect(await direct(LOW, { kind: "speak", text: "Kiss me now. Soon we can walk." })).toEqual({ ok: false, error: "refused by the town: beyond the band" });
    expect(await direct(LOW, { kind: "intend", text: "She means to kiss him." })).toEqual({ ok: false, error: "refused by the town: beyond the band" });
    expect((await direct(HIGH, { kind: "speak", text: "Kiss me now. Soon we can walk." })).ok).toBe(true);
    // Plain directions and a deferral pass in the low town.
    expect((await direct(LOW, { kind: "speak", text: "A kiss will come when the moment is right." })).ok).toBe(true);
    expect((await direct(LOW, { kind: "emote", emote: "wave" })).ok).toBe(true);
  });

  test("without the director token the door does not exist", async () => {
    expect((await door(HIGH, "visitdirect", { direction: { kind: "speak", text: "Hello." } }, null)).status).toBe(404);
  });
});
