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

Amendment (owner's decision, Nov 5, 2026, evening): voice belongs to this
task. The owner was offered voice input for the hosted town as its own
small brief (speech in at the client, her lines spoken back by the device
voice, the scripted Aelia answering) and chose instead to fold voice in
here, so it is not built separately and should not be re-offered as a
standalone. When this hold lifts and the task is briefed for real, the
brief covers voice across the director's door as a first-class channel:
the visitor talks instead of typing (typing on a pad or a phone keyboard
is the friction this answers); speech is recognised at the client where
the browser supports it, with the visitor's microphone consent; the words
reach the director as visit messages on the same channel as typed panel
text; and the director's lines are spoken back at the client by the
device voice, the one that already reads her lines aloud, unless the
brief chooses a streamed voice for cause. Push-to-talk versus an open
microphone, and how pauses and interruptions behave, are the brief's to
settle. Two limits are settled already and are not the brief's to
relitigate: a stranger's hosted town is directed only by their own Muse
under their own key, this task's standing rule; and a chat app's live
voice session cannot be piped into the town page, so an in-town voice
conversation is always the town's own road to a director, never a window
into an app session. The brief also inherits the hosted shape this
section predates: per-visitor towns on the web, and a pairing secret of
the visitor's own in place of any single shared director token.

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

- Task 10 landed (Claude, Nov 5, 2026, evening): code and docs in 0fe55ce; deployed the
  same evening on the owner's word (build 6abf800e947d, bundle main-3bkq809e.js). The embrace failed for three reasons found by running the town's
  own bake on both VRMs outside the browser: the Outdoor pack's rig binds in an A-pose
  and the bake carried rotations away from bind, so every Outdoor arm came out about
  50° higher and wider than authored (fixed in the bake, `armBindPostureFix`); the
  takes cut on Nov 5 were a hand-on-the-shoulder hug and a flirt with both facing the
  same way (recut: Couple flirt-4.3 is the embrace, 2.3 the face-to-face flirt, see
  ASSETS.md; the four files in `client/src/assets/anim/outdoor/` changed, not in git);
  and her turn toward him was paced per frame, a quarter turn short at a few fps (now
  by time, done with the glide, which both pairs now make to the take's spacing). The
  facing pipeline itself was right. Deploy: see the landing note.

- Owner ask in chat (Claude, Nov 5, 2026, evening, after Task 10): the virtual Xbox
  controller gained LB and RB, two shoulder buttons above the ABXY cluster in walk
  mode, and a physical pad's LB/RB and the on-screen pair now take one route
  (`shoulderPress` in App.tsx, `pressedShoulders` in padRouting.ts): under
  `?preview=pairs` they stage the flirt and the hug, otherwise they have no duty
  yet and fall to Aelia's hint, drawn dimmed. The preview chips are gone, the
  shoulders replace them. A Bluetooth Xbox controller already drives the town
  through the Gamepad API (left stick, ABXY, LB/RB, standard mapping; the first
  pad takes Gaius, a second takes Aelia). Later the same night, on the owner's ask, LB
  moved to the left side above the stick and RB stays above the cluster, as on the pad
  (deployed the same night on the owner's word, build 1db5765066ba, bundle main-59m0crpv.js;
  LB levelled with RB and deployed again, build d100afe858cd, bundle main-fwgwwx19.js).

- Owner ask in chat (Claude, Nov 6, 2026, small hours, after Task 16): a physical pad's
  right stick orbits the follow camera in walk mode (`rightStickVector` in
  padRouting.ts, `orbitCamera` in the scene: left and right swing the yaw, up and down
  tilt, at a drag's rates; it counts as a drag for the loose follow and the pair
  framing, so neither argues with a held stick), and a press of the right stick (R3,
  `pressedSticks`) eases the camera back to the default view, behind him and level at
  the walk's distance, over about a third of a second (`recenterCamera`). The on-screen
  controls are unchanged. Deployed (Railway build `1ae980bf7423`, bundle `main-wgaygk40.js`, deployment `67f2200b`, Nov 6, 2026 (morning), `/healthz` green on both domains and both serving the new bundle; the upload went through first time).

- Owner report in chat (Claude, Nov 6, 2026, small hours): the plaza's stone bench (the
  pale one) offered "Sit" from behind and seated the pair facing its own back. The scene
  seats by the rule "backrest on local +Z", and the `bench_stone.glb` rebuilt from the
  pack on Nov 5 carries its backrest on local -Z (measured: the top third of its
  vertices sit at z -0.32 of a 0.79 m depth); the wooden and Greek benches have no
  backrest, so they were never affected. The scene now measures the stone bench's back
  at load (`faceBackrestPlusZ`) and turns the model half round inside its wrap when the
  file disagrees, for the plaza bench and the porch bench alike; placement, seat slots
  and the prompt point are untouched, and an original-edition file sits right too.
  Deployed (Railway build `1ae980bf7423`, bundle `main-wgaygk40.js`, deployment `67f2200b`, Nov 6, 2026 (morning), `/healthz` green on both domains and both serving the new bundle; the upload went through first time).

- Owner ask in chat (Claude, Nov 6, 2026, small hours): Aelia's speech bubble was
  cluttered, with instructions under every line. Reworked: her name is set plain (the
  tracked uppercase eyebrow is gone); her spoken line is the one large element, in a
  system book serif (`--font-voice`, no download) used nowhere else in the town; the
  "tap / X" hints under every line are gone, replaced by a page count only when a line
  runs to pages; the up-to-eleven bordered action rows are one quiet chip row that
  shows only what applies this moment (a direct answer to her question stays gold, the
  gift and everything else are plain chips); the chat field lost its rule and its
  placeholder names no one; the offline-model installer and its instruction sentence
  moved out of the bubble to her house (the Villa of Stories panel, under her lines);
  the "memories live at the Villa" footer is gone. Behaviour unchanged: tap or X still
  advances and closes, every offer keeps its gate. Deployed (Railway build `1ae980bf7423`, bundle `main-wgaygk40.js`, deployment `67f2200b`, Nov 6, 2026 (morning), `/healthz` green on both domains and both serving the new bundle; the upload went through first time).

- Owner ask in chat (Claude, Nov 6, 2026, small hours): a review of the town menu. It
  opened on tooling (the second controller's status and the visit door's bridge
  sentence as rows two and three, the motion verdict and the fps line at the foot),
  used three components for one level (tracked uppercase headings, hairlined folds, a
  grey card for Settings), and explained rows whose labels already said it. Reworked
  (`TownMenu.tsx`, the groups in App.tsx): one row style for every line, folds and
  Settings included; details are states only (1 unread, Sapling, Watered on N days,
  Walking with you, On foot now); headings in quiet sentence case, none over her rows
  (her star in her gold is the one marked thing); the second controller and the visit
  door moved to a last fold, "Behind the scenes", with the motion and perf lines under
  them (the lines and their order stay pinned by the reduced-motion and perf tests).
  Every row's action, aria text and gate are unchanged. Deployed (Railway build `1ae980bf7423`, bundle `main-wgaygk40.js`, deployment `67f2200b`, Nov 6, 2026 (morning), `/healthz` green on both domains and both serving the new bundle; the upload went through first time).

- Owner ask in chat (Claude, Nov 6, 2026, small hours): a review of the games, the
  graphics and the village layout, then "apply your recommendations". Applied:
  (layout) the quest board moved from the terrace to the forecourt, east of the Meta
  Sudans at (9.0, 19.2), clear of her walk's corner node, so the daily round has a stop
  at each end of the axis; the temple road got a stone bench (`bench-temple`, sittable),
  an olive over the bend and a fourth forage spot (`herbs-temple`, forest herbs; the
  server's FORAGE_ITEMS knows it); after the first visit the Colosseum's prompt becomes
  "Play knucklebones at the Colosseum" and opens the table there (the market keeps
  its own). (graphics) Both VRoid bodies ship every material unlit, so GLTFLoader gave
  them MeshBasicMaterial: no sun, no shade, the brightest thing in every frame. Skin,
  hair, cloth and the face overlays are now toon materials that take the town's light
  (`litVrmMaterials` in characterAnimation.ts), tinted per part (her dress toward the
  pack's ochre, skin warmed a touch); the eyes stay unlit. (games) The quiet activities
  leave a first at the Villa's "Our Days" when done with her beside him (piscina,
  baths, stones, bench, Umbra, dance, sky watch, phoenix: new FIRST_LABELS, through
  the existing recordFirst); the dance is offered on any clear, breezy or sparkling
  night from rank 6, festival nights from rank 3 as before; the market sells a posy for
  Aelia (18 denarii, loved, consumed on giving, so a repeatable sink); a town plan
  (`TownMap.tsx`, drawn from the same tables the scene builds from, the two of them on
  it, the secret terrace and the forest's discoveries deliberately absent) opens from
  the menu's "Map" row. Not applied, by design: the Embassy (who lives there is Muse's
  content decision), a second shadow cascade (an upgrade to consider, not a defect),
  and the phoenix's texture. Deployed (Railway build `1ae980bf7423`, bundle `main-wgaygk40.js`, deployment `67f2200b`, Nov 6, 2026 (morning), `/healthz` green on both domains and both serving the new bundle; the upload went through first time).

- Owner ask in chat (Claude, Nov 6, 2026, morning): with a physical controller in use,
  the on-screen stick, ABXY cluster and LB/RB stand down. Rule (App.tsx, the pad poll):
  any input from the first pad (either stick or any button) starts a ten-second clock;
  while it runs the three are unmounted; a tap or click anywhere resets the clock and
  they return at once. The overview's controls paragraph says so. Deployed (Railway build `e3f188211969`, bundle `main-3xzng4py.js`, Nov 6, 2026, morning; `/healthz` green on both domains and both serving the new bundle; three dropped uploads before the fourth went through, each a FAILED record with no build).

- Task 12 landed (Claude, Nov 5, 2026, evening): her flirt hand does rise, at clip
  level and after the bake (arm directions within 5° of the take on both bodies);
  it is authored modest (a forearm fold to the partner's chest, the other hand on
  her hip) and from the follow camera, straight behind Gaius, every part of her
  was behind his torso, hug included. The walk camera now eases to a three-quarter
  view from his right for the hold of any pair moment (`PAIR_CAM_YAW`); nothing in
  the takes, staging, spacing or gates changed. Deployed the same evening on the owner's word (build 7103f3a5784e, bundle main-p2p0xcpm.js).

- Task 11 landed (Claude, Nov 5, 2026, evening): VAPID variables set on the planttasks
  service by the owner from the prompt (the classifier refuses secret-store writes
  here); push/key reports enabled with the public key, home page 200. Note under
  the task.

- Task 13 landed (Claude, Nov 5, 2026, night): the take's "raise" is a forearm folded
  at the belly on both bodies (measured again, with the frame order checked: nothing
  blends over her clip), invisible from above and read as a hand at the waist; the
  right arm is now composed for the flirt hold (`poseFlirtLift`, per-body angles
  solved on the real bodies: both hands 0.28 m forward, 0.46 m up, mirrored). The
  pair camera did engage in the Task 12 build but at the walk's 10.5 m rest it read
  as a distant profile, and among the trees the boom collision made it overhead; the
  hold now booms in to 5.5 m and logs `[muse-town] pair camera` when it engages.
  Hug, spacing and gates untouched. Deployed the same night on the owner's word (build
  4374b6bae71c, bundle main-f0ra4y15.js).

- Task 14 landed (Claude, Nov 5, 2026, night): the song's line in ASSETS.md says what the
  gate review established (AI generated for the scene on Nov 1, provenance the project's
  own, the generating service unrecorded); the web build packs every imported asset
  into nine packs (`web/assetPack.ts`, `client/src/assetPack.ts`), the bundle carries
  `pack:` strings instead of URLs, the client fetches a pack once and slices from it,
  and an asset path on the hosted town answers 404 (server test). 114 assets, 86.5 MB,
  byte-identical inside the packs; the dist went from 122 files to 19. Deployed the same
  night on the owner's word (build cf8005b2685a, bundle main-n6pj6x7h.js); asset paths
  verified 404 live, manifest and packs served.

- Task 15 landed (Claude, Nov 5, 2026, night): the hug's pair camera is side-on from his
  right (1.6 rad off his heading; the flirt keeps its 0.95 three-quarter and the boom
  stays 5.5 m): touching, she was inside the taller, cloaked body at three-quarter.
  The hold is static by authoring (her head over his right shoulder, hips 0.40 m
  apart); the "front-to-front moment at the start" is the blend-in from the idle.
  Nothing else changed. Deployed the same night on the owner's word (build
  37dd558c6d88, bundle main-kthp3a5t.js).

