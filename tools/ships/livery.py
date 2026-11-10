# The trireme's second livery (Task 50): the pack's hull2 and sail2 maps,
# sized like the first livery's, written beside trireme.glb for the town
# to swap in at runtime (no second copy of the geometry).
import bpy, sys, os
src, outdir = (os.path.abspath(p) for p in sys.argv[sys.argv.index("--")+1:])
for name, size, fmt, ext in (("hull2", 1024, 'JPEG', 'jpg'), ("sail2", 512, 'PNG', 'png')):
    img = bpy.data.images.load(os.path.join(src, name + ".tga"))
    img.scale(size, size)
    img.filepath_raw = os.path.join(outdir, f"trireme_{name}.{ext}")
    img.file_format = fmt
    bpy.context.scene.render.image_settings.quality = 82
    img.save()
    print("WROTE", img.filepath_raw)
