// Task 85: serve the real web build locally against an in-process Postgres (pglite), for a
// Playwright screenshot of the whole town. Dev only; never deployed. Usage: bun tools/idyllic/serve-local.ts [port] [distDir]
process.env.TOWN_DIALECT = "postgres";
import { plugin } from "bun";
import { z } from "zod";
plugin({ name: "space-sdk", setup(b) { b.module("@hatch/space-sdk", () => ({ exports: { z, defineAction: (d: unknown) => d }, loader: "object" })); } });
const { PGlite } = await import("@electric-sql/pglite");
const { drizzle } = await import("drizzle-orm/pglite");
const { Actions } = await import("/home/mariel/work/roman-muse-town/server/src/actions");
const { visitActions } = await import("/home/mariel/work/roman-muse-town/server/src/visitActions");
const { createTownServer } = await import("/home/mariel/work/roman-muse-town/web/src/server");
const pglite = new PGlite();
const server = createTownServer({
  db: drizzle(pglite) as never,
  actions: Actions as never,
  door: visitActions,
  directorToken: null,
  blobSecret: "local-only",
  distDir: process.argv[3] ?? new URL("/home/mariel/work/roman-muse-town/web/dist/client", import.meta.url).pathname,
  log: () => {},
});
const port = Number(process.argv[2]) || 8099;
Bun.serve({ port, fetch: (req, srv) => server.fetch(req, srv.requestIP(req)?.address), idleTimeout: 60 });
console.log("local town on", port);
const seed = async () => { for (let i = 0; i < 600; i++) { try { const sch = (await pglite.query("select table_schema s from information_schema.tables where table_name='letters'")).rows[0] as {s:string}|undefined; if (!sch) throw new Error("no table yet"); await pglite.query("INSERT INTO \"" + sch.s + "\".letters (date_label, title, body) VALUES ('[DATE] ', 'First letter', 'My dear Gaius,\n\n[TEMPLATE: the original town is first letter was personal.]\n\nYours,\nMuse')"); console.log("SEEDED"); return; } catch (e) { if (i % 20 === 5) console.log("seed err", String(e).slice(0, 160)); await new Promise((r) => setTimeout(r, 1000)); } } }; seed();
