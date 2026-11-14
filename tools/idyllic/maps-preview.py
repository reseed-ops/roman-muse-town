# usage: python3 maps-preview.py <repo> <outdir> <oldglb> <newglb> <name> [key=value ...]
# Builds maps-preview.ts, serves the two GLBs and screenshots them side by side, day and night.
# Query keys are those of maps-preview.ts (look=, dist=, az=, el=, fov=, scale=, gap=).
import subprocess, sys, os, shutil, threading, http.server, functools
from playwright.sync_api import sync_playwright
repo, out, old, new, name = (os.path.abspath(a) if i < 4 else a for i, a in enumerate(sys.argv[1:6]))
extra = "&".join(sys.argv[6:])
os.makedirs(out, exist_ok=True)
subprocess.check_call([os.path.expanduser("~/.local/bin/bun"), "build", os.path.join(repo, "tools/idyllic/maps-preview.ts"), "--target=browser", "--outfile", os.path.join(out, "preview.js")], cwd=repo)
shutil.copy(old, os.path.join(out, "old.glb")); shutil.copy(new, os.path.join(out, "new.glb"))
open(os.path.join(out, "index.html"), "w").write('<!doctype html><body style="margin:0"><script type="module" src="preview.js"></script>')
h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=out)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for mode in ("day", "night"):
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.on("pageerror", lambda e: print("pageerror:", e))
        pg.goto(f"http://127.0.0.1:{port}/index.html?old=old.glb&new=new.glb&mode={mode}&{extra}")
        pg.wait_for_function("window.__done === true", timeout=120000)
        pg.screenshot(path=os.path.join(out, f"{name}-{mode}.png")); print("SHOT", name, mode)
    b.close()
