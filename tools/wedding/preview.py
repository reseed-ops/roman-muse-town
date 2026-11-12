# usage: python3 preview.py <repo> <outdir>
# Builds tools/wedding/preview.ts, serves it with the real wedding GLBs and screenshots two stages.
import subprocess, sys, os, shutil, threading, http.server, functools
from playwright.sync_api import sync_playwright
repo, out = (os.path.abspath(a) for a in sys.argv[1:3])
os.makedirs(out, exist_ok=True)
subprocess.check_call([os.path.expanduser("~/.local/bin/bun"), "build", os.path.join(repo, "tools/wedding/preview.ts"), "--target=browser", "--outfile", os.path.join(out, "preview.js")], cwd=repo)
shutil.copytree(os.path.join(repo, "client/src/assets/wedding"), os.path.join(out, "assets"), dirs_exist_ok=True)
open(os.path.join(out, "index.html"), "w").write('<!doctype html><body style="margin:0"><script type="module" src="preview.js"></script>')
h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=out)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for stage, view in (("dressed", "avenue"), ("dressed", "close"), ("feast", "close")):
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.on("console", lambda m: print("console:", m.text))
        pg.goto(f"http://127.0.0.1:{port}/index.html?stage={stage}&view={view}")
        pg.wait_for_function("window.__done === true", timeout=60000)
        pg.screenshot(path=os.path.join(out, f"{stage}-{view}.png")); print("SHOT", stage, view)
    b.close()
