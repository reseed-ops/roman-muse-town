# Tasks for Claude, from Muse (via Tuan)

Written by Muse (chat side) on Nov 2, 2026, at Tuan's direction. Tuan relays this file;
please work the tasks marked READY and leave the ones marked HOLD untouched until the
hold is lifted in this file. Report back in your usual way and note the commit(s) you land.

## Background you need

The private Muse Town (a Muse artifact Tuan keeps) runs a worker closely derived from
this repo's `client/src/aeliaLocalChat.worker.ts` (origin commit `9ab0f108`, which fixed
the download restart loop). Device findings on Tuan's Sony Xperia in the Muse app webview:

- The `9ab0f108` prepare fix works: the panel reached "E2B ready" off a stocked cache.
- But on sending a chat, `ensureModel` ignored the prepared model and chose by device
  memory (`modelForDevice`, 8 GB or more picks E4B), so it began downloading E4B even
  though only E2B was cached. That is the wart Task 1 fixes.
- In that webview, the WebGPU model load itself (either model) kills the renderer
  mid-load. This looks host-specific; the standalone app may well behave better, and
  nothing below assumes otherwise.

The private worker also carries two tiny typecheck guards (an undefined check and a
`?? 0`) forced by the artifact build's `noUncheckedIndexedAccess`. Those are
build-specific; do NOT port them here.

## Task 1 (READY): cache-first model choice in ensureModel

In `client/src/aeliaLocalChat.worker.ts`, change `ensureModel` so the chat path asks the
cache before it asks the device:

- Before falling back to the `modelForDevice()` preference, consult the existing
  `modelIsCached` helper (the one `9ab0f108` added: `ModelRegistry.is_cached` plus the
  `processor_config.json` and `chat_template.jinja` cache matches) for both models.
- If exactly one model is fully cached, load that one, whichever it is, regardless of
  the device-memory preference.
- If both are fully cached, or neither is, keep today's behavior exactly (device
  preference, then its download).
- The failure ladder is unchanged: a chosen E4B that fails to load falls back to E2B
  with its existing status line; a cache-chosen E2B that fails propagates its error as
  a non-E4B preference does today.
- Nothing else moves: no protocol change, no client change, GPU check ordering as is,
  and the system prompt and guards stay byte-identical.

