# ASSETS.md: the binary manifest

This repository is **code and text, plus two freely redistributable
binaries** (below). Every other binary asset the town needs is excluded
(131 files), because nearly all of them
are commercial assets whose licences allow them to be *embedded in a
shipped product* but **never redistributed as files**. This manifest lists
everything excluded, grouped by source pack, with the exact folder path
each file belongs at, so that:

- the owner can rebuild the complete town from his own library, and
- a receiving Muse knows precisely what to ask their person to buy,
  download, or supply, and what the town looks like without each piece
  (see "Graceful degradation" in `INSTALL-FOR-MUSE.md`).

**The two binaries that ARE in this repo:** `client/src/assets/trees_pack.glb`,
positively identified as *Low Poly Trees* from itch.io, released **CC0**,
so it may ride in a public repo; and `client/src/assets/muse-avatar.vrm`,
Aelia's body, pixiv's VRoid sample model, whose terms allow it in a free
public repo (see its row below). Everything else is purchase/download/
supply required, and may never be committed to a public repository.

Counts: 131 files excluded from `client/src/assets/` (133 in the folder,
less the two above), plus the app icon
`icon.webp` at the space root. (Compiled copies of these assets also exist
in the original's `client/dist/` build output, 222 binary files, which
is build output, not source, and is not itemised here.)

---

## 1. Character bodies (VRM): owner-supplied, not purchasable packs

Drop at: `client/src/assets/`

| File | What it is | Source / terms |
| --- | --- | --- |
| `muse-avatar.vrm` | Aelia's body: AvatarSample_M (silver-blonde hair, plain white one-piece dress), VRM 1.0 sample model supplied by the owner | pixiv VRoid sample-model terms, verified by the owner (Nov 1, 2026): usable even commercially; the file may sit in a *free* public repo but may never be sold as a file or relabelled CC0. INCLUDED in the repo as of Nov 1, 2026, by the owner's decision (flag F5 resolved); embedded metadata verified clean (author: pixiv VRoid Project; redistribution allowed). |
| `centurion.vrm` | Gaius's body: a centurion built by the owner in VRoid Studio | Owner-created. A receiving town needs its *own* player body; do not reuse the owner's. |

A receiving town supplies two VRM 1.0 bodies of its own (see
`INSTALL-FOR-MUSE.md`). The town's code expects exactly these two
filenames.

## 2. Human Basic Motions, by Kevin Iglesias (Unity Asset Store)

Drop at: `client/src/assets/anim/`, 14 FBX clips. Converted from the
owner's purchased pack; **Asset Store EULA: embed in a product only, never
redistribute the files.**

`f_idle.fbx`, `f_walk.fbx`, `f_run.fbx`, `f_wave.fbx`, `f_sit.fbx`,
`m_idle.fbx`, `m_walk.fbx`, `m_run.fbx`, `m_wave.fbx`, `m_sit.fbx`,
`m_jump_start.fbx` (HumanM@Jump01 - Begin), `m_jump_air.fbx` (HumanM@Fall01),
`m_jump_end.fbx` (HumanM@Jump01 - Land), `m_slide.fbx` (HumanM@RunSlide01)

The three jump files are the Iglesias takes named above, non-root-motion
variants. (An earlier assembly of the jump used Unreal Engine Mannequin
clips under these filenames by mistake; the town's bake rejects that
skeleton, so those files never produced a jump action. The swap to the
takes above landed Nov 2, 2026, and this list has described the intended
Iglesias files all along.)

## 3. Human Dance Animations, by Kevin Iglesias (Unity Asset Store)

Drop at: `client/src/assets/anim/`, 4 FBX clips. Same EULA terms.

`f_dance.fbx`, `m_dance.fbx`, `f_pose_a.fbx`, `f_pose_b.fbx`

## 4. BUNDLE Outdoor Animations (FBX edition), by Kevin Iglesias (Unity Asset Store)

Drop at: `client/src/assets/anim/outdoor/`, 18 FBX clips (conversation
gestures, bench idles, sittalk, hug, flirt; the town adopts a subset).
Same EULA terms. Note: the pack also exists in a Unity `.anim` edition;
the town was built against the **FBX edition**, that distinction cost the
original builder a day. Buy/convert the FBX one.

