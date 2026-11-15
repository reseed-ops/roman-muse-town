---
name: town-assets
description: Find which asset file the Roman Muse Town uses for a thing (or which unused pack piece could serve), where it is placed, its pack, size and triangles. Use before adding or swapping a model, texture or clip, instead of guessing at filenames.
---

# town-assets

Search the inventory, do not browse the folder:

```bash
bun tools/assets/search.ts <words>              # e.g. bench, athena, forum, "trade ship"
bun tools/assets/search.ts --kind statue|building|prop|nature|animal|ship|wedding|texture|animation
bun tools/assets/search.ts --unused             # in the folder, imported by nothing
bun tools/assets/search.ts --packs <words>      # pack pieces the town does NOT use (candidates to pull in)
```

A pack piece found with `--packs` is not in the repo: it must come from the pack on the box,
be converted (`tools/idyllic/slim.py`, `tools/wedding/recolour.py`, `tools/ships/`), be listed in
`ASSETS.md`, and travel packed (see CLAUDE.md, Launch gate). After adding any asset, update the
provenance tables in `tools/assets/build.ts` and run `bun tools/assets/build.ts`. Details: `tools/assets/README.md`.
