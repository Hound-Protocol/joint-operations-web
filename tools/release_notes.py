#!/usr/bin/env python3
"""Print what the release workflow needs for the current website version.

The website and the mod have separate version lines (HP-SOP-003):
- the website: "Site X.Y.Z", from site/data/config.json "version", tags site-vX.Y.Z, sections
  "## Site X.Y.Z · Name · YYYY-MM-DD" in CHANGELOG.md. Website releases are never marked Latest on GitHub.
- the mod: v0.1, v0.2 ... from its first playable build, with its own changelog (not handled here yet).
Older website releases kept their 0.0.x tags (v0.0.1 to v0.0.41).

Writes the notes to the given file and prints three lines: tag, title, and "site".

Usage: python3 tools/release_notes.py NOTES_FILE
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((root / "site/data/config.json").read_text(encoding="utf-8"))
version = cfg["version"]
log = (root / "CHANGELOG.md").read_text(encoding="utf-8")
m = re.search(rf"^## Site {re.escape(version)} · (.+?)(?: · \d{{4}}-\d{{2}}-\d{{2}})?$\n(.*?)(?=^## |\Z)", log, re.M | re.S)
if not m:
    sys.exit(f"CHANGELOG.md has no section for Site {version}. Add one (see docs/guides/HP-SOP-003-release.md).")
name, notes = m.group(1).strip(), m.group(2).strip()
notes += f"\n\nWebsite: {cfg.get('siteUrl', '')} · Full changelog: CHANGELOG.md"
pathlib.Path(sys.argv[1]).write_text(notes + "\n", encoding="utf-8")
print(f"site-v{version}")
print(f"Site {version} · {name}")
print("site")
