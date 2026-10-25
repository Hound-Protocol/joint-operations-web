  /* ---------------- Documentation ----------------
     The Docs section is the dossier cabinet (17b-cabinet.js). loadDoc reads a document from the bundled copy,
     the deployed site or GitHub. */
  /* #/docs asks first: Library or Handbook. #/docs/library opens the Library on its Overview; #/docs/<id> opens a document. */
  function viewDocs(id) { if (!id) return viewDocPick(); return viewCabinet(id === "library" ? "" : id); }
  /* The two zones' own icons: a filing cabinet for the Library, a ring binder for the Handbook */
  var ZONE_ICO = {
    lib: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="4" width="30" height="40" rx="1.5"/><path d="M9 17.5h30M9 31h30"/><rect class="zi-f" x="19" y="8.5" width="10" height="4"/><rect class="zi-f" x="19" y="22" width="10" height="4"/><rect class="zi-f" x="19" y="35.5" width="10" height="4"/><path d="M12 47h4M32 47h4"/></svg>',
    hb: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 4h26v40H13z"/><path class="zi-f" d="M13 4h6v40h-6z"/><circle cx="16" cy="13" r="2.4"/><circle cx="16" cy="24" r="2.4"/><circle cx="16" cy="35" r="2.4"/><path d="M24 14h10M24 19h10M24 24h7"/><path class="zi-s" d="M25 34l9-6"/></svg>'
  };
  function docCounts() {
    var all = (data.docs && data.docs.docs) || [], hb = ((data.guides && data.guides.guides) || []).length || all.filter(function (d) { return d.group === "Handbook"; }).length;
    return { lib: all.filter(function (d) { return d.group !== "Handbook"; }).length, hb: hb };
  }
  /* The first step of Docs: two large doors, each with its texture, icon and a clear way in */
  function viewDocPick() {
    var v = $("#view");
    function door(id, href, name, kick, sub, go) {
      var n = docCounts()[id];
      return '<a class="door d-' + id + '" href="' + href + '"><span class="door-tex" aria-hidden="true"></span><span class="door-ico">' + ZONE_ICO[id] + '</span>' +
        '<span class="door-t"><small>' + kick + "</small><b>" + name + '</b><span class="door-n">' + (n ? n + " documents" : "&nbsp;") + "</span><span>" + sub + "</span></span>" +
        '<span class="door-go">' + go + '<i aria-hidden="true">→</i></span></a>';
    }
    v.innerHTML = shell("Documentation", "Choose a zone",
      '<p class="sub">Documentation has two zones. Pick one; you can switch at any time from the bar at the top.</p>' +
      '<div class="doors">' +
      door("lib", "#/docs/library", "Library", "Zone 1 · Reference", "Plans, decisions, research, the Dev Log, technical and legal. Start here to understand the project.", "Open the Library") +
      door("hb", "#/guides", "Handbook", "Zone 2 · How to", "Guides, policies and procedures: how to play, contribute, test and run Hound Protocol. Printable on A4.", "Open the Handbook") +
      "</div>");
    Promise.all([loadLocal("docs"), loadLocal("guides")]).then(function () {
      if (currentView !== "docs" || !$(".doors")) return;
      var c = docCounts(); $$(".door").forEach(function (a) { var n = c[a.classList.contains("d-lib") ? "lib" : "hb"]; $(".door-n", a).textContent = n ? n + " documents" : ""; });
    }, function () {});
  }
  /* Documentation has two zones: the Library (plans, decisions, research, the Dev Log…) and the Handbook (guides, policies, procedures) */
  function docZones(active) {
    var all = (data.docs && data.docs.docs) || [], hb = ((data.guides && data.guides.guides) || []).length || all.filter(function (d) { return d.group === "Handbook"; }).length;
    var lib = all.filter(function (d) { return d.group !== "Handbook"; }).length;
    function z(id, href, name, sub) {
      return '<a class="zone z-' + id + (active === id ? " on" : "") + '" href="' + href + '"' + (active === id ? ' aria-current="page"' : "") + '><span class="door-tex" aria-hidden="true"></span><span class="z-ico" aria-hidden="true">' + ZONE_ICO[id] + "</span><b>" + name + "</b><small>" + sub + '</small><i class="z-go" aria-hidden="true">' + (active === id ? "You are here" : "Switch →") + "</i></a>";
    }
    return '<nav class="zones" aria-label="Documentation zones">' +
      z("lib", "#/docs/library", "Library", (lib ? lib + " documents · " : "") + "plans, decisions, research, the dev log, technical and legal") +
      z("hb", "#/guides", "Handbook", (hb ? hb + " documents · " : "") + "guides, policies and procedures, printable on A4") + "</nav>";
  }
  function addZones(active) { var vh = $(".vh"); if (vh && !$(".zones")) vh.insertAdjacentHTML("afterend", docZones(active)); }
  function loadDoc(doc) {
    if (docCache[doc.path]) return Promise.resolve(docCache[doc.path]);
    if (EMBED && EMBED.content && EMBED.content[doc.path] != null) return Promise.resolve(docCache[doc.path] = EMBED.content[doc.path]);
    var raw = "https://raw.githubusercontent.com/" + cfg.repo + "/" + cfg.branch + "/" + doc.path;
    return fetchText("content/" + doc.path).catch(function () { return fetchText(raw); }).then(function (t) { docCache[doc.path] = t; return t; });
  }
