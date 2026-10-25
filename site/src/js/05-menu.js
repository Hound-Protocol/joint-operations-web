  /* ---------------- Menu ---------------- */
  var ITEMS = [
    { id: "briefing", title: "About Joint Operations", desc: "What it is, how it works, and where it stands", tab: "About" },
    { id: "roadmap", title: "Roadmap", desc: "Where we are and what comes next", tab: "Roadmap", tabOnly: true },
    { id: "download", title: "Download", desc: "Get Joint Operations for Windows or Linux", tab: "Download" },
    { id: "sessions", title: "Session Browser", desc: "Find, host and join Joint Operations sessions", tab: "Sessions" },
    { id: "contribute", title: "Contribute", desc: "Take a contract and help build Joint Operations", tab: "Contribute" },
    { id: "team", title: "Team", desc: "Chain of command and the people behind Hound Protocol", tab: "Team", tabOnly: true },
    { id: "mods", title: "Mods", desc: "Mods tested to work with Joint Operations", tab: "Mods" },
    { id: "docs", title: "Documentation", desc: "The handbook, plans, decisions, research and the dev log", tab: "Docs" },
    { id: "options", title: "Options", desc: "Sound, motion and display settings", tab: "Options" }
  ];
  /* Menu icons: simple line glyphs drawn for this site, on a 24 x 24 grid */
  var MENU_ICONS = {
    briefing: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v3h3M9 10h6M9 14h6M9 18h4"/>',
    roadmap: '<path d="M4 18l5-5 4 3 7-8"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="8" r="1.5"/>',
    download: '<path d="M12 3v11M7 10l5 5 5-5M4 17v3h16v-3"/>',
    sessions: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l5.5-5.5M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    contribute: '<path d="M8 4h8v3H8z"/><path d="M8 5.5H5V21h14V5.5h-3"/><path d="M8.5 13.5l2.5 2.5 4.5-5"/>',
    team: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 5.5a3 3 0 010 5.5M18 14.5c1.8.9 3 2.9 3 5.5"/>',
    mods: '<path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z"/><path d="M3.5 7.3L12 12l8.5-4.7M12 12v9.5"/>',
    guides: '<path d="M12 6.5C10 5 7 4.5 3 5v14c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z"/><path d="M12 6.5v14"/>',
    docs: '<path d="M4 6h6l2 2h8v11H4z"/><path d="M4 10h16"/>',
    options: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'
  };
  function menuIcon(id) { return MENU_ICONS[id] ? '<svg class="mi" viewBox="0 0 24 24" aria-hidden="true">' + MENU_ICONS[id] + "</svg>" : ""; }
  var MENU = ITEMS.filter(function (it) { return !it.tabOnly; });
  var cur = 0;
  function itemInfo(id) {
    switch (id) {
      case "briefing":
        var ph = currentPhase();
        return ph ? "Current: Phase " + ph.n + " · " + ph.title + " · " + ph.done + " of " + ph.total + " done" : "Project overview";
      case "roadmap":
        return "Roadmap";
      case "team":
        return "Team";
      case "download":
        if (data.releases === undefined) return "Checking releases";
        if (playableReleases().length) return "Latest " + (playableReleases()[0].tag_name || "") + " · " + fmtDate(playableReleases()[0].published_at);
        return cfg.stage + " · No playable release yet";
      case "sessions":
        var n = data.servers ? (data.servers.servers || []).length : 0;
        return n ? plural(n, "session") + " listed" : "No sessions online";
      case "contribute":
        var list = contractList(), open = list.filter(function (c) { return c.status === "open" || c.status === "planned"; }).length;
        return list.length ? plural(open, "open contract") + " · " + plural(list.length, "total contract") : "Contract board";
      case "mods":
        var md = data.mods || { compatible: [], issues: [] };
        return (md.compatible || []).length + " compatible · " + (md.issues || []).length + " with known issues";
      case "docs":
        return data.docs ? plural((data.docs.docs || []).length, "document") : "Documentation library";
      case "options":
        return "Saved on this device";
    }
    return "";
  }
  /* Home side panels: the project on the left, Hound Protocol on the right (config.about) */
  function renderAbout() {
    var a = cfg.about || {};
    [["#aboutProject", a.project, BRAND.joColor], ["#aboutTeam", a.team, BRAND.hpColor]].forEach(function (s) {
      var el = $(s[0]), p = s[1];
      if (!el) return;
      el.hidden = !p;   // the menu renders before config loads, so this must also un-hide
      if (!p) return;
      el.innerHTML = '<div class="s-mark">' + s[2] + '</div><div class="s-label">' + esc(p.label) + "</div>" +
        '<h2 class="s-title">' + esc(p.title) + "</h2>" +
        '<p class="s-text">' + esc(p.text) + "</p>" +
        ((p.facts || []).length ? '<dl class="s-facts">' + p.facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>" : "") +
        (p.link ? '<a class="s-link" href="' + esc(p.link[1]) + '"' + (/^https?:/.test(p.link[1]) ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(p.link[0]) + ' <span aria-hidden="true">' + (/^https?:/.test(p.link[1]) ? "↗" : "→") + "</span></a>" : "");
    });
    // Hound Protocol panel: live Discord count when the widget is available
    loadDiscord().then(function (d) {
      var dl = $("#aboutTeam .s-facts");
      if (!d || !dl || $("#dOnline")) return;
      dl.insertAdjacentHTML("afterbegin", '<div id="dOnline"><dt>Discord</dt><dd><a href="' + esc(cfg.links.discord || d.invite) + '" target="_blank" rel="noopener noreferrer"><i class="live"></i>' + plural(d.online, "member") + " online</a></dd></div>");
    });
  }
  function renderMenu() {
    renderAbout();
    if ($("#hdMark")) $("#hdMark").innerHTML = BRAND.hpColor;
    $("#menu").innerHTML = MENU.map(function (it, n) {
      return '<a href="#/' + it.id + '" class="mi-' + it.id + '" data-n="' + n + '" style="--i:' + n + '" aria-description="' + esc(it.desc) + '"><i class="hl"></i><span class="t">' + menuIcon(it.id) + '<span>' + esc(it.title) + '</span></span><span class="win' + (it.desc.length > 56 ? " long" : "") + '" aria-hidden="true"><span class="d"></span></span></a>';
    }).join("");
    $$("#menu a").forEach(function (a) {
      var n = +a.dataset.n;
      a.addEventListener("mouseenter", function () { select(n, false); });
      a.addEventListener("focus", function () { select(n, false); });
    });
    // Discord icon hook: set links.discordIcon in config.json to Discord's official logo file.
    var dIcon = cfg.links.discordIcon ? '<img class="ico" src="' + esc(cfg.links.discordIcon) + '" alt="">' : ICON_CHAT;
    var links = [["Discord", cfg.links.discord, dIcon], ["GitHub", cfg.links.github, ""]];
    $("#links").innerHTML = links.map(function (l) {
      return l[1] ? '<a class="btn" href="' + esc(l[1]) + '" target="_blank" rel="noopener noreferrer">' + l[2] + l[0] + "</a>"
        : '<span class="btn off" aria-disabled="true" title="Invite link coming soon">' + l[2] + l[0] + "</span>";
    }).join("");
  }
  function typeInto(el, text) {
    el.textContent = "";
    for (var k = 0; k < text.length; k++) {
      var c = document.createElement("span"); c.className = "ch"; c.textContent = text[k] === " " ? "\u00a0" : text[k];
      c.style.animationDelay = (k * 9) + "ms"; el.appendChild(c);
    }
    var cur = document.createElement("i"); cur.className = "cur"; el.appendChild(cur);
  }
  function select(n, focus) {
    var prev = cur;
    cur = (n + MENU.length) % MENU.length;
    $$("#menu a").forEach(function (a, j) {
      var on = j === cur, d = a.querySelector(".d");
      if (compact()) { if (!d.childNodes.length) d.textContent = MENU[j].desc; }
      else {
        if (on && (!a.classList.contains("on") || prev !== cur || !d.childNodes.length)) typeInto(d, MENU[j].desc);
        if (!on && d) d.textContent = "";
      }
      a.classList.toggle("on", on);
    });
    if (prev !== cur && focus) blip("move");
    if (focus) { var a = $$("#menu a")[cur]; if (a) a.focus({ preventScroll: false }); }
    led($("#ledInfo"), itemInfo(MENU[cur].id));
  }
  function refreshInfo() { if (!currentView) led($("#ledInfo"), itemInfo(MENU[cur].id)); }
