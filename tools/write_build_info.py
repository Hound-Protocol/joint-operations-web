#!/usr/bin/env python3
"""Write the site's build number: the commit count of the repository, plus the commit and date.

Usage: python3 tools/write_build_info.py OUTPUT.json
"""
import json, subprocess, sys

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout.strip()

info = {"build": int(git("rev-list", "--count", "HEAD")), "sha": git("rev-parse", "HEAD"), "date": git("log", "-1", "--format=%cI")}
with open(sys.argv[1], "w") as f:
    json.dump(info, f)
print(f"Build {info['build']} ({info['sha'][:7]})")
