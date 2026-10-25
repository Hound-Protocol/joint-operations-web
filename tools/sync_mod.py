#!/usr/bin/env python3
"""Bring the mod repository's documents and records into this website repository.

The website (this repository) holds the site code. The mod repository
(Hound-Protocol/Joint-Operations) holds the documents, research and the
project records: contracts, contributor records, certificates, infractions,
staff, and the library and handbook indexes.

This script copies them into place for the site tools:
  - README.md, ROADMAP.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md,
    LICENSING.md, docs/ and research/  ->  mod-content/
  - data/*.json                         ->  site/data/

Both destinations are listed in .gitignore, so nothing synced is committed here.
Usage: python3 tools/sync_mod.py [PATH_TO_JOINT_OPERATIONS]   (default: ../Joint-Operations)
"""
import pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MOD = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ROOT.parent / "Joint-Operations").resolve()

FILES = ["README.md", "ROADMAP.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "LICENSING.md"]
FOLDERS = ["docs", "research"]
DATA = ["contracts", "records", "records-key", "certificates", "infractions", "staff", "docs", "guides"]

if not (MOD / "docs").is_dir():
    sys.exit(f"Mod repository not found at {MOD}. Pass its path: python3 tools/sync_mod.py PATH")

mod_root = ROOT / "mod-content"
if mod_root.exists():
    shutil.rmtree(mod_root)
mod_root.mkdir()
for name in FILES:
    if (MOD / name).exists():
        shutil.copy(MOD / name, mod_root / name)
for folder in FOLDERS:
    shutil.copytree(MOD / folder, mod_root / folder)

for name in DATA:
    shutil.copy(MOD / "data" / f"{name}.json", ROOT / "site" / "data" / f"{name}.json")

print(f"Synced documents and records from {MOD}")
