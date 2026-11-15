#!/usr/bin/env python3
"""Task 99: photograph the coastal shoulder. Views: west-coast candidates (the phone frame), the southbound walk,
the seated south view, and overhead; day and night.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/shoulder99.py --url http://localhost:8099/ --out DIR [--only west,walk]
Reuses tour.py's page hooks (?tour). Dev only."""
import argparse, importlib.util, os, sys, time
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--passes", nargs="*", default=["day", "night"]); ap.add_argument("--prefix", default="")
ap.add_argument("--only", default="west,walk,seat,over,flank")
a = ap.parse_args(); only = a.only.split(",")
a.width, a.height, a.load_s, a.load_settle_s = 1280, 560, 240, 20
os.makedirs(a.out, exist_ok=True)
HIDE = """()=>{const c=document.querySelector('canvas');
  for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;e.style.visibility='hidden'}}"""
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
    for ps in a.passes:
        t.set_time(tm.rome_ms(now, 12, 0) if ps == "day" else tm.rome_ms(now, 23, 30)); page.wait_for_timeout(2500)
        if "west" in only:
            # west-coast candidates, facing the peninsula (heading is the walker's yaw; 0 faces south)
            for i, (x, z, h) in enumerate([(-30, 42, 0.55), (-38, 36, 0.8), (-24, 46, 0.35)]):
                print(place(page, x, z, h, 1.0), flush=True); t.settle("w", 3, 30); shot(f"{ps}-w{i+1}")
        if "walk" in only:
            for i, z in enumerate([50, 70, 90]):
                place(page, 0.5, z, 0.0, 1.0); t.settle("k", 3, 30); shot(f"{ps}-walk{i+1}")
            place(page, 0.2, 104, 0.0, 1.0); t.settle("k", 3, 30); shot(f"{ps}-walk4-bench")
        if "seat" in only:
            place(page, 0, 116.4, 0.0, 1.0); page.wait_for_timeout(500)
            page.evaluate("()=>window.__townTour.scene.toggleSit('bench-cliff')"); page.wait_for_timeout(5000); t.settle("sit", 3, 40)
            shot(f"{ps}-seat-south")
            page.evaluate("()=>window.__townTour.scene.orbitCamera(-120,0)"); page.wait_for_timeout(1500)
            shot(f"{ps}-seat-west")
            page.evaluate("()=>window.__townTour.scene.orbitCamera(120,0)"); page.evaluate("()=>window.__townTour.scene.standUp()"); page.wait_for_timeout(1500)
        if "flank" in only:
            # the shoulder seen from the town side, from the trail, from the headland, and from high above (heading is the walker's yaw: 0 faces south, -pi/2 faces west)
            for name, (x, z, h, zoom, pitch) in {"flank-sw": (-22, 46, -0.8, 1.0, 0.0), "flank-west-from-trail": (0.5, 72, -1.57, 1.0, 0.1),
                                                 "flank-from-head": (0, 108, -1.0, 1.0, 0.1), "high-west": (0.5, 75, -1.57, 9.0, 1.1), "high-south": (0.5, 52, 0.0, 9.0, 1.1)}.items():
                print(name, place(page, x, z, h, zoom, pitch), flush=True); t.settle("f", 3, 30); shot(f"{ps}-{name}")
        if "over" in only:
            place(page, 0.5, 60, 0.0, 6.0, 1.2); t.settle("o", 3, 30); shot(f"{ps}-over")
    print("errors", errs[:5]); b.close()
