# usage: python3 preview.py <repo> <outdir> [view ...]
# Builds tools/idyllic/preview.ts, serves it with the real slimmed GLBs and screenshots each view.
import subprocess, sys, os, shutil, threading, http.server, functools
from playwright.sync_api import sync_playwright
repo, out = (os.path.abspath(a) for a in sys.argv[1:3])
views = sys.argv[3:] or ["front", "overview", "stair", "north", "south", "east"]
os.makedirs(out, exist_ok=True)
subprocess.check_call([os.path.expanduser("~/.local/bin/bun"), "build", os.path.join(repo, "tools/idyllic/preview.ts"), "--target=browser", "--outfile", os.path.join(out, "preview.js")], cwd=repo)
shutil.copytree(os.path.join(repo, "client/src/assets/idyllic"), os.path.join(out, "assets"), dirs_exist_ok=True)
shutil.copy(os.path.join(repo, "client/src/assets/roman/banner.glb"), os.path.join(out, "assets/banner_town.glb"))
shutil.copy(os.path.join(repo, "client/src/assets/roman/palette.png"), os.path.join(out, "assets/palette.png"))
open(os.path.join(out, "index.html"), "w").write('<!doctype html><body style="margin:0"><script type="module" src="preview.js"></script>')
h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=out)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for view in views:
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.on("console", lambda m: print("console:", m.text))
        pg.on("pageerror", lambda e: print("pageerror:", e))
        pg.goto(f"http://127.0.0.1:{port}/index.html?view={view}&marker=1&compare={1 if view == "compare" else ""}")
        pg.wait_for_function("window.__done === true", timeout=120000)
        pg.screenshot(path=os.path.join(out, f"{view}.png")); print("SHOT", view)
    b.close()
