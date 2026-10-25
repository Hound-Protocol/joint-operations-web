# Licensing

The Joint Operations website uses the same three licenses as the mod, one for each kind of material ([ADR 0005](https://github.com/Hound-Protocol/Joint-Operations/blob/main/docs/decisions/0005-license.md)). This is a summary, not legal advice. The license texts decide.

| What | License | Files |
|---|---|---|
| **Code**: the mod, launcher, tools, website code and tests | **GNU GPL-3.0-only**, with the additional permission below | [LICENSE](LICENSE), [LICENSES/GPL-3.0-only.txt](LICENSES/GPL-3.0-only.txt) |
| **Documentation and text**: docs, research, handbook, website text | **CC BY-SA 4.0** | [LICENSES/CC-BY-SA-4.0.txt](LICENSES/CC-BY-SA-4.0.txt) |
| **Brand**: the Hound Protocol and Joint Operations names, logos, emblem and avatars | **All rights reserved** | `site/assets/brand/`, `site/assets/img/` |

Copyright (C) 2026 Hound Protocol and contributors.

## What this means
- **You may fork, change and share** the code and the docs, also commercially, as long as you keep the copyright notices, credit Hound Protocol, and release your changes under the same license.
- **Nobody may present this work as their own.** Notices and credits must stay.
- **Forks stay open.** Anyone who distributes a changed version must publish its source under the same terms.
- **The brand is not part of the open license.** Forks must use their own name and logos, so players can tell them apart. You may use our names and logos to refer to this project, unchanged.
- Fonts and other third-party parts keep their own licenses (for example the SIL Open Font License for the site fonts, see `site/assets/fonts/`).

## Additional permission under GNU GPL version 3 section 7
If you modify this Program, or any covered work, by linking or combining it with the Steamworks SDK from Valve Corporation, or with Metal Gear Solid V: The Phantom Pain and its components from Konami Digital Entertainment (or modified versions of those), containing parts covered by the terms of their respective licenses, the licensors of this Program grant you additional permission to convey the resulting work. Corresponding Source for a non-source form of such a combination shall not include the source code for the parts of the Steamworks SDK or of the game used, as well as that of the covered work.

This permission exists because the mod has to run inside the game and talk to Steam. It does not allow distributing any game files, which is never permitted ([HP-POL-003](https://github.com/Hound-Protocol/Joint-Operations/blob/main/docs/guides/HP-POL-003-clean-room-and-ip.md)).

## Contributions
Every commit is signed off (`git commit -s`). Your sign-off certifies that you wrote the work or have the right to submit it, and that you license it under these terms: code under GPL-3.0-only with the permission above, text under CC BY-SA 4.0.
