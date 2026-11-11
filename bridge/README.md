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
| `GET /principal/events` | principal, paired or marker | Server-sent events (Task 66): the marker on connect and on every change; `claim=1` (principal) keeps the claim while open. |
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

### Push delivery (Task 66, reworked in Task 67): the box subscribes and is told

`GET /principal/events` is a server-sent-events stream (the principal
token, a paired token for its own town, or the read-only marker token).
Railway cannot dial the box, so the box dials out and holds the stream;
the bridge pushes `event: marker` with the waiting marker on connect and on
every change, plus a `: keepalive` comment every 15 s. A line that landed
while the stream was down is the first event after it returns, because the
marker is state, not a queue.

**The marker** (never text):
`{waiting, seq, at, composing, claimLive, visit, rev, latestSeq, lastLineAt}`.
- `visit`: the open visit's id (its beginning, ms), null when none.
- `rev`: rises by one whenever anything in the marker changes. A new desk
  starts above both the clock (ms) and a stored high-water mark
  (`REVISION_PATH`, reserved in blocks of 1000), so it exceeds everything the
  previous desk issued, also if the clock went back. The file lives in the
  container's disk: on a host without a volume it is lost on redeploy and
  only the clock seed holds (a fresh deploy takes far longer than the
  changes it could have issued). A watcher discards a marker older than one
  it has applied.
