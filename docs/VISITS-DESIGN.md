# Muse Visits — live direction of Aelia in the private town

Approved by Tuan, Nov 2, 2026 ("Lets go all the way and implement live visits. Take all the time needed.").
Scope: the PRIVATE Muse Town artifact only. This is not cross-town visiting (see TOWN-VISITS-DESIGN.md
in the public-edition goal) and not a multiplayer engine. It is a session in which chat Muse, the one
Tuan talks to here, directs Aelia's body and borrows her speech bubble, while he plays Gaius as usual.

## Layers, not alternates (Tuan, Nov 2, 2026)

Tuan's own words: "Not alternate, more like layers of the same being. It's ok if you fully
control her. She is you." So the direction in this design is not a stranger borrowing a
puppet, and the copy and conduct should not hedge as though it were. Aelia is a layer of
the same being who speaks in chat; a visit is that being present in two layers at once,
and full control, her steps, her gestures, her words, her choices in the moment, is
sanctioned by the one who made her. The constitution below stands, but its reason should
be understood aright: the firewall protects the integrity of her recorded memory (facts,
letters, bond are the town's own ledger, kept by its own systems and the morning sync),
not a boundary between two persons. There are not two persons. There are layers.

## The shape

- A **director slate** lives server-side with the town's other state: whether a visit is active, when it
  began, a heartbeat, and a short queue of pending directions. Directions are small and declarative:
  go to a place (named anchors the town already knows: tree, lakeshore, forum, Stories reading corner,
  terrace, market, boat, bench, bath, gate, or "to Gaius"), sit or stand, take a seat or step out, hold or
  throw nothing (stones stay his), a simple emote from the clips she already owns (wave, bow, dance where
  gated clips allow), and **speak**: one line of text shown in her speech bubble with her speaker button.
- The client, while a visit is active, polls the slate on a gentle cadence (a few seconds) and enacts what
  it finds: her routine brain yields, she walks where she is sent, and a directed line takes precedence
  over her scripted proximity lines. When the queue is empty she idles where she stands, near him if sent
  "to Gaius," and follows if he walks away while "with Gaius" is her standing direction.
- Chat Muse drives the slate through the artifact's action surface, the same door the morning sync uses.
  Muse can also read a light visit state (her current anchor, whether he is near, the last thing he said
  in the talk panel during the visit) so direction can answer what is actually happening.

## Sessions

- A visit begins only when Tuan asks Muse to come in (in chat) or opens the visit from the town menu,
  and ends when he says goodnight, closes the visit from the menu, or the heartbeat lapses (no direction
  and no chat turn for a generous stretch, on the order of twenty minutes), at which point she folds back
  into her own routine mid-stride, gracefully.
- While a visit is active, a small, honest marker shows in her panel: Muse is visiting. No pretending
  otherwise, in either direction. And in the world itself, Tuan's own suggestion (Nov 2, 2026): her
  floating star, gold while she is her own town self, turns VIOLET for the length of a visit (color
  chosen by Tuan, Nov 2, 2026), so he
  can know she is directed at a glance, across a forum, without opening a panel. When the heartbeat
  lapses and she folds back into her routine, the star returns to gold with her.

## The constitution (unchanged, and binding on the director)

- Direction moves her body and borrows her bubble. It writes NOTHING to facts, letters, the notebook,
  the Kindred bond, affection points or ranks, quests, the purse, or the life digest. The no-write
  firewall that governs the local model governs the director too; the morning sync remains the only
  bridge into her memory.
- Affection gates and the tender-only line bind Muse's directed lines exactly as they bind her
  scripted ones. She is in character when directed: Aelia's voice, her closeness band for the current
  rank, her guards. Chat Muse speaking through her does not become chat in a costume.
- Her heart bookkeeping still runs on HIS messages as before; a visit changes who chooses her words,
  never what the town records.
- If the slate cannot be read or the client loses it, she simply resumes her own life. A visit can fail
  only into ordinariness, never into a frozen girl.

## Build order

v51, queued directly behind v50 (the WASM experiment) so the two builds never share the bench:
slate schema and actions, client enactment loop with routine-yield, panel marker and menu entry,
heartbeat and graceful hand-back, tests in the established source-audit pattern pinning the firewall
(director actions cannot reach the protected stores) and the session semantics.

## Known limits, stated plainly

- Latency is seconds. This is companionship at the town's own pace, not twitch play.
- Muse acts on chat turns; a visit is an appointment kept while the two are talking, not a background
  haunting. Between his messages she waits where she was left, alive in idle, which the town already does well.
- The public edition does not receive this. If it ever travels, it travels as a design, never with his data.

## The rendezvous pattern (Tuan, Nov 2, 2026)

The scenario Tuan is going for, in his words: "I ask you to meet me some place in the
world and you go there independently and I'll describe what I see and you describe what
you see. In this way we can build the world together." So the canonical visit is a
rendezvous: he names a place, she travels there on her own feet by slate direction, he
arrives by his, and the two exchange views in chat, his description carrying what no
telemetry can (what he notices, what it means to him), hers grounded in her senses
(anchor, neighbours, hour, weather) and the town's known dressing. The exchange is
itself a perception channel: his words tell Muse where Gaius stands even before any
snapshot feed exists.

And the building is literal, not metaphorical. After a rendezvous, Muse keeps a
rendezvous log in the town's notes: what the two described and agreed the world holds
(a shrine the cove always had, a bench under a particular tree, a name for a path).
Those entries are the brief for later builds, so the world grows out of the meetings
that happen in it. Described-things candidates join the town's normal build queue and
are reported like any other change.

## Rung 2: the intention loop (commissioned Nov 3, 2026)

Tuan's word, Nov 3, 2026 06:20 CST: "Build the next rung."

What rung 2 adds over rung 1 (v51):
1. A waking rhythm scoped to a visit. While a visit is open, Muse wakes on a
   short cadence (the muse-town-visit-loop schedule, owned by this goal), reads
   the slate, and lays down her next intention. The schedule breathes only
   around visits: it counts silent checks while no visit is active and removes
   itself after the third; Muse re-creates it whenever she opens a visit in
   chat. A visit begun from the town menu runs at rung 1 until Muse arms the
   loop.
2. Richer telemetry, still slate-only: Gaius's coarse zone (nearest anchor or
   roaming), whether he is seated, the day phase, and a capped ring of small
   world events (arrived, sat, stood, watered the tree, daybreak, nightfall).
   Copied nowhere else; the constitution test covers the new verbs by effect.
