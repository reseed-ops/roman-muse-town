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

## The town channel (Task 8)

A hosted town (`web/README.md`) holds one slate face per visitor behind
its own door: the locked visit actions, admitted only with the town
service's `DIRECTOR_TOKEN` beside the visitor's own token. With
`DIRECTOR_CHANNEL=town` this bridge reads and directs that one visitor's
visit through the door (`src/townChannel.ts`), and the director loop is
untouched: it sees one more `DirectorChannel`. The visitor's client feeds
the face itself, through the same two bridge routes as Task 7, on its own
origin; nothing here calls into the client. `beginvisit` and `endvisit`
are at the door too, for the owner's own Muse to open or fold a visit by
hand (`curl -X POST $TOWN_URL/actions -H "x-director-token: …" -H
"x-visitor-token: …" -d '{"action":"beginvisit","args":{}}'`); the loop
never calls them.

## Many towns: pairing (Task 29)

On the town channel the bridge also serves any visitor's town for that
visitor's own Muse, with no setup by the owner. Pairing is on unless
`PAIRING=off`; it needs only `TOWN_URL` and `DIRECTOR_TOKEN`.

1. In the town, the visitor taps **Connect my Muse**. The browser asks
   its own town for a one-time code (`POST /bridge/pair`, its visitor
   key as the bearer). Codes live 10 minutes, are single use, one per
   town, in memory on the town service.
2. The visitor pastes the town's message to their Muse. She sends
   `POST /pair {"code":"XXXXX-XXXXX"}` here (no token).
3. The bridge redeems the code on the town's director-only route
   (`POST /director/pair-redeem`, director token header) and receives
   that visitor's key. It stores nothing: it seals the key (AES-256-GCM)
   into the token it returns, `{"principalToken":"mtp1...."}`.
4. She uses that token exactly like the owner's principal token, on
   `POST /principal/wake` and `GET /principal/waiting` (the routes and
   the watcher contract below are unchanged).

Isolation: the token unseals to one town and cannot be edited to name
another (the seal is authenticated). Each paired town has its own desk:
claim, held wake, waiting line and transcript, made on its first call
and dropped after 15 minutes idle. The marker token reaches the owner's
town only. Paired towns have no resident: while their Muse is away his
lines wait for her (a town never paired plays as ever, with Aelia's own
voice), and her lines pass the output filter at the strictest band.
The owner pairing his own town reaches his own desk.

Responses from `POST /pair`: `200 {"principalToken"}`, `404` unknown or
expired code, `429` past the per-caller limits (8 wrong codes or pending attempts, 5 successful pairings, 2 in flight, per address per ten minutes; 120 misses and 16 in flight overall, so a caller forging addresses meets the overall ceiling; slots are reserved before the town is asked, `bridge/src/pairLimiter.ts`), `502` the town could not be reached.

Expiry and revocation (Task 63). A paired token is a sealed, versioned
payload (AES-256-GCM, fresh 96-bit IV): the town's key, a token id, issue
and expiry times, the audience `town-bridge`, and the town's pairing
generation. It is refused when it is edited or not ours, is the older
untimed kind (re-pair once), has expired (`PAIRED_TOKEN_DAYS`, default 90:
pair again), or its generation is older than the town's. What revokes what,
exactly:

| To retire | Do this |
|---|---|
| one town's tokens, all of them | the visitor taps **Disconnect my Muse** in the town (Connect my Muse panel; `POST /bridge/disconnect` on the town, authenticated by the visitor's own key), or **pairs again**: either moves the town's generation on, and every token sealed before is refused within seconds. This is the rotate control. |
| every paired token at once | rotate `PAIRING_SECRET`, when it is set (it is the seal key). |
| every paired token at once, `PAIRING_SECRET` unset | rotate `DIRECTOR_TOKEN` (the seal key then derives from it). |
| (does not revoke) | rotating `DIRECTOR_TOKEN` while `PAIRING_SECRET` is set: the seal key does not change, so old tokens still unseal. The director token only opens the town's door for the bridge; set a new one on both services together. |
| (does not revoke) | the visitor changing browser: the new browser is a new town; the old town's token still works for the old town until that town is disconnected or the token expires. Idle-desk cleanup (15 minutes) is not revocation either. |

