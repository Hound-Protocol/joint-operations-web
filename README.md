# Joint Operations website

The website of **MGSV: Joint Operations**, the multiplayer mod by Hound Protocol.

Live at https://hound-protocol.github.io/joint-operations-web/

## Two repositories
| Repository | Holds |
| --- | --- |
| **joint-operations-web** (this one) | The site code (`site/`), its build tools (`tools/`), tests (`tests/`), the website changelog and its workflows |
| [Joint-Operations](https://github.com/Hound-Protocol/Joint-Operations) | The mod, the documents (`docs/`, `research/`), the handbook, and the project records in `data/` (contracts, contributor records, certificates, infractions, staff, library and handbook indexes) |

The site reads the documents and records from the mod repository. `tools/sync_mod.py` copies them in for a build; nothing synced is committed here.

## Build and preview
```
git clone https://github.com/Hound-Protocol/Joint-Operations ../Joint-Operations
python3 tools/sync_mod.py ../Joint-Operations
python3 tools/assemble_site.py _site
python3 -m http.server 8000 --directory _site
```
Then open http://localhost:8000.

## Change the site
- Edit the modules in `site/src/js/`, then run `python3 tools/build_js.py`. Commit both the modules and `site/assets/js/app.js`.
- After style changes, run `python3 tools/css_compat.py`.
- Test: `python3 tests/browser_smoke.py _site` (Chromium, Firefox and WebKit at desktop and phone sizes).
- Full guide: [HP-GDE-012 Website Maintainer Guide](https://github.com/Hound-Protocol/Joint-Operations/blob/main/docs/guides/HP-GDE-012-website-maintainers.md).

## Deploys and releases
- Every push to `main` deploys the site to GitHub Pages. Document changes in the mod repository go live with the next scheduled build (every three hours) or a manual run of **Deploy site**.
- A website release is published when `"version"` in `site/data/config.json` changes, with notes from `CHANGELOG.md` ([HP-SOP-003](https://github.com/Hound-Protocol/Joint-Operations/blob/main/docs/guides/HP-SOP-003-release.md)).
- The release announcement on Discord needs the `DISCORD_RELEASE_WEBHOOK` secret in this repository.

## License
Site code is **GPL-3.0-only**, text **CC BY-SA 4.0**, the Hound Protocol and Joint Operations names and logos are reserved. Details: [LICENSING.md](LICENSING.md). Fonts: SIL Open Font License (`site/assets/fonts/`).
