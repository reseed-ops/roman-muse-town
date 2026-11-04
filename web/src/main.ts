// The town on the web: the process Railway starts (Task 8). Environment:
//
//   DATABASE_URL    the Railway Postgres service (required)
//   DIRECTOR_TOKEN  opens the director door; absent, the door is shut
//   TOWN_SECRET     signs postcard paths; absent, a random one per
//                   process (postcard links then change on a restart)
//   PORT            Railway sets it (default 8080)
//
// The dialect is fixed to Postgres before anything else loads, which is
// what makes schema.ts hand the action layer the pg-core tables.

process.env.TOWN_DIALECT = "postgres";

const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log("DATABASE_URL is missing; the town cannot open. Exiting.");
    process.exit(1);
  }
  const { SQL } = await import("bun");
  const { drizzle } = await import("drizzle-orm/bun-sql");
  const { Actions } = await import("../../server/src/actions");
  const { visitActions } = await import("../../server/src/visitActions");
  const { createTownServer } = await import("./server");
  const { randomBytes } = await import("node:crypto");

  const client = new SQL(databaseUrl);
  const db = drizzle(client) as unknown as import("../../server/src/storage.pg").PgTownDb;
  const directorToken = process.env.DIRECTOR_TOKEN?.trim() || null;
  let blobSecret = process.env.TOWN_SECRET?.trim() || "";
  if (!blobSecret) {
    blobSecret = randomBytes(32).toString("hex");
    log("TOWN_SECRET is missing; postcard links will change when the town restarts.");
  }
  const distDir = process.env.TOWN_DIST || new URL("../dist/client", import.meta.url).pathname;
  const server = createTownServer({
    db,
    actions: Actions as unknown as Record<string, import("./server").TownAction>,
    door: visitActions,
    directorToken,
    blobSecret,
    distDir,
    log,
  });
  const port = Number(process.env.PORT) || 8080;
  Bun.serve({ port, fetch: server.fetch, maxRequestBodySize: 4 * 1024 * 1024, idleTimeout: 60 });
  log(`muse town on the web: :${port}, door ${directorToken ? "open to the director token" : "shut (no DIRECTOR_TOKEN)"}, client at ${distDir}`);
}

void main();
