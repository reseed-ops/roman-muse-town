#!/usr/bin/env python3
"""Task 130: camera-relative walk, the camera easing back behind him, and the recenter control.
A scripted walk (forward, turn, forward again; then a recenter), sampled as numbers plus stills.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/cam130.py --url http://localhost:8099/ --out DIR --prefix before-land- [--portrait] [--ui]
--ui presses the real recenter button and the R key (the after build); without it the scene's recenterCamera() is called.
Reuses tour.py's page hooks (?tour). Dev only."""
import argparse, importlib.util, json, math, os, sys, time
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True); ap.add_argument("--prefix", default="")
ap.add_argument("--portrait", action="store_true"); ap.add_argument("--ui", action="store_true")
a = ap.parse_args()
a.width, a.height = (390, 844) if a.portrait else (1280, 720)
a.load_s, a.load_settle_s = 240, 20
os.makedirs(a.out, exist_ok=True)
HIDE = """()=>{const c=document.querySelector('canvas');window.__hid=[];
  for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
    if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
def deg(r): return round(math.degrees(((r + math.pi) % (2 * math.pi)) - math.pi))
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
    page.evaluate("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk();s.setFollowMode(false)}")
    t.set_time(tm.rome_ms(time.time() * 1000, 12, 0)); page.wait_for_timeout(2500)
    log = []
    def st(): return page.evaluate("()=>window.__townTour.scene.resumeState()")
    def shot(name):
        page.evaluate(HIDE); page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}{name}.png"), timeout=120000); print("SHOT", name, flush=True)
        page.evaluate(tm.SHOW_HUD)
    def put(x, z, heading, camYaw):
        page.evaluate("p=>window.__townTour.scene.restoreResume(p)", {"x": x, "z": z, "heading": heading, "camYaw": camYaw, "camPitch": 0.0, "userZoom": 1.0})
        page.wait_for_timeout(700)
    def sample(label):
        s = st(); row = {"step": label, "x": round(s["x"], 2), "z": round(s["z"], 2), "heading": deg(s["heading"]), "camYaw": deg(s["camYaw"]),
                         "heading_minus_cam": deg(s["heading"] - s["camYaw"])}
        log.append(row); print(json.dumps(row), flush=True); return s
    def leg(label, sx, sy, seconds, every=0.5, shots=()):
        page.evaluate("([x,y])=>window.__townTour.scene.setWalkMove(x,y)", [sx, sy])
        n = int(seconds / every)
        for i in range(n + 1):
            sample(f"{label} t={i * every:.1f}s")
            if i in shots: shot(f"{label.split()[0]}-{i}")
            if i < n: page.wait_for_timeout(int(every * 1000))
        page.evaluate("()=>window.__townTour.scene.setWalkMove(0,0)"); page.wait_for_timeout(300)
    # Open ground in the middle of the town. Camera deliberately in FRONT of him: he faces +z, the camera looks along -z.
    X, Z = 0.0, 30.0
    put(X, Z, 0.0, math.pi); sample("A start: camera in front of him"); shot("A0-start")
    leg("A1-up-from-front", 0, 1, 1.5, shots=(0, 3))          # up must walk AWAY from the camera, body turns to face travel
    put(X, Z, 0.0, 0.0); sample("B start: camera behind him")
    leg("B1-forward", 0, 1, 1.5, shots=(0, 3))
    leg("B2-turn-right-held", 1, 0, 3.0, every=0.5, shots=(0, 2, 6))  # turn: the camera should ease in behind him as he walks
    leg("B3-forward-again", 0, 1, 1.5, shots=(0, 3))          # up again: away from the camera, not off to the side
    # Lost camera: swing it round with a drag, then recenter.
    page.evaluate("()=>window.__townTour.scene.orbitCamera(175,0)"); page.wait_for_timeout(1500); sample("C camera swung 90 deg by a drag"); shot("C0-lost")
    if a.ui:
        page.evaluate(tm.SHOW_HUD)
        btn = page.locator("[data-mt-recenter]"); print("recenter button count", btn.count(), flush=True)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}C1-hud-with-recenter-button.png")); print("SHOT hud", flush=True)
        btn.first.click()
    else:
        page.evaluate("()=>window.__townTour.scene.recenterCamera()")
    page.wait_for_timeout(1200); sample("C after recenter (button)" if a.ui else "C after recenter"); shot("C2-recentered")
    if a.ui:
        page.evaluate("()=>window.__townTour.scene.orbitCamera(-200,0)"); page.wait_for_timeout(1200); sample("D swung again")
        page.keyboard.press("r"); page.wait_for_timeout(1200); sample("D after R key"); shot("D1-recentered-by-key")
    json.dump({"viewport": [a.width, a.height], "log": log, "errors": errs[:5]}, open(os.path.join(a.out, f"{a.prefix}log.json"), "w"), indent=1)
    print("errors", errs[:5]); b.close()
