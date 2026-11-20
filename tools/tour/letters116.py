#!/usr/bin/env python3
"""Task 116: the Letters list and the first letter, landscape and portrait.
    ~/work/playwright-syslibs/playwright-env.sh python3 tools/tour/letters116.py --url http://localhost:8099/ --out DIR --prefix before-
Needs a town holding the old placeholder letter (see tools/idyllic/serve-local-old-letter.ts, serve-local plus a seeded "[DATE] " letter). Dev only."""
import argparse, os
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument("--url", required=True); ap.add_argument("--out", required=True); ap.add_argument("--prefix", default="")
a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(channel="chromium-headless-shell", args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    for name, vp in (("landscape", {"width": 1280, "height": 720}), ("portrait", {"width": 390, "height": 844})):
        page = b.new_page(viewport=vp)
        page.goto(a.url, timeout=180000)
        page.get_by_role("button", name="☰").first.wait_for(timeout=240000) if False else None
        page.wait_for_selector("text=☰", timeout=240000)
        page.wait_for_timeout(5000)
        page.locator("button:has-text('☰')").first.click()
        page.get_by_role("button", name="Check the letters desk").click(timeout=60000)
        page.wait_for_selector("text=First letter", timeout=60000)
        page.wait_for_timeout(1500)
        list_text = page.locator("section[aria-label='Letters at the desk']").inner_text()
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}{name}-letters-list.png")); print(name, "LIST:", repr(list_text), flush=True)
        page.locator("section[aria-label='Letters at the desk'] button:has-text('First letter')").click()
        page.wait_for_selector("text=Yours", timeout=60000); page.wait_for_timeout(1000)
        head = page.locator("section[aria-label='Letters at the desk'] article p").first.inner_text()
        page.screenshot(path=os.path.join(a.out, f"{a.prefix}{name}-letter.png")); print(name, "HEADER:", repr(head), flush=True)
        page.close()
    b.close()
