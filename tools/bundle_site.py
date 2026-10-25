#!/usr/bin/env python3
"""Build a single self-contained HTML file of the site (works opened from disk).

Usage: python3 tools/bundle_site.py [output.html]
"""
import base64, json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
site = root / "site"
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / "hound-protocol.html")

def safe(text):
    return text.replace("</", "<\\/")

data = {n: json.loads((site / "data" / f"{n}.json").read_text()) for n in ["config", "servers", "mods", "docs", "contracts", "briefing", "team", "records", "records-key", "guides", "staff", "certificates"]}
import subprocess
def _git(*a):
    return subprocess.run(["git", *a], cwd=root, capture_output=True, text=True).stdout.strip()
try:
    data["build"] = {"build": int(_git("rev-list", "--count", "HEAD")), "sha": _git("rev-parse", "HEAD"), "date": _git("log", "-1", "--format=%cI")}
except ValueError:
    pass
data["content"] = {}
for d in data["docs"]["docs"] + [{"path": "ROADMAP.md"}]:
    f = root / "mod-content" / d["path"]
    if not f.exists():
        f = root / d["path"]
    if f.exists():
        data["content"][d["path"]] = f.read_text()

def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()

import subprocess as _sp
_sp.run([sys.executable, str(root / "tools" / "build_js.py")], check=True)
html = (site / "index.html").read_text()
for m in data["team"].get("members", []):
    for key, mime in (("image", "image/webp"), ("still", "image/jpeg")):
        if m.get(key):
            m[key] = data_uri(site / m[key], mime)
html = re.sub(r'<link rel="preload"[^>]*>\n', "", html)  # fonts are inlined below
# The single-file copy inlines its scripts, which the site's Content Security Policy forbids: drop the policy here
html = re.sub(r'<!-- Content Security Policy[^>]*-->\n<meta http-equiv="Content-Security-Policy"[^>]*>\n', "", html)
html = html.replace('<script src="assets/js/legacy.js"></script>', "<script>\n" + (site / "assets/js/legacy.js").read_text() + "</script>")
for name in ["favicon.svg"]:
    html = html.replace(f"assets/img/{name}", data_uri(site / "assets/img" / name, "image/svg+xml"))
html = html.replace("assets/brand/joint-operations-mark.svg", data_uri(site / "assets/brand/joint-operations-salute.svg", "image/svg+xml"))
css = (site / "assets/css/main.css").read_text()
js = (site / "assets/js/app.js").read_text()
for name in ["joint-operations-mark.svg", "hound-protocol-mark-light.svg"]:
    js = js.replace("assets/brand/" + name, data_uri(site / "assets/brand" / name, "image/svg+xml"))
css = re.sub(r'url\("\.\./fonts/([^"]+)"\)', lambda m: 'url("' + data_uri(site / "assets/fonts" / m.group(1), "font/woff") + '")', css)
html = html.replace('<link rel="stylesheet" href="assets/css/main.css">', "<style>\n" + css + "\n</style>")
html = html.replace('<script src="assets/js/app.js"></script>',
                    "<script>window.JO_EMBED = " + safe(json.dumps(data)) + ";</script>\n<script>\n" + safe(js) + "\n</script>")
out.write_text(html)
print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")
