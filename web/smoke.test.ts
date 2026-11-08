import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTownServer } from "./src/server";

// The build smoke test: run after `bun run build:web`. It proves the
// built town is whole and that the server answers with it: the page,
// its hashed bundle, the service worker, the asset packs' manifest and
// the health check. No database is needed for any of these routes.

const DIST = join(import.meta.dir, "dist");
const CLIENT = join(DIST, "client");
const built = existsSync(join(CLIENT, "index.html"));

test.skipIf(!built)("the built town is whole and the server serves it", async () => {
  expect(existsSync(join(DIST, "server.js"))).toBe(true);
  const html = readFileSync(join(CLIENT, "index.html"), "utf8");
  const main = /\/(main-[a-z0-9]+\.js)/.exec(html)?.[1];
  expect(main).toBeDefined();
  const server = createTownServer({ db: null as never, actions: {}, directorToken: null, blobSecret: "smoke", distDir: CLIENT });
  const get = (path: string) => server.fetch(new Request(`http://town.test${path}`));
  const page = await get("/");
  expect(page.status).toBe(200);
  expect(await page.text()).toContain(main!);
  const bundle = await get(`/${main}`);
  expect(bundle.status).toBe(200);
  expect(bundle.headers.get("cache-control")).toContain("immutable");
  expect((await get("/sw.js")).headers.get("service-worker-allowed")).toBe("/");
  const manifest = await get("/packs/manifest.json");
  expect(manifest.status).toBe(200);
  expect(Object.keys(((await manifest.json()) as { entries: Record<string, unknown> }).entries).length).toBeGreaterThan(100);
  expect(await (await get("/healthz")).json()).toEqual({ ok: true });
  // The first paint's still (Task 41), named by the page and served.
  expect(html).toContain("town-still.jpg");
  expect((await get("/town-still.jpg")).status).toBe(200);
});
