#!/usr/bin/env python3
"""Task 110: photograph the post chain: direct render vs chain without bloom (baseline match) vs chain with bloom,
at day, dusk and night, landscape and portrait: the sun and moon, the street lamps, the lake. Also times the render.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/bloom110.py --url http://localhost:8099/ --out DIR
Reuses tour.py's page hooks (?tour). Dev only. Headless SwiftShader is software GL: the town would not turn bloom on
by itself there, so the modes are forced through scene.setPostMode."""
import argparse, importlib.util, os, sys, time, math, json
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--only", nargs="*", default=None); ap.add_argument("--times", nargs="*", default=["day", "dusk", "night"]); ap.add_argument("--views", nargs="*", default=["land", "port"])
ap.add_argument("--modes", nargs="*", default=["off", "pipeline", "bloom"])
ap.add_argument("--time-frames", type=int, default=12)
a = ap.parse_args()
a.width, a.height, a.load_s, a.load_settle_s = 1280, 720, 300, 20
os.makedirs(a.out, exist_ok=True)
HIDE = """()=>{const c=document.querySelector('canvas');window.__hid=[];
  for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
    if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
def place(page, x, z, heading, zoom=1.0, pitch=0.0, yaw=None):
    return page.evaluate("p=>{const sc=window.__townTour.scene;sc.restoreResume(p);return sc.resumeState()}",
        {"x": x, "z": z, "heading": heading, "camYaw": heading if yaw is None else yaw, "camPitch": pitch, "userZoom": zoom})
# (name, x, z, heading by time, zoom, pitch): the sun view faces the sun's bearing; the moon and lamps are found by looking around.
SPOTS = [
    ("sun", 0, -7, {"day": 0.0, "dusk": -0.87, "night": 3.1}, 1.0, 0.45),
    ("moon", 0, -7, {"day": 3.1, "dusk": 2.4, "night": 0.0}, 1.0, 0.45),
    ("lamps", 0, -7, {"day": 0.0, "dusk": 0.0, "night": 0.0}, 1.0, 0.2),
    ("lamps-street", 6, 12, {"day": 0.5, "dusk": 0.5, "night": 0.5}, 0.8, 0.2),
    ("bubble", 0, -7, {"day": 0.0, "dusk": 0.0, "night": 0.0}, 1.0, 0.2),
    ("lake", -11.2, -31.05, {"day": -math.pi / 2, "dusk": -math.pi / 2, "night": -math.pi / 2}, 0.6, 0.5),
]
TIMES = {"day": (12, 0), "dusk": (16, 35), "night": (23, 30)}
SIZES = {"land": (1280, 720), "port": (720, 1280)}
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": a.width, "height": a.height})
    errs = []; page.on("pageerror", lambda e: errs.append(str(e))); page.on("console", lambda m: (errs.append(m.text), print("CONSOLE-ERR", m.text[:600], flush=True)) if m.type == "error" else None)
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    page.evaluate("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk();s.setFollowMode(true)}")
    now = time.time() * 1000
    timings = {}
    def shot(name):
        page.evaluate(HIDE); page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(a.out, f"{name}.png"), timeout=120000); print("SHOT", name, flush=True)
        page.evaluate(tm.SHOW_HUD)
    for view in a.views:
        w, h = SIZES[view]; page.set_viewport_size({"width": w, "height": h}); page.wait_for_timeout(2000)
        for tname in a.times:
            hh, mm = TIMES[tname]; t.set_time(tm.rome_ms(now, hh, mm)); page.wait_for_timeout(9000)  # the sky eases over several seconds
            for (name, x, z, hd, zoom, pitch) in [q for q in SPOTS if not a.only or q[0] in a.only]:
                place(page, x, z, hd[tname], zoom, pitch); t.settle("s", 4, 30); page.wait_for_timeout(1500)
                for mode in a.modes:
                    got = page.evaluate("m=>window.__townTour.scene.setPostMode(m)", mode); page.wait_for_timeout(1200)
                    if name == "bubble": page.evaluate("()=>window.__townTour.scene.showBubble('muse','The plate must stay white in every mode.')"); page.wait_for_timeout(2500)
                    shot(f"{view}-{tname}-{name}-{mode}")
                if name == "lamps" and tname == "night" and view == "land":
                    for mode in a.modes:
                        page.evaluate("m=>window.__townTour.scene.setPostMode(m)", mode); page.wait_for_timeout(500)
                        page.evaluate("()=>window.__townTour.scene.timeRender(3)")  # warm up: shader compile, target allocation
                        ms = page.evaluate("n=>window.__townTour.scene.timeRender(n)", a.time_frames)
                        timings[mode] = ms; print("TIME", mode, round(ms, 1), "ms/frame", flush=True)
                page.evaluate("()=>window.__townTour.scene.setPostMode('auto')")
    json.dump(timings, open(os.path.join(a.out, "timings.json"), "w"))
    print("errors", errs[:8]); b.close()
