#!/usr/bin/env python3
"""Smoke-test the assembled site in real browser engines.

Usage: python3 tests/browser_smoke.py SITE_DIR [chromium firefox webkit]
Checks every section at desktop and phone sizes: no script errors, no
horizontal overflow, headings render, and key features work.
"""
import asyncio, functools, http.server, sys, threading
from playwright.async_api import async_playwright

site = sys.argv[1]
engines = sys.argv[2:] or ["chromium", "firefox", "webkit"]
VIEWS = ["briefing", "roadmap", "download", "sessions", "contribute", "team", "mods", "guides", "guides/hp-pol-002", "verify", "docs/architecture", "options"]

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


handler = functools.partial(Quiet, directory=site)
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{server.server_address[1]}/"


RELAY = "https://hp-signin.trueman-truetown.workers.dev/**"
NO_KV = lambda r: r.fulfill(status=503, body='{"error":"test","code":"no_kv"}', content_type="application/json", headers={"Access-Control-Allow-Origin": "*"})


async def check(browser, name, size):
    failures = []
    # LV1 (not signed in): the welcome window; every section readable; acting (claiming) asks for LV2
    gate = await browser.new_page(viewport=size)
    await gate.route(RELAY, lambda r: r.fulfill(status=200, body='{"claims":{}}', content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}) if "/claims" in r.request.url else NO_KV(r))
    await gate.goto(BASE + "#/contribute"); await gate.wait_for_timeout(2200)
    if await gate.locator("#gate").count():
        failures.append("gate: Contribute should be readable at LV1")
    if not await gate.locator("#hpModal.hm-gate").count():
        failures.append("gate: welcome window missing at LV1")
    await gate.keyboard.press("Escape"); await gate.wait_for_timeout(400)
    if not await gate.locator("[data-claim-in]").count():
        failures.append("gate: LV1 should see 'Sign in to claim' on contract cards")
    await gate.goto(BASE + "#/roadmap"); await gate.wait_for_timeout(700)
    if await gate.locator("#gate").count():
        failures.append("gate: Roadmap should be open at LV1")
    await gate.goto(BASE + "#/profile"); await gate.wait_for_timeout(900)
    if not await gate.locator("#vb .hk").count() or not await gate.locator("#siGo, .si-intro .note").count():
        failures.append("profile: signed-out view missing")
    await gate.close()
    # Everything else as a signed-in member (LV2), with the GitHub API answered locally
    page = await browser.new_page(viewport=size)
    await page.add_init_script("try{localStorage.setItem('hp.verified','1');sessionStorage.setItem('hp.signin',JSON.stringify({token:'test',exp:Date.now()+3600e3,user:{id:1,login:'tester',name:'Tester',avatar:''},org:{at:Date.now(),role:''}}))}catch(e){}")
    await page.route("https://api.github.com/user**", lambda r: r.fulfill(status=404, body="{}", content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}))
    # Never call the live sign-in relay from tests: answer as a relay without storage would, with CORS headers
    await page.route("https://hp-signin.trueman-truetown.workers.dev/**", lambda r: r.fulfill(status=503, body='{"error":"test","code":"no_kv"}', content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}))
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(BASE)
    await page.wait_for_timeout(1200)
    if await page.locator("#menu a").count() != 7:
        failures.append("menu does not have 7 items")
    widths = {}
    for v in VIEWS:
        await page.goto(BASE + "#/" + v)
        await page.wait_for_timeout(900)
        widths[v] = await page.evaluate("Math.round(document.getElementById('view').getBoundingClientRect().width)")
        if not await page.locator(".vh h2").count():
            failures.append(f"{v}: no heading")
        if await page.evaluate("document.documentElement.scrollWidth > innerWidth + 1"):
            failures.append(f"{v}: horizontal overflow")
    if len(set(widths.values())) > 1:
        failures.append("layout stability: sections have different widths " + str(widths))
    await page.goto(BASE + "#/briefing"); await page.wait_for_timeout(900)
    if await page.locator(".ab-tri .tri-top").count() != 1 or await page.locator(".ab-tri .tri-row .tri-b").count() != 3:
        failures.append("briefing: Start here buttons missing (one on top, three beneath)")
    await page.goto(BASE + "#/team"); await page.wait_for_timeout(900)
    if await page.locator(".chain .tier").count() < 6:
        failures.append("team: chain of command missing")
    await page.goto(BASE + "#/contribute"); await page.wait_for_timeout(900)
    await page.click('[data-tab="ranks"]'); await page.wait_for_timeout(300)
    if await page.locator(".ranks .rank").count() != 10:
        failures.append("contribute: expected 10 grades, E to S++")
    await page.goto(BASE + "#/devlog"); await page.wait_for_timeout(1200)
    if "#/docs/devlog" not in page.url or await page.locator("#docBody[data-id=devlog]").count() != 1:
        failures.append("devlog: old link does not open the Dev Log document")
    await page.goto(BASE + "#/profile"); await page.wait_for_timeout(900)
    if not await page.locator("#vb .hk").count() or not await page.locator("#siOut").count():
        failures.append("profile: signed-in view missing")
    await page.goto(BASE + "#/verify"); await page.wait_for_timeout(900)
    if not await page.locator(".hks .hk").count() or not await page.locator("#kcCh").inner_text():
        failures.append("verify: keycards or Hound ID challenge missing")
    await page.goto(BASE + "#/roadmap"); await page.wait_for_timeout(900)
    if await page.locator(".mb-mod").count() < 3:
        failures.append("roadmap: base platforms missing")
    else:
        await page.dispatch_event('.mb-mod[data-i="1"]', "click"); await page.wait_for_timeout(300)
        if "Phase 1" not in await page.inner_text("#mbPanel"):
            failures.append("roadmap: clicking a platform did not open its progress")
    await page.goto(BASE + "#/docs/plan"); await page.wait_for_timeout(1500)
    view = await page.evaluate("JO.docsView()")
    if view["mode"] != "cabinet" or view["open"] != "plan" or view["drawers"] < 3:
        failures.append("docs: cabinet did not open the plan file")
    if len(await page.inner_text("#docBody")) < 200:
        failures.append("docs: case file is empty")
    await page.fill("#cq", "adr 12"); await page.wait_for_timeout(1800)
    first = await page.locator("#cabDrawers .fold").first.get_attribute("data-id") if await page.locator("#cabDrawers .fold").count() else ""
    if first != "adr-0012":
        failures.append("docs: search by file number did not put ADR-0012 first")
    await page.click('#cabSm [data-sm="text"]')
    await page.fill("#cq", "keycard signing"); await page.wait_for_timeout(1500)
    if not await page.locator("#cabDrawers .fold.hit").count():
        failures.append("docs: full-text search found no folder")
    await page.press("#cq", "Enter"); await page.wait_for_timeout(1500)
    if not page.url.split("#")[1].startswith("/docs/"):
        failures.append("docs: a search result left the Library")
    if not await page.locator("#vb mark.hl").count():
        failures.append("docs: opening a result did not highlight the match")
    await page.fill("#cq", ""); await page.wait_for_timeout(300)
    await page.click('.dr-head[data-g="Research"]'); await page.wait_for_timeout(200)
    await page.click('.dr-head[data-g="Legal"]'); await page.wait_for_timeout(200)
    if await page.locator("#cabDrawers .drawer.open").count() != 1:
        failures.append("docs: opening a drawer did not close the others")
    if "ACCESS GRANTED" not in (await page.inner_text("#docBody")).upper():
        failures.append("docs: clearance line missing above a public document")
    await page.goto(BASE + "#/docs/r1-restricted"); await page.wait_for_timeout(1500)
    if not await page.locator("#docBody .ad-box").count() or "LV5" not in await page.inner_text("#docBody .ad-box"):
        failures.append("docs: a restricted area did not show access denied with its level")
    await page.goto(BASE + "#/guides"); await page.wait_for_timeout(1200)
    await page.fill("#hq", "linux"); await page.wait_for_timeout(1500)
    codes = await page.locator("#hbList .mini .m-top b").all_inner_texts()
    if "HP-GDE-002" not in codes or len(codes) > 20:
        failures.append("handbook: filter did not narrow to the Proton guide")
    await page.fill("#hq", "")
    await page.goto(BASE + "#/options"); await page.wait_for_timeout(500)
    await page.click('[data-opt="grid"]')
    if "no-grid" not in (await page.evaluate("document.body.className")):
        failures.append("options: toggle did not apply")
    await page.click('[data-preset="light"]')
    if "no-motion" not in (await page.evaluate("document.body.className")):
        failures.append("options: performance preset did not apply")
    await page.click('[data-preset="full"]')
    if errors:
        failures.append("script errors: " + "; ".join(errors))
    await page.close()
    # Old browsers: without CSS variables support the plain fallback page shows instead of the app
    old_page = await browser.new_page(viewport=size)
    await old_page.add_init_script("window.CSS = undefined;")
    await old_page.goto(BASE); await old_page.wait_for_timeout(600)
    if not await old_page.locator("#legacy").is_visible():
        failures.append("legacy: fallback page not shown")
    await old_page.close()
    return failures


async def main():
    total = 0
    async with async_playwright() as p:
        for engine in engines:
            browser = await getattr(p, engine).launch()
            for label, size in [("desktop", {"width": 1440, "height": 900}), ("phone", {"width": 390, "height": 844})]:
                fails = await check(browser, engine, size)
                total += len(fails)
                print(f"{engine:9} {label:8} {'PASS' if not fails else 'FAIL'}")
                for f in fails:
                    print("    - " + f)
            await browser.close()
    sys.exit(1 if total else 0)

asyncio.run(main())
