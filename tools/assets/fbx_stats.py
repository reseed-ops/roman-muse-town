"""Triangle counts for the town's mesh FBX files (the GLBs and VRMs are read directly by build.ts).

Usage: blender -b --python tools/assets/fbx_stats.py -- ASSETS_DIR OUT.json FILE.fbx [FILE.fbx ...]
FILE paths are relative to ASSETS_DIR. The result is committed as fbx-stats.json so
build.ts does not need Blender (re-run this only when an FBX is added or replaced).
"""
import json
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
root, out, files = argv[0].rstrip("/"), argv[1], argv[2:]
stats = {}
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=f"{root}/{f}")
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    stats[f] = {"triangles": tris, "meshes": len(meshes), "materials": len({s.material.name for o in meshes for s in o.material_slots if s.material})}
json.dump(stats, open(out, "w"), indent=1, sort_keys=True)
print("fbx_stats", len(stats))
