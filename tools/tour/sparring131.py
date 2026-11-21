#!/usr/bin/env python3
"""Task 131: Archer on the headland and the sparring bout. Before/after renders of the headland, the challenge prompt and (--bout) a scripted bout.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/sparring131.py --url http://localhost:8099/ --out DIR --prefix after [--portrait] [--bout] [--hour 12]
The bout is driven through the real interaction (scene.sparringAction) and the ?tour=1 hook (window.__sparring). In-page time is slowed and frozen at each
phase (performance.now is wrapped), so a phase can be photographed under swiftshader. Dev only."""
import argparse, importlib.util, os, sys, time, math, json
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--prefix", default="shot"); ap.add_argument("--portrait", action="store_true"); ap.add_argument("--bout", action="store_true")
ap.add_argument("--hour", type=int, default=12)
a = ap.parse_args()
a.width, a.height = (390, 844) if a.portrait else (1280, 720)
a.load_s, a.load_settle_s = 300, 20
os.makedirs(a.out, exist_ok=True)
ori = "portrait" if a.portrait else "landscape"
HIDE = """()=>{const c=document.querySelector('canvas');window.__hid=[];for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
 if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
CLOCK = """(()=>{const real=performance.now.bind(performance);let v0=real(),r0=real(),scale=1,frozen=null;
const now=()=>frozen!==null?frozen:v0+(real()-r0)*scale;performance.now=now;
window.__timeScale=s=>{const c=now();v0=c;r0=real();scale=s};
window.__thaw=()=>{if(frozen!==null){v0=frozen;r0=real();frozen=null}};
window.__armFreeze=(phase,frac)=>{clearInterval(window.__iv);window.__frozeAt=null;
 window.__iv=setInterval(()=>{const sp=window.__sparring;const s=sp&&sp.state();if(!s||s.phase!==phase||frozen!==null)return;
  const n=now();if(n<s.since+frac*(s.until-s.since))return;frozen=Math.min(n,s.until-1);window.__frozeAt=s;clearInterval(window.__iv)},3)}})()"""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    page = b.new_page(viewport={"width": a.width, "height": a.height}, device_scale_factor=1)
    errs = []; page.on("pageerror", lambda e: errs.append(str(e))); page.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
    page.add_init_script(tm.SHIM % 0); page.add_init_script(CLOCK)
    t = tm.Tour(page, None, a, a.out)
    page.goto(a.url + "?tour=1", timeout=180000)
    page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=a.load_s * 1000)
    t.settle("load", min_s=a.load_settle_s, max_s=120)
    S = lambda js, arg=None: page.evaluate(js, arg)
    S("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk();s.setFollowMode(false);s.placeMuseAt(16,100)}")
    def shot(name, hud=False):
        if not hud: page.evaluate(HIDE)
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}-{ori}-{name}.png"), timeout=180000); print("SHOT", name, flush=True)
        if not hud: page.evaluate(tm.SHOW_HUD)
    # the first-visit welcome card and toasts are not part of this check: close them
    S("()=>{for(const b of document.querySelectorAll('button')){const t=(b.innerText||'').trim();if(t==='×'||t==='✕'||t==='Don’t show automatically')b.click()}}")
    t.set_time(tm.rome_ms(time.time() * 1000, a.hour, 0)); page.wait_for_timeout(2500)
    print("sky", t.sky(), flush=True)
    place = lambda x, z, h, pitch=0.0, yaw=None, zoom=1.0: S("p=>window.__townTour.scene.restoreResume(p)", {"x": x, "z": z, "heading": h, "camYaw": h if yaw is None else yaw, "camPitch": pitch, "userZoom": zoom})
    def go(name, x, z, h, pitch, yaw, zoom, hud=False, both=False):
        place(x, z, h, pitch, yaw, zoom); page.wait_for_timeout(500); t.settle(name, 3, 30); shot(name, hud)
    has = S("()=>!!window.__sparring")
    print("sparring hook", has, flush=True)
    # bring the headland into streaming range and wait for Archer's body
    place(-3.2, 108.0, 0.0, 0.1, 0.0, 1.0)
    if has:
        for i in range(240):
            if S("()=>window.__sparring.ready()"): break
            page.wait_for_timeout(1000)
        print("archer ready", S("()=>window.__sparring.ready()"), "pos", S("()=>window.__sparring.archerPos()"), flush=True)
    go("1-headland-wide", 0.6, 107.5, -0.45, 0.12, -0.45 + 0.55, 1.0)      # Gaius a few steps up the path, the camera turned to see the headland past him
    go("2-headland-near", -1.2, 110.8, -0.4, 0.1, -0.4 - 0.7, 0.7)
    go("3-from-the-sea", -3.2, 119.5, math.pi, 0.12, math.pi, 0.5)           # from the sea side: Archer faces south, toward this camera
    go("4-ballista-and-ring", 0.7, 121.5, math.pi, 0.14, math.pi, 0.9)   # the machine and the ring in one frame
    place(-2.0, 112.8, -0.61, 0.12, -0.61 + 0.45, 0.8); page.wait_for_timeout(800); t.settle("prompt", 3, 30)
    shot("5-prompt-hud", hud=True)
    if has:
        print("nearby text:", S("()=>[...document.querySelectorAll('button,div')].map(e=>e.innerText).filter(x=>x&&/Spar with Archer/.test(x)).slice(0,2)"), flush=True)
    if a.bout and has:
        print("camera before", S("()=>window.__townTour.scene.resumeState()"), flush=True)
        print("challenge via real interaction", S("()=>{window.__townTour.scene.sparringAction();return window.__sparring.state()}"), flush=True)
        page.wait_for_timeout(2500)            # real time: the view swings round behind him while the first exchange plays
        print("camera after", S("()=>window.__townTour.scene.resumeState()"), "bout", S("()=>window.__sparring.state()"), flush=True)
        S("()=>window.__timeScale(0.02)")       # a screenshot takes seconds; the bout must hold still for it
        shot("b00-after-challenge", hud=True)
        S("()=>window.__timeScale(0.3)")
        def press(rand):
            S("r=>{const R=Math.random;Math.random=()=>r;try{window.__sparring.press()}finally{Math.random=R}}", rand)
        def at(phase, frac, name, hud=True, clean=True, timeout=90):
            if S("()=>window.__sparring.state().phase") == "idle":   # the bout ran out: challenge again through the real interaction
                print("bout over, challenging again", S("()=>{window.__townTour.scene.sparringAction();return window.__sparring.state().phase}"), flush=True)
            S("([ph,fr])=>window.__armFreeze(ph,fr)", [phase, frac])
            page.wait_for_function("()=>window.__frozeAt", timeout=timeout * 1000)
            page.wait_for_timeout(900)
            st = S("()=>window.__sparring.state()")
            print(name, "phase", st["phase"], "G", st["gaiusScore"] if "gaiusScore" in st else st["gaius"], "A", st["archer"], "round", st["round"], "|", st["lastEvent"], flush=True)
            if clean: shot(name)
            if hud: shot(name + "-hud", hud=True)
            return st
        def thaw(): S("()=>window.__thaw()")
        # round 1: parried, then Gaius's strike is blocked
        at("telegraph", 0.7, "b01-telegraph"); thaw()
        at("parry", 0.5, "b02-parry-window")
        # the front three-quarter, from Archer's flank: the drawn sword and the shield on his forearm (time stays frozen)
        rs = S("()=>window.__townTour.scene.resumeState()")
        S("p=>window.__townTour.scene.restoreResume(p)", {**{k: rs[k] for k in ("x", "z", "heading")}, "camYaw": rs["heading"] + math.pi - 0.75, "camPitch": 0.08, "userZoom": 0.55})
        page.wait_for_timeout(1500); shot("b02f-gaius-front-three-quarter")
        S("p=>window.__townTour.scene.restoreResume(p)", {k: rs[k] for k in ("x", "z", "heading", "camYaw", "camPitch", "userZoom")})
        page.wait_for_timeout(800)
        press(0.5); thaw()
        at("recovery", 0.4, "b03-clash"); thaw()
        at("strike", 0.5, "b04-strike-window"); press(0.0); thaw()      # Archer blocks
        at("pass", 0.4, "b05-blocked", hud=False); thaw()
        # round 2: parry missed, Archer scores; Gaius's strike lands
        at("telegraph", 0.3, "b06-telegraph-2", hud=False); thaw()
        at("recovery", 0.4, "b07-archer-scores"); thaw()
        at("strike", 0.5, "b08-strike-window-2", hud=False); press(0.99); thaw()   # lands
        at("pass", 0.45, "b09-gaius-scores"); thaw()
        # a side view of the swing
        for k in range(8):   # early presses hand Archer the touches until the bout ends 5-n
            st = S("()=>window.__sparring.state()")
            if st["phase"] == "result" or st["phase"] == "idle": break
            S("([ph,fr])=>window.__armFreeze(ph,fr)", ["telegraph", 0.3])
            page.wait_for_function("()=>window.__frozeAt", timeout=90000); press(0.5); thaw()
            page.wait_for_timeout(200)
            st = S("()=>window.__sparring.state()")
            print("loop", st["phase"], st["gaius"], st["archer"], st["round"], flush=True)
            if st["archer"] >= 5 or st["phase"] == "result": break
            at("recovery", 0.9, f"loop{k}", clean=False, hud=False); thaw()
        at("result", 0.4, "b10-result")
        S("()=>window.__townTour.scene.orbitCamera(175,0)"); page.wait_for_timeout(1500); shot("b11-result-side")
        thaw(); S("()=>window.__timeScale(1)")
        for i in range(60):
            if S("()=>window.__sparring.state().phase") == "idle": break
            page.wait_for_timeout(1000)
        page.wait_for_timeout(1500); t.settle("after", 2, 20)
        print("after bout", S("()=>window.__sparring.state().phase"), flush=True)
        S("()=>window.__townTour.scene.recenterCamera()"); page.wait_for_timeout(1500)
        shot("b12-after-bout")
    print("errors", errs[:12]); b.close()