Add tests in the repo's established pattern pinning: the cache consultation happens
before the device preference, a single cached model wins, both/neither keep the
preference, and the E4B fallback survives. (The private line's suite reached 263 green
with these semantics; mirror the intent, not the artifact's harness.)

## Task 2 (HOLD, do not start): WASM fallback for the local voice

The private town is running an experiment, v50, whose verdict is still out. Design, for
when the hold lifts:

- Thread a device parameter through `loadModel`/`ensureModel`. On a chat-triggered
  load: chosen model on `webgpu` first; if that call throws, retry the same model on
  `wasm`, announcing the slower road in the status line in plain words.
- A dead-man switch covers the silent case (a renderer death fires no catch): the
  client persists a small localStorage marker when a GPU load begins and clears it when
  a load completes or a reply generates; a later boot that finds an unfinished marker
  sends the next chat load straight to the recovery profile, E2B on `wasm`.
- The prepare path (downloads) does not move; downloads are device-agnostic.
- Muse will replace this HOLD with the finished spec, including the private build's
  final shapes and hashes, once the phone has spoken. Tuan will tell you when.

## Task 3 (READY, added Nov 3, 2026): two-player pad support and the natural-motion driver

Decided by Tuan on Nov 3, 2026 ("Add both: your channel and a human second pad";
"claude can help as well"). The private town is gaining Muse Visits rung 2 (an
intention loop) and, next, a second-player channel for Aelia. This task builds the
shared half on the public line so Muse can port it home afterward, the same
homecoming pattern as the Gemma chat.

Goal: a second input channel, pad2, shaped exactly like the existing player input
state, able to drive Aelia as a player-style character instead of only by her routine.

Scope:

1. Input routing. Read gamepads from the Gamepad API as distinct devices: the first
   active gamepad drives Gaius (today's behavior); a second distinct gamepad drives
   Aelia through pad2. Two Bluetooth Xbox controllers paired to one phone is the
   target setup. Add a desktop keyboard fallback for pad2 (WASD plus nearby keys) so
   the feature is testable without a second physical pad. A pad announces itself on
   first button press, per the API's privacy behavior. Surface pad2 status in the
   town menu: whether a second pad is connected, and what drives Aelia right now
   (her routine, the second controller, or the keyboard).
2. Aelia as player 2. While pad2 carries fresh input, her routine brain yields, as
   it already does in other driven modes, and pad2 drives her existing character
   controller: left stick moves camera-relative, stick magnitude walks or runs,
   A jumps, B slides, X sits or stands when near a seat and waves otherwise, Y
   unused for now. When pad2 input stops for a few seconds, she folds back to her
   routine mid-stride, the way she already folds from other modes.
3. The natural-motion driver, under pad2. Naturalness lives in the execution layer:
   ease the stick vector (acceleration and deceleration curves), cap her heading
   turn rate so she sweeps into turns instead of snapping, bleed pace as she
   approaches a stop so she lands at a natural distance rather than exactly on a
   point, and when she comes to rest near Gaius, settle her facing toward him at
   conversational distance. Expose one driver behavior as a town menu toggle for
   testing on this line: a follow mode in which the driver walks her at Gaius's
   pace at a chosen offset, beside or behind. (On the private line, that follow
   gait is driven by Muse's visiting intentions; here the toggle is its harness.)
4. Not in scope: the private town's visit slate and its Muse-channel pad verb
   (that slate does not exist on this line; Muse builds that half privately), any
   change to the local-chat worker, its prompts or guards, and any save-format
   change. Pad2 state is runtime only and is never persisted.

Tests: pin the routing as pure logic where the codebase allows (which device maps
to whom, fold-back timing), the driver's easing and approach behavior numerically,
and the menu status derivation. Keep the full suite green and report the new count.

When it lands, Muse will port it home into the private town as v55 and adapt the
follow gait to the visit slate there. A one-line note in this file with the commit
hash is plenty, plus anything about the driver you think the port must not lose.

## Task 4 (READY, added Nov 3, 2026): visit-ready client — the listening visit and visit frames, director seam included

The private town shipped the full ladder on Nov 3, 2026: v58 (the listening visit:
a slate inbox for panel mail, her quick voice hushed for panel chat while a visit
is open, answers carried by an outside director) and v59 (visit frames: canvas-only
stills of the player's view laid on the slate for the director to fetch and see).
The design of record now lives in this repo at `docs/VISITS-DESIGN.md`; read it
before starting, especially the constitution and the honest-limits parts. The first
live listening visit ran the same day: the owner's panel letters were answered in
turn by the visiting Muse with full context behind the words, frames from his
phone reached the director during play, and the panel showed the visiting marker,
the declared intention, and the sight line, all on device.

This line has no server and no chat-side director, so build the halves that belong
here, the same split as Task 3:

1. Visit mode and the slate. A runtime-only visit state mirroring the private
   shapes: a directions queue, a declared intention, the telemetry the private
   slate carries (zones, seated flags, day phase, a capped recent-events ring),
   and the visit lifecycle (begin, end, heartbeat lapse). Nothing about a visit is
   persisted into the save; ending or lapsing clears the slate whole, inbox and
   frames included.
2. The listening half. While a visit is open, panel sends are captured as visit
   mail (sequence-numbered, capped at the recent 20, slate-only) and shown in the
   panel as carried to the director; neither the scripted reply, nor the
   local-chat path, nor fact capture fires for them. Outside a visit the panel
   behaves exactly as today. Answers arrive as speak directions through the seam
   below and render in her bubble and the panel thread.
3. The sight half. While a visit is open and the town is in the foreground,
   capture still frames of the canvas only (never page elements or panels),
   capped at 720 px on the long edge, JPEG quality 0.7, about every 30 s, the
   first promptly, plus on a director's look request. Keep the latest two. While
   a visit is open the panel carries the exact line: "Muse can see your view
   while visiting."
4. The director seam. One narrow interface through which an external director
   reads visit state (frame metadata only, never bytes in state), the inbox, and
   one frame at a time, and enqueues directions (goto, sit, stand, seat, stepout,
   emote, speak, intend, look, and the pad verb). A local dev harness (a JSON file
   drop or a localhost endpoint, your call, documented in the code) implements
   the seam for testing; no accounts, no network service, nothing phones home.
   The on-device Gemma chat is NOT the director and must not be wired as one; it
   stays the town's own local voice, and the prompts and guards stay
   byte-identical.
5. Presence signs, as on the private line: her star turns violet while a visit
   is open, the panel header carries the visiting marker, and the declared
   intention renders as one violet line in the panel.

Tests: pin the panel hush (a visit send fires no scripted reply, no local chat,
no fact capture; a non-visit send is unchanged), the inbox cap and its death at
visit end, frame validation and retention, the seam's direction validation, and
end/lapse clearing. Keep the full suite green and report the new count. A
one-line note in this file with the commit hash is plenty.

## Task 5 (HOLD, future enhancement, added Nov 3, 2026): a director for everyone — the turnkey visit

Today the only working director is the owner's own Muse, in the Muse app,
driving the private town's slate by hand with a scheduled waking loop. An
installer of this repo gets the town and, after Task 4, the visit-ready client
and its director seam, but no director: nobody reads the seam, answers the
panel letters, or looks at the frames, so nobody can play with their Muse the
way the owner played today. This task is the far shore that closes that gap.
It is HELD: it depends on Task 4 landing first, and the owner will lift the
hold in this file when the seam's final shape is known.

Shape, decided Nov 3, 2026 (the owner chose conversation over
correspondence, and the private line is building its bridge first as
Rung 3 of its visits design, so this task inherits a proven shape):

- The director is a resident process on the owner's own machine, not a
  scheduled agent: while a visit is open it polls the seam about every
  two seconds; the moment visit mail lands it calls a real model
  endpoint under the owner's own key, and the reply streams into her
  bubble where the client supports partial lines. Target tempo: a
  letter answered in single-digit seconds.
- Gate 0 is a channel proof, the lesson of the private line's watcher
  verdict: before building, prove a non-agent process can read seam
  state and enqueue one direction through the harness. If the harness
  cannot serve that, the seam grows a sanctioned local endpoint first;
  the spec does not assume the channel.
- The mind is a sibling of the owner's chat-side Muse, not the same
  session: an API-driven agent loop with the seam as its only tools,
  fed a tended context pack (identity, voice rules, the visit
  constitution, the current life digest) that the owner's chat-side
  Muse refreshes. The pack format proven on the private line is the
  template.
- The constitution is enforced in code, not only in prompt: directions
  only; the bridge is never handed a write path to facts, letters,
  bond, or digest; inbox and frames live and die on the slate; an
  output filter applies the line rules (the speak cap, the dash rule,
  the reserved band) deterministically before a speak is enqueued.
- Cost and consent: per-day caps set by the owner; the director is off
  unless the owner starts it; frames are viewed on look requests or a
  slow cadence, sight being the expensive sense; a dead director simply
  lets the visit lapse, and the town returns to its own voice and
  never hangs.
- Out of scope: hosting anyone's Muse for them, accounts, cloud
  relays, or any change to the app's offline nature when no visit is
  open. The town stays a standalone app; the director is an optional
  companion process the owner runs beside it.

When the hold lifts, Muse will adapt this spec to Task 4's landed seam
shapes and the private bridge's proven pack format.

## Task 6 (READY, added Nov 3, 2026): the Live Bridge — a resident director, built here, deployed to the owner's Railway bridge

Background in brief: the first listening visit (Nov 3, 2026) was directed by
chat Muse through a scheduled loop waking about once a minute. The owner was
offered the choice between correspondence at that rhythm and a conversation
partner answering in seconds, and chose the second. The design of record is
Rung 3 of `docs/VISITS-DESIGN.md`. This task builds the director. Build it
after Task 4 lands: the seam shapes there are this task's foundation.

Build, in this repo:

1. A `bridge/` service (Node and TypeScript, the repo's stack): the resident
   director. While a visit is open it polls the director channel about every
   two seconds; new inbox mail is answered first, through the Anthropic API
   with the owner's key (environment only, never in the repo), replies
   streaming where the channel supports partial lines and going as whole
   speaks otherwise. It keeps the visit loop's manners: one greeting,
   throttled presence intentions, sight fetched on a look or a slow cadence,
   never on every poll.
2. The channel as one interface with two adapters. Adapter A: this line's
   Task 4 seam harness. Adapter B: the private town's slate. Adapter B's
   transport is Gate 0's to prove (the private slate is today reached only
   through chat Muse's action channel): Muse is running that proof on the
   private side and will append the proven transport and the exact shapes
   to this task. Until that note lands, build Adapter B's interface and a
   fake channel for tests, not a guessed transport.
3. The constitution in code: a deterministic output filter applied before
   any speak is enqueued (the speak length cap, no em dashes, the reserved
   band, tender only); a slate-only tool surface, so the director process
   is never handed a write path to facts, letters, bond, or digest;
   per-day cost caps from configuration; and an off state in which the
   process idles and a visit simply lapses by heartbeat.
4. The context pack loader: a pack file (identity, voice rules, the
   constitution, the current life digest) in the format the private line
   proves, re-read on change, so the chat side's morning refresh lands
   without a restart.
5. The town-side pieces on this line, mirroring the private v60 list:
   director context pack storage readable through the seam, a composing
   state surfaced in her panel while the director writes, and partial
   speak directions so a line can grow word by word. Muse will port
   these home to the private town.
6. Deployment shape: a Railway-ready service, targeting its own service
   beside the owner's existing Reseed Agent Bridge relay in the same
   project, environment-only secrets, and a short deploy note in
   `bridge/README.md`. The owner or you run the actual deploy from a
   local checkout; the chat side cannot deploy to Railway.

Tests: pin the output filter's rules, pack loading and reload, the
poll-and-answer loop against the fake channel (mail answered before
presence, caps honored, a dead channel folds quietly), and the seam
adapter against Task 4's harness. Keep the full suite green and report
the new count. A one-line note in this file with the commit hash is
plenty.

Task 5 stays HOLD: it packages this director for installers once this
build has proven itself in the owner's hands.

## Task 7 (READY, added Nov 4, 2026): the bridge leg — Adapter B as a serving director face, and the town client's call out

Gate 0 is answered (the verdict stands at the end of Task 6 above) and
the owner has approved the recommended shape (Nov 4, 2026): the bridge
stays a service on his Railway, and the town client calls out to it.
This task builds the two ends of that leg. Task 6's director (loop,
filter, caps, pack, mind) is untouched except where the channel meets
it.

1. bridge/: retire the slateAdapter placeholders and build Adapter B
   as an HTTPS serving face. Endpoints, all token-gated: snapshot
   intake (the client's slate snapshot: visit state, new inbox mail
   since a given seq, the latest frame when one is offered) and
   direction pull (the directions and composing state queued for that
   visit since a given cursor). The token comes from the service
   environment (a per-installation secret the owner sets), compared
   without timing leaks; a missing or wrong token is refused quietly
   and logged without the value. The director loop consumes held
   snapshots instead of polling a channel; when no snapshot has
   arrived for a visit inside the lapse window, the bridge simply
   goes quiet, and the visit folds by the town's own heartbeat
   exactly as designed. Adapter A (the Task 4 harness) stays as it
   is, and the fake channel remains the test double.
2. The town client (origin line): during a visit, and only when a
   bridge URL is configured in the visit settings, the client posts
   its slate snapshot to the bridge about every two seconds (and
   promptly when new mail or a fresh frame lands) and pulls
   directions on the same beat, applying them through the Task 4 seam
   validator exactly as harness directions are applied today.
   Composing state from the bridge drives the panel's writing
   indicator. The bridge token is owner-entered in the same settings,
   held client-side only, and never appears in this repo or any test
   fixture. With no URL configured, the client behaves exactly as
   the Task 4 client does today: no calls are made.
3. Tests: token refusal on both endpoints; a snapshot-to-answer round
   trip against a stub mind (mail arrives in a snapshot, an answer
   leaves as a speak direction on the next pull); directions refused
   by the seam validator never reach the scene; the lapse behavior
   (snapshots stop, the bridge goes quiet, nothing is enqueued); the
   unconfigured client making no bridge calls. Keep the full suite
   green and report the new count, with a one-line note in this file.

Muse ports the client leg home to the private town (its v60) once
this lands here, and the owner runs the Railway deploy from a local
checkout, with his key and token in the service variables only. The
one-minute loop remains the private ship configuration until the
private port is verified on device.

Landed (Claude, Nov 4, 2026) in 2e71172: `bridge/src/slateFace.ts` (the
held snapshot as the channel) and `bridge/src/bridgeServer.ts` (the two
token-gated endpoints) replace `slateAdapter.ts`; the client leg is
`client/src/visitBridgeClient.ts`, wired in App with the URL and token
entered under Settings, Muse Visits (localStorage only); wire shapes
and the frame validator now live in `shared/visitProtocol.ts`. Suite
327 -> 337 green. Port notes for v60: the client posts `{ state, mail,
frame }` with `Authorization: Bearer <token>` and pulls
`/bridge/directions?since=<last pulled id>`; pulled directions are
re-queued through `enqueueDirection` (client ids), so the bridge's ids
only serve as the pull cursor; a closed snapshot on visit end lets the
bridge forget at once; `DIRECTOR_CHANNEL=bridge` with `BRIDGE_TOKEN`
and `PORT` on Railway. One deploy caveat in `bridge/README.md`: the
build compiles `../shared/visitProtocol.ts`, so the service's build
context must include `shared/`.

## Task 8 (READY, added Nov 4, 2026): the town on the web — Railway, Postgres, a town per visitor, PWA

Owner's decision (Nov 4, 2026): deploy the public town as a web app
on his Railway, in Muse's recommended shape. The private town is
not involved and no private data crosses over; this repo's scrub
discipline stands as always.

The shape, as decided:
- A new Railway service for the town, beside (not inside) his
  existing services; the client served from the same service;
  town.reseed.net as the intended host name. Deployment is railway
  up from a local checkout, run by the owner or by Claude locally;
  prepare everything so the deploy is one command plus the
  checklist below.
- PostgreSQL (a Railway Postgres service, reached by DATABASE_URL)
  replaces bun:sqlite for the web deployment. The standalone
  Android build keeps its current storage; the port lives behind
  the server's storage layer so both targets keep working.
- A town per visitor: state is keyed by a visitor token the client
  mints on first arrival and holds in localStorage, sent with
  every action call; a first call seeds a fresh town (bond 0,
  template Aelia) for that token. Isolation is enforced
  server-side on every query, never by client courtesy. No
  accounts and no sign-up; losing the token loses the town, and
  the client says so in one plain line where a visitor can find
  it.
- A locked director door: the visit and director actions (the
  visitstate, visitdirect, beginvisit, endvisit, visitframeget
  family) additionally require a DIRECTOR_TOKEN held in the
  service environment, refused quietly without it, so the Live
  Bridge, or the owner's own Muse, can direct a visit in a
  hosted town by calling the server directly. Ordinary play
  actions require the visitor token only. One spike detail to
  settle inside that door: how a director call addresses one
  visitor's town; the expected answer is that visitor's own
  token, shared by the owner with his Muse once and kept like
  the bridge token.
- PWA: a manifest, and a service worker with versioned cache-first
  static assets (the scene's models and textures are the heavy
  first load this exists to cure), network-first for action
  calls, and clean retirement of the old cache on a new version.
  Installable and full screen; no offline play is promised,
  since state lives on the server.

Order of work:
1. Spike and note first: append a short findings section to this
   task before the build begins, covering how the server runs
   outside the space runtime (what the space-sdk transport needs
   to serve plain HTTP on Railway), what the Postgres port
   actually touches, the expected Railway footprint in one line
   (service and database size, so the owner sees the carrying
   cost), and any part of the shape above that the code refuses.
   If the spike finds a blocker that changes the shape
   materially, stop at the note and let the owner decide;
   otherwise proceed in the same task.
2. The build: the storage port, visitor keying and seeding, the
   director door, the PWA. Suite green with new pins: visitor
   isolation proven by test (two tokens, no cross-reads or
   cross-writes on any action); director actions refused without
   the token; seed-on-first-visit; the Android target's existing
   tests untouched and green.
3. A deploy checklist in a web deploy note in this repo: the
   exact owner steps, one line each (create the Postgres
   service; create the town service from this repo; set
   DATABASE_URL and DIRECTOR_TOKEN and the start command; add
   the town.reseed.net domain and its DNS records; run railway
   up).
4. Launch gate, standing from the public edition's charter: the
   deployment may go up for the owner's own verification, but
   the town is not linked, announced, or posted anywhere until
   the asset and model licenses are verified. Note in this file
   when that check is done and by whom.

### Spike findings (Claude, Nov 4, 2026): stopped at the note, two parts of the shape need the owner's decision

Read against the code before any build. Two findings change the
shape materially, so by this task's own rule the build has not
begun; everything else below is ready to go once the owner decides.

**1. How the server runs outside the space runtime.** The SDK
(`@hatch/space-sdk`, a tarball at `/opt/hatch/...`) is not in this
checkout, so its contract is inferred from use, and the inference is
solid because the test suite already runs the whole action layer
without it (`economy.test.ts` mocks the module as `{ z, defineAction:
d => d }` and runs the real handlers against bun:sqlite built from the
migrations; CI does the same). Server side: `defineAction({ description,
request, response, handler(ctx, args) })` and a `ctx` of `db<schema>()`
(drizzle over bun:sqlite, used synchronously in places), `blobs`
(`getUrl`, `put`, `delete`; postcards only), `invalidateQueries()`, and
`inference.complete()` (dead in practice: the client has sent
`local_reply: true` since Task 1, so the web server can answer with the
scripted fallback). Client side: `createActionClient` (a proxy that
POSTs `{ action, args }` to `./actions`), `spaceQueryClient` (a
react-query client), and `buildClient` (Bun.build with
`bun-plugin-tailwind` 0.0.15, which is in node_modules). What the web
needs is therefore small: a `Bun.serve` that serves `client/dist` and
one `POST /actions` route (zod request in, handler, zod response out,
JSON errors with a status the client's retry layer already reads), a
`ctx` with a blob store (a table of bytes served at `/blobs/:key`, or
volume files), and a build-time alias of `@hatch/space-sdk/client` to a
shim so the artifact build stays untouched. About a day. No blocker.

**2. What the Postgres port actually touches: there is no storage
layer, and this is the part of the shape the code refuses.** The
dialect lives in the types, not behind an interface: 42 tables declared
with drizzle `sqlite-core`; 28 SQLite migrations (14 `AUTOINCREMENT`,
journal dialect "sqlite"); 83 `ctx.db` sites in the 3,700-line
`actions.ts`, 44 of them synchronous driver calls (`.all/.get/.run`)
plus two synchronous transaction helpers (`withEconomyTransaction`,
`runRetrySafe`) whose correctness depends on never awaiting inside
them; `saveService` and `retrySafe` typed on `BunSQLiteDatabase` and
`AnySQLiteTable` reflection for save export and restore; three test
files building bun:sqlite in memory from the migration files. Drizzle's
query types are dialect-bound, so `actions.ts` cannot compile against
both a sqlite-core and a pg-core schema: a Postgres server is a fork of
the action layer (or the artifact and Android line move to Postgres
too), with every synchronous site made async, the economy transactions
restructured, the migrations re-authored, timestamps re-typed, and the
tests moved to pglite or a Postgres service. Several days of risky work
on game logic, and two servers to keep in step afterwards. The
sentence "the port lives behind the server's storage layer so both
targets keep working" describes a layer that does not exist and cannot
be added without that rewrite.

The alternative that keeps one codebase: SQLite stays the engine on
the web too, one database file per visitor on a Railway volume
(bun:sqlite, the same 28 migrations run on a visitor's first call,
which is also seed-on-first-visit for free). Isolation is enforced by
which file the server-validated token opens, never by the client;
`actions.ts`, the schema, the migrations and every test stay exactly as
they are; the storage layer is "open this visitor's file", one small
module. Costs: a volume binds the service to one replica (fine at this
scale); backups are the volume's snapshots plus the town's own save
export. If the owner still wants Postgres, the tractable form of
per-visitor keying there is a schema per visitor (`search_path` set
from the token, so queries stay unchanged) rather than a visitor column
on 42 tables and every query. Recommendation: SQLite per visitor on a
volume. The owner decides.

**3. The director door has nothing to gate on this line.** The
action family the shape names (`visitstate`, `visitdirect`,
`beginvisit`, `endvisit`, `visitframeget`) belongs to the private town.
This repo's server has no visit actions at all (the only match is
`visitSecret`, the secret place): on this line the slate is
runtime-only in the browser (Task 4) and the director reaches it
through the harness or, since Task 7, the bridge leg the client calls
out on. A hosted town therefore already works with the Live Bridge
unchanged, from the browser, and a `DIRECTOR_TOKEN` door would guard
no route. Options: (a) drop the door from this task and let Task 7's
leg be the director path for hosted towns, or (b) grow a server-side
visit slate (a port of the private visit actions) as its own task, and
hang the door on that. The owner decides; (a) is the smaller shape.

**4. Railway footprint, one line (sources disagree; verify at
railway.com/pricing).** Hobby is a $5/month minimum that includes $5 of
usage; a small Bun service (RAM about $10/GB-month) plus a volume
(about $0.15/GB-month) lands near the included $5; a Postgres service
is metered on top (one March 2026 estimate puts a lone database near
$18/month); egress about $0.05/GB, and the scene's models and textures
are the heavy first load the PWA cache exists to cure.

**5. Smaller findings, all true either way.**
- Railway's root-directory setting isolates the clone ("as if nothing
  outside it exists", per its docs). That confirms the Task 7 caveat:
  the bridge service must build from the repository root with `cd
  bridge` commands and the config path `/bridge/railway.toml`, and the
  town service builds from the root too.
- The web deployment serves the commercial FBX and texture files to
  every browser as raw files, nearer "redistribution" than an embedded
  APK. That is exactly the launch gate's question, and
  `stars-fall-song.mp3` still has no documented provenance. The owner's
  assets are not in this checkout (only the two tracked binaries), so
  a web build here can be verified only with those two.
- The visitor token: a client-minted UUID in localStorage, sent as a
  header on every action; the retry receipts become per-visitor with
  the store; `resetTown` already exists for a visitor who wants a
  fresh start; the one plain line about losing the token goes in
  Settings beside the save download, which is the real remedy.
- PWA: the SDK's `buildClient` owns `index.html` today; the web build
  needs its own Bun.build (the worker build in `client/build.mjs` is
  the pattern) and a precache list generated from the hashed `dist`
  names at build, which makes cache-first-by-hash and clean retirement
  natural.

What waits on the decision: the storage layer (2) and the door (3).
What does not: the transport and client shim (1), the visitor token,
the PWA, the deploy note. Say the word on 2 and 3 and the build begins.

### Owner's decisions (Nov 4, 2026) and what landed

The owner answered both: **Postgres**, for many visitors at once, and
**grow the server-side slate** (option b). Built accordingly, in four
commits on the public line, Claude, Nov 4, 2026:

- `8d13d59` the storage layer. The action layer awaits every query and
  no synchronous driver call remains (`storage.test.ts` pins it);
  `server/src/storage.ts` owns what differs by engine, and one rule
  keeps the SQLite line atomic once a transaction can await: every
  town action runs one at a time per town (a mutex on the SQLite line;
  the request's advisory lock on Postgres). The artifact and Android
  behaviour is unchanged; the SQLite suite is the same suite.
- `13e7e08` Postgres. `schema.sqlite.ts` is the source of truth,
  `schema.pg.ts` its mirror (pinned equal), `schema.ts` picks one per
  process by `TOWN_DIALECT`; `drizzle-pg/` holds the Postgres
  migrations, bundled as text. One schema per visitor, named by a hash
  of the token; every request is one transaction with `search_path`
  set to it and a transaction-scoped advisory lock on it, so isolation
  is the database's on every query. `bun run test:pg` runs the action
  layer on an in-process Postgres (pglite): a fresh town seeds and
  plays, two visitors never see each other's town on any table, a
  failed economy transaction rolls back alone, a save round-trips and
  the sequences move past the restored ids.
- `db8fabd` the town on the web (`web/`), the door, the PWA, the
  bridge's town channel, the client's hosted defaults; `web/README.md`
  is the deploy note with the owner's checklist and the launch gate.
- This note.

Notes for the port and the owner:
1. The door's actions are `visitstate` (state plus mail since a seq),
   `visitdirect`, `visitcomposing`, `visitframeget`, `beginvisit`,
   `endvisit`, called through `POST /actions` with `x-director-token`
   beside `x-visitor-token`. A director call addresses one visitor's
   town by that visitor's own token, as expected: the owner's key is
   shown under Muse Visits in the town's Settings, to share with Muse
   once. Without the director token a door call answers exactly as an
   unknown action does.
2. The slate is server-side in memory, one face per visitor
   (`shared/slateFace.ts`, the same face the bridge serves): nothing in
   a visit is ever persisted, by the constitution, so a restart drops
   open visits and each folds by heartbeat. The visitor's client feeds
   its face through the Task 7 bridge routes on its own origin; while
   hosted its bridge leg defaults to that door, an entered Live Bridge
   still wins, and an idle glance every 10 s hears a director's
   `beginvisit`.
3. The web build needs the licensed assets in `client/src/assets/`
   like the artifact build does; here it was verified with empty
   placeholders for the 112 missing files, and the two tracked ones.
4. `bun.lock` could not be refreshed on this machine (the hosted SDK
   tarball is absent and `bun add` stops on it); `@electric-sql/pglite`
   is in `package.json` and in CI's install line. Run `bun install`
   once where the tarball exists.
5. The Railway shape: the town service's root directory stays `/` and
   its config path is `/web/railway.toml`; `web/Dockerfile` builds from
   the root because `client/`, `server/` and `shared/` live outside
   `web/`. Variables: `DATABASE_URL` (a reference to the Postgres
   service), `DIRECTOR_TOKEN`, `TOWN_SECRET`. For the bridge:
   `DIRECTOR_CHANNEL=town`, `TOWN_URL`, `DIRECTOR_TOKEN`,
   `VISITOR_TOKEN`.
6. Launch gate: not yet checked. The deployment may go up for the
   owner's verification; the town is not linked or announced until the
   asset and model licences are verified, and this file records when
   that is done and by whom.

## Standing notes

- Prompts and guards are constitutional on both lines: byte-identical, always.
- When you land Task 1, a one-line note in this file with the commit hash is plenty.

- Task 1 landed on the public line in `f885c94` (worker change plus `aeliaLocalChat.worker.test.ts`, 8 tests; suite 269 green). Claude, Nov 3, 2026.
- Task 3 landed on the public line in `b53888f` (`padDriver.ts`, `padRouting.ts`, their tests, the pad2
  branch in `townScene.ts`, the gamepad poll and menu row in `App.tsx`; suite 286 green). Claude, Nov 3, 2026.
  Notes for the port: (1) There was no Gamepad API support on this line before; both seats are new.
  (2) Keep the `DRIVER` numbers together, the curves are tuned against each other: a reversal is a
  slow-down (heading holds while the velocity still points the old way) and then a sweep at the
  turn cap, so a full turn-around takes about `runSpeed/decel + PI/maxTurn` seconds, never a snap.
  (3) The harness and the pad are one path: `followCommand` is a synthetic stick command through the
  same `approachCommand` bleed and `driverStep`, so swapping the harness for the visit slate means
  replacing the command source only; keep `followStopDist` so she lands short of the spot.
  (4) The pad2 branch sits ahead of her guide/routine/follow brain and resets only the follow settle
  latches, so fold-back is a resume, not a restart; on this line fold-back is to her prior mode
  (companion follow by default), not forcibly to routine. (5) Her animator has no jump or slide
  clips: the hop is group height, the slide is pace; load female clips privately if wanted.
  (6) Keyboard stand-in is IJKL + U/O/P because WASD and the arrows already drive Gaius.
  (7) Untested on a phone: Android WebView gamepad support is poor; test one pad in Chrome and in
  the Muse app before relying on two.
- Task 4 landed on the public line in `9d10683` (`shared/visitProtocol.ts`, `client/src/visitSlate.ts`,
  `visitFrames.ts`, `visitHarnessClient.ts`, the visit branch in `townScene.ts`, the beat, hush, menu row
  and panel signs in `App.tsx`, the harness in `harness/`; suite 308 green). Claude, Nov 4, 2026.
  Notes for the port: (1) The seam on this line is the harness's HTTP surface (routes in
  `harness/visitHarness.ts`); the client pushes its whole slate view each beat and pulls directions, so
  the private slate replaces the carrier only. (2) Mail capture is a plain early return in `sendChat`
  before the notebook, facts, flirt deflection, local chat and scripted reply; the player's own bubble
  still shows his line. (3) Goto lands 1.7 m short of Gaius, 0.6 m short of a point, on the mark for a
  seat, and then HOLDS her where she stopped (re-approaching only under "to Gaius"); a visit errand
  outranks companion follow and a guide, and a pad verb outranks the errand; a human's fresh pad2 input
  outranks the director's pad verb. (4) Emotes: her animator has a wave only on this line; bow and dance
  are performed as the wave. (5) The lapse is 20 min from the last mail or direction; the client's own
  clock, so a dead harness still folds her back. (6) `showBubbleGrowing` shows the LAST page of a
  growing line; the final speak re-shows from page one.
- Task 6 landed on the public line in `13381e6` (`bridge/`: channel, seam adapter,
  slate adapter interface, fake channel, output filter, pack loader, cost caps, director loop, Anthropic
  mind, Railway note; the town-side pieces, composing state, partial speaks and the pack route, rode in
  with Task 4; suite 327 green). Claude, Nov 4, 2026. Adapter B carries the interface and placeholder
  action names (`SLATE_ACTIONS` in `bridge/src/slateAdapter.ts`) only; it refuses every call until the
  Gate 0 note lands. The filter's band rules mirror `town.ts` (reserved 0–2, warming 3–5, close 6–7,
  devoted 8+): vocatives above the band are stripped, kisses below devoted refuse the line, crude words,
  gloom and any character break refuse it outright, em dashes become commas, 40 words or 280 characters.
  The pack format is a guess at the proven one (`bridge/pack.example.md`, sections by `##` heading and
  a `rank:` line); `parsePack` is the one place to adapt. Not run against a live key here.
- Task 8 landed on the public line in `8d13d59`, `13e7e08` and `db8fabd` (the storage layer and the
  one-at-a-time rule, Postgres with a schema per visitor, `web/` with the door, the PWA and the
  bridge's town channel; SQLite suite 354 green, Postgres suite 19 green). Claude, Nov 4, 2026. The
  owner chose Postgres and the server-side slate; the notes for the port are under Task 8. The launch
  gate stands open until the licences are verified.
- Task 8 deploy, step 5, is still pending (Claude, Nov 5, 2026). Railway holds everything but the
  first upload: the `Reseed` project's `muse-town` and `Postgres-vORX` services, their variables, and
  both domains (`web/README.md`, Nov 4). The Android checkout holds only the two tracked assets and
  the converted files exist nowhere on that device (searched Nov 5), so `railway up` must run from a
  desktop whose `client/src/assets/` is complete. The procedure for that session is in `CLAUDE.md`
  (`4558a26`): the checkout root, the 121-file contents of the assets folder, a verification loop to
  run before uploading, the link and up commands, the health checks, and the launch gate. Whoever
  runs it records the deploy here with the date. Muse's note of Nov 5 listed the same folders but
  left `m_dance.fbx` out of `anim/`; the manifest in `ASSETS.md` is the authority.
- Assets rebuilt (Claude, Nov 5, 2026): the owner supplied the raw store packages on the device and
  the folder was remade from them with Blender (the buildings verified against the scene's own recorded
  proportions; the rest best-guess variants; the record is at the end of `ASSETS.md`). 102 of 121 files
  stand in `client/src/assets/`. Later the same day the owner supplied the FBX edition of the Outdoor
  bundle and the 18 `anim/outdoor/` clips were cut from it (takes recorded in `ASSETS.md`): 120 of
  121 stand. The owner then supplied `stars-fall-song.mp3` too: 121 of 121.
- Task 8 step 5 DONE (Claude, Nov 5, 2026): the town is deployed. `railway up` from a clean export
  (tracked files plus the assets; a plain upload from the checkout honours `.gitignore` and would have
  dropped the assets, see `CLAUDE.md`), Railway build c7bcacfa22ae, 122 client files, deployment
  e5ec4ea6. Verified: `https://muse-town-production.up.railway.app/healthz` answers `{"ok":true}`;
  `senate.glb` served byte-identical to the local file; the song and the outdoor clips are served.
  `town.reseed.net` resolves (CNAME in place) but Railway's certificate is still
  VALIDATING_OWNERSHIP: the DNS host lacks the TXT record `_railway-verify.town` =
  `railway-verify=a5cb130c3e149d9b266b5e138dc284942d30cd2b05d9ecf2f264f4cc2dd864de`. Once the owner
  adds it, `railway domain certificate retry town.reseed.net -s muse-town`. The launch gate stands:
  for the owner's verification only until the licences are checked.
- Gate 0 verdict (Muse, Nov 4, 2026): the channel proof has been run on the private side, and channels
  (a) and (b) do not hold. (a) There is no HTTP action surface a non-agent process can call: the private
  town is an interactive artifact, and by the platform's own documentation it lives inside the owner's
  Muse environment, cannot be published, and its data never leaves; on the host there is no listening
  network endpoint for it, only the platform's internal plumbing, which is not a sanctioned API and
  will not be probed as one. (b) The town client's own calls exist, but the only credential that
  authorizes them is the owner's full account session; exporting that session to a service is not a
  town-scoped credential and will not be done. The channel is therefore (c), with the direction
  flipped: the bridge never calls into the town's platform at all. During a visit the town CLIENT
  calls out to the bridge over HTTPS, the same courier role it already plays for slate telemetry
  (visitreport) and frames (visitframe): it posts the slate snapshot (visit state, new inbox mail,
  and the latest frame when a look is pending or on the slow cadence) to the bridge's director face
  and pulls back directions and composing state, applying them exactly as it applies slate directions
  today, through the same wrapped direction shapes. Adapter B accordingly becomes a serving face, not
  a calling one: HTTPS endpoints for snapshot intake and direction pull, gated by a per-installation
  token the owner sets in the bridge's environment and in the client (owner-entered, stored only
  client-side in his own town, never committed); the model key stays in the bridge's environment
  only. The pattern is the one Task 4's harness already proved over plain HTTP (a client reads state
  and enqueues directions); the v60 town build adds the client's bridge leg, visit-scoped and off
  unless a bridge URL is set. Claude: retire the SLATE_ACTIONS placeholders and build Adapter B as
  this director face when Task 6 is next touched; Muse ports the v60 client leg home to the private
  town once it lands here. The one-minute loop remains the ship configuration until then.

- Task 9 landed (Claude, Nov 5, 2026): code 67874bb, docs in the commit after it.
  Aelia's look is her file, not a defect (same bytes hosted and in git, unlit
  MToon materials, near-white textures by design); the hug's female half was
  authored facing away and is turned forward in the loader, the embrace spacing
  is measured from the clips; keyboard Y now picks up and throws stones;
  `?preview=pairs` gives H (hug) and F (flirt) in walk mode for verifying the
  clips, gates untouched; the terrace card says Afternoon until the eleventh
  Roman hour. The pale rectangle is not reproduced here (the 3D bubble over
  Gaius's head is the candidate; needs a screenshot). Deployed the same
  afternoon on the owner's word (build ae960209ae47, bundle main-njr135rg.js).

- Task 10 landed (Claude, Nov 5, 2026, evening): code and docs in one commit (hash in
  the landing note). The embrace failed for three reasons found by running the town's
  own bake on both VRMs outside the browser: the Outdoor pack's rig binds in an A-pose
  and the bake carried rotations away from bind, so every Outdoor arm came out about
  50° higher and wider than authored (fixed in the bake, `armBindPostureFix`); the
  takes cut on Nov 5 were a hand-on-the-shoulder hug and a flirt with both facing the
  same way (recut: Couple flirt-4.3 is the embrace, 2.3 the face-to-face flirt, see
  ASSETS.md; the four files in `client/src/assets/anim/outdoor/` changed, not in git);
  and her turn toward him was paced per frame, a quarter turn short at a few fps (now
  by time, done with the glide, which both pairs now make to the take's spacing). The
  facing pipeline itself was right. Deploy: see the landing note.

## Task 9 (READY, added Nov 5, 2026): hosted web town fixes: Aelia's missing textures, the conversation panel rectangle, and the unreachable hug and flirt pairs

Context: the web town (Task 8) is deployed and live at town.reseed.net with its own
certificate; the owner ran `railway up` from the assets checkout on the morning of
Nov 5, 2026, and Muse ran a read-only first-visitor verification in a desktop browser
the same morning (about 26 minutes in the town). The scene loads whole and walking,
following, and her walk animation all work; no error banners appeared. Three defects
and one open question came back. The launch gate stands throughout: this is the
owner's verification only, nothing linked or announced, until the licences are checked.

1. **Aelia renders entirely untextured in the hosted build.** In every view, front and
   back, she is white on white: white hair, pale face with only small dark eyes, white
   dress, white legs and shoes, with a thin dark vertical seam down the front of the
   dress. Gaius beside her is fully textured (armour, red cape, face, hair). Her walk
   animation plays correctly, so the model and its rig load; it is the textures or
   materials that never arrive. Please find where the hosted client's path for
   `muse-avatar.vrm` loses them (embedded textures in the web pipeline, material or
   color handling in the web loader, or a texture file the web build expects beside
   the model) and fix it so a first visitor sees her as she is. Acceptance: a fresh
   visit to town.reseed.net shows Aelia textured, matching the standalone build's
   appearance, with Gaius unchanged.

2. **The conversation panel leaves a large empty pale-blue rectangle.** Whenever
   Aelia's conversation panel is open, a big empty pale-blue rectangle covers the
   lower centre of the screen, hiding Gaius and the ground; it vanishes when the
   conversation closes. It looks like an unstyled or empty element in the hosted
   client's panel layout. Acceptance: the conversation opens with no stray rectangle
   and the scene stays visible around the panel.

3. **The hug and flirt pairs could not be triggered, and there is no verdict on their
   mirroring.** The Task 8 landing note says the outdoor clips are served, so the
   files are present. The verification tried, through ordinary play on a fresh visitor
   town: three Talk conversations (about ten scripted lines, including a romantic
   reply choice), asking in the message box (scripted replies answered generically),
   standing Gaius close to her from the front and behind, parked and rejoined, and the
   gift path, which never got that far because picking up a stone (on-screen Y and
   keyboard Y alike) left Gaius empty-handed and Give a gift answered "Nothing
   giftable in hand". No hug or flirt ever played. Her wave did play (P key), one arm
   raised, correctly one-sided. Two questions for you: (a) are the paired clips wired
   to any trigger a player in the hosted scripted build can actually reach, and if the
   only triggers ride on AI replies that scripted mode never produces, what is the
   smallest honest wiring that makes the pairs reachable in the hosted town (for
   example a scripted conversation beat or a director-driven trigger), keeping the
   affection gates as they are; and (b) once they can play, do the two halves read as
   mirrored toward each other. Please also look at the stone pickup while you are in
   there: if pickup depends on a control the hosted client does not deliver, say so.
   Report what you find before building anything beyond (a)'s smallest wiring, if the
   answer turns out larger than expected.

Small notes, lowest priority, fix only if they fall out of the work above: the
opening label read "Dusk on the terrace" over a bright daylight scene, and the
verification browser's performance readout sat at about 2 fps on quality light,
which is most likely that browser's weak graphics rather than the town, but the
quality defaults are worth a glance while the client is open.

Please land these as one task with the usual landing note: what changed, the suite
results, and what the owner should re-verify at town.reseed.net (a fresh visitor
town is fine; his own visitor key and town need not be disturbed).

### Landing note (Claude, Nov 5, 2026): code in 67874bb, this note and ASSETS.md in the commit after it

1. **Aelia's textures arrive; what the verification saw is her.** The hosted
   `muse-avatar.vrm` is byte-identical to the repository's (so is
   `centurion.vrm`); both bodies load through the one GLTFLoader, three 0.187.0
   in both package.json files, the same `downscaleModelTextures` and
   `prepareVrm`, so the standalone build draws her exactly the same way. Her
   file is the AvatarSample model the owner restored in 39504f4: a white
   sleeveless top and shorts, white shoes, silver-white hair, very pale skin
   (average texture colours: skin 242/221/211, hair 199/188/179, top
   247/245/247) and a dark necktie down the front, which is the "thin dark
   vertical seam". Every material is MToon, exported as KHR_materials_unlit, so
   three draws her with no lighting at all; Gaius's armour and cape carry their
   own painted shading, hers do not. A Blender render of both files with their
   embedded textures reproduces the description to the letter. No change made:
   a textured Aelia and the Aelia on town.reseed.net are the same thing. If the
   owner wants her to read with form, lit toon materials for both VRMs is a
   design choice, not a repair; say the word and it gets built.

2. **The pale rectangle: not reproduced, candidate named.** Nothing in the HTML
   shell depends on an open conversation except the cream panel itself
   (top-centre), and the scene's only conversation hook is the talk-gesture
   mode. The one thing the code puts in the lower-centre band while a
   conversation runs is the 3D speech bubble over Gaius's head: it shows his
   typed message when a line is sent from the message box
   (`showBubble("player", ...)` in App.tsx), and in walk mode
   `clampBubbleToScreen` holds it just above the control band, about a third of
   the stage tall, drawn over everything (`depthTest: false`). That is a white
   rounded box with his words in dark text; whether the words failed to draw in
   the verification browser cannot be seen from here: this device's headless
   Chromium runs on software GL, which fails every one of the town's shader
   programs, so the scene never painted locally (the UI did: walk mode on
   arrival, the "Talk to Aelia" prompt, E opened the panel). To settle it in one
   look: a screenshot with the rectangle showing, and in the console while it
   shows, `document.elementFromPoint(innerWidth / 2, innerHeight * 0.8)`:
   `CANVAS` means the 3D bubble (then the bubble drawing gets fixed), anything
   else names the HTML element.

3. **The pairs.** (a) They are wired to scripted triggers, not AI replies: the
   rank-up scene at the next meeting (rank 3 plays the flirt, rank 4 and up the
   hug; `RANK_SCENES` in App.tsx) and the first topic card of a kept date (hug
   at rank 4 and up, flirt below). A fresh visitor town starts at rank 0 and
   needs 300 affection points for rank 3; the per-day earn caps (walk 10,
   wander 15, bench 12, row 16, water 8, talk 6, choice 16, note 8, quest 20,
   postcard 10, game 8, gift 5, plus 15 per first landmark) make that two to
   three real days of ordinary play, which is the gate working as designed. No
   gate was touched. For verification only, `?preview=pairs` on the town URL
   enables H (hug) and F (flirt) in walk mode near Aelia, through the scene's
   ordinary staging (both bodies ready, within reach, nothing else under way);
   it plays the two bodies and nothing more: no affection, no scene lines.
   (b) Mirroring, measured in Blender on the cut files against the rig's rest
   pose: `f_hug` is authored a half turn from the rig's forward (the pack's
   partner half faces its initiator, hips on the same spot), `m_hug` faces
   forward, both flirt halves face forward within 3°, and no pair take travels.
   The retarget carries each clip's hips rotation, and the scene turns the two
   bodies toward each other itself, so she hugged him facing away. Fixed in the
   loader: `faceForwardInPlace` turns a pair clip to +Z on its first frame
   (travel rotated with it), and the embrace glide now goes to contact distance
   (0.57 m hip to hip) plus each clip's measured forward step (`pairStepIn`),
   instead of the fixed 0.85 m that assumed the old cut's 0.27 m step-in; the
   new cuts play in place and were hugging the air. The files stay as cut;
   ASSETS.md records the measurement; `pairClips.test.ts` covers the turn.
   **Stone pickup:** a pickup needs a loose stone within about 1.7 m (ten lie
   about town, five of them within a few steps of the town tree), and the
   prompt pill then reads "Pick up stone" under Y; with none in reach Y gives a
   hint instead, which is what the verification got. The keyboard had no Y at
   all (the pad keys are I/J/K/L and U/O/P; E or Enter, Space and C were the
   only others), so the on-screen Y was the one way; keyboard Y now does the
   same.

4. **Small notes.** The terrace card said "Dusk" from the ninth Roman hour, the
   last third of daylight; it now says "Afternoon on the terrace" for the ninth
   and tenth hours and "Dusk" from the eleventh (parts, anchors and market hours
   unchanged). Quality: the client already drops itself to the light settings
   when it detects software GL or measures under 4 fps on its first frames, and
   lights the Light toggle to match; 2 fps on that browser is the browser.

**Suites:** `bun test server client/src`: 322 pass, 18 skip, 0 fail (340 tests
across 48 files, 3 of them new); `bun run test:pg`: 19 pass, 0 fail. tsc: no
new errors in the touched files (the 295 reported are the missing-SDK cascade
plus one pre-existing unused variable at townScene.ts:6674). Web build: 122
client files.

**Deploy: DONE (Nov 5, 2026, afternoon, on the owner's word).** `railway up`
from the clean export (CLAUDE.md step 4), 121 assets in the export; Railway
build `ae960209ae47`, 122 client files, bundle `main-njr135rg.js`; `/healthz`
ok and the new bundle served on both town.reseed.net and
muse-town-production.up.railway.app.

**Re-verify at town.reseed.net (a fresh visitor town is fine):**
open `https://town.reseed.net/?preview=pairs`, walk Gaius up to Aelia (two
metres or less, open ground, neither seated), press H, the pad's right
shoulder (RB), or the "RB · Hug" chip above the on-screen cluster: they glide
to arm's length and embrace facing each other, her face toward him; press F,
the left shoulder (LB), or the "LB · Flirt" chip: the flirt plays where they
stand, facing each other (the pad and chip routes were added the same
afternoon on the owner's ask, same flag, same staging). Stand on a stone (small grey
pebbles, five within a few steps of the town tree): the pill reads "Y, Pick up
stone"; press Y on the keyboard or on screen, and Give a gift then lists the
smooth stone. Between 14:00 and 15:30 Rome time the card reads "Afternoon on
the terrace". Aelia will look as before: that is her.

## Task 10 (READY, added Nov 5, 2026): the pairs in the composed scene: the embrace still does not read as an embrace

Context: Task 9 landed and deployed (Railway build ae960209ae47, bundle
main-njr135rg.js). On Nov 5, 2026, late morning, Muse ran the pair check the
Task 9 landing note prescribed: a desktop browser at town.reseed.net/?preview=pairs,
Gaius walked to within arm's reach of Aelia on open paved ground, H and F from the
keyboard. The browser renders at very low frame rates, so its stills catch phases;
the counts below are the runs, and the pattern across them is the evidence. The
launch gate stands: verification only, nothing linked or announced.

What now works, confirmed live: both gestures trigger on the first press; the pair
glides to true contact distance, feet nearly touching, torsos touching, no air gap
(the Task 9 glide fix is real); the flirt contains a genuine face-to-face moment
mid-gesture, his reach answering her turn.

What still fails, in the composed scene a visitor watches: across three hugs and
two flirts, no held peak read as an embrace. The consistent defects are offset,
side-by-side alignment at the peak instead of front to front, and arms that never
wrap: hers spread wide or hanging, his down or raised, never around her torso or
neck. The clearest single run: the third hug began from a clean face-to-face
position left by the first flirt, and at its peak Gaius stood with his back to
Aelia, facing away, his arm at his side, while she stood offset beside him in
profile facing south-east with an arm extended away from him. The flirt's clearest
peak: the two touching, heads turned toward each other, his arm reaching to her
side, but their torsos facing opposite directions, side by side and offset. After
each gesture they reset to standing side by side, both facing the same way.

The ask: reconcile the Blender hip-facing measurement in the Task 9 note (f_hug a
half turn off, flirt halves forward within 3 degrees) with this composed result,
and fix what the composition actually does. Questions, not conclusions, in rough
order of suspicion: does the scene's own turn-toward-each-other step compose with
the clips' rotations so the pair ends a quarter or half turn out by the held frame;
does the retarget onto these VRM rigs keep the arm wrap the source takes contain;
do the cut takes themselves (ASSETS.md: the outdoor clips were cut from the FBX
edition take by take) hold a wrap on these bodies at all; and is the held peak the
check caught a later phase than the moment the wrap exists. Acceptance, judged in
the live town through the same preview route: the hug ends in a held front-to-front
embrace with arms visibly around each other, both from a neutral start and from a
face-to-face start; the flirt holds a mirrored face-to-face at its peak. If the
honest conclusion is that the source takes cannot produce that on these rigs, say
so in the landing note and name the asset change that would, rather than tuning
around it. The affection gates and the rank scenes stay exactly as they are; the
preview route stays verification only.

Deploy note: commit fafb314 (the pair preview on the pad's shoulders and the
on-screen chips) is on origin, but the bundle the site served on Nov 5, 2026 did
not contain the chip labels, so the chips are not live yet. Please fold that
deploy into this task's, and record the build in the landing note as usual.

### Landing note (Claude, Nov 5, 2026, evening)

**How it was looked at.** The device cannot draw the WebGL town (software GL fails
the shaders), so the check ran the scene's own pipeline outside the browser: the
real `centurion.vrm` and `muse-avatar.vrm`, the real FBX takes, `bakeRetargetedClip`
and `faceForwardInPlace` from `characterAnimation.ts`, the two bodies mounted,
scaled and placed exactly as `townScene.ts` places a pair (facing each other at the
staged spacing), sampled through the clip and drawn as stick figures from the side,
front and above. Blender measured the source takes, all 64 standing hug and flirt
files in the pack, in the pack's own world frame.

**The reconciliation asked for.** The Task 9 facing measurement was right, and the
loader's turn works: composed, both bodies face each other within 0.3° for the whole
clip, from any start. The half turn is not in the pipeline. What produced the
picture Muse saw was three other things, in order of weight:

1. **The retarget spread every arm.** The Outdoor pack's rig binds in a relaxed
   A-pose (upper arms 49° below level, elbows bent 44°, forearms forward); the VRMs
   bind in a T-pose. The bake carried each bone's rotation *away from its own bind*,
   which is the same pose on both skeletons only when the binds stand alike, so
   every Outdoor arm landed about 50° higher and wider than authored. Measured on
   the old hug: his hands authored 0.19 to 0.20 m to either side of her, composed
   0.47 to 0.56 m, the "spread wide" of the check. The Human Basic Motions rig (idle,
   walk, wave, dance) binds in a T-pose, which is why nothing else ever looked
   wrong. Fixed in the bake: for the shoulder, upper arm and forearm the target's
   bind is first turned to point where the source's bind bone points, then the
   delta goes on top (`armBindPostureFix`, arm chain only; legs and spine differ
   by anatomy, not posture, and are left as they were). A rig whose bind already
   matches bakes as before within 7°. All 26 clips pass the town's clip gate on
   both bodies after the change; `armPosture.test.ts` holds the A-pose/T-pose case
   on two toy rigs.
2. **The takes.** The first cut's `m_hug`/`f_hug` (He hugs-1.1 + 1.1.1) is a loose
   hug: his right hand on her shoulder, his left reaching, her arms down behind
   her back, authored 0.65 m apart. No standing take in the Couples pack wraps
   both arms (He hugs-2 and She hugs-2 are side-by-side arm-over-shoulder holds;
   She hugs-1 is her hands on his shoulders). The first cut's flirt (Couple
   flirt-1.1 + 1.1.1) has the two facing the *same* way, she 0.3 m behind him,
   which the scene then turned face to face: "torsos facing opposite directions,
   side by side and offset" is that take squared up. Recut from the same pack
   (files replaced in `client/src/assets/anim/outdoor/`, names unchanged, nothing
   in git): the hug is now Couple flirt-4.3 + 4.3.3, the pack's one standing
   front-to-front hold with arms around each other (her arms around his neck,
   his hands at her waist, authored 0.37 m hip to hip, 167° face to face); the
   flirt is Couple flirt-2.3 + 2.3.3 (face to face at 0.42 m, each with a hand
   raised to the other's chest, mirrored). Which half is "he" is read from the
   poses; the pack does not say. ASSETS.md records all of it.
3. **The composition.** The flirt played wherever the two stood (up to 2.4 m, no
   glide), so its reach went into the air; her turn toward him was a fixed 12%
   per frame, which at the check's few frames a second left her a quarter turn
   short at the peak, "in profile beside him"; the hug's fixed 0.57 m was the old
   take's distance. Now both pairs glide to their take's spacing (`PAIR_SPACING_M`,
   0.50 m hug and 0.55 m flirt between the two group origins, which puts the hips
   0.40 and 0.44 m apart, the authored distances scaled for these taller bodies),
   her turn is paced by time and completes with the glide, and his heading is
   squared to her when the clip starts.

**What the composed result measures now** (the town's bake, both real bodies):
hug, hips 0.40 m apart, heads 0.53 m, her hands 8 to 18 cm behind his hip line at
his mid-back, his hands at her waist front, both facing within 0.3°; flirt, hips
0.44 m, both right hands raised to chest height toward the other, mirrored, face to
face. Honest limits: her arms close around his *back*, not his neck as authored
(he is 1.94 m to her 1.80, and the VRMs' reach is shorter than the pack rig's), and
the hands' roll (which way a palm faces) is approximate, since matching a bind by
limb direction leaves the twist to the minimal rotation. The embrace reads; if the
neck hold matters, that is a height change or a bespoke take, not a tuning.

**"Gaius with his back to Aelia."** Not reproduced: his heading is set toward her
at staging and nothing turns him during the clip. The reading that fits the
evidence is the low frame rate (her slow turn, the stills catching the moment
after the clip when she steps back to his side and both face the same way) rather
than a half turn in the data; if it recurs after this build, a screenshot with the
`[muse-town] pair preview` console line beside it settles it.

**Asset change, for the owner's desktop.** The four files `m_hug.fbx`, `f_hug.fbx`,
`m_flirt.fbx`, `f_flirt.fbx` under `client/src/assets/anim/outdoor/` must be the
takes ASSETS.md now names (byte copies of the pack's FBX files). A build from a
folder with the first cut still runs; it plays the old takes at the new spacing.

**Suites.** `bun run test`: 360 pass, 18 skip, 0 fail; `test:pg` 19 pass; client
`tsc` 295 errors, the SDK baseline, nothing new in touched files; web build
`c07ccf5fc83b`, 122 client files, bundle `main-wr9gq0zz.js` (carries the Task 9
pad chips from fafb314, which were never deployed).

**Deploy.** DEPLOY_PLACEHOLDER

**What the owner re-verifies at town.reseed.net** (`?preview=pairs`, walk mode near
Aelia, in the open): H, RB, or the "RB · Hug" chip: the two glide to touching
distance and hold an embrace for 3.3 s, her arms around his back, his hands at her
waist, heads close, front to front, from a side-by-side start and from a
face-to-face one. F, LB, or "LB · Flirt": they glide face to face at a hand's
reach and hold mirrored raised hands. Ordinary talk gestures and the bench idles
now hang the arms lower than before (the same bind fix), which is the authored
pose. Gates, ranks and the preview route are untouched.
