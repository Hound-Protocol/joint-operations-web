  /* ---------------- Handbook previews ----------------
     Hovering or focusing any button that links to a Handbook document shows a small preview of that sheet, as wide
     as the button: its code, type, title and summary. The Handbook is the source of truth, so buttons point there. */
  var hbpT = null, HBP_SEL = 'a.btn[href^="#/' + 'guides/hp-"], a.hb-link';
  function hbpFor(el) {
    var m = /#\/guides\/(hp-(?:gde|pol|sop)-\d{3})/.exec(el.getAttribute("href") || "");
    var list = (data.guides && data.guides.guides) || [];
    return m && list.filter(function (g) { return g.id === m[1]; })[0];
  }
  function hbpShow(el) {
    var g = hbpFor(el); if (!g) return;
    hbpHide(true);
    var r = el.getBoundingClientRect(), w = Math.max(r.width, 200);
    document.body.insertAdjacentHTML("beforeend", '<div class="hbp t-' + esc(g.type.toLowerCase()) + '" id="hbp" role="tooltip"><span class="hbp-top"><b>' + esc(g.code) + "</b><i>" + esc(g.type) + " · v" + esc(g.version) + '</i></span><span class="hbp-t">' + esc(g.title) + '</span><span class="hbp-s">' + esc(g.summary) + '</span><span class="hbp-go">Open in the Handbook →</span></div>');
    var p = $("#hbp"), left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8), below = r.bottom + 10 + 170 < window.innerHeight;
    p.style.width = w + "px"; p.style.left = left + "px";
    if (below) p.style.top = (r.bottom + 8) + "px"; else { p.style.top = (r.top - 8) + "px"; p.classList.add("up"); }
  }
  function hbpHide(now) { clearTimeout(hbpT); var p = $("#hbp"); if (!p) return; if (now || !opts.motion) { p.remove(); return; } p.classList.add("out"); setTimeout(function () { if (p.parentNode) p.remove(); }, 160); }
  function hbpTarget(e) { var t = e.target && e.target.closest ? e.target.closest(HBP_SEL) : null; return t && hbpFor(t) ? t : null; }
  document.addEventListener("mouseover", function (e) { var t = hbpTarget(e); if (!t) return; clearTimeout(hbpT); hbpT = setTimeout(function () { hbpShow(t); }, 180); });
  document.addEventListener("mouseout", function (e) { if (hbpTarget(e)) { clearTimeout(hbpT); hbpHide(); } });
  document.addEventListener("focusin", function (e) { var t = hbpTarget(e); if (t) hbpShow(t); });
  document.addEventListener("focusout", function (e) { if (hbpTarget(e)) hbpHide(); });
  window.addEventListener("hashchange", function () { hbpHide(true); });
  document.addEventListener("scroll", function () { hbpHide(true); }, true);