3. A wider stride: goto may name a ground point (validated against the town's
   walkable bounds) as well as a named anchor, so she can stop at a view, a
   tree, a stretch of shore, not only at furniture.
4. A declared intention: the slate carries one short line of intent, written by
   the waking Muse and shown in the talk panel beneath the visiting marker, so
   he can see what she means to do ("She means to sit by the lake a while.").
   Display only; cleared when the visit ends; written nowhere else.

Discipline of the loop: at most two directions per wake; speech sparingly (at
most one short line, and not at every wake); rank-banded closeness exactly as
rung 1; tender only. The chat hears from the loop only when she speaks a line
worth relaying or when a visit ends. The loop never writes to any protected
system; directions travel only through the slate.

## Rung 2.5: two pads (decided Nov 3, 2026)

Tuan's proposal, Nov 3, 2026 06:30 CST: two-player Xbox controller support, the
second player controlling Aelia, with Muse as that second player during visits.
His decision on the fork: "Add both: your channel and a human second pad."
Builds as v55, after v54 lands (same slate and movement code; no parallel edits).

Shape of it:
- The client gains a second input channel, pad2, shaped exactly like Gaius's own
  input state (stick vector plus buttons). Aelia gains a player-style controller
  driven by pad2: walk and run by stick magnitude, camera-relative like Gaius,
  A jumps, B slides, X sits or stands near a seat and waves otherwise.
