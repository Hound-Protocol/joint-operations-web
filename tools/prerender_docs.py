#!/usr/bin/env python3
"""Pre-render every document in the site library as a static HTML page.

Search engines and link previews cannot run the site's script, so each
document also gets a plain page at docs/<id>.html, plus sitemap.xml and
robots.txt. Visitors are offered the full site.

Usage: python3 tools/prerender_docs.py SITE_DIR SITE_URL
"""
import html, json, pathlib, posixpath, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
out_dir = pathlib.Path(sys.argv[1])
site_url = sys.argv[2].rstrip("/") + "/"
config = json.loads((root / "site/data/config.json").read_text())
docs = json.loads((root / "site/data/docs.json").read_text())["docs"]
by_path = {d["path"]: d for d in docs}
repo = config["repo"]
branch = config.get("branch", "main")


def link(url, base):
    if re.match(r"^(https?:|mailto:)", url):
        return url
    if url.startswith("#"):
        return url
    target = posixpath.normpath(posixpath.join(posixpath.dirname(base), url.split("#")[0]))
    if target in by_path:
        return f"{by_path[target]['id']}.html"
    return f"https://github.com/{repo}/blob/{branch}/{target}"


def inline(text, base):
    parts = re.split(r"(`[^`]+`)", text)
    out = []
    for part in parts:
        if re.fullmatch(r"`[^`]+`", part):
            out.append(f"<code>{html.escape(part[1:-1])}</code>")
            continue
        h = html.escape(part, quote=False)
        h = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(link(html.unescape(m.group(2)), base))}">{m.group(1)}</a>', h)
        h = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", h)
        h = re.sub(r"(^|[\s(])\*([^*\s][^*]*)\*", r"\1<em>\2</em>", h)
        out.append(h)
    return "".join(out)


def markdown(md, base):
    lines = [l for l in md.replace("\r\n", "\n").split("\n") if not re.match(r"^\s*</?[a-z][^>]*>", l, re.I)]
    out, para, i = [], [], 0

    def flush():
        if para:
            out.append("<p>" + inline(" ".join(para), base) + "</p>")
            para.clear()

    def cells(line):
        return [c.strip() for c in line.strip().strip("|").split("|")]

    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            flush(); code = []; i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i]); i += 1
            i += 1
            out.append("<pre><code>" + html.escape("\n".join(code)) + "</code></pre>")
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            flush(); n = len(m.group(1))
            out.append(f"<h{n}>{inline(m.group(2), base)}</h{n}>"); i += 1
            continue
        if line.strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{2,}", lines[i + 1]):
            flush(); head = cells(line); i += 2; rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(cells(lines[i])); i += 1
            out.append("<table><tr>" + "".join(f"<th>{inline(c, base)}</th>" for c in head) + "</tr>" +
                       "".join("<tr>" + "".join(f"<td>{inline(c, base)}</td>" for c in r) + "</tr>" for r in rows) + "</table>")
            continue
        m = re.match(r"^\s*([-*]|\d+\.)\s+(.*)$", line)
        if m:
            flush(); tag = "ol" if m.group(1)[0].isdigit() else "ul"; items = []
            while i < len(lines):
                m = re.match(r"^\s*([-*]|\d+\.)\s+(.*)$", lines[i])
                if not m:
                    break
                text = re.sub(r"^\[([ xX])\]\s+", lambda t: "☑ " if t.group(1) != " " else "☐ ", m.group(2))
                items.append(f"<li>{inline(text, base)}</li>"); i += 1
            out.append(f"<{tag}>{''.join(items)}</{tag}>")
            continue
        if not line.strip():
            flush(); i += 1
            continue
        para.append(line.strip()); i += 1
    flush()
    return "\n".join(out)


def description(md):
    for line in md.split("\n"):
        s = line.strip()
        if s and not s.startswith(("#", "|", "-", "*", "`", ">", "<")) and not s.lower().startswith(("status:", "author:", "code:")):
            return re.sub(r"[*`\[\]]|\(http[^)]*\)", "", s)[:180]
    return f"{config['project']} documentation"


page = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · {project}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:title" content="{title} · {project}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{site}assets/img/og.png">
<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/main.css">
<style>body{{overflow:auto}}.static{{max-width:860px;margin:0 auto;padding:32px 20px 60px}}.static .top{{display:flex;justify-content:space-between;gap:12px;margin-bottom:24px;font:400 12px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}}.static .doc{{border:0;padding:0}}</style>
</head>
<body>
<main class="static">
<div class="top"><span>{team} · {group}</span><a class="btn small" href="../#/docs/{id}">Open in the full site</a></div>
<article class="doc">
{body}
</article>
<p class="source">Unofficial fan project. Not affiliated with or endorsed by Konami. Source: <a href="https://github.com/{repo}/blob/{branch}/{path}">{path}</a></p>
</main>
</body>
</html>
"""

(out_dir / "docs").mkdir(parents=True, exist_ok=True)
urls = [site_url]
for d in docs:
    src = root / "mod-content" / d["path"]
    if not src.exists():
        src = root / d["path"]
    if not src.exists():
        continue
    md = src.read_text(encoding="utf-8")
    url = f"{site_url}docs/{d['id']}.html"
    urls.append(url)
    (out_dir / "docs" / f"{d['id']}.html").write_text(page.format(
        title=html.escape(d["title"]), project=html.escape(config["project"]), team=html.escape(config["team"]),
        group=html.escape(d["group"]), desc=html.escape(description(md)), url=url, site=site_url, id=d["id"],
        body=markdown(md, d["path"]), repo=repo, branch=branch, path=d["path"]), encoding="utf-8")

(out_dir / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                                     "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
(out_dir / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site_url}sitemap.xml\n")
print(f"Pre-rendered {len(urls) - 1} documents, sitemap and robots.txt")
