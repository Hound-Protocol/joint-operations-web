#!/usr/bin/env python3
"""Render every handbook document (docs/guides) to an A4 PDF for the website.

Each guide page has a "Download PDF" button, so nobody depends on the browser's
print dialog (which some setups, such as Flatpak browsers without a print portal,
do not open). The PDFs come from the same print layout as "Print".

Usage: python3 tools/guides_pdf.py SITE_DIR      (an assembled site, e.g. _site)
Writes SITE_DIR/guides/pdf/<CODE>.pdf. Needs Playwright with Chromium.
"""
import functools, http.server, json, pathlib, sys, threading

from playwright.sync_api import sync_playwright


def main():
    site = pathlib.Path(sys.argv[1]).resolve()
    guides = json.loads((site / "data/guides.json").read_text())["guides"]
    out = site / "guides/pdf"
    out.mkdir(parents=True, exist_ok=True)
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(site))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        for g in guides:
            page.goto(base + "#/guides/" + g["id"])
            page.wait_for_selector(".sheet .sh-body", timeout=20000)
            page.wait_for_timeout(300)
            page.pdf(path=str(out / (g["code"] + ".pdf")), format="A4", print_background=True, prefer_css_page_size=True)
            print("PDF", g["code"])
        browser.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
