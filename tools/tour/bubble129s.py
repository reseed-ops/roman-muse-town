#!/usr/bin/env python3
"""Task 129: Aelia's 3D speech bubble at close / normal / far camera, phone portrait, real landscape and the town's sideways turn.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/bubble129s.py --url http://localhost:8099/ --out DIR --prefix before
Dev only."""
import argparse, importlib.util, json, os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True); ap.add_argument("--prefix", default="x"); ap.add_argument("--dsf", type=int, default=3)
a = ap.parse_args(); a.width, a.height = 390, 844; a.load_s, a.load_settle_s = 300, 20
os.makedirs(a.out, exist_ok=True)
from playwright.sync_api import sync_playwright
TEXT = "There's a letter waiting on the desk by the hall, love. Come up the stair with me?"
with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=a.dsf)
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    S = lambda js, arg=None: page.evaluate(js, arg)
    S("()=>window.__townTour.scene.setWeather('clear')")
    page.keyboard.down("w"); page.wait_for_timeout(300); page.keyboard.up("w")
    t.set_time(tm.rome_ms(__import__("time").time() * 1000, 18, 48)); page.wait_for_timeout(2500)
    S("()=>{const b=document.querySelector('button[aria-label=\"Dismiss daily summary\"]'); if(b) b.click()}")
    def go(zoom):
        S("z=>window.__townTour.scene.restoreResume({x:0,z:100,heading:0,camYaw:0,camPitch:0.1,userZoom:z})", zoom)
        page.wait_for_timeout(1500)
    def shot(tag):
        S("t=>window.__townTour.scene.showBubble('muse', t)", TEXT); page.wait_for_timeout(1800)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}-{tag}.png"), timeout=180000); print("SHOT", tag, flush=True)
    def sweep(mode):
        for name, z in (("close", 0.35), ("normal", 1.0), ("far", 2.6)):
            go(z); shot(f"{mode}-{name}")
    sweep("portrait")
    page.set_viewport_size({"width": 844, "height": 390}); page.wait_for_timeout(1000); sweep("landscape")
    page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(800)
    S("()=>document.querySelector('button[aria-label^=\"Open the town menu\"]').click()"); page.wait_for_timeout(600)
    S("()=>{const b=[...document.querySelectorAll('nav[aria-label=\"Town menu\"] button')].find(x=>/Landscape/.test(x.textContent||''));if(b)b.click()}"); page.wait_for_timeout(500)
    S("()=>{const c=document.querySelector('button[aria-label=\"Close the town menu\"]');if(c&&c.textContent.trim()==='✕')c.click()}"); page.wait_for_timeout(1000)
    sweep("sideways")
    b.close()
