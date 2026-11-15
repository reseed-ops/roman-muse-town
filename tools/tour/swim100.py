#!/usr/bin/env python3
"""Task 100: photograph the swim, day and night: the landing and the stair, the water's edge, entering the
water with Aelia after him, swimming under the surface (the blue fog, the seabed, the surface from below),
surfacing, and out again onto the steps.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/swim100.py --url http://localhost:8099/ --out DIR
Reuses tour.py's page hooks (?tour). Drives the real controls (the stick and the depth keys) the way a player does. Dev only."""
import argparse, importlib.util, json, math, os, sys, time
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--exit-only", action="store_true"); ap.add_argument("--passes", nargs="*", default=["day", "night"]); ap.add_argument("--prefix", default="")
a = ap.parse_args()
a.width, a.height, a.load_s, a.load_settle_s = 1280, 720, 240, 20
os.makedirs(a.out, exist_ok=True)
HIDE = """()=>{const c=document.querySelector('canvas');window.__hid=[];
  for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
    if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
S = "window.__townTour.scene"
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
    page.evaluate(f"()=>{{const s={S};s.setWeather('clear');s.enterWalk();s.setFollowMode(true)}}")
    now = time.time() * 1000
    log = []
    def shot(name):
        page.evaluate(HIDE); page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}{name}.png"), timeout=120000); print("SHOT", name, flush=True)
        page.evaluate(tm.SHOW_HUD)
    def place(x, z, heading=0.0, zoom=1.0, pitch=0.0):
        return page.evaluate(f"p=>{{const sc={S};sc.restoreResume(p);return sc.resumeState()}}",
            {"x": x, "z": z, "heading": heading, "camYaw": heading, "camPitch": pitch, "userZoom": zoom})
    def state(): return page.evaluate(f"()=>{S}.swimState()")
    def where(): return page.evaluate(f"()=>{S}.resumeState()")
    def stick(x, y): page.evaluate(f"()=>{S}.setWalkMove({x},{y})")
    def key(w, down): page.evaluate(f"()=>{S}.setSwimKey('{w}',{str(down).lower()})")
    def until(cond, timeout=60, step=400):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if cond(): return True
            page.wait_for_timeout(step)
        return False
    def steer(tx, tz, stop=1.5, timeout=90):
        """Push the stick toward (tx, tz), camera-relative, in pulses: while he moves the walk reads the stick against a frozen
        reference yaw, so each pulse stops, lets the reference catch the camera, then pushes again."""
        t0 = time.time()
        while time.time() - t0 < timeout:
            w = where()
            dx, dz = tx - w["x"], tz - w["z"]
            d = math.hypot(dx, dz)
            if d < stop: stick(0, 0); return True
            yaw = w["camYaw"]; fx, fz = math.sin(yaw), math.cos(yaw)
            nz = (dx * fx + dz * fz) / d; nx = (-dx * fz + dz * fx) / d
            stick(round(nx, 3), round(nz, 3)); page.wait_for_timeout(int(min(2500, 600 + d * 120)))
            stick(0, 0); page.wait_for_timeout(500)
        stick(0, 0); return False
    for ps in a.passes:
        t.set_time(tm.rome_ms(now, 12, 0) if ps == "day" else tm.rome_ms(now, 23, 30)); page.wait_for_timeout(2500)
        # 1. the landing off the trail, the head of the stair
        print(place(11.2, 56.9, 0.0), flush=True); page.evaluate(f"()=>{S}.placeMuseAt(9.6,56.6)"); t.settle("a", 3, 30)
        shot(f"{ps}-1-landing")
        # 2. partway down the stair, the sea below, Aelia behind him
        print(place(11.9, 84.0, 0.0), flush=True); page.evaluate(f"()=>{S}.placeMuseAt(11.9,82.3)"); t.settle("b", 3, 30)
        shot(f"{ps}-2-stair")
        page.evaluate(f"()=>{S}.restoreResume({{x:11.9,z:84,heading:0,camYaw:0,camPitch:0.25,userZoom:1.6}})"); t.settle("b2", 3, 30)
        shot(f"{ps}-2b-stair-wide")
        # 3. the water's edge
        print(place(11.9, 99.2, 0.0), flush=True); page.evaluate(f"()=>{S}.placeMuseAt(11.9,97.6)"); t.settle("c", 3, 30)
        shot(f"{ps}-3-water-edge")
        # 4. walk in: the stick forward until he swims
        stick(0, 1)
        print("swims:", until(lambda: state()["swimming"], 90), state(), flush=True)
        stick(0, 0); page.wait_for_timeout(1500)
        shot(f"{ps}-4-entering")
        print("muse swims:", until(lambda: state()["museSwimming"], 90), state(), flush=True)
        # keep walking south a little with the stick, Aelia at his side, on the surface
        steer(15.5, 118, 2.5, 60); page.wait_for_timeout(2500); t.settle("d", 2, 20)
        shot(f"{ps}-5-swimming-surface"); log.append(("surface", where(), state()))
        if not a.exit_only:
            # 5. down: B held, the seabed and the fog
            key("sink", True); until(lambda: state()["depth"] > 6.0, 40); key("sink", False)
            steer(24, 130, 3.0, 40); page.wait_for_timeout(2500); t.settle("e", 2, 20)
            shot(f"{ps}-6-underwater"); log.append(("deep", where(), state()))
            # look up at the surface from below (the pad's right stick pitches the follow camera)
            page.evaluate(f"()=>{S}.orbitCamera(0,1)"); page.wait_for_timeout(2500); page.evaluate(f"()=>{S}.orbitCamera(0,0)"); page.wait_for_timeout(800)
            shot(f"{ps}-7-surface-from-below"); log.append(("below", where(), state()))
            page.evaluate(f"()=>{S}.orbitCamera(0,-1)"); page.wait_for_timeout(4500); page.evaluate(f"()=>{S}.orbitCamera(0,0)"); page.wait_for_timeout(500)
            shot(f"{ps}-7b-floor-view")
            page.evaluate(f"()=>{S}.recenterCamera()"); page.wait_for_timeout(1500)
            # 6. surfacing: A held; shoot as the camera crosses the surface
            key("rise", True)
            until(lambda: state()["underwater"] < 0.6, 40, 150); key("rise", False); page.wait_for_timeout(400)
            shot(f"{ps}-8-surfacing"); log.append(("crossing", where(), state()))
            key("rise", True); until(lambda: state()["depth"] < 0.3, 40, 200); key("rise", False); page.wait_for_timeout(1500)
            shot(f"{ps}-9-surfaced"); log.append(("surfaced", where(), state()))
        else:
            steer(15.5, 112, 2.5, 60); shot(f"{ps}-5x-out-at-sea")
        # 7. back to the stair and out
        ok = steer(12.2, 100.0, 0.6, 150)
        print("steer", ok, where(), state(), flush=True)
        print("walks:", until(lambda: not state()["swimming"], 30), state(), flush=True)
        print("muse out:", until(lambda: not state()["museSwimming"], 90), state(), flush=True)
        w = where(); place(w["x"], w["z"], math.pi); page.wait_for_timeout(1500); t.settle("f", 2, 20)
        shot(f"{ps}-10-out"); log.append(("out", where(), state()))
        stick(0, 1); page.wait_for_timeout(7000); stick(0, 0); t.settle("g", 2, 20)
        shot(f"{ps}-11-climbing")
        page.evaluate(f"()=>{S}.restoreResume({{x:11.9,z:57,heading:0,camYaw:0,camPitch:0,userZoom:1}})")
    print(json.dumps(log, indent=1)); print("errors", errs[:5]); b.close()
