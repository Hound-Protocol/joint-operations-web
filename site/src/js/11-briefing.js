  /* Briefing */
  function hl(t) { return esc(t).replace(/\{\{([^}]+)\}\}/g, '<mark class="key">$1</mark>'); }
  /* Line icons for the Start here buttons, drawn for this site on a 24 x 24 grid */
  var TRI_ICONS = {
    overview: '<svg class="tri-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/></svg>',
    contribute: '<svg class="tri-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v3H8z"/><path d="M8 5.5H5V21h14V5.5h-3"/><path d="M12 10.5v7M8.5 14h7"/></svg>',
    linux: '<svg class="tri-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="1"/><path d="M6.5 9.5l3 2.5-3 2.5M11.5 15h5"/></svg>',
    web: '<svg class="tri-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z"/></svg>'
  };
  function viewBriefing() {
    var v = $("#view");
    v.innerHTML = shell("Overview", "About Joint Operations", loading("Loading"));
    loadLocal("briefing").then(function () {
      if (currentView !== "briefing") return;
      var b = data.briefing || {};
      $("#vb").innerHTML = '<div class="bf ab">' +
        '<section class="bf-sec ab-hero"><div class="ab-copy"><span class="ab-kick">MGSV: Joint Operations · by Hound Protocol</span><h3 class="bf-head">' + hl(b.headline || "") + "</h3>" +
          (b.summary || []).map(function (t) { return '<p class="bf-lead">' + hl(t) + "</p>"; }).join("") +
          '<div class="toolbar"><a class="btn primary" href="#/contribute">Join the Hound</a><a class="btn" href="#/roadmap">Roadmap</a><a class="btn" href="#/guides/hp-gde-001">Player Guide</a></div></div></section>' +
        /* Start here: one big button on top (the Overview), three beneath it, joined like a triangle */
        '<section class="bf-sec ab-tri-sec"><nav class="ab-tri" aria-label="Start here">' +
          '<a class="tri-b tri-top" href="#/docs/overview" style="--c:#f28c28; --k:0">' + TRI_ICONS.overview + '<span class="tri-t"><small>Start here · Library</small><b>Overview</b><span>What Joint Operations is, how a session works and where the project stands.</span></span><i class="tri-go" aria-hidden="true"></i></a>' +
          '<svg class="tri-lines" viewBox="0 0 600 48" preserveAspectRatio="none" aria-hidden="true"><path d="M300 0 L0 48 M300 0 L300 48 M300 0 L600 48"/></svg>' +
          '<div class="tri-row">' + [["hp-gde-017", "HP-GDE-017", "Can I Contribute?", "Find where you fit in five questions.", "#7fbf8a", "contribute"], ["hp-gde-002", "HP-GDE-002", "Linux and Proton", "Play on Linux, Bazzite and Steam Deck.", "#4fb3d9", "linux"], ["hp-gde-015", "HP-GDE-015", "Using the Website", "Every section, search, sign-in and clearance.", "#c9a24a", "web"]].map(function (g, k) {
            return '<a class="tri-b" href="#/guides/' + g[0] + '" style="--c:' + g[4] + "; --k:" + (k + 1) + '">' + TRI_ICONS[g[5]] + '<span class="tri-t"><small>' + g[1] + "</small><b>" + esc(g[2]) + "</b><span>" + esc(g[3]) + '</span></span><i class="tri-go" aria-hidden="true"></i></a>';
          }).join("") + "</div></nav>" +
          '<p class="tri-faq">Questions? The <a href="#/docs/faq">Frequently Asked Questions</a> are in the Library.</p></section>' +
        "</div>";
      revealSections();
      refreshInfo();
    });
  }
  function revealSections() {
    var secs = $$(".bf-sec");
    function show(el) { if (el.classList.contains("in")) return; el.classList.add("in"); $$("[data-to]", el).forEach(countUp); }
    if (!("IntersectionObserver" in window)) { secs.forEach(show); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }); }, { root: $("#center"), threshold: 0.12 });
    secs.forEach(function (el, k) { setTimeout(function () { io.observe(el); }, k * 90); });
  }
  function countUp(el) {
    var to = +el.dataset.to, t0 = null;
    if (!opts.motion || to === 0) { el.textContent = to; return; }
    function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }


