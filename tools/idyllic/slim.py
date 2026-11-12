"""Slim one Idyllic Rome FBX into a town-ready, textured GLB (Task 85).

Usage:
  blender-headless.sh -b --python tools/idyllic/slim.py -- SRC.fbx TEXDIR OUT.glb RATIO [TEXSIZE] [amph] [wall=r,g,b]

SRC.fbx   the pack mesh (the pack's licensed source; never committed)
TEXDIR    a folder of the pack's *_BaseMap.png files, copied out of the unitypackage
RATIO     amph: overall scale on the KEEP table (1.0 = as written);
          anything else: the fraction of triangles every part keeps
TEXSIZE   longest texture edge in pixels (default 512)
amph      the amphitheatre's per-material table and face culling

The FBX carries no texture references the converter can follow, so every
material is rebuilt here: BaseMap only (the town's lighting is its own, no
normal or mask maps), downscaled and embedded as JPEG. Materials with no
BaseMap in the pack keep a flat colour chosen below.
"""
import math
import os
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, texdir, out, ratio = argv[0], argv[1], argv[2], float(argv[3])
texsize = int(argv[4]) if len(argv) > 4 else 512
WALL = next((tuple(float(v) for v in a[5:].split(",")) for a in argv[5:] if a.startswith("wall=")), None)  # plaster colour override, r,g,b
AMPH = "amph" in argv[5:]  # the amphitheatre: per-material KEEP table and face culling
WELD = 0.0002  # weld distance, metres
PLANAR = 1.0  # planar dissolve angle, degrees (0 = off)

# material name -> BaseMap file in TEXDIR (None: flat colour below)
TEX = {
    "M_columns_rome": "M_columns_rome_BaseMap.png",
    "M_stoneblocks_small": "M_stoneblocks_small_BaseMap.png",
    "M_stoneblocks_large": "M_stoneblocks_large_BaseMap.png",
    "M_podests_rome": "M_podests_rome_BaseMap.png",
    "M_edges_rome": "M_edges_rome_BaseMap.png",
    "M_triumphalarch": "M_triumphalarch_BaseMap.png",
    "M_banner_hanger": "M_banner_hanger_BaseMap.png",
    "M_banners_rome": "M_banners_rome_BaseMap.png",
    "M_woodenplanks": "M_woodenplanks_BaseMap.png",
    "M_rope": "M_rope_diff.png",
    "M_stoneslabs": "M_stoneslabs_BaseMap.png",
    "M_rooftiles_rome": "M_rooftiles_rome_BaseMap.png",
    "M_rooftiles_tiling": "M_rooftiles_roman_tiling_BaseColor.png",
    "M_sculpture_male": "M_SculptureMale_BaseMap.png",
    "M_sculpture_female": "M_sculpture_female_BaseMap.png",
    "M_cloth_sculptures": "M_cloth_sculptures_BaseMap.png",
    "M_sculpture_extras": "M_sculpture_extras_BaseMap.png",
    "M_armor_roman": "M_armor_roman_BaseMap.png",
}
FLAT = {
    "M_walls_01": (0.78, 0.72, 0.62, 1),
    "M_stone": (0.74, 0.70, 0.64, 1),
    "M_metallic": (0.55, 0.42, 0.2, 1),
    "M_cloth": (0.62, 0.08, 0.07, 1),
    "M_floortiles": (0.55, 0.36, 0.26, 1),
    "M_glass_windows": (0.16, 0.2, 0.24, 1),
    "M_wall_01": (0.78, 0.72, 0.62, 1),
}
# per-material share of triangles to keep (RATIO scales them all): shafts and
# rods are cylinders and survive heavy cuts; arch trims and walls need more
KEEP = {
    "M_columns_rome": 0.09, "M_edges_rome": 0.13, "M_banner_hanger": 0.08,
    "M_banners_rome": 0.09, "M_podests_rome": 0.25, "M_triumphalarch": 0.25,
    "M_walls_01": 0.25, "M_stoneblocks_small": 1.0, "M_stoneblocks_large": 1.0,
}
# the little block courses are boxes whose undersides and arena-facing sides
# are never seen: cull those faces (normal below DOWN, or facing the ring axis)
CULL = {"M_stoneblocks_small", "M_stoneblocks_large", "M_podests_rome"}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in objs:
    o.select_set(False)
    # some pack FBXs carry an animation take that holds the unit scale: it would
    # be exported on top of the baked transform
    o.animation_data_clear()

