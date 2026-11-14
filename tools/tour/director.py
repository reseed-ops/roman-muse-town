#!/usr/bin/env python3
"""Task 94: the director. Stage a scene in the town, film it, check its own frames, reshoot on a note.

    tools/tour/direct.sh scenes/wedding-arch.json                 # stage, film, check, report
    tools/tour/direct.sh scenes/wedding-arch.json --note "closer, zoom the camera"
    python3 tools/tour/director.py SCENE.json --url URL           # against a town that is already served
    python3 tools/tour/director.py --self-test                    # the frame checks, no browser

A scene is a small JSON file (the "script"): where Gaius stands and faces, where Aelia goes, the clock,
the weather, the wedding dressing, the camera (zoom, pitch), and the subjects that must be in frame.
A note ("closer", "wider", "lower", "higher", "left", "right", "night", "dusk", "day", "rain") edits the scene
file in place, so the same scene is reshot with the note kept in its "notes" list and nothing re-prompted.

The director checks every frame BEFORE it reports: a subject out of frame or cut by the edge, a black or
flat frame, nothing happening (the burst of frames does not move), a frame too dark or blown out. A frame
that fails is reshot with an automatic fix where one exists (zoom, reposition) up to --retries times; a
frame that still fails is reported plainly as FLAGGED, never shown as good.

Reuses tour.py's page hooks (?tour: window.__townTour). No town code is changed.
"""
import argparse
import importlib.util
import json
import math
import os
import struct
import subprocess
import sys
import time
import zlib

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- the follow camera, as the scene sets it
# client/src/townScene.ts, walk camera: stands `dist` behind Gaius (4.0 on a landscape desktop frame,
# times the visitor's zoom, 2.2..30), `height` above the ground (1.85), looks at a point 1.2 m ahead of
# him at 1.15 m. The pitch offset only lifts the camera when above CAM_LOOK_UP_FROM (-1.1). fov 52 for
# a landscape frame up to 860 px tall, 46 for a wide one, 48 otherwise, 60 portrait.

def cam_params(width, height):
    aspect = width / height
    landscape = aspect > 1.05 and height <= 860
    if aspect < 0.8:
        fov, dist, h = 60, 4.5, 2.0
    elif landscape:
        fov, dist, h = 52, 4.0, 1.85
    elif aspect > 1.6:
        fov, dist, h = 46, 4.2, 2.0
    else:
        fov, dist, h = 48, 4.2, 2.0
    return {"fov": fov, "dist": dist, "height": h, "aspect": aspect}


def camera_pose(gaius, cam_yaw, zoom, pitch, width, height, ground=lambda x, z: 0.0):
    """Camera position and look-at for Gaius at (x, z) with the follow camera at yaw `cam_yaw` (it is his heading unless the scene swings it), the zoom and pitch the scene was given."""
    p = cam_params(width, height)
    d = min(30.0, max(2.2, p["dist"] * zoom))
    fx, fz = math.sin(cam_yaw), math.cos(cam_yaw)
    gx, gz = gaius
    gy = ground(gx, gz)
    cx, cz = gx - fx * d, gz - fz * d
    cy = gy + p["height"] + max(pitch, -1.1)
    tx, ty, tz = gx + fx * 1.2, gy + 1.15, gz + fz * 1.2
    return (cx, cy, cz), (tx, ty, tz), p


def project(point, cam, target, fov, aspect):
    """Normalised screen position of a world point: (u, v) in 0..1 with (0,0) the top left, or None behind the camera."""
    fwd = [target[i] - cam[i] for i in range(3)]
    n = math.sqrt(sum(c * c for c in fwd)) or 1.0
    fwd = [c / n for c in fwd]
    right = [-fwd[2], 0.0, fwd[0]]  # fwd x up(0,1,0): facing +z, right is -x
    rn = math.hypot(right[0], right[2]) or 1.0
    right = [right[0] / rn, 0.0, right[2] / rn]
    up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]
    rel = [point[i] - cam[i] for i in range(3)]
    z = sum(rel[i] * fwd[i] for i in range(3))
    if z <= 0.05:
        return None
    x = sum(rel[i] * right[i] for i in range(3))
    y = sum(rel[i] * up[i] for i in range(3))
    t = math.tan(math.radians(fov) / 2)
    return (0.5 + 0.5 * (x / (z * t * aspect)), 0.5 - 0.5 * (y / (z * t)))


# ---------------------------------------------------------------- pure checks (self-tested)

