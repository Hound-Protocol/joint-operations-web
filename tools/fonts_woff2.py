#!/usr/bin/env python3
"""Deploy step: convert the site's WOFF fonts to WOFF2 and point the CSS and preloads at them.

WOFF2 is about 40% smaller. The source keeps WOFF so the site and the single-file
build work without this step. Needs: pip install fonttools brotli
Usage: python3 tools/fonts_woff2.py SITE_DIR
"""
import pathlib, re, sys
from fontTools.ttLib import TTFont

site = pathlib.Path(sys.argv[1])
fonts = site / "assets" / "fonts"
for woff in fonts.glob("*.woff"):
    font = TTFont(str(woff))
    font.flavor = "woff2"
    font.save(str(woff.with_suffix(".woff2")))
    print(f"{woff.name}: {woff.stat().st_size} -> {woff.with_suffix('.woff2').stat().st_size} bytes")

css = site / "assets" / "css" / "main.css"
text = re.sub(r'url\("\.\./fonts/([^"]+)\.woff"\) format\("woff"\)',
              r'url("../fonts/\1.woff2") format("woff2"), url("../fonts/\1.woff") format("woff")', css.read_text())
css.write_text(text)
index = site / "index.html"
index.write_text(re.sub(r'href="(assets/fonts/[^"]+)\.woff" as="font" type="font/woff"', r'href="\1.woff2" as="font" type="font/woff2"', index.read_text()))
print("CSS and preloads now use WOFF2 with WOFF fallback")
