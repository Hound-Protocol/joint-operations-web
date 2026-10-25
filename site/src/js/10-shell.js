  /* ---------------- Views ---------------- */
  var currentView = "";
  /* The Handbook (guides) is a zone of Documentation, so it lights the Docs tab */
  function tabOf(v) { return v === "guides" ? "docs" : v; }
  function shell(kicker, title, body) {
    var cv = tabOf(currentView), now = ITEMS.filter(function (it) { return it.id === cv; })[0];
    var tabs = '<div class="secwrap"><nav class="secbar" aria-label="Sections">' + ITEMS.map(function (it) {
      return '<a href="#/' + it.id + '" class="tab-' + it.id + '" data-desc="' + esc(it.desc) + '"' + (it.id === cv ? ' aria-current="page"' : "") + ">" + menuIcon(it.id) + "<span>" + esc(it.tab) + "</span></a>";
    }).join("") + '</nav><div class="secdesc" id="secDesc" aria-hidden="true">' + esc(now ? now.desc : "") + "</div></div>";
    return tabs + '<div class="vh"><div><span class="kicker">' + esc(kicker) + '</span><h2>' + esc(title) + '</h2></div><a class="btn" href="#/">Menu</a></div><div id="vb">' + body + "</div>";
  }
  function milestone(key) { var m = cfg.milestones && cfg.milestones[key]; return m ? '<p class="note">' + esc(m) + "</p>" : ""; }
  function loading(t) { return '<p class="sub"><span class="spin"></span>' + esc(t) + "</p>"; }
  var ICON_CHAT = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h.01M12 10h.01M16 10h.01" stroke-width="2.4" stroke-linecap="round"/></svg>';
  var ICON_WIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5l8-1v8H3zM13 4l8-1v9h-8zM3 13h8v7l-8-1zM13 13h8v8l-8-1z"/></svg>';
  var ICON_LNX = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13"/><path d="M8 21h8M12 17v4M7 9l3 2-3 2M12 13h4"/></svg>';

  /* Section bar: the description under the bar follows the tab you point at, and returns to the current section */
  (function () {
    var t = 0;
    function show(a) {
      var d = $("#secDesc"); if (!d) return;
      var txt = a ? a.getAttribute("data-desc") : ((ITEMS.filter(function (it) { return it.id === tabOf(currentView); })[0] || {}).desc || "");
      if (d.textContent === txt) { d.classList.remove("out"); return; }
      d.classList.add("out"); clearTimeout(t);
      t = setTimeout(function () { d.textContent = txt; d.classList.remove("out"); }, opts.motion ? 140 : 0);
    }
    function find(e) { var el = e.target; while (el && el !== document && !(el.tagName === "A" && el.parentNode && el.parentNode.className === "secbar")) el = el.parentNode; return el && el !== document ? el : null; }
    document.addEventListener("mouseover", function (e) { var a = find(e); if (a) show(a); });
    document.addEventListener("focusin", function (e) { var a = find(e); if (a) show(a); });
    document.addEventListener("mouseout", function (e) { var a = find(e); if (a && !(e.relatedTarget && find({ target: e.relatedTarget }))) show(null); });
  })();