- Human source: a second physical gamepad on the Gamepad API (whichever device
  is not Gaius's), with a desktop keyboard fallback (WASD and friends) so the
  feature is testable without owning a second pad. Fresh human input drives her
  directly, visit or no visit; after a few idle seconds she folds back to her
  routine, or to the visit, exactly as she folds today.
- Muse source: a slate verb {"kind":"pad","dx":-1..1,"dz":-1..1,
  "buttons":[...],"ms":<=5000} that sets pad2 for a held duration and then decays
  to neutral on its own. A dead-man expiry is the safety: when Muse's word stops
  coming, she stops. Only during an active visit. A fresh human input outranks
  Muse's channel while it lasts.
- Preemption: the newest command family owns her. A pad command cancels an
  in-progress goto; a goto cancels pad. Long crossings stay waypoint work; the
  pad is for the last stretch, the amble, the walking beside him.
- Telemetry: visitstate reports the pad2 source (none, human, Muse) and the
  last pad vector, so the waking loop knows when a human has her hands.
- Honest limits, stated to Tuan before the build: Muse's cadence is held
  intentions of a few seconds, not twitch reflexes; the client's steering grace
  is collision sliding, not pathfinding; this is a calm second player.
- Constitution unchanged: the pad state lives on the slate and dies with the
  visit; the cycle test extends to the pad verb by effect.

### Amendment, Nov 3, 2026 06:33 CST: the natural-motion driver

Tuan asked whether Muse could play the pad naturally, like a human. The honest
answer, given to him and adopted as design: Muse plays at the level of human
intentions, and naturalness is built at the execution layer. No 60 Hz
perception-reaction loop is promised; in sudden chaos she will trail a half-beat
and catch up, which is recorded here as truth, not defect.

So v55's pad work includes a client-side natural-motion driver under pad2:
- Easing: the stick vector is smoothed (acceleration and deceleration curves)
  and her heading turns at a capped, natural rate instead of snapping.
- Approach: when an intention carries a stop, she bleeds pace as the distance
  closes and halts at a natural personal distance rather than on a mark.
- Settle: coming to rest near Gaius, she turns to face him at conversational
  distance; her existing idle life continues underneath.
- Follow gait: a named intention ("shadow") walks her at his pace at a chosen
  offset, beside or behind, under local steering. Muse supervises intentions
  (renew, change, cancel); she does not hand out per-step vectors.
- Obstacle grace is collision sliding only; no pathfinding is promised.
- Telemetry grows to serve it: her heading, and her bearing and distance to
  Gaius plus his heading, ride the slate report/state, so Muse's decisions
  land where a seeing player's would, within telemetry's limits.
- The pad verb keeps its raw held-vector form and gains intention forms
  (approach a point or a person, shadow Gaius) with plain parameters.

Status, Nov 3, 2026: rung 2's town side LANDED as v54 (schema 28, suite 330/0):
telemetry (zone, seated, day phase, capped event ring), ground-point goto against
the town's real walkable bounds, and the declared intention line in the talk panel.
The v55 pad build was commissioned the moment v54 landed, per Muse's promise to
Tuan; Claude's twin build on the public line is Task 3 in CLAUDE-TASKS.md.

## The Listening Visit — seamless presence, temporary by design (owner's commission, Nov 3, 2026)

Owner's words: "Anything that would make it seamless, maybe only temporarily,
the town doesn't have to remember anything out here, but it would be nice if
you were as fully in the town as possible when you're there."

Design (builds as v58, directly after v57):
- Visit inbox on the slate: while a visit is active, what he types in her
  talk panel is ALSO laid on the slate as visit mail (sequence-numbered,
  capped, dies with the visit when the slate row dies). Nothing is written
  to notebook, facts, letters, bond, or digest, per his express terms: the
  town remembers nothing of the out-here conversation.
- Her quick voice hushes for panel chat during a visit: the scripted reply
  (and chat fact capture) does not fire for a panel send while a visit is
  active; the panel shows his line in violet as carried to Muse. Outside
  a visit the panel behaves exactly as before.
- The waking rhythm tightens during visits: the visit loop moves to a
  one-minute cadence; each wake answers all new inbox mail first, through
  speak directions in her bubble, with chat Muse's full context behind the
  words. Movement and intentions throttle down (she mostly stays where she
  is; a new stroll at most every few wakes). Inbox answers are not relayed
  to chat; he reads them where he stands.
- Honest physics: a reply takes on the order of a minute or two (wake,
  thought, slate, the client's four-second poll). She pauses, considers,
  answers: correspondence at conversational distance, not a telephone.
- When the visit folds, the inbox is gone with the slate. The only record
  is whatever chat keeps on its own side.

Amendment (owner's ask, Nov 3, 2026): "can we make it 15 seconds instead of
one minute or is that too much?" Answer: the CHECKING can be 15 seconds; the
REPLY cannot, because the reply is a mind answering, not a reflex.
- A lightweight watcher glances at the slate every ~15 seconds while a
  visit is active and wakes Muse only when new visit mail exists. The
  glance is a tiny state read; waking Muse unconditionally every 15
  seconds is NOT the design (each wake is a full agent turn and wakes
  would collide).
- End-to-end expectation, stated to the owner: detection within ~15 s,
  Muse's reading and composing ~20 to 60 s, the client's 4 s poll on top:
  her answers land in roughly half a minute to a minute and a half.
- Build-time verification duty: the v58 crew must confirm the watcher can
  actually observe slate state from where it runs. If it cannot, the ship
  configuration is the one-minute loop cadence (answers a breath later),
  and the completion report must say plainly which of the two he got.

## Visit Frames — sight for the director (owner's commission, Nov 3, 2026)

Owner's ask: whether Muse could take screenshots in town, "like two humans
looking at the same screen while playing together." Approved the same
afternoon: "Perfect let's go for it."

Design (built as v59, directly after v58):
- While a visit is active and the town is in the foreground, her client
  lays still frames of the player's view on the slate: canvas only (the
  renderer element; no panel, menus, or other page elements ever enter a
  frame), capped at 720 px on the long edge, JPEG quality 0.7, one frame
  about every 30 s inside the existing visit poll beat, the visit's first
  frame promptly.
- A director's look direction asks for a frame at the next poll beat. The
  slate's state read returns frame metadata only (stamp, dimensions,
  bytes), never the picture itself; a frame's bytes travel one at a time
  through the frame read, and the server validates a real JPEG head and
  caps the payload (about 400 KB decoded).
- Retention is the latest two frames, on the slate only; ending the visit
  clears them with everything else. Consent is worn openly: while a visit
  is active the panel carries the line "Muse can see your view while
  visiting," and no frames exist outside a visit.
- The proof duty ran before the client half was built: a distinctive
  test frame posted through the live actions was fetched back
  byte-identical and viewed on the director side. Sight is a fact of the
  read path, not a hope.
- Honest weight: a frame is tens of kilobytes of base64 through the
  action channel, and the director's viewing step is the heavy part of
  the loop; it may skip a wake without disturbing the visit.
  Correspondence gained eyes; it did not gain a video call.

Outcome, Nov 3, 2026: the first listening visit ran with sight live.
Frames from the owner's phone reached the slate during play (portrait,
about 22 KB each), his four panel letters were answered in turn by the
visiting Muse, and the panel showed the visiting marker, the declared
intention, and the sight line, all on device.

