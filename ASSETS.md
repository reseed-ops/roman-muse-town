# ASSETS.md — the binary manifest

This repository is **code and text only**. Every binary asset the town
needs was excluded from the copy (121 files), because nearly all of them
are commercial assets whose licences allow them to be *embedded in a
shipped product* but **never redistributed as files**. This manifest lists
everything excluded, grouped by source pack, with the exact folder path
each file belongs at, so that:

- the owner can rebuild the complete town from his own library, and
- a receiving Muse knows precisely what to ask their person to buy,
  download, or supply — and what the town looks like without each piece
  (see "Graceful degradation" in `INSTALL-FOR-MUSE.md`).

**The one binary that IS in this repo:** `client/src/assets/trees_pack.glb`
— positively identified as *Low Poly Trees* from itch.io, released **CC0**,
so it may ride in a public repo. Everything below is purchase/download/
supply required; nothing below may be committed to a public repository.

Counts: 120 files excluded from `client/src/assets/`, plus the app icon
`icon.webp` at the space root. (Compiled copies of these assets also exist
in the original's `client/dist/` build output — 222 binary files — which
is build output, not source, and is not itemised here.)

---

## 1. Character bodies (VRM) — owner-supplied, not purchasable packs

Drop at: `client/src/assets/`

| File | What it is | Source / terms |
| --- | --- | --- |
| `muse-avatar.vrm` | Aelia's body: AvatarSample_M (silver-blonde hair, plain white one-piece dress), VRM 1.0 sample model supplied by the owner | pixiv VRoid sample-model terms, verified by the owner (Nov 1, 2026): usable even commercially; the file may sit in a *free* public repo but may never be sold as a file or relabelled CC0. INCLUDED in the repo as of Nov 1, 2026, by the owner's decision (flag F5 resolved); embedded metadata verified clean (author: pixiv VRoid Project; redistribution allowed). |
| `centurion.vrm` | Gaius's body: a centurion built by the owner in VRoid Studio | Owner-created. A receiving town needs its *own* player body — do not reuse the owner's. |

A receiving town supplies two VRM 1.0 bodies of its own (see
`INSTALL-FOR-MUSE.md`). The town's code expects exactly these two
filenames.

## 2. Human Basic Motions — Kevin Iglesias (Unity Asset Store)

Drop at: `client/src/assets/anim/` — 13 FBX clips. Converted from the
owner's purchased pack; **Asset Store EULA: embed in a product only, never
redistribute the files.**

`f_idle.fbx`, `f_walk.fbx`, `f_run.fbx`, `f_wave.fbx`, `f_sit.fbx`,
`m_idle.fbx`, `m_walk.fbx`, `m_run.fbx`, `m_wave.fbx`, `m_sit.fbx`,
`m_jump_start.fbx`, `m_jump_air.fbx`, `m_jump_end.fbx`

## 3. Human Dance Animations — Kevin Iglesias (Unity Asset Store)

Drop at: `client/src/assets/anim/` — 4 FBX clips. Same EULA terms.

`f_dance.fbx`, `m_dance.fbx`, `f_pose_a.fbx`, `f_pose_b.fbx`

## 4. BUNDLE Outdoor Animations (FBX edition) — Kevin Iglesias (Unity Asset Store)

Drop at: `client/src/assets/anim/outdoor/` — 18 FBX clips (conversation
gestures, bench idles, sittalk, hug, flirt; the town adopts a subset).
Same EULA terms. Note: the pack also exists in a Unity `.anim` edition;
the town was built against the **FBX edition** — that distinction cost the
original builder a day. Buy/convert the FBX one.

`f_bench1.fbx`, `f_bench2.fbx`, `f_flirt.fbx`, `f_hug.fbx`,
`f_sittalk1.fbx`, `f_sittalk2.fbx`, `f_talk1.fbx`, `f_talk2.fbx`,
`f_talk3.fbx`, `m_bench1.fbx`, `m_bench2.fbx`, `m_flirt.fbx`, `m_hug.fbx`,
`m_sittalk1.fbx`, `m_sittalk2.fbx`, `m_talk1.fbx`, `m_talk2.fbx`,
`m_talk3.fbx`

## 5. Roman Empire — Stylized Low Poly — HALBERSTRAM ART (Unity Asset Store)