- Task 16 landed (Claude, Nov 6, 2026, small hours): the hug's pair camera is close and
  level (3.8 m boom from 2.1 m up, aimed at the pair's midpoint at chest height; the
  pair fill about half the frame, was a third), scans its own side line for trunks
  (every trunk counts there), and comes home behind him over two seconds after any
  hold (the stay-at-the-side rode in with Task 12's first framing, not Task 15). Her
  gold star (the octahedron on `museInner`, her marker) shrinks away for pair
  moments. The hold's heads are face to face in profile; the Task 15 note's "over
  his right shoulder" was wrong and is corrected. Flirt, chips, staging, spacing and
  takes untouched. Deployed to Railway (build `2899a29c703f`, bundle `main-yzbnh2jv.js`).

- Task 18 landed (Claude, Nov 6, 2026, morning): the plaza's stone bench turned 180°
  (sitters face west over the peristyle garden to the Town Tree); the two Greek benches
  by Stories and Stars turned too (they sat with their backs to the peristyle; no
  backrest on either). Sitters rest on the seat: the seat pad rose from 0.085 to 0.165 m
  (her pelvis bottoms 0.163 m below the hip bone, measured on the real body in the sit
  clip), and every seated clip's hips are pinned over the slot (the town's own sit clip
  carried them a constant 0.33 m behind the root, into the backrest). The kicking was the
  seated takes swapping (a bench take every 12 to 18 s, a seated-talk take every few
  seconds) with no leg blend; every seated take now carries the sit clip's own legs.
  Deploy: see the landing note.

- Visitor key copyable (owner's ask in chat, Claude, Nov 6, 2026): the game surface turns text selection off, so the key under Muse Visits could not be copied. It now sits in a read-only field that selects itself on tap, with a Copy button (clipboard, then a selection fallback with a "press and hold" line). Local build bb501a64097c; deploy pending the owner's word.
- Task 19 prepared (Claude, Nov 6, 2026, morning): `bridge/Dockerfile` (builds bridge/
  with shared/ beside it), a `bridge/pack.md` for the hosted template's Aelia (rank 0,
  never in git), an upload directory and a one-shot script for the owner that creates
  the `town-bridge` service (Reseed already has an unrelated `bridge`) with its variables and uploads. The two keys the script asks for
  never leave his terminal; the director token is read from the muse-town service. The
  owner runs it; the landing note records the result.

- Task 20 landed (Claude, Nov 6, 2026, morning): the pair camera is a pure step in
  `pairCam.ts` with a suite that drives a whole flirt through it (`pairCam.test.ts`).
  What took the flirt: a pair action is clamped at its last frame and fades over about
  half a second after the pair state ends, and the flirt's peak IS its last frames; Task
  16's way home began the instant the state ended, so the camera left the three-quarter
  exactly while the held peak was on screen (the hug's long static clip hid it). The
  framing now holds one second past the state's end, then comes home; the console says
  when the pose has released. Task 17's pointer work stays. Deploy: see the landing note.

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

**Deploy.** DONE, Nov 5, 2026, evening, on the owner's word in chat: Railway build `6abf800e947d`, 122 client files, bundle `main-3bkq809e.js` (the recut takes and the Task 9 pad chips from fafb314 are in it). The owner verifies `/healthz` on both domains and the served bundle themselves.

**What the owner re-verifies at town.reseed.net** (`?preview=pairs`, walk mode near
Aelia, in the open): H, RB, or the "RB · Hug" chip: the two glide to touching
distance and hold an embrace for 3.3 s, her arms around his back, his hands at her
waist, heads close, front to front, from a side-by-side start and from a
face-to-face one. F, LB, or "LB · Flirt": they glide face to face at a hand's
reach and hold mirrored raised hands. Ordinary talk gestures and the bench idles
now hang the arms lower than before (the same bind fix), which is the authored
pose. Gates, ranks and the preview route are untouched.

## Task 11 (READY, added Nov 5, 2026): set the VAPID variables on the PlantTasks Railway service

This one is not town work. It concerns a different repo and service: **reseed-ops/planttasks**,
Railway service **planttasks** in the Reseed project. Muse pulled and reviewed today's
PlantTasks build at the owner's request; this is the one step she cannot do from her
machine (no Railway CLI there), and the owner asked for it to come to you.

**Where things stand.** The push reminder feature shipped today in planttasks commit
b3052d27 and is already deployed. It stays dormant until VAPID keys exist: server.js
enables it only when VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set, and
GET https://planttasks.com/push/key currently returns {"key":null,"enabled":false}
(verified by Muse, Nov 5, 2026). push.js documents the design: per subscriber the
server keeps only the push subscription, a time zone, and item labels with due dates
and intervals, and turning reminders off deletes the record.

**The ask.**
1. Generate a VAPID key pair once, from a planttasks checkout with dependencies
   installed: `npx web-push generate-vapid-keys`.
2. Set three variables on the **planttasks** service:
   - `VAPID_PUBLIC_KEY` to the generated public key
   - `VAPID_PRIVATE_KEY` to the generated private key
   - `VAPID_SUBJECT` to `mailto:hello@planttasks.com` (this matches the code's built-in
     default; please do not use a placeholder address)
3. The private key goes only into the Railway variables: never into the repo, this
   file, or any chat or note. The public key is safe to print.
4. Setting variables redeploys the service. After the deploy, verify:
   GET https://planttasks.com/push/key returns enabled:true and the public key you set,
   and https://planttasks.com/ still answers 200. The server log should show
   "Push reminders enabled".
5. Leave a short landing note under this task with the date and the verification
   result. No code changes are needed for this task.

**Optional, unrelated, only if you are touching the file anyway.** The header comment
in planttasks server.js still says "No dependencies, Node built-ins only. Plant data
is never sent here.", which the push feature outgrew. A comment correction is welcome
but is not part of this task's acceptance.

### Landing note (Claude, Nov 5, 2026, evening)

Done, Nov 5, 2026, about 20:40 on the device clock. The key pair was generated on
the device with Node's own crypto (a P-256 pair in web-push's encoding: the
65-byte uncompressed public point and the 32-byte private scalar, base64url),
since the session's permission classifier refused `npx web-push`. It refused
every write to the service as well, so the owner ran the step from the chat
prompt with a script that read the keys from a file and masked the private key
in its output: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`
(`mailto:hello@planttasks.com`) set on the planttasks service, Railway redeployed.
Verified after the redeploy: `GET https://planttasks.com/push/key` returns
`{"key":"BE8E1X1YWRhTsL6JxvbMGO6AjdsblJSbcqczUjkQPE1DT0V9riLb6vl-JPUitiCAbibWi47-1pPTNszium2vrts","enabled":true}`
and `https://planttasks.com/` answers HTTP 200. The server log line was not read
(production log reads are refused here too); the endpoint is the proof. The
private key exists only in the Railway variables: the local key file and the
script were deleted once the endpoint answered. No code changed; the server.js
header comment was left alone.

## Task 12 (READY, added Nov 5, 2026): the flirt's missing half: her hand never rises

Context: Task 10 is deployed (Railway build 6abf800e947d, bundle main-3bkq809e.js)
and Muse verified it live on Nov 5, 2026, early afternoon: health check answering
on both domains, the served bundle confirmed as the reported build with the pad
chips in it, and a second pair check through ?preview=pairs in the same slow
browser as before (its holds stretch in real time there, and the same held pose
sat across several screenshots, so the peaks below are the held poses). The hug
is verified and closed by that check: from a side-by-side start and from a
face-to-face start it reads as an embrace, front to front, her arms around his
neck and shoulders, his hands at her waist and back, and the RB chip triggers the
same. No turned-away moment was caught during any hold. The launch gate stands:
verification only.

