# Converting the Loghin ships (Task 50)

Makes `client/src/assets/ships/trade_ship.glb`, `trireme.glb` and the trireme's
second livery (`trireme_hull2.jpg`, `trireme_sail2.png`) from the
owner's two Unity packages (see ASSETS.md, section 12). The outputs are
licensed files: they stay in the ignored assets folder and are never
committed.

1. Extract each `.unitypackage` (a gzipped tar of GUID folders, each with
   `pathname` and `asset`) and copy the files below into a work folder per
   ship, under their own names:
   - `trade/`: `kyrenia_lowPoly.FBX`, `trade_ship.tga`
   - `trireme/`: `trireme.FBX`, `hull.tga`, `planks.tga`, `rope.tga`, `sail.tga`, `wood.tga`
2. Build each ship into a .blend (the trade ship's FBX 6100 is read by `fbx6.py`):

   ```bash
   blender -b --factory-startup -P tools/ships/convert.py -- trade   WORK/trade   tools/ships WORK/out
   blender -b --factory-startup -P tools/ships/convert.py -- trireme WORK/trireme tools/ships WORK/out
   ```

3. Turn bow to +X, centre, keel at 0, and export:

   ```bash
   blender -b --factory-startup -P tools/ships/export.py -- WORK/out/trade_raw.blend   client/src/assets/ships/trade_ship.glb
   blender -b --factory-startup -P tools/ships/export.py -- WORK/out/trireme_raw.blend client/src/assets/ships/trireme.glb
   ```

4. The trireme's second livery (copy `hull2.tga` and `sail2.tga` into `WORK/trireme` too):

   ```bash
   blender -b --factory-startup -P tools/ships/livery.py -- WORK/trireme client/src/assets/ships
   ```
