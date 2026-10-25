#!/usr/bin/env python3
"""Add fallbacks to the site CSS so older browsers still lay the page out.

Older browsers (for example Chrome before 79, Safari before 11.1, Firefox before 75)
drop any declaration that uses min(), max() or clamp(). Those that also lack the
`inset` shorthand (Chrome before 87, Safari before 14.1) lose every absolutely
positioned layer. This tool fixes both in the source file, in place:

  * `inset: ...` is rewritten as top / right / bottom / left, which every browser knows.
  * Every declaration that uses min(), max() or clamp(), or one of the frame
    variables built from them (--fw, --fh, --stage), gets a plain fallback
    declaration in front of it. Modern browsers use the second one.

Fallback values: min() and max() take their first argument, clamp() takes its
middle value, and the frame variables become 100vw, 100vh and 100vw - 112px.

Usage:
  python3 tools/css_compat.py          # update site/assets/css/main.css
  python3 tools/css_compat.py --check  # fail if anything is missing (used in CI)
"""
import pathlib, re, sys

CSS = pathlib.Path(__file__).resolve().parent.parent / "site/assets/css/main.css"
FN = re.compile(r"\b(min|max|clamp)\(")
FRAME = {"--fw": "100vw", "--fh": "100vh", "--stage": "calc(100vw - 112px)"}
FRAME_RE = re.compile(r"var\((--fw|--fh|--stage)\)")


def split_args(s):
    """Split the inside of a function call on top-level commas."""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur.strip()); cur = ""
        else:
            cur += ch
    out.append(cur.strip())
    return out


def plain(value):
    """Return value with min/max/clamp and frame variables replaced by plain equivalents."""
    value = FRAME_RE.sub(lambda m: FRAME[m.group(1)], value)
    while True:
        m = FN.search(value)
        if not m:
            return value
        start, depth, i = m.end(), 1, m.end()
        while depth:
            depth += {"(": 1, ")": -1}.get(value[i], 0); i += 1
        args = split_args(value[start:i - 1])
        pick = args[1] if m.group(1) == "clamp" and len(args) == 3 else args[0]
        if re.search(r"\s[-+]\s", pick) and not pick.startswith("calc("):
            pick = "calc(" + pick + ")"
        value = value[:m.start()] + pick + value[i:]


def inset_longhands(v):
    p = v.split()
    t, r, b, l = (p * 4)[:4] if len(p) == 1 else (p[0], p[1], p[0], p[1]) if len(p) == 2 else (p[0], p[1], p[2], p[1]) if len(p) == 3 else p[:4]
    return f"top: {t}; right: {r}; bottom: {b}; left: {l}"


DECL = re.compile(r"(?<![-\w])([a-z-]+)\s*:\s*([^;{}]+?)\s*(;|(?=\}))")


def fix_block(body):
    """Fix the declarations inside one { } block."""
    out, prev = [], None
    pos = 0
    for m in DECL.finditer(body):
        prop, val = m.group(1), m.group(2)
        out.append(body[pos:m.start()])
        pos = m.end()
        if prop == "inset":
            out.append(inset_longhands(val) + ";"); prev = None; continue
        needs = (FN.search(val) or FRAME_RE.search(val)) and not prop.startswith("--")
        if needs and prev != (prop, plain(val)):
            fb = plain(val)
            if fb != val:
                out.append(f"{prop}: {fb}; ")
        out.append(m.group(0) if m.group(3) else m.group(0) + ";")
        prev = (prop, val)
    out.append(body[pos:])
    return "".join(out)


def transform(css):
    # Only touch declaration blocks: text between a { and the next } that has no nested {
    return re.sub(r"\{([^{}]*)\}", lambda m: "{" + fix_block(m.group(1)) + "}", css)


def main():
    src = CSS.read_text(encoding="utf-8")
    new = transform(src)
    if "--check" in sys.argv:
        if new != src:
            sys.exit("main.css is missing compatibility fallbacks. Run: python3 tools/css_compat.py")
        print("CSS fallbacks up to date.")
        return
    CSS.write_text(new, encoding="utf-8")
    print("Updated" if new != src else "Already up to date:", CSS.relative_to(CSS.parents[3]))


if __name__ == "__main__":
    main()
