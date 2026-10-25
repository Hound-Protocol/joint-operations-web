"""Hound Protocol and Joint Operations logos, in the style of military unit insignia.

Original vector geometry drawn in code. Hound Protocol: a geometric hound face over a red
slash, with a heavy wordmark. Joint Operations: a unit badge with a sixteen-point star (sixteen
players) around the host diamond, and a wordmark where the star sits inside the O.
Colors: Joint Operations orange and white; Hound Protocol white, black and red (docs/brand.md).
"""
import math

WHITE, RED, INK, ORANGE, PAPER = "#e9edee", "#d0303a", "#0b0e10", "#f28c28", "#f3efe6"


def _mirror(pts):
    return pts + [(200 - x, y) for x, y in reversed(pts[1:-1])]


def _poly(pts, fill, extra=""):
    return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="{fill}"{(" " + extra) if extra else ""}/>'


def _line(a, b, col, w):
    return f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="{col}" stroke-width="{w}" stroke-linecap="square"/>'


# Front-facing geometric hound: tall pointed ears, narrow long muzzle (200 x 200 grid)
HEAD = _mirror([(100, 60), (117, 63), (141, 16), (152, 74), (140, 104), (124, 128), (114, 160), (100, 180)])


def hound_face(fg, eye, cut, s=1.0, tx=0, ty=0):
    o = f'<g transform="translate({tx} {ty}) scale({s})">' + _poly(HEAD, fg)
    for left in (False, True):
        X = (lambda x: 200 - x) if left else (lambda x: x)
        o += _poly([(X(139), 32), (X(146), 68), (X(127), 63)], cut)          # inner ear
        o += _poly([(X(109), 93), (X(129), 85), (X(121), 97)], eye)          # eye
        o += _line((X(102), 72), (X(119), 84), cut, 2.4)                     # brow
        o += _line((X(140), 104), (X(116), 118), cut, 2.4)                   # cheek
        o += _line((X(124), 128), (X(108), 134), cut, 2)                     # jaw
    o += _line((100, 104), (100, 150), cut, 2.2)                              # muzzle ridge
    o += _poly([(91, 164), (109, 164), (100, 177)], cut)                      # nose
    return o + "</g>"


def star16(cx, cy, r1, r2, fill):
    pts = []
    for i in range(32):
        a = math.radians(-90 + i * 11.25)
        r = r1 if i % 2 == 0 else r2
        if i % 4 == 2:
            r = r1 * 0.72
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return _poly(pts, fill)


def hp_icon(fg=WHITE, eye=RED, slash=RED, cut=INK):
    """Hound Protocol mark without the name, 200 x 200: the hound face over the red slash."""
    return _poly([(14, 176), (170, 16), (198, 16), (42, 176)], slash) + hound_face(fg, eye, cut, s=0.9, tx=10, ty=8)


def hp_lockup(text_path, fg=WHITE, eye=RED, slash=RED, cut=INK):
    """Hound Protocol with its name, 260 x 240."""
    hound, _ = text_path("HOUND", font="barlow-semi-condensed-medium.woff", size=44, tracking=0.16, x=130, y=196, anchor="middle")
    proto, _ = text_path("PROTOCOL", font="share-tech-mono-regular.woff", size=17, tracking=0.62, x=130, y=230, anchor="middle")
    return (_poly([(52, 150), (196, 22), (222, 22), (78, 150)], slash) + hound_face(fg, eye, cut, s=0.78, tx=52, ty=10) +
            f'<path d="{hound}" fill="{fg}" stroke="{fg}" stroke-width="1.6" stroke-linejoin="miter"/>' +
            f'<rect x="40" y="206" width="180" height="3" fill="{slash}"/><path d="{proto}" fill="{fg}"/>')


def jo_badge(text_path, frame=WHITE, field=INK, band=ORANGE, band_text=INK, star=WHITE, host=ORANGE):
    """Joint Operations unit badge, 260 x 240: shield, orange band with the name, sixteen-point star around the host."""
    name, _ = text_path("JOINT OPS", font="barlow-semi-condensed-medium.woff", size=26, tracking=0.32, x=130, y=56, anchor="middle")
    return (_poly([(30, 20), (230, 20), (230, 150), (130, 226), (30, 150)], frame) +
            _poly([(40, 30), (220, 30), (220, 146), (130, 214), (40, 146)], field) +
            _poly([(40, 30), (220, 30), (220, 62), (40, 62)], band) +
            f'<path d="{name}" fill="{band_text}" stroke="{band_text}" stroke-width=".8"/>' +
            star16(130, 128, 58, 16, star) + _poly([(130, 108), (150, 128), (130, 148), (110, 128)], host))


def jo_wordmark(text_path, fg=WHITE, acc=ORANGE, cut=INK):
    """Joint Operations wordmark, 260 x 240: J, the star inside the O, speed bars, the full name."""
    j, _ = text_path("J", font="barlow-semi-condensed-medium.woff", size=92, tracking=0, x=46, y=150, anchor="middle")
    full, _ = text_path("JOINT OPERATIONS", font="barlow-semi-condensed-medium.woff", size=15, tracking=0.26, x=130, y=196, anchor="middle")
    sub, _ = text_path("UP TO 16 OPERATIVES", font="share-tech-mono-regular.woff", size=10.5, tracking=0.42, x=130, y=228, anchor="middle")
    return (f'<path d="{j}" fill="{fg}" stroke="{fg}" stroke-width="3"/>' +
            star16(122, 118, 46, 12, acc) + _poly([(122, 104), (136, 118), (122, 132), (108, 118)], cut) +
            f'<circle cx="122" cy="118" r="38" fill="none" stroke="{fg}" stroke-width="7"/>' +
            f'<rect x="168" y="82" width="62" height="7" fill="{acc}"/><rect x="168" y="98" width="46" height="7" fill="{fg}"/><rect x="168" y="114" width="30" height="7" fill="{fg}"/>' +
            f'<path d="{full}" fill="{fg}" stroke="{fg}" stroke-width=".5"/><rect x="30" y="206" width="200" height="3" fill="{acc}"/><path d="{sub}" fill="{acc}"/>')


def mono(body, w, h, mid):
    """One-colour version: everything that was ink becomes a hole, everything else currentColor."""
    m = body
    for c in (WHITE, RED, ORANGE):
        m = m.replace(f'"{c}"', '"#fff"')
    m = m.replace(f'"{INK}"', '"#000"')
    return (f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{w}" height="{h}">{m}</mask>'
            f'<rect width="{w}" height="{h}" fill="currentColor" mask="url(#{mid})"/>')
