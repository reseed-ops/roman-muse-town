#!/usr/bin/env python3
"""Task 98: photograph the sea cliff's bench, day and night: the approach, the seated view, and the head on the shoulder.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/bench98.py --url http://localhost:8099/ --out DIR
Reuses tour.py's page hooks (?tour). Dev only."""
import argparse, importlib.util, os, sys, time, math
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--passes", nargs="*", default=["day", "night"]); ap.add_argument("--prefix", default="")
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
    now = time.time() * 1000; day = tm.rome_ms(now, 0, 0)
    def shot(name):
        page.evaluate(HIDE); page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}{name}.png"), timeout=120000); print("SHOT", name, flush=True)
        page.evaluate(tm.SHOW_HUD)
    for ps in a.passes:
        t.set_time(tm.rome_ms(now, 12, 0) if ps == "day" else tm.rome_ms(now, 23, 30)); page.wait_for_timeout(2500)
        # 1. the approach: from the trail, facing the bench and the sea beyond
        print(place(page, 0.2, 104, 0.0, 1.0), flush=True); t.settle("a", 3, 30); shot(f"{ps}-1-approach")
        print(place(page, 0.2, 111, 0.0, 1.8, 0.3), flush=True); t.settle("a2", 3, 30); shot(f"{ps}-2-approach-wide")
        # 2. alone on the bench
        place(page, 0, 116.4, 0.0, 1.0); page.wait_for_timeout(500)
        page.evaluate("()=>window.__townTour.scene.toggleSit('bench-cliff')")
        page.wait_for_timeout(1500); t.settle("sit", 3, 40)
        for i in range(40):
            tele = page.evaluate("()=>window.__townTour.scene.visitTelemetry()")
            if tele["museSeated"] and tele["gaiusSeated"] and i > 2: break
            page.wait_for_timeout(1000)
        print("tele", tele, flush=True)
        page.wait_for_timeout(4000); t.settle("together", 3, 30)
        shot(f"{ps}-3-seated-behind")
        # closer (wheel), then swung round to the side and the front to read the lean
        page.mouse.move(640, 360); page.mouse.wheel(0, -900); page.wait_for_timeout(1500)
        shot(f"{ps}-4-seated-closer")
        page.evaluate("()=>window.__townTour.scene.orbitCamera(175,0)"); page.wait_for_timeout(1500)
        shot(f"{ps}-5-seated-side")
        page.evaluate("()=>window.__townTour.scene.orbitCamera(175,0)"); page.wait_for_timeout(1500)
        shot(f"{ps}-6-seated-front")
        page.evaluate("()=>window.__townTour.scene.orbitCamera(-350,0)"); page.wait_for_timeout(800)
        page.mouse.wheel(0, 900); page.wait_for_timeout(1000)
        page.evaluate("()=>window.__townTour.scene.standUp()"); page.wait_for_timeout(1500)
        tele = page.evaluate("()=>window.__townTour.scene.visitTelemetry()"); print("after stand", tele, flush=True)
        shot(f"{ps}-7-stood")
    print("errors", errs[:5]); b.close()