# 1. materials -> textured principled, texture downscaled
imgs = {}
def image_for(fn):
    if fn in imgs:
        return imgs[fn]
    im = bpy.data.images.load(os.path.join(texdir, fn))
    w, h = im.size
    s = texsize / max(w, h)
    if s < 1:
        im.scale(max(1, int(w * s)), max(1, int(h * s)))
    im.file_format = "JPEG"
    imgs[fn] = im
    return im

for m in bpy.data.materials:
    base = m.name.split(".")[0]
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out_n = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    if base in TEX and os.path.exists(os.path.join(texdir, TEX[base])):
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = image_for(TEX[base])
        nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        colour = FLAT.get(base, (0.7, 0.68, 0.62, 1))
        if WALL and base in ("M_walls_01", "M_wall_01"):
            colour = (*WALL, 1)
        bsdf.inputs["Base Color"].default_value = colour
    nt.links.new(bsdf.outputs["BSDF"], out_n.inputs["Surface"])
    m.use_backface_culling = False

# 2. join, split by material, decimate each, report
bpy.context.view_layer.objects.active = objs[0]
for o in objs:
    o.select_set(True)
if len(objs) > 1:
    bpy.ops.object.join()
whole = bpy.context.view_layer.objects.active
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="MATERIAL")
bpy.ops.object.mode_set(mode="OBJECT")
parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
before = after = 0
for o in parts:
    bpy.context.view_layer.objects.active = o
    # apply the FBX unit scale so the export is in metres
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    name = o.material_slots[0].material.name.split(".")[0] if o.material_slots else "?"
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    before += tris
    if AMPH and name in CULL:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        dead = []
        for f in bm.faces:
            n, c = f.normal, f.calc_center_median()
            radial = (c.x * n.x + c.y * n.y) / max(1e-6, math.hypot(c.x, c.y))
            if n.z < -0.7 or radial < -0.7:
                dead.append(f)
        bmesh.ops.delete(bm, geom=dead, context="FACES")
        bm.to_mesh(o.data)
        bm.free()
    r = min(1.0, ratio * KEEP.get(name, 0.25)) if AMPH else ratio
    if r < 1 and tris > 200:
        # weld, then lossless planar dissolve, then collapse the rest
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.remove_doubles(threshold=WELD)
        if PLANAR > 0:
            bpy.ops.mesh.dissolve_limited(angle_limit=math.radians(PLANAR), delimit={"MATERIAL", "UV", "SHARP"})
        bpy.ops.mesh.quads_convert_to_tris()
        bpy.ops.object.mode_set(mode="OBJECT")
        tmid = len(o.data.polygons)
        md = o.modifiers.new("dec", "DECIMATE")
        md.ratio = min(1.0, r * tris / max(1, tmid))
        md.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="dec")
    t2 = sum(len(p.vertices) - 2 for p in o.data.polygons)
    after += t2
    print("PART %-22s tris %8d -> %7d" % (name, tris, t2))
print("TOTAL tris %d -> %d (ratio %.3f)" % (before, after, ratio))

bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", export_image_format="JPEG",
    export_jpeg_quality=80, export_apply=True, export_yup=True,
    export_normals=True, export_texcoords=True, export_materials="EXPORT", export_animations=False,
)
print("SLIM DONE", out, os.path.getsize(out))
