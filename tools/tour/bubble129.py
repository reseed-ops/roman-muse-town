#!/usr/bin/env python3
"""Task 129: photograph Aelia's dialogue bubble (the "Show me" / "Not now" offer panel) and her 3D speech bubble.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/bubble129.py --url http://localhost:8099/ --out DIR --prefix before
Phone viewport 390x844 (portrait), 844x390 (real landscape) and the town's own sideways turn (portrait window, stage rotated 90 degrees,
the way the Muse app shows landscape). The offer appears on its own timer (>= 90 s into a walk), so the script waits for it.
Dev only."""
import argparse, importlib.util, json, os, sys
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--prefix", default="x"); ap.add_argument("--dsf", type=int, default=3)
ap.add_argument("--vw", type=int, default=390); ap.add_argument("--vh", type=int, default=844)
a = ap.parse_args()
a.width, a.height = a.vw, a.vh
a.load_s, a.load_settle_s = 300, 20
os.makedirs(a.out, exist_ok=True)
from playwright.sync_api import sync_playwright

PANEL = 'section[aria-label="Aelia offers to walk with you"]'
MEASURE = """()=>{const s=document.querySelector('%s'); if(!s) return null;
  const card=s.firstElementChild, r=card.getBoundingClientRect(), vw=innerWidth, vh=innerHeight;
  const root=document.querySelector('[data-orientation]'); const cs=getComputedStyle(root);
  const btns=[...card.querySelectorAll('button')].map(b=>{const q=b.getBoundingClientRect();return [Math.round(q.width),Math.round(q.height)]});
  return {rect:[r.x,r.y,r.width,r.height], vw, vh, areaShare: +(r.width*r.height/(vw*vh)).toFixed(3), transform: cs.transform, orient: root.dataset.orientation, forced: root.dataset.forcedLandscape||null, btns,
    cardBg: getComputedStyle(card).backdropFilter}}""" % PANEL

with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": a.width, "height": a.height}, device_scale_factor=a.dsf)
    errs = []; page.on("pageerror", lambda e: errs.append(str(e)))
    page.add_init_script(tm.SHIM % 0)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    S = lambda js, arg=None: page.evaluate(js, arg)
    S("()=>{const s=window.__townTour.scene;s.setWeather('clear')}")
    page.keyboard.down("w"); page.wait_for_timeout(300); page.keyboard.up("w")   # the page's own walk mode (walkingRef), not only the scene's
    t.set_time(tm.rome_ms(__import__("time").time() * 1000, 18, 48)); page.wait_for_timeout(2500)
    log = {}

    def wait_panel(max_s=240):
        for i in range(max_s):
            if page.query_selector(PANEL): return True
            d = page.query_selector('button[aria-label="Dismiss daily summary"]')
            if d: d.click()   # the welcome card holds her offers back
            if i % 60 == 30: page.screenshot(path=os.path.join(a.out, f"{a.prefix}-waiting-{i}.png"))
            page.wait_for_timeout(1000)
        return False

    def shoot(tag):
        if not page.query_selector(PANEL): print("panel gone before", tag, flush=True); return
        page.wait_for_timeout(700)
        m = S(MEASURE); log[tag] = m; print(tag, json.dumps(m), flush=True)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}-{tag}.png"), timeout=180000)
        # a 3x close-up of the card (the text at the size the player sees it)
        card = page.query_selector(PANEL + " > div")
        if card: card.screenshot(path=os.path.join(a.out, f"{a.prefix}-{tag}-closeup.png"), timeout=60000)

    print("waiting for the offer...", flush=True)
    if not wait_panel(): print("NO OFFER APPEARED"); sys.exit(2)
    def sideways(on):
        S("()=>document.querySelector('button[aria-label^=\"Open the town menu\"]').click()"); page.wait_for_timeout(500)
        S("()=>{const b=[...document.querySelectorAll('nav[aria-label=\"Town menu\"] button')].find(x=>/Landscape|Portrait/.test(x.textContent||''));if(b)b.click()}"); page.wait_for_timeout(400)
        S("()=>{const c=document.querySelector('button[aria-label=\"Close the town menu\"]');if(c&&c.textContent.trim()==='\u2715')c.click()}"); page.wait_for_timeout(800)
    # the town's own sideways turn first (how the Muse app shows landscape), while the offer is up
    sideways(True)
    shoot("5-forced-landscape-390x844")
    page.set_viewport_size({"width": 393, "height": 851}); page.wait_for_timeout(800)
    shoot("6-forced-landscape-393x851")
    page.set_viewport_size({"width": 390, "height": 844}); sideways(False)
    shoot("1-portrait-390x844")
    page.set_viewport_size({"width": 844, "height": 390}); page.wait_for_timeout(800)
    shoot("2-landscape-real-844x390")
    page.set_viewport_size({"width": 393, "height": 851}); page.wait_for_timeout(800)
    shoot("3-portrait-393x851")
    page.set_viewport_size({"width": 1280, "height": 720}); page.wait_for_timeout(800)
    shoot("4-desktop-1280x720")
    json.dump(log, open(os.path.join(a.out, f"{a.prefix}-measure.json"), "w"), indent=1)
    print("errors:", errs[:3])
    b.close()
