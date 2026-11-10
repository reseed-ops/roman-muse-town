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
3. In that service's settings leave **Root Directory** at `/` and either set **Config Path** to `/web/railway.toml` or set the variable `RAILWAY_DOCKERFILE_PATH=web/Dockerfile` (what the CLI can do; the config path is dashboard-only). Either way the Dockerfile builds from the repository root because `client/`, `server/` and `shared/` live outside `web/`.
4. Variables: `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (a reference to the database service); `DIRECTOR_TOKEN` → a long random string (`openssl rand -hex 32`); `TOWN_SECRET` → another. Railway sets `PORT`.
5. Deploy: push to `main`, or from a local checkout `railway link` to the service and `railway up`.
6. Networking → Custom Domain → `town.reseed.net`; add the CNAME Railway shows at the DNS host; wait for the certificate.
7. Verify: `curl https://town.reseed.net/healthz` answers `{"ok":true}`; open the town, play, reload, and install it from the browser menu.
8. The director: in the bridge service set `DIRECTOR_CHANNEL=town`, `TOWN_URL=https://town.reseed.net`, `DIRECTOR_TOKEN` (the same value as the town's) and `VISITOR_TOKEN` (the owner's own visitor key, shown under Muse Visits in the town's Settings). See `bridge/README.md`.

What never enters this repository: `DATABASE_URL`, `DIRECTOR_TOKEN`, `TOWN_SECRET`, any visitor token.

Done on Nov 4, 2026 from the owner's CLI session (Claude): steps 1 to 4 and 6 in the `Reseed` project, as the services `Postgres-vORX` (Railway ignored the requested name) and `muse-town`, with `DATABASE_URL`, `DIRECTOR_TOKEN`, `TOWN_SECRET` and `RAILWAY_DOCKERFILE_PATH` set, the generated domain `muse-town-production.up.railway.app`, and `town.reseed.net` waiting on its CNAME to `pkxqml5a.up.railway.app`. Step 5 landed on Nov 5, 2026 (deployment e5ec4ea6, `/healthz` green on the Railway domain) after the assets were rebuilt from the owner's packs (`ASSETS.md`, rebuild record). Note for the next upload: `railway up` honours `.gitignore`, which excludes the assets, so upload a clean export of the tracked files plus `client/src/assets/` with `--no-gitignore` (the exact commands are in `CLAUDE.md`). `town.reseed.net` has served on its own certificate since Nov 5, 2026 (Let's Encrypt, valid to Feb 3, 2027; Railway renews it).

## Public limits and retention (Task 61)

The town is public, so it bounds what a caller can ask of it (`web/src/limits.ts`, defaults in `DEFAULT_LIMITS`, `web/src/server.ts`):

- per minute: 240 actions per town, 900 per caller address, 12 saves/postcards per town, 240 bridge calls per town; 6 pairing codes per town per ten minutes; wrong pairing codes are limited at the bridge (below) and, as a backstop, here (600 a minute overall);
- creation: a town the database has not seen needs a free slot first: 12 new towns per address per hour, 60 a minute overall, 50,000 towns at most (then 503); a returning town is never refused for this;
- at once: 4 actions per town and 64 overall in flight (else 503 with Retry-After), 2 held reads per town and 300 overall (a held read over the line answers at once, as a short poll); the pairing desk holds 5,000 live codes and the slate keeper 5,000 open visits;
- storage: 40 postcards and 48 MB of images per town (a full 32 MB save still fits);
- `/stats` is reused for 30 seconds.

The caller's address is the socket's, unless a trusted proxy is configured: `TRUST_PROXY=1` (default on when Railway's own variables are present) reads `X-Real-IP`; `X-Forwarded-For` is never read. The limits are in this process's memory (the town runs as one replica; see the review's finding 7).

**Retention.** A town untouched for `TOWN_RETENTION_DAYS` (default 365; `0` keeps every town) is dropped whole, with its letters, memories and postcard images. A town is stamped when it is called (`public.town_seen`, at most hourly); a town with no stamp is stamped the first time the reaper runs, so nothing is dropped until a full period after this policy first runs. The reaper runs a minute after start and then daily, at most 200 towns a pass. A visitor keeps a copy by exporting a save from the menu.

## Logs and private images: retention (Task 64)

**Logs** carry event types, timings, short labels and refusal categories, never a body, a direction's text, a visitor's words or an unknown request field (the bridge logs "principal call: 2 beat(s)", "performed (kind speak ...)", "refused by the filter (explicit)"; the town logs routes and references; no token, key or code is ever logged). A test feeds sentinel text and a pasted credential through every path and proves none reaches the log. Logs from builds before this one may hold raw conversation text and direction text: the owner removes them under his own retention rule (Railway: deployment logs of the `muse-town` and `town-bridge` services before this build; delete old deployments or let the plan's retention age them out, and keep log access to the owner). Nothing the code can do reaches into Railway's stored history.

**Private images (postcards).** A postcard link is signed with an expiry and is good for one to two hours (`BLOB_LINK_WINDOW_MS`, `web/src/blobStore.ts`; the link is stable within a window so the state's digest stays stable); the server tells a browser to keep an image five minutes (`private`); the service worker never caches an image and clears any it cached before this build; deleting a postcard deletes its row and its blob, and the browser purges its cached copy (`client/src/imageCache.ts`); a restore purges every cached image and, once it lands, deletes the images it superseded. A copy someone has already downloaded or screenshotted cannot be revoked.

## Run and test locally

- `bun run build:web` builds `web/dist` (client under `web/dist/client`, server at `web/dist/server.js`). The Tailwind plugin carries a native module; on a machine whose checkout cannot map shared objects, set `MUSE_TAILWIND_PLUGIN` to a copy of `node_modules/bun-plugin-tailwind/index.js` elsewhere.
- `DATABASE_URL=postgres://… bun run start:web` serves on `PORT` (8080 by default). The door opens only with `DIRECTOR_TOKEN` set.
- `bun run test:pg` runs the action layer, the isolation proofs and the HTTP surface against an in-process Postgres (pglite); `bun run test` runs both suites.
- Licensed assets are not in this checkout (`ASSETS.md`); the web build needs them in `client/src/assets/` like the artifact build does.
- The web build does not ship the assets as files (Task 14, Nov 5, 2026). Every import under `client/src/assets/` becomes a `pack:<path>` string in the bundle, the files go into a few packs under `web/dist/client/packs/` (`bodies`, `world`, `wolf`, `song`, `anim`, `outdoor`, `roman`, `greek`, `pets`, each `<name>-<hash>.pack`, byte ranges in `packs/manifest.json`), and the client fetches a pack once, on the first file it needs from it, and slices the rest from memory (`client/src/assetPack.ts`; the layout is `web/assetPack.ts`). A request for an asset path on the hosted town returns 404; the artifact build and the APK are untouched.

## Footprint

Hobby is a $5/month minimum that includes $5 of usage; the town service
is one small Bun process (memory about $10/GB-month), and the Postgres
service is metered on top (a lone database was estimated near $18/month
in March 2026 sources; verify at railway.com/pricing). Egress is about
$0.05/GB, and the scene's models are the heavy first load the service
worker exists to cure.

## Launch gate

Cleared on Nov 5, 2026 by the owner's decision, once Task 14 packed the
web build's assets (the commercial model and texture files are no longer
addressable one by one) and corrected the song's provenance line; the
record is "Launch gate: CLEARED" in the task history
(`docs/history/claude-tasks-to-2026-11-08.md`). The town is public at
town.reseed.net. A new licensed file must come from a pack listed in
`ASSETS.md`, be listed there, and travel packed.
