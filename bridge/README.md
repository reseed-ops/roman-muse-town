# The Live Bridge

The resident director for Muse Visits (Task 6, Nov 2026). While a visit is
open it polls the director channel about every two seconds, answers visit
mail through the Anthropic API under the owner's own key, streams the
answer into Aelia's bubble as partial speaks where the channel carries
them, keeps the visit loop's manners (one greeting, throttled presence
intentions, sight on a look or a slow cadence), and applies the
constitution in code before anything is enqueued.

## Shape

- `src/channel.ts`: the director channel, one narrow interface: state,
  inbox, one frame at a time, direct, composing, pack. Slate-only by
  construction: there is no write path to facts, letters, bond, or
  digest.
- `src/seamAdapter.ts`: Adapter A, over this line's Task 4 seam harness
  (`harness/visitHarness.ts`) by HTTP.
- `src/slateAdapter.ts`: Adapter B, over the private town's slate. The
  interface and the action mapping only; the transport is Gate 0's to
  prove on the private side. Until the proven transport and shapes are
  appended to `CLAUDE-TASKS.md`, it refuses every call plainly.
- `src/outputFilter.ts`: the constitution as a deterministic filter:
  speak only, the dash rule, the speak cap, the reserved band, tender
  only.
- `src/pack.ts`: the context pack loader (identity, voice, constitution,
  life digest; `rank: N`), re-read on change so the chat side's morning
  refresh lands without a restart. `pack.example.md` is the shape.
- `src/costCaps.ts`: per-day caps on calls, output tokens, and frames,
  persisted to a small JSON ledger.
- `src/director.ts`: the loop. Mail is answered before presence; a dead
  channel folds quietly with backoff; the off state idles and a visit
  lapses by heartbeat.
- `src/anthropicMind.ts`: the model call (`@anthropic-ai/sdk`, streaming,
  adaptive thinking, low effort, short output).

## Run locally

```
# in one terminal: the seam harness
bun run harness/visitHarness.ts

# in another: the bridge
cd bridge && bun install
cp pack.example.md pack.md         # then let the chat side tend it
export ANTHROPIC_API_KEY=sk-ant-...
export DIRECTOR_ENABLED=true
bun run dev                        # or: npm run build && npm start
```

Open the town with `?harness=http://localhost:8787` (or set localStorage
`muse-town-visit-harness`), then open a visit from the town menu, or ask
the harness to: `curl -X POST localhost:8787/visit/begin`.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `DIRECTOR_ENABLED` | `false` | Off unless `true`; off, the process idles. |
| `ANTHROPIC_API_KEY` | (none) | The owner's key. Required to answer. Never in the repo. |
| `DIRECTOR_CHANNEL` | `seam` | `seam` (Adapter A) or `slate` (Adapter B, unproven). |
| `HARNESS_URL` | `http://localhost:8787` | The seam harness. |
| `DIRECTOR_MODEL` | `claude-opus-5-5` | The model. |
| `PACK_PATH` | `./pack.md` | The context pack file. |
| `LEDGER_PATH` | `./ledger.json` | The cost ledger; empty string disables persistence. |
| `POLL_MS` | `2000` | The poll beat. |
| `INTENTION_EVERY_MS` | `300000` | Presence intentions, at most one per. |
| `SIGHT_EVERY_MS` | `300000` | A frame on the slow cadence, at most one per. |
| `DAILY_CALL_CAP` | `200` | Model calls per UTC day. |
| `DAILY_OUTPUT_TOKEN_CAP` | `60000` | Output tokens per UTC day. |
| `DAILY_FRAME_CAP` | `60` | Frames viewed per UTC day. |
| `DIRECTOR_GREETING` | (built in) | The one greeting per visit. |

## Deploy to Railway

The owner runs this from a local checkout; the chat side cannot deploy.

1. In the Railway project that holds the Reseed Agent Bridge relay, add a
   new service from this repository and set its **root directory** to
   `bridge/`. `railway.toml` carries the build (`npm install && npm run
   build`) and start (`npm start`) commands.
2. Set the variables above in the service, at least `DIRECTOR_ENABLED=true`
   and `ANTHROPIC_API_KEY`. Secrets live in Railway's variables, never in
   the repo.
3. The channel: a Railway service cannot reach a harness on your laptop.
   For the seam line, run the harness somewhere the service can reach
   (its own tiny service, `HARNESS_URL` pointing at it) and point the
   town at the same URL. For the private town, Adapter B waits on Gate 0.
4. The pack: mount or commit a `pack.md` the chat side can refresh (a
   Railway volume at the `PACK_PATH`, or a small sync job). The loader
   polls its mtime every five seconds.
5. Watch the logs: `greeted`, `answered: …`, `intended: …`, and `channel
   unreachable … folding quietly` are the whole vocabulary.

## Tests

```
bun test bridge/src          # from the repo root, or `bun run test` here
```

They pin the output filter's rules, pack loading and reload, the cost
caps, the poll-and-answer loop against the fake channel (mail answered
before presence, one greeting, partial then final speaks, caps honored,
a dead channel folds quietly, the off state idles), and the seam adapter
against Task 4's harness over real HTTP.
