#!/usr/bin/env python3
"""Task 126: night under moonlight: cliff bench (seated, rain) and lake dock (standing), plus a close view of Aelia.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/night126.py --url http://localhost:8099/ --out DIR --prefix after [--portrait]
Dev only."""
import argparse, importlib.util, os, sys, math, time
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--prefix", default=""); ap.add_argument("--skip-bench", action="store_true"); ap.add_argument("--dsf", type=int, default=1); ap.add_argument("--portrait", action="store_true")
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
    errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    S = lambda js, arg=None: page.evaluate(js, arg)
    S("()=>{const s=window.__townTour.scene;s.setWeather('rain');s.enterWalk();s.setFollowMode(true)}")
    def shot(name, clip=None):
        page.evaluate(HIDE); page.wait_for_timeout(600)
        kw = {"clip": clip} if clip else {}
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}-{ori}-{name}.png"), timeout=180000, **kw); print("SHOT", name, flush=True)
        page.evaluate(tm.SHOW_HUD)
    t.set_time(tm.rome_ms(time.time() * 1000, 23, 30)); page.wait_for_timeout(2500)
    print("sky", t.sky(), flush=True)
    place = lambda x, z, h, pitch=0.0, yaw=None, zoom=1.0: S("p=>window.__townTour.scene.restoreResume(p)", {"x": x, "z": z, "heading": h, "camYaw": h if yaw is None else yaw, "camPitch": pitch, "userZoom": zoom})
    # bench, rain
    if not a.skip_bench:
      pass
      place(0, 116.4, 0.0); page.wait_for_timeout(500)
      S("()=>window.__townTour.scene.toggleSit('bench-cliff')")
      for i in range(40):
          tele = S("()=>window.__townTour.scene.visitTelemetry()")
          if tele["museSeated"] and tele["gaiusSeated"] and i > 2: break
          page.wait_for_timeout(1000)
      page.wait_for_timeout(5000); t.settle("sit", 3, 30)
      print("tele", tele, flush=True)
      shot("1-bench-rain-behind")
      S("()=>window.__townTour.scene.orbitCamera(175,0)"); page.wait_for_timeout(2000)
      shot("2-bench-rain-front")
      S("()=>window.__townTour.scene.recenterCamera()")
    # lake, clear
    S("()=>window.__townTour.scene.setWeather('clear')"); page.wait_for_timeout(1500)
    S("()=>window.__townTour.scene.toggleSit('bench-cliff')") if not a.skip_bench else None; page.wait_for_timeout(3000)
    pl = [q for q in S("()=>window.__townTour.places") if q["id"] == "lake-dock"][0]; print("dock", pl, flush=True)
    LX, LZ, LH = -11.2, -31.05, -math.pi / 2  # the dock's land end, camera raised and pulled in (the stall and trees block a low one)
    place(LX, LZ, LH, 0.6, None, 0.6); page.wait_for_timeout(500); t.settle("lake", 8, 40)
    shot("3-lake-standing")
    tele = S("()=>window.__townTour.scene.visitTelemetry()")
    ax, az, ah = tele["museX"], tele["museZ"], tele["museHeading"]
    dx, dz = ax - LX, az - LZ; L = math.hypot(dx, dz) or 1.0
    nx, nz = -dz / L, dx / L
    if nx * math.sin(ah) + nz * math.cos(ah) < 0: nx, nz = -nx, -nz
    place(LX, LZ, LH, 0.6, math.atan2(-nx, -nz), 0.4); page.wait_for_timeout(2500); t.settle("o", 4, 30)
    shot("4-aelia-front-closeview")
    print("errors", errs[:8]); b.close()
