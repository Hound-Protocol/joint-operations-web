#!/usr/bin/env python3
"""Build site/assets/js/app.js from the module sources in site/src/js/.

The sources are fragments of one script: they share a single scope, so they
are concatenated in file-name order inside one function wrapper.
Usage: python3 tools/build_js.py [--check]
"""
import pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "site" / "src" / "js"
out = root / "site" / "assets" / "js" / "app.js"

parts = sorted(p for p in src.glob("*.js") if not p.name.startswith("_"))
body = "\n".join(p.read_text().rstrip() + "\n" for p in parts)
text = (src / "_header.js").read_text() + "(function () {\n  \"use strict\";\n\n" + body + "})();\n"

if "--check" in sys.argv:
    if not out.exists() or out.read_text() != text:
        print("site/assets/js/app.js is out of date. Run: python3 tools/build_js.py")
        sys.exit(1)
    print("app.js is up to date.")
else:
    out.write_text(text)
    print(f"Wrote {out.relative_to(root)} from {len(parts)} modules")
