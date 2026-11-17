#!/usr/bin/env python3
"""Task 108: sit Gaius on the cliff bench, sample his legs and sword for a while, and photograph side/front.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/seat108.py --url http://localhost:8099/ --out DIR [--seconds 60] [--bench bench-cliff]
Dev only."""
import argparse, importlib.util, os, sys, json, math
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--seconds", type=int, default=60); ap.add_argument("--shots", action="store_true")
a = ap.parse_args()
a.width, a.height, a.load_s, a.load_settle_s = 1280, 720, 240, 20
os.makedirs(a.out, exist_ok=True)
HIDE = """()=>{const c=document.querySelector('canvas');for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;e.style.visibility='hidden'}}"""
from playwright.sync_api import sync_playwright
def qdiff(p, q):
    d = abs(sum(x*y for x, y in zip(p, q))); d = min(1.0, d)
    return math.degrees(2*math.acos(d))
with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": a.width, "height": a.height})
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    page.evaluate("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk();s.setFollowMode(true)}")
    page.evaluate("p=>{const sc=window.__townTour.scene;sc.restoreResume(p)}", {"x": 0, "z": 116.4, "heading": 0.0, "camYaw": 0.0, "camPitch": 0.0, "userZoom": 1.0})
    page.wait_for_timeout(500)
    page.evaluate("()=>window.__townTour.scene.toggleSit('bench-cliff')")
    for i in range(40):
        tele = page.evaluate("()=>window.__townTour.scene.visitTelemetry()")
        if tele["museSeated"] and tele["gaiusSeated"] and i > 2: break
        page.wait_for_timeout(1000)
    print("tele", tele, flush=True)
    samples = []
    for i in range(a.seconds * 2):
        s = page.evaluate("()=>window.__townTour.scene.seatProbe()"); s["t"] = i * 0.5; samples.append(s)
        page.wait_for_timeout(500)
    json.dump(samples, open(os.path.join(a.out, "samples.json"), "w"))
    base = samples[0]["legs"]
    worst = {}
    for s in samples:
        for k, q in s["legs"].items(): worst[k] = max(worst.get(k, 0), qdiff(base[k], q))
    print("max leg deviation from first sample (deg):", {k: round(v, 1) for k, v in worst.items()})
    mb = samples[0]["museLegs"]; mw = {}
    for s in samples:
        for k, q in s["museLegs"].items(): mw[k] = max(mw.get(k, 0), qdiff(mb[k], q))
    print("Aelia max leg deviation (deg):", {k: round(v, 1) for k, v in mw.items()})
    print("sword min Y - seat Y:", round(min(s["swordMinY"] for s in samples) - samples[0]["seatY"], 3), "visible", samples[0]["swordVisible"])
    if a.shots:
        for name, orbit in (("behind", 0), ("side", 175), ("front", 175)):
            page.evaluate(HIDE) if name == "behind" else None
            page.evaluate(f"()=>window.__townTour.scene.orbitCamera({orbit},0)"); page.wait_for_timeout(1500)
            page.screenshot(path=os.path.join(a.out, f"seat-{name}.png"), timeout=120000)
    b.close()
