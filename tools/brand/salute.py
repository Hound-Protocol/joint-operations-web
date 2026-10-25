"""Joint Operations background scene: a line of saluting operatives with their commander behind them.

Original vector artwork drawn in code, in one colour, for use as a faint page background.
The commander is an original figure (peaked cap, long greatcoat), not any existing character.
"""

# Saluting operative, facing the viewer. Head top at y=0, feet at y=166.
# Right hand (viewer's left) raised to the brow, elbow out; left arm straight down; heels together.
SALUTE = [
    ("p", "M-12 13 C-12 3 -6 -1 0 -1 C6 -1 12 3 12 13 L15 15 L-15 15 Z"),          # patrol cap
    ("p", "M-15 12 H-9 V16 H-15 Z"),                                                # cap peak shadow side
    ("c", 0, 19, 8.5),                                                              # head
    ("p", "M-4 25 H4 V32 H-4 Z"),                                                   # neck
    ("p", "M-23 36 Q-21 30 -13 30 H13 Q21 30 23 36 L20 56 L16 76 H-16 L-20 56 Z"),  # torso
    ("p", "M-17 74 H17 V81 H-17 Z"),                                                # belt
    ("s", [(-20, 35), (-36, 33), (-14, 12)], 9),                                    # saluting arm: shoulder, elbow, hand at brow
    ("p", "M-17 7 L-9 9 L-10 15 L-17 14 Z"),                                        # flat hand at the brow
    ("s", [(20, 35), (24, 58), (22, 80)], 9),                                       # other arm straight down
    ("s", [(-6, 81), (-7, 120), (-7, 157)], 12.5),                                  # legs together
    ("s", [(6, 81), (7, 120), (7, 157)], 12.5),
    ("p", "M-15 154 H-1 Q1 162 -1 166 H-17 Q-18 159 -15 154 Z"),                    # boots
    ("p", "M15 154 H1 Q-1 162 1 166 H17 Q18 159 15 154 Z"),
    ("x", [(-14, 52), (14, 52)], 1.5),                                              # pouch row
    ("x", [(-5, 52), (-5, 66)], 1.5), ("x", [(5, 52), (5, 66)], 1.5),
    ("x", [(-14, 77.5), (14, 77.5)], 1.2),                                          # belt line
    ("x", [(0, 120), (0, 160)], 1.2),                                               # gap between the legs
]

# Commander: tall, broad, long greatcoat, peaked officer's cap, hands clasped behind the back.
COMMANDER = [
    ("p", "M-17 10 C-20 -1 -10 -6 0 -6 C10 -6 20 -1 17 10 L13 13 H-13 Z"),        # peaked cap crown, raised at the front
    ("p", "M-13 12 H13 L11 17 Q0 19.5 -11 17 Z"),                                   # visor
    ("c", 0, 23, 8.5),                                                              # head
    ("p", "M-9 29 H9 L12 41 H-12 Z"),                                               # high coat collar
    # Greatcoat: sloping shoulders, belted waist, flaring to below the knee
    ("p", "M-12 33 L-27 37 Q-33 39 -33 48 L-29 84 L-25 91 L-37 142 Q0 149 37 142 L25 91 L29 84 L33 48 Q33 39 27 37 L12 33 Z"),
    ("s", [(-31, 44), (-36, 72), (-33, 97)], 10),                                   # arms hanging at the sides
    ("s", [(31, 44), (36, 72), (33, 97)], 10),
    ("c", -33, 99, 5), ("c", 33, 99, 5),                                            # gloved hands
    ("s", [(-10, 142), (-11, 162)], 12), ("s", [(10, 142), (11, 162)], 12),         # boots below the coat
    ("p", "M-19 158 H-2 Q0 165 -2 169 H-21 Q-22 162 -19 158 Z"),
    ("p", "M19 158 H2 Q0 165 2 169 H21 Q22 162 19 158 Z"),
    ("x", [(-12, 41), (-3, 64)], 1.8), ("x", [(12, 41), (3, 64)], 1.8),             # lapels
    ("x", [(0, 64), (0, 144)], 1.6),                                                # coat front edge
    ("x", [(-6, 70), (-6, 70.1)], 3.2), ("x", [(6, 70), (6, 70.1)], 3.2),           # buttons
    ("x", [(-6, 80), (-6, 80.1)], 3.2), ("x", [(6, 80), (6, 80.1)], 3.2),
    ("x", [(-27, 88), (27, 88)], 2.6),                                              # coat belt
    ("x", [(-13, 12.5), (13, 12.5)], 1.2),                                          # cap band
]


