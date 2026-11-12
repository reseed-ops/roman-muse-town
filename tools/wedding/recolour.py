# Task 84: the Wedding Banquet pack's pieces, recoloured to the town's Roman
# palette (terracotta, marble white, deep red, gold, olive and laurel green,
# saffron for the flammeum). Pure glTF-JSON surgery: the pack's materials are
# flat colour factors (plus a few fabric textures that a factor tints), so no
# mesh or image is touched. Geometry stays byte-identical.
#
# usage: python3 -I recolour.py <pack_dir> <out_dir>   (writes <out_dir>/<name>.glb)
# The pack is licensed (no redistribution): the output goes to
# client/src/assets/wedding/ and stays git-ignored.
import json, struct, sys, os

PIECES = {  # output name -> (pack variant dir, pack file)
    "flower_arch": ("Mobile", "wedding_merge_flower_05"),
    "table_long": ("Mobile", "wedding_table_long_dressed_classic"),
    "table_round": ("Mobile", "wedding_table_round_dressed_classic"),
    "cake": ("Mobile", "wedding_cake_classic_3"),
    "ring_box": ("Mobile", "wedding_ring_box_open"),
    "flammeum_stand": ("Mobile", "wedding_veil_long"),
}

def lin(hexrgb, a=None):
    c = [((hexrgb >> s) & 255) / 255 for s in (16, 8, 0)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return c + ([a] if a is not None else [1.0])

GOLD = 0xd4af37
RECOLOUR = {
    # greens -> laurel and olive
    "Wedding_Leaf": 0x5f8a3a, "Wedding_Leaf_Dark": 0x3d5a24,
    "Wedding_Eucalyptus": 0x8a9a5b, "Wedding_Stem": 0x4a5a28,
    # blooms -> deep red and terracotta, ivory stays ivory
    "Wedding_Petal_Blush": 0xa3262a, "Wedding_Deep_Blush": 0x6e1518,
    "Wedding_Petal_Peach": 0xc4623f, "Wedding_Deep_Peach": 0x8f3d26,
    "Wedding_Petal_Rose": 0xb52f2f, "Wedding_Deep_Rose": 0x5e1216,
    "Wedding_Deep_White": 0xd9ccb0, "Wedding_Petal_White": 0xf4eee0,
    "Wedding_Petal_Ivory": 0xe9dcc0, "Wedding_Deep_Ivory": 0xb99a62,
    "Wedding_Fond_Ivory": 0xefe6d2, "Wedding_Fond_White": 0xf4eee0,
    "Wedding_Gold": GOLD, "Wedding_Gloss_White": 0xf2efe6,
    "Wedding_White": 0xece8dc,            # the arch's planters: marble white (texture, tinted)
    "Wedding_Walnut": 0xb86a45,           # the stand's wood: terracotta
    "Wedding_Fab_Ivory": 0xf3ead6,        # cloths: ivory linen
    "Wedding_Sat_Champagne": 0xf3ead6,
    "Wedding_Vel_Berry": 0xb23a30,        # the ring box's velvet: deep red
}
ALPHA = {  # translucent cloth: arch ribbon and the veil become the flammeum's saffron
    "Wedding_Tulle_Blush": (0xe9a23b, 0.6), "Wedding_Veil": (0xe8833a, 0.55), "Wedding_Tulle_White": (0xf4eee0, 0.55),
}

def read_glb(p):
    b = open(p, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + jl]), b[20 + jl:]

def write_glb(p, j, rest):
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + len(rest)
    open(p, "wb").write(b"glTF" + struct.pack("<II", 2, total) + struct.pack("<I", len(js)) + b"JSON" + js + rest)

def recolour(j):
    for m in j.get("materials", []):
        n = m["name"].split(".")[0]
        pb = m.setdefault("pbrMetallicRoughness", {})
        if n in ALPHA:
            pb["baseColorFactor"] = lin(*ALPHA[n])
        elif n in RECOLOUR:
            pb["baseColorFactor"] = lin(RECOLOUR[n])
            if n == "Wedding_Gold":
                pb["metallicFactor"] = 0.5; pb["roughnessFactor"] = 0.4
    return j

if __name__ == "__main__":
    pack, out = (os.path.abspath(a) for a in sys.argv[1:3])
    os.makedirs(out, exist_ok=True)
    for name, (variant, src) in PIECES.items():
        j, rest = read_glb(os.path.join(pack, variant, src + ".glb"))
        write_glb(os.path.join(out, name + ".glb"), recolour(j), rest)
        print("WROTE", name, os.path.getsize(os.path.join(out, name + ".glb")))
