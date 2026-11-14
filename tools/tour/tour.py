#!/usr/bin/env python3
"""Task 90: the town walkthrough. One command tours the town place by place and
photographs each place by day and by night (golden hour too, with --golden).

    tools/tour/run.sh                      # builds the web build, serves it locally, tours it
    python3 tools/tour/tour.py --url URL   # tours a town that is already being served

Output goes to tools/tour/out/<stamp>/ (gitignored): one PNG per place and
pass, tour-log.md, tour-log.json. See tools/tour/README.md.

The page must carry ?tour (the script adds it): the client then offers
window.__townTour (client/src/tourPlaces.ts), with the scene handle and the
place list built from the town's own data. The clock is overridden in the
page (a Date shim), so each pass sets the time instead of waiting for it.
"""
import argparse
import base64
import datetime as dt
import json
import os
import sys
import time
from zoneinfo import ZoneInfo

NEAR_M = 8  # how far from the planned spot the tour will look for an open one
DEFAULT_PASSES = ["day", "night"]

# Rome's clock for each pass (the town's sky follows Europe/Rome). Golden hour is searched, not fixed.
PASS_HOUR = {"day": (12, 0), "night": (23, 30)}


# ---------------------------------------------------------------- pure logic (self-tested)

def frame_verdict(stats):
    """stats: {mean, std, dark} from frame_stats. Returns None when fine, else a flag string."""
    if stats["mean"] < 3 and stats["std"] < 2:
        return "black frame"
    if stats["std"] < 2.5:
        return "empty frame (flat colour)"
    if stats["dark"] > 0.98:
        return "near-black frame"
    return None


def reach_verdict(want, got, tol=1.5):
    """want/got: (x, z). The walker is placed through the town's collision; a big displacement means it is not reachable there."""
    d = ((want[0] - got[0]) ** 2 + (want[1] - got[1]) ** 2) ** 0.5
    return None if d <= tol else f"walker cannot stand here (placed {d:.1f} m away at {got[0]:.1f},{got[1]:.1f})"


def shot_name(index, place_id, pass_name):
    return f"{index:02d}-{place_id}-{pass_name}.png"


