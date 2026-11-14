"""Task 93, stage 1: the pack's Normal and MaskMap textures, made web-sized.

Usage:
  blender-headless.sh -b --python tools/idyllic/convert_maps.py -- SRCDIR OUTDIR
SRCDIR  a folder of the pack's *_Normal.png / *_MaskMap.png, copied out of the unitypackage
        (the pack's licensed files; never committed)
OUTDIR  receives <Name>_Normal.jpg and <Name>_orm.jpg

Normals are resized and kept as they are (Unity's tangent-space, Y up, as glTF).
A Unity MaskMap holds R metallic, G ambient occlusion, B detail mask, A smoothness;
glTF wants R occlusion, G roughness, B metalness, so the ORM written here is
(AO, 1 - smoothness, metal). Then tools/idyllic/restore_maps.py patches the GLBs.
"""
import os
import sys

import bpy
import numpy as np

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
os.makedirs(out, exist_ok=True)
# edge in pixels per material (the pack's maps are 2K to 4K)
SIZE = {"M_SculptureMale": 1024, "M_sculpture_female": 1024, "M_putti": 1024}
DEFAULT = 512

def load(fn):
    im = bpy.data.images.load(os.path.join(src, fn))
    im.alpha_mode = "CHANNEL_PACKED"
    im.colorspace_settings.name = "Non-Color"
    return im

def save_jpg(px, size, path, q=88):
    im = bpy.data.images.new("o", size, size, alpha=False, float_buffer=False)
    im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(px.ravel())
    im.file_format = "JPEG"
    sc = bpy.context.scene
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = q
    sc.render.image_settings.color_mode = "RGB"
    im.save_render(path, scene=sc)
    bpy.data.images.remove(im)

for fn in sorted(os.listdir(src)):
    stem, kind = (fn[:-12], "orm") if fn.endswith("_MaskMap.png") else (fn[:-11], "n") if fn.endswith("_Normal.png") else (None, None)
    if kind is None:
        continue
    key = next((k for k in SIZE if stem.lower() == k.lower()), None)
    size = SIZE.get(key, DEFAULT)
    im = load(fn)
    w, h = im.size
    im.scale(size, size)
    px = np.empty(size * size * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    if kind == "n":
        res = np.concatenate([px[:, :3], np.ones((px.shape[0], 1), np.float32)], axis=1)
        save_jpg(res, size, os.path.join(out, stem + "_Normal.jpg"), 90)
    else:
        metal, ao, smooth = px[:, 0], px[:, 1], px[:, 3]
        res = np.stack([ao, 1.0 - smooth, metal, np.ones_like(ao)], axis=1)
        save_jpg(res, size, os.path.join(out, stem + "_orm.jpg"), 88)
    print("MAP", fn, w, h, "->", size, kind)
    bpy.data.images.remove(im)
