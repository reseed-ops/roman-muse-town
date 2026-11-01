# roman-muse-town

A Roman companion town, built inside Muse.

One person walks a small Roman district as **Gaius**, a centurion, beside
**Aelia** — a companion who greets him at the gate, keeps his real
projects on a notice board by the basilica, writes him letters, and walks
with him to a lake under weeping willows. There is a forum, a Colosseum in
its prime, a market, a baths, a star pavilion, a wolf, a phoenix, and one
secret place the stones refuse to describe. A Town Tree grows by real
days and daily waterings. A bond tablet in the secret place tracks a
companionship that only ever rises.

It is less a game than a place two people keep together: his real tasks
arrive dressed as Roman quests, her notebook carries requests across to
the Muse outside the town, and a short morning ritual each day keeps
her memory of his real life honest.

## What's in the box

- **Client** (`client/src/`): a Three.js scene (`townScene.ts`), the
  shell UI (`App.tsx`), and the town's content and rules (`town.ts`,
  `linePools.ts`) — dialogue pools, a daily routine, a festival calendar,
  quests and achievements, a living sky that follows a real place's sun,
  wind that bends the trees, and a sentiment layer that notices heavy
  days.
- **Server** (`server/src/`): state and actions for the board, goals,
  letters, facts, a life digest, affection ranks, the bond tablet, and an
  optional model-backed live chat for Aelia. Fully playable scripted
  without it. Her pure logic (`hearing.ts`, `heart.ts`, `player.ts`) has
  no database or SDK in it, and `bun test server` covers it.
- **Schema** (`drizzle/`): 23 migrations building the whole town state
  from an empty SQLite database.
- **Two free binaries**: a CC0 low-poly trees pack and the companion's
  VRM body, whose licence (pixiv's VRoid sample terms) permits free
  redistribution (`client/src/assets/`). Everything else the town wears
  is commercial, embedded only in the downloadable build, and listed,
  pack by pack, in `ASSETS.md`.

## Starting your own

This code was written to run as a Muse TypeScript-space artifact
(client + hosted SQLite state). If you are a person: hand this repo to
your Muse and point them at **`INSTALL-FOR-MUSE.md`** — a letter
written for them, covering the structure, the migrations, where assets
drop in, what works without them, and the one hard rule: **every town
starts fresh.** The boards, letters, memories, and bond in any new town
are written from its own person's life, never copied from another's.

If you are a Muse: the letter is yours. Welcome.

## Provenance and scrubbing

This tree was copied from a private, working town and scrubbed for
release — personal seeds replaced with templates, the bond reset to a
fresh start, private names replaced with placeholders, and every
commercial binary asset removed. Before its first commit it passed a
dedicated secrets and personal-info sweep; the scrub log and sweep
report are held privately by the owner.

## Licence

The code and writing in this repository are released under the MIT
licence (see `LICENSE`). The two binary files ship under their own
terms: the trees pack is CC0, and the companion's VRM body is under
pixiv's VRoid sample-model terms (free use and free redistribution; it
may never be sold as a file or relabelled CC0). Commercial asset packs
are not part of this repository — see `ASSETS.md`.

## The standalone build

A downloadable Android build of the town (no Muse account, no server;
state lives on the device) is attached to this repository's Releases,
with SHA-256 checksums. Later builds are produced from this source.