def write_log(out_dir, meta, rows, probe_lines):
    """rows: list of dicts {id,label,source,pass,file,flags}. Writes tour-log.md and tour-log.json; returns the problem count."""
    problems = [r for r in rows if r["flags"]]
    ids = []
    for r in rows:
        if r["id"] not in ids:
            ids.append(r["id"])
    lines = [f"# Town tour, {meta['stamp']}", "", f"- Target: {meta['url']}", f"- Passes: {', '.join(meta['passes'])}",
             f"- Places on the list: {len(meta['places'])}; visited: {len(ids)}; shots written: {sum(1 for r in rows if r['file'])} of {len(meta['places']) * len(meta['passes'])} expected",
             ""]
    lines += ["## Time and sky", ""] + [f"- {x}" for x in probe_lines] + [""]
    lines += ["## Places visited", ""] + [f"- `{p['id']}` {p['label']} ({p['source']})" for p in meta["places"]] + [""]
    lines += ["## Shots", "", "| place | pass | shot | flags |", "|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['id']} | {r['pass']} | {r['file'] or '(none)'} | {'; '.join(r['flags']) or 'ok'} |")
    lines += ["", "## Result", ""]
    expected = len(meta["places"]) * len(meta["passes"])
    written = sum(1 for r in rows if r["file"])
    if not problems and written == expected:
        lines.append(f"PASS: every place got every shot ({written} of {expected}); no black or empty frames; every place reachable.")
    else:
        lines.append(f"FLAGGED: {len(problems)} shot(s) with a problem, {written} of {expected} shots written.")
        for r in problems:
            lines.append(f"- {r['id']} / {r['pass']}: {'; '.join(r['flags'])}")
    with open(os.path.join(out_dir, "tour-log.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(out_dir, "tour-log.json"), "w") as f:
        json.dump({"meta": meta, "rows": rows, "probe": probe_lines}, f, indent=1)
    return len(problems) + max(0, expected - written)


# ---------------------------------------------------------------- the browser side

SHIM = """(()=>{const R=Date;window.__off=%d;
const N=function(...a){return a.length?new R(...a):new R(R.now()+window.__off)};
N.prototype=R.prototype;N.now=()=>R.now()+window.__off;N.parse=R.parse;N.UTC=R.UTC;window.Date=N;})()"""

STATS_JS = """async (b64)=>{
  const img=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob());
  const c=document.createElement('canvas');c.width=160;c.height=90;const x=c.getContext('2d');
  x.drawImage(img,0,0,160,90);const d=x.getImageData(0,0,160,90).data;let s=0,q=0,dark=0,n=0;
  for(let i=0;i<d.length;i+=4){const l=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];s+=l;q+=l*l;if(l<12)dark++;n++}
  const m=s/n;return {mean:m,std:Math.sqrt(Math.max(0,q/n-m*m)),dark:dark/n};}"""


# Hide the page's own overlays (HUD, panels, toasts) for the shot, then put them back; --hud keeps them.
HIDE_HUD = """()=>{const c=document.querySelector('canvas');window.__hid=[];
  for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c)||c.contains(e))continue;
    const p=getComputedStyle(e).position;if((p==='fixed'||p==='absolute')&&e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""
SHOW_HUD = "()=>{for(const [e,v] of (window.__hid||[]))e.style.visibility=v;window.__hid=[]}"


def rome_ms(day_utc_ms, hour, minute):
    """UTC ms for a Rome wall-clock time on the date of day_utc_ms."""
    from zoneinfo import ZoneInfo
    d = dt.datetime.fromtimestamp(day_utc_ms / 1000, ZoneInfo("Europe/Rome")).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return d.timestamp() * 1000


class Tour:
    def __init__(self, page, probe_page, args, out_dir):
        self.page, self.probe, self.args, self.out = page, probe_page, args, out_dir
        self.inflight = 0
        self.tracked = set()
        page.on("request", self._on_request)
        page.on("requestfinished", self._on_done)
        page.on("requestfailed", self._on_done)

    def _on_request(self, r):
        # Only asset loads count as "still loading": the town's own polling (actions, bridge) never goes quiet.
        if r.method == "GET" and not any(k in r.url for k in ("/actions", "/bridge", "/healthz", "/visit", "/pair")):
            self.tracked.add(r)
            self.inflight = len(self.tracked)

    def _on_done(self, r):
        self.tracked.discard(r)
        self.inflight = len(self.tracked)

    def set_time(self, utc_ms):
        self.page.evaluate("t=>{window.__off=t-Date.now()+window.__off}", utc_ms)
        self.page.evaluate("()=>window.__townTour.scene.tourSnapSky()")

    def sky(self):
        return self.page.evaluate("()=>window.__townTour.scene.skyState()")

    def settle(self, label, min_s=3.0, max_s=45.0):
        """Wait for the network to go quiet (models load as he nears them), then for two equal frames."""
        t0 = time.time()
        quiet_since = None
        while time.time() - t0 < max_s:
            if self.inflight == 0:
                quiet_since = quiet_since or time.time()
                if time.time() - quiet_since > 2.0 and time.time() - t0 > min_s:
                    break
            else:
                quiet_since = None
            self.page.wait_for_timeout(300)
        return time.time() - t0

    def teleport(self, p):
        """Place Gaius through the scene's own restoreResume (collision-resolved); return where he ended up."""
        return self.page.evaluate("""p=>{const s=window.__townTour.scene;
          s.restoreResume({x:p.x,z:p.z,heading:p.heading,camYaw:p.heading,camPitch:0,userZoom:1});
          const r=s.resumeState();return r?{x:r.x,z:r.z}:null}""", p)

    def place_walker(self, p):
        """Stand him at the place; if the spot is blocked, try nearby open spots (back along his view, then to either side).
        Returns (where he is, the pose used or None if nothing within NEAR_M was open, a note when the pose was moved)."""
        import math
        sx, cz = math.sin(p["heading"]), math.cos(p["heading"])
        tries = [(0, 0)] + [(b, l) for b in (2, 4, 6, 8) for l in (0, 3, -3)]
        got = None
        for back, lat in tries:
            q = dict(p, x=p["x"] - sx * back + cz * lat, z=p["z"] - cz * back - sx * lat)
            got = self.teleport(q)
            if got is None:
                return None, None, None
            if reach_verdict((q["x"], q["z"]), (got["x"], got["z"])) is None:
                note = None if (back, lat) == (0, 0) else f"the planned spot was blocked; stood {back} m back, {lat} m aside, at {q['x']:.1f},{q['z']:.1f}"
                return got, q, note
        return got, None, None

    def stats(self, png):
        return self.probe.evaluate(STATS_JS, base64.b64encode(png).decode())

    def find_golden(self, day_ms):
        """Search the day for the evening time whose sun elevation is in the town's golden window; None if the town's sun never gets there today."""
        return self.page.evaluate("""day=>{const t=window.__townTour;
          // Scan 12:00 to 21:00 Rome (UTC+1 or +2: scan by UTC hour of the day) for the first dusk-side golden sample.
          const base=day;let best=null;
          for(let m=0;m<14*60;m+=5){const ms=base+m*60000;const a=t.solarAngles(new Date(ms));
            if(a.elev<9&&a.elev>0.5&&best===null&&m>0){const prev=t.solarAngles(new Date(ms-300000));if(prev.elev>a.elev)best=ms}}
          return best}""", day_ms)


def run_tour(args):
    from playwright.sync_api import sync_playwright
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir = os.path.join(args.out, stamp)
    os.makedirs(out_dir, exist_ok=True)
    passes = list(args.passes)
    now_ms = time.time() * 1000
    day_start = rome_ms(now_ms, 0, 0)
    rows, probe_lines, notes = [], [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chromium-headless-shell", args=[
            "--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": args.width, "height": args.height})
        probe = browser.new_page()
        probe.goto("about:blank")
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.add_init_script(SHIM % 0)
        t = Tour(page, probe, args, out_dir)
        sep = "&" if "?" in args.url else "?"
        url = args.url + sep + "tour=1"
        print(f"loading {url}", flush=True)
        try:
            page.goto(url, timeout=180000)
            page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=args.load_s * 1000)
        except Exception as e:
            note = f"the town did not load: {e}"
            print(note, flush=True)
            write_log(out_dir, {"stamp": stamp, "url": args.url, "passes": passes, "places": []}, [], [note] + errors[:5])
            browser.close()
            return 2, out_dir
        t.settle("load", min_s=args.load_settle_s, max_s=120)
        places = page.evaluate("()=>window.__townTour.places")
        if args.only:
            places = [x for x in places if x["id"] in args.only.split(",")]
        meta = {"stamp": stamp, "url": args.url, "passes": passes, "places": places}
        print(f"{len(places)} places: {', '.join(x['id'] for x in places)}", flush=True)
        page.evaluate("()=>{const s=window.__townTour.scene;s.setWeather('clear');s.enterWalk()}")
        page.wait_for_timeout(1500)

        # The clock for each pass.
        times = {}
        for name in passes:
            if name == "golden":
                g = t.find_golden(day_start + 11 * 3600000)
                if g is None:
                    probe_lines.append("golden hour: no evening sun elevation found in the town's golden window today; golden pass skipped")
                    continue
                times[name] = g
            else:
                h, m = PASS_HOUR[name]
                times[name] = rome_ms(now_ms, h, m)
        passes = [x for x in passes if x in times]
        meta["passes"] = passes
        # Probe: does each clock time really put the sky where the pass names it?
        for name in passes:
            t.set_time(times[name])
            page.wait_for_timeout(1500)
            s = t.sky()
            probe_lines.append(f"{name}: Rome clock {dt.datetime.fromtimestamp(times[name] / 1000, ZoneInfo('Europe/Rome')).strftime('%H:%M')}, sun elev {s['elev']:.1f} deg, darkness {s['darkness']:.2f}, phase {s['phase']}, golden {s['golden']}")

        index = 0
        for pass_name in passes:
            t.set_time(times[pass_name])
            page.wait_for_timeout(2500)
            for place in places:
                index += 1
                flags = []
                file = None
                try:
                    got, used, note = t.place_walker(place)
                    if got is None:
                        flags.append("scene would not place the walker (resume state unavailable)")
                    elif used is None:
                        flags.append(f"walker cannot stand here (the scene put him back at the gate, {got['x']:.1f},{got['z']:.1f}; no open spot within {NEAR_M:.0f} m)")
                    elif note:
                        if f"{place['id']}: {note}" not in notes:
                            notes.append(f"{place['id']}: {note}")
                    t.set_time(times[pass_name])
                    t.settle(place["id"], min_s=args.settle_s, max_s=45)
                    page.wait_for_timeout(1200)
                    if not args.hud:
                        page.evaluate(HIDE_HUD)
                    png = page.screenshot(timeout=120000)
                    if not args.hud:
                        page.evaluate(SHOW_HUD)
                    file = shot_name(index, place["id"], pass_name)
                    with open(os.path.join(out_dir, file), "wb") as f:
                        f.write(png)
                    v = frame_verdict(t.stats(png))
                    if v:
                        flags.append(v)
                except Exception as e:  # a place that fails to load or shoot is flagged, not fatal
                    flags.append(f"failed: {str(e)[:160]}")
                rows.append({"id": place["id"], "label": place["label"], "source": place["source"], "pass": pass_name, "file": file, "flags": flags})
                print(f"{pass_name:6} {place['id']:16} {file or '-'} {'; '.join(flags) or 'ok'}", flush=True)
        probe_lines.extend(notes)
        if errors:
            probe_lines.append(f"page errors during the tour ({len(errors)}): " + " | ".join(errors[:3]))
        browser.close()
    bad = write_log(out_dir, meta, rows, probe_lines)
    print(f"log: {os.path.join(out_dir, 'tour-log.md')}", flush=True)
    return (1 if bad else 0), out_dir


