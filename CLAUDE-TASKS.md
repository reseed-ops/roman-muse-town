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
  actions require the visitor token only.
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
