#!/usr/bin/env python3
"""Assemble the deployable site in one directory.

Run tools/sync_mod.py first: it brings the documents and records from the mod repository.
Steps: build app.js from modules, copy site/, write the build number, copy the
documents the library reads, pre-render static doc pages, and (with --woff2)
convert fonts to WOFF2.
Usage: python3 tools/assemble_site.py OUT_DIR [--woff2] [--url SITE_URL]
"""
import argparse, pathlib, shutil, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("--woff2", action="store_true")
ap.add_argument("--url", default="https://hound-protocol.github.io/joint-operations-web/")
args = ap.parse_args()
out = pathlib.Path(args.out).resolve()
py = sys.executable

def run(*cmd):
    subprocess.run([py, *cmd], cwd=root, check=True)

run("tools/build_js.py")
if out.exists():
    shutil.rmtree(out)
shutil.copytree(root / "site", out, ignore=shutil.ignore_patterns("src", "content"))
run("tools/write_build_info.py", str(out / "data" / "build.json"))
content = out / "content"
content.mkdir()
mod = root / "mod-content"
if not (mod / "docs").is_dir():
    sys.exit("Documents missing. Run first: python3 tools/sync_mod.py PATH_TO_JOINT_OPERATIONS")
for name in ["README.md", "ROADMAP.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "LICENSING.md"]:
    if (mod / name).exists():
        shutil.copy(mod / name, content / name)
shutil.copy(root / "CHANGELOG.md", content / "CHANGELOG.md")
for folder in ["docs", "research"]:
    shutil.copytree(mod / folder, content / folder)
run("tools/prerender_docs.py", str(out), args.url)
if args.woff2:
    run("tools/fonts_woff2.py", str(out))
print(f"Site assembled in {out}")
