# Task 84: contact sheet of wedding-pack candidates (inspection only).
# args: pack_dir, out_png, variant (HD|Mobile), names (list of glb stems)
import bpy, os, math
from mathutils import Vector
pack, out, variant, names = args["pack"], args["out"], args.get("variant", "HD"), args["names"]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
cols = 6; step = 1.8
info = {}
for i, n in enumerate(names):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(pack, variant, n + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    pts = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
    if not pts: continue
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    sz = hi - lo
    s = min(1.4 / max(sz.x, sz.y, sz.z), 3.0)
    root = [o for o in new if o.parent is None]
    emp = bpy.data.objects.new("m_" + n, None); bpy.context.collection.objects.link(emp)
    for o in root: o.parent = emp
    emp.scale = (s, s, s)
    emp.location = ((i % cols) * step, -(i // cols) * step, -lo.z * s)
    info[n] = [round(v, 2) for v in sz]
rows = (len(names) + cols - 1) // cols
cx, cy = (cols - 1) * step / 2, -(rows - 1) * step / 2
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); bpy.context.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(cols * step, rows * step * 1.5) * 1.02
cam.location = (cx, cy - 12, 6); cam.rotation_euler = (math.radians(68), 0, 0)
bpy.context.scene.camera = cam
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')); bpy.context.collection.objects.link(sun)
sun.data.energy = 3; sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(30))
w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.58, 0.62, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
bpy.context.scene.world = w
r = bpy.context.scene.render
r.engine = 'CYCLES'  # no EGL/GPU on this box: Workbench and EEVEE die, Cycles on CPU works
bpy.context.scene.cycles.device = 'CPU'; bpy.context.scene.cycles.samples = 24; bpy.context.scene.cycles.use_denoising = False
r.resolution_x = 1800; r.resolution_y = int(1800 * rows * step / (cols * step) * 1.1) + 100
r.filepath = out
bpy.ops.render.render(write_still=True)
__result__ = info
