# Muse Town on the web

The town as a web app on the owner's Railway (Task 8, Nov 2026): one
service that serves the client and answers its action calls, a Railway
Postgres beside it, a town per visitor, and a locked door through
which the owner's Live Bridge, or the owner's own Muse, directs a visit
in a hosted town. The artifact line and the Android build are untouched:
`client/src` and `server/src` are read by this build, never edited, and
the one thing the client learns is a meta tag saying it is hosted.

## Shape

- **One codebase, two engines.** The action layer runs on bun:sqlite
  in the artifact runtime and on Postgres here (`server/src/storage.ts`
  explains the one rule that makes that honest: a town runs one action
  at a time). `server/src/schema.pg.ts` mirrors the SQLite schema table
  for table; `drizzle-pg/` holds the Postgres migrations.
- **A town per visitor.** The client mints a visitor token on its first
  load and keeps it in localStorage; every call carries it. The server
  names the visitor's schema by a hash of the token and runs every
  request inside one transaction with `search_path` set to that schema
  and an advisory lock on it (`server/src/storage.pg.ts`). Isolation is
  the database's on every query; nothing a client sends can name another
  town. The first call creates the schema and runs the migrations; the
  client's own first-load seeds do the rest. No accounts, no sign-up:
  losing the token loses the town, which Settings says in one plain
  line beside the save download, the remedy.
- **The director door.** The visit actions (`visitstate`, `visitdirect`,
  `visitcomposing`, `visitframeget`, `beginvisit`, `endvisit`;
  `server/src/visitActions.ts`) read and direct one visitor's slate face,
  held in memory per visitor (`web/src/slates.ts`; nothing in a visit is
  ever persisted). They are admitted only with the service's
  `DIRECTOR_TOKEN` in `x-director-token` beside the visitor's token in
  `x-visitor-token`, and refused quietly, as an unknown action,
  otherwise. The visitor's client feeds the same face through the Task 7
  bridge routes on its own origin, with its visitor token as the bearer;
  while hosted, the client's bridge leg defaults to that door, and an
  owner-entered Live Bridge address still wins.
- **Postcards** live in the visitor's schema (`town_blobs`) and reach the
  browser by signed paths (`web/src/blobStore.ts`); saves carry them as
  attachments, as they always have.
- **PWA.** `web/build.ts` writes the manifest, the icons (drawn at build,
  nothing licensed) and a versioned service worker: the app shell and the
  small hashed files precached at install; models, textures and postcards
  cache-first on first use; action calls never cached; the old cache
  retired on activation. Installable and full screen. No offline play:
  the town's state lives on the server.

## Deploy checklist (the owner's steps)

1. In the Railway project, add a **PostgreSQL** service (New → Database → PostgreSQL).
2. Add a new service from this GitHub repository, **beside** the bridge, not inside it.
3. In that service's settings leave **Root Directory** at `/` and set **Config Path** to `/web/railway.toml` (the Dockerfile builds from the repository root because `client/`, `server/` and `shared/` live outside `web/`).
4. Variables: `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (a reference to the database service); `DIRECTOR_TOKEN` → a long random string (`openssl rand -hex 32`); `TOWN_SECRET` → another. Railway sets `PORT`.
5. Deploy: push to `main`, or from a local checkout `railway link` to the service and `railway up`.
6. Networking → Custom Domain → `town.reseed.net`; add the CNAME Railway shows at the DNS host; wait for the certificate.
7. Verify: `curl https://town.reseed.net/healthz` answers `{"ok":true}`; open the town, play, reload, and install it from the browser menu.
8. The director: in the bridge service set `DIRECTOR_CHANNEL=town`, `TOWN_URL=https://town.reseed.net`, `DIRECTOR_TOKEN` (the same value as the town's) and `VISITOR_TOKEN` (the owner's own visitor key, shown under Muse Visits in the town's Settings). See `bridge/README.md`.

What never enters this repository: `DATABASE_URL`, `DIRECTOR_TOKEN`, `TOWN_SECRET`, any visitor token.

## Run and test locally

- `bun run build:web` builds `web/dist` (client under `web/dist/client`, server at `web/dist/server.js`). The Tailwind plugin carries a native module; on a machine whose checkout cannot map shared objects, set `MUSE_TAILWIND_PLUGIN` to a copy of `node_modules/bun-plugin-tailwind/index.js` elsewhere.
- `DATABASE_URL=postgres://… bun run start:web` serves on `PORT` (8080 by default). The door opens only with `DIRECTOR_TOKEN` set.
- `bun run test:pg` runs the action layer, the isolation proofs and the HTTP surface against an in-process Postgres (pglite); `bun run test` runs both suites.
- Licensed assets are not in this checkout (`ASSETS.md`); the web build needs them in `client/src/assets/` like the artifact build does.

## Footprint

Hobby is a $5/month minimum that includes $5 of usage; the town service
is one small Bun process (memory about $10/GB-month), and the Postgres
service is metered on top (a lone database was estimated near $18/month
in March 2026 sources; verify at railway.com/pricing). Egress is about
$0.05/GB, and the scene's models are the heavy first load the service
worker exists to cure.

## Launch gate

Standing from the public edition's charter: the deployment may go up for
the owner's own verification, but the town is not linked, announced or
posted anywhere until the asset and model licences are verified. The web
serves the commercial model and texture files to every browser as raw
files, nearer redistribution than an embedded APK, so that check comes
first. `CLAUDE-TASKS.md` records when it is done and by whom.
