  /* ---------------- Roadmap: the base under construction ----------------
     Seen from above. Phase 0 is the command platform in the centre, every later phase is a platform on its own bridge,
     named after the phase. The fill inside a platform is the share of that phase's tasks that are done; the hatched part
     above it is still scaffolding. Point at a platform to light it, click it to read its tasks.
     Everything that moves (cargo ships unloading, crews carrying crates, cranes, boats, a helicopter, the comms mast, gulls, channel buoys, helipad lights, a windsock, helicopter lights, a mast beacon)
     is decoration and stops with Options → Animations. The data comes live from ROADMAP.md. */
  var MB_SLOTS = [[-345, -220], [345, -220], [345, 220], [-345, 220], [0, -330], [0, 330]];
  var MB_W = 1600, MB_H = 900, MB_CX = 600, MB_CY = 470;
  var MB = null;
  function mbRng(seed) { var s = (seed >>> 0) || 1; return function () { s = (Math.imul ? Math.imul(s, 1664525) : s * 1664525) + 1013904223 >>> 0; return s / 4294967296; }; }
  function mbRot(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }
  function mbF(n) { return (Math.round(n * 10) / 10).toString(); }
  function mbLen(x, y) { return Math.sqrt(x * x + y * y); }
  function mbState(p, now) { return p.total && p.done === p.total ? "done" : (p === now || p.done > 0 ? "now" : "next"); }
  function mbClamp(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
  function mbEase(t) { t = mbClamp(t); return 1 - Math.pow(1 - t, 3); }

  /* Platform outline in local units: +x points away from the command platform */
  function mbGeom(i, core) {
    var r = mbRng(i * 97 + 13), S = 1.15, R = core ? 94 : 66, sh = [], hex = [], k, zones = [];
    for (k = 0; k < 6; k++) { var a = Math.PI / 3 * k + Math.PI / 6; hex.push([Math.cos(a) * R, Math.sin(a) * R]); }
    sh.push({ t: "poly", p: hex });
    zones.push({ t: "disc", x: 0, y: 0, r: R * 0.62 });
    var flat = R * Math.cos(Math.PI / 6), pad, side = 1;
    if (core) {
      sh.push({ t: "rect", x: -39, y: -R - 39, w: 78, h: 50 });
      sh.push({ t: "rect", x: -39, y: R - 11, w: 78, h: 50 });
      pad = { x: 0, y: -R - 66, r: 30 };
      zones.push({ t: "rect", x: -32, y: R - 2, w: 64, h: 32, gate: [0, R - 6] });
    } else {
      var L = Math.round((58 + r() * 24) * S), off = Math.round((-22 + r() * 14) * S);
      side = r() < 0.5 ? -1 : 1;
      sh.push({ t: "rect", x: flat - 7, y: -25, w: L, h: 50 });
      sh.push({ t: "rect", x: off, y: side > 0 ? R - 14 : -R - 37, w: 62, h: 51 });
      pad = { x: flat + L + 21, y: 0, r: 30 };
      zones.push({ t: "rect", x: flat, y: -17, w: L - 14, h: 34, gate: [flat - 4, 0] });
      zones.push({ t: "rect", x: off + 9, y: side > 0 ? R - 5 : -R - 28, w: 44, h: 32, gate: [0, side > 0 ? R - 8 : -R + 8] });
    }
    sh.push({ t: "circ", x: pad.x, y: pad.y, r: pad.r });
    return { sh: sh, R: R, pad: pad, zones: zones, side: side };
  }
  function mbShapeSvg(s, deg, cls) {
    var tr = ' transform="rotate(' + mbF(deg) + ')"', c = cls ? ' class="' + cls + '"' : "";
    if (s.t === "poly") return "<polygon" + c + tr + ' points="' + s.p.map(function (q) { return mbF(q[0]) + "," + mbF(q[1]); }).join(" ") + '"/>';
    if (s.t === "rect") return "<rect" + c + tr + ' x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '"/>';
    return "<circle" + c + tr + ' cx="' + mbF(s.x) + '" cy="' + mbF(s.y) + '" r="' + s.r + '"/>';
  }
  function mbExtent(sh, a) {
    var e = [1e9, 1e9, -1e9, -1e9];
    function add(p, pad) { var q = mbRot(p, a); e[0] = Math.min(e[0], q[0] - pad); e[1] = Math.min(e[1], q[1] - pad); e[2] = Math.max(e[2], q[0] + pad); e[3] = Math.max(e[3], q[1] + pad); }
    sh.forEach(function (s) {
      if (s.t === "poly") s.p.forEach(function (p) { add(p, 0); });
      else if (s.t === "rect") { add([s.x, s.y], 0); add([s.x + s.w, s.y], 0); add([s.x, s.y + s.h], 0); add([s.x + s.w, s.y + s.h], 0); }
      else add([s.x, s.y], s.r);
    });
    return e;
  }
  function mbWorld(m, lp) { var p = mbRot(lp, m.a); return [m.x + p[0], m.y + p[1]]; }
  /* A random spot on a platform. Walkers only move in straight lines inside one deck area, and change area through
     its gate (a point inside both the deck and the hexagon), so nobody walks over the water */
  function mbPick(m, r, zi) {
    if (zi == null) zi = Math.floor(r() * m.g.zones.length);
    var z = m.g.zones[zi], p;
    if (z.t === "disc") { var a = r() * Math.PI * 2, d = Math.sqrt(r()) * z.r; p = [Math.cos(a) * d, Math.sin(a) * d]; }
    else p = [z.x + 4 + r() * (z.w - 8), z.y + 4 + r() * (z.h - 8)];
    var w = mbWorld(m, p); w.z = zi; return w;
  }
  function mbRoute(m, from, to) {
    var path = [], a = m.g.zones[from], b = m.g.zones[to];
    if (from !== to) { if (a.gate) path.push(mbWorld(m, a.gate)); if (b.gate) path.push(mbWorld(m, b.gate)); }
    return path;
  }

  function mbBuild(r, now) {
    var mods = r.map(function (p, i) {
      var core = i === 0, slot = core ? [0, 0] : MB_SLOTS[(i - 1) % MB_SLOTS.length];
      var a = core ? 0 : Math.atan2(slot[1], slot[0]), g = mbGeom(i, core), ext = mbExtent(g.sh, a);
      return { i: i, p: p, core: core, x: MB_CX + slot[0], y: MB_CY + slot[1], a: a, deg: a * 180 / Math.PI, g: g, ext: ext,
        pct: p.total ? Math.round(p.done / p.total * 100) : 0, st: mbState(p, now), name: p.title };
    });
    var defs = '<defs><filter id="mbGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<pattern id="mbHatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9"/></pattern>' +
      '<radialGradient id="mbCloudG"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".6" stop-color="#000" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="mbSea" gradientUnits="userSpaceOnUse" cx="' + MB_CX + '" cy="' + MB_CY + '" r="900"><stop offset="0" stop-color="#18343d" stop-opacity=".9"/><stop offset="1" stop-color="#060a0c" stop-opacity="0"/></radialGradient>' +
      mods.map(function (m) { return '<clipPath id="mbClip' + m.i + '">' + m.g.sh.map(function (s) { return mbShapeSvg(s, m.deg); }).join("") + "</clipPath>"; }).join("") + "</defs>";
    var bridges = mods.filter(function (m) { return !m.core; }).map(function (m) {
      var built = m.st !== "next", x1 = MB_CX, y1 = MB_CY, x2 = m.x, y2 = m.y, len = mbLen(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len, piers = "";
      for (var d = 130; d < len - 80; d += 52) piers += '<rect class="mb-pier" x="' + mbF(x1 + ux * d - 5) + '" y="' + mbF(y1 + uy * d - 5) + '" width="10" height="10"/>';
      var line = 'x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"';
      return '<g class="mb-bridge ' + (built ? "built" : "plan") + '" data-len="' + mbF(len) + '">' + (built ? piers + '<line class="b-edge" ' + line + "/>" : "") + '<line class="b-deck" ' + line + "/>" +
        (built ? '<line class="b-lane" ' + line + "/>" : "") + "</g>";
    }).join("");
    var plats = mods.map(function (m) {
      var e = m.ext, label = "Phase " + m.p.n + ": " + m.p.title + ", " + m.pct + "% complete", padC = mbRot([m.g.pad.x, m.g.pad.y], m.a);
      return '<g class="mb-mod st-' + m.st + (m.core ? " core" : "") + '" data-i="' + m.i + '" tabindex="0" role="button" aria-pressed="false" aria-label="' + esc(label) + '" transform="translate(' + m.x + " " + m.y + ')">' +
        '<g class="mb-in">' +
        '<g class="mb-edge">' + m.g.sh.map(function (s) { return mbShapeSvg(s, m.deg); }).join("") + "</g>" +
        '<g class="mb-deck">' + m.g.sh.map(function (s) { return mbShapeSvg(s, m.deg); }).join("") + "</g>" +
        '<g clip-path="url(#mbClip' + m.i + ')"><rect class="mb-hatch" x="' + mbF(e[0]) + '" y="' + mbF(e[1]) + '" width="' + mbF(e[2] - e[0]) + '" height="0" fill="url(#mbHatch)"/>' +
        '<path class="mb-fill"/><path class="mb-lvl"/></g>' +
        '<g class="mb-mark">' + mbShapeSvg({ t: "poly", p: m.g.sh[0].p.map(function (q) { return [q[0] * 0.7, q[1] * 0.7]; }) }, m.deg) +
        mbShapeSvg({ t: "circ", x: m.g.pad.x, y: m.g.pad.y, r: 19 }, m.deg) + "</g>" +
        '<text class="mb-h" x="' + mbF(padC[0]) + '" y="' + mbF(padC[1] + 5) + '">H</text>' +
        '<circle class="mb-beacon" cx="' + mbF(padC[0] + 22) + '" cy="' + mbF(padC[1] - 22) + '" r="3"/>' +
        "</g>" +
        '<text class="mb-pct" x="0" y="' + mbF(e[1] - 18) + '">0%</text>' +
        '<text class="mb-name" x="0" y="' + mbF(e[3] + 32) + '">' + esc("P" + m.p.n + " · " + m.name) + "</text>" +
        "</g>";
    }).join("");
    var waves = "";
    for (var w = 0; w < 46; w++) waves += '<line class="mb-wave"/>';
    var svg = '<svg class="mb-svg" viewBox="0 0 ' + MB_W + " " + MB_H + '" role="group" aria-label="Base under construction: one platform per roadmap phase">' + defs +
      '<rect class="mb-sea" x="0" y="0" width="' + MB_W + '" height="' + MB_H + '" fill="url(#mbSea)"/>' +
      '<g class="mb-water">' + waves + '<g id="mbRings"></g><g id="mbBuoys"></g><g id="mbBoats"></g><g id="mbShips"></g></g>' +
      '<g class="mb-bridges">' + bridges + '<g id="mbWalk"></g></g>' +
      '<g class="mb-plats">' + plats + "</g>" +
      '<g class="mb-fx" aria-hidden="true"><ellipse class="mb-shade" cx="0" cy="0" rx="190" ry="70"/><g class="mb-tanker" transform="translate(520 760)"><path d="M-34 0 L30 0 L36 -5 L-36 -5 Z"/><rect x="-30" y="-11" width="9" height="6"/><line x1="-25" y1="-11" x2="-25" y2="-15"/><circle cx="-34" cy="-3" r="1.3"/></g><g class="mb-wake" transform="translate(905 470)"><path d="M0 0 Q-30 6 -64 4"/><path d="M0 0 Q-30 -6 -64 -4"/></g><rect class="mb-fog" x="0" y="0" width="520" height="34" rx="17"/><circle class="mb-ring" cx="628" cy="613" r="3.2"/><g class="mb-bollards" transform="translate(600 613)"><path class="mbb-rope" d="M-18 0 Q0 7 18 0"/><circle cx="-18" cy="0" r="2.6"/><circle cx="18" cy="0" r="2.6"/></g><g class="mb-buoy" transform="translate(450 700)"><g class="mby-bob"><path class="mby-body" d="M-6 0 L6 0 L3 -12 L-3 -12 Z"/><line x1="0" y1="-12" x2="0" y2="-17"/><circle class="mby-light" cx="0" cy="-18" r="2"/></g></g><g class="mb-lantern" transform="translate(790 330)"><g class="ml-bob"><path class="ml-hull" d="M-12 0 L12 0 L8 5 L-8 5 Z"/><line x1="0" y1="0" x2="0" y2="-10"/><circle class="ml-light" cx="0" cy="-11" r="2"/></g></g><g id="mbPile"></g><g id="mbCrew"></g><g id="mbCarry"></g><g id="mbCranes"></g><g id="mbComms" class="mb-comms"><rect x="-6" y="-6" width="12" height="12"/><circle class="mb-beacon" cx="0" cy="0" r="2.4"/><line x1="0" y1="0" x2="18" y2="0"/><circle cx="18" cy="0" r="2.2"/><g class="mb-radar" transform="translate(-16 -11)"><circle class="rd" r="8.5"/><g class="mb-rad-spin"><line x1="0" y1="0" x2="8.5" y2="0"/></g></g></g><g id="mbVent"></g><g id="mbWin"></g><line id="mbStar" class="mb-star" x1="0" y1="0" x2="0" y2="0" opacity="0"/><g id="mbFlag" class="mb-flag"><line x1="0" y1="0" x2="0" y2="-26"/><path d="M0 -26 L16 -23 L0 -19 Z"/></g><g id="mbDrop" class="mb-drop" opacity="0"><path class="cn" d="M-11 -20 Q0 -33 11 -20 Z"/><path class="ln" d="M-11 -20 L-3 -5 M11 -20 L3 -5"/><rect class="cr" x="-4" y="-5" width="8" height="7"/></g><g id="mbSearch" class="mb-search"><path d="M0 0 L150 -20 A151 151 0 0 1 150 20 Z"/></g><g id="mbPadL"></g><g id="mbBridgeL"></g><g id="mbSock" class="mb-sock"><line x1="0" y1="0" x2="0" y2="-1"/><path d="M0 0 L16 -3 L16 3 Z"/><circle class="mb-sockl" cx="0" cy="0" r="1.9"/></g><g id="mbSel"><circle class="r1"/><circle class="r2"/></g><g id="mbHeli"></g><g id="mbGulls"></g></g>' +
      '<g class="mb-clouds" aria-hidden="true"><ellipse rx="300" ry="170" fill="url(#mbCloudG)"/><ellipse rx="240" ry="140" fill="url(#mbCloudG)"/><ellipse rx="340" ry="190" fill="url(#mbCloudG)"/></g>' +
      '<g class="mb-hud" aria-hidden="true"><path d="M14 44V14h30M1586 44V14h-30M14 856v30h30M1586 856v30h-30"/>' +
      '<g transform="translate(1080 70)"><circle r="20"/><path d="M0 -15L5 4 0 0-5 4z"/><text y="-28">N</text></g></g>' +
      "</svg>";
    return { mods: mods, svg: svg };
  }

  function mbPanel(m) {
    var p = m.p, word = { now: "Under construction", done: "Complete", next: "Planned" }[m.st], pill = { now: "warn", done: "ok", next: "" }[m.st];
    return '<div class="mb-p st-' + m.st + '"><div class="kicker">Phase ' + p.n + (m.core ? " · command platform" : " · platform") + "</div>" +
      "<h3>" + esc(p.title) + "</h3>" +
      '<div class="mb-big"><b>' + m.pct + '%</b><span class="pill ' + pill + '">' + word + "</span></div>" +
      '<div class="meter"><i style="width:' + m.pct + '%"></i></div>' +
      '<p class="mb-count">' + p.done + " of " + plural(p.total, "task") + " done</p>" +
      '<ul class="rm-items">' + p.items.map(function (it) { return '<li class="' + (it.done ? "done" : "") + '">' + inline(it.text, "ROADMAP.md") + "</li>"; }).join("") + "</ul></div>";
  }

  function mbStop() { if (MB) { if (MB.raf) cancelAnimationFrame(MB.raf); if (MB.onResize) window.removeEventListener("resize", MB.onResize); } MB = null; }

  function viewRoadmap() {
    mbStop();
    var v = $("#view");
    v.innerHTML = shell("Plan", "Roadmap", loading("Loading roadmap"));
    loadRoadmap().then(function () {
      if (currentView !== "roadmap") return;
      var r = data.roadmap || [], now = currentPhase();
      if (!r.length) { $("#vb").innerHTML = '<div class="empty">Roadmap unavailable<small>ROADMAP.md could not be loaded.</small></div>'; return; }
      var all = r.reduce(function (a, p) { return [a[0] + p.done, a[1] + p.total]; }, [0, 0]);
      var b = mbBuild(r, now);
      $("#vb").innerHTML = '<div class="bf"><section class="bf-sec">' +
        '<div class="mb-stage">' + b.svg +
          '<div class="mb-hudtl"><span class="kicker">Joint Operations Motherbase</span><b>' + (all[1] ? Math.round(all[0] / all[1] * 100) : 0) + "%</b><small>" + all[0] + " of " + all[1] + " tasks done</small>" +
          '<ul class="mb-key"><li class="k-done">Complete</li><li class="k-now">Under construction</li><li class="k-next">Planned</li></ul></div>' +
          '<p class="mb-hint">Click a platform for details</p>' +
          '<aside class="mb-panel" id="mbPanel" aria-live="polite"></aside>' +
        "</div>" +
        '<p class="source">Read live from <a href="' + repoUrl("/blob/" + cfg.branch + "/ROADMAP.md") + '" target="_blank" rel="noopener noreferrer">ROADMAP.md</a> · the base grows as tasks are ticked off in each release · each phase starts when the one before it is done</p>' +
        "</section></div>";
      mbStart(b.mods, r.indexOf(now));
      revealSections();
      refreshInfo();
    });
  }

  function mbStart(mods, nowIdx) {
    var svg = $(".mb-svg"), stage = $(".mb-stage"), r = mbRng(7);
    MB = { svg: svg, mods: mods, sel: -1, t: 0, last: 0, raf: 0, cargo: 0 };
    var cur = mods[nowIdx < 0 ? 0 : nowIdx];
    function fit() { var narrow = stage.clientWidth < 760; svg.setAttribute("viewBox", narrow ? "-10 20 1150 870" : "0 0 " + MB_W + " " + MB_H); stage.classList.toggle("narrow", narrow); }
    MB.onResize = fit; window.addEventListener("resize", fit); fit();
    function select(i, quiet) {
      MB.sel = i;
      $$(".mb-mod").forEach(function (g) { var on = +g.getAttribute("data-i") === i; g.classList.toggle("sel", on); g.setAttribute("aria-pressed", String(on)); });
      var pn = $("#mbPanel"); pn.innerHTML = mbPanel(mods[i]); pn.scrollTop = 0;
      if (!quiet) { blip("go"); status("Phase " + mods[i].p.n + " · " + mods[i].p.title); if (stage.classList.contains("narrow") && pn.scrollIntoView) pn.scrollIntoView({ behavior: opts.motion ? "smooth" : "auto", block: "nearest" }); }
    }
    $$(".mb-mod").forEach(function (g) {
      var i = +g.getAttribute("data-i");
      g.addEventListener("click", function () { select(i); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); } });
      g.addEventListener("mouseenter", function () { blip(); });
    });
    select(cur.i, true);

    /* ---- Cast ---- */
    var crew = [], walk = [], cranes = [], boats = [], ships = [], waves = [], sparks = [], rings = [], clouds = [], carriers = [], pile = [];
    mods.forEach(function (m) {
      var n = m.st === "now" ? (m.core ? 16 : 12) : m.st === "done" ? (m.core ? 7 : 5) : 2;
      for (var k = 0; k < n; k++) { var p = mbPick(m, r); crew.push({ m: m, x: p[0], y: p[1], z: p.z, path: [], wait: r() * 2, sp: m.st === "next" ? 8 : 14 + r() * 9 }); }
      if (m.st === "now") {
        [[-m.g.R * 0.36, -m.g.R * 0.3], [m.g.R * 0.32, m.g.R * 0.34]].forEach(function (lp, k) { var w = mbWorld(m, lp); cranes.push({ x: w[0], y: w[1], base: r() * 360, ph: k * 2.1, sp: 0.25 + r() * 0.2 }); });
        for (var s = 0; s < 5; s++) sparks.push({ m: m, x: 0, y: 0, on: 0, next: r() * 2 });
      }
      if (!m.core && m.st !== "next") for (var q = 0; q < 3; q++) walk.push({ m: m, u: r(), d: r() < 0.5 ? 1 : -1, lane: (q % 2 ? 3 : -3), sp: 0.03 + r() * 0.03 });
    });
    for (var bI = 0; bI < 3; bI++) boats.push({ st: "in", x: 0, y: 0, tx: 0, ty: 0, wait: 0, trail: [], tick: 0, h: 0, delay: 1.5 + bI * 4 });
    /* Cargo ships go to platforms under construction; crews carry the crates to a stockpile; builders use them up */
    var sites = mods.filter(function (m) { return m.st === "now"; }); if (!sites.length) sites = [mods[0]];
    for (var sI = 0; sI < 2; sI++) ships.push({ st: "wait", x: 0, y: 0, h: 0, trail: [], tick: 0, wait: 0.5 + sI * 7, load: 6, site: sites[sI % sites.length], cont: [] });
    for (var wI = 0; wI < 46; wI++) waves.push({ x: r() * MB_W, y: r() * MB_H, l: 10 + r() * 22, sp: 4 + r() * 7, o: 0.04 + r() * 0.1 });
    for (var rI = 0; rI < 14; rI++) rings.push({ x: 0, y: 0, t: 1, dur: 1, r0: 0, r1: 0, hot: false });
    for (var cI = 0; cI < 3; cI++) clouds.push({ x: r() * MB_W, y: 120 + r() * 660, sp: 6 + r() * 5 });
    for (var kI = 0; kI < 6; kI++) carriers.push({ st: "idle", x: 0, y: 0, ship: null, wait: kI * 0.35 });
    for (var pI = 0; pI < 10; pI++) pile.push({ on: false });

    $("#mbCrew").innerHTML = crew.map(function (c) { return '<circle class="mb-man st-' + c.m.st + '" r="2.3"/>'; }).join("") + sparks.map(function () { return '<circle class="mb-spark" r="3"/>'; }).join("");
    $("#mbWalk").innerHTML = walk.map(function () { return '<circle class="mb-man st-done" r="2"/>'; }).join("");
    $("#mbCranes").innerHTML = cranes.map(function () { return '<g class="mb-crane"><rect x="-5" y="-5" width="10" height="10"/><line x1="-11" y1="0" x2="42" y2="0"/><circle cx="42" cy="0" r="2.4"/><circle class="mb-tip" cx="44.5" cy="0" r="1.6"/></g>'; }).join("");
    $("#mbBoats").innerHTML = boats.map(function () { return '<polyline class="mb-wake"/><polygon class="mb-hull" points="14,0 6,-5 -12,-5 -12,5 6,5"/>'; }).join("");
    var CONT = [[-22, -5], [-12, -5], [-2, -5], [-22, 4], [-12, 4], [-2, 4]], COLS = ["#f28c28", "#4f8fa6", "#b8c2c5", "#c9a24a", "#4f8fa6", "#f28c28"];
    $("#mbShips").innerHTML = ships.map(function () {
      return '<polyline class="mb-wake big"/><g class="mb-ship"><polygon class="hull" points="44,0 34,-12 -40,-12 -40,12 34,12"/><rect class="deck" x="-36" y="-9" width="64" height="18"/>' +
        CONT.map(function (c, k) { return '<rect class="cont" x="' + c[0] + '" y="' + c[1] + '" width="9" height="7" fill="' + COLS[k] + '"/>'; }).join("") +
        '<rect class="bridge" x="12" y="-8" width="14" height="16"/><circle class="lamp" cx="40" cy="0" r="1.8"/></g><line class="mb-gang"/>';
    }).join("");
    $("#mbCarry").innerHTML = carriers.map(function () { return '<g class="mb-carrier"><rect class="crate" x="-3.5" y="-9" width="7" height="6"/><circle r="2.4"/></g>'; }).join("");
    $("#mbPile").innerHTML = pile.map(function () { return '<rect class="mb-crate" width="8" height="7"/>'; }).join("");
    $("#mbRings").innerHTML = rings.map(function () { return '<circle class="mb-ring"/>'; }).join("");
    $("#mbHeli").innerHTML = '<ellipse class="mb-hsh" rx="9" ry="4"/><g class="mb-heli"><g class="hb"><ellipse rx="8" ry="3.4"/><line x1="-6" y1="0" x2="-20" y2="0"/><line x1="-20" y1="-4" x2="-20" y2="4"/><circle class="nav-r" cx="2" cy="-3.6" r="1.3"/><circle class="nav-g" cx="2" cy="3.6" r="1.3"/><circle class="nav-w" cx="-20" cy="0" r="1.2"/></g><line class="rotor" x1="-14" y1="0" x2="14" y2="0"/><line class="rotor" x1="0" y1="-14" x2="0" y2="14"/></g>';
    var el = {
      men: $$("#mbCrew .mb-man"), sp: $$("#mbCrew .mb-spark"), walk: $$("#mbWalk circle"), cr: $$("#mbCranes .mb-crane"),
      wake: $$("#mbBoats .mb-wake"), hull: $$("#mbBoats .mb-hull"), swake: $$("#mbShips .mb-wake"), ship: $$("#mbShips .mb-ship"), gang: $$("#mbShips .mb-gang"),
      cont: $$("#mbShips .mb-ship").map(function (g) { return $$(".cont", g); }),
      carry: $$("#mbCarry .mb-carrier"), pile: $$("#mbPile .mb-crate"), rings: $$("#mbRings circle"), waves: $$(".mb-wave"), clouds: $$(".mb-clouds ellipse"),
      fill: $$(".mb-fill"), lvl: $$(".mb-lvl"), hatch: $$(".mb-hatch"), pct: $$(".mb-pct"), mod: $$(".mb-mod"), inner: $$(".mb-mod .mb-in"), name: $$(".mb-mod .mb-name"),
      br: $$(".mb-bridge"), sel: $("#mbSel"), selR: $$("#mbSel circle"),
      hsh: $("#mbHeli .mb-hsh"), heli: $("#mbHeli .mb-heli"), hb: $("#mbHeli .hb"), rot: $$("#mbHeli .rotor"), pat: $("#mbHatch")
    };
    function padOf(m) { return mbWorld(m, [m.g.pad.x, m.g.pad.y]); }
    var hp = padOf(mods[0]), H = { x: hp[0], y: hp[1], to: cur === mods[0] ? (mods[1] || mods[0]) : cur, st: "wait", t: 3.2, alt: 0, h: -40 };
    function edgePoint() { var s = Math.floor(r() * 4), u = r(); return s === 0 ? [u * 1150, -40] : s === 1 ? [MB_W + 40, u * MB_H] : s === 2 ? [u * 1150, MB_H + 40] : [-40, u * MB_H]; }
    function outward(m) { return m.core ? [0, 1] : [Math.cos(m.a), Math.sin(m.a)]; }
    function reach(m) { return m.core ? m.g.R + 50 : Math.max(m.ext[2] - m.ext[0], m.ext[3] - m.ext[1]) / 2 + 14; }
    function dockFor() {
      var pick = r(), m = pick < 0.5 ? cur : pick < 0.75 ? mods[0] : mods[Math.floor(r() * mods.length)], o = outward(m), d = reach(m) + 30, sd = (r() - 0.5) * 90;
      return [Math.max(20, Math.min(1140, m.x + o[0] * d - o[1] * sd)), Math.max(20, Math.min(MB_H - 20, m.y + o[1] * d + o[0] * sd))];
    }
    /* A ship docks alongside the platform's side deck, parallel to it */
    function berth(m) {
      var o = outward(m), n = [-o[1], o[0]], sgn = m.core ? 1 : m.g.side, d = m.core ? m.g.R * 0.866 + 46 : m.g.R + 70, along = m.core ? 0 : 6;
      return { x: m.x + n[0] * d * sgn + o[0] * along, y: m.y + n[1] * d * sgn + o[1] * along, h: Math.atan2(o[1], o[0]) * 180 / Math.PI, n: [n[0] * sgn, n[1] * sgn] };
    }
    function pileSpot(m, k) { var b = berth(m), base = [m.x + b.n[0] * (m.g.R * 0.45), m.y + b.n[1] * (m.g.R * 0.45)], o = outward(m); return [base[0] + o[0] * ((k % 5) - 2) * 10 - b.n[0] * Math.floor(k / 5) * 9, base[1] + o[1] * ((k % 5) - 2) * 10 - b.n[1] * Math.floor(k / 5) * 9]; }
    boats.forEach(function (b) { var e = edgePoint(), d = dockFor(); b.x = e[0]; b.y = e[1]; b.tx = d[0]; b.ty = d[1]; });
    function ring(x, y, r0, r1, dur, hot) { for (var k = 0; k < rings.length; k++) if (rings[k].t >= 1) { var g = rings[k]; g.x = x; g.y = y; g.r0 = r0; g.r1 = r1; g.dur = dur; g.t = 0; g.hot = !!hot; return; } }
    var piled = 0, ringT = 0;
    /* Comms mast on the command platform (v0.0.22): a turning dish that sends a signal ring every few seconds */
    var comms = mbWorld(mods[0], [-mods[0].g.R * 0.45, mods[0].g.R * 0.05]), commsT = 1.2, commsEl = $("#mbComms");
    /* Gulls (v0.0.24): a small flock circling on the wind over the base, flapping now and then, gliding in between */
    var gulls = [];
    for (var gi = 0; gi < 6; gi++) gulls.push({ cx: 260 + r() * 1000, cy: 160 + r() * 560, R: 26 + r() * 46, w: (r() < 0.5 ? -1 : 1) * (0.32 + r() * 0.22), ph: r() * 6.3, fl: r() * 6.3, vx: 6 + r() * 6, vy: (r() - 0.5) * 4 });
    $("#mbGulls").innerHTML = gulls.map(function () { return '<g class="mb-gull"><path class="gs" d="M-10 1.5Q-5 -4.5 0 0Q5 -4.5 10 1.5"/><path class="gb" d="M-10 1.5Q-5 -4.5 0 0Q5 -4.5 10 1.5"/></g>'; }).join("");
    var gullEls = $$("#mbGulls .mb-gull");
    /* Channel buoys (v0.0.25): red and green marks along the shipping lane, bobbing and blinking out of step */
    var buoys = [];
    [[0.18, 0.5], [0.42, 0.28], [0.62, 0.9], [0.86, 0.3], [0.08, 0.86], [0.6, 0.62]].forEach(function (q, k) { buoys.push({ x: q[0] * 1150 + 30, y: q[1] * MB_H, red: k % 2 === 0, ph: r() * 6.3, per: 2.2 + r() * 1.6 }); });
    $("#mbBuoys").innerHTML = buoys.map(function (b) { return '<g class="mb-buoy ' + (b.red ? "red" : "grn") + '" transform="translate(' + mbF(b.x) + " " + mbF(b.y) + ')"><circle class="bw" r="7"/><circle class="bb" r="4.6"/><circle class="bl" r="2.2"/></g>'; }).join("");
    var buoyEls = $$("#mbBuoys .mb-buoy");
    /* Helipad lights (v0.0.26): four lights around every pad chase in turn, faster on the pad the helicopter is heading for */
    var padL = [];
    mods.forEach(function (m) { var c = padOf(m); for (var q = 0; q < 4; q++) { var a = q * Math.PI / 2 + Math.PI / 4; padL.push({ m: m, q: q, x: c[0] + Math.cos(a) * 17, y: c[1] + Math.sin(a) * 17 }); } });
    $("#mbPadL").innerHTML = padL.map(function (l) { return '<circle class="mb-padl" r="2.1" cx="' + mbF(l.x) + '" cy="' + mbF(l.y) + '"/>'; }).join("");
    var padEls = $$("#mbPadL .mb-padl");
    /* Bridge lights (v0.0.33): small lamps along every bridge, a light running out from the command platform */
    var brL = [], core = mods[0];
    mods.forEach(function (m) { if (m === core) return; for (var q = 1; q <= 6; q++) { var t = 0.22 + q * 0.09; brL.push({ m: m, q: q, x: core.x + (m.x - core.x) * t, y: core.y + (m.y - core.y) * t }); } });
    $("#mbBridgeL").innerHTML = brL.map(function (l) { return '<circle class="mb-brl" r="1.6" cx="' + mbF(l.x) + '" cy="' + mbF(l.y) + '"/>'; }).join("");
    var brEls = $$("#mbBridgeL .mb-brl");
    /* Searchlight (v0.0.34): a slow beam sweeping the sea from the command platform */
    var srchEl = $("#mbSearch");
    /* Supply drop (v0.0.35): every half minute a crate floats down on a parachute onto a built platform */
    /* Flag (v0.0.36): a pennant waving on the command platform */
    var flagEl = $("#mbFlag"), flagP = $("#mbFlag path"), flagAt = mbWorld(core, [core.g.R * 0.42, -core.g.R * 0.32]);
    flagEl.setAttribute("transform", "translate(" + mbF(flagAt[0]) + " " + mbF(flagAt[1]) + ")");
    /* Lit windows (v0.0.38): a row of windows on the command platform, switching on and off now and then */
    var wins = [], winAt = [[-0.28, 0.42], [-0.14, 0.42], [0, 0.42], [0.14, 0.42], [0.28, 0.42]];
    $("#mbWin").innerHTML = winAt.map(function (q) { var w = mbWorld(core, [q[0] * core.g.R, q[1] * core.g.R]); wins.push({ on: r() > 0.4, t: 2 + r() * 8 }); return '<rect class="mb-win" x="' + mbF(w[0] - 3) + '" y="' + mbF(w[1] - 2) + '" width="6" height="4"/>'; }).join("");
    var winEls = $$("#mbWin .mb-win");
    /* Shooting star (v0.0.37): now and then a streak crosses the night sky */
    var star = { t: 20, x: 0, y: 0 }, starEl = $("#mbStar");
    /* Vents (v0.0.41): puffs of steam rising from two vents on the command platform */
    var vents = [[-0.42, -0.2], [0.38, 0.18]].map(function (q, i) { var w = mbWorld(core, [q[0] * core.g.R, q[1] * core.g.R]); return { x: w[0], y: w[1], t: i * 1.3 }; });
    $("#mbVent").innerHTML = vents.map(function () { return '<circle class="mb-puff" r="3"/><circle class="mb-puff" r="3"/><circle class="mb-puff" r="3"/>'; }).join("");
    var puffEls = $$("#mbVent .mb-puff");
    /* Sonar (v0.0.39): every 20 seconds a slow ring pulses out from the command platform */
    var sonarT = 4;
    var drop = { t: 9, m: null }, dropEl = $("#mbDrop"), dropCn = $("#mbDrop .cn"), dropLn = $("#mbDrop .ln");
    /* Windsock (v0.0.27): beside the command helipad, swinging with the wind and stiffening in gusts */
    var sockP = padOf(mods[0]), sockEl = $("#mbSock"), sock = [sockP[0] + 30, sockP[1] - 18];
    function shipPos(sh, k) { var c = CONT[k], q = mbRot([c[0] + 4.5, c[1] + 3.5], sh.h * Math.PI / 180); return [sh.x + q[0], sh.y + q[1]]; }

    function step(dt) {
      MB.t += dt; var T = MB.t;
      /* Intro: platforms rise in sequence, bridges are laid, then the gauges fill */
      mods.forEach(function (m, i) {
        var a = mbEase((T - 0.15 - i * 0.22) / 0.7), f = mbEase((T - 0.9 - i * 0.22) / 1.7), e = m.ext;
        el.inner[i].setAttribute("transform", a < 1 ? "scale(" + (0.55 + 0.45 * a).toFixed(3) + ")" : "");
        el.mod[i].style.opacity = a < 1 ? a.toFixed(3) : "";
        var H0 = e[3] - e[1], level = e[3] - H0 * m.pct / 100 * f, amp = (m.pct > 0 && m.pct < 100) ? 3 : 0, top = "", pts = [];
        for (var x = e[0] - 4; x <= e[2] + 4; x += 10) pts.push(mbF(x) + "," + mbF(level + amp * Math.sin(x * 0.06 + T * 2.6 + i)));
        top = "M" + pts.join(" L");
        el.fill[i].setAttribute("d", m.pct * f > 0.3 ? top + " L" + mbF(e[2] + 4) + "," + mbF(e[3] + 4) + " L" + mbF(e[0] - 4) + "," + mbF(e[3] + 4) + "Z" : "");
        el.lvl[i].setAttribute("d", amp && f > 0.02 ? top : "");
        el.hatch[i].setAttribute("height", m.st === "done" ? "0" : mbF(Math.max(0, level - e[1] + 3)));
        el.pct[i].textContent = Math.round(m.pct * f) + "%";
      });
      el.br.forEach(function (b, i) {
        var len = +b.getAttribute("data-len"), a = mbEase((T - 0.25 - (i + 1) * 0.22) / 0.8);
        b.style.opacity = a.toFixed(3);
        if (b.classList.contains("built")) $$("line", b).forEach(function (l) { if (a < 1) { l.style.strokeDasharray = len + " " + len; l.style.strokeDashoffset = mbF(len * (1 - a)); } else { l.style.strokeDasharray = ""; l.style.strokeDashoffset = ""; } });
      });
      el.pat.setAttribute("patternTransform", "rotate(45) translate(" + mbF((T * 6) % 9) + " 0)");
      /* Sea and clouds */
      waves.forEach(function (w, i) { w.x += w.sp * dt; if (w.x > MB_W + 30) w.x = -30; var l = el.waves[i]; l.setAttribute("x1", mbF(w.x)); l.setAttribute("x2", mbF(w.x + w.l)); l.setAttribute("y1", mbF(w.y)); l.setAttribute("y2", mbF(w.y)); l.style.opacity = w.o; });
      clouds.forEach(function (c, i) { c.x += c.sp * dt; if (c.x > MB_W + 380) { c.x = -380; c.y = 120 + r() * 660; } el.clouds[i].setAttribute("cx", mbF(c.x)); el.clouds[i].setAttribute("cy", mbF(c.y)); });
      ringT -= dt;
      if (ringT <= 0) { ringT = 0.35 + r() * 0.4; var rm = mods[Math.floor(r() * mods.length)]; if (rm.st !== "next") { var ang = r() * Math.PI * 2, rr = rm.g.R * 1.02; ring(rm.x + Math.cos(ang) * rr, rm.y + Math.sin(ang) * rr, 3, 20, 2.4); } }
      rings.forEach(function (g, i) {
        var c = el.rings[i];
        if (g.t >= 1) { c.style.opacity = "0"; return; }
        g.t = Math.min(1, g.t + dt / g.dur);
        c.setAttribute("cx", mbF(g.x)); c.setAttribute("cy", mbF(g.y)); c.setAttribute("r", mbF(g.r0 + (g.r1 - g.r0) * mbEase(g.t)));
        c.style.opacity = ((1 - g.t) * (g.hot ? 0.9 : 0.35)).toFixed(2); c.classList.toggle("hot", g.hot);
      });
      /* Crews */
      crew.forEach(function (c, i) {
        if (c.wait > 0) c.wait -= dt;
        else if (!c.path.length) { var p = mbPick(c.m, r); c.path = mbRoute(c.m, c.z, p.z); c.path.push(p); c.z = p.z; }
        else {
          var t0 = c.path[0], dx = t0[0] - c.x, dy = t0[1] - c.y, d = mbLen(dx, dy), s = c.sp * dt;
          if (d <= s) { c.x = t0[0]; c.y = t0[1]; c.path.shift(); if (!c.path.length) c.wait = 0.4 + r() * 2.4; }
          else { c.x += dx / d * s; c.y += dy / d * s; }
        }
        el.men[i].setAttribute("cx", mbF(c.x)); el.men[i].setAttribute("cy", mbF(c.y));
      });
      sparks.forEach(function (s, i) {
        s.next -= dt;
        if (s.next <= 0) { var p = mbPick(s.m, r); s.x = p[0]; s.y = p[1]; s.on = 0.25 + r() * 0.35; s.next = s.on + 0.5 + r() * 2; }
        s.on -= dt;
        el.sp[i].setAttribute("cx", mbF(s.x)); el.sp[i].setAttribute("cy", mbF(s.y)); el.sp[i].style.opacity = s.on > 0 ? (0.5 + 0.5 * Math.sin(T * 60 + i)).toFixed(2) : "0";
      });
      walk.forEach(function (w, i) {
        w.u += w.d * w.sp * dt; if (w.u > 1) { w.u = 1; w.d = -1; } if (w.u < 0) { w.u = 0; w.d = 1; }
        var x2 = w.m.x, y2 = w.m.y, len = mbLen(x2 - MB_CX, y2 - MB_CY), ux = (x2 - MB_CX) / len, uy = (y2 - MB_CY) / len, d = 100 + w.u * (len - 180);
        el.walk[i].setAttribute("cx", mbF(MB_CX + ux * d - uy * w.lane)); el.walk[i].setAttribute("cy", mbF(MB_CY + uy * d + ux * w.lane));
      });
      cranes.forEach(function (c, i) { el.cr[i].setAttribute("transform", "translate(" + mbF(c.x) + " " + mbF(c.y) + ") rotate(" + mbF(c.base + 60 * Math.sin(T * c.sp + c.ph)) + ")"); });
      /* Small boats */
      boats.forEach(function (b, i) {
        if (b.delay > 0) { b.delay -= dt; el.hull[i].style.opacity = "0"; el.wake[i].style.opacity = "0"; return; }
        el.hull[i].style.opacity = ""; el.wake[i].style.opacity = "";
        if (b.st === "dock") { b.wait -= dt; if (b.wait <= 0) { var e = edgePoint(); b.tx = e[0]; b.ty = e[1]; b.st = "out"; } }
        else {
          var dx = b.tx - b.x, dy = b.ty - b.y, d = mbLen(dx, dy), s = 40 * (b.st === "in" ? Math.min(1, d / 70) + 0.12 : 1) * dt;
          b.h = Math.atan2(dy, dx) * 180 / Math.PI;
          if (d <= s) { b.x = b.tx; b.y = b.ty; if (b.st === "in") { b.st = "dock"; b.wait = 2.5 + r() * 4; } else { var e2 = edgePoint(), dk = dockFor(); b.x = e2[0]; b.y = e2[1]; b.tx = dk[0]; b.ty = dk[1]; b.st = "in"; b.trail = []; } }
          else { b.x += dx / d * s; b.y += dy / d * s; }
        }
        b.tick += dt; if (b.tick > 0.12) { b.tick = 0; b.trail.push([b.x, b.y]); if (b.trail.length > 18) b.trail.shift(); }
        if (b.st === "dock" && b.trail.length) b.trail.shift();
        el.hull[i].setAttribute("transform", "translate(" + mbF(b.x) + " " + mbF(b.y) + ") rotate(" + mbF(b.h) + ")");
        el.wake[i].setAttribute("points", b.trail.map(function (p) { return mbF(p[0]) + "," + mbF(p[1]); }).join(" ") + " " + mbF(b.x) + "," + mbF(b.y));
      });
      /* Cargo ships: sail in, berth alongside, unload, sail out */
      ships.forEach(function (sh, i) {
        var g = el.ship[i];
        if (sh.st === "wait") {
          sh.wait -= dt; g.style.opacity = "0"; el.swake[i].style.opacity = "0"; el.gang[i].style.opacity = "0";
          if (sh.wait > 0) return;
          var bt = berth(sh.site), o = outward(sh.site), far = 620;
          sh.bx = bt.x; sh.by = bt.y; sh.bh = bt.h; sh.n = bt.n;
          sh.x = bt.x + o[0] * far * 0.9 + bt.n[0] * far * 0.25; sh.y = bt.y + o[1] * far * 0.9 + bt.n[1] * far * 0.25;
          sh.st = "in"; sh.load = 6; sh.trail = []; el.cont[i].forEach(function (c) { c.style.opacity = ""; });
        }
        g.style.opacity = ""; el.swake[i].style.opacity = "";
        if (sh.st === "in") {
          var dx = sh.bx - sh.x, dy = sh.by - sh.y, d = mbLen(dx, dy), s = 44 * (Math.min(1, d / 160) + 0.1) * dt, want = Math.atan2(dy, dx) * 180 / Math.PI;
          if (d < 120) want = sh.bh + 180;
          var diff = ((want - sh.h + 540) % 360) - 180; sh.h += diff * Math.min(1, dt * 1.5);
          if (d <= s) { sh.x = sh.bx; sh.y = sh.by; sh.st = "unload"; } else { sh.x += dx / d * s; sh.y += dy / d * s; }
        } else if (sh.st === "unload") {
          var dh = ((sh.bh + 180 - sh.h + 540) % 360) - 180; sh.h += dh * Math.min(1, dt * 2.5);
          if (sh.load <= 0 && !carriers.some(function (c) { return c.ship === sh; })) { sh.st = "out"; sh.ox = sh.x + outward(sh.site)[0] * 1000; sh.oy = sh.y + outward(sh.site)[1] * 1000 + sh.n[1] * 200; }
        } else if (sh.st === "out") {
          var ox = sh.ox - sh.x, oy = sh.oy - sh.y, od = mbLen(ox, oy), os = 40 * dt;
          var w2 = Math.atan2(oy, ox) * 180 / Math.PI, df = ((w2 - sh.h + 540) % 360) - 180; sh.h += df * Math.min(1, dt * 0.8);
          sh.x += ox / od * os; sh.y += oy / od * os;
          if (sh.x < -120 || sh.x > MB_W + 120 || sh.y < -120 || sh.y > MB_H + 120) { sh.st = "wait"; sh.wait = 4 + r() * 6; sh.site = sites[Math.floor(r() * sites.length)]; }
        }
        sh.tick += dt; if (sh.tick > 0.15) { sh.tick = 0; sh.trail.push([sh.x, sh.y]); if (sh.trail.length > 26) sh.trail.shift(); }
        if (sh.st === "unload" && sh.trail.length) sh.trail.shift();
        g.setAttribute("transform", "translate(" + mbF(sh.x) + " " + mbF(sh.y) + ") rotate(" + mbF(sh.h) + ") scale(1.35)");
        el.swake[i].setAttribute("points", sh.trail.map(function (p) { return mbF(p[0]) + "," + mbF(p[1]); }).join(" ") + " " + mbF(sh.x) + "," + mbF(sh.y));
        var gl = el.gang[i];
        if (sh.st === "unload") { var gp = [sh.x - sh.n[0] * 16, sh.y - sh.n[1] * 16]; gl.setAttribute("x1", mbF(gp[0])); gl.setAttribute("y1", mbF(gp[1])); gl.setAttribute("x2", mbF(sh.x - sh.n[0] * 44)); gl.setAttribute("y2", mbF(sh.y - sh.n[1] * 44)); gl.style.opacity = ""; }
        else gl.style.opacity = "0";
      });
      /* Carriers: from a berthed ship to the stockpile, one crate at a time */
      carriers.forEach(function (c, i) {
        var g = el.carry[i];
        if (c.st === "idle") {
          c.wait -= dt; g.style.opacity = "0";
          if (c.wait > 0) return;
          var sh = ships.filter(function (s) { return s.st === "unload" && s.load > 0; })[0];
          if (!sh) { c.wait = 0.5; return; }
          sh.load--; c.ship = sh; c.k = 5 - sh.load; var gp = [sh.x - sh.n[0] * 52, sh.y - sh.n[1] * 52];
          c.x = gp[0]; c.y = gp[1]; c.st = "toShip"; c.path = [[sh.x - sh.n[0] * 8, sh.y - sh.n[1] * 8]]; c.carry = false;
        }
        g.style.opacity = "";
        var t0 = c.path[0], dx = t0[0] - c.x, dy = t0[1] - c.y, d = mbLen(dx, dy), s = 30 * dt;
        if (d <= s) {
          c.x = t0[0]; c.y = t0[1]; c.path.shift();
          if (c.path.length) { /* next waypoint */ }
          else if (c.st === "toShip") {
            c.st = "toPile"; c.carry = true; var cc = el.cont[ships.indexOf(c.ship)][c.k]; if (cc) cc.style.opacity = "0";
            var slot = piled % pile.length, site = c.ship.site, ps = pileSpot(site, slot), gate = site.core ? null : site.g.zones[site.g.zones.length - 1].gate;
            c.slot = slot; c.path = [[c.ship.x - c.ship.n[0] * 52, c.ship.y - c.ship.n[1] * 52]]; if (gate) c.path.push(mbWorld(site, gate)); c.path.push(ps);
          }
          else if (c.st === "toPile") { pile[c.slot].on = true; pile[c.slot].x = c.x; pile[c.slot].y = c.y; pile[c.slot].age = 0; piled++; MB.cargo++; c.carry = false; c.st = "idle"; c.ship = null; c.wait = 0.2 + r() * 0.5; }
        } else { c.x += dx / d * s; c.y += dy / d * s; }
        g.setAttribute("transform", "translate(" + mbF(c.x) + " " + mbF(c.y) + ")");
        g.firstChild.style.opacity = c.carry ? "" : "0";
      });
      pile.forEach(function (p, i) {
        var e = el.pile[i];
        if (!p.on) { e.style.opacity = "0"; return; }
        p.age += dt;
        if (p.age > 7 + (i % 4)) { p.on = false; ring(p.x, p.y, 2, 14, 0.8, true); }
        e.setAttribute("x", mbF(p.x - 4)); e.setAttribute("y", mbF(p.y - 3.5)); e.style.opacity = "";
      });
      commsEl.setAttribute("transform", "translate(" + mbF(comms[0]) + " " + mbF(comms[1]) + ") rotate(" + mbF((T * 40) % 360) + ")");
      commsT -= dt; if (commsT <= 0) { commsT = 2.6; ring(comms[0], comms[1], 6, 70, 2.4, false); }
      var gust = 0.5 + 0.5 * Math.sin(T * 0.37) * Math.sin(T * 0.11 + 1), wind = 25 + 18 * Math.sin(T * 0.21) + 6 * Math.sin(T * 1.3);
      sockEl.setAttribute("transform", "translate(" + mbF(sock[0]) + " " + mbF(sock[1]) + ") rotate(" + mbF(wind) + ") scale(" + (0.75 + gust * 0.4).toFixed(2) + " " + (1 - gust * 0.25).toFixed(2) + ")");
      brL.forEach(function (l, i) { var k = Math.floor(T * 5) % 9; brEls[i].style.opacity = k === l.q ? "1" : "0.25"; });
      srchEl.setAttribute("transform", "translate(" + mbF(core.x) + " " + mbF(core.y) + ") rotate(" + mbF((T * 14) % 360) + ")");
      var fw = Math.sin(T * 4.2), fw2 = Math.sin(T * 4.2 + 1.3);
      flagP.setAttribute("d", "M0 -26 Q7 " + mbF(-27 + fw * 2) + " 15 " + mbF(-23 + fw2 * 1.6) + " Q7 " + mbF(-20 + fw * 1.6) + " 0 -19 Z");
      wins.forEach(function (w, i) { w.t -= dt; if (w.t <= 0) { w.on = !w.on; w.t = 3 + r() * 9; } winEls[i].style.opacity = w.on ? "1" : "0.12"; });
      vents.forEach(function (v, i) { v.t += dt; for (var k = 0; k < 3; k++) { var ph = ((v.t + k * 1.1) % 3.3) / 3.3, el2 = puffEls[i * 3 + k]; el2.setAttribute("cx", mbF(v.x + Math.sin(ph * 5 + i) * 3 + ph * 10)); el2.setAttribute("cy", mbF(v.y - ph * 26)); el2.setAttribute("r", mbF(2 + ph * 5)); el2.style.opacity = (Math.sin(ph * Math.PI) * 0.5).toFixed(2); } });
      sonarT -= dt; if (sonarT <= 0) { sonarT = 20; ring(core.x, core.y, core.g.R * 1.1, core.g.R * 4.2, 5.5, false); }
      star.t += dt;
      if (star.t > 38) { star.t = 0; star.x = 80 + r() * (MB_W - 480); star.y = 30 + r() * 160; }
      var sk = star.t / 0.9;
      if (sk < 1) { var sx = star.x + 300 * sk, sy = star.y + 100 * sk; starEl.setAttribute("x1", mbF(sx - 60)); starEl.setAttribute("y1", mbF(sy - 20)); starEl.setAttribute("x2", mbF(sx)); starEl.setAttribute("y2", mbF(sy)); starEl.setAttribute("opacity", mbF(Math.sin(sk * Math.PI))); }
      else starEl.setAttribute("opacity", "0");
      drop.t += dt;
      if (drop.t > 30 || !drop.m) { var built = mods.filter(function (m) { return m.st !== "next"; }); drop.m = built[Math.floor(r() * built.length)] || core; drop.t = 0; drop.ox = (r() - 0.5) * drop.m.g.R * 0.6; drop.oy = (r() - 0.5) * drop.m.g.R * 0.6; }
      var dk = Math.min(drop.t / 7, 1), de = 1 - Math.pow(1 - dk, 2), dsw = Math.sin(drop.t * 1.6) * 6 * (1 - dk);
      dropEl.setAttribute("transform", "translate(" + mbF(drop.m.x + drop.ox + dsw) + " " + mbF(drop.m.y + drop.oy - 90 * (1 - de)) + ") scale(" + mbF(1.6 - 0.6 * de) + ")");
      dropEl.setAttribute("opacity", drop.t < 1 ? mbF(drop.t) : drop.t > 11 ? mbF(Math.max(0, 12 - drop.t)) : "1");
      var cnA = drop.t < 7 ? 1 : Math.max(0, 1 - (drop.t - 7) / 1.2); dropCn.style.opacity = cnA; dropLn.style.opacity = cnA;
      padL.forEach(function (l, i) {
        var fast = H.to === l.m && H.st === "fly", k = Math.floor(T * (fast ? 8 : 2.5)) % 4;
        padEls[i].style.opacity = k === l.q ? "1" : (fast ? "0.25" : "0.12");
      });
      buoys.forEach(function (b, i) {
        var e = buoyEls[i], t = (T + b.ph) % b.per, bob = 1 + 0.08 * Math.sin(T * 1.7 + b.ph);
        e.lastChild.style.opacity = t < 0.35 ? "1" : "0.15";
        e.childNodes[1].setAttribute("r", mbF(4.6 * bob));
        e.firstChild.setAttribute("r", mbF(5 + ((T * 0.6 + b.ph) % 1) * 9)); e.firstChild.style.opacity = (0.35 * (1 - ((T * 0.6 + b.ph) % 1))).toFixed(2);
      });
      gulls.forEach(function (g, i) {
        g.cx += g.vx * dt; g.cy += g.vy * dt;
        if (g.cx > MB_W + 120) { g.cx = -120; g.cy = 160 + r() * 560; }
        var a = T * g.w + g.ph, x = g.cx + Math.cos(a) * g.R, y = g.cy + Math.sin(a) * g.R * 0.8;
        var hd = Math.atan2(Math.cos(a) * g.w * 0.8, -Math.sin(a) * g.w) * 180 / Math.PI;
        var flapping = Math.sin(T * 0.7 + g.fl) > 0.35, f = flapping ? 0.35 + 0.65 * Math.abs(Math.sin(T * 9 + g.fl)) : 0.55;
        gullEls[i].setAttribute("transform", "translate(" + mbF(x) + " " + mbF(y) + ") rotate(" + mbF(hd + 90) + ")");
        gullEls[i].lastChild.setAttribute("transform", "scale(1 " + f.toFixed(2) + ")");
        var so = mbRot([9, 13], -(hd + 90) * Math.PI / 180);
        gullEls[i].firstChild.setAttribute("transform", "translate(" + mbF(so[0]) + " " + mbF(so[1]) + ") scale(0.9 " + f.toFixed(2) + ")");
      });
      /* Selection ring */
      var sm = mods[MB.sel];
      if (sm) {
        var rad = Math.max(sm.ext[2] - sm.ext[0], sm.ext[3] - sm.ext[1]) / 2 + 10;
        el.sel.setAttribute("transform", "translate(" + mbF(sm.x + (sm.ext[0] + sm.ext[2]) / 2) + " " + mbF(sm.y + (sm.ext[1] + sm.ext[3]) / 2) + ") rotate(" + mbF((T * 14) % 360) + ")");
        el.selR[0].setAttribute("r", mbF(rad)); el.selR[1].setAttribute("r", mbF(rad + 7 + 2 * Math.sin(T * 3)));
      }
      /* Helicopter: wait on a pad, lift, fly, settle */
      H.t -= dt;
      if (H.st === "wait") { H.alt = Math.max(0, H.alt - dt * 0.8); if (H.t <= 0) { H.st = "fly"; H.k = 0; var a2 = padOf(H.to); H.sx = H.x; H.sy = H.y; H.ex = a2[0]; H.ey = a2[1]; H.dur = Math.max(2.5, mbLen(H.ex - H.sx, H.ey - H.sy) / 95); H.h = Math.atan2(H.ey - H.sy, H.ex - H.sx) * 180 / Math.PI; } }
      else {
        H.k += dt; var k = Math.min(1, H.k / H.dur), e3 = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        H.x = H.sx + (H.ex - H.sx) * e3; H.y = H.sy + (H.ey - H.sy) * e3; H.alt = Math.min(1, H.alt + dt);
        if (k >= 1) { H.st = "wait"; H.t = 3 + r() * 3; H.to = H.to === mods[0] ? (cur === mods[0] ? mods[1 + Math.floor(r() * (mods.length - 1))] || mods[0] : cur) : mods[0]; }
      }
      var off = 3 + H.alt * 14;
      el.hsh.setAttribute("cx", mbF(H.x + off)); el.hsh.setAttribute("cy", mbF(H.y + off * 1.3)); el.hsh.style.opacity = (0.35 - H.alt * 0.15).toFixed(2);
      el.heli.setAttribute("transform", "translate(" + mbF(H.x) + " " + mbF(H.y) + ") scale(" + (1 + H.alt * 0.2).toFixed(2) + ")");
      el.hb.setAttribute("transform", "rotate(" + mbF(H.h) + ")");
      var spin = (T * (H.st === "wait" && H.alt < 0.05 ? 160 : 1500)) % 360;
      /* Navigation lights (v0.0.30): red and green steady, the white tail light blinks */
      el.hb.lastChild.style.opacity = (T % 1.2) < 0.15 ? "1" : "0.15";
      el.rot[0].setAttribute("transform", "rotate(" + mbF(spin) + ")"); el.rot[1].setAttribute("transform", "rotate(" + mbF(spin) + ")");
    }
    if (!opts.motion) { MB.t = 30; step(0); return; }
    step(0);
    function frame(ts) {
      if (!MB || currentView !== "roadmap" || !document.body.contains(svg)) { mbStop(); return; }
      var dt = MB.last ? Math.min(0.05, (ts - MB.last) / 1000) : 0; MB.last = ts;
      step(dt);
      MB.raf = requestAnimationFrame(frame);
    }
    MB.raf = requestAnimationFrame(frame);
  }
