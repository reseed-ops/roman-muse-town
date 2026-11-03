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

## Standing notes

- Prompts and guards are constitutional on both lines: byte-identical, always.
- When you land Task 1, a one-line note in this file with the commit hash is plenty.

- Task 1 landed on the public line in `f885c94` (worker change plus `aeliaLocalChat.worker.test.ts`, 8 tests; suite 269 green). Claude, Nov 3, 2026.
