  /* ---------------- Docs: dossier cabinet ----------------
     Every library group is a drawer of folders. Opening a folder lays the document on the desk beside the cabinet:
     a typed page clipped into a kraft folder, with paper and colour that show its class (policy, procedure, guide,
     decision record, research, technical, community, project, legal).
     Search (Ctrl+K or /) filters the folders themselves, Library only: every word must match the file number, the title
     or the text. Matching folders stay in their drawers, best first; arrow keys move between them, Enter opens one, and
     the opened page highlights and scrolls to the first match. */
  var CAB_GROUPS = {
    Handbook: ["HB", "#c9a24a", "#7d5f15"], Decisions: ["ADR", "#e0453f", "#a3352b"], Research: ["RES", "#5aa7d6", "#1d6a8a"],
    Technical: ["TEC", "#f28c28", "#a8560f"], Community: ["COM", "#7fbf8a", "#3b7446"], Project: ["PRJ", "#c9d0d2", "#4d5a60"], Legal: ["LEG", "#b07cd6", "#6e4a96"],
    Staff: ["LV3", "#7fbf8a", "#3b7446"], Leads: ["LV5", "#f28c28", "#a8560f"], Administration: ["LV6", "#a77de0", "#5e3d8f"]
  };
  var CAB_CLASS = { Decisions: ["decision", "Decision record"], Research: ["research", "Research"], Technical: ["technical", "Technical"],
    Community: ["community", "Community"], Project: ["project", "Project"], Legal: ["legal", "Legal"],
    Staff: ["restricted", "Restricted"], Leads: ["restricted", "Restricted"], Administration: ["restricted", "Restricted"] };
  var CAB_ORDER = ["Project", "Handbook", "Decisions", "Research", "Technical", "Community", "Legal", "Staff", "Leads", "Administration"];
  /* Clearance. Everything in the public repository is LV1: anyone can read it. Restricted documents live in private
     repositories, one per clearance (config.signin.areas); GitHub itself decides who can read them (ADR 0011, 0017).
     Each restricted area is a drawer: its files when your card and GitHub both allow it, otherwise one locked file. */
  var cabX = {}, cabDocs = [];
  /* Search by name or by content: a small switch under each search box (Library and Handbook) */
  function smSwitch(id, mode) {
    return '<div class="sm" role="group" aria-label="Search by" id="' + id + 'Sm"><span>Search by</span>' +
      [["name", "Name"], ["text", "Content"]].map(function (m) { return '<button type="button" data-sm="' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + "</button>"; }).join("") + "</div>";
  }
  function smWire(id, on) {
    $$("#" + id + "Sm [data-sm]").forEach(function (b) {
      b.addEventListener("click", function () { $$("#" + id + "Sm [data-sm]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); blip(); on(b.getAttribute("data-sm")); });
    });
  }
  function cabLvl() { return siIn() || sgIn() ? siLevel() : 1; }
  function cabSlug(p) { return p.replace(/\.md$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(); }
  function cabXDocs(onChange) {
    var areas = (cfg.signin && cfg.signin.areas) || [], out = [], lvl = cabLvl(), who = typeof siIn === "function" && siIn() ? SI.user.id : (sgIn() ? "guest" : 0);
    areas.forEach(function (a, i) {
      var need = +String(a.card).slice(2), st = cabX[i];
      if (st && st.who !== who) st = cabX[i] = null;
      var base = { group: a.title, restricted: { area: i, repo: a.repo, card: a.card, need: need } };
      function lock(why) { return [Object.assign({ id: "r" + i + "-restricted", title: a.title + " files", locked: why }, base)]; }
      if (lvl < need) { out = out.concat(lock("level")); return; }
      if (!st) {
        st = cabX[i] = { who: who, state: "loading", docs: [] };
        siArea(a).then(function (paths) {
          st.state = "open";
          st.docs = paths.map(function (pth) { return Object.assign({ id: "r" + i + "-" + cabSlug(pth), title: siTitle(pth), path: pth }, base); });
          if (onChange) onChange();
        }, function () { st.state = "github"; if (onChange) onChange(); });
      }
      if (st.state === "open") out = out.concat(st.docs.length ? st.docs : lock("empty"));
      else if (st.state === "github") out = out.concat(lock("github"));
      else out = out.concat([Object.assign({ id: "r" + i + "-loading", title: "Checking clearance…", locked: "loading" }, base)]);
    });
    return out;
  }
  var cabMode = "name", cabOpen = {}, cabQ = "", cabJump = false, cabHL = null, cabIdx = null, cabIdxP = null, cabSel = 0, cabRes = [];
  function cabGroup(g) { return CAB_GROUPS[g] || ["DOC", "#c9d0d2", "#4d5a60"]; }
  /* File number and plain title: HP-POL-009, ADR-0012, or the group prefix and position */
  function cabCode(d, docs) {
    var m = /^(HP-[A-Z]{3}-\d{3})\s+(.*)$/.exec(d.title);
    if (m) return [m[1], m[2]];
    m = /^(\d{4})\s+(.*)$/.exec(d.title);
    if (m) return ["ADR-" + m[1], m[2]];
    var same = docs.filter(function (x) { return x.group === d.group; }), n = same.indexOf(d) + 1;
    return [cabGroup(d.group)[0] + "-" + (n < 10 ? "0" : "") + n, d.title];
  }
  /* The document's class: the handbook type from its code, otherwise its library group */
  /* Classification stamp, in the middle of a Library document's header: public documents are not classified,
     LV3 to LV5 are low-clearance classified, LV6 and LV7 high-clearance classified */
  function cabStamp(x) {
    if (!x) return '<span class="ds-cls c-open"><b>Not classified</b><small>Public</small></span>';
    return '<span class="ds-cls ' + (x.need >= 6 ? 'c-high"><b>Classified</b><small>High clearance</small>' : 'c-low"><b>Classified</b><small>Low clearance</small>') + "</span>";
  }
  function cabWarn(x) {
    return x ? '<p class="ds-warn"><b>Classified LV' + esc(x.need) + ".</b> Do not share this document, or anything in it, with anyone below LV" + esc(x.need) + ".</p>" : "";
  }
  function cabClass(d, code) {
    if (/-POL-/.test(code)) return ["policy", "Policy"];
    if (/-SOP-/.test(code)) return ["procedure", "Procedure"];
    if (/-GDE-/.test(code)) return ["guide", "Guide"];
    return CAB_CLASS[d.group] || ["project", d.group];
  }

  function viewCabinet(id) {
    var v = $("#view");
    if (!$("#cab")) { v.innerHTML = shell("Documentation", "Library", loading("Opening the cabinet")); addZones("lib"); }
    Promise.all([loadLocal("docs"), loadLocal("guides")]).then(function (res) {
      if (currentView !== "docs") return;
      var man = res[0], all = (man && man.docs) || [];
      function xChanged() {
        if (currentView !== "docs" || !$("#cab")) return;
        cabDocs = all.concat(cabXDocs(xChanged)); drawDrawers(cabDocs);
        var want = (location.hash.split("/")[2] || ""), cur = $("#docBody").getAttribute("data-id");
        if (/^r\d+-/.test(want) && cur !== want) { var d2 = cabDocs.filter(function (d) { return d.id === want; })[0]; if (d2) openDossier(d2, cabDocs); else { var ph = cabDocs.filter(function (d) { return d.restricted && d.locked && want.indexOf("r" + d.restricted.area + "-") === 0; })[0]; if (ph) openDossier(ph, cabDocs); } }
      }
      var docs = cabDocs = all.concat(cabXDocs(xChanged));
      var zn = $(".zones"); if (zn) zn.outerHTML = docZones("lib");
      if (!docs.length) { $("#vb").innerHTML = '<div class="empty">No documents<small>data/docs.json could not be loaded.</small></div>'; return; }
      var doc = docs.filter(function (d) { return d.id === id; })[0];
      /* A restricted link before its drawer is read: show that drawer's placeholder until it is */
      if (!doc && /^r\d+-/.test(id || "")) doc = docs.filter(function (d) { return d.restricted && id.indexOf("r" + d.restricted.area + "-") === 0; })[0];
      /* Handbook documents live in the Handbook zone */
      if (doc && doc.group === "Handbook") { location.replace("#/guides/" + doc.id); return; }
      /* Docs always opens on the Overview, however you arrive */
      doc = doc || docs.filter(function (d) { return d.id === "overview"; })[0] || docs.filter(function (d) { return d.group !== "Handbook"; })[0];
      /* One drawer open at a time: the one holding the open document */
      cabOpen = {}; cabOpen[doc.group] = true;
      if (!$("#cab")) {
        $("#vb").innerHTML = '<div class="cab" id="cab"><div class="cab-side">' +
          '<label class="cab-q"><span aria-hidden="true">⌕</span><input id="cq" type="search" placeholder="' + (cabMode === "text" ? "Search inside the Library\'s documents" : "Search the Library: numbers and titles") + '" aria-label="Search the Library" aria-controls="cabDrawers" autocomplete="off" spellcheck="false"><kbd>Ctrl K</kbd><i class="cab-scan" aria-hidden="true"></i></label>' + smSwitch("cab", cabMode) +
          '<div class="cab-count" id="cabCount" aria-live="polite"></div><div class="cab-drawers" id="cabDrawers"></div></div>' +
          '<article class="dossier" id="docBody" tabindex="-1"></article></div>';
        var dw = $("#cabDrawers"); dw.classList.add("first"); setTimeout(function () { dw.classList.remove("first"); }, 1400);
        var q = $("#cq");
        q.value = cabQ;
        q.addEventListener("input", function () { cabQ = q.value; cabSel = 0; cabFind(docs); });
        smWire("cab", function (m) { cabMode = m; cabSel = 0; q.placeholder = m === "text" ? "Search inside the Library's documents" : "Search the Library: numbers and titles"; cabFind(cabDocs); q.focus(); });
        q.addEventListener("keydown", function (e) {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (!cabRes.length) return; e.preventDefault(); cabSel = (cabSel + (e.key === "ArrowDown" ? 1 : -1) + cabRes.length) % cabRes.length; cabMark(true); }
          else if (e.key === "Enter") { var id = cabRes[cabSel]; if (id) { e.preventDefault(); cabGo(id); } }
          else if (e.key === "Escape" && q.value) { e.preventDefault(); e.stopPropagation(); q.value = ""; cabQ = ""; cabFind(docs); }
        });
      }
      drawDrawers(docs, doc.id, true);
      openDossier(doc, docs);
      if (cabQ.trim() && !cabIdx) cabFind(docs);
    });
  }
  /* Query words, lightly stemmed so "appeals" finds "appeal" and "signing" finds "sign" */
  function cabWords() { return cabQ.trim().toLowerCase().split(/\s+/).filter(Boolean).map(function (w) { var s = w.replace(/(ing|ed|es|s)$/, ""); return s.length >= 3 ? s : w; }); }
  function cabRe(words) { return new RegExp("(" + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")[a-z]*", "ig"); }
  /* A word matches a file number by prefix or by number: "pol 9" finds HP-POL-009, "12" finds ADR-0012 */
  function cabCodeHit(w, code) {
    return code.toLowerCase().split("-").some(function (s) { return s.indexOf(w) === 0 || (/^\d+$/.test(w) && /^\d+$/.test(s) && +s === +w); });
  }
  function cabTitleHit(words, d, code) {
    var t = (code[0] + " " + code[1] + " " + d.group).toLowerCase();
    return words.every(function (w) { return t.indexOf(w) > -1 || cabCodeHit(w, code[0]); });
  }
  /* Which Library folders match the search, with a score: file number and title count most, then headings, then the text.
     Before the text index is ready only numbers and titles are searched; the folders update when it is. */
  function cabMatch(docs) {
    var words = cabWords();
    if (!words.length || cabQ.trim().length < 2) return null;
    var by = {}, whole = cabQ.trim().toLowerCase();
    if (cabIdx && cabMode === "text") cabIdx.forEach(function (e) { by[e.d.id] = e; });
    var out = {};
    docs.forEach(function (d) {
      if (d.group === "Handbook") return;
      var c = cabCode(d, docs), title = (c[0] + " " + c[1] + " " + d.group).toLowerCase(), e = by[d.id], score = 0, inName = true;
      var ok = words.every(function (w) {
        var t = title.indexOf(w) > -1, k = cabCodeHit(w, c[0]), at = e ? e.low.indexOf(w) : -1, n = 0, j = at;
        if (!t && !k) inName = false;
        if (!t && !k && at < 0) return false;
        while (j > -1 && n < 10) { n++; j = e.low.indexOf(w, j + w.length); }
        score += (k ? 30 : 0) + (t ? 20 : 0) + (e && e.hlow.indexOf(w) > -1 ? 6 : 0) + n;
        return true;
      });
      if (!ok) return;
      if (title.indexOf(whole) > -1) score += 25;
      out[d.id] = { score: score, text: !inName };
    });
    return out;
  }
  /* Runs the search: numbers and titles at once, the text as soon as the index is read */
  function cabFind(docs) {
    var cab = $("#cab"), live = !!(cabQ.trim().length >= 2);
    if (!cab) return;
    cab.classList.toggle("searching", live);
    drawDrawers(docs);
    if (live && !cabIdx && cabMode === "text") {
      cab.classList.add("indexing");
      var q = cabQ;
      cabIndex(docs).then(function () { if (currentView !== "docs" || !$("#cab")) return; $("#cab").classList.remove("indexing"); if (cabQ === q) drawDrawers(docs); });
    }
  }
  function drawDrawers(docs, active, follow) {
    var on = $(".fold.on");
    active = active || (on ? on.getAttribute("data-id") : "");
    var words = cabWords(), hits = cabMatch(docs), by = {}, total = 0;
    docs.forEach(function (d) { (by[d.group] = by[d.group] || []).push(d); });
    delete by.Handbook;
    var re = hits ? cabRe(words) : null;
    function hl(t) { return re ? esc(t).replace(re, function (m) { return "<mark>" + m + "</mark>"; }) : esc(t); }
    var groups = CAB_ORDER.filter(function (g) { return by[g]; }).concat(Object.keys(by).filter(function (g) { return CAB_ORDER.indexOf(g) < 0; }));
    /* While searching, the drawer with the best match comes first */
    if (hits) {
      var best = {};
      groups.forEach(function (g) { best[g] = Math.max.apply(null, [0].concat(by[g].map(function (d) { return hits[d.id] ? hits[d.id].score : 0; }))); });
      groups = groups.slice().sort(function (a, b) { return best[b] - best[a]; });
    }
    $("#cabDrawers").innerHTML = groups.map(function (g, gi) {
      var gc = cabGroup(g), list = by[g];
      if (hits) list = list.filter(function (d) { return hits[d.id]; }).sort(function (a, b) { return hits[b.id].score - hits[a.id].score; });
      if (hits && !list.length) return "";
      total += list.length;
      var open = hits ? true : !!cabOpen[g];
      var rx = list[0] && list[0].restricted, rlock = rx && list[0].locked && list[0].locked !== "loading";
      return '<section class="drawer' + (open ? " open" : "") + (rx ? " rx" : "") + (rlock ? " rlock" : "") + '" style="--g:' + gc[1] + "; --d:" + gi + '">' +
        '<button class="dr-head" data-g="' + esc(g) + '" aria-expanded="' + open + '"><span class="dr-handle" aria-hidden="true"></span><b>' + esc(g) + "</b>" + (rx ? '<em class="dr-lv">' + esc(rx.card) + (rlock ? " · locked" : "") + "</em>" : "<small>" + plural(list.length, "file") + "</small>") + '<i aria-hidden="true"></i></button>' +
        '<div class="dr-body"><div class="dr-files">' + list.map(function (d, n) {
          var c = cabCode(d, docs), h = hits && hits[d.id];
          return '<a class="fold' + (d.id === active ? " on" : "") + (h ? " hit" : "") + (d.locked ? " locked" : "") + '" data-id="' + esc(d.id) + '" href="#/docs/' + esc(d.id) + '" style="--k:' + n + "; --tx:" + ((n % 3) * 30) + 'px"><span class="f-tab">' + hl(c[0]) + '</span><span class="f-t">' + hl(c[1]) + "</span>" +
            (h && h.text ? '<span class="f-in">In text</span>' : "") + "</a>";
        }).join("") + "</div></div></section>";
    }).join("") || (hits ? '<div class="cab-none"><b>No match</b>No file in the Library matches every word of “' + esc(cabQ.trim()) + '”.<small>Guides, policies and procedures are searched in the Handbook.</small></div>' : "");
    cabRes = hits ? $$("#cabDrawers .fold").map(function (f) { return f.getAttribute("data-id"); }) : [];
    if (follow && hits && cabRes.indexOf(active) > -1) cabSel = cabRes.indexOf(active);
    if (cabSel >= cabRes.length) cabSel = 0;
    var cnt = $("#cabCount");
    if (cnt) cnt.innerHTML = hits ? '<span class="n">' + plural(total, "file") + '</span> match' + (cabIdx || cabMode !== "text" ? "" : '<span class="cab-wait"> · reading the text…</span>') + '<span class="cab-keys">↑↓ select · ↵ open · Esc clear</span>' : "";
    cabMark(false);
    $$(".fold").forEach(function (f) { f.addEventListener("click", function () { cabJump = true; cabHL = cabWords().length ? cabWords() : null; }); });
    /* Open and close in place, so only that drawer slides */
    $$(".dr-head").forEach(function (b) {
      b.addEventListener("click", function () {
        if (cabRes.length || cabWords().length) return;
        var s = b.parentNode, open = !s.classList.contains("open");
        /* Opening a drawer closes the others */
        if (open) $$("#cabDrawers .drawer.open").forEach(function (o) { o.classList.remove("open"); $(".dr-head", o).setAttribute("aria-expanded", "false"); });
        cabOpen = {}; if (open) cabOpen[b.getAttribute("data-g")] = true;
        s.classList.toggle("open", open); b.setAttribute("aria-expanded", String(open)); blip();
        if (open) { s.classList.add("opening"); setTimeout(function () { s.classList.remove("opening"); }, 1200); }
      });
    });
  }
  /* The clearance line above every document */
  function cabClr(ok, x, need) {
    var card = x ? x.card : "LV1", lv = (typeof KC_LV !== "undefined" && KC_LV[card]) || ["Public", "#8b9599"];
    return '<div class="clr ' + (ok ? "ok" : "no") + '" style="--hk:' + lv[1] + '"><i aria-hidden="true"></i><b>Access ' + (ok ? "granted" : "denied") + "</b><span>" +
      (ok ? esc(card) + " · " + (x ? esc(lv[0]) + " clearance" : "Public") : esc(need || card) + " required") + "</span></div>";
  }
  /* A document you may not open: a greyed-out draft behind an access-denied screen */
  function cabDenied(body, doc, c) {
    var x = doc.restricted, why = doc.locked, signed = typeof siIn === "function" && siIn();
    if (why === "loading") { body.innerHTML = cabClr(true, x).replace("Access granted", "Checking clearance") + loading("Checking your clearance with GitHub"); return; }
    if (why === "empty") { body.innerHTML = cabClr(true, x) + '<div class="empty">No documents here yet<small>' + esc(x.repo) + " is empty.</small></div>"; return; }
    var lines = ""; for (var n = 0; n < 14; n++) lines += '<span style="width:' + (55 + (n * 37) % 40) + '%"></span>';
    var msg = why === "level" ? "LV" + x.need + " clearance required." : why === "github" ? "Your card allows it, but GitHub has not given your account access yet." : "Could not reach GitHub to check your clearance.";
    body.innerHTML = cabClr(false, x, x.card) +
      '<div class="ds-tab"><b>' + esc(c[0]) + "</b>" + esc(doc.group) + '</div><div class="ds-folder denied"><div class="ds-page">' +
      '<header class="ds-head"><span><img src="assets/brand/hound-protocol-mark-light.svg" alt="" width="20" height="20">Hound Protocol</span>' + cabStamp(x) + '<span class="ds-class">Restricted · ' + esc(x.card) + "</span></header>" +
      '<div class="ad-draft" aria-hidden="true"><b></b>' + lines + "</div>" +
      '<div class="ad" role="alert"><div class="ad-box"><small>Security</small><strong>Access denied</strong><em>' + esc(msg) + "</em>" +
        "<p>Please contact Administration.</p>" +
        '<div class="ad-act">' + (signed ? "" : '<a class="btn small primary" href="#/profile">Sign in</a>') +
        '<a class="btn small" href="#/guides/hp-gde-009">How clearance works</a><a class="btn small" href="#/team">Contact Administration</a></div></div></div>' +
      "</div></div>";
    body.classList.add("is-denied"); body.classList.remove("in"); void body.offsetWidth; body.classList.add("in");
    blip();
  }
  function openDossier(doc, docs) {
    var body = $("#docBody"), gc = cabGroup(doc.group), c = cabCode(doc, docs), k = cabClass(doc, c[0]);
    $$(".fold").forEach(function (f) { f.classList.toggle("on", f.getAttribute("data-id") === doc.id); });
    body.style.setProperty("--g", gc[1]); body.style.setProperty("--gd", gc[2]);
    body.className = "dossier k-" + k[0];
    body.setAttribute("data-id", doc.id);
    var x = doc.restricted;
    if (x && doc.locked) return cabDenied(body, doc, c);
    body.innerHTML = loading("Opening " + c[0]);
    var src = x ? (docCache["x:" + x.repo + ":" + doc.path] ? Promise.resolve(docCache["x:" + x.repo + ":" + doc.path]) :
      siRead(x.repo, doc.path).then(function (t) { docCache["x:" + x.repo + ":" + doc.path] = t; return t; })) : loadDoc(doc);
    src.then(function (md) {
      if (currentView !== "docs") return;
      var html = markdown(md.replace(/^# .*\n/, "").replace(/^Code: .*\n/, ""), doc.path);
      var url = (cfg.siteUrl || "https://hound-protocol.github.io/joint-operations-web/") + "#/docs/" + doc.id;
      var gh = x ? "https://github.com/" + x.repo + "/blob/HEAD/" + doc.path : repoUrl("/blob/" + cfg.branch + "/" + doc.path);
      var ed = x ? "https://github.com/" + x.repo + "/edit/HEAD/" + doc.path : repoUrl("/edit/" + cfg.branch + "/" + doc.path);
      body.innerHTML = cabClr(true, x) +
        '<div class="ds-tab"><b>' + esc(c[0]) + "</b>" + esc(doc.group) + "</div>" +
        '<div class="ds-folder"><div class="ds-page">' +
          '<span class="ds-clip" aria-hidden="true"></span><span class="ds-holes" aria-hidden="true"></span>' +
          '<header class="ds-head"><span><img src="assets/brand/hound-protocol-mark-light.svg" alt="" width="20" height="20">Hound Protocol</span>' + cabStamp(x) + '<span class="ds-class">Class: ' + esc(k[1]) + "</span></header>" + cabWarn(x) +
          '<h1 class="ds-title">' + esc(c[1]) + "</h1>" +
          '<div class="ds-meta"><span>' + esc(c[0]) + " · " + esc(doc.path) + "</span>" +
            '<a href="' + esc(gh) + '" target="_blank" rel="noopener noreferrer">GitHub</a>' +
            '<a href="' + esc(ed) + '" target="_blank" rel="noopener noreferrer">Suggest an edit</a>' +
            (/^HP-/.test(c[0]) ? '<a href="#/guides/' + esc(doc.id) + '">Printable sheet</a>' : "") +
            '<button type="button" class="ds-link" data-url="' + esc(url) + '">Copy link</button></div>' +
          '<div class="sh-body ds-body">' + html + "</div>" +
          '<footer class="ds-foot"><span>' + esc(c[0]) + " · " + esc(k[1]) + " · " + esc(doc.path) + "</span><span>" + (x ? "Restricted to " + esc(x.card) + " and up. Do not copy it to public places." : "Read live from the repository") + "</span></footer>" +
        "</div></div>";
      body.classList.remove("in"); void body.offsetWidth; body.classList.add("in");
      var cl = $(".ds-link", body);
      cl.addEventListener("click", function () {
        var u = cl.getAttribute("data-url");
        (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { cl.textContent = "Copied"; status("Link copied"); }, function () { cl.textContent = u; });
      });
      led($("#ledInfo"), doc.title);
      var first = cabHL ? cabHighlight($(".ds-body", body), cabHL) : null;
      cabHL = null;
      if (first && first.scrollIntoView) setTimeout(function () { first.scrollIntoView({ behavior: opts.motion ? "smooth" : "auto", block: "center" }); }, opts.motion ? 260 : 0);
      else if (cabJump && window.innerWidth <= 900 && body.scrollIntoView) body.scrollIntoView({ behavior: opts.motion ? "smooth" : "auto", block: "start" });
      cabJump = false;
    }, function (e) {
      if (currentView !== "docs") return;
      if (x) return cabDenied(body, Object.assign({}, doc, { locked: e && (e.status === 404 || e.status === 403) ? "github" : "offline" }), c);
      body.innerHTML = '<div class="empty">Could not open this document<small><a href="' + repoUrl("/blob/" + cfg.branch + "/" + doc.path) + '" target="_blank" rel="noopener noreferrer">Open it on GitHub</a></small></div>';
    });
  }
  /* Marks every search word in the opened page and returns the first mark */
  function cabHighlight(root, words) {
    /* Only real words: a one- or two-letter word would light up half the page */
    words = (words || []).filter(function (w) { return w.length >= 3; });
    if (!root || !words.length) return null;
    var re = new RegExp("(" + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + "[a-z]*)", "ig"), first = null, nodes = [];
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false), n;
    while ((n = walk.nextNode())) if (n.nodeValue.trim() && !/^(SCRIPT|STYLE|MARK)$/.test(n.parentNode.nodeName)) nodes.push(n);
    nodes.forEach(function (t) {
      re.lastIndex = 0;
      if (!re.test(t.nodeValue)) return;
      var frag = document.createDocumentFragment(), parts = t.nodeValue.split(re);
      parts.forEach(function (p, i) {
        if (!p) return;
        if (i % 2) { var m = document.createElement("mark"); m.className = "hl"; m.textContent = p; frag.appendChild(m); if (!first) first = m; }
        else frag.appendChild(document.createTextNode(p));
      });
      t.parentNode.replaceChild(frag, t);
    });
    return first;
  }
  /* The search index: plain text, headings and their positions, built once on the first search */
  function cabIndex(docs) {
    if (cabIdx) return Promise.resolve(cabIdx);
    if (cabIdxP) return cabIdxP;
    return (cabIdxP = Promise.all(docs.filter(function (d) { return d.group !== "Handbook" && !d.restricted; }).map(function (d) { return loadDoc(d).then(function (t) { return [d, t]; }, function () { return [d, ""]; }); })).then(function (all) {
      cabIdx = all.map(function (p) {
        var lines = p[1].split("\n"), heads = [], text = "", pos = [];
        lines.forEach(function (l) {
          var h = /^#{2,4}\s+(.*)$/.exec(l);
          var clean = l.replace(/^#+\s+/, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*`|>_]+/g, " ").replace(/\s+/g, " ").trim();
          if (h) heads.push({ at: text.length, t: clean });
          if (clean) { pos.push(text.length); text += clean + " "; }
        });
        return { d: p[0], text: text, low: text.toLowerCase(), heads: heads, hlow: heads.map(function (h) { return h.t.toLowerCase(); }).join(" ") };
      });
      return cabIdx;
    }));
  }
  /* The selected result: a ring around that folder */
  function cabMark(scroll) {
    $$("#cabDrawers .fold").forEach(function (f) {
      var on = cabRes.length && f.getAttribute("data-id") === cabRes[cabSel];
      f.classList.toggle("sel", !!on);
      if (on && scroll && f.scrollIntoView) f.scrollIntoView({ block: "nearest", behavior: opts.motion ? "smooth" : "auto" });
    });
  }
  function cabGo(id) {
    if (!id) return;
    cabHL = cabWords(); cabJump = true;
    var to = "#/docs/" + id;
    if (location.hash === to) { route(); return; }
    location.hash = to;
  }
  /* Ctrl+K or / jumps to the search on the Docs page */
  document.addEventListener("keydown", function (e) {
    if (currentView !== "docs") return;
    var tag = (e.target && e.target.tagName) || "", q = $("#cq");
    if (!q) return;
    if (((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) || (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag))) { e.preventDefault(); q.focus(); q.select(); }
  });
