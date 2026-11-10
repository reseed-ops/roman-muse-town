// The town on the web, through its HTTP surface (Task 8). Runs in the
// Postgres test process (bun run test:pg): the server is created against
// pglite and exercised with plain Request objects, no socket.

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { DIRECTOR_TOKEN_HEADER, VISITOR_TOKEN_HEADER } from "../../shared/visitProtocol";
import { forgetReadyTowns, type PgTownDb } from "../../server/src/storage.pg";
import { createTownServer, type TownAction, type TownServer } from "./server";
import { signBlobPath, verifyBlobPath } from "./blobStore";
import { readVisitorToken, tokenMatches } from "./tokens";

const onPostgres = process.env.TOWN_DIALECT === "postgres";

describe("tokens at the door", () => {
  test("a token matches itself only, and empties never match", () => {
    expect(tokenMatches("abc", "abc")).toBe(true);
    expect(tokenMatches("abc", "abd")).toBe(false);
    expect(tokenMatches("", "")).toBe(false);
    expect(tokenMatches(null, "x")).toBe(false);
  });
  test("the visitor token comes as a header or a bearer, and only in its shape", () => {
    const token = "11111111-2222-4333-8444-555555555555";
    expect(readVisitorToken(new Request("http://t/actions", { headers: { [VISITOR_TOKEN_HEADER]: token } }))).toBe(token);
    expect(readVisitorToken(new Request("http://t/bridge/directions", { headers: { authorization: `Bearer ${token}` } }))).toBe(token);
    expect(readVisitorToken(new Request("http://t/actions", { headers: { [VISITOR_TOKEN_HEADER]: "short" } }))).toBeNull();
    expect(readVisitorToken(new Request("http://t/actions", { headers: { [VISITOR_TOKEN_HEADER]: "x".repeat(30) + "; drop" } }))).toBeNull();
    expect(readVisitorToken(new Request("http://t/actions"))).toBeNull();
  });
  test("a signed postcard path opens only with its signature, town and key intact", () => {
    const path = signBlobPath("secret", "town_0123456789abcdef01234567", "postcards/a.jpg");
    const url = new URL(path, "http://t");
    expect(verifyBlobPath("secret", url)).toEqual({ schemaName: "town_0123456789abcdef01234567", key: "postcards/a.jpg" });
    expect(verifyBlobPath("other", url)).toBeNull();
    const swapped = new URL(path.replace("town_0123456789abcdef01234567", "town_fedcba9876543210fedcba98"), "http://t");
    expect(verifyBlobPath("secret", swapped)).toBeNull();
    const otherKey = new URL(path.replace("a.jpg", "b.jpg"), "http://t");
    expect(verifyBlobPath("secret", otherKey)).toBeNull();
  });
});

