#!/usr/bin/env python3
"""Task 113: the walk camera from the angles Archer reported (close behind Gaius, pitched up, behind a
cypress, behind the Town Tree, behind a wall, portrait with Aelia beside him), plus the desktop joystick check.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/cam113.py --url http://localhost:8099/ --out DIR --prefix before-
Reuses tour.py's page hooks (?tour). Dev only."""
import argparse, importlib.util, os, sys, time
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True); ap.add_argument("--prefix", default="")
ap.add_argument("--skip-stick", action="store_true")
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
    t.set_time(tm.rome_ms(now, 12, 0)); page.wait_for_timeout(2500)
    def shot(name):
        page.evaluate(HIDE); page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}{name}.png"), timeout=120000); print("SHOT", name, flush=True)
        page.evaluate(tm.SHOW_HUD)
    def scene(name, x, z, heading, zoom, pitch, yaw, museDx, museDz):
        r = place(page, x, z, heading, zoom, pitch, yaw); print(name, r, flush=True)
        page.evaluate("([x,z])=>window.__townTour.scene.placeMuseAt(x,z)", [r["x"] + museDx, r["z"] + museDz])
        page.wait_for_timeout(1500); t.settle(name, 4, 40); shot(name)
    # all from the avenue (cypresses at x = +-4.4), the forum's Town Tree (ring r 2.45), the villa terrace's west wall (x = -7.5)
    scene("1-close-behind", 0, 30, 0.0, 0.55, 0.0, 0.0, 1.5, 0.2)
    scene("2-pitched-up", 0, 30, 0.0, 1.0, -3.0, 0.0, 1.5, 0.2)
    scene("3-pitched-down", 0, 30, 0.0, 1.0, 2.6, 0.0, 1.5, 0.2)
    scene("4-behind-cypress", 3.2, 28, 0.0, 1.0, 0.0, -1.5708, 0.2, 1.4)
    scene("5-behind-town-tree", 0, -3.15, 0.0, 1.0, 0.0, 3.1416, 1.6, -0.3)
    scene("6-near-wall", -6.85, -32, 0.0, 1.0, 0.0, 1.5708, 0.2, 1.4)
    scene("7-near-wall-close", -6.85, -32, 0.0, 0.55, 0.0, 1.5708, 0.2, 1.4)
    page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(2500)
    scene("8-portrait-close", 0, 30, 0.0, 0.55, 0.0, 0.0, 1.5, 0.2)
    scene("9-portrait-default", 0, 30, 0.0, 1.0, 0.0, 0.0, 1.5, 0.2)
    page.set_viewport_size({"width": a.width, "height": a.height}); page.wait_for_timeout(2500)
    if not a.skip_stick:
        # the joystick with a mouse: press on the stick, push up, hold, and watch him walk
        place(page, 0, 36, 3.1416, 1.0, 0.0); page.wait_for_timeout(1500); t.settle("stick", 3, 30)
        box = page.evaluate("()=>{const e=document.querySelector('[data-mt-stick]');if(!e)return null;const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}")
        print("stick centre", box, flush=True)
        if box:
            def pos():
                r = page.evaluate("()=>window.__townTour.scene.resumeState()"); return (round(r["x"], 2), round(r["z"], 2))
            print("stick start", pos(), flush=True)
            page.mouse.move(box[0], box[1]); page.mouse.down(); page.mouse.move(box[0], box[1] - 30, steps=5)
            for i in range(8):
                page.wait_for_timeout(1000); print("stick held", i + 1, "s", pos(), flush=True)
            page.mouse.up(); page.wait_for_timeout(1500); print("stick released", pos(), flush=True)
    print("errors", errs[:5]); b.close()
