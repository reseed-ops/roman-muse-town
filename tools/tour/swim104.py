#!/usr/bin/env python3
"""Task 104: photograph the fixes to the swim, day and night, in the real town: Aelia walking down the stair after him from
before the landing, hand-in-hand into the water and out again, the surface crossing with the sun (and the moon) in view,
and the swimmer riding the seabed.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/swim103.py --url http://localhost:8099/ --out DIR
Reuses tour.py's page hooks (?tour). Drives the real controls. Dev only."""
import argparse, importlib.util, json, math, os, sys, time
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
tm = importlib.util.module_from_spec(spec); spec.loader.exec_module(tm)
ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--passes", nargs="*", default=["day", "night"]); ap.add_argument("--parts", nargs="*", default=["south", "hand", "sky", "bed"])
a = ap.parse_args()
a.width, a.height, a.load_s, a.load_settle_s = 1280, 720, 240, 20
os.makedirs(a.out, exist_ok=True)
HIDE = """()=>{const c=document.querySelector('canvas');window.__hid=[];
  for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
    if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
S = "window.__townTour.scene"
from playwright.sync_api import sync_playwright
log = {}
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
    def shot(name):
        page.evaluate(HIDE); page.wait_for_timeout(500)
        s0 = page.evaluate(f"()=>{S}.swimState()")
        page.screenshot(path=os.path.join(a.out, f"{name}.png"), timeout=120000)
        s1 = page.evaluate(f"()=>{S}.swimState()")
        print("SHOT", name, "uw %.2f->%.2f" % (s0["underwater"], s1["underwater"]), "moon %.3f->%.3f" % (s0["moonOpacity"], s1["moonOpacity"]), "sun %.3f" % s1["sunOpacity"], flush=True)
        page.evaluate(tm.SHOW_HUD)
    def place(x, z, heading=0.0, zoom=1.0, pitch=0.0, cy=None):
        return page.evaluate(f"p=>{{const sc={S};sc.restoreResume(p);return sc.resumeState()}}",
            {"x": x, "z": z, "heading": heading, "camYaw": heading if cy is None else cy, "camPitch": pitch, "userZoom": zoom})
    def state(): return page.evaluate(f"()=>{S}.swimState()")
    def where(): return page.evaluate(f"()=>{S}.resumeState()")
    def muse(): return page.evaluate(f"()=>{S}.musePosition()")
    def stick(x, y): page.evaluate(f"()=>{S}.setWalkMove({x},{y})")
    def key(w, down): page.evaluate(f"()=>{S}.setSwimKey('{w}',{str(down).lower()})")
    def until(cond, timeout=60, step=400):
        t0 = time.time()
        while time.time() - t0 < timeout:
            if cond(): return True
            page.wait_for_timeout(step)
        return False
    def steer(tx, tz, stop=1.5, timeout=90):
        t0 = time.time()
        while time.time() - t0 < timeout:
            w = where(); dx, dz = tx - w["x"], tz - w["z"]; d = math.hypot(dx, dz)
            if d < stop: stick(0, 0); return True
            yaw = w["camYaw"]; fx, fz = math.sin(yaw), math.cos(yaw)
            nz = (dx * fx + dz * fz) / d; nx = (-dx * fz + dz * fx) / d
            stick(round(nx, 3), round(nz, 3)); page.wait_for_timeout(int(min(2500, 600 + d * 120)))
            stick(0, 0); page.wait_for_timeout(500)
        stick(0, 0); return False
    def face(yaw, timeout=40):
        """Orbit the camera until its yaw is near `yaw` (radians)."""
        t0 = time.time()
        while time.time() - t0 < timeout:
            d = (yaw - where()["camYaw"] + math.pi) % (2 * math.pi) - math.pi
            if abs(d) < 0.08: break
            page.evaluate(f"()=>{S}.orbitCamera({1 if d > 0 else -1},0)"); page.wait_for_timeout(200)
            page.evaluate(f"()=>{S}.orbitCamera(0,0)"); page.wait_for_timeout(250)
        page.evaluate(f"()=>{S}.orbitCamera(0,0)")
    def tick(tag, rows):
        w = where(); s = state(); m = muse()
        print("TICK", tag, {"tag": tag, "him": [round(w["x"],1), round(w["z"],1)], "muse": [round(m["x"],1), round(m["z"],1)], "ms": s["museSwimming"], "sw": s["swimming"]}, flush=True); rows.append({"tag": tag, "him": [round(w["x"], 1), round(w["z"], 1)], "muse": [round(m["x"], 1), round(m["z"], 1)], **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in s.items()}})
    for ps in a.passes:
        L = log.setdefault(ps, {})
        if ps == "day": t.set_time(tm.rome_ms(now, 12, 0))
        else: t.set_time(tm.rome_ms(now, 23, 30))
        page.wait_for_timeout(2500)
        # ------------------------------------------------ 0. Aelia's walk from a southern start (0, 60)
        if "south" in a.parts:
            rows = L.setdefault("south", [])
            sx, sz = [float(v) for v in os.environ.get("SOUTH", "0,60").split(",")]
            place(11.9, 99.2, 0.0); page.evaluate(f"()=>{S}.placeMuseAt({sx},{sz})"); t.settle("s0", 3, 30)
            stick(0, 1)
            until(lambda: state()["swimming"], 90); stick(0, 0)
            t0 = time.time(); got = {}
            while time.time() - t0 < 150:
                tick("follow", rows); m = muse(); s = state()
                if "gate" not in got and m["x"] > 5.0 and m["z"] < 58.5: got["gate"] = 1; shot(f"{ps}-S1-aelia-at-landing")
                if "stair" not in got and m["z"] > 75: got["stair"] = 1; shot(f"{ps}-S2-aelia-on-stair")
                if s["museSwimming"] and "sw" not in got: got["sw"] = 1; page.wait_for_timeout(4000); shot(f"{ps}-S3-aelia-swims-in"); tick("swim", rows); break
                page.wait_for_timeout(1500)
            rows.append({"got": sorted(got)})
            steer(15.5, 118, 2.5, 60); page.wait_for_timeout(3000); t.settle("s1", 2, 20); tick("alongside", rows); shot(f"{ps}-S4-alongside")
            steer(12.2, 100.0, 0.6, 150)
            until(lambda: not state()["swimming"], 30); until(lambda: not state()["museSwimming"], 90)
            w = where(); place(w["x"], w["z"], math.pi); page.wait_for_timeout(1500); t.settle("s2", 2, 20); tick("out", rows); shot(f"{ps}-S5-both-out")
        # ------------------------------------------------ 1. Aelia's walk down the stair from before the landing
        if "stair" in a.parts:
            rows = L.setdefault("stair", [])
            place(11.9, 99.2, 0.0); page.evaluate(f"()=>{S}.placeMuseAt(6.0,56.6)"); t.settle("s0", 3, 30)
            stick(0, 1)
            until(lambda: state()["swimming"], 90); stick(0, 0)
            t0 = time.time(); got = {}
            while time.time() - t0 < 150:
                tick("follow", rows); m = muse(); s = state()
                if "stair" not in got and m["z"] > 75: got["stair"] = 1; shot(f"{ps}-1-aelia-on-stair")
                if s["museSwimming"] and "sw" not in got: got["sw"] = 1; page.wait_for_timeout(4000); shot(f"{ps}-2-aelia-swims-in"); tick("swim", rows); break
                page.wait_for_timeout(1500)
            steer(15.5, 118, 2.5, 60); page.wait_for_timeout(3000); t.settle("s1", 2, 20); tick("alongside", rows); shot(f"{ps}-3-alongside")
            steer(12.2, 100.0, 0.6, 150)
            until(lambda: not state()["swimming"], 30); until(lambda: not state()["museSwimming"], 90)
            w = where(); place(w["x"], w["z"], math.pi); page.wait_for_timeout(1500); t.settle("s2", 2, 20); tick("out", rows); shot(f"{ps}-4-both-out")
        # ------------------------------------------------ 2. hand in hand, into the water and out
        if "hand" in a.parts:
            rows = L.setdefault("hand", [])
            place(11.9, 92.0, 0.0); page.evaluate(f"()=>{S}.placeMuseAt(11.9,90.6)"); page.evaluate(f"()=>{S}.setHandInHand(true)"); t.settle("h0", 4, 30)
            shot(f"{ps}-5-hands-on-stair"); tick("hands-land", rows)
            stick(0, 0.6); until(lambda: state()["swimming"], 90); stick(0, 0)  # gentle: a full stick for 3.5 s is the hurry that lets go
            until(lambda: state()["museSwimming"], 60); page.wait_for_timeout(1500)
            steer(15.5, 112, 2.5, 60); page.wait_for_timeout(3500)
            for _ in range(4): tick("hands-swim", rows); page.wait_for_timeout(1200)
            shot(f"{ps}-6-hands-swimming")
            steer(12.2, 100.0, 0.6, 150)
            until(lambda: not state()["swimming"], 30); until(lambda: not state()["museSwimming"], 90)
            tick("hands-out-early", rows)
            w = where(); place(w["x"], w["z"], math.pi); page.wait_for_timeout(1500)
            stick(0, 0.5); page.wait_for_timeout(3500); stick(0, 0); t.settle("h1", 4, 30); tick("hands-out", rows)
            shot(f"{ps}-7-hands-resume-on-land")
            w = where(); place(w["x"], w["z"], math.pi, cy=0.0); t.settle("h2", 3, 30); tick("hands-front", rows)
            shot(f"{ps}-7b-hands-from-front")
            page.evaluate(f"()=>{S}.setHandInHand(false)")
        # ------------------------------------------------ 3. the crossing with the sun / moon in view
        if "cross" in a.parts:
            rows = L.setdefault("cross", [])
            t.set_time(tm.rome_ms(now, 15, 50) if ps == "day" else tm.rome_ms(now, 18, 40)); page.wait_for_timeout(2500)
            sk = t.sky(); rows.append({"sky": sk}); print("sky", sk, flush=True)
            place(11.9, 99.2, 0.0); page.evaluate(f"()=>{S}.placeMuseAt(11.9,97.6)"); t.settle("c0", 3, 30)
            stick(0, 1); until(lambda: state()["swimming"], 90); stick(0, 0)
            until(lambda: state()["museSwimming"], 90)
            steer(46, 128, 3.0, 90); page.wait_for_timeout(2000)
            key("sink", True); until(lambda: state()["depth"] > 5.5, 40, 200); key("sink", False)
            yaw = math.pi - math.radians(sk["azim"])
            face(yaw); page.evaluate(f"()=>{S}.recenterCamera()") if False else None
            tick("c-deep", rows); shot(f"{ps}-8-cross-0-deep")
            t0 = time.time()
            while time.time() - t0 < 120 and state()["underwater"] > 0.999:
                key("rise", True); page.wait_for_timeout(1200); key("rise", False); page.wait_for_timeout(300)
            tick("c-edge", rows); shot(f"{ps}-8-cross-edge")
            n = 0
            while n < 24:
                key("rise", True); page.wait_for_timeout(300); key("rise", False); page.wait_for_timeout(600)
                tick(f"up{n}", rows); n += 1
                if rows[-1]["underwater"] < 0.97 and n % 2 == 0: shot(f"{ps}-8-cross-up{n:02d}")
                if rows[-1]["underwater"] <= 0.0: break
            key("rise", True); page.wait_for_timeout(1500); key("rise", False); page.wait_for_timeout(500); tick("above", rows); shot(f"{ps}-8-cross-above")
            for i in range(3):
                key("sink", True); page.wait_for_timeout(350); key("sink", False); page.wait_for_timeout(700)
                tick(f"dn{i}", rows); shot(f"{ps}-8-cross-dn{i}")
            # the swimmer a long way off the stair, then back
        # ------------------------------------------------ 3b. the crossing, camera pitched up at the sun / moon
        if "sky" in a.parts:
            rows = L.setdefault("sky", [])
            dh, dm = [int(v) for v in os.environ.get("SKY_DAY_T", "15:50").split(":")]
            t.set_time(tm.rome_ms(now, dh, dm) if ps == "day" else tm.rome_ms(now, *[int(v) for v in os.environ.get("NIGHT_T", "21:00").split(":")])); page.wait_for_timeout(2500)
            sk = t.sky(); rows.append({"sky": sk}); print("sky", sk, flush=True)
            if ps != "day": sk = dict(sk, azim=float(os.environ.get("MOON_AZ", "229")))
            place(11.9, 99.2, 0.0); page.evaluate(f"()=>{S}.placeMuseAt(11.9,97.6)"); t.settle("k0", 3, 30)
            stick(0, 1); until(lambda: state()["swimming"], 90); stick(0, 0)
            until(lambda: state()["museSwimming"], 90)
            steer(46, 128, 3.0, 90); page.wait_for_timeout(2000)
            key("sink", True); until(lambda: state()["depth"] > 5.5, 40, 200); key("sink", False)
            face(-math.radians(sk["azim"]) + math.radians(float(os.environ.get("MOON_DAZ", "0"))))  # camYaw looks the opposite way to the stick: forward is (-sin yaw, -cos yaw)
            page.evaluate(f"()=>{S}.orbitCamera(0,1)"); page.wait_for_timeout(float(os.environ.get("PITCH_MS", "2500"))); page.evaluate(f"()=>{S}.orbitCamera(0,0)"); page.wait_for_timeout(800)
            tick("k-deep", rows); shot(f"{ps}-10-sky-0-deep")
            t0 = time.time()
            while time.time() - t0 < 120 and state()["underwater"] > 0.999:
                key("rise", True); page.wait_for_timeout(1200); key("rise", False); page.wait_for_timeout(300)
            n = 0
            RISE_MS = int(os.environ.get("RISE_MS", "300"))
            while n < 60:
                key("rise", True); page.wait_for_timeout(RISE_MS); key("rise", False); page.wait_for_timeout(600)
                tick(f"k-up{n}", rows); n += 1
                if rows[-1]["underwater"] < 0.999: shot(f"{ps}-10-sky-up{n:02d}")
                if rows[-1]["underwater"] <= 0.0 and n > 3: break
            key("rise", True); page.wait_for_timeout(1500); key("rise", False); page.wait_for_timeout(500); tick("k-above", rows); shot(f"{ps}-10-sky-above")
            steer(12.2, 100.0, 0.6, 150)
            until(lambda: not state()["swimming"], 30); until(lambda: not state()["museSwimming"], 90)
        # ------------------------------------------------ 4. riding the seabed
        if "bed" in a.parts:
            rows = L.setdefault("bed", [])
            t.set_time(tm.rome_ms(now, 12, 0) if ps == "day" else tm.rome_ms(now, 23, 30)); page.wait_for_timeout(2000)
            steer(24, 130, 3.0, 40); key("sink", True); until(lambda: state()["depth"] > 9, 40); page.wait_for_timeout(5000); key("sink", False)
            page.evaluate(f"()=>{S}.recenterCamera()"); page.wait_for_timeout(1500)
            tick("bed-0", rows); shot(f"{ps}-9-bed-0")
            for i, (tx, tz) in enumerate([(40, 150), (50, 138)], 1):
                key("sink", True); steer(tx, tz, 3.0, 40); key("sink", False); page.wait_for_timeout(1500); tick(f"bed-{i}", rows); shot(f"{ps}-9-bed-{i}")
            key("rise", True); page.wait_for_timeout(9000); key("rise", False)
        steer(12.2, 100.0, 0.6, 150)
        until(lambda: not state()["swimming"], 30); until(lambda: not state()["museSwimming"], 90)
        w = where(); place(w["x"], w["z"], math.pi)
        place(11.9, 57, 0.0)
    json.dump(log, open(os.path.join(a.out, "trace.json"), "w"), indent=1); print("errors", errs[:5]); b.close()
