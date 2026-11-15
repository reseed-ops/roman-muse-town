# Asset inventory (Task 95)

Which asset files the town uses, where each came from, where it stands, and
what the packs hold that the town does not use. Inventory only: nothing here
changes a town asset, a pack file or town code.

| File | What |
| --- | --- |
| `INVENTORY.md` | Read-through tables by folder, then the unused pack pieces. |
| `INVENTORY.json` | The same, machine-readable (what `search.ts` reads). |
| `search.ts` | The search script. |
| `build.ts` | Regenerates both from the source and the files. |
| `fbx_stats.py` + `fbx-stats.json` | Blender triangle counts for the 19 mesh FBX files (committed, so `build.ts` needs no Blender). |
| `packs/*.txt` | Mesh names in each pack on the box (for "not in the town"). |

## Search

```bash
bun tools/assets/search.ts bench                    # every word must match name, kind, pack, source file, place or note
bun tools/assets/search.ts --kind statue            # kinds: building prop nature statue weapon character animation animal ship wedding texture audio
bun tools/assets/search.ts --pack idyllic forum     # pack name contains "idyllic", place mentions forum
bun tools/assets/search.ts --unused                 # in the folder, imported by nothing
bun tools/assets/search.ts --packs scroll           # pack pieces the town does NOT use (what is on offer)
bun tools/assets/search.ts --json athena            # full record: uses with file:line, all placements
```

Each hit shows the file, kind, size, triangles (or image size), the pack and
the pack file it was made from, and where it is placed: `(x, z) [file:line]`
from the call site, or the piece id and position from the placement tables
(`idyllicDressing.ts`, `colosseumSetting.ts`). The first call site's own
comment is kept as the note when one sits directly above it.

## What the scan reads

- every `import X from "./assets/..."` and `"./textures/..."` in `townScene.ts`,
  `App.tsx` and `groundTextures.ts`, and each place `X` is then used;
- the data tables the scene reads for placement (`DRESSING_PIECES`,
  `SETTING_PIECES`);
- the files: bytes, GLB/VRM triangles (accessor counts, once per node that
  instances a mesh), PNG/JPEG dimensions.

Limits: a position written as `(x, z)` with `placeModel(..., house, ...)` is
in that parent's frame (a house or the domus), not the world's; "where" is
what the source says, not a render. Wedding pieces and ships have call-site
lines but no coordinates in the inventory (placed from code tables there).
The Roman Empire pack list is partial: the unitypackage on the box is
truncated (gzip ends early), so "not in the town" for that pack is a floor.
"Code-built" geometry (lamps, sea, walls) has no file and is not listed; the
loom ground textures in `client/src/textures/` are, as the one code-built file set.

## Refresh

```bash
bun tools/assets/build.ts            # rewrite INVENTORY.md / .json (needs the licensed assets: the box, not CI)
bun tools/assets/build.ts --check    # exit 1 when stale; inventory.test.ts runs this where the assets are present
# after adding or replacing an FBX:
bash ~/work/blender-mcp/blender-headless.sh -b --python tools/assets/fbx_stats.py -- client/src/assets tools/assets/fbx-stats.json $(cd client/src/assets; ls roman/*.fbx greek/*.fbx pets/*.fbx phoenix.fbx)
```

A new asset also needs its provenance in `build.ts` (`provenance`, `MADE_FROM`).
Pack lists: `cat <extracted>/*/pathname | grep -i '\.fbx$' | sed 's|.*/||;s/\.fbx$//' | sort -u > packs/<pack>.txt`
(for a unitypackage, first extract only its `*/pathname` entries into a fresh folder).
