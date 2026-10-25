#!/usr/bin/env python3
"""Screenshots of key screens, for review on every pull request (Checks → Browsers → artifact "screens").

Takes the same screens on every run, desktop and phone, with the relay and GitHub answered locally, so two runs can
be compared by eye (and later by pixel diff, once a baseline from CI exists). Motion is off so frames are stable.

Usage: python3 tests/screens.py SITE_DIR OUT_DIR
"""
import functools, http.server, pathlib, sys, threading
from playwright.sync_api import sync_playwright

site, out = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(site)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}/"
SCREENS = [("home", "", False), ("about", "#/briefing", False), ("gate-lv1", "#/contribute", False), ("handbook", "#/guides", True),
           ("sheet", "#/guides/hp-gde-020", True), ("library", "#/docs/overview", True), ("profile-lv7", "#/profile", True), ("roadmap", "#/roadmap", True)]
MEMBER = ("localStorage.setItem('hp.verified','1');sessionStorage.setItem('hp.signin',JSON.stringify({token:'t',exp:Date.now()+3600e3,"
          "user:{id:249122176,login:'Forge77',name:'TrueMan',avatar:''},org:{at:Date.now(),role:'admin',done:true}}));")
with sync_playwright() as p:
    b = p.chromium.launch()
    for size, vp in (("desktop", {"width": 1366, "height": 900}), ("phone", {"width": 390, "height": 844})):
        for name, route, signed in SCREENS:
            pg = b.new_page(viewport=vp, reduced_motion="reduce")
            pg.add_init_script("try{" + (MEMBER if signed else "") + "}catch(e){}")
            pg.route("https://hp-signin.trueman-truetown.workers.dev/**", lambda r: r.fulfill(status=200, body='{"ok":true,"relay":3,"kv":true,"asks":[],"passes":[]}', content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}))
            pg.route("https://api.github.com/**", lambda r: r.fulfill(status=200, body="[]", content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}))
            pg.goto(BASE + route); pg.wait_for_timeout(1800)
            pg.screenshot(path=str(out / f"{size}-{name}.png"))
            pg.close()
    b.close()
print(f"Wrote {len(list(out.glob('*.png')))} screenshots to {out}")
