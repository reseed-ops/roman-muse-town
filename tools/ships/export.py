# Turn a converted ship to bow +X, centre it, keel at y = 0, and export a GLB (Task 50).
import bpy, sys, math, mathutils
blend, out = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.open_mainfile(filepath=blend)
ship = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
# Bow was -Y; turn it to +X (glTF +X), centre it, keel at 0.
ship.rotation_euler = (0, 0, math.radians(90))
bpy.context.view_layer.objects.active = ship; ship.select_set(True)
bpy.ops.object.transform_apply(rotation=True)
bb = [v.co.copy() for v in ship.data.vertices]
mn = [min(v[i] for v in bb) for i in range(3)]; mx = [max(v[i] for v in bb) for i in range(3)]
off = mathutils.Vector((-(mn[0]+mx[0])/2, -(mn[1]+mx[1])/2, -mn[2]))
ship.data.transform(mathutils.Matrix.Translation(off))
bb = [v.co.copy() for v in ship.data.vertices]
print("FINAL", [round(min(v[i] for v in bb),3) for i in range(3)], [round(max(v[i] for v in bb),3) for i in range(3)])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='AUTO',
    export_yup=True, export_apply=True, export_animations=False, export_skins=False, export_morph=False,
    export_cameras=False, export_lights=False, export_extras=False)