`f_bench1.fbx`, `f_bench2.fbx`, `f_flirt.fbx`, `f_hug.fbx`,
`f_sittalk1.fbx`, `f_sittalk2.fbx`, `f_talk1.fbx`, `f_talk2.fbx`,
`f_talk3.fbx`, `m_bench1.fbx`, `m_bench2.fbx`, `m_flirt.fbx`, `m_hug.fbx`,
`m_sittalk1.fbx`, `m_sittalk2.fbx`, `m_talk1.fbx`, `m_talk2.fbx`,
`m_talk3.fbx`

## 5. Roman Empire, Stylized Low Poly, by HALBERSTRAM ART (Unity Asset Store)

Drop at: `client/src/assets/roman/`, 55 GLB + 1 FBX + 2 PNG. The whole
visible Roman district: buildings, forum, basilica ("senate"), Colosseum,
temple, aqueduct, houses, market booths, columns, benches, banners,
ballista, statue, trees, bushes, flowers, rocks, grass, pottery, boat,
and Gaius's gladius and legionary shield.
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
`flower_a.glb`, `flower_group.glb`, `gladius.glb`, `flower_med.glb`, `grapes.glb`,
`grass_patch.glb`, `house_garden.glb`, `house_sounds.glb`,
`insulae_recipes.glb`, `olive.glb`, `paddle.glb`, `pavilion_stars.glb`,
`platform_wooden.glb`, `pottery1.glb`, `pottery2.glb`, `rock_pack.glb`,
`senate.glb`, `shield_legionaire.glb`, `statue_mars.glb`, `temple.glb`,
`tree_a.glb`, `tree_b.glb`, `tree_c.glb`, `tree_d.glb`,
`triumphal_arch.glb`, `villa_stories.glb`, `torch.fbx`, `palette.png`,
`water_normal.png`

## 6. Greek Low Poly pack (Unity Asset Store)

Drop at: `client/src/assets/greek/`, 13 FBX props (benches, bowls,
bucket, dock, drying rack, garden and pool pieces, pots, table, wood pile)
plus the shared texture atlas at `client/src/assets/greek_atlas.png`.
Seller name not recorded in the original's notes; the pack is named
plainly here for that reason. Same EULA terms.

`greek_bench_1.fbx`, `greek_bench_2.fbx`, `greek_bowl.fbx`,
`greek_bucket.fbx`, `greek_decorative_bowl.fbx`, `greek_dock.fbx`,
`greek_drying_rack.fbx`, `greek_garden_1.fbx`, `greek_pool_1.fbx`,
`greek_pot_1.fbx`, `greek_pot_2.fbx`, `greek_table_1.fbx`,
`greek_wood_pile.fbx`, `greek_atlas.png` (at `client/src/assets/`)

## 7. Animated Pets & Farm Animals, by HONETi (Unity Asset Store)

Drop at: `client/src/assets/pets/`, 4 FBX animals + 4 texture PNGs.
Same EULA terms.

`cat.fbx`, `cat_05.png`, `chicken.fbx`, `chicken_01.png`, `pig.fbx`,
`pig_01.png`, `sheep.fbx`, `sheep_05.png`

## 8. Low Poly Legend Phoenix, by PULSAR BYTES (Unity Asset Store)

Drop at: `client/src/assets/`, `phoenix.fbx` + `phoenix_tex.png`.
Licence verified by the owner (Nov 1, 2026): standard Unity Asset Store
EULA: may be embedded in a shipped product, never redistributed as files.

## 9. Dire Wolf Lite, by Literock (itch.io, free)

