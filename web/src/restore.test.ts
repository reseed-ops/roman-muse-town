// A save above 2 MB, with postcards, round-trips through the hosted
// routes (Task 65): exported by the action, restored by POST /restore.

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { MAX_EXPORT_BYTES, MAX_SAVE_BYTES } from "../../shared/saveFormat";
import { UserFacingError } from "../../shared/userError";
import { forgetReadyTowns, type PgTownDb } from "../../server/src/storage.pg";
import { createTownServer, type TownAction, type TownServer } from "./server";
import { restoreSaveOverHttp } from "../../client/src/townSaveClient";

const onPostgres = process.env.TOWN_DIALECT === "postgres";
const A = "restore-a-0000-aaaa-1111-aaaaaaaaa";
const B = "restore-b-0000-bbbb-2222-bbbbbbbbb";

test("the export limit leaves headroom under the restore limit, and the restore route is sized for the whole save", () => {
  expect(MAX_EXPORT_BYTES).toBeLessThan(MAX_SAVE_BYTES);
  expect(MAX_SAVE_BYTES - MAX_EXPORT_BYTES).toBeGreaterThanOrEqual(128 * 1024);
});

describe.skipIf(!onPostgres)("save export and restore over HTTP", () => {
  let client: { close(): Promise<void> };
  let server: TownServer;

  beforeAll(async () => {
    mock.module("@hatch/space-sdk", () => ({ z, defineAction: (definition: unknown) => definition }));
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const pglite = new PGlite();
    client = pglite;
    const { Actions } = await import("../../server/src/actions");
    forgetReadyTowns();
    server = createTownServer({
      db: drizzle(pglite) as unknown as PgTownDb,
      actions: { ...(Actions as unknown as Record<string, TownAction>), tooBig: { request: z.object({}), response: z.object({}), handler: async () => { throw new UserFacingError("This town's save is too large to export."); } } },
      directorToken: "d",
      blobSecret: "s",
      distDir: null,
      limits: { actionsPerTown: 10_000, actionsPerAddress: 10_000, heavyPerTown: 1000 },
      retentionDays: 0,
    });
  });
  afterAll(async () => { await client?.close(); });

  const post = (token: string, action: string, args: Record<string, unknown> = {}) =>
    server.fetch(new Request("http://t/actions", { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: token, "content-type": "application/json" }, body: JSON.stringify({ action, args }) }), "10.0.0.1");
  const jpegBase64 = (bytes: number, seed: number) => {
    const raw = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) raw[i] = (i * 31 + seed) & 255;
    raw[0] = 0xff; raw[1] = 0xd8; raw[2] = 0xff;
    return Buffer.from(raw).toString("base64");
  };

  test("a 3 MB save with postcards exports, is refused whole by /actions (2 MB), and restores through /restore into another town", async () => {
    for (let i = 0; i < 4; i++) {
      const res = await post(A, "addPostcard", { image_base64: jpegBase64(640_000, i), caption: `Postcard ${i}`, date_label: "Today", weather: "clear" });
      expect(res.status).toBe(200);
    }
    const exported = (await (await post(A, "exportSave")).json()) as { result: { json: string } };
    const json = exported.result.json;
    expect(Buffer.byteLength(json)).toBeGreaterThan(3 * 1024 * 1024);
    // Wrapped in the action JSON it is over the 2 MB action cap, as before.
    const wrapped = await post(B, "restoreSave", { json, request_id: crypto.randomUUID() });
    expect(wrapped.status).toBe(413);
    // The dedicated route takes it.
    const res = await server.fetch(new Request(`http://t/restore?request_id=${crypto.randomUUID()}`, { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: B, "content-type": "application/json" }, body: json }), "10.0.0.2");
    expect(res.status).toBe(200);
    const state = (await (await post(B, "getState")).json()) as { result: { postcards: { caption: string; image_url: string }[] } };
    expect(state.result.postcards.map((p) => p.caption).sort()).toEqual(["Postcard 0", "Postcard 1", "Postcard 2", "Postcard 3"]);
    // And the images came with it.
    const image = await server.fetch(new Request(`http://t${state.result.postcards[0]!.image_url}`));
    expect(image.status).toBe(200);
    expect((await image.arrayBuffer()).byteLength).toBe(640_000);
    // Restoring replaced rather than added: the same save again leaves four.
    expect((await server.fetch(new Request(`http://t/restore?request_id=${crypto.randomUUID()}`, { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: B }, body: json }), "10.0.0.2")).status).toBe(200);
    const again = (await (await post(B, "getState")).json()) as { result: { postcards: unknown[] } };
    expect(again.result.postcards).toHaveLength(4);
  });

  test("the restore route refuses bodies past the save limit, a missing id, a missing token, and the wrong method", async () => {
    const big = "x".repeat(MAX_SAVE_BYTES + 128 * 1024);
    const over = await server.fetch(new Request(`http://t/restore?request_id=${crypto.randomUUID()}`, { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: B }, body: big }), "10.0.0.3");
    expect(over.status).toBe(413);
    expect((await server.fetch(new Request("http://t/restore", { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: B }, body: "{}" }))).status).toBe(400);
    expect((await server.fetch(new Request(`http://t/restore?request_id=${crypto.randomUUID()}`, { method: "POST", body: "{}" }))).status).toBe(401);
    expect((await server.fetch(new Request(`http://t/restore?request_id=${crypto.randomUUID()}`, { method: "GET", headers: { [VISITOR_TOKEN_HEADER]: B } }))).status).toBe(405);
  });

  test("a chunked body past the action cap is cut off without being read whole", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 6; i++) controller.enqueue(new Uint8Array(1024 * 1024).fill(97));
        controller.close();
      },
    });
    const res = await server.fetch(new Request("http://t/actions", { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: A, "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit), "10.0.0.4");
    expect(res.status).toBe(413);
  });

  test("a limit the visitor can act on is said plainly, not as 'could not finish'", async () => {
    const res = await post(A, "tooBig");
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toContain("too large to export");
  });
});

