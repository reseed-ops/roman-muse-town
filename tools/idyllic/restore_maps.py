#!/usr/bin/env python3
"""Task 93, stage 2: put the pack's normal and mask maps back into the slimmed GLBs.

Usage:  python3 -I tools/idyllic/restore_maps.py MAPDIR GLB [GLB...]
MAPDIR  the output of tools/idyllic/convert_maps.py (<Name>_Normal.jpg, <Name>_orm.jpg)

Edits each GLB in place, JSON and an appended binary tail only: the geometry
bytes, the node transforms and the base colour textures are not touched, so no
shape, scale or position can change. For every material whose pack name is in
MAPS it adds a normalTexture and, where the pack has a MaskMap, an
occlusion + metallicRoughness texture (one ORM image used for both, as glTF).
Materials that already carry a normalTexture are left alone (safe to re-run).
"""
import json
import os
import struct
import sys

# material -> (normal map stem, orm stem or None, roughnessFactor override or None, metallicFactor)
MAPS = {
    "M_sculpture_female": ("M_sculpture_female", None),
    "M_sculpture_male": ("M_SculptureMale", None),
    "M_putti_sculpture": ("M_putti", None),
    "M_cloth_sculptures": ("M_cloth_sculptures", None),
    "M_sculpture_extras": ("M_sculpture_extras", "M_sculpture_extras"),
    "M_columns_rome": ("M_columns_rome", "M_columns_rome"),
    "M_stoneblocks_small": ("M_stoneblocks_small", "M_stoneblocks_small"),
    "M_stoneblocks_large": ("M_stoneblocks_large", "M_stoneblocks_large"),
    "M_podests_rome": ("M_podests_rome", "M_podests_rome"),
    "M_edges_rome": ("M_edges_rome", "M_edges_rome"),
    "M_triumphalarch": ("M_triumphalarch", None),
}
# the town's lighting has little to reflect, so a pack's metal inlays are held to half
METAL_SCALE = 0.5
# statue marble: the slim step left every material at roughness 0.85; carved, polished stone is a little glossier
# the putto's fine grain reads furry under a warm lamp at full strength
NORMAL_SCALE = {"M_putti_sculpture": 0.7}
MARBLE_ROUGH = {"M_sculpture_female": 0.7, "M_sculpture_male": 0.7, "M_putti_sculpture": 0.7}


def read_glb(path):
    d = open(path, "rb").read()
    assert d[:4] == b"glTF"
    jl = struct.unpack("<I", d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    bo = 20 + jl
    bl = struct.unpack("<I", d[bo:bo + 4])[0]
    assert d[bo + 4:bo + 8] == b"BIN\0"
    return j, bytearray(d[bo + 8:bo + 8 + bl])


def write_glb(path, j, binary):
    while len(binary) % 4:
        binary.append(0)
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    open(path, "wb").write(b"glTF" + struct.pack("<II", 2, total) + struct.pack("<I", len(js)) + b"JSON" + js
                           + struct.pack("<I", len(binary)) + b"BIN\0" + bytes(binary))


def patch(path, mapdir):
    j, binary = read_glb(path)
    added = {}

    def texture(fn, sampler):
        if fn in added:
            return added[fn]
        data = open(os.path.join(mapdir, fn), "rb").read()
        while len(binary) % 4:
            binary.append(0)
        j["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
        binary.extend(data)
        j.setdefault("images", []).append({"bufferView": len(j["bufferViews"]) - 1, "mimeType": "image/jpeg", "name": fn[:-4]})
        tex = {"source": len(j["images"]) - 1}
        if sampler is not None:
            tex["sampler"] = sampler
        j.setdefault("textures", []).append(tex)
        added[fn] = len(j["textures"]) - 1
        return added[fn]

    done = []
    for m in j["materials"]:
        base = m.get("name", "").split(".")[0]
        if base not in MAPS or "normalTexture" in m:
            continue
        pbr = m.setdefault("pbrMetallicRoughness", {})
        bc = pbr.get("baseColorTexture")
        sampler = j["textures"][bc["index"]].get("sampler") if bc else None
        n, orm = MAPS[base]
        m["normalTexture"] = {"index": texture(n + "_Normal.jpg", sampler), "scale": NORMAL_SCALE.get(base, 1.0)}
        if orm:
            ti = texture(orm + "_orm.jpg", sampler)
            m["occlusionTexture"] = {"index": ti}
            pbr["metallicRoughnessTexture"] = {"index": ti}
            pbr["roughnessFactor"] = 1.0  # the map's G channel is the roughness
            pbr["metallicFactor"] = METAL_SCALE
        elif base in MARBLE_ROUGH:
            pbr["roughnessFactor"] = MARBLE_ROUGH[base]
        done.append(base + (" +orm" if orm else ""))
    j["buffers"][0]["byteLength"] = len(binary)
    write_glb(path, j, binary)
    print(os.path.basename(path), "patched:", ", ".join(done) or "nothing")


if __name__ == "__main__":
    for g in sys.argv[2:]:
        patch(g, sys.argv[1])
