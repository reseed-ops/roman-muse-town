# The Live Bridge

The resident director for Muse Visits (Task 6, Nov 2026). While a visit is
open it polls the director channel about every two seconds, answers visit
mail through the Anthropic API under the owner's own key, streams the
answer into Aelia's bubble as partial speaks where the channel carries
them, keeps the visit loop's manners (one greeting, throttled presence
intentions, sight on a look or a slow cadence), and applies the
constitution in code before anything is enqueued.

Since Task 7 (Nov 4, 2026, Gate 0's verdict) the bridge is also a
SERVING face: the town client calls out to it over HTTPS during a visit,
posting its slate snapshot and pulling directions back. The bridge never
calls into the town's platform. See "The bridge leg" below.

## Shape

- `src/channel.ts`: the director channel, one narrow interface: state,
  inbox, one frame at a time, direct, composing, pack. Slate-only by
  construction: there is no write path to facts, letters, bond, or
  digest.
- `src/seamAdapter.ts`: Adapter A, over this line's Task 4 seam harness
  (`harness/visitHarness.ts`) by HTTP.
- `src/slateFace.ts`: Adapter B, the serving face (Task 7). It holds the
  snapshot the town client posts (state, new inbox mail, the latest
  frame, each validated at the door) and the directions the director
  leaves, and reads to the director loop as a channel. When no snapshot
  has arrived inside the lapse window the slate dies and the face reads
  closed: the bridge goes quiet, and the town folds the visit by its own
  heartbeat.
- `src/bridgeServer.ts`: the HTTP carrier for that face, two endpoints
  gated by the per-installation token (`BRIDGE_TOKEN`), compared in
  constant time; a missing or wrong token is refused with a bare 401 and
  logged without the value.
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

## The bridge leg (Task 7)

With `DIRECTOR_CHANNEL=bridge` the process serves the director face on
`PORT` and the town client, during a visit and only when a bridge URL is
set in its Settings (Muse Visits), calls out about every two seconds and
promptly on new mail or a fresh frame:

```
POST /bridge/snapshot          { state, mail, frame }  -> { ok, latestSeq, frameId }
GET  /bridge/directions?since=N                        -> { directions, composing, directorSeenAt }
```

Both carry `Authorization: Bearer <BRIDGE_TOKEN>`. The token is set by
the owner in this service's variables and typed into the town's visit
settings; it is held in that browser only and never committed. The
pulled directions pass the town's seam validator before they reach the
scene, exactly as harness directions do; the composing flag drives the
panel's writing line. With no bridge URL set the town makes no call at
all. The wire shapes live in `shared/visitProtocol.ts` (the Task 7
section). TLS is the host's: Railway terminates HTTPS in front of the
service.

Run it locally against the town:

```
cd bridge
export DIRECTOR_ENABLED=true ANTHROPIC_API_KEY=sk-ant-... \
       DIRECTOR_CHANNEL=bridge BRIDGE_TOKEN=$(openssl rand -hex 24) PORT=8790
bun run dev
```

Then in the town's Settings, Muse Visits, enter `http://localhost:8790`
and the same token, and open a visit from the menu.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `DIRECTOR_ENABLED` | `false` | Off unless `true`; off, the process idles. |
| `ANTHROPIC_API_KEY` | (none) | The owner's key. Required to answer. Never in the repo. |
| `DIRECTOR_CHANNEL` | `seam` | `seam` (Adapter A, polls the harness) or `bridge` (Adapter B, serves the face; `slate` is accepted as its old name). |
| `BRIDGE_TOKEN` | (none) | The per-installation token the town presents. Required for `bridge`; without it the face does not serve. Never in the repo. |
| `PORT` | `8790` | The face's port (`bridge` only; Railway sets it). |
| `BRIDGE_ALLOW_ORIGIN` | `*` | CORS origin for the face; set it to the town's origin to narrow it (the token gates either way). |
| `SNAPSHOT_LAPSE_MS` | `30000` | No snapshot for this long and the held visit dies; the face reads closed. |
| `HARNESS_URL` | `http://localhost:8787` | The seam harness (`seam` only). |
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
   The build compiles `../shared/visitProtocol.ts` alongside `src/`, so
   the build context must include the repository's `shared/` directory:
   if the service's root-directory isolation hides it, set the root
   directory to the repository root instead, with the build command
   `cd bridge && npm install && npm run build` and the start command
   `cd bridge && npm start`.
2. Set the variables above in the service, at least `DIRECTOR_ENABLED=true`,
   `ANTHROPIC_API_KEY`, `DIRECTOR_CHANNEL=bridge` and a long random
   `BRIDGE_TOKEN`. Secrets live in Railway's variables, never in the repo.
3. The channel: with `bridge`, the town calls the service's public HTTPS
   URL (Railway's generated domain, or your own); enter that URL and the
   same token in the town's Settings, Muse Visits. The seam line is for
   local work: a Railway service cannot reach a harness on your laptop.
4. The pack: mount or commit a `pack.md` the chat side can refresh (a
   Railway volume at the `PACK_PATH`, or a small sync job). The loader
   polls its mtime every five seconds.
5. Watch the logs: `greeted`, `answered: …`, `intended: …`, `channel
   unreachable … folding quietly`, and `refused POST /bridge/snapshot: no
   token` (never the value) are the whole vocabulary.

## Tests

```
bun test bridge/src          # from the repo root, or `bun run test` here
```

They pin the output filter's rules, pack loading and reload, the cost
caps, the poll-and-answer loop against the fake channel (mail answered
before presence, one greeting, partial then final speaks, caps honored,
a dead channel folds quietly, the off state idles), the seam adapter
against Task 4's harness over real HTTP, and the serving face (Task 7):
the token refused on both endpoints, a snapshot-to-answer round trip
against a stub mind over real HTTP, and the lapse. The town's side of
the leg is pinned in `client/src/visitBridgeClient.test.ts` (no call
without a bridge URL; refused directions never reach the queue).
