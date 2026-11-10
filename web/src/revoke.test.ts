// Disconnect and revocation at the town (Task 63): the pairing generation.

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { DIRECTOR_TOKEN_HEADER, VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { forgetReadyTowns, type PgTownDb } from "../../server/src/storage.pg";
import { createTownServer, type TownAction, type TownServer } from "./server";

const onPostgres = process.env.TOWN_DIALECT === "postgres";
const DIRECTOR = "director-secret-token-0003";
const A = "revoke-a-0000-aaaa-1111-aaaaaaaaaa";
const B = "revoke-b-0000-bbbb-2222-bbbbbbbbbb";

describe.skipIf(!onPostgres)("pairing generations", () => {
  let client: { close(): Promise<void> };
  let server: TownServer;

  beforeAll(async () => {
    mock.module("@hatch/space-sdk", () => ({ z, defineAction: (definition: unknown) => definition }));
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const pglite = new PGlite();
    client = pglite;
    const { Actions, readAffectionRank } = await import("../../server/src/actions");
    const { visitActions } = await import("../../server/src/visitActions");
    forgetReadyTowns();
    server = createTownServer({
      db: drizzle(pglite) as unknown as PgTownDb,
      actions: Actions as unknown as Record<string, TownAction>,
      door: visitActions,
      directorToken: DIRECTOR,
      readRank: readAffectionRank as never,
      blobSecret: "s",
      distDir: null,
      limits: { actionsPerTown: 10_000, actionsPerAddress: 10_000, bridgePerTown: 10_000, pairMintsPerTown: 100 },
      retentionDays: 0,
    });
    for (const t of [A, B]) await server.fetch(new Request("http://t/actions", { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: t, "content-type": "application/json" }, body: JSON.stringify({ action: "getState", args: {} }) }));
  });
  afterAll(async () => { await client?.close(); });

  const bridge = (t: string | null, path: string, method = "POST") =>
    server.fetch(new Request(`http://t${path}`, { method, headers: t ? { authorization: `Bearer ${t}` } : {} }));
  const mintAndRedeem = async (t: string) => {
    const { code } = (await (await bridge(t, "/bridge/pair")).json()) as { code: string };
    const res = await server.fetch(new Request("http://t/director/pair-redeem", { method: "POST", headers: { [DIRECTOR_TOKEN_HEADER]: DIRECTOR, "content-type": "application/json" }, body: JSON.stringify({ code }) }));
    expect(res.status).toBe(200);
    return (await res.json()) as { visitorToken: string; generation: number };
  };
  const doorGeneration = async (t: string) => {
    const res = await server.fetch(new Request("http://t/actions", { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: t, [DIRECTOR_TOKEN_HEADER]: DIRECTOR, "content-type": "application/json" }, body: JSON.stringify({ action: "visitstate", args: { since: 0 } }) }));
    return ((await res.json()) as { result: { entitlement: { pairingGeneration: number } } }).result.entitlement.pairingGeneration;
  };

  test("each redemption moves the town's generation on, and the door reports it; towns are independent", async () => {
    expect(await doorGeneration(A)).toBe(0);
    expect((await mintAndRedeem(A)).generation).toBe(1);
    expect((await mintAndRedeem(A)).generation).toBe(2);
    expect(await doorGeneration(A)).toBe(2);
    expect(await doorGeneration(B)).toBe(0);
    expect((await mintAndRedeem(B)).generation).toBe(1);
    expect(await doorGeneration(A)).toBe(2);
  });

  test("disconnect works from the visitor's own authenticated town, retires every token and any unused code, and touches no other town", async () => {
    const before = await doorGeneration(A);
    const { code } = (await (await bridge(A, "/bridge/pair")).json()) as { code: string };
    const gone = await bridge(A, "/bridge/disconnect");
    expect(gone.status).toBe(200);
    expect(((await gone.json()) as { generation: number }).generation).toBe(before + 1);
    expect(await doorGeneration(A)).toBe(before + 1);
    // The unused code is dropped with it.
    const redeem = await server.fetch(new Request("http://t/director/pair-redeem", { method: "POST", headers: { [DIRECTOR_TOKEN_HEADER]: DIRECTOR, "content-type": "application/json" }, body: JSON.stringify({ code }) }));
    expect(redeem.status).toBe(404);
    expect(await doorGeneration(B)).toBe(1);
    // It needs the visitor's token, and POST.
    expect((await bridge(null, "/bridge/disconnect")).status).toBe(401);
    expect((await bridge(A, "/bridge/disconnect", "GET")).status).toBe(405);
  });
});
