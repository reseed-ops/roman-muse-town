#!/usr/bin/env python3
"""Task 127: the incendiary ballista on the headland: gameplay distance, close-up, side, brazier/pots; --fire adds a loosed pot in flight and a deck hit.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/ballista127.py --url http://localhost:8099/ --out DIR --prefix after [--portrait] [--fire]
Dev only."""
import argparse, importlib.util, os, sys, math, time
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--prefix", default=""); ap.add_argument("--portrait", action="store_true"); ap.add_argument("--fire", action="store_true")
ap.add_argument("--hour", type=int, default=12)
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
    page = b.new_page(viewport={"width": a.width, "height": a.height}, device_scale_factor=1)
    errs = []; page.on("pageerror", lambda e: errs.append(str(e))); page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    S = lambda js, arg=None: page.evaluate(js, arg)
    S("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk();s.setFollowMode(true)}")
    def shot(name, hide=True):
        if hide: page.evaluate(HIDE)
        page.wait_for_timeout(400)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}-{ori}-{name}.png"), timeout=180000); print("SHOT", name, flush=True)
        if hide: page.evaluate(tm.SHOW_HUD)
    t.set_time(tm.rome_ms(time.time() * 1000, a.hour, 0)); page.wait_for_timeout(2500)
    print("sky", t.sky(), flush=True)
    place = lambda x, z, h, pitch=0.0, yaw=None, zoom=1.0: S("p=>window.__townTour.scene.restoreResume(p)", {"x": x, "z": z, "heading": h, "camYaw": h if yaw is None else yaw, "camPitch": pitch, "userZoom": zoom})
    def go(name, x, z, h, pitch, yaw, zoom, wait=3):
        place(x, z, h, pitch, yaw, zoom); page.wait_for_timeout(500); t.settle(name, wait, 30); shot(name)
    # gameplay distance: Gaius a few steps north of the machine, looking south; the pilot's render framing is the 'near' one
    go("1-gameplay", 4.6, 109.5, 0.0, 0.1, 0.0, 1.0)
    go("2-near-pilotview", 4.6, 112.9, 0.0, 0.1, 0.0, 0.5)
    go("3-closeup-side", 3.0, 113.5, 0.9, 0.15, -0.9 + math.pi, 0.4) if False else None
    # side/front close-up: camera from the south-west looking back at the machine (yaw = heading of view)
    go("3-closeup-front", 4.6, 119.0, math.pi, 0.15, math.pi, 0.35)
    go("4-brazier-pots", 7.2, 114.2, -math.pi/2, 0.2, -math.pi/2, 0.35)
    go("5-gameplay-side", 0.6, 112.0, math.pi/4, 0.12, math.pi/4, 1.0)
    if a.fire:
        S("()=>{const s=window.__townTour.scene;s.setFollowMode(false);s.placeMuseAt(14,104)}"); page.wait_for_timeout(1500)
        place(4.6, 114.3, 0.0, 0.25, 0.0, 0.6); page.wait_for_timeout(1500); t.settle("prompt", 2, 20)
        shot("6-prompt-hud", hide=False)  # the "Loose a fire pot" prompt, HUD left on
        # wait for a ship while manning
        tgt = None
        for i in range(120):
            tgt = S("()=>window.__incendiary && window.__incendiary.target()")
            if tgt: break
            page.wait_for_timeout(1000)
        print("target", tgt, flush=True)
        SIGN = [1]
        def look():  # Gaius beside the machine, camera pulled back and aimed at the ship
            g = S("()=>window.__incendiary.target()")
            yaw = SIGN[0] * math.atan2(g["x"] - 4.6, g["z"] - 115.5) if g else 0.0
            place(4.6, 113.2, 0.0, 0.2, yaw, 1.0)
        look(); page.wait_for_timeout(800)
        S("()=>window.__incendiary.loose()")
        for i in range(5):
            look(); page.wait_for_timeout(250); shot(f"7-flight{i}", hide=True)
            print("state", S("()=>window.__incendiary.state()"), flush=True)
        for i in range(60):
            st = S("()=>window.__incendiary.state()")
            if st["lastImpact"]: break
            look(); page.wait_for_timeout(250)
        print("impact", st, flush=True)
        SIGN[0] = -1
        for k in range(3):
            look(); page.wait_for_timeout(2500); shot(f"8-fire-{k}")
    print("errors", errs[:8]); b.close()