The generation lives on the town (`public.town_pairing`, beside the towns'
schemas, untouched by saves and restores); the bridge keeps no list and
reads the current generation with each state read (cached 3 s), refusing
a token when the town cannot be reached. A copy of the town a Muse has
already seen cannot be taken back.

## The principal channel (Task 22)

On the town channel, with `PRINCIPAL_TOKEN` set, the bridge serves one
caller: the owner's own chat Muse, who attends his hosted town in place
of the resident while her claim lives. The resident stays the default
attendant: it greets, answers and intends whenever no claim is live.

Routes (Bearer token, constant-time compare, bare 401 on a miss):

| Route | Token | Answer |
| --- | --- | --- |
| `POST /principal/wake` | principal | Her call: claims (or keeps) the visit, carries her direction, returns the slate whole. |
| `GET /principal/waiting` | principal or marker | `{waiting, seq, at, composing, claimLive}`: that a line waits, its number and time. Never its text. Long-polls with `?after=<seq>&wait=<s>`; `claim=1` (principal token only) keeps the claim. |
| `GET /healthz` | none | `{"ok":true}` and nothing else. |

One call per waking. The body of `POST /principal/wake`, every field optional:

```json
{
  "attend": true,
  "seen": 4,
  "beats": [
    { "direction": { "kind": "speak", "text": "Do you hear the fountain?" } },
    { "direction": { "kind": "speak", "text": "It keeps your time." }, "delayS": 4, "when": { "noReply": true } },
    { "direction": { "kind": "emote", "emote": "wave" }, "delayS": 3, "when": { "scene": "tree" } }
  ],
  "drop": { "onReply": true, "onSceneChange": true },
  "frame": false
}
```

- `attend: false` releases the claim at once. Any other call claims it
  or keeps it; three minutes (`PRINCIPAL_CLAIM_MS`) without a call and it
  lapses, and the resident resumes. His lines from the claim are not
  answered again by the resident.
- `direction` (one direction, performed at once) or `beats` (at most 6;
  `delayS` 0 to 120 from the previous beat). Any direction the town
  channel takes: `speak`, `goto`, `sit`, `stand`, `seat`, `stepout`,
  `emote`, `intend`, `look`, `pad`.
- `when.noReply`: fire only if he has sent no line since the call landed.
  `when.scene`: fire only if his scene (`scene.gaiusZone`) is this. An
  unmet condition skips that beat.
- `drop`: the unperformed remainder is dropped when he replies, when his
  scene changes materially (he arrives somewhere else, or leaves his feet;
  drifting into `roaming` is not material), when the visit closes, when
  the claim lapses, and when her next call carries a direction.
- `seen`: the `latestSeq` of the slate her words answer (defaults to the
  last slate she was shown); his lines up to it stop waiting.

- A call that lands while no visit is open is **held**, not dropped: the
  slate reports `held` ("held until the visit opens") and
  `sequence.heldUntil`; when the visit opens within 60 s
  (`PRINCIPAL_HOLD_MS`) the beats start then, at their authored delays,
  and an `unheld` report says so. Past 60 s the beats are reported
  `dropped` ("no visit opened within 60 s") on her next slate.

### The watcher contract (no push needed)

There is no push to her; a watcher long-polls the marker instead, so a
line reaches her within a second of landing:

```
seen = 0
loop:
  GET /principal/waiting?after=<seen>&wait=25&claim=1     (Bearer <PRINCIPAL_TOKEN>)
    -> answers at once when a line past <seen> waits or composing turns over,
       else after 25 s with the marker unchanged
  if marker.waiting and marker.seq > seen:
    POST /principal/wake {"seen": <marker.seq>, ...her words...}   -> the slate
    seen = slate.latestSeq
```