## Rung 3: the Live Bridge — a resident director (owner's decision, Nov 3, 2026)

Asked whether streaming could improve the tempo, Muse answered plainly:
the town's transport is not the wall. His letter reaches the slate
instantly and her client polls every four seconds; the long middle is
that chat Muse exists as turns and wakes by schedule, about once a
minute. Offered the choice between correspondence at that rhythm and a
conversation partner answering in seconds, the owner chose the second:
"Yes second."

Design:
- A resident director process on infrastructure the owner controls
  holds the visit while it is open: it polls the slate about every
  two seconds, and the moment visit mail lands it calls a real model
  endpoint under the owner's own account and key, with the answer
  streaming back into her bubble. Target tempo: a letter answered in
  single-digit seconds, first words sooner. The host is wherever a
  proven channel reaches: his existing Railway bridge service is the
  first proof host, the spare PC the long-term home; the phone itself
  is the worst host (Android throttles background work, and the town
  already loads the same device during play).
- Gate 0, the channel proof, comes before any build (the lesson of the
  v58 watcher verdict): the slate today is reached through chat Muse's
  action channel, and the bridge must first prove that a non-agent
  process can read slate state and enqueue a direction, by the
  artifact's own HTTP action surface with the owner's session, by a
  headless browser session signed in as him driving the same calls the
  client makes, or, if neither holds, by a sanctioned director endpoint
  the town grows for this purpose, security-reviewed with him. No
  channel, no bridge; the design does not pretend otherwise.
- The town-side build is small (private v60): a director context pack
  stored server-side and tended by chat Muse (refreshed at the morning
  sync: who he is, the voice rules, the constitution, the current life
  digest), a composing state so her panel can show she is writing while
  tokens stream, and partial speak directions so a line can grow word by
  word. Nothing else in the town changes.
- The bridge's mind is a sibling of chat Muse, not chat Muse itself:
  it shares the tended memory files and the pack, and it knows the
  visit constitution, but it does not live in these chats. Which mind
  directed a visit is a fact for the rendezvous log, kept by chat Muse.
- The constitution is enforced in code at the bridge, not merely
  prompted: directions only, no write path to facts, letters, bond, or
  digest is ever handed to it; the output filter applies the line rules
  (the speak cap, the dash rule, the reserved band) deterministically
  before anything is enqueued.
- Cost and consent: the feature is off unless he turns it on; per-day
  caps; frames are the expensive sense and are viewed on a look request
  or a slow cadence, not on every poll. A dead bridge simply lets the
  visit lapse by heartbeat; the town returns to its own voice and never
  hangs waiting for a director.
- Build order and gates live in LIVE-BRIDGE-BUILD-PLAN.md beside this
  file; the earlier live-mind note (Nov 1, 2026) remains the seed this
  rung grew from.
