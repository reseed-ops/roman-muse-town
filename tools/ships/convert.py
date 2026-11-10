# Convert the two Alin Loghin ships to light GLBs for the town.
import bpy, sys, math, os, mathutils
args = sys.argv[sys.argv.index("--")+1:]
which, src, scripts, outdir = args
sys.path.insert(0, scripts)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def load_img(path, max_size, name, fmt):
    img = bpy.data.images.load(path)
    w, h = img.size
    s = min(1.0, max_size / max(w, h))
    if s < 1.0:
        img.scale(max(1, int(w * s)), max(1, int(h * s)))
    ext = 'png' if fmt == 'PNG' else 'jpg'
    out = os.path.join(outdir, f"_{name}.{ext}")
    img.filepath_raw = out
    img.file_format = fmt
    if fmt == 'JPEG':
        bpy.context.scene.render.image_settings.quality = 82
    img.save()
    img2 = bpy.data.images.load(out)
    img2.name = name
    return img2

def make_mat(name, img, alpha=False, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    if alpha:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        try:
            m.surface_render_method = 'DITHERED'
        except Exception:
            pass
        if hasattr(m, "blend_method"): m.blend_method = "CLIP"
        m.alpha_threshold = 0.5
    m.use_backface_culling = False
    return m

def build_trade():
    from fbx6 import read
    ver, tree = read(os.path.join(src, "kyrenia_lowPoly.FBX"))
    top = {n[0]: n for n in tree}
    img = load_img(os.path.join(src, "trade_ship.tga"), 512, "trade_ship", 'PNG')
    mat = make_mat("trade_ship", img, alpha=True)
    # The sail gets its own material (same texture), so the town can dye
    # it per pass: its faces map into the linen block at the atlas's top
    # right (u > 0.49, v > 0.6).
    sail = make_mat("trade_sail", img, alpha=True, rough=0.95)
    root_s = 0.5317946672439575
    objs = []
    for m in top['Objects'][2]:
        if m[0] != 'Model' or m[1][1] != 'Mesh':
            continue
        name = m[1][0].split('\x00')[0]
        kids = {k[0]: k for k in m[2]}
        props = {p[1][0]: p[1][3:] for p in kids['Properties60'][2]}
        verts = kids['Vertices'][1]
        pvi = kids['PolygonVertexIndex'][1]
        uvl = [k for k in m[2] if k[0] == 'LayerElementUV'][0]
        uvk = {k[0]: k[1] for k in uvl[2]}
        uv, uvi = uvk['UV'], uvk['UVIndex']
        nl = [k for k in m[2] if k[0] == 'LayerElementNormal'][0]
        nrm = {k[0]: k[1] for k in nl[2]}['Normals']
        V = [tuple(verts[i:i+3]) for i in range(0, len(verts), 3)]
        faces, cur = [], []
        for i in pvi:
            if i < 0:
                cur.append(~i); faces.append(cur); cur = []
            else:
                cur.append(i)
        me = bpy.data.meshes.new(name)
        me.from_pydata(V, [], faces)
        uvlay = me.uv_layers.new(name="UVMap")
        for li, loop in enumerate(me.loops):
            j = uvi[li]
            uvlay.data[li].uv = (uv[2*j], uv[2*j+1])
        me.normals_split_custom_set([tuple(nrm[3*li:3*li+3]) for li in range(len(me.loops))])
        me.materials.append(mat)
        me.materials.append(sail)
        for poly in me.polygons:
            us = [uvlay.data[li].uv for li in poly.loop_indices]
            cu = sum(u.x for u in us) / len(us); cv = sum(u.y for u in us) / len(us)
            poly.material_index = 1 if (cu > 0.49 and cv > 0.6) else 0
        print("SAIL faces", name, sum(1 for p in me.polygons if p.material_index == 1))
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        t = props['Lcl Translation']; r = props['Lcl Rotation']; s = props['Lcl Scaling']
        M = (mathutils.Matrix.Translation(t) @ mathutils.Euler([math.radians(a) for a in r], 'XYZ').to_matrix().to_4x4()
             @ mathutils.Matrix.Diagonal((*s, 1)))
        ob.matrix_world = mathutils.Matrix.Diagonal((root_s, root_s, root_s, 1)) @ M
        objs.append(ob)
    return objs

def build_trireme():
    bpy.ops.import_scene.fbx(filepath=os.path.join(src, "trireme.FBX"))
    for o in list(bpy.data.objects):
        if o.type == 'MESH':
            bpy.context.view_layer.objects.active = o
            for mod in list(o.modifiers):
                bpy.ops.object.modifier_apply(modifier=mod.name)
            mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
            o.vertex_groups.clear()
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    tex = {
        'Hull': ("hull.tga", 1024, 'JPEG', False, 0.8),
        'Planks': ("planks.tga", 512, 'JPEG', False, 0.9),
        'Rope': ("rope.tga", 256, 'JPEG', False, 0.9),
        'Sail': ("sail.tga", 512, 'PNG', True, 0.95),
        'Wood': ("wood.tga", 512, 'JPEG', False, 0.85),
    }
    mats = {}
    for k, (f, sz, fmt, al, ro) in tex.items():
        mats[k] = make_mat("trireme_" + k.lower(), load_img(os.path.join(src, f), sz, "trireme_" + k.lower(), fmt), alpha=al, rough=ro)
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in objs:
        for i, slot in enumerate(o.material_slots):
            base = slot.material.name.split('.')[0] if slot.material else None
            if base in mats:
                o.data.materials[i] = mats[base]
    return objs

reset()
objs = build_trade() if which == 'trade' else build_trireme()
# Join into one mesh, apply transforms.
bpy.ops.object.select_all(action='DESELECT')
for o in objs: o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.join()
ship = bpy.context.view_layer.objects.active
ship.name = which
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bb = [mathutils.Vector(c) for c in ship.bound_box]
mn = mathutils.Vector([min(v[i] for v in bb) for i in range(3)]); mx = mathutils.Vector([max(v[i] for v in bb) for i in range(3)])
print("BOUNDS", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx))
for o in bpy.data.objects: print("OBJ", o.name, len(o.data.polygons) if o.type=='MESH' else '')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir, which + "_raw.blend"))
