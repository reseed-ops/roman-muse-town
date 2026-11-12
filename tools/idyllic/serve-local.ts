// Task 85: serve the real web build locally against an in-process Postgres (pglite), for a
// Playwright screenshot of the whole town. Dev only; never deployed. Usage: bun tools/idyllic/serve-local.ts [port]
process.env.TOWN_DIALECT = "postgres";
import { plugin } from "bun";
import { z } from "zod";
plugin({ name: "space-sdk", setup(b) { b.module("@hatch/space-sdk", () => ({ exports: { z, defineAction: (d: unknown) => d }, loader: "object" })); } });
const { PGlite } = await import("@electric-sql/pglite");
const { drizzle } = await import("drizzle-orm/pglite");
const { Actions } = await import("../../server/src/actions");
const { visitActions } = await import("../../server/src/visitActions");
const { createTownServer } = await import("../../web/src/server");
const pglite = new PGlite();
const server = createTownServer({
  db: drizzle(pglite) as never,
  actions: Actions as never,
  door: visitActions,
  directorToken: null,
  blobSecret: "local-only",
  distDir: new URL("../../web/dist/client", import.meta.url).pathname,
  log: () => {},
});
const port = Number(process.argv[2]) || 8099;
Bun.serve({ port, fetch: (req, srv) => server.fetch(req, srv.requestIP(req)?.address), idleTimeout: 60 });
console.log("local town on", port);