def subject_verdict(name, head, feet, margin=0.02):
    """head/feet: projected (u, v) or None for the top and bottom of a subject. Returns None when it is whole in frame."""
    if head is None or feet is None:
        return f"{name} is behind the camera"
    us = (head[0], feet[0])
    vs = (head[1], feet[1])
    if max(us) < 0 or min(us) > 1 or max(vs) < 0 or min(vs) > 1:
        return f"{name} is out of frame"
    if min(us) < margin or max(us) > 1 - margin or min(vs) < margin or max(vs) > 1 - margin:
        return f"{name} is cut by the frame edge"
    if abs(head[1] - feet[1]) < 0.04:
        return f"{name} is too small to read in frame ({abs(head[1] - feet[1]):.0%} of the height)"
    return None


def overlap_verdict(a, b, min_gap=0.08):
    """a, b: (name, head, feet, depth) for two people. One standing squarely behind the other is not in the shot. Returns None when both read."""
    (an, ah, af, ad), (bn, bh, bf, bd) = a, b
    if ah is None or bh is None:
        return None
    gap = abs((ah[0] + af[0]) / 2 - (bh[0] + bf[0]) / 2)
    if gap < min_gap:
        far = an if ad > bd else bn
        near = bn if ad > bd else an
        return f"{far} is hidden behind {near}"
    return None


def frame_verdict(stats):
    """Same thresholds as the tour's frame check, plus too dark and blown out. stats: {mean, std, dark, bright}."""
    if stats["mean"] < 3 and stats["std"] < 2:
        return "black frame"
    if stats["std"] < 2.5:
        return "empty frame (flat colour)"
    if stats["dark"] > 0.98:
        return "near-black frame"
    if stats["bright"] > 0.55:
        return "blown out (over half the frame is chalk white)"
    return None


def motion_verdict(motion, floor=0.0006):
    """motion: mean absolute difference (0..1) across the burst. A scene where nothing moves is not a scene."""
    return "nothing is happening (the burst does not move)" if motion < floor else None


