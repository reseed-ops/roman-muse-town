"""Render a GLB from a three-quarter view, Cycles CPU (EEVEE/Workbench need libEGL, absent here).

  blender-headless.sh -b --python tools/idyllic/render.py -- IN.glb OUT.png [az_deg] [elev] [dist_mult] [zoom_to_front 0|1]
"""
import math
import sys

import bpy
from mathutils import Vector

a = sys.argv[sys.argv.index("--") + 1:]
src, dst = a[0], a[1]
az = math.radians(float(a[2])) if len(a) > 2 else math.radians(-35)
elev = float(a[3]) if len(a) > 3 else 0.3
dm = float(a[4]) if len(a) > 4 else 2.4

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ms = [o for o in bpy.context.scene.objects if o.type == "MESH"]
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
tris = 0
for o in ms:
    tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
ctr = (lo + hi) / 2
size = hi - lo
print("TRIS", tris, "SIZE", tuple(round(v, 2) for v in size))
rad = max(size.x, size.y) / 2

sd = bpy.data.lights.new("Sun", "SUN")
sd.energy = 4.0
sun = bpy.data.objects.new("Sun", sd)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, math.radians(30))
cd = bpy.data.cameras.new("Cam")
cd.lens = 40
cam = bpy.data.objects.new("Cam", cd)
bpy.context.collection.objects.link(cam)
d = rad * dm
cam.location = (ctr.x + d * math.sin(az), ctr.y - d * math.cos(az), ctr.z + d * elev)
cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 24
sc.render.resolution_x = 1000
sc.render.resolution_y = 640
sc.render.filepath = dst
w = bpy.data.worlds.new("W")
w.color = (0.6, 0.72, 0.9)
sc.world = w
bpy.ops.render.render(write_still=True)
print("RENDER DONE", dst)