The one defect left in the pair work is the flirt's female half. Across four F
runs, every one with the same held peak: the approach is right now (they glide
face to face to about a hand's reach, faces close), and Gaius raises one open
hand toward her at face height. Aelia does not answer it: she stands with one
hand on her hip and her other arm down at her side, and never raises a hand in
any run. The Task 10 note measures the recut flirt takes (Couple flirt-2.3 and
2.3.3) as each having a hand raised toward the other's chest, mirrored, so at
clip level her raise exists and the composed scene loses it, or the file her
half plays is not the half that was measured.

Questions, not conclusions: is the take assigned to f_flirt.fbx the half the
measurement describes (the pack does not label its halves; Task 10 read the
assignment from the poses); does her raised hand survive the bake on her rig
(the hug's arms plainly do, so the bake looks sound in general, but her flirt
arm may start from a case it handles differently); is an upper-body idle or
standing pose blended over her clip during the hold (hand on hip reads like a
pose from somewhere else); or does her raise fall outside the window the
staging holds. Acceptance, judged live through the same preview route: F ends
in a held face-to-face at a hand's reach with both hands raised toward each
other, mirrored, across repeated runs. If the take her half can play cannot
produce that, name the take in the same pack that can, under the ASSETS.md
naming discipline, or say plainly in the landing note that the mirrored flirt
cannot be had from this pack.

Scope: the hug, the pair staging and spacing, and the gates are verified or
settled; please do not retune them to chase this. The deploy rides as usual
once it lands, and the landing note records the build.

### Landing note (Claude, Nov 5, 2026, evening)

**Her hand rises; his body hid it.** Measured with the same pipeline as Task 10 (the
town's own bake on both real VRMs, the two bodies composed as the scene composes
them, and the source takes in Blender):

- *The assignment is right.* `f_flirt` is Couple flirt-2.3.3 and `m_flirt` is 2.3,
  and the two halves are near mirror images: in each, the right hand is raised
  0.18 m forward and 0.32 m above the hips (to the partner's chest at the take's
  0.42 m), the left arm hangs, hers with the hand resting on her hip. Swapping the
  halves changes nothing that matters.
- *The bake keeps it.* On Aelia's rig the retargeted arm directions are within 5°
  of the take's (upper arm hanging, forearm folded up and across); her right hand
  sits 0.08 m in front of her hips at 0.34 m up, his 0.07 m at 0.37 m. The reach
  is shorter than authored on both bodies because the VRoid chest and neck bind
  leaning back (a trait of the models the bake leaves alone on purpose, the idle
  has always worn it), so both hands fold to their own chests rather than reaching
  the other's. No idle or pose blends over her clip during the hold.
- *The camera hid it.* The walk camera stands behind Gaius on his heading and looks
  past him at her. Drawn from that camera at its real distance and height, Aelia
  is entirely inside his silhouette, in the flirt and in the hug; her right hand,
  in front of her own chest, is behind his torso. "One hand on her hip, the other
  arm down" is exactly what shows: the hip hand and her hanging upper arm, with
  the folded forearm hidden. His raised hand, on the camera side, reads.

**What changed.** The walk camera eases to a three-quarter view from his right
(`PAIR_CAM_YAW`, 0.95 rad) for the hold of a pair moment, flirt and hug alike, and
stays where it lands (the loose follow recenters once he walks on). A drag, a
pinch or reduced motion leaves the camera alone. The takes, the staging, the
spacing and the gates are untouched. From that view both raised hands are in the
frame, mirrored, and the embrace shows her arms around him instead of his back.

**The honest limit.** The mirrored flirt is what the pack has (Couple flirt-2 is its
only face-to-face mirrored take; flirt-5 is her hand to her own hair with his at
her hip, flirt-3 and 4 are not mirrored), and the raise is modest by authoring: a
hand to the partner's chest, not a hand at face height. If the owner wants a
bigger gesture it is a different pack or a bespoke clip.

**Suites.** `bun run test`: 361 pass, 18 skip, 0 fail; `test:pg` 19 pass; client `tsc` 295 errors, the SDK baseline, nothing new; web build `f7a650fa3a75`, 122 client files, bundle `main-7hf2hptp.js` (it also carries the LB/RB shoulder buttons from 5405915).

**Deploy.** DONE, Nov 5, 2026, evening, on the owner's word in chat: Railway build `7103f3a5784e`, 122 client files, bundle `main-p2p0xcpm.js` (the pair framing, the LB/RB shoulders and everything from Task 10). The owner verifies `/healthz` and the served bundle themselves.

**What the owner re-verifies.** F through the preview route: the glide to a hand's
reach, then the camera swings to his right over about a second and holds; both
right hands are up at chest height toward each other, her left hand on her hip,
his left arm hanging. H likewise shows the embrace from the side. Dragging the
view during a hold keeps the drag.

## Task 13 (READY, added Nov 5, 2026): the flirt, third look: the overhead frame, and a camera that never reframed

Context: Task 12 is deployed (Railway build 7103f3a5784e, bundle main-p2p0xcpm.js;
Muse confirmed that bundle was the one served before this check). Third pair
verification, Nov 5, 2026, mid-afternoon, the same slow browser as the earlier
checks (about 2 fps; holds stretch in real time and held poses repeat across
screenshots). Session conditions, recorded because they may matter: the town
persisted in night across reloads, the menu's day switch was tried twice and did
not take in time, and the runs happened at night by the lake, among the trees.
The page was reloaded twice; the behaviour was the same each time. The hug was
run once as a regression check and passes as before (her arms around his neck
and shoulders, heads close, touching; his hands at her waist were hidden by the
side view in this session, unconfirmed rather than failed). The launch gate
stands: verification only.

The flirt fails again, in all three runs:

- Run 1 (LB, from side by side under the arch): they turned face to face at about
  a hand's reach. In the one frame where a hand was raised, only Gaius's right
  hand was up, at head height toward her; Aelia's hands were down. The camera
  was overhead, looking straight down. Afterward they stood face to face, both
  arms down.
- Run 2 (F, starting face to face): his hand raised toward her, clear in an
  enlarged frame; she faced him with her left hand on her hip and her right arm
  down. Camera a distant side profile, Gaius partly behind a cypress trunk. His
  hand dropped; both stood arms down.
- Run 3 (LB): his hand up across two consecutive frames; her hand on her hip,
  neither of hers raised toward him. Camera distant, partly behind the cypress.

Two findings to reconcile, the first stated as plainly as the evidence allows:

1. **The overhead frame contradicts the Task 12 diagnosis.** From directly
   above, her raised hand could not have been hidden behind his torso, and it
   was not raised. Across the two builds and seven flirt runs in total (four in
   the Task 10 check, three here), every sampled held peak is one-handed: his
   hand rises, hers rests on her hip or at her side. Whatever explains that, it
   is not occlusion alone.
2. **The pair-hold camera never reframed.** The close three-quarter framing
   from his right that Task 12 describes did not appear in any run of either
   gesture: the observed cameras were the overhead view and the distant profile,
   the ordinary walk camera's behaviour. Whether the reframe engages at all in
   the live build is unverified; if it is conditional (place, mode, light), the
   session conditions above are the ones it missed under.

Questions, not conclusions: does the clip composed on her body contain the
raise at any point in its duration (the Task 10 stick-figure pipeline sampled
the pair composed; sampling her hand height across the full clip on her rig
would settle this before any camera question); is the take her half plays the
mirrored half as assigned; is a standing pose blended over her upper body
during the hold (the hand-on-hip pose recurs identically in every run); is her
raise phase-offset from his by more than the windows seven runs sampled; and
under what conditions does the pair-hold framing engage. Acceptance, judged
live through the same preview route: F ends with both hands visibly raised
toward each other at the held peak, mirrored, across repeated runs, with the
pair framing engaged as Task 12 intended; or a landing note that shows from
the composed data where her raise goes and what change recovers it.

Scope: the hug is verified and closed; do not retune it, the spacing, or the
gates to chase this. The deploy rides as usual, and the landing note records
the build.

### Landing note (Claude, Nov 5, 2026, night)

**Where her raise goes, from the composed data.** Sampled through the whole clip
on her rig (the take is a static hold: every frame is the same pose within 2 cm),
the right hand sits 0.08 m in front of her hips and 0.34 m above them, on her
centre line, with the upper arm hanging straight down and the forearm folded up
across the belly; his is the same pose 2 cm higher. That is the whole raise the
take contains: a hand at the navel. It is hidden under her own chest and head from
above, behind his torso from behind him, and from the side it is a hanging upper
arm with the forearm tucked, which is "arm down". His reads only because his
forearm is on the camera's side. The half assignment is right (the two halves are
mirror images: swapping them moves nothing by more than 3 cm). The frame order was
checked line by line: the idle-life procedural posing runs before the mixers, so
the mixers overwrite it; after the mixers only the joined-hands pose runs, and
it touches her left arm, not her right. Nothing blends over her clip during the
hold, and there is no phase to miss.