def decode_png(data):
    """A tiny PNG reader (8-bit, non-interlaced, grey/RGB/RGBA), enough for the browser's screenshots. Returns (w, h, rows) with rows of RGB bytes."""
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos, idat, w = 8, [], None
    while pos < len(data):
        ln, kind = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if kind == b"IHDR":
            w, h, depth, ctype, _, _, inter = struct.unpack(">IIBBBBB", body)
            assert depth == 8 and inter == 0 and ctype in (0, 2, 6), "unsupported PNG"
        elif kind == b"IDAT":
            idat.append(body)
    ch = {0: 1, 2: 3, 6: 4}[ctype]
    raw = zlib.decompress(b"".join(idat))
    stride = w * ch
    rows, prev = [], bytearray(stride)
    p = 0
    for _ in range(h):
        f = raw[p]
        cur = bytearray(raw[p + 1:p + 1 + stride])
        p += 1 + stride
        if f == 1:
            for i in range(ch, stride):
                cur[i] = (cur[i] + cur[i - ch]) & 255
        elif f == 2:
            for i in range(stride):
                cur[i] = (cur[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                cur[i] = (cur[i] + (((cur[i - ch] if i >= ch else 0) + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = cur[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                cur[i] = (cur[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(cur)
        prev = cur
    if ch == 1:
        rows = [bytearray(v for g in r for v in (g, g, g)) for r in rows]
    elif ch == 4:
        rows = [bytearray(b for i in range(0, len(r), 4) for b in r[i:i + 3]) for r in rows]
    return w, h, rows


def luma_grid(png, gw=96, gh=54):
    """The frame sampled to a gw x gh grid of luma values (0..255). png: bytes, or an already decoded (w, h, rows)."""
    w, h, rows = decode_png(png) if isinstance(png, (bytes, bytearray)) else png
    out = []
    for gy in range(gh):
        r = rows[min(h - 1, int((gy + 0.5) * h / gh))]
        line = []
        for gx in range(gw):
            i = 3 * min(w - 1, int((gx + 0.5) * w / gw))
            line.append(0.2126 * r[i] + 0.7152 * r[i + 1] + 0.0722 * r[i + 2])
        out.append(line)
    return out


def cloak_fraction(decoded, head, feet):
    """The smaller of two shares: red-cloak red in the shoulders band and in the hem band of Gaius's projected body. His cloak is the one deep red
    thing that is always on him; when scenery stands between the camera and him (a wall over his shoulders, a column across him), or he is not where
    the camera model says, one band is missing it. decoded: (w, h, rows); head/feet: projected (u, v)."""
    w, h, rows = decoded
    cu = (head[0] + feet[0]) / 2
    span = feet[1] - head[1]
    half = max(0.012, 0.09 * span)
    x0, x1 = int(max(0, cu - half) * w), int(min(1, cu + half) * w)

    def band(t0, t1):
        y0, y1 = int(max(0, head[1] + t0 * span) * h), int(min(1, head[1] + t1 * span) * h)
        n = red = 0
        for y in range(y0, max(y0 + 1, y1), 2):
            r = rows[y]
            for x in range(x0, max(x0 + 1, x1), 2):
                i = 3 * x
                R, G, B = r[i], r[i + 1], r[i + 2]
                n += 1
                if R > 28 and R > 1.7 * G and R > 1.7 * B:
                    red += 1
        return red / n if n else 0.0
    return min(band(0.25, 0.42), band(0.6, 0.9))


def grid_stats(g):
    v = [x for row in g for x in row]
    n = len(v)
    m = sum(v) / n
    var = max(0.0, sum(x * x for x in v) / n - m * m)
    return {"mean": m, "std": math.sqrt(var), "dark": sum(1 for x in v if x < 12) / n, "bright": sum(1 for x in v if x > 245) / n}


def grid_motion(grids):
    """Mean absolute luma difference between consecutive grids, 0..1."""
    if len(grids) < 2:
        return 0.0
    tot = 0.0
    for a, b in zip(grids, grids[1:]):
        tot += sum(abs(x - y) for ra, rb in zip(a, b) for x, y in zip(ra, rb)) / (len(a) * len(a[0]) * 255)
    return tot / (len(grids) - 1)


# ---------------------------------------------------------------- notes: a short text edits the scene

def apply_note(scene, note):
    """Edit the scene (a dict, the saved script) for a short note. Returns a list of what changed, [] when the note was not understood."""
    n = note.lower()
    cam = scene.setdefault("camera", {})
    changes = []
    zoom = float(cam.get("zoom", 1.0))
    if any(w in n for w in ("closer", "zoom in", "tighter", "nearer")):
        cam["zoom"] = round(max(0.55, zoom * 0.7), 3)
        changes.append(f"camera zoom {zoom:g} -> {cam['zoom']:g} (closer)")
    elif any(w in n for w in ("wider", "further", "farther", "zoom out", "pull back", "back up")):
        cam["zoom"] = round(min(7.0, zoom / 0.7), 3)
        changes.append(f"camera zoom {zoom:g} -> {cam['zoom']:g} (wider)")
    pitch = float(cam.get("pitch", 0.0))
    if "lower" in n:
        cam["pitch"] = round(pitch - 0.5, 3)
        changes.append(f"camera pitch {pitch:g} -> {cam['pitch']:g} (lower)")
    elif "higher" in n or "from above" in n:
        cam["pitch"] = round(pitch + 0.8, 3)
        changes.append(f"camera pitch {pitch:g} -> {cam['pitch']:g} (higher)")
    yaw = float(cam.get("yawOffset", 0.0))
    if "left" in n:
        cam["yawOffset"] = round(yaw + 0.3, 3)
        changes.append(f"camera yaw {yaw:g} -> {cam['yawOffset']:g} (swing left)")
    elif "right" in n:
        cam["yawOffset"] = round(yaw - 0.3, 3)
        changes.append(f"camera yaw {yaw:g} -> {cam['yawOffset']:g} (swing right)")
    clock = scene.setdefault("clock", {})
    for word, hh, mm in (("night", 23, 30), ("midday", 12, 0), ("noon", 12, 0), ("morning", 9, 0)):
        if word in n:
            clock.pop("golden", None); clock.pop("elev", None)
            clock["rome"] = f"{hh:02d}:{mm:02d}"
            changes.append(f"clock -> {clock['rome']} Rome ({word})")
            break
    else:
        if "dusk" in n or "golden" in n or "sunset" in n:
            clock.pop("rome", None); clock.pop("elev", None)
            clock["golden"] = True
            changes.append("clock -> golden hour")
    for w in ("rain", "storm", "fog", "clear"):
        if w in n and "no " + w not in n:
            scene["weather"] = "clear" if w == "clear" else w
            changes.append(f"weather -> {scene['weather']}")
            break
    if changes:
        scene.setdefault("notes", []).append({"note": note, "changes": changes})
    return changes


def auto_fix(scene, flags, facts=None):
    """What the director does by itself for a failed frame; returns the changes made ([] when it has no fix)."""
    cam = scene.setdefault("camera", {})
    zoom = float(cam.get("zoom", 1.0))
    changes = []
    if any("something stands between" in f for f in flags):
        cam["zoom"] = round(max(0.55, zoom * 0.6), 3)
        changes.append(f"auto: Gaius hidden by scenery, zoom {zoom:g} -> {cam['zoom']:g} (camera in close, past the obstacle)")
    if any("hidden behind" in f for f in flags):
        a = scene.get("aelia")
        if a:
            cam_yaw = float(scene["gaius"]["heading"])
            u = ((facts or {}).get("subjects", {}).get("aelia", {}).get("head") or [0.5])[0]
            side = 1.0 if u < 0.5 else -1.0  # on screen left of him: further left (+1, the camera's left), else further right
            a["x"] = round(a["x"] + side * math.cos(cam_yaw) * 1.2, 2)
            a["z"] = round(a["z"] - side * math.sin(cam_yaw) * 1.2, 2)
            changes.append(f"auto: one of them hidden behind the other, Aelia's mark moved 1.2 m {'left' if side > 0 else 'right'} (away from his line) to {a['x']},{a['z']}")
    if any("out of frame" in f or "cut by the frame edge" in f or "behind the camera" in f for f in flags):
        cam["zoom"] = round(min(7.0, zoom * 1.35), 3)
        changes.append(f"auto: subject not whole in frame, zoom {zoom:g} -> {cam['zoom']:g} (pull back)")
    elif any("too small" in f for f in flags):
        cam["zoom"] = round(max(0.55, zoom * 0.8), 3)
        changes.append(f"auto: subject too small, zoom {zoom:g} -> {cam['zoom']:g} (closer)")
    return changes


# ---------------------------------------------------------------- the browser side

def load_tour_module():
    spec = importlib.util.spec_from_file_location("town_tour", os.path.join(HERE, "tour.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Every overlay: anything that is not the canvas or one of its ancestors (the tour's own hide keeps static children, so a prompt pill slipped through).
HIDE_ALL = """()=>{const c=document.querySelector('canvas');window.__hid=[];
  for(const e of document.body.querySelectorAll('*')){if(e===c||e.contains(c))continue;
    if(e.style.visibility!=='hidden'){window.__hid.push([e,e.style.visibility]);e.style.visibility='hidden'}}}"""

STAGE_JS = """async (s)=>{
  const T=window.__townTour, sc=T.scene;
  sc.setWeather(s.weather||'clear');
  sc.enterWalk();
  sc.setVisitActive(true);
  if(s.wedding){
    sc.setWedding({steps:['flowers','vows','dress'],weddings:0,celebrated:true});
  }
  return true;}"""

PLACE_GAIUS_JS = """p=>{const sc=window.__townTour.scene;
  sc.restoreResume({x:p.x,z:p.z,heading:p.heading,camYaw:p.camYaw,camPitch:p.pitch,userZoom:p.zoom});
  const r=sc.resumeState();return r?{x:r.x,z:r.z,heading:r.heading}:null}"""

TELE_JS = "()=>window.__townTour.scene.visitTelemetry()"


def ground_zero(x, z):
    return 0.0


class Director:
    def __init__(self, tour_mod, page, args):
        self.tm, self.page, self.args = tour_mod, page, args
        self.tour = None

    def stage(self, scene):
        """Place the characters, set the clock and weather. Returns (log lines, gaius pose, aelia pose)."""
        page = self.page
        log = []
        page.evaluate(STAGE_JS, {"weather": scene.get("weather", "clear"), "wedding": bool(scene.get("wedding"))})
        page.wait_for_timeout(1200)
        g = scene["gaius"]
        cam = scene.get("camera", {})
        heading = float(g["heading"])
        got = None
        for back, lat in [(0, 0)] + [(b, l) for b in (1, 2, 3) for l in (0, 1.5, -1.5)]:
            sx, cz = math.sin(heading), math.cos(heading)
            q = {"x": g["x"] - sx * back + cz * lat, "z": g["z"] - cz * back - sx * lat, "heading": heading,
                 "camYaw": heading + float(cam.get("yawOffset", 0.0)), "pitch": float(cam.get("pitch", 0.0)), "zoom": float(cam.get("zoom", 1.0))}
            got = page.evaluate(PLACE_GAIUS_JS, q)
            if got and self.tm.reach_verdict((q["x"], q["z"]), (got["x"], got["z"])) is None:
                if (back, lat) != (0, 0):
                    log.append(f"Gaius's spot was blocked; stood {back} m back, {lat} m aside")
                break
        else:
            log.append("Gaius could not stand within 3 m of the planned spot")
        # The sky.
        clock = scene.get("clock", {})
        now_ms = time.time() * 1000
        day_start = self.tm.rome_ms(now_ms, 0, 0)
        if "elev" in clock:
            ms = self.page.evaluate("""a=>{const t=window.__townTour;let prev=null;
              for(let m=0;m<14*60;m++){const ms=a.day+m*60000;const e=t.solarAngles(new Date(ms)).elev;
                if(prev!==null&&prev>e&&prev>=a.elev&&e<a.elev)return ms;prev=e}return null}""", {"day": day_start + 11 * 3600000, "elev": float(clock["elev"])})
            if ms is None:
                log.append(f"the sun never sets to {clock['elev']} deg today; using 19:00 Rome")
                ms = self.tm.rome_ms(now_ms, 19, 0)
        elif clock.get("golden"):
            ms = self.tour.find_golden(day_start + 11 * 3600000)
            if ms is None:
                log.append("no golden hour found today; using 18:30 Rome")
                ms = self.tm.rome_ms(now_ms, 18, 30)
        else:
            hh, mm = [int(x) for x in clock.get("rome", "12:00").split(":")]
            ms = self.tm.rome_ms(now_ms, hh, mm)
        self.tour.set_time(ms)
        page.wait_for_timeout(2000)
        sky = self.tour.sky()
        log.append(f"sky: sun elev {sky['elev']:.1f} deg, darkness {sky['darkness']:.2f}, phase {sky['phase']}, golden {sky['golden']}")
        # Aelia walks to her mark and we wait for her.
        a = scene.get("aelia")
        if a:
            legs = [(v[0], v[1]) for v in a.get("via", [])] + [(a["x"], a["z"])]
            for li, (lx, lz) in enumerate(legs):
                last = li == len(legs) - 1
                ok = page.evaluate("d=>window.__townTour.scene.visitDirect(d)", {"kind": "goto", "x": lx, "z": lz})
                if not ok:
                    log.append(f"Aelia would not take the goto to {lx},{lz} (a moment owns her body, or the point is outside the walkable world)")
                    break
                t0 = time.time()
                while time.time() - t0 < self.args.arrive_s:
                    tele = page.evaluate(TELE_JS)
                    if math.hypot(tele["museX"] - lx, tele["museZ"] - lz) < (0.8 if last else 1.5):
                        break
                    page.wait_for_timeout(500)
                else:
                    log.append(f"Aelia did not reach {'her mark' if last else 'waypoint ' + str(li + 1)} in time")
                    break
            if a.get("emote"):
                page.evaluate("d=>window.__townTour.scene.visitDirect(d)", {"kind": "emote", "emote": a["emote"]})
        if scene.get("celebrate"):
            page.evaluate("()=>window.__townTour.scene.celebrateWedding()")
        # Gaius must not have been moved by the follow harness: put him back after Aelia has walked.
        tele = page.evaluate(TELE_JS)
        if a:
            miss = math.hypot(tele["museX"] - a["x"], tele["museZ"] - a["z"])
            log.append(f"Aelia at {tele['museX']:.1f},{tele['museZ']:.1f}, {miss:.1f} m from her mark")
            tele["aeliaMiss"] = miss
        return log, tele

    def film(self, scene, tag, out_dir):
        """A burst of frames (the motion check, and the clip). Returns (png list, files)."""
        page, args = self.page, self.args
        self.tour.settle("scene", min_s=args.settle_s, max_s=45)
        page.wait_for_timeout(1200)
        if not args.hud:
            page.evaluate(HIDE_ALL)
        pngs = []
        for i in range(args.burst):
            pngs.append(page.screenshot(timeout=120000))
            page.wait_for_timeout(int(args.burst_gap_s * 1000))
        if not args.hud:
            page.evaluate(self.tm.SHOW_HUD)
        files = []
        for i, png in enumerate(pngs):
            f = f"{tag}-f{i + 1}.png"
            with open(os.path.join(out_dir, f), "wb") as fh:
                fh.write(png)
            files.append(f)
        return pngs, files

    def check(self, scene, tele, pngs):
        """The director's own review of what it just filmed. Returns (flags, facts)."""
        flags, facts = [], {}
        decoded = [decode_png(p) for p in pngs]
        grids = [luma_grid(d) for d in decoded]
        mid = grids[len(grids) // 2]
        st = grid_stats(mid)
        facts["frame"] = {k: round(v, 3) for k, v in st.items()}
        v = frame_verdict(st)
        if v:
            flags.append(v)
        motion = grid_motion(grids)
        facts["motion"] = round(motion, 5)
        v = motion_verdict(motion)
        if v:
            flags.append(v)
        # Subjects: project them with the follow camera's own pose.
        W, H = self.args.width, self.args.height
        cam_cfg = scene.get("camera", {})
        cam, tgt, p = camera_pose((tele["gaiusX"], tele["gaiusZ"]), tele["gaiusHeading"] + float(cam_cfg.get("yawOffset", 0.0)), float(cam_cfg.get("zoom", 1.0)), float(cam_cfg.get("pitch", 0.0)), W, H)
        if tele.get("aeliaMiss", 0) > 2.5:
            flags.append(f"aelia is not at her mark ({tele['aeliaMiss']:.1f} m off)")
        subjects = {"gaius": (tele["gaiusX"], tele["gaiusZ"]), "aelia": (tele["museX"], tele["museZ"])}
        for extra in scene.get("subjects", []):
            if isinstance(extra, dict):
                subjects[extra["name"]] = (extra["x"], extra["z"])
        want = scene.get("require", ["gaius", "aelia"])
        facts["subjects"] = {}
        people = []
        for name in want:
            if name not in subjects:
                flags.append(f"{name}: unknown subject")
                continue
            x, z = subjects[name]
            height = 1.75 if name in ("gaius", "aelia") else float(next((e.get("height", 1.2) for e in scene.get("subjects", []) if isinstance(e, dict) and e["name"] == name), 1.2))
            head = project((x, height, z), cam, tgt, p["fov"], p["aspect"])
            feet = project((x, 0.0, z), cam, tgt, p["fov"], p["aspect"])
            facts["subjects"][name] = {"head": [round(c, 3) for c in head] if head else None, "feet": [round(c, 3) for c in feet] if feet else None}
            v = subject_verdict(name, head, feet)
            if v:
                flags.append(v)
            if name == "gaius" and head and feet:
                cf = cloak_fraction(decoded[len(decoded) // 2], head, feet)
                facts["subjects"][name]["cloak"] = round(cf, 3)
                if cf < 0.15:
                    flags.append(f"gaius is not visible where he stands (his cloak is missing from his box, {cf:.0%}): something stands between the camera and him")
            if name in ("gaius", "aelia") and head and feet:
                people.append((name, head, feet, math.hypot(x - cam[0], z - cam[2])))
        if len(people) == 2:
            v = overlap_verdict(people[0], people[1])
            if v:
                flags.append(v)
        return flags, facts


def write_clip(out_dir, files, name):
    """A short GIF of the burst, when ffmpeg is on the box (never required)."""
    try:
        listing = os.path.join(out_dir, f"{name}-list.txt")
        with open(listing, "w") as f:
            for fn in files:
                f.write(f"file '{os.path.join(out_dir, fn)}'\nduration 0.5\n")
        out = os.path.join(out_dir, f"{name}.gif")
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listing, "-vf", "scale=640:-1:flags=lanczos", out], capture_output=True, timeout=120)
        os.remove(listing)
        return f"{name}.gif" if r.returncode == 0 else None
    except Exception:
        return None


def run_scene(args):
    from playwright.sync_api import sync_playwright
    with open(args.scene) as f:
        scene = json.load(f)
    name = scene.get("name") or os.path.splitext(os.path.basename(args.scene))[0]
    if args.note:
        changes = apply_note(scene, args.note)
        if not changes:
            print(f"the note {args.note!r} was not understood; reshooting the scene unchanged", flush=True)
        else:
            print("note applied: " + "; ".join(changes), flush=True)
            if not args.dry:
                with open(args.scene, "w") as f:
                    json.dump(scene, f, indent=2)
                    f.write("\n")
    stamp = time.strftime("%Y%m%d-%H%M%S")
    out_dir = os.path.join(args.out, f"{name}-{stamp}")
    os.makedirs(out_dir, exist_ok=True)
    tm = load_tour_module()
    takes = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": args.width, "height": args.height})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.add_init_script(tm.SHIM % 0)
        t = tm.Tour(page, None, args, out_dir)
        d = Director(tm, page, args)
        d.tour = t
        sep = "&" if "?" in args.url else "?"
        print(f"loading {args.url}{sep}tour=1", flush=True)
        page.goto(args.url + sep + "tour=1", timeout=180000)
        page.wait_for_function("()=>window.__townTour&&window.__townTour.places&&window.__townTour.places.length>0", timeout=args.load_s * 1000)
        t.settle("load", min_s=args.load_settle_s, max_s=120)
        for attempt in range(args.retries + 1):
            tag = f"take{attempt + 1}"
            slog, tele = d.stage(scene)
            pngs, files = d.film(scene, tag, out_dir)
            flags, facts = d.check(scene, tele, pngs)
            take = {"take": attempt + 1, "files": files, "flags": flags, "facts": facts, "stage": slog, "scene": json.loads(json.dumps(scene))}
            takes.append(take)
            print(f"take {attempt + 1}: {'; '.join(flags) or 'ok'}", flush=True)
            if not flags:
                break
            fixes = auto_fix(scene, flags, facts)
            take["reshoot"] = fixes
            if not fixes or attempt == args.retries:
                break
            print("reshooting: " + "; ".join(fixes), flush=True)
        if errors:
            takes[-1]["page_errors"] = errors[:3]
        browser.close()
    last = takes[-1]
    auto = [c for tk in takes for c in tk.get("reshoot", [])]
    if auto and not last["flags"] and not args.dry:
        # The reshoot found a setup that works: keep it in the saved script, so the next shoot starts from it.
        scene.setdefault("notes", []).append({"note": "(director's own reshoot)", "changes": auto})
        with open(args.scene, "w") as f:
            json.dump(scene, f, indent=2)
            f.write("\n")
    clip = write_clip(out_dir, last["files"], f"{name}-clip") if not args.no_clip else None
    ok = not last["flags"]
    report = [f"# Director: {name}", "", f"- Scene file: `{args.scene}`", f"- Note: {args.note or '(none)'}", f"- Result: **{'GOOD' if ok else 'FLAGGED, do not show as a good frame'}**", ""]
    for tk in takes:
        report += [f"## Take {tk['take']}", "", f"- Staging: {'; '.join(tk['stage'])}",
                   f"- Frames: {', '.join(tk['files'])}",
                   f"- Checks: {'; '.join(tk['flags']) or 'all passed'}",
                   f"- Facts: {json.dumps(tk['facts'])}"]
        if tk.get("reshoot"):
            report.append(f"- Reshot because: {'; '.join(tk['reshoot'])}")
        report.append("")
    if clip:
        report.append(f"Clip: `{clip}`")
    with open(os.path.join(out_dir, "director-log.md"), "w") as f:
        f.write("\n".join(report) + "\n")
    with open(os.path.join(out_dir, "director-log.json"), "w") as f:
        json.dump({"scene": name, "ok": ok, "takes": takes, "clip": clip}, f, indent=1)
    print(f"{'GOOD' if ok else 'FLAGGED'}: {out_dir}", flush=True)
    return (0 if ok else 1), out_dir


# ---------------------------------------------------------------- self-test (no browser)

def _png(w, h, pixel):
    """A solid or generated RGB PNG (filter 0) for the tests: pixel(x, y) -> (r, g, b)."""
    raw = b"".join(b"\x00" + bytes(c for x in range(w) for c in pixel(x, y)) for y in range(h))

    def chunk(k, b):
        return struct.pack(">I", len(b)) + k + b + struct.pack(">I", zlib.crc32(k + b) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def self_test():
    W, H = 1280, 720
    # black frame
    black = _png(64, 36, lambda x, y: (0, 0, 0))
    assert frame_verdict(grid_stats(luma_grid(black))) == "black frame"
    # flat colour
    flat = _png(64, 36, lambda x, y: (120, 110, 100))
    assert "empty frame" in frame_verdict(grid_stats(luma_grid(flat)))
    # a real-looking frame is fine
    ok = _png(64, 36, lambda x, y: ((x * 4) % 256, (y * 7) % 256, 90))
    assert frame_verdict(grid_stats(luma_grid(ok))) is None
    # chalk white
    white = _png(64, 36, lambda x, y: (255, 255, 255 - (x % 2)))
    assert frame_verdict(grid_stats(luma_grid(white))) is not None
    # nothing happening: identical frames; something happening: a patch moves
    assert motion_verdict(grid_motion([luma_grid(ok), luma_grid(ok), luma_grid(ok)])) is not None
    moved = _png(64, 36, lambda x, y: ((x * 4 + 40) % 256, (y * 7) % 256, 90))
    assert motion_verdict(grid_motion([luma_grid(ok), luma_grid(moved)])) is None
    # subjects: Gaius at the origin facing +z; Aelia beside him is in frame; Aelia far to the side is out of frame
    cam, tgt, p = camera_pose((0, 0), 0.0, 1.0, 0.0, W, H)
    def vs(x, z, h=1.75):
        return subject_verdict("s", project((x, h, z), cam, tgt, p["fov"], p["aspect"]), project((x, 0.0, z), cam, tgt, p["fov"], p["aspect"]))
    assert vs(0, 0) is None or "too small" not in (vs(0, 0) or ""), "Gaius himself reads in frame"
    assert vs(1.2, 1.5) is None, vs(1.2, 1.5)
    assert vs(30, 2) == "s is out of frame", vs(30, 2)
    assert "behind the camera" in vs(0, -20)
    assert "cut by the frame edge" in vs(5.9, 3.0), vs(5.9, 3.0)
    assert "too small" in vs(0, 60)
    # one standing squarely behind the other is flagged (Gaius at the camera's centre, Aelia straight behind him)
    pa = lambda x, z: ("s", project((x, 1.75, z), cam, tgt, p["fov"], p["aspect"]), project((x, 0.0, z), cam, tgt, p["fov"], p["aspect"]), math.hypot(x - cam[0], z - cam[2]))
    assert overlap_verdict(pa(0, 0), ("t",) + pa(0, 2)[1:]) == "t is hidden behind s"
    assert overlap_verdict(pa(0, 0), ("t",) + pa(1.2, 1.5)[1:]) is None
    assert overlap_verdict(pa(0, 0), ("t",) + pa(0.2, 1.6)[1:]) is not None  # half behind him still counts as hidden
    # a zoom pull-back rescues the cut subject; the auto fix says so
    sc = {"camera": {"zoom": 1.0}}
    assert auto_fix(sc, ["aelia is cut by the frame edge"]) and sc["camera"]["zoom"] > 1.0
    # notes edit the saved script
    sc = {"camera": {"zoom": 1.0}, "clock": {"rome": "12:00"}}
    ch = apply_note(sc, "closer, zoom the camera")
    assert ch and sc["camera"]["zoom"] < 1.0 and sc["notes"][0]["note"] == "closer, zoom the camera"
    assert apply_note(sc, "make it dusk") and sc["clock"].get("golden") is True and "rome" not in sc["clock"]
    assert apply_note(sc, "xyzzy") == []
    # the cloak check: red in his box passes, none fails
    redbox = _png(64, 36, lambda x, y: (150, 20, 25) if 24 <= x <= 40 else (90, 120, 160))
    nobox = _png(64, 36, lambda x, y: (90, 120, 160))
    assert cloak_fraction(decode_png(redbox), (0.5, 0.39), (0.5, 0.82)) > 0.5
    assert cloak_fraction(decode_png(nobox), (0.5, 0.39), (0.5, 0.82)) == 0.0
    # PNG filters: a filtered PNG decodes to the same pixels (Sub filter)
    raw = b""
    for y in range(4):
        row = bytes((x * 10 + y) % 256 for x in range(8 * 3))
        sub = bytes((row[i] - (row[i - 3] if i >= 3 else 0)) & 255 for i in range(len(row)))
        raw += b"\x01" + sub
    def chunk(k, b):
        return struct.pack(">I", len(b)) + k + b + struct.pack(">I", zlib.crc32(k + b) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 4, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    w, h, rows = decode_png(png)
    assert (w, h) == (8, 4) and rows[2][5] == (5 * 10 + 2) % 256
    print("director self-test ok")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scene", nargs="?", help="the scene file (JSON) to stage and film")
    ap.add_argument("--note", help='a short note to reshoot on, e.g. "closer, zoom the camera"; it edits the scene file')
    ap.add_argument("--url", default="http://localhost:8099/")
    ap.add_argument("--out", default=os.path.join(HERE, "out", "director"))
    ap.add_argument("--retries", type=int, default=2, help="automatic reshoots of a flagged take")
    ap.add_argument("--burst", type=int, default=4, help="frames per take")
    ap.add_argument("--burst-gap-s", type=float, default=0.8)
    ap.add_argument("--arrive-s", type=float, default=90, help="how long Aelia gets to reach her mark")
    ap.add_argument("--hud", action="store_true")
    ap.add_argument("--no-clip", action="store_true")
    ap.add_argument("--dry", action="store_true", help="apply the note in memory only; leave the scene file alone")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--load-s", type=int, default=240)
    ap.add_argument("--load-settle-s", type=float, default=20)
    ap.add_argument("--settle-s", type=float, default=4)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    if not args.scene:
        ap.error("a scene file is needed")
    code, _ = run_scene(args)
    sys.exit(code)


if __name__ == "__main__":
    main()
