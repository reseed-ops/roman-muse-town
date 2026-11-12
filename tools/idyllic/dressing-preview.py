# usage: python3 dressing-preview.py <repo> <outdir> [view ...]
# Builds tools/idyllic/dressing-preview.ts, serves it with the real slimmed GLBs and screenshots each view.
import subprocess, sys, os, shutil, threading, http.server, functools
from playwright.sync_api import sync_playwright
repo, out = (os.path.abspath(a) for a in sys.argv[1:3])
views = sys.argv[3:] or ["temple", "forum", "garden", "market"]
os.makedirs(out, exist_ok=True)
subprocess.check_call([os.path.expanduser("~/.local/bin/bun"), "build", os.path.join(repo, "tools/idyllic/dressing-preview.ts"), "--target=browser", "--outfile", os.path.join(out, "preview.js")], cwd=repo)
A = os.path.join(out, "assets"); os.makedirs(A, exist_ok=True)
for d in ("statuary", "market"):
    shutil.copytree(os.path.join(repo, "client/src/assets", d), A, dirs_exist_ok=True)
shutil.copy(os.path.join(repo, "client/src/assets/centurion.vrm"), A)
for n in ("booth_a", "booth_b", "booth_c", "crate"):
    shutil.copy(os.path.join(repo, f"client/src/assets/roman/{n}.glb"), A)
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
        v, _, w = view.partition("+")
        pg.goto(f"http://127.0.0.1:{port}/index.html?view={v}" + (f"&walker={w}" if w else ""))
        pg.wait_for_function("window.__done === true", timeout=120000)
        pg.screenshot(path=os.path.join(out, f"{view.replace('+', '_')}.png")); print("SHOT", view)
    b.close()