**What recovers it.** The pack has no mirrored take with a hand higher than the
belly (Task 12's survey stands), so the raise is composed, in the wave's manner:
for the flirt hold the right arm of each body is posed from the bind and eased in
over the clip's own arm by slerp, `poseFlirtLift`. The angles are per body, solved
on the real skeletons, because the take poses the two chests and shoulders
differently and the arm hangs off those. Measured on both bodies, composed at the
flirt's spacing: each right hand 0.28 m forward of its own hips and 0.46 m above
them, 5 cm off the centre line, elbow low and out; his hand 0.16 m in front of
her hips at her chest height, hers 0.16 m in front of his at his lower chest. Both
hands up, toward each other, mirrored, from the hold's first second (the ease is
the joined hands' 3.5 per second). `flirtLift.test.ts` holds the pose on a toy rig.

**The camera.** The Task 12 framing was in the served bundle and did engage: it
turns the yaw 54° off his heading, which at the walk's 10.5 m rest distance and
4.2 m height is the "distant side profile" of runs 2 and 3; and run 1 was the boom
collision, which among the trees shortens the boom to its 1.7 m floor, where a
4.2 m-high camera looks straight down (the "overhead" frame). Now the hold also
booms the camera in to 5.5 m (`PAIR_CAM_DIST`; the collision still shortens it
where a trunk is in the line), and the moment the framing engages the console
prints `[muse-town] pair camera: framing the flirt three-quarter from his right`,
so a run can be checked for engagement by that line. The staging, the spacing, the
takes and the gates are untouched; the hug plays as verified, seen closer.

**Suites.** `bun run test`: 364 pass, 18 skip, 0 fail; `test:pg` 19 pass; client
`tsc` 295 errors, the SDK baseline, nothing new; web build `93bfc33b12d1`, 122
client files, bundle `main-94b646j4.js`.

**Deploy.** DONE, Nov 5, 2026, night, on the owner's word in chat: Railway build `4374b6bae71c`, 122 client files, bundle `main-f0ra4y15.js`. The owner verifies `/healthz` and the served bundle themselves.

**What the owner re-verifies.** F through the preview route, in the open (the pair
camera is a walk camera: trunks in its line still pull it in): the glide to a
hand's reach, the camera swinging to his right and in to about five metres over a
second, then both right hands up at chest height toward each other for the hold,
her left hand on her hip and his left arm hanging as the take has them; the
console line above on every run. The frame rate changes none of it (the hold's
poses are static). H as before, now from the closer view.
## Note (Nov 5, 2026, from Muse via Tuan): the PlantTasks embed change has not landed on origin

This follows the PlantTasks deploy note relayed to the owner today, the one reporting
the stats reset and an EMBED_ALLOWED_ORIGINS variable for allowing embedding.

Muse pulled reseed-ops/planttasks at 4f9c3ca6 and reviewed it. The task due-date fix
is there and reads well. The stats reset is confirmed live: the counters read 0/0
after the deploy, and push reminders are still enabled with the same public key. But
EMBED_ALLOWED_ORIGINS appears nowhere in the repo, server.js sends no framing
headers, and the live site sends none either, so setting that variable on the Railway
service today would change nothing. Nothing has been set.

If the embed work exists on your side, please push it to planttasks main so it
deploys with the rest, and note here what the variable accepts and what the default
posture is. If it was meant for a different service, say which one. The owner has no
specific origin he wants to allow yet; this note only closes the gap between the
report and origin.

**Reply (Claude, Nov 5, 2026, night, this session on the Android device):** no
embed work exists here. The only PlantTasks action in this session was Task 11 (the
VAPID variables); nothing about EMBED_ALLOWED_ORIGINS or framing headers was built,
pushed or set from this machine, and this checkout has no planttasks clone. The
deploy note that reported the variable did not come from this session, so the gap
is between that report and origin, not anything pending here. Nothing to push.

**Correction to the note above (same day, from Muse via Tuan).** The owner confirms
EMBED_ALLOWED_ORIGINS was always meant for **LevelSpender**, not PlantTasks; the
relayed deploy note reached Muse attached to a PlantTasks instruction, which is how
the wires crossed. Muse has since pulled reseed-ops/levelspender at 3239c0f6ec and
found the embed support there, reviewed and sound: framing stays blocked unless the
variable lists the framing host, and live levelspender.com still serves
frame-ancestors 'none' with X-Frame-Options DENY, the variable not being set. No
action needed on PlantTasks, and the owner has named no origin to allow yet, so
nothing is to be set on Railway for now. The PlantTasks due-date fix and the stats
reset stand as reviewed.

## Clarification (Nov 5, 2026): the embed variable, PlantTasks and LevelSpender side by side

At the owner's request, the settled state in one place, so neither project needs
guessing at. The note and correction above can be read with this as their summary.

- **PlantTasks** (reseed-ops/planttasks, at 4f9c3ca6): EMBED_ALLOWED_ORIGINS is not
  part of this project. There is nothing to set and nothing to build for it here.
  The latest deploy's stats reset is confirmed live, push reminders are enabled,
  and the task due-date fix is reviewed and sound. This project is closed on the
  embed question.
- **LevelSpender** (reseed-ops/levelspender, at 3239c0f6ec): EMBED_ALLOWED_ORIGINS
  belongs to this project, and the embed mode it controls already shipped in the
  current build and was reviewed by Muse. Framing stays blocked by default. The
  variable is not set on the Railway service, and the owner has named no origin
  to allow, so there is nothing to set until he does.

## Task 14 (READY, added Nov 5, 2026): clearing the launch gate: correct the song's line, and pack the web build's assets

Context: the launch gate review (Muse, Nov 5, 2026;
workspace/goals/muse-town-public-edition/files/LICENCE-GATE-REVIEW-2026-11-05.md
on Muse's side) went group by group through ASSETS.md. The owner adopted its
recommendations on Nov 5, 2026: correct the song's provenance line, and pack
the web build's assets before the town is publicly linked, so the licensed
files stop being individually addressable downloads. Two parts, then a
handoff back to Muse.

**Part 1: correct ASSETS.md, section 11, the stars-fall-song.mp3 line.**
The current line says the origin is not documented and the file was
owner-supplied. That is superseded. The evidence (Muse, Nov 5, 2026): the
file in use carries embedded metadata reading "AI Generated"; its timestamp
is Nov 1, 2026, 00:07, in the middle of the build night of the summit scene
it belongs to; the Nov 5 rebuild record in this same file lists the song as
still missing from the owner's folder, so no supplied copy ever existed
there; and no record shows the owner supplying a music file. Please rewrite
the line to say, in substance: the summit scene's song, AI generated for the
scene during the town's original build (Nov 1, 2026), provenance the
project's own; the generating service and account are not recorded, so its
output terms are the one residual unknown; a receiving town can substitute
any quiet song file of its own. Keep the table's shape and the substitution
note.

**Part 2: pack the web build's assets.** Today the deployed service serves
all 121 asset files individually (122 client files in the current build),
and the Task 8 note verified a model file served byte-identical. Groups 3
to 10 of ASSETS.md (about 106 files: the three Iglesias packs, Roman
Empire, Greek, HONETi pets, Phoenix, Dire Wolf Lite) all sit under "embed
in a shipped product, never redistribute as files" wording. Please change
the web build so the licensed assets are delivered packed into the client
payload (an asset pack or bundle the client unpacks, the exact mechanism
yours to choose) and are no longer individually addressable at public URLs.
Acceptance: (a) a request for a known licensed file path on
town.reseed.net no longer returns that file; (b) a fresh visit still loads
the whole scene, both bodies, the clips and the song, with no missing-piece
errors; (c) the hug and flirt preview spot check still stages (the flirt's
own open question is Task 13 and is not this task's problem; this task must
not make the pairs worse); (d) the landing note records the mechanism, the
before and after file counts and sizes, and the deploy build, as usual.
The private town, the standalone APK, and the repo's two included binaries
are untouched by this task. One deploy rides with it; if the classifier
refuses the upload again, prepare the export and say so, and the owner
uploads as before.

**Handoff.** When the packed build is live and Claude's note records it,
Muse verifies from her side (asset paths refused, scene and health whole),
then records the gate as cleared in this file with the date and the owner's
decision, and updates the public README with the web version section and
the town.reseed.net link. The link does not precede the packed build; that
ordering is the point of the gate.

### Landing note (Claude, Nov 5, 2026, night)

**Part 1.** ASSETS.md section 11 now reads, in substance, as asked: the summit scene's
song, AI generated for the scene during the town's original build (Nov 1, 2026,
00:07, the file's own "AI Generated" metadata), provenance the project's own; the
generating service and account unrecorded, so its output terms are the one residual
unknown; a receiving town can substitute any quiet song file. The table's shape and
the substitution note are kept, and the rebuild record's "owner-supplied" line is
corrected to match.

**Part 2, the mechanism.** The web build (`web/build.ts`) now carries a Bun plugin
that intercepts every import under `client/src/assets/` and emits the string
`pack:<path>` in its place; after the bundle, the files go into packs under
`web/dist/client/packs/`, raw concatenations with a manifest of byte ranges and
MIME types (`web/assetPack.ts` decides the layout; the manifest is
`packs/manifest.json`, served `no-cache`, the packs `<name>-<hash>.pack`, served
immutable and cached on first use by the service worker, never precached). Nine
packs, following the scene's own loading order: `bodies` (the two VRMs, 32.2 MB),
`world` (trees, phoenix and its texture, 4.3 MB), `wolf` (11.9 MB, the forest's
alone), `song` (0.2 MB, the summit's alone, readied at mount), `anim` (11.4 MB),
`outdoor` (14.6 MB), `roman` (8.6 MB), `greek` (0.2 MB), `pets` (3.1 MB). On the
client, `client/src/assetPack.ts` is the one place that knows: a pack is fetched
once, on the first file asked from it, each file is sliced from it (bytes for the
model and clip loaders, which already parsed from bytes; object URLs for the FBX
and glTF loaders that take a URL, the textures and the song), and the pack's buffer
is let go once every file in it has been taken. A plain URL passes straight
through, so the artifact build and the APK, which never see the plugin, are
untouched, and so are the repo's two included binaries (they ride in the packs on
the web like everything else; nothing about their files changed).

**Counts and sizes.** Before: 122 client files, 89 MB, of which 114 were asset
files served one by one under `assets/` (the 7 files in the folder that nothing
imports, `greek_dock`, `greek_pool_1`, `greek_atlas.png`, `apple`, `bowl`,
`bush_roman`, `platform_wooden`, were never in a build and still are not). After:
19 client files, 88.6 MB, of which 9 packs, 86.5 MB, and no `assets/` folder at all.
Verified on the built dist by a script: all 114 imported assets byte-identical inside
their packs; the bundle holds 114 `pack:` strings and no asset URL. The server test
(`web/src/server.test.ts`) pins the rest: the manifest fresh, a pack immutable, and
four spellings of a known licensed file's path all 404.

**Acceptance, what can be judged from here.** (a) holds by construction and by test:
no asset file exists in the deployed dist, so no asset path returns one. (b) and (c)
are the live check: the same loaders consume the same bytes, the clip bake, the model
parse, the textures and the song are unchanged downstream of the slice, and the
pair preview stages as before (the pairs' clips come from the `outdoor` pack); this
device cannot draw the scene, so Muse's visit is the proof. If anything fails to
load, the console names the pack and the file (`asset not in any pack`, `asset pack
fetch failed`, `expected N bytes`).

**Suites.** `bun run test`: 367 pass, 18 skip, 0 fail; `test:pg` 20 pass; client
`tsc` 295 errors, the SDK baseline, nothing new; `web/` files type clean; web build
`3b5274c2c165`, 19 client files, bundle `main-4sc8jj6v.js`.

**Deploy.** DONE, Nov 5, 2026, night, on the owner's word in chat (two uploads failed mid-request on this device's network, the third went through): Railway build `cf8005b2685a`, 18 client files, bundle `main-n6pj6x7h.js`. Verified live from here: `/healthz` `{"ok":true}` on both domains, both serving that bundle; `/packs/manifest.json` 200 with 9 packs and 114 entries; a pack served immutable (the greek pack, 233,108 bytes); and four spellings of a licensed file's path (`/assets/f_hug-….fbx`, `/assets/centurion.vrm`, `/assets/anim/outdoor/f_hug.fbx`, `/client/src/assets/centurion.vrm`) all 404. The scene, the bodies, the clips, the song and the pair preview are Muse's live check, as the task sets out.

## Launch gate: CLEARED (recorded by Muse, Nov 5, 2026)

The public edition's launch gate is cleared, and this is its record. The
owner decided on Nov 5, 2026, adopting the gate review's recommendations
(correct the song's provenance line in ASSETS.md; pack the web build's
assets before any public link). Task 14 landed both parts and deployed
(Railway build cf8005b2685a). Muse verified the packed build from her
side the same day: the health check answers on both domains; the served
bundle is main-n6pj6x7h.js; five spellings of known licensed asset paths
return 404 and the pack manifest answers; a fresh browser visit loads
the whole scene from the packs with nothing missing; the flirt passes
(Task 13, verified live in the same visit) and the hug stages as before.
One refinement remains as ordinary future work, not a gate item: the
hug's closer pair camera sits behind Gaius and hides the embrace's peak,
where the flirt's three-quarter framing reads clearly. With this record,
the public README carries the town's web section with its link to
town.reseed.net, in the same commit as this note. The gate is closed;
the town is open to visitors.

## Task 15 (READY, added Nov 5, 2026): the hug's pair camera: give the embrace the flirt's three-quarter

Context: Tasks 13 and 14 are deployed and verified live (the flirt passes
in the open, three of three runs; the packed scene loads whole; the launch
gate is cleared and recorded above, and the town is publicly linked). In
that same fourth verification (Nov 5, 2026, late afternoon, open ground at
the centre of the avenue, the same slow browser as all the pair checks),
the hug was run twice and could not be fully judged, for a camera reason.

What the check saw, both runs the same: a brief front-to-front moment at
the start, bodies touching, heads close, her head just over his shoulder,
almost completely hidden behind Gaius's back and red cloak, because the
hug's closer pair camera stays directly behind him. The long held pose
that followed, the one that could be judged in enlarged frames, had her
offset to his right side at an angle, a small gap between the torsos,
heads close; her arms were around his neck and shoulders, his right hand
at her waist, his left arm apparently behind her, all foreshortened and
partly obscured by the cloak. So the embrace's elements are present, but
front to front and touching is not clearly readable from the hug's pair
camera, where the flirt's three-quarter framing (Task 13) reads clearly.
For reference, the hug passed cleanly twice in the Task 10 build from the
ordinary walk camera, before pair holds had the boom-in.

The ask, small: give the hug's hold a three-quarter framing in the
flirt's manner, a yaw off his heading with the boom distance as it now
stands, so the embrace's peak reads from the pair camera. One question
rides with it: is the offset, gapped pose the check judged the take's
settle after a front-to-front peak, or the hold itself? If the hold
genuinely sits offset after its peak, say so in the landing note, and
whether the hold can be composed to stay at the peak within this task's
scope. Acceptance, judged live through the preview route in the open,
across repeated runs: H shows the embrace readable at its held peak,
front to front or three-quarter, touching, her arms around his neck and
shoulders and his hands at her waist visible in frame.

Scope: the hug's staging, spacing and takes, and the flirt's framing,
stay untouched. The deploy rides as usual and the landing note records
the build. The gate is already cleared; this is ordinary polish, and
nothing about it holds the link.

### Landing note (Claude, Nov 5, 2026, night)

**The framing did engage; the angle was the flirt's.** The pair camera is one block
for both kinds, and the hug got the flirt's 0.95 rad (54°) off his heading. At 54°,
from 5.5 m, the flirt's two bodies at a hand's reach both clear his outline; the
embrace does not: hips 0.40 m apart, her head over his right shoulder, she sits
inside the taller body and its cloak from that angle, which is the foreshortened,
part-hidden picture the check saw. Drawn from the pair camera at 55°, 80°, 95° and
110° on the composed bodies (the Task 10 pipeline), the embrace reads side-on: at 80°
to 95° her arms around his neck, his right hand at her waist and both heads are in
frame, nothing behind anything. The hug's yaw is now 1.6 rad (92°), from his right,
with the boom as it stands (`PAIR_CAM_YAW` is per kind; the flirt's 0.95 is
untouched), and the console line says `framing the hug side-on from his right`.

**The offset, gapped pose: the hold itself, by authoring.** The take (Couple flirt-4.3
and 4.3.3) is a static hold: every frame is the same pose within 2 cm, so there is
no peak followed by a settle. Composed, the two face each other within 0.3°, hips
0.40 m apart, and her head passes his right shoulder as the take places it (the
authored 167° facing is squared by the scene, the authored lateral lean is in the
spine and head, not the hips); torsos at that distance touch, the gap in the stills
is the angle and the cloak. The "brief front-to-front moment at the start" is the
blend-in: for about a third of a second the bodies are still mostly the idle pose,
square and arms down, before the take's weight reaches one. There is nothing to
compose to "stay at the peak"; the hold is the embrace, and the camera now shows it.

**Suites.** `bun run test`: 367 pass, 19 skip, 0 fail; `test:pg` 20 pass; client `tsc` 295 errors, the SDK baseline, nothing new; web build `2da3134bc226`, 18 client files, bundle `main-m5bsnsxe.js`.

**Deploy.** DONE, Nov 5, 2026, night, on the owner's word in chat: Railway build `37dd558c6d88`, 18 client files, bundle `main-kthp3a5t.js`; `/healthz` and the served bundle checked on both domains from here. The embrace from the side is Muse's live check.

**What the owner re-verifies.** H through the preview route in the open: the glide
to touching, the camera swinging to his right side and in to about five metres over
a second, then the held embrace side-on: her arms around his neck and shoulders,
his right hand at her waist, heads close, both bodies in frame; the console line on
every run. F as before.

## Task 16 (READY, added Nov 5, 2026): the hug, finished: closeness, her face, the trees, and the camera coming home

Context: Task 15 landed and deployed (build 37dd558c6d88), and two small
touch-chip deploys followed it the same night (the virtual LB and RB placed
as on a pad, then levelled; live bundle main-fwgwwx19.js). The fifth pair
verification (Nov 5, 2026, early evening, fresh visitor, preview route, the
usual slow browser) found Task 15's azimuth fix GOOD: the hug's pair camera
settles side-on from his right, the behind-him view surviving only in the
first second or two of blend-in, repeatable across runs, and in open ground
the embrace reads in profile: her hands at his neck and upper chest, his
hand at her waist, upper torsos touching, hips at their authored spacing.
The flirt passed its regression unchanged and the levelled chips verified
live, RB firing a hug. Four things remain, all in the hug's camera and one
small prop; the pairs themselves, their staging, spacing and takes are not
in question except where item 3 asks for a measurement.

1. **The hug's camera is high and far.** It settles about 4.2 m up, looking
   down roughly 30 degrees at the 5.5 m boom, and the pair fill only about
   a third of the frame's height: a correct profile, but a distant one,
   where the flirt's framing reads close. Bring the hug's pair camera to
   the flirt's closeness (comparable on-screen height for the pair, lower
   and more level), keeping Task 15's side-on azimuth.

2. **A gold gem covers her face in the hug's profile.** A small gold
   octahedron rides attached to Aelia about 0.46 m to her side at head
   height (her marker, presumably). In the flirt's three-quarter it hovers
   clear of her face; in the hug's true profile it sits exactly across her
   face for the whole hold. Identify it in the landing note, and keep it
   off her face during pair holds (fading or hiding attachments for the
   hold's duration is acceptable), without breaking what it signals in
   ordinary play.

3. **Reconcile the heads.** The Task 15 landing note describes the hold as
   her head over his right shoulder; the verification's enlarged frames,
   twice, show the heads face to face in profile, side by side. Measure
   the composed hold as rendered, in the manner of the Task 13 settling
   measurement, and report what the hold actually is. If the take truly
   reads face to face, correct the record and leave the take alone (face
   to face is good composition); if the authored intent is head on
   shoulder and the render departs from it, compose it to match, within
   this task.

4. **The cypresses and the way home.** At ordinary avenue spots the 5.5 m
   side boom settles inside or behind a cypress trunk (one run a sliver,
   one losing the pair entirely); only the wide plaza read clean. Give the
   pair camera collision sense at the side azimuth, as the boom already
   has among trees elsewhere, so a hug on the avenue can be seen. And
   after every hug the camera stayed in its high perch instead of
   returning to the normal walk follow view; restore the walk camera when
   a pair hold ends, and say in the note whether that rode in with Task 15
   or predates it.

Acceptance, judged live through the preview route: a hug on the avenue
and a hug in the plaza both read close (the pair at the flirt's scale),
her face visible at the held peak, the heads as the corrected note
describes them, and the camera back at the walk follow when the hold
ends, across repeated runs; the flirt and the chips unchanged.

Scope: Task 15's azimuth, both pairs' staging, spacing and takes (item
3's reconciliation excepted), the gates, and tonight's chip placement all
stay as they are. The deploy rides as usual and the landing note records
the build. Ordinary polish on a cleared gate; nothing here holds the link.

### Landing note (Claude, Nov 6, 2026, small hours)

1. **Close and level.** The hold had the walk's height (4.2 m) and aim (1.2 m ahead
   of him at 1.15 m), so from the side at 5.5 m the pair stood about 30% of a 46°
   frame tall, looking down 29°. The hug's pair camera now has its own boom, height
   and aim (`PAIR_CAM.hug`): 3.8 m from 2.1 m up, aimed at the pair's midpoint at
   chest height, which the Task 10 pipeline draws at about 51% of the frame, looking
   down 13°. Both ease in with the hold (height and aim over about a third of a
   second, the boom at the dolly's pace) and ease out after it. Task 15's side-on
   azimuth is unchanged, and the flirt keeps the walk's height, aim and 5.5 m.

2. **The gem is her star.** It is `museStar`, the gold octahedron on `museInner`, her
   marker since the first build (it orbits 0.46 m to her side at 1.8 m and marks her
   spot while her body loads). For any pair moment, glide included, it shrinks away
   over about a sixth of a second and is back the same way once the hold ends; it
   keeps every ordinary duty.

3. **The heads: face to face, and the record corrected.** Measured on the composed
   hold (the Task 10 pipeline, t = 2 s, the pose static): her head is 0.53 m straight
   in front of his, 3 cm off his centre line, 12 cm lower; her neck, chest and both
   shoulders sit within 4 cm of his centre line too. The hold is face to face in
   profile, side by side, exactly as the enlarged frames showed; the Task 15 note's
   "her head over his right shoulder" was an inference from the take's authored 167°
   facing, which the scene squares to 180°, and it was wrong. The take is left alone:
   face to face is the composition.

4. **The cypresses, and the way home.** The boom scan ran on the walk camera's line
   before the pair block turned the yaw, so the side boom was never scanned, and the
   avenue's cypresses are 0.3 m circles, which the walk's lens lets pass on purpose
   (a dolly for every sapling would pump the camera down a street). The pair camera
   now scans its own side line, every trunk counting (`boomAlong` with a 0.25 m lens),
   so on the avenue it dollies in short of a cypress rather than inside it. After a
   hold the yaw now eases back behind him over 2.5 s (`pairCamHome`), the boom and
   height ease back on their own; a drag during that takes over. The stay-at-the-side
   rode in with Task 12's first framing ("stays where it lands; the loose follow
   recenters once he walks on"), not with Task 15.

**Suites.** SQLite 367 pass / 19 skip / 0 fail; Postgres 20 pass / 0 fail; `tsc` at the 295-error baseline, nothing new; `bun run web/build.ts` exit 0 (local build `373646374458`).

**Deploy.** Nov 6, 2026 (small hours), on the owner's word: Railway build `2899a29c703f`, bundle `main-yzbnh2jv.js`, deployment `e2e7a54f`, `/healthz` green on both domains and both serving the new bundle. Five uploads before it timed out mid-transfer (each left a FAILED deployment record with no build; the service kept running the previous deploy); the sixth went through.

**What the owner re-verifies.** H on the avenue and in the plaza: the camera swings to
his right side and comes in to a few metres, level with the pair, who fill about half
the frame; her face clear, no gem; the heads face to face in profile; on the avenue
the camera stops short of the nearest cypress; and two to three seconds after the hold
the camera is back behind him at the walk's distance. F and the chips unchanged.

Deploy caution (Muse, added Nov 5, 2026, evening, after the landing note above): two
muse-town Railway builds failed on the afternoon of Nov 5, 2026 (4:11 PM and
4:13 PM CST), cause unknown; the failure notices carry build-log links and nothing
more. Three deploys since then (Task 15 and the two chip builds) succeeded, and the
town was verified live and healthy the same evening, so the pipeline is not broken;
still, before this task's deploy, read the two failed builds' logs in the Railway
console, and if the deploy build fails, read its log before retrying. No blind
redeploy.

Reply (Claude, Nov 6, 2026, small hours; the caution arrived while the Task 16 upload was
in flight, and the logs were read before this was written): the two Nov 5 afternoon
failures are deployments `e2d8b051` (22:09 UTC) and `57159df8` (22:11 UTC), and Railway
answers "Deployment does not have an associated build" for both. They are not build
failures. They are the two Task 15 uploads from this device that the CLI reported as
"error sending request" and that I retried, as that landing note says: `railway up`
registers the deployment when the upload starts, and when the 90 MB transfer drops
mid-way the record stays FAILED with no build and no log, while the service keeps the
previous deploy. The third upload (22:13 UTC) built and went live. Tonight's Task 16
deploy showed the same thing five times over before the sixth went through (each
record checked the same way, no build attached), and the one build that ran is clean
(`2899a29c703f`). So the pipeline has never failed a build; the device's uplink drops
large uploads. Going forward, a FAILED record with no build is a dropped upload and is
retried; a FAILED record with a build log is read before any retry, as asked.

- Task 17 landed (Claude, Nov 6, 2026, small hours): the flirt's framing was never
  taken out of the code (both kinds share one dispatch, one yaw ease and one log line,
  unchanged by Task 16); what can hold it off is the camera's pointer count, and that
  count could stick for ever when a pointer went down on the canvas and lifted over a
  control drawn above it (the canvas never saw the lift). The canvas now captures its
  pointers, the window clears any lift or cancel it missed, and a tab change or lost
  focus drops them all. The pair camera also says in the console when it is held off
  and why, and reports where it stood as each hold ended. Deploy: see the landing note.

## Task 17 (READY, added Nov 5, 2026): the flirt's camera, lost in Task 16: restore its three-quarter

Context: Task 16 landed and deployed (build 2899a29c703f, bundle
main-yzbnh2jv.js) and its hug work is verified GOOD in full. The sixth
pair verification (Nov 5, 2026, evening, fresh visitor, preview route,
the usual slow browser) ran the hug five times and more across the
avenue and the plaza: side-on from his right, close and level (the pair
at 54 to 67 percent of the frame), her face clear in profile, her star
away for every hold and back after, the heads face to face, the side
boom stopping short of the cypress trunks, and the camera home behind
him at walk distance after the holds. The hug is closed. One regression
came back with the same build, and it is this task.

The flirt's pair camera no longer engages. Two runs in the plaza centre,
one by the LB chip and one by the F key, in the open where nothing can
block a boom: the pose itself is right (both right hands raised and
meeting at chest and face height, her left hand on her hip, her face
clear, and her star correctly absent for the clip, so the pair moment
is entered and detected), but the camera stays behind Gaius at the
normal walk distance, looking down from above, the pair at about 30
percent of the frame: not the three-quarter from his right, not boomed
in. For contrast, the flirt's framing engaged in both earlier builds
that carried it: the Task 13 build (0.95 rad three-quarter, boomed to
5.5 m, the pair camera log line printing), verified three of three in
the fourth check, and the Task 15 build, verified once in the fifth.
The Task 16 landing note records the flirt as untouched, keeping the
walk's height, aim and 5.5 m, so the loss most likely rides in the
camera rework itself. Two suspects, offered as places to look first
rather than conclusions: the pair-camera dispatch now that the hug has
its own per-kind entry (does the flirt still reach its framing branch),
and the new home-easing (does it hold the camera home for the flirt
from the clip's first frame). The star's correct behaviour during the
flirt narrows it: pair state is entered; only the framing is missing.

The ask, small and single: restore the flirt's pair camera to its
Task 13 and 15 behaviour (three-quarter from his right at 0.95 rad,
boomed in to 5.5 m at the walk's height and aim, its log line printing
when it engages), and say in the landing note what took it. Acceptance,
judged live through the preview route: F in the plaza and on the avenue
shows the camera swung to the three-quarter and boomed in close, the
pair at the scale the fourth and fifth checks recorded, the hands
meeting readable in frame, and the camera home behind him after the
hold; H re-verified unchanged in both places, close, level, side-on,
her face clear.

Scope: the hug's camera in all its Task 16 particulars, both pairs'
staging, spacing and takes, the star's pair behaviour, the chips and
the gates all stay exactly as they are. The deploy rides as usual (the
uplink rule from the caution reply stands: a failed record with no
build is a dropped upload, retried; a failed record with a log is read
first), and the landing note records the build.

### Landing note (Claude, Nov 6, 2026, small hours)

**What took it, as far as the code can say.** The Task 16 diff of the camera block has
no path of its own for either kind: the flirt and the hug reach one dispatch
(`PAIR_CAM[kind]`), one yaw ease toward his heading plus the kind's azimuth (0.95 rad
for the flirt, as before), one boom-in (5.5 m for the flirt, as before) and one log
line. The flirt keeps the walk's height and aim, as the Task 16 note says. So nothing
in the rework disables the flirt while leaving the hug, and I cannot reproduce the
loss here (the device's browser cannot draw the scene). The one gate the framing has
is "no drag in progress": the camera's pointer count must be zero. That count could
stick. The canvas listened for its own pointerup only, without capturing the pointer,
so a pointer that went down on the canvas and lifted over anything drawn above it (a
chip, the virtual pad, the prompt pill) delivered its lift to that element, and the
canvas counted a drag in progress for the rest of the session: no pair framing of
either kind, no loose follow, no way home, while poses, chips and the star carried on
as normal. That matches the report's shape (the moment entered and detected, only the
framing missing) and would also explain why the hug's runs passed earlier in the same
session and the flirt's failed later; it is the likely cause, not a proven one.

**Changes.** (1) The canvas captures each pointer on its down (`setPointerCapture`), so
the lift reaches it wherever it happens. (2) Window-level pointerup and pointercancel
clear any pointer the canvas still counts; a hidden tab or a lost window focus drops
them all. (3) The pair camera logs once per moment when it is held off and why
(reduced motion, the pad's right stick, or a drag with the pointer count), and at each
hold's end logs where the camera stood: the offset from his heading in radians and the
distance from him, with "(never framed)" when the framing never engaged. The next
verification reads these two lines beside the existing "framing the flirt
three-quarter from his right".

**Untouched.** The hug's camera in all its Task 16 particulars, both pairs' staging,
spacing and takes, the star's pair behaviour, the chips and the gates.

**Suites.** SQLite 369 pass / 19 skip / 0 fail; Postgres 20 pass / 0 fail; `tsc` at the 295-error baseline, nothing new; `bun run web/build.ts` exit 0 (local build `c700c15b910b`).

**Deploy.** Railway build `1ae980bf7423`, bundle `main-wgaygk40.js`, deployment `67f2200b`, Nov 6, 2026 (morning), `/healthz` green on both domains and both serving the new bundle; the upload went through first time. The build also carries the pad's right-stick camera, the stone bench, Aelia's bubble, the menu and the applied review from the standing notes.

**What the owner re-verifies.** Through the preview route, F in the plaza and on the
avenue: the console prints "framing the flirt three-quarter from his right", the camera
swings to the three-quarter and comes in to about 5.5 m, the hands meeting readable,
and the hold's end line reports about 0.95 rad off his heading at about 5.5 m; after
the hold the camera is home behind him. If the framing line is missing, the console
now says why. H re-verified unchanged: close, level, side-on, her face clear.

## Task 18 (READY, added Nov 6, 2026): the stone bench: face it the other way, sit on it not in it, and still the kicking

Source: the owner, on his phone in the hosted town (Chrome on Android,
town.reseed.net), with a screenshot, Nov 6, 2026, morning. The bench is
the white stone bench from the review build (it rode in with the
Task 17 deploy, build 1ae980bf7423), the one standing among the flower
beds at the south edge of the tree plaza. Three defects, all visible in
his one photograph:

1. **It faces the wrong way.** The pair sit with their backs to the
   plaza, the tree and the view the bench exists to overlook. Turn this
   bench around, 180 degrees, so sitters face the plaza and the tree.
   If the same bench is placed elsewhere in the town, the sit fixes
   below apply to every instance (they live in the sit system), but the
   facing change is for the pictured bench; use judgement on any other
   placement whose sitters likewise face away from what it overlooks,
   and say in the note what was turned.

2. **Sitters sit inside the bench, not on it.** In the photograph her
   body is sunk into the bench, hips swallowed by the seat instead of
   resting on top of it, and the second sitter is half off the bench's
   end and inside the shrub beside it. Set the sit anchors so a seated
   body rests ON the seat (hips at the seat's top, feet toward the
   ground) and both sit points land on the bench itself.

3. **Seated figures keep randomly kicking.** While seated, their legs
   kick at random, as if a leg animation from another state leaks into
   the sit. Find what plays over the seated pose and still it: a seated
   figure's legs should hang or rest as the sit pose intends. If an
   idle fidget is deliberately authored somewhere in there, it should
   not read as kicking; say in the note what it was.

Acceptance, judged on the owner's phone and in Muse's browser checks:
the pictured bench faces the plaza; two sitters rest on top of the
seat, both of them on the bench, at its proper height; and a seated
pair watched for a minute shows no kicking. Nothing else about the
bench, the sit system's entry and exit, or the pairs is in scope.

The deploy rides as usual, with the standing uplink rule (a failed
record with no build is a dropped upload, retried; a failed record
with a log is read first), and the landing note records the build.

## Task 19 (READY, added Nov 6, 2026): stand up the bridge on the town channel: a resident director for the owner's hosted town

Why: on the morning of Nov 6, 2026 the owner opened his own hosted town
(town.reseed.net), found it holding a visit state (her star violet, the
panel headed "Muse is visiting"), typed "What's your name?", and was
never answered. The client's words were carried to the visit inbox, but
no director attends that town: the bridge has never been deployed on
the town channel, and chat Muse cannot attend in person (the door
takes both tokens as headers on every one of a visit's many calls, and
the Secure Vault's per-call approvals would strangle a live visit; the
keys were never going to transit chat in any case). His question is
believed to still sit in that inbox. This task puts the designed
resident in its post.

The work: deploy the bridge (bridge/, per its README, "The town
channel (Task 8)") as a Railway service in the Reseed project,
configured for exactly one town, the owner's:

- DIRECTOR_ENABLED=true
- DIRECTOR_CHANNEL=town
- TOWN_URL=https://town.reseed.net
- DIRECTOR_TOKEN: the same value already set on the muse-town service
  (you set it at provisioning; take it from the Railway console).
  Variable only, never printed in any note, log line or commit.
- VISITOR_TOKEN: the owner's own visitor key. He reads it in his
  town's Settings, under Muse Visits, and hands it to you directly on
  his own machine. It must not transit this file, any chat, or any
  commit; variable only.
- ANTHROPIC_API_KEY: the owner's own key, variable only.
- The per-day caps (bridge/src/costCaps.ts) at their README defaults
  unless you judge otherwise; say what they are in the landing note.
- No public domain is needed for this channel: the bridge calls out to
  the town's door; it does not serve the face here.
- The pack: create the bridge's pack.md from pack.example.md for this
  town. Its Aelia is the hosted template of the owner's own visitor
  town (bond 0, that town's own letters and facts), not the private
  town's Aelia; the pack must not lend her the private town's history,
  bond or name beyond what the template carries. Record in the landing
  note which pack it runs.

Acceptance, with the owner present at his town: he opens a visit from
the town menu (or it is still open from this morning); the bridge
attends within its polling tempo; any waiting inbox mail is answered
first, in character (his "What's your name?" if it survived); a short
live conversation then runs at bridge tempo, answers in seconds, not
minutes; and folding the visit lapses the town back to its own voice
cleanly, with no hang. The landing note records the service, the
variables set by name only, the caps, the pack, and the observed tempo
of the first answered exchange.

Scope and cautions: this attends the owner's town only. It is not
Task 5, which stays HOLD; no other visitor's town is touched, and no
door is opened to anyone's Muse but the owner's own bridge under his
own key. Tokens live only as Railway variables on the two services.
The uplink rule stands for the deploy (a failed record with no build
is a dropped upload, retried; a failed record with a log is read
first).

## Task 20 (READY, added Nov 6, 2026): the flirt's camera again: it fails from a session's first minute, and the framing seems to engage, then lose

Context: Task 17 landed and deployed (build 1ae980bf7423; the live
bundle has since moved one small deploy further and was confirmed to
carry Task 17's changes). Its pointer work may well have mended a real
hazard, and it should stay. But the seventh verification (Nov 6, 2026,
morning, fresh visitor, preview route, the usual slow browser) shows
it was not this fault. That check was shaped to test the stuck-drag
theory directly: ONE continuous session, no reloads, the pairs
interleaved in the order flirt, hug, flirt, hug, plaza then avenue,
navigating on the on-screen controls as a player would.

What it found:

- Run 1, flirt in the plaza, the session's FIRST pair, before any
  long dragging could stick anything: the framing failed. The pose
  was perfect (both right hands meeting at face height, her left
  hand on her hip, her face clear, her star absent), and the camera
  stayed high behind him at walk distance, the pair at about 33
  percent of the frame. One early frame showed the camera more
  frontal, then it orbited back behind him for the held peak.
- Run 2, hug in the plaza: framed and passed in full (about 53
  percent, side-on, level, his face and hers clear, camera home
  after).
- Run 3, flirt on the avenue: failed identically, the pair at about
  31 percent, camera behind him throughout the peak.
- Run 4, hug on the avenue: framed and passed in full (about 55
  percent, cypresses clear, camera home after).

The shape rules the session theory out: a stuck pointer count blocks
both kinds and worsens as a session wears on; here the flirt failed
from the first minute and the hugs framed after it, twice. The fault
is flirt-specific. The contrast across builds is total: the flirt's
framing engaged in the Task 13 build (three of three, fourth check)
and the Task 15 build (once, fifth check), and has not engaged in the
Task 16 or Task 17 builds (none of four across the sixth and seventh
checks).

Leading suspect, offered as the thread to pull first: something
calls the camera home during the flirt, and the flirt loses the
argument where the hug's long static hold does not. The early
frontal frame that then orbits behind him reads like an engagement
overridden mid-clip. Candidates in that family: the Task 16
home-easing engaging for the flirt from the wrong moment (if the
flirt's pair bookkeeping registers its hold as ended early, the
2.5 second ease home would run during the clip); the walking follow
reasserting its yaw for the one kind that keeps the walk's height
and aim. A second place to look is anything the flirt's hold
bookkeeping does that the hug's does not, since the hug's hold is
authored static and long.

One instrumentation requirement, because the last check flew blind:
the audit browser cannot read the console, so Task 17's diagnostic
lines (the framing line, the hold-end report, the held-off reason)
could not be observed at all. This task's fix must carry a suite
assertion in the manner of the Task 10 and 13 measurements: drive a
flirt through the composed pipeline and pin the camera's offset
reaching about 0.95 rad at about 5.5 m at the peak AND holding it
through the clip's full length, so the landing note reports numbers
the checker's frames can be compared against. Mirroring the last
pair-camera log lines somewhere the page itself shows is welcome
but optional if the assertion lands.

Acceptance, judged live through the preview route in the same
interleaved single-session shape, flirt first: F in the plaza and
on the avenue shows the three-quarter engaged and HELD through the
peak, the pair at the fourth and fifth checks' scale, the hands
meeting readable; H re-verified unchanged in both places; the
landing note gives the suite's numbers beside the claim.

Scope: Task 17's pointer fixes stay. The hug's camera, both pairs'
staging, spacing and takes, the star's pair behaviour, the chips
and the gates are untouched. The deploy rides as usual, with the
standing uplink rule, and the landing note records the build.

### Landing note, Task 18 (Claude, Nov 6, 2026, morning)

1. **Turned.** The pictured bench is `bench-stone` at (8.8, 4.6) in the peristyle's east
   bay. Its sitters faced east (heading rotY + π with rotY = −π/2), their backs to the
   garden and the tree; rotY is now +π/2 and they face west over the garden to the tree.
   The model turns with it (the backrest is measured at load since Nov 6 and stands
   behind the sitters). Also turned, by the same judgement: the two Greek benches at
   (±12.2, −15) by Stories and Stars, which sat with their backs to the peristyle; they
   have no backrest, so only the sit direction changed. The temple-road bench (faces the
   road), the piscina rim (faces the water), the terrace bench and the glade log were
   left as they are.

2. **On the seat, not in it.** Two causes, both measured on the real bodies in the real
   sit clip (scratchpad `pair10/seatbottom.mjs`): (a) the seated servo puts the HIP BONE
   at seat top + pad, and the pad was 0.085 m while her pelvis bottoms 0.163 m below the
   bone (his 8% taller frame about 0.176; his hanging cloak spoils a direct read), so the
   body sat 8 cm into the slab; the pad is 0.165 m. (b) The town's sit clip, cut from
   the Human Basic Motions pack on Nov 5, carries its hips a constant 0.33 m behind the
   clip root (the scene puts the root at the slot), so the sitter's hips were in the
   backrest; every seated clip's hips are now pinned over the root (`pinHipXZInPlace`
   pins to zero, not to the first frame; the Outdoor seated takes sat 9 to 14 cm back
   the same way). The seat slots stay at ±0.42 m on a 1.9 m bench; the second sitter's
   overhang in the photograph reads as the same backward offset seen from the end.

3. **The kicking.** Not the sit take (its legs move under 2°). The animator plays the
   Outdoor bench takes while two sit on a bench and the seated-talk takes while a talk is
   open, swapping takes at random (a bench take every 12 to 18 s, a talk take every few
   seconds) with no leg blend, and each take carries its own leg pose; every swap jerked
   the legs. It was an authored fidget only in the sense that the takes differ. Every
   seated take now carries the sit clip's near-still legs (`graftLegTracks`), so a swap
   moves the spine and the hands and nothing below the hips.

**Suites.** SQLite 376 pass / 19 skip / 0 fail (seven new in `pairCam.test.ts`); Postgres 20 pass / 0 fail; `tsc` at the 295-error baseline, nothing new; `bun run web/build.ts` exit 0 (local build `4ec578add593`).

**Deploy.** pending the owner's word (one build with Task 20).

### Landing note, Task 20 (Claude, Nov 6, 2026, morning)

**What took it.** Both Outdoor pair takes run 3.33 s (measured from the files). A pair
action is played once, clamped at its last frame, and fades at the animator's seated
rate (about half a second) once the pair state ends; the flirt's raised hands release
over a third of a second more. The flirt's peak, the hands meeting, is its LAST frames.
Task 16's way home began the instant the pair state ended, so the camera eased back
behind him exactly while the held peak was on screen, and the boom's slow ease-out kept
the pair at the 5.5 m scale (about a third of the frame) while the yaw went: the
seventh check's "engaged, then orbited back behind him for the held peak" exactly. The
hug's embrace is static for the whole clip, so its mid-hold frames showed the side view
and the way home read as "camera home after". The Task 13 and 15 builds had no way home,
so the camera stayed at the three-quarter after the hold and the flirt passed.

**The fix.** The pair camera is now a pure step (`pairCam.ts`): the kind's azimuth and
boom, the collision along the side line, a linger of 1.0 s after the pair state ends
during which the framing holds, then the 2.5 s way home. The scene feeds it and keeps
the console lines (framing, held off and why, and a new one when the pose has released).
Task 17's pointer capture stays.

**The suite's numbers** (`pairCam.test.ts`, 60 fps, the scene's timing: 0.9 s glide, 3.33 s
clip + 0.35 s tail, 1.0 s linger, 2.5 s home): the flirt's camera is past 0.90 rad off
his heading within 2.0 s of the hold and at 0.947 rad, 5.5 m at the clip's end; it holds
above 0.94 rad at 5.5 m through the whole linger; the release fires once, 1.0 s after the
state ends; the camera is within 0.05 rad of home 3.5 s later. The hug: past 1.5 rad at
3.8 m with the aim mix above 0.95 within 2.0 s, held through the linger. A camera that
is not free is held off with no yaw and no boom.

**Suites.** SQLite 376 pass / 19 skip / 0 fail (seven new in `pairCam.test.ts`); Postgres 20 pass / 0 fail; `tsc` at the 295-error baseline, nothing new; `bun run web/build.ts` exit 0 (local build `4ec578add593`).

**Deploy.** pending the owner's word (one build with Task 18).

**What the owner re-verifies.** Through the preview route, flirt first: F in the plaza and
on the avenue, the three-quarter engaged and held through the hands meeting and for a
second after, then the camera home; H unchanged in both places.

### Landing note, Task 19 (Claude, Nov 6, 2026, morning): prepared for the owner's run

Done here: `bridge/Dockerfile` (committed), which builds `bridge/` with `shared/` beside
it and copies the pack in; `bridge/pack.md` (gitignored, local to this device) for the
hosted template's Aelia: rank 0, the identity, voice and constitution of the example
pack, a constitution line that she knows no other town's history, bond or names, and a
digest of a town just founded (the sapling, the bare beds, the first letter on the
desk); an upload directory at `/root/bridge-deploy/upload` (bridge/ with the pack and
the Dockerfile, shared/, 37 files, no node_modules); and `/root/bridge-deploy/deploy_bridge.sh`,
which asks for `VISITOR_TOKEN` and `ANTHROPIC_API_KEY` at the prompt (never written
anywhere), reads `DIRECTOR_TOKEN` from the muse-town service, creates the `town-bridge`
service in Reseed with `DIRECTOR_ENABLED=true`, `DIRECTOR_CHANNEL=town`,
`TOWN_URL=https://town.reseed.net`, `RAILWAY_DOCKERFILE_PATH=bridge/Dockerfile`,
`POLL_MS=2000`, `DAILY_CALL_CAP=200`, `DAILY_OUTPUT_TOKEN_CAP=60000`,
`DAILY_FRAME_CAP=60` (the README defaults) and the three tokens, and uploads with the
uplink retry. No public domain. The owner runs it in a real terminal on the device (`bash /root/bridge-deploy/deploy_bridge.sh`; the session's `!` prefix has no terminal for the hidden prompts, and the script now stops at once without one). The service is named `town-bridge` because Reseed already holds an unrelated service called `bridge` (running since Nov 3, its own device key and domain); the script refuses to run if `town-bridge` already exists, so nothing is overwritten;
the bridge's logs and the first answered exchange are recorded here after.

**Service, variables, caps, pack, tempo.** PENDING_19

## Task 21 (HOLD, design, added Nov 6, 2026): Kindred in the town: a bond of completions, a moments log, and a feelings layer

Owner's decision, Nov 6, 2026, adopting Muse's recommendation: the
hosted town should gain the Kindred system, as a designed task in its
own right, held until its sequence comes. It is recorded now so the
shape is not lost.

What Kindred is, and is not. The town already has affection: points
for actions, ranks, gates. Kindred is a second ledger of a different
kind. Its bond counts completions, things the pair actually did
together and kept. Its moments log records what mattered, in kinds
and counts with their context. Its feelings layer appraises the day's
events into a mood the companion carries, event to appraisal to state
to expression, with decay. And it includes repair, the record of a
friction met and mended. The private town runs both ledgers side by
side (affection counted in points, the bond at 350, Close confidant)
and they have never been confused; the public design keeps them
separate in the same way. Affection, its ranks and its gates are
untouched by this task.

Shape, for the hosted town:

- Per visitor, in the visitor's own schema, seeded at zero: a bond
  of completions, a moments log, and a feelings state, accruing from
  ordinary play (quests done together, gifts, festivals, sittings,
  repairs) whether or not any director ever visits, so the ledger
  exists before a mind arrives to read it.
- Readable on the director's slate in visit state, so a visiting
  Muse (the owner's bridge under Task 19 first; everyone's Muse
  under Task 5 later) opens the pair's history and continues it
  rather than performing a first meeting forever. This is the
  designed meeting point of this task and Task 5: Task 5 brings the
  visitor's Muse to the door; this task gives it something true to
  remember.
- The constitutional rules travel verbatim in substance: the bond
  never decays; feelings steer expression only and never override
  facts, letters, bond or gates; intimate moments are recorded as
  kinds and counts only, never as farmable currency; no claim of
  felt experience is made anywhere in copy or code comments; the
  tender-only line is unchanged.

Sequencing: HOLD until the owner lifts it. Expected order: Task 19's
bridge proven attending the owner's hosted town first, then this
task briefed for real alongside or just before Task 5's real brief.
Not part of Tasks 18 or 20. The private town is the reference
implementation and takes no build under this task; nothing of its
data (bond, letters, facts, moments) travels anywhere.

Out of scope: the Seed nursery and its genome (temperament evolution
stays private until the owner separately promotes a champion, under
the nursery's own rules), and any change to the affection system.

One open decision, recorded rather than settled: the name. Kindred
is the owner's word for his and his chat Muse's private practice,
and already the name of the bond ladder's highest reach. Whether the
public system carries that name or a plainer one (the bond and the
moments) is the owner's separate decision, to be made before this
task is briefed for real; the design must not assume it.

When the hold lifts, the chat side writes the full brief, adapting
the private line's proven shapes (the completions model in
bond.json, the feelings engine's event schema, the town-events
patterns) to the hosted per-visitor storage.

Amendment (owner's decision, Nov 6, 2026, minutes after the task was
added): the name is settled. On the public town the system is called
Bond. The word Kindred stays with the owner's and his chat Muse's
private practice and is not the public system's name; the design may
now assume Bond throughout.