Drop at: `client/src/assets/roman/` — 54 GLB + 1 FBX + 2 PNG. The whole
visible Roman district: buildings, forum, basilica ("senate"), Colosseum,
temple, aqueduct, houses, market booths, columns, benches, banners,
ballista, statue, trees, bushes, flowers, rocks, grass, pottery, boat.
Converted FBX→glTF from the owner's purchased pack; the two PNGs are the
pack's shared palette and a water normal map the scene depends on. Same
EULA terms.

`annex_sidechat.glb`, `apple.glb`, `aqueduct.glb`,
`aqueduct_connector.glb`, `arch_round.glb`, `ballista.glb`, `banner.glb`,
`banner_triangle.glb`, `barrel.glb`, `bench_stone.glb`, `bench_wooden.glb`,
`boat_small.glb`, `booth_a.glb`, `booth_b.glb`, `booth_c.glb`, `bowl.glb`,
`bread.glb`, `bush_a.glb`, `bush_b.glb`, `bush_c.glb`, `bush_d.glb`,
`bush_e.glb`, `bush_roman.glb`, `colosseum.glb`, `column_ionic.glb`,
`column_simple.glb`, `conifer.glb`, `crate.glb`, `cypress.glb`,
`flower_a.glb`, `flower_group.glb`, `flower_med.glb`, `grapes.glb`,
`grass_patch.glb`, `house_garden.glb`, `house_sounds.glb`,
`insulae_recipes.glb`, `olive.glb`, `paddle.glb`, `pavilion_stars.glb`,
`platform_wooden.glb`, `pottery1.glb`, `pottery2.glb`, `rock_pack.glb`,
`senate.glb`, `statue_mars.glb`, `sunflower.glb`, `temple.glb`,
`tree_a.glb`, `tree_b.glb`, `tree_c.glb`, `tree_d.glb`,
`triumphal_arch.glb`, `villa_stories.glb`, `torch.fbx`, `palette.png`,
`water_normal.png`

## 6. Greek Low Poly pack (Unity Asset Store)

Drop at: `client/src/assets/greek/` — 13 FBX props (benches, bowls,
bucket, dock, drying rack, garden and pool pieces, pots, table, wood pile)
plus the shared texture atlas at `client/src/assets/greek_atlas.png`.
Seller name not recorded in the original's notes; the pack is named
plainly here for that reason. Same EULA terms.

`greek_bench_1.fbx`, `greek_bench_2.fbx`, `greek_bowl.fbx`,
`greek_bucket.fbx`, `greek_decorative_bowl.fbx`, `greek_dock.fbx`,
`greek_drying_rack.fbx`, `greek_garden_1.fbx`, `greek_pool_1.fbx`,
`greek_pot_1.fbx`, `greek_pot_2.fbx`, `greek_table_1.fbx`,
`greek_wood_pile.fbx`, `greek_atlas.png` (at `client/src/assets/`)

## 7. Animated Pets & Farm Animals — HONETi (Unity Asset Store)

Drop at: `client/src/assets/pets/` — 4 FBX animals + 4 texture PNGs.
Same EULA terms.

`cat.fbx`, `cat_05.png`, `chicken.fbx`, `chicken_01.png`, `pig.fbx`,
`pig_01.png`, `sheep.fbx`, `sheep_05.png`

## 8. Low Poly Legend Phoenix — PULSAR BYTES (Unity Asset Store)

Drop at: `client/src/assets/` — `phoenix.fbx` + `phoenix_tex.png`.
Licence verified by the owner (Nov 1, 2026): standard Unity Asset Store
EULA — may be embedded in a shipped product, never redistributed as files.

## 9. Dire Wolf Lite — Literock (itch.io, free)

Drop at: `client/src/assets/` — `wolf.glb` (Lupa, the town's wolf).
Licence verified by the owner (Nov 1, 2026): free download; may be
embedded in a shipped product, never redistributed as a raw file. Because
it is free, a receiving Muse can simply download it from itch.io
themselves — but must not commit it to a public repo either.

## 10. Low Poly Trees (itch.io, CC0) — **INCLUDED**

`client/src/assets/trees_pack.glb` is in this repository. CC0: free to
use, copy, and redistribute. It is the only binary carried over, and the
only one whose licence was positively verified as allowing it.

## 11. Audio and misc

| File | Path | Notes |
| --- | --- | --- |
| `stars-fall-song.mp3` | `client/src/assets/` | The summit scene's song. **Origin not documented** in the original's notes; owner-supplied. Confirm provenance before any release build ships it. A receiving town can substitute any quiet song file of its own. |
| `icon.webp` | space root | The app icon. Regenerate for a new artifact. |