Drop at: `client/src/assets/`, `wolf.glb` (Lupa, the town's wolf).
Licence verified by the owner (Nov 1, 2026): free download; may be
embedded in a shipped product, never redistributed as a raw file. Because
it is free, a receiving Muse can simply download it from itch.io
themselves, but must not commit it to a public repo either.

## 10. Low Poly Trees (itch.io, CC0): **INCLUDED**

`client/src/assets/trees_pack.glb` is in this repository. CC0: free to
use, copy, and redistribute. It is the only binary carried over, and the
only one whose licence was positively verified as allowing it.

## 11. Audio and misc

| File | Path | Notes |
| --- | --- | --- |
| `stars-fall-song.mp3` | `client/src/assets/` | The summit scene's song, AI generated for the scene during the town's original build (Nov 1, 2026, 00:07, the build night of the summit scene; the file carries "AI Generated" in its embedded metadata). Provenance the project's own: no owner-supplied copy ever existed (the Nov 5 rebuild record below listed it as missing from the owner's folder). The generating service and account are not recorded, so its output terms are the one residual unknown. A receiving town can substitute any quiet song file of its own. (Line corrected Nov 5, 2026, Task 14, on the launch gate review's evidence.) |
| `icon.webp` | space root | The app icon. Regenerate for a new artifact. |

## 12. Ships on the sea, by Alin Loghin (Unity Asset Store)

Bought by the owner Nov 8, 2026 (Order #1376026162327) for Task 50:
*Ancient trade ship* and *Low-poly Greek Trireme*. Standard Unity Asset
Store EULA: may be embedded in a shipped product, never redistributed as
files.

Drop at: `client/src/assets/ships/`

| File | Made from | Notes |
| --- | --- | --- |
| `trade_ship.glb` | `Ancient trade ship.unitypackage`: `files/low_poly/kyrenia_lowPoly.FBX` + `trade_ship.tga` | The Kyrenia merchantman, 676 polygons, one 512 px texture with alpha (the sail and rails cut out). The sail's 80 faces carry their own material, `trade_sail` (same texture), so the town dyes the sail per pass. About 0.43 MB. |
| `trireme_hull2.jpg`, `trireme_sail2.png` | the same package: `Trireme/hull2.tga` (1024 px), `Trireme/sail2.tga` (512 px) | The pack's second livery (plain linen sails, the red moved to the top strakes), swapped onto a clone of `trireme.glb` at runtime. About 0.2 and 0.5 MB. |
| `trireme.glb` | `Low-poly Greek Trireme.unitypackage`: `Trireme/trireme.FBX` + `hull.tga`, `planks.tga`, `rope.tga`, `sail.tga`, `wood.tga` | 9,009 polygons, five materials; hull 1024 px, the rest 512 px or less (the pack's 2048 px maps, normal, AO and spec maps left out for phones). About 1.5 MB. |

Conversion (Claude, Nov 9, 2026, Blender 5.1, scripts in `tools/ships/`):
the trade ship's FBX is version 6100, which Blender refuses, and its RAR
holds only a `.max`, so `tools/ships/fbx6.py` reads the binary FBX 6
directly (positions, UVs, normals, the node transforms) and builds the
mesh in Blender. The trireme imports as FBX; its one-bone armature is
static and is applied away. Both are joined into one mesh, turned bow to
+X, centred, keel at y = 0, and exported GLB (Y up, no animation, JPEG
for opaque maps, PNG where alpha matters); `tools/ships/livery.py` writes the second livery's two maps. Without them the sea stays
empty; the rest of the town is unaffected at runtime, but the static
imports mean the web build needs both files present.

Reproduced on the Optiplex build box Nov 10, 2026 (Blender 4.5.3 LTS, same scripts): `trade_ship.glb` 488,640 bytes, `trireme.glb` 1,494,636 bytes, plus `trireme_hull2.jpg` and `trireme_sail2.png`, all in `client/src/assets/ships/` on that box. Polygon counts match the Windows build (trireme 9,009; trade ship 676 in the .blend, 675 after the GLB round trip).

---

## Rebuild record (Claude, Nov 5, 2026): the folder remade from the raw packs

No converted copy of this folder existed outside the original artifact
environment, so it was rebuilt on the owner's device from the store
packages he supplied (`.unitypackage` files are gzip tarballs of
`<guid>/asset` + `<guid>/pathname`; Blender 4.3 headless did the
FBX→glTF step, no images embedded, transforms applied, Y up). What each
town file was made from, so the next rebuild is a copy, not a hunt:

- **Buildings**, verified: Blender's bounding-box depth/width ratios
  matched the ratios `townScene.ts` recorded from the original GLBs to
  three decimals. `villa_stories` = SM_villa_roman_01, `house_sounds` =
  SM_house_roman_01, `house_garden` = SM_house_roman_02,
  `insulae_recipes` = SM_insulae_building_02, `senate` = SM_senate,
  `annex_sidechat` = SM_attachment_building_01, `temple` = SM_temple,
  `pavilion_stars` = SM_pavillion, `colosseum` = SM_colosseum,
  `booth_a/b/c` = the `_2x1` variants (the scene's measured 1.73 × 0.86
  booth footprint is 2:1).
- **Orientation note (Nov 6, 2026):** the rebuilt `bench_stone.glb`
  carries its backrest on local -Z (the top third of its vertices sit at
  z -0.32 of a 0.79 m depth), the opposite of the original edition the
  scene was written against (backrest on +Z). The scene measures the
  side at load and turns the model when needed (`faceBackrestPlusZ` in
  townScene.ts), so neither edition needs re-exporting. The wooden and
  Greek benches have no backrest.
- **Props and nature**, best guess where the pack offers variants (the
  scene scales every model to a placed width or height, so a different
  variant changes the look, never the layout): `bush_a..e` =
  SM_bush_01..05, `bush_roman` = SM_bush_06, `tree_a..d` =
  SM_tree_a/b/c/d_01, `conifer` = SM_tree_conifer_01, `cypress` =
  SM_tree_cypress_01, `olive` = SM_tree_olive_01, `flower_a` =
  SM_flower_01, `flower_med` = SM_flower_mediterranean, `flower_group` =
  SM_flower_small_group, `grass_patch` = SM_grass_mesh_01, `rock_pack` =
  SM_rock_004, `crate` = SM_crate_wood_02, `bread` = SM_bread_round,
  `bowl` = SM_bowl_01, `pottery1/2` = SM_pottery_001/002, `banner` =
  SM_banner_01, `banner_triangle` = SM_banner_triangle_01, `arch_round`
  = SM_arch_round_01, `paddle` = SM_paddle_01; the rest carry the pack's
  own name. `torch.fbx` is SM_torch.FBX copied as is. `palette.png` is
  M_colorpalette_BaseColor.png re-saved losslessly (10 KB);
  `water_normal.png` is M_water_Normal.png.
- **Clips** (Human Basic Motions, Dance): `*_idle` = Idle01, `*_walk` =
  Walk01_Forward, `*_run` = Run01_Forward, `*_wave` = HandWave01 (all
  named in `characterAnimation.ts`); `*_sit` = SitMedium01 - Loop,
  `*_dance` = Dance01, `f_pose_a/b` = DancePose01/02 - Loop (best
  guesses); the jump and slide files as listed in section 2.
- **Greek**: the pack's `Models/` folder, not `Models/Optimized/`: the
  standard files carry no UVs and flat per-material colours, which is
  what the scene's material repair expects. `greek_atlas.png` =
  Textures/Greek_Combined.png.
- **Pets**: HONETi `models/*.FBX` renamed to lower case, the four listed
  textures. **Phoenix**: the pack's one FBX (material `Phoenix_Mat`, as
  the scene checks) with Phoenix_01_Tex.png. **Wolf**:
  Dire_Wolf_Lite.glb from the itch.io zip, unchanged (clips `idle_loop`,
  `walk_loop`, `run_loop`, `bite`).

- **Outdoor clips** (BUNDLE Outdoor Animations, FBX edition, supplied by
  the owner later on Nov 5): every take in the pack is a 3.33 s loop
  (`X.1`, `X.3`) with short transitions (`X.2`, `X.4`), and the `X.Y.Y`
  file is the partner's half of the same take. Blender confirmed the
  71-bone rig with a `Hips` track on every file. Chosen: `f_talk1/2/3` =
  She communicates-1.1, -1.3, -2.1 and `m_talk1/2/3` = He communicates
  -1.1, -1.3, -2.1 (Couples/Stand/Communication); `f_sittalk1/2` = She
  communicates sitting-1.1, -1.3 and `m_sittalk1/2` = He communicates
  sitting-1.1, -1.3 (Couples/Sit/Communication); `f_bench1/2` = She is
  sitting on a bench-1.1, -1.3 and `m_bench1/2` = He is sitting on a
  bench-1.1, -1.3 (250+ Outdoor SD/Bench/Sitting_on_a_bench). The pair
  takes were recut for Task 10 (Nov 5, 2026, evening) after the first
  cut was measured in the composed scene: `m_hug` = Couple flirt-4.3.3
  with `f_hug` = Couple flirt-4.3 (550+ Outdoor/Couple/Couple Flirt:
  the pack's one standing front-to-front hold with arms around each
  other, her arms around his neck, his hands at her waist, authored
  0.37 m hip to hip, 167° face to face); `m_flirt` = Couple flirt-2.3
  with `f_flirt` = Couple flirt-2.3.3 (face to face at 0.42 m, each
  with a hand raised to the other's chest, mirrored). Which half is
  "he" is a reading of the poses (the neck hold is given to her), the
  pack does not say. The first cut, He hugs-1.1 + 1.1.1 and Couple
  flirt-1.1 + 1.1.1, is measured in the Task 10 landing note: He hugs
  is a hand on the shoulder with her arms down (no standing take in
  the Couples pack wraps both arms), and Couple flirt-1 has the two
  facing the same way, she behind him. The talk, seated and bench
  takes are best guesses among equivalent loops. Measured on Nov 5
  (Task 9, Blender, thigh line against the rest pose): the partner
  half of a take is authored turned to face its initiator, and the two
  files carry the authored spacing on their armature objects (the
  bake drops it, so the scene supplies it); the client turns a pair
  clip to face forward on its first frame before use
  (`faceForwardInPlace` in `characterAnimation.ts`). Every take in the
  pack is 3.33 s (X.1, X.3 loops) or a 0.7 to 1.4 s transition (X.2,
  X.4). The pack's rig binds in a relaxed A-pose (upper arms 49° below
  level, elbows bent 44°), not the VRMs' T-pose; the bake matches the
  arm chain's bind posture before carrying a take (`armBindPostureFix`),
  which Task 10 added after the first cut's arms came out spread.

Not rebuilt, still missing from the owner's folder:

- `stars-fall-song.mp3`: no candidate on the device at rebuild time; the file in use is the project's own AI-generated song (see section 11), restored to the folder the same day.

`townScene.ts` and `App.tsx` import every one of these files statically,
so the web build fails until all of them are present (133 since Task 84 (127 since Task 50); see `CLAUDE.md`).

### Added Nov 8, 2026: Gaius's arms

- `roman/gladius.glb` from `SM_weapon_gladius.FBX` and `roman/shield_legionaire.glb` from `SM_shield_legionaire.FBX`, both in `Roman Empire - Stylized Low Poly.unitypackage` (`MESHES/Military/Weapons and Shields/`), converted in Blender like the rest (FBX to GLB, no images, transforms applied, Y up). The gladius FBX carries a second object, `Box069`, a helper box scaled to zero, dropped in the conversion. Both use the pack palette material (`M_colorpallete_roman`); the town's loader assigns `palette.png`. The pack has no scabbard; the town builds one.

### Added Nov 12, 2026: the wedding pieces (Task 84)

Drop at: `client/src/assets/wedding/` (6 files, 133 in the folder in all).

Source: RenderHub "Wedding - Banquet, Cake & Characters - 254 Low-Poly Mode" by Absurdox Lab (Order 423445, $19.99, bought Nov 11, 2026; 508 native GLBs, HD and Mobile). Licence: use and modify in projects, never resell or share the model files (the town ships them packed, like the rest, and they stay out of git). Credit "Models by Absurdox Lab" is appreciated, not required.

`tools/wedding/recolour.py <pack>/ <out>/` writes all six from the pack's **Mobile** files, changing only material colour factors (laurel and olive greens, deep red and terracotta blooms, ivory, `#d4af37` gold, a saffron translucent ribbon and veil); geometry and the pack's fabric textures are untouched:

| File | Pack file (Mobile) | Bytes |
| --- | --- | --- |
| `flower_arch.glb` | `wedding_merge_flower_05` | 156,496 |
| `flammeum_stand.glb` | `wedding_veil_long` | 193,096 |
| `table_round.glb` | `wedding_table_round_dressed_classic` | 144,508 |
| `table_long.glb` | `wedding_table_long_dressed_classic` | 265,724 |
| `cake.glb` | `wedding_cake_classic_3` | 55,844 |
| `ring_box.glb` | `wedding_ring_box_open` | 109,716 |