# ---------------------------------------------------------------- self-test (no browser)

def self_test():
    import tempfile
    assert frame_verdict({"mean": 0.5, "std": 0.2, "dark": 1.0}) == "black frame"
    assert frame_verdict({"mean": 120, "std": 0.5, "dark": 0}) == "empty frame (flat colour)"
    assert frame_verdict({"mean": 80, "std": 30, "dark": 0.1}) is None
    assert reach_verdict((1, 1), (1.5, 1)) is None and reach_verdict((0, 0), (10, 0)) is not None
    places = [{"id": f"p{i}", "label": f"Place {i}", "source": "place"} for i in range(4)]
    d = tempfile.mkdtemp()
    rows = []
    for k, name in enumerate(["day", "night"]):
        for i, pl in enumerate(places):
            f = shot_name(k * 4 + i + 1, pl["id"], name)
            open(os.path.join(d, f), "wb").close()
            rows.append({"id": pl["id"], "label": pl["label"], "source": "place", "pass": name, "file": f, "flags": []})
    meta = {"stamp": "selftest", "url": "x", "passes": ["day", "night"], "places": places}
    assert write_log(d, meta, rows, ["probe"]) == 0
    assert "PASS: every place got every shot (8 of 8)" in open(os.path.join(d, "tour-log.md")).read()
    assert sorted(f for f in os.listdir(d) if f.endswith(".png")) == sorted(r["file"] for r in rows)
    rows[3]["file"] = None; rows[3]["flags"] = ["failed: x"]
    assert write_log(d, meta, rows, []) > 0 and "FLAGGED" in open(os.path.join(d, "tour-log.md")).read()
    print("tour self-test ok")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:8099/", help="the town to tour (default: the local build served by run.sh)")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"))
    ap.add_argument("--passes", nargs="+", default=DEFAULT_PASSES, choices=["day", "golden", "night"])
    ap.add_argument("--golden", action="store_true", help="also take a golden-hour pass")
    ap.add_argument("--only", help="comma-separated place ids, for a quick look")
    ap.add_argument("--hud", action="store_true", help="keep the page's overlays (menu, pad, panels) in the shots")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--load-s", type=int, default=240, help="how long to wait for the scene to start")
    ap.add_argument("--load-settle-s", type=float, default=20)
    ap.add_argument("--settle-s", type=float, default=4)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    if args.golden and "golden" not in args.passes:
        args.passes = ["day", "golden", "night"]
    code, out = run_tour(args)
    print("tour", "complete" if code == 0 else "FLAGGED (see the log)", out)
    sys.exit(code)


if __name__ == "__main__":
    main()
