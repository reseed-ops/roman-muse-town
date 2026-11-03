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