describe.skipIf(!onPostgres)("the town on the web", () => {
  let client: { close(): Promise<void> };
  let server: TownServer;
  const logs: string[] = [];
  const DIRECTOR = "director-secret-token-0001";
  const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
  const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
  let dist: string;

  beforeAll(async () => {
    mock.module("@hatch/space-sdk", () => ({ z, defineAction: (definition: unknown) => definition }));
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const pglite = new PGlite();
    client = pglite;
    const { Actions } = await import("../../server/src/actions");
    const { visitActions } = await import("../../server/src/visitActions");
    forgetReadyTowns();
    dist = mkdtempSync(join(tmpdir(), "town-dist-"));
    writeFileSync(join(dist, "index.html"), "<!doctype html><title>Muse Town</title>");
    writeFileSync(join(dist, "main-abcdef12.js"), "console.log(1)");
    writeFileSync(join(dist, "sw.js"), "self.addEventListener('install', () => {})");
    mkdirSync(join(dist, "packs"), { recursive: true });
    writeFileSync(join(dist, "packs", "manifest.json"), JSON.stringify({ version: 1, packs: { roman: { file: "packs/roman-0123456789ab.pack", bytes: 5, files: 1 } }, entries: { "roman/temple.glb": { pack: "roman", offset: 0, size: 5, type: "model/gltf-binary" } } }));
    writeFileSync(join(dist, "packs", "roman-0123456789ab.pack"), "glTF!");
    server = createTownServer({
      db: drizzle(pglite) as unknown as PgTownDb,
      actions: Actions as unknown as Record<string, TownAction>,
      door: visitActions,
      directorToken: DIRECTOR,
      blobSecret: "blob-secret",
      distDir: dist,
      log: (line) => logs.push(line),
      statsCacheMs: 0,
    });
  });
  afterAll(async () => { await client?.close(); });

  const call = (token: string | null, action: string, args: Record<string, unknown> = {}, extra: Record<string, string> = {}) =>
    server.fetch(new Request("http://town.test/actions", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { [VISITOR_TOKEN_HEADER]: token } : {}), ...extra },
      body: JSON.stringify({ action, args }),
    }));
  const result = async (res: Response) => {
    expect(res.status).toBe(200);
    return ((await res.json()) as { result: any }).result;
  };
  const door = (visitor: string, action: string, args: Record<string, unknown> = {}, directorToken: string | null = DIRECTOR) =>
    call(visitor, action, args, directorToken ? { [DIRECTOR_TOKEN_HEADER]: directorToken } : {});
  const bridge = (token: string, path: string, init: RequestInit = {}) =>
    server.fetch(new Request(`http://town.test${path}`, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${token}`, "content-type": "application/json" } }));

  test("the state read carries a digest, and asked again unchanged it answers 304 with nothing (Task 41)", async () => {
    const first = await call(A, "getState");
    expect(first.status).toBe(200);
    const tag = first.headers.get("etag");
    expect(tag).toMatch(/^"[0-9a-z]+"$/);
    await first.json();
    const again = await call(A, "getState", {}, { "if-none-match": tag! });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
    // A changed town answers whole again, with a new digest.
    expect((await call(A, "waterTree", { request_id: crypto.randomUUID() })).status).toBe(200);
    const changed = await call(A, "getState", {}, { "if-none-match": tag! });
    expect(changed.status).toBe(200);
    expect(changed.headers.get("etag")).not.toBe(tag);
  });

  test("no visitor token, no town", async () => {
    expect((await call(null, "getState")).status).toBe(401);
    expect((await call("too-short", "getState")).status).toBe(401);
    expect((await call(A, "noSuchAction")).status).toBe(404);
    expect((await call(A, "markFound", { collectibleId: "" })).status).toBe(400);
    const res = await server.fetch(new Request("http://town.test/actions", { method: "POST", headers: { [VISITOR_TOKEN_HEADER]: A }, body: "{not json" }));
    expect(res.status).toBe(400);
  });

  test("the first call seeds a town for the token, and tokens never share one", async () => {
    const fresh = await result(await call(A, "getState"));
    expect(fresh.found).toEqual([]);
    expect(fresh.bond.bond).toBe(0);
    const found = await result(await call(A, "markFound", { collectibleId: "pointy-hat" }));
    expect(found.found).toEqual(["pointy-hat"]);
    const invalidated = await call(A, "addJournalEntry", { text: "Only mine." });
    expect((await invalidated.json() as { invalidate: boolean }).invalidate).toBe(true);
    const other = await result(await call(B, "getState"));
    expect(other.found).toEqual([]);
    expect(other.journal).toEqual([]);
    const mine = await result(await call(A, "getState"));
    expect(mine.journal.map((entry: { text: string }) => entry.text)).toEqual(["Only mine."]);
  });

  test("the door is shut without the director token, and reads as an unknown action", async () => {
    expect((await door(A, "visitstate", {}, null)).status).toBe(404);
    expect((await door(A, "visitstate", {}, "wrong-token")).status).toBe(404);
    expect((await door(A, "beginvisit", {}, "wrong-token")).status).toBe(404);
    const noDirector = (await door(A, "visitstate", {}, null)).status;
    const unknown = (await call(A, "noSuchAction")).status;
    expect(noDirector).toBe(unknown);
    for (const line of logs) {
      expect(line).not.toContain(DIRECTOR);
      expect(line).not.toContain(A);
      expect(line).not.toContain("wrong-token");
    }
    expect(logs.some((line) => line.startsWith("refused door visitstate"))).toBe(true);
  });

  test("through the door a director opens a visit, reads the slate, directs, and ends it", async () => {
    // Nothing open yet: the director asks for a visit.
    const begin = await result(await door(A, "beginvisit"));
    expect(begin).toEqual({ ok: true, active: false });
    // The client's idle glance hears it once.
    const glance = await (await bridge(A, "/bridge/directions?since=0")).json() as { begin?: boolean; directions: unknown[] };
    expect(glance.begin).toBe(true);
    const again = await (await bridge(A, "/bridge/directions?since=0")).json() as { begin?: boolean };
    expect(again.begin).toBeUndefined();
    // The client opens the visit and posts its slate.
    const { beginVisit, captureMail, emptySlate, stateView } = await import("../../client/src/visitSlate");
    let slate = beginVisit(emptySlate(), 1000);
    const mail = captureMail(slate, "Are you there?", 1001);
    slate = mail.slate;
    const posted = await bridge(A, "/bridge/snapshot", { method: "POST", body: JSON.stringify({ state: stateView(slate), mail: [mail.mail], frame: null }) });
    expect(posted.status).toBe(200);
    expect(await posted.json()).toEqual({ ok: true, latestSeq: 1, frameId: null });
    // The director reads it.
    const view = await result(await door(A, "visitstate", { since: 0 }));
    expect(view.state.active).toBe(true);
    expect(view.mail).toEqual([{ seq: 1, text: "Are you there?", at: 1001 }]);
    expect(await result(await door(A, "visitframeget"))).toEqual({ frame: null });
    // And directs; a bad shape is refused with a reason, never thrown.
    expect(await result(await door(A, "visitdirect", { direction: { kind: "goto", anchor: "tree" } }))).toEqual({ ok: true, id: 1 });
    expect(await result(await door(A, "visitdirect", { direction: { kind: "fly" } }))).toEqual({ ok: false, error: "unknown direction kind: fly" });
    expect(await result(await door(A, "visitcomposing", { on: true }))).toEqual({ ok: true });
    const pull = await (await bridge(A, "/bridge/directions?since=0")).json() as { directions: { id: number; direction: unknown }[]; composing: boolean };
    expect(pull.directions.map((q) => q.direction)).toEqual([{ kind: "goto", anchor: "tree" }]);
    expect(pull.composing).toBe(true);
    // Another visitor's door sees none of it.
    const viewB = await result(await door(B, "visitstate", { since: 0 }));
    expect(viewB.state.active).toBe(false);
    expect(viewB.mail).toEqual([]);
    // The director ends it; the client hears it once on its next pull.
    expect(await result(await door(A, "endvisit"))).toEqual({ ok: true });
    const ending = await (await bridge(A, "/bridge/directions?since=1")).json() as { end?: boolean };
    expect(ending.end).toBe(true);
  });

  test("the bridge routes refuse without the visitor token and never log it", async () => {
    const res = await server.fetch(new Request("http://town.test/bridge/directions?since=0"));
    expect(res.status).toBe(401);
    const bad = await server.fetch(new Request("http://town.test/bridge/snapshot", { method: "POST", headers: { authorization: "Bearer nope" }, body: "{}" }));
    expect(bad.status).toBe(401);
    expect(logs.some((line) => line.includes("nope"))).toBe(false);
    const malformed = await bridge(A, "/bridge/snapshot", { method: "POST", body: JSON.stringify({ state: { active: "yes" } }) });
    expect(malformed.status).toBe(400);
  });

  test("a postcard's image lives in the visitor's schema and is served by its signed path only", async () => {
    const bytes = new Uint8Array(160);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    bytes.set([0xff, 0xd9], 158);
    const image_base64 = Buffer.from(bytes).toString("base64");
    const state = await result(await call(A, "addPostcard", { image_base64, caption: "By the tree", date_label: "Today", weather: "clear" }));
    expect(state.postcards).toHaveLength(1);
    const imageUrl: string = state.postcards[0].image_url;
    expect(imageUrl.startsWith("/blobs/")).toBe(true);
    const served = await server.fetch(new Request(`http://town.test${imageUrl}`));
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes);
    const tampered = await server.fetch(new Request(`http://town.test${imageUrl.replace(/s=[0-9a-f]{4}/, "s=0000")}`));
    expect(tampered.status).toBe(404);
    // The save carries the image as an attachment, read straight from the store.
    const { json } = await result(await call(A, "exportSave"));
    const save = JSON.parse(json);
    expect(save.attachments).toHaveLength(1);
    expect(save.attachments[0].base64).toBe(image_base64);
    // B has no postcards, and A's path does not change that.
    expect((await result(await call(B, "getState"))).postcards).toEqual([]);
  });

  test("the built client is served: the shell uncached, hashed files immutable, nothing outside dist", async () => {
    const index = await server.fetch(new Request("http://town.test/"));
    expect(index.status).toBe(200);
    expect(index.headers.get("cache-control")).toBe("no-cache");
    expect(await index.text()).toContain("Muse Town");
    const hashed = await server.fetch(new Request("http://town.test/main-abcdef12.js"));
    expect(hashed.headers.get("cache-control")).toContain("immutable");
    const sw = await server.fetch(new Request("http://town.test/sw.js"));
    expect(sw.headers.get("service-worker-allowed")).toBe("/");
    expect(sw.headers.get("cache-control")).toBe("no-cache");
    expect((await server.fetch(new Request("http://town.test/missing.js"))).status).toBe(404);
    expect((await server.fetch(new Request("http://town.test/..%2f..%2fetc%2fpasswd"))).status).toBe(404);
    expect((await server.fetch(new Request("http://town.test/healthz"))).status).toBe(200);
  });

  test("the packed assets (Task 14): packs immutable, the manifest fresh, no asset file served by path", async () => {
    const manifest = await server.fetch(new Request("http://town.test/packs/manifest.json"));
    expect(manifest.status).toBe(200);
    expect(manifest.headers.get("cache-control")).toBe("no-cache");
    expect((await manifest.json()).entries["roman/temple.glb"].pack).toBe("roman");
    const pack = await server.fetch(new Request("http://town.test/packs/roman-0123456789ab.pack"));
    expect(pack.status).toBe(200);
    expect(pack.headers.get("cache-control")).toContain("immutable");
    expect(await pack.text()).toBe("glTF!");
    // The licensed files are not on disk as files, so their old paths are not found.
    for (const path of ["/assets/temple-0123456789ab.glb", "/assets/roman/temple.glb", "/roman/temple.glb", "/client/src/assets/roman/temple.glb"]) {
      expect((await server.fetch(new Request(`http://town.test${path}`))).status).toBe(404);
    }
  });

  test("the anonymous counts (Task 52): a new town counts once, pairing codes minted and redeemed, nothing about anyone", async () => {
    const before = (await (await server.fetch(new Request("http://town.test/stats?format=json"))).json()) as any;
    const C = "cccccccc-3333-4333-8333-cccccccccccc";
    await result(await call(C, "getState"));
    await result(await call(C, "getState"));
    const minted = await bridge(C, "/bridge/pair", { method: "POST" });
    expect(minted.status).toBe(200);
    const { code } = (await minted.json()) as { code: string };
    const redeemed = await server.fetch(new Request("http://town.test/director/pair-redeem", {
      method: "POST",
      headers: { "content-type": "application/json", [DIRECTOR_TOKEN_HEADER]: DIRECTOR },
      body: JSON.stringify({ code }),
    }));
    expect(redeemed.status).toBe(200);
    const after = (await (await server.fetch(new Request("http://town.test/stats?format=json"))).json()) as any;
    expect(after.townsInAll).toBe(before.townsInAll + 1);
    expect(after.kinds["town-created"].total).toBe(before.kinds["town-created"].total + 1);
    expect(after.kinds["town-created"].lastDay).toBe(before.kinds["town-created"].lastDay + 1);
    expect(after.kinds["pair-minted"].total).toBe(before.kinds["pair-minted"].total + 1);
    expect(after.kinds["pair-redeemed"].total).toBe(before.kinds["pair-redeemed"].total + 1);
    expect(after.countingSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const page = await server.fetch(new Request("http://town.test/stats"));
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/plain");
    expect(page.headers.get("set-cookie")).toBeNull();
    const text = await page.text();
    expect(text).toContain(`Towns in all: ${after.townsInAll}`);
    expect(text).toContain("Pairing codes minted: ");
    expect(text).toContain("Your own towns are included");
    // Nothing that names a person or a town: no key, no schema, no code.
    for (const secret of [A, B, C, code, "town_"]) expect(text + JSON.stringify(after)).not.toContain(secret);
    expect((await server.fetch(new Request("http://town.test/stats", { method: "POST" }))).status).toBe(405);
  });
});
