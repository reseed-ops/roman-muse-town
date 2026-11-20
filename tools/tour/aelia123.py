#!/usr/bin/env python3
"""Task 123: photograph Aelia (play distance + close-up, standing beside Gaius, walking, bench lean).
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/aelia123.py --url http://localhost:8099/ --out DIR --prefix after --portrait
Dev only."""
import argparse, importlib.util, os, sys, math, base64
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--prefix", default=""); ap.add_argument("--dsf", type=int, default=2); ap.add_argument("--portrait", action="store_true")
a = ap.parse_args()
a.width, a.height = (720, 1280) if a.portrait else (1280, 720)
a.load_s, a.load_settle_s = 300, 20
os.makedirs(a.out, exist_ok=True)
ori = "portrait" if a.portrait else "landscape"
HIDE = """()=>{const c=document.querySelector('canvas');window.__hid=[];for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
 if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": a.width, "height": a.height}, device_scale_factor=a.dsf)
    errs = []; page.on("pageerror", lambda e: errs.append(str(e))); page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    S = lambda js, arg=None: page.evaluate(js, arg)
    S("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk();s.setFollowMode(true)}")
    def shot(name, clip=None):
        page.evaluate(HIDE); page.wait_for_timeout(600)
        kw = {"clip": clip} if clip else {}
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}-{ori}-{name}.png"), timeout=180000, **kw); print("SHOT", name, flush=True)
        page.evaluate(tm.SHOW_HUD)
    t.set_time(tm.rome_ms(__import__("time").time() * 1000, 12, 0)); page.wait_for_timeout(2500)
    place = lambda x, z, h: S("p=>{const sc=window.__townTour.scene;sc.restoreResume(p)}", {"x": x, "z": z, "heading": h, "camYaw": h, "camPitch": 0.0, "userZoom": 1.0})
    # standing beside Gaius on the plaza-side street, Aelia in follow
    place(0, 100, 0.0); page.wait_for_timeout(500); t.settle("stand", 8, 40)
    shot("1-beside-gaius-behind")
    # walking: the stick forward, shot mid-stride from behind
    S("()=>window.__townTour.scene.setWalkMove(0,1)"); page.wait_for_timeout(2500)
    shot("2-walking")
    S("()=>window.__townTour.scene.setWalkMove(0,0)"); page.wait_for_timeout(1500)
    place(0, 100, 0.0); page.wait_for_timeout(500); t.settle("stand2", 8, 40)
    # put the camera in front of Aelia (she wanders to either side of Gaius): read where she stands and faces,
    # set the camera 3.2 m out along her facing, looking at Gaius; the nearest the player's camera goes is 3 m
    def crops(tag):
        page.evaluate(HIDE); page.wait_for_timeout(500)
        png = base64.b64encode(page.screenshot()).decode()
        box = page.evaluate("""async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
          const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
          for (let y = 0; y < c.height * 0.8; y += 2) for (let x = 0; x < c.width; x += 2) { const k = (y * c.width + x) * 4, r = d[k], gg = d[k+1], bb = d[k+2];
            const strawberry = r > 190 && gg > 120 && gg < 190 && bb > 80 && bb < 150 && r - bb > 70 && r - gg > 25 && r - gg < 70;
            const silver = r > 175 && Math.abs(r - gg) < 16 && gg - bb > 6 && gg - bb < 40;
            if (strawberry || %s) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
          return { x0, x1, y0, y1, n }; }""" % ("silver" if a.prefix == "before" else "false"), png)
        print("hair box", tag, box, flush=True)
        page.evaluate(tm.SHOW_HUD)
        if box["n"] > 20:
            f = float(a.dsf); hx, hy, hw = box["x0"] / f, box["y0"] / f, max(30.0, (box["x1"] - box["x0"]) / f)
            shot(f"{tag}-aelia-play-distance-crop", {"x": max(0, hx - hw * 2), "y": max(0, hy - hw * 0.6), "width": hw * 5, "height": hw * 7})
            shot(f"{tag}-aelia-face-neck-crop", {"x": max(0, hx - hw * 0.5), "y": max(0, hy - hw * 0.2), "width": hw * 2.2, "height": hw * 2.2})
    def camera_on(side):
        tele = S("()=>window.__townTour.scene.visitTelemetry()")
        ax, az, ah = tele["museX"], tele["museZ"], tele["museHeading"]
        dx, dz = ax - 0.0, az - 100.0; L = math.hypot(dx, dz) or 1.0
        nx, nz = -dz / L, dx / L
        if side == "front":
            if nx * math.sin(ah) + nz * math.cos(ah) < 0: nx, nz = -nx, -nz
        else:  # her left, the neck with the mole: her left is (cos h, -sin h) for a model facing +z
            if nx * math.cos(ah) - nz * math.sin(ah) < 0: nx, nz = -nx, -nz
        S("p=>window.__townTour.scene.restoreResume(p)", {"x": 0, "z": 100, "heading": 0.0, "camYaw": math.atan2(-nx, -nz), "camPitch": 0.08, "userZoom": 1.0})
        page.wait_for_timeout(2500); t.settle("o", 4, 30)
    camera_on("front")
    shot("3-beside-gaius-front")
    pass
    camera_on("left")
    shot("5-beside-gaius-her-left")
    pass
    S("()=>window.__townTour.scene.recenterCamera()")
    # bench with the lean
    S("()=>window.__townTour.scene.recenterCamera()")
    place(0, 116.4, 0.0); page.wait_for_timeout(500)
    S("()=>window.__townTour.scene.toggleSit('bench-cliff')")
    for i in range(40):
        tele = S("()=>window.__townTour.scene.visitTelemetry()")
        if tele["museSeated"] and tele["gaiusSeated"] and i > 2: break
        page.wait_for_timeout(1000)
    page.wait_for_timeout(6000); t.settle("sit", 3, 30)
    print("tele", tele, flush=True)
    shot("6-bench-behind")
    S("()=>window.__townTour.scene.orbitCamera(175,0)"); page.wait_for_timeout(2000)
    shot("7-bench-front")
    print("errors", errs[:8]); b.close()