describe("the client's restore", () => {
  test("hosted, it posts the raw save to /restore with the visitor key; a refusal says what the town said; 413 says the limit", async () => {
    const seen: { url: string; body: unknown; token: string | null }[] = [];
    const ok = (async (url: string, init?: RequestInit) => { seen.push({ url, body: init?.body, token: new Headers(init?.headers).get(VISITOR_TOKEN_HEADER) }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    await restoreSaveOverHttp('{"a":1}', "11111111-1111-4111-8111-111111111111", async () => { throw new Error("not used"); }, { hosted: true, fetchImpl: ok, token: () => "visitor-key-0000000000001" });
    expect(seen).toEqual([{ url: "./restore?request_id=11111111-1111-4111-8111-111111111111", body: '{"a":1}', token: "visitor-key-0000000000001" }]);
    const refused = (async () => new Response(JSON.stringify({ error: "The save exceeds the 32 MB limit." }), { status: 422 })) as unknown as typeof fetch;
    await expect(restoreSaveOverHttp("{}", "x", async () => undefined, { hosted: true, fetchImpl: refused, token: () => "k" })).rejects.toThrow("exceeds the 32 MB");
    const big = (async () => new Response("{}", { status: 413 })) as unknown as typeof fetch;
    await expect(restoreSaveOverHttp("{}", "x", async () => undefined, { hosted: true, fetchImpl: big, token: () => "k" })).rejects.toThrow("32 MB");
  });
  test("off the hosted web the ordinary action is used", async () => {
    const calls: unknown[] = [];
    await restoreSaveOverHttp("{}", "rid", async (args) => { calls.push(args); }, { hosted: false });
    expect(calls).toEqual([{ json: "{}", request_id: "rid" }]);
  });
});