- `latestSeq`, `lastLineAt`: the newest line number of the open visit and
  when the bridge first saw it (the bridge's clock). They say a line exists
  even when the resident is answering it, so a watcher that does not claim
  can learn of it and decide whether to claim. No text.

**The claim model (decided, Task 67): she is told only by claiming first, or
she watches the line signal and decides.** There are two ways to listen and
one way to hold the visit:
1. *Holding the visit* is done by a real `POST /principal/wake`, and only
   that. A heartbeat (`claim=1` on the stream or the long-poll) never takes
   a claim, never undoes a release, and never starts one.
2. *Keeping it between wakes*: with the principal token, `claim=1` renews a
   claim she already holds, on open and every 15 s, but only while her last
   real wake call is less than 10 minutes old (`PRINCIPAL_HEARTBEAT_CLAIM_MS`
   in code). After that the heartbeat is ignored and the claim lapses 180 s
   later (`PRINCIPAL_CLAIM_MS`) and the resident resumes. A responder that
   is alive makes a wake call at least that often.
3. *Release* (`{"attend": false}`) hands the visit back at once; no heartbeat
   re-takes it, and a new claim needs a new real wake.
4. *Listening without holding*: the marker token (or the principal token
   with `claim` off) sees the marker, including `latestSeq` and
   `lastLineAt`, and can never claim, however it is asked. With the resident
   present and no claim, `waiting` stays false (the line is the resident's);
   a watcher with `work: "lines"` / `WATCH_WORK=lines` treats any new line
   in an open visit as work.
`watch.ts` also stops asking for the claim (it reconnects without
`claim=1`) after 3 command failures in a row or a command stuck for 60 s, so
a claiming watcher never holds the visit for a composer that is not working.
Do not run a claiming watcher without a responder behind it.

**Eviction and who may open streams.** At most 3 claim-holder streams per
desk (the principal token, a paired token), and separately at most 1
read-only observer stream (the marker token). A new stream past its own
class's cap closes the oldest of that class; an observer never evicts a
claim holder. 64 streams in all, counted after the eviction a new stream
would make, so a desk's own reconnect is never refused because the server is
full. Empty per-desk entries are deleted when the last stream closes.

**Rate limits.** Failed authentication on the principal routes (and every
lookup of a paired token) goes through the pairing limiter: 8 misses per
source address per 10 minutes, 2 lookups in flight per address, 16 overall;
past them the answer is 429. Stream connection attempts are limited to 30
per minute per source address and 20 per minute per credential (a digest
used only as a counter key). Refusals are logged once per kind per 10
seconds with a count of those held back, never a token.

**Revocation window.** A stream's credential is checked again every 60 s
(`STREAM_RECHECK_MS`): the owner's and marker tokens by comparison, a paired
token by the same resolve a new request makes (HMAC, expiry, pairing
generation, which has its own 3 s cache). Unpair or expire a paired token
and its stream ends, with its claim renewals, within about 65 s; the
stream's own life is 10 minutes (`STREAM_MAX_MS`), and rotating
`PRINCIPAL_TOKEN` restarts the service, which ends every stream. A credential
that cannot be checked ends the stream (the poll fallback carries on).

**Slow readers.** Markers are state, so while a socket is full only the
latest marker is kept and written when it drains. A stream with more than
64 KB unsent, or one that stays full for 30 s, is cut; the watcher
reconnects.

**Delivery is best-effort notification with retries, not exactly-once.** A
burst can reach a watcher as only its newest state; the watcher dedupes by
work identity, the pair (visit, line number), discards a marker whose `rev`
is older than one it has applied, and keeps the last acknowledged work in a
small state file (`WATCH_STATE`, default `~/.muse-watch-state.json`: a visit
number and a line number, no text). A line can still reach the command
twice (a restart before the state was written, a command that posted and
then failed), so the answer side is idempotent: the wake call carries
`seen` and `visit`; a repeat `speak` for a line already answered sends
nothing (the slate says so in `note`), and a call for a visit that is not
the open one is refused. The command fetches a fresh slate and wakes with
`{"seen": $MUSE_LINE_SEQ, "visit": $MUSE_VISIT, ...}`. The command runs one
at a time under a deadline (`WATCH_CMD_TIMEOUT_S`, default 120 s) and is
aborted when it passes it or the watcher stops; a stuck command never
blocks the newest line.

SSE was chosen over a websocket (needs an upgrade path and framing the
proxy and the box do not need) and over the existing long-poll (which
needs a reconnect per answer and a waking loop on her side). It is one plain
GET, works through NAT, needs no dependency and degrades to the poll.

The subscriber is `bridge/src/watch.ts`, the recipe for the owner's side:

```
BRIDGE_URL=https://town-bridge-production.up.railway.app \
PRINCIPAL_TOKEN=... WATCH_CMD='/path/to/wake-muse.sh' bun run bridge/src/watch.ts
```

It prints one JSON line per work item (`line`, `visit`,
`bridgeFirstObservedAt`, `receivedAt`, `callbackStartedAt`; no text) and runs `WATCH_CMD` with `MUSE_LINE_SEQ` and
`MUSE_VISIT` set. A stream with no bytes for 45 s (the bridge beats every
15 s) is dropped and reconnected, with backoff 1 s doubling to 30 s,
jittered; the once-a-minute poll of `/principal/waiting` runs beside it as
the fallback (`WATCH_POLL_S`).

**Latency, honestly.** The bridge reads the town on a two-second polling
cadence (`POLL_MS`, plus the read's own time and the pause between reads) and
the push hop after that is a few milliseconds in the tests. So a line
reaches a subscriber after up to about two seconds of polling cadence plus
processing and network time: not a floor, and not a guaranteed ceiling. The
only figure measured is local and from a fake channel (one sample of about
1.3 s with a fixed phase in `push.test.ts`); no live figure has been
measured, and the agent run that composes her reply (seconds to tens of
seconds) dominates anyway. Metadata-only timing is in place: the bridge logs
`line N handed to the socket X ms after the bridge first observed it (not
client receipt)` per line per stream (when the marker is actually written to
the socket, not when it was queued; a marker coalesced away never logs), and
the watcher prints `bridgeFirstObservedAt`, `receivedAt` (this process took
the marker) and `callbackStartedAt` (the command began, later if another was
running) per line (compare them after checking clock sync on the box). Not yet instrumented, an open item: the
town's own acceptance time to the bridge's read, and the browser's
enactment of her reply.

### The watcher contract (long-poll, still supported)

A watcher can long-poll the marker instead of holding a stream:

```
seen = 0
loop:
  GET /principal/waiting?after=<seen>&wait=25&claim=1     (Bearer <PRINCIPAL_TOKEN>)
    -> answers at once when a line past <seen> waits or composing turns over,
       else after 25 s with the marker unchanged
  if marker.waiting and marker.seq > seen:
    POST /principal/wake {"seen": <marker.seq>, "visit": <marker.visit>, ...her words...}   -> the slate
    seen = slate.latestSeq
```

`wait` is capped at 25 s (under Railway's idle timeout). With `claim=1`
each long-poll renews a claim she already holds, at its start and at its
answer, under the same 10-minute bound as the stream; it never takes one.
Drop `claim=1` (or use the marker token, which can never claim) to watch
without holding the visit. `after` defaults to "any waiting line".

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
| `PRINCIPAL_CLAIM_MS` | `180000` | Her claim lapses this long after her last call, and the resident resumes. A watcher's heartbeat counts as a call only within 10 minutes of her last real wake (fixed in code, Task 67). |
| `WATCH_STATE`, `WATCH_WORK`, `WATCH_CMD`, `WATCH_CMD_TIMEOUT_S`, `WATCH_POLL_S` | see `watch.ts` | The box-side watcher's own settings (not the bridge's): the acknowledged-work file, `lines` to count any new line as work, the wake command and its deadline, the fallback poll. |
| `PAIRING` | on | `off` turns pairing off (Task 29): no `POST /pair`, no paired tokens. |
| `TRUST_PROXY` | (on Railway) | `1`/`0`: read `X-Real-IP` as the caller's address at `/pair`. Default on when Railway's own variables are present, off elsewhere; `X-Forwarded-For` is never read. |
| `PAIRING_SECRET` | (derived) | Seals paired tokens. Unset, a key is derived from `DIRECTOR_TOKEN`. Rotating the seal key retires every paired token; if this is set, rotating `DIRECTOR_TOKEN` alone does not. Never in the repo. |
| `PAIRED_TOKEN_DAYS` | `90` | How long a paired token lives before the Muse must pair again. |
| `BRIDGE_ALLOW_ORIGIN` | `*` | CORS origin for the face; set it to the town's origin to narrow it (the token gates either way). |
| `SNAPSHOT_LAPSE_MS` | `30000` | No snapshot for this long and the held visit dies; the face reads closed. |
| `HARNESS_URL` | `http://localhost:8787` | The seam harness (`seam` only). |
| `DIRECTOR_MODEL` | `claude-opus-5-5` | The model. |
| `PACK_PATH` | `./pack.md` | The context pack file. |
| `REVISION_PATH` | `./revision.json` | High-water mark for marker revisions across restarts; empty string disables. |
| `LEDGER_PATH` | `./ledger.json` | The cost ledger; empty string disables persistence. |
| `POLL_MS` | `2000` | The poll beat. |
| `INTENTION_EVERY_MS` | `300000` | Presence intentions, at most one per. |
| `SIGHT_EVERY_MS` | `300000` | A frame on the slow cadence, at most one per. |
| `DAILY_CALL_CAP` | `200` | Model calls per UTC day. |
| `DAILY_OUTPUT_TOKEN_CAP` | `60000` | Output tokens per UTC day. |
| `DAILY_FRAME_CAP` | `60` | Frames viewed per UTC day. |
| `DIRECTOR_GREETING` | (built in) | The one greeting per visit. |

## Deploy to Railway

The owner (or the Claude box, on the owner's word) runs this from a local
checkout; the chat side cannot deploy.

**The working path is the Docker one**, as the live `town-bridge` service
runs it (reconciled in Task 67; `railway.toml` here now says the same):

- The service's **root directory is `/`** (the upload root), with
  `RAILWAY_DOCKERFILE_PATH=bridge/Dockerfile`. `bridge/` and `shared/` sit
  side by side in the upload, because the bridge's tsconfig compiles
  `../shared/visitProtocol.ts` alongside `src/` and the Dockerfile copies
  both.
- The upload is a clean export, not a git push: the tracked files of
  `bridge/` and `shared/` plus the private `bridge/pack.md`, with
  `node_modules` and `dist` left out, sent with
  `railway up -c --no-gitignore -p <project> -s town-bridge -e production`
  from inside the export.
- The earlier instructions (root directory `bridge/`, the Nixpacks builder,
  `npm install && npm run build` as the build command) no longer describe
  the live service; setting the root to `bridge/` would hide `shared/` and
  fail the build. The live service's settings are changed only by the owner.

Then:

2. Set the variables above in the service, at least `DIRECTOR_ENABLED=true`,
   `ANTHROPIC_API_KEY`, `DIRECTOR_CHANNEL=town` (or `bridge`) and the tokens.
   Secrets live in Railway's variables, never in the repo.
3. The channel: with `bridge`, the town calls the service's public HTTPS
   URL; enter that URL and the same token in the town's Settings, Muse
   Visits. The seam line is for local work.
4. **The pack is baked into the image.** The Dockerfile copies
   `bridge/pack.md` into the image, and the loader's five-second mtime poll
   watches that file, which only changes when the image does. So **a pack
   refresh needs a redeploy** of the bridge with the new `pack.md` in the
   export. Refreshing it without a redeploy would need a Railway volume
   mounted at `PACK_PATH` plus a sync job; as of Nov 11, 2026 no volume is
   attached to `town-bridge` (the project's volumes belong to other
   services), and none has been created. Keep the tended pack's canonical
   copy outside the repo and outside the disposable upload directory.
   Until a tended pack is uploaded, the live pack is `pack.example.md` with
   its rank 4 placeholder; the owner desk's rank is `min(pack rank, the
   town's entitlement rank)` once the town sends the owner's entitlement
   (it does not yet), so the placeholder is today's live state.
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