def _pts(pts):
    return " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)


def _figure(prims, colour, cut):
    out = []
    for p in prims:
        k = p[0]
        if k == "p":
            out.append(f'<path d="{p[1]}" fill="{colour}"/>')
        elif k == "c":
            out.append(f'<circle cx="{p[1]}" cy="{p[2]}" r="{p[3]}" fill="{colour}"/>')
        elif k == "s":
            out.append(f'<polyline points="{_pts(p[1])}" fill="none" stroke="{colour}" stroke-width="{p[2]}" stroke-linecap="round" stroke-linejoin="round"/>')
    for p in prims:
        if p[0] == "x":
            out.append(f'<polyline points="{_pts(p[1])}" fill="none" stroke="{cut}" stroke-width="{p[2]}" stroke-linecap="round"/>')
    return "".join(out)


def _halo(prims, grow):
    """The figure's outline grown by `grow`, in black: cuts a gap between it and whatever is behind."""
    out = []
    for p in prims:
        if p[0] == "p":
            out.append(f'<path d="{p[1]}" fill="#000" stroke="#000" stroke-width="{grow}" stroke-linejoin="round"/>')
        elif p[0] == "c":
            out.append(f'<circle cx="{p[1]}" cy="{p[2]}" r="{p[3] + grow / 2}" fill="#000"/>')
        elif p[0] == "s":
            out.append(f'<polyline points="{_pts(p[1])}" fill="none" stroke="#000" stroke-width="{p[2] + grow}" stroke-linecap="round" stroke-linejoin="round"/>')
    return "".join(out)


def scene(colour="#e9edee", w=1600, h=900):
    """One-colour scene on a transparent background. Details are cut with a mask so it stays one colour."""
    ground = h - 90
    parts = [f'<mask id="jo-salute" maskUnits="userSpaceOnUse" x="0" y="0" width="{w}" height="{h}"><rect width="{w}" height="{h}" fill="#000"/>']
    # Commander, large and behind: drawn first, then cut away around the front row so the soldiers read in front
    cs = 4.4
    parts.append(f'<g transform="translate({w / 2} {ground - 168 * cs}) scale({cs})" opacity=".38">{_figure(COMMANDER, "#fff", "#000")}</g>')
    # Front row: seven operatives, the outer ones a little smaller and higher, as if further back
    row = [(-3, .82), (-2, .9), (-1, .97), (0, 1.04), (1, .97), (2, .9), (3, .82)]
    for i, s in row:
        x = w / 2 + i * 150 * (1 + abs(i) * 0.04)
        sc = 1.55 * s
        y = ground - 166 * sc - abs(i) * 6
        # A dark halo first separates each operative from the commander behind
        halo = _halo(SALUTE, 7)
        parts.append(f'<g transform="translate({x:.1f} {y:.1f}) scale({sc:.3f})">{halo}{_figure(SALUTE, "#fff", "#000")}</g>')
    parts.append("</mask>")
    parts.append(f'<rect width="{w}" height="{h}" fill="{colour}" mask="url(#jo-salute)"/>')
    # Ground line
    parts.append(f'<path d="M{w * .12:.0f} {ground + 2} H{w * .88:.0f}" stroke="{colour}" stroke-width="2" opacity=".5"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="Joint Operations: operatives saluting their commander"><title>Joint Operations</title>{"".join(parts)}</svg>\n'
