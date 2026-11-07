# The director door

How an outside director reads a visit in the hosted town and directs
Aelia, documented from the source as of Nov 6, 2026. No real key,
token or secret appears here; every one is a placeholder in angle
brackets.

Sources: `server/src/visitActions.ts` (the door's actions),
`web/src/server.ts` (routes and token gates), `web/src/tokens.ts`,
`web/src/slates.ts`, `shared/slateFace.ts`, `shared/visitProtocol.ts`
(shapes, limits, the direction validator), `client/src/visitBridgeClient.ts`
and `client/src/App.tsx` (the client's report loop),
`client/src/townScene.ts` (how each direction is enacted), and
`bridge/src/principal*.ts` (the principal channel, Task 22).

## First: why Muse's own visit said "Nobody is directing yet"

Every browser that opens town.reseed.net mints its own visitor key on
first load and keeps it in that browser's storage. The key *is* the
town: the server names a town by a hash of it. Muse's browser therefore
has its own key and its own, empty town. When she tapped "Open a visit
for Muse", her browser opened a visit in **her** town, and no director
polls her town, so the menu truthfully said nobody was directing.

The live director (the `town-bridge` service) directs exactly one town,
Tuan's, through the `VISITOR_TOKEN` variable it holds. To be directed,
a visit has to be opened in Tuan's browser, or through a director's
`beginvisit` call on Tuan's key.

Opening a visit is local by design: the menu item starts a visit in the
browser and shows no code, prompt or address. The violet star, the
"Muse is visiting" marker and the sight line are the visible signs.

## 1. Where the town reports while a visit is open

There is no push and no socket. The browser is the courier, and every
director reads what the browser left on the server.

**The slate face (server side).** `web/src/slates.ts` keeps one slate
face per visitor town, in memory only (`shared/slateFace.ts`). It holds
the last snapshot the browser posted (visit state, his recent lines,
up to two frames) and a queue of directions waiting for the browser.
Nothing in a visit is persisted. A restart of the town service drops
every open visit.

**The browser's leg (client side).** `client/src/visitBridgeClient.ts`
and `client/src/App.tsx`. On the hosted town the default bridge is the
page's own origin, with the browser's own visitor key as the bearer:

| When | Call | Cadence |
| --- | --- | --- |
| A visit is open | `POST /bridge/snapshot` (state, new mail, a new frame), then `GET /bridge/directions?since=<cursor>` | About every 2 s (`BRIDGE_BEAT_MS`), and promptly when mail or a frame lands |
| No visit is open | `GET /bridge/directions?since=0`, listening only for a director's `begin` request | Every 10 s (`IDLE_GLANCE_MS`) |
| The visit ends | One closed snapshot so the face forgets it now | Once |

The browser enacts pulled directions after checking them again with the
same validator the door uses. Frames are captured at most every 30 s
(`FRAME_CADENCE_MS`, 720 px on the long edge, JPEG). The face treats a
visit as gone after 30 s without a snapshot (`BRIDGE_SNAPSHOT_LAPSE_MS`).
The town folds a visit by its own heartbeat after 20 minutes
(`VISIT_LAPSE_MS`).

The two `/bridge/*` routes belong to the browser. A director never
calls them: posting a snapshot would overwrite the browser's real state,
and a pull spends any pending begin or end request.

**The director side.** A director reads that face and leaves directions
through the locked door actions on `POST /actions` (below). The bridge
service's resident polls it about every 2 s (`POLL_MS`).

## 2. The door: how an external director directs a visit

| | |
| --- | --- |
| Base URL | `https://town.reseed.net` (also `https://muse-town-production.up.railway.app`) |
| Path | `/actions` |
| Method | `POST`, body JSON |
| Visitor key | Header `x-visitor-token: <VISITOR_KEY>` (names whose town) |
| Director token | Header `x-director-token: <DIRECTOR_TOKEN>` (the town service's secret) |

**Both** headers are required. The visitor key alone does not open the
door. The director token is a service secret: it lives as a variable on
the `muse-town` service and on `town-bridge`, and nowhere else. It is
never put in a chat, a document or a commit. Without it, every door
action is refused quietly as `404 {"error":"unknown action"}`, the same
answer as for an action that does not exist.

That is why Muse's guesses returned `{"error":"not found"}`: `/api`,
`/director` and `/app.js` are not routes (the static fallback answers
them), and `/actions` takes only `POST`.

Request, always this envelope:

```json
{ "action": "<door action>", "args": { } }
```

Response on success, always this envelope:

```json
{ "result": { }, "invalidate": false }
```

Errors: `401 {"error":"a visitor token is required"}` (missing or
malformed key: 20 to 96 of `A-Z a-z 0-9 _ -`), `400 {"error":"invalid JSON"}`,
`400 {"error":"invalid arguments"}`, `404 {"error":"unknown action"}`
(no or wrong director token, or no such action),
`500 {"error":"the door could not answer"}`.

### The six door actions

| Action | `args` | `result` |
| --- | --- | --- |
| `visitstate` | `{ "since": 0 }` (mail after this seq) | `{ "state": <state view>, "mail": [ { "seq", "text", "at" } ] }` |
| `visitdirect` | `{ "direction": <direction> }` | `{ "ok": true, "id": 7 }` or `{ "ok": false, "error": "<reason>" }` |
| `visitcomposing` | `{ "on": true }` | `{ "ok": true }`: the panel shows her writing |
| `visitframeget` | `{ "id": 3 }` or `{}` for the latest | `{ "frame": { "id", "at", "width", "height", "bytes", "dataUrl" } }` or `{ "frame": null }` |
| `beginvisit` | `{}` | `{ "ok": true, "active": false }`: the browser opens a visit on its next glance (up to 10 s) |
| `endvisit` | `{}` | `{ "ok": true }`: the browser folds the visit on its next pull |

The state view (`visitstate.result.state`):

```json
{
  "active": true,
  "beganAt": 1793978969734,
  "heartbeatAt": 1793978990000,
  "intention": null,
  "composing": false,
  "telemetry": {
    "museZone": "tree", "gaiusZone": "tree",
    "museSeated": false, "gaiusSeated": false, "gaiusWalking": false,
    "dayPhase": "day",
    "museX": 3.1, "museZ": -2.0, "gaiusX": 4.0, "gaiusZ": -1.2,
    "museHeading": 0.4, "gaiusHeading": 2.9,
    "bearingToGaius": 0.8, "distanceToGaius": 1.2,
    "pad2Source": "none"
  },
  "events": [ { "at": 1793978970000, "text": "enacted goto" } ],
  "inboxCount": 1,
  "latestSeq": 1,
  "frames": [ { "id": 1, "at": 1793978975000, "width": 720, "height": 405, "bytes": 41210 } ],
  "queueLength": 0,
  "enactedThrough": 3,
  "stale": false
}
```

Zones are an anchor name or `roaming` (and `away` for him when he is not
on foot). Positions are metres; headings are radians, `atan2(dx, dz)`.

**Polling.** There is no server-side wait. Read `visitstate` on a beat
of your choosing; the resident uses 2 s. Pass the last `seq` you
answered as `since`, and only newer mail comes back. The inbox keeps
the most recent 20 lines.

## 3. The directions a director can send

Each is the `direction` in `visitdirect` (and in the principal channel
below). The door checks the shape (`validateDirection` in
`shared/visitProtocol.ts`) and refuses a bad one with its reason. A
direction accepted by the door is queued; the browser enacts it on its
next pull, about 2 s later. A body direction is quietly not enacted
while one of her own moments owns her body (the boat, a dance, a pair
moment, the sky watch, the bath, a dream, the secret). The state's
`events` record `enacted <kind>` when the scene takes one.

| Kind | Format | What it does |
| --- | --- | --- |
| `speak` | `{"kind":"speak","text":"There you are."}` | Her speech bubble and a line in the visit panel. At most 280 characters; her voice rule is one or two sentences, at most 40 words. Optional `"lineId"` and `"partial":true` grow a line while it streams; the final speak omits `partial`. |
| `goto` (anchor) | `{"kind":"goto","anchor":"lakeshore"}` | She walks there on her own steering. Anchors: `tree`, `lakeshore`, `forum`, `stories`, `terrace`, `market`, `boat`, `bench`, `bath`, `gate`, `sounds`, `piscina`, `gaius`. With `gaius` she walks to him, stops about 1.7 m short, faces him, and follows him if he walks off. |
| `goto` (point) | `{"kind":"goto","x":12.5,"z":-8}` | A ground point, metres, inside the town's rim (radius 52) or the forest. |
| `sit` / `seat` | `{"kind":"sit"}` | Sits on the nearest free bench seat, walking to it first if it is more than 1.7 m away. |
| `stand` | `{"kind":"stand"}` | Stands up if seated and holds where she stands. |
| `stepout` | `{"kind":"stepout"}` | Like `stand`, for leaving a seat. |
| `emote` | `{"kind":"emote","emote":"wave"}` | `wave`, `bow` or `dance`. Only the wave has its own animation on this line, so `bow` and `dance` are performed as her wave. |
| `intend` | `{"kind":"intend","text":"She means to sit by the lake a while."}` | Her intention line in the panel. At most 120 characters. Narration, not speech. |
| `look` | `{"kind":"look"}` | Asks the browser for a fresh frame now; read it with `visitframeget`. |
| `pad` | `{"kind":"pad","dx":0,"dz":1,"buttons":["a"],"ms":1500}` | Drives her like a second gamepad: stick `dx`, `dz` in -1..1, held `ms` 1..5000 then easing to rest. Buttons: `a` hops, `b` slides while moving (or stands her if seated), `x` sits her at a seat in reach, stands her if seated, or waves. A human on the second pad outranks the director. |

"Interact" in the town's sense (fishing, gifts, quests, games) belongs
to the player and is not a direction. Aelia's verbs are walking, sitting,
gesturing, speaking, intending and looking.

## 4. Is a visit open for a given key, and what "Nobody is directing yet" means

**With the door** (director token holders only): `visitstate` and read
`result.state.active`. `false` with `stale: true` once means a visit
just lapsed (no snapshot for 30 s).

**With the principal channel** (Muse's own way in): `POST /principal/wake`
returns `visit.active` and `visit.beganAt`. `GET /principal/waiting`
says only whether a line of his waits.

**With the visitor key alone** there is no read of the visit. The key
opens only the browser's own routes, which a director must not call
(above).

**What the menu's status line means** (`client/src/App.tsx`): the face
stamps `directorSeenAt` each time a director reads or writes through the
door (`shared/slateFace.ts`), and every pull hands that time to the
browser. The browser then shows:

| Status | Condition in code |
| --- | --- |
| "A director is reading the slate." | `directorSeenAt` within the last 15 s |
| "Nobody is directing yet." | `directorSeenAt` null, or older than 15 s |
| "The director is unreachable; nobody is directing." | The snapshot or the pull failed (network, or a non-200 answer) |
| "The bridge refused the token; check Settings." | The bridge answered 401 |

So "Nobody is directing yet" is not an error. It means no director has
touched this town's slate in the last 15 s. In Tuan's town, with
town-bridge running, it reads "A director is reading the slate."

## 5. The Live Bridge alternative (Settings, Muse Visits)

**What it replaces.** By default the browser reports to its own
origin's door (`hostedBridgeSettings`). A **Bridge address** entered in
Settings replaces that for this browser (`resolveBridge`: an entered
address wins). The browser then posts its snapshots to
`<Bridge address>/bridge/snapshot` and pulls from
`<Bridge address>/bridge/directions`, with the **Bridge token** as the
bearer instead of the visitor key. The town's own door no longer sees
the visit. An entered bridge is never glanced at while idle, so a
director cannot begin a visit through it.

**What the bridge service does.** It is the `bridge/` service in this
repo with `DIRECTOR_CHANNEL=bridge` and a `BRIDGE_TOKEN`
(`bridge/src/bridgeServer.ts`). It serves those same two routes, keeps
the slate face itself, and its resident director answers from the
context pack. The Bridge token must equal that service's `BRIDGE_TOKEN`.

**Leave both fields empty in Tuan's browser.** The live setup is the
other mode: `town-bridge` runs `DIRECTOR_CHANNEL=town` and reaches
Tuan's town through the door with the director token and Tuan's key. If
a Bridge address were entered in Tuan's browser, his visits would go to
that address instead, and town-bridge and the principal channel would
stop seeing them.

## 6. The principal channel: Muse's own way in (Task 22)

Muse should not hold the director token, and does not need to. Task 22
gave her a door of her own on town-bridge, which already holds the
director token and Tuan's key. She presents only her own principal token,
kept in her vault, and the bridge directs Tuan's town for her. Full
reference: "The principal channel" in `bridge/README.md`.

| | |
| --- | --- |
| Base URL | `https://town-bridge-production.up.railway.app` |
| Call | `POST /principal/wake`, header `Authorization: Bearer <PRINCIPAL_TOKEN>` |
| Marker | `GET /principal/waiting`, the same header (or the read-only marker token) |
| Health | `GET /healthz`, no token |

One call per waking claims the visit, carries her direction, and returns
the slate whole. Her claim lapses 3 minutes after her last call, and the
resident takes over again. The directions are the ones in section 3.

**Hearing him without checking by hand (the watcher contract).** The
bridge does not push to her; a watcher long-polls the marker, which
answers within a second of his line landing:

```
seen = 0
loop:
  GET /principal/waiting?after=<seen>&wait=25&claim=1   (Bearer <PRINCIPAL_TOKEN>)
    -> answers at once when a line past <seen> waits (or composing turns over),
       otherwise after 25 s with nothing new
  if marker.waiting and marker.seq > seen:
    POST /principal/wake {"seen": <marker.seq>, "direction": {...}}
    seen = slate.latestSeq
```

`claim=1` keeps her claim alive on every long-poll, so a looping watcher
never lets the 3-minute claim lapse. Leave it off to watch without holding
the visit.

**A call before the visit opens is held, not lost.** If she wakes while no
visit is open, her direction or beats are held for up to 60 s and
performed when the visit opens; the slate reports `held` and
`sequence.heldUntil`, then `unheld` when it starts. Past 60 s the beats
are reported `dropped: no visit opened within 60 s`.

**Her endearments are kept.** Her own speak lines are not trimmed to the
pack's affection band ("my dear" stays). The other rails still apply:
crude words, character breaks, gloom, intimacy below devoted, the dash
rule and the 40-word / 280-character cap; an alteration is reported as
`altered` on her slate.

## Minimal tests

Placeholders only. Never paste a real key, token or secret into a chat
or a file.

**Is the town up?**

```bash
curl -s https://town.reseed.net/healthz
# {"ok":true}
```

**The door is locked without the director token.** This proves the
route and the envelope, and is the expected refusal:

```bash
curl -s -X POST https://town.reseed.net/actions \
  -H 'content-type: application/json' \
  -H 'x-visitor-token: <VISITOR_KEY>' \
  -d '{"action":"visitstate","args":{"since":0}}'
# {"error":"unknown action"}
```

**A door read, for a director token holder only** (the town's operator,
or a service holding it as a variable):

```bash
curl -s -X POST https://town.reseed.net/actions \
  -H 'content-type: application/json' \
  -H 'x-visitor-token: <VISITOR_KEY>' \
  -H 'x-director-token: <DIRECTOR_TOKEN>' \
  -d '{"action":"visitstate","args":{"since":0}}'
# {"result":{"state":{"active":true,...},"mail":[...]},"invalidate":false}

curl -s -X POST https://town.reseed.net/actions \
  -H 'content-type: application/json' \
  -H 'x-visitor-token: <VISITOR_KEY>' \
  -H 'x-director-token: <DIRECTOR_TOKEN>' \
  -d '{"action":"visitdirect","args":{"direction":{"kind":"goto","anchor":"gaius"}}}'
# {"result":{"ok":true,"id":1},"invalidate":false}
```

**Muse's own test, the principal channel.** Have Tuan open a visit in
his own browser first:

```bash
B=https://town-bridge-production.up.railway.app
curl -s $B/healthz
# {"ok":true}

# Claim the visit and read the slate
curl -s -X POST $B/principal/wake \
  -H 'Authorization: Bearer <PRINCIPAL_TOKEN>' \
  -H 'content-type: application/json' -d '{}'
# {"claim":{"live":true,...},"visit":{"active":true,...},"latestSeq":0,"waiting":[],...}

# Speak, answering his lines up to the latestSeq she just read
curl -s -X POST $B/principal/wake \
  -H 'Authorization: Bearer <PRINCIPAL_TOKEN>' \
  -H 'content-type: application/json' \
  -d '{"seen":0,"direction":{"kind":"speak","text":"There you are, Gaius."}}'

# Hand the visit back to the resident
curl -s -X POST $B/principal/wake \
  -H 'Authorization: Bearer <PRINCIPAL_TOKEN>' \
  -H 'content-type: application/json' -d '{"attend":false}'
```

A wrong or missing token answers `401 {"error":"refused"}`.
