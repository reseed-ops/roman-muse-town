#!/usr/bin/env python3
"""Task 105: photograph the lake from the dock by day, 18:14 and 23:30, plus the sea cliff and the garden pond (unchanged).
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/lake105.py --url http://localhost:8099/ --out DIR
Reuses tour.py's page hooks (?tour). Dev only."""
import argparse, importlib.util, os, sys, time, math
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True); ap.add_argument("--prefix", default="")
a = ap.parse_args()
a.width, a.height, a.load_s, a.load_settle_s = 1280, 720, 240, 20
os.makedirs(a.out, exist_ok=True)
HIDE = """()=>{const c=document.querySelector('canvas');window.__hid=[];
  for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
    if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
def place(page, x, z, heading, zoom=1.0, pitch=0.0, yaw=None):
    return page.evaluate("p=>{const sc=window.__townTour.scene;sc.restoreResume(p);return sc.resumeState()}",
        {"x": x, "z": z, "heading": heading, "camYaw": heading if yaw is None else yaw, "camPitch": pitch, "userZoom": zoom})
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": a.width, "height": a.height})
    errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    page.evaluate("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk();s.setFollowMode(true)}")
    now = time.time() * 1000
    def shot(name):
        page.evaluate(HIDE); page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}{name}.png"), timeout=120000); print("SHOT", name, flush=True)
        page.evaluate(tm.SHOW_HUD)
    for name, (h, m) in [("day1200", (12, 0)), ("dusk1814", (18, 14)), ("night2330", (23, 30))]:
        t.set_time(tm.rome_ms(now, h, m)); page.wait_for_timeout(2500)
        # on the dock, looking west across the lake, then down at the water
        for k, (x, pitch, zoom) in enumerate([(-11.2, 0.15, 1.0), (-11.2, 0.6, 0.6), (-12.6, 0.7, 0.4)]):
            print(place(page, x, -31.05, -math.pi/2, zoom, pitch), flush=True); t.settle("l", 4, 30); shot(f"{name}-lake-{k}")
        # the sea from the headland edge, and the villa fishpond
        place(page, 0, 121.0, 0.0, 1.0, 0.35, 0.0); t.settle("s", 4, 30); shot(f"{name}-sea")
        place(page, -11.5, 26.5, math.pi, 1.0, 0.5); t.settle("p", 4, 30); shot(f"{name}-pond")
    print("errors", errs[:5]); b.close()
