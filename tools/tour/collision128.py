#!/usr/bin/env python3
"""Task 128: probe the collision fix against the game's own movement resolution (restoreResume -> resolveCollisions at 0.5 m).
A spot is BLOCKED when the request is moved off it. Dev only.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/collision128.py --url http://localhost:8099/ --out DIR"""
import argparse, importlib.util, math, os, sys, time
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
a = ap.parse_args(); a.width, a.height, a.load_s, a.load_settle_s = 1280, 720, 300, 20
os.makedirs(a.out, exist_ok=True)
HIDE = """()=>{const c=document.querySelector('canvas');window.__hid=[];for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
 if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
from playwright.sync_api import sync_playwright
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": a.width, "height": a.height})
    errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    S = lambda js, arg=None: page.evaluate(js, arg)
    S("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk()}")
    t.set_time(tm.rome_ms(time.time() * 1000, 12, 0)); page.wait_for_timeout(2500)
    def probe(label, x, z, want_blocked):
        global bad
        S("p=>window.__townTour.scene.restoreResume(p)", {"x": x, "z": z, "heading": 0, "camYaw": 0, "camPitch": 0, "userZoom": 1})
        r = S("()=>window.__townTour.scene.resumeState()")
        moved = math.hypot(r["x"] - x, r["z"] - z) > 0.01
        ok = moved == want_blocked; bad += 0 if ok else 1
        print(("ok  " if ok else "FAIL"), label, (x, z), "blocked" if moved else "free", flush=True)
    # Embassy: door band free, walls solid
    for x in (15.08, 10.43): probe("embassy approach", x, 43, False)
    for x, z in ((14.1, 43), (12.8, 45.4), (10.95, 41.15), (11.08, 43)): probe("embassy solid", x, z, True)
    # vineyard stakes block, row midpoints free
    probe("vineyard stake", 11.5, 31.1, True); probe("vineyard midpoint", 11.5, 31.8, False)
    probe("vineyard stake E", -19, 36.7, True)
    # headland trees stream in as he nears: stand there first
    S("p=>window.__townTour.scene.restoreResume(p)", {"x": 0, "z": 108, "heading": 0, "camYaw": 0, "camPitch": 0, "userZoom": 1}); t.settle("headland", 20, 90)
    # headland trees (nominal planting; trunk circle is within 0.3 m of it)
    for x, z in ((-4.9, 116.2), (-6.4, 111.8), (5.2, 115.6), (6.8, 111)): probe("headland tree", x, z, True)
    # the ballista (frame centre, runner end, brazier foot) at its bolder scale
    probe("ballista centre", 4.6, 115.5, True); probe("ballista runner end", 4.6, 115.5 + 1.3, True)
    probe("ballista clear", 4.6 + 3.2, 115.5, False)
    # pavilion: centre and inside free, a column foot solid
    probe("pavilion centre", 17.8, -12, False); probe("pavilion interior", 19.2, -12.2, False)
    probe("pavilion column foot", 17.8 + 2.46, -12, True)
    # colosseum west stair is free to stand on, the ring is solid
    probe("colosseum stair foot", 30.72, 12.35, False)
    # market baskets, goods
    S("()=>window.__townTour.scene.setRhythm({anchor:'',marketOpen:true,marketBusy:true})"); page.wait_for_timeout(500)
    for x, z in ((6.1, 30), (-6.1, 30.8), (6.3, 40.8), (-6.2, 39.6), (-6, 41.8), (6.2, 42.6)): probe("basket (open)", x, z, True)
    S("()=>window.__townTour.scene.setRhythm({anchor:'',marketOpen:true,marketBusy:false})"); page.wait_for_timeout(500)
    probe("basket (not busy)", 6.1, 30, False)
    # fountain: default none, upgrade on, off again
    probe("fountain default", 0, 15.5, False)
    S("()=>window.__townTour.scene.setUpgrades(['fountain'])"); probe("fountain bought", 0, 15.5, True)
    S("()=>window.__townTour.scene.setUpgrades([])"); probe("fountain revoked", 0, 15.5, False)
    # purchased planter and lamp
    S("()=>window.__townTour.scene.setUpgrades(['planters','lamps'])")
    errs and print("page errors:", errs[:3])
    print("FAILURES", bad, flush=True)
    # pavilion and stair shots
    def shot(name):
        page.evaluate(HIDE); page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(a.out, name + ".png"), timeout=120000); page.evaluate(tm.SHOW_HUD)
    S("p=>window.__townTour.scene.restoreResume(p)", {"x": 17.8, "z": -12, "heading": 0, "camYaw": 0.3, "camPitch": 0.25, "userZoom": 1.3}); t.settle("p", 4, 30); shot("pavilion-inside")
    S("p=>window.__townTour.scene.restoreResume(p)", {"x": 30.72, "z": 12.35, "heading": 1.5, "camYaw": 1.5, "camPitch": 0.2, "userZoom": 1.3}); t.settle("s", 4, 30); shot("west-stair")
    b.close()
sys.exit(1 if bad else 0)