`wait` is capped at 25 s (under Railway's idle timeout). With `claim=1`
each long-poll keeps her claim alive at its start and at its answer, so a
looping watcher never lets the 180 s claim lapse; drop `claim=1` (or use
the marker token, which can never claim) to watch without holding the
visit. `after` defaults to "any waiting line".

The slate: `claim` (live, since, lastCallAt, expiresAt), `visit`,
`scene` (the town's telemetry: her zone and position, his, distance,
seated, day phase), `intention`, `composing`, `latestSeq`, `waiting` (his
unanswered lines), `transcript` (the last 30 lines, both sides, hers
marked `principal` or `resident`), `sequence` (beats still to come), and
`reports`: everything since her last slate, each beat `performed` (with
the condition that governed it, and `altered` if the filter changed her
words), `dropped` (with why), `refused` (with the filter's or the town's
reason), and each `acknowledged` line.

The honesty rule: the bridge never composes, extends or paraphrases her
words. Her lines pass the same output filter as the resident's and the
town's own direction checks, with one difference: her endearments ("my
dear", "love", "darling", ...) are kept whatever the pack's band, since
they are her words, not the resident's reach; the band trims only the
resident's lines. Every other rail holds for her too (crude words,
character breaks, gloom, intimacy below devoted, the dash rule, the
40-word and 280-character caps); a refusal is reported
on her next slate, never dropped silently. When a sequence runs out she
is silent until her next call. While her claim lives, a newly landed line
is acknowledged with presence only: she walks to him (a `goto` to
`gaius`, which turns her to face him when near; seated beside him she
stays seated) and the panel shows her composing. Never words.

The log: every call whole with its timestamp (`principal call <iso>: <body>`),
every beat performed, skipped, dropped or refused with its condition,
each acknowledgment, and each claim, release and lapse. Tokens are never
logged.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `DIRECTOR_ENABLED` | `false` | Off unless `true`; off, the process idles. |
| `ANTHROPIC_API_KEY` | (none) | The owner's key. Required to answer. Never in the repo. |
| `DIRECTOR_CHANNEL` | `seam` | `seam` (Adapter A, polls the harness), `bridge` (Adapter B, serves the face; `slate` is accepted as its old name) or `town` (calls the hosted town's door, Task 8). |
| `TOWN_URL` | (none) | The hosted town's origin (`town` only), e.g. `https://town.reseed.net`. |
| `DIRECTOR_TOKEN` | (none) | The town service's director token (`town` only). Never in the repo. |
| `VISITOR_TOKEN` | (none) | The one visitor whose town this bridge directs (`town` only): the owner's own visitor key from the town's Settings. Never in the repo. |
| `BRIDGE_TOKEN` | (none) | The per-installation token the town presents. Required for `bridge`; without it the face does not serve. Never in the repo. |
| `PORT` | `8790` | The face's port (`bridge`, and `town` with a principal token; Railway sets it). |
| `PRINCIPAL_TOKEN` | (none) | The principal channel (Task 22, `town` only): the one token the owner's chat Muse presents. Unset, the channel does not serve. Rotate it to revoke. Never in the repo. |
| `PRINCIPAL_MARKER_TOKEN` | (none) | A lesser, read-only token for `GET /principal/waiting` only. Optional; the principal token reads the marker too. Never in the repo. |
| `PRINCIPAL_CLAIM_MS` | `180000` | Her claim lapses this long after her last call, and the resident resumes. |
| `PAIRING` | on | `off` turns pairing off (Task 29): no `POST /pair`, no paired tokens. |
| `TRUST_PROXY` | (on Railway) | `1`/`0`: read `X-Real-IP` as the caller's address at `/pair`. Default on when Railway's own variables are present, off elsewhere; `X-Forwarded-For` is never read. |
| `PAIRING_SECRET` | (derived) | Seals paired tokens. Unset, a key is derived from `DIRECTOR_TOKEN`. Rotating the seal key retires every paired token; if this is set, rotating `DIRECTOR_TOKEN` alone does not. Never in the repo. |
| `PAIRED_TOKEN_DAYS` | `90` | How long a paired token lives before the Muse must pair again. |
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
