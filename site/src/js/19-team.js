  /* Team */
  function viewTeam() {
    var v = $("#view");
    v.innerHTML = shell("Hound Protocol", "Team", loading("Loading team"));
    Promise.all([loadLocal("team"), loadLocal("records")]).then(function (res) {
      var t = res[0];
      if (currentView !== "team") return;
      t = t || { members: [], seats: [], roles: [], departments: [] };
      var still = !opts.motion;
      $("#vb").innerHTML = '<div class="bf">' +
        '<section class="bf-sec team-brand"><div class="tb-mark">' + BRAND.hpColor + '</div><div><div class="tb-name">Hound Protocol</div><p>A community-focused organization. We build ambitious projects, one of them being <b>Joint Operations</b>.</p></div><div class="tb-mark jo"><img src="assets/brand/joint-operations-mark.svg" alt="Joint Operations"></div></section>' +
        '<section class="bf-sec team-members">' + t.members.map(function (m) {
          return '<article class="member"><div class="portrait"><picture>' +
            (m.still ? '<source srcset="' + esc(m.still) + '" media="(prefers-reduced-motion: reduce)">' : "") +
            '<img src="' + esc(still && m.still ? m.still : m.image) + '" alt="' + esc(m.name) + '" width="168" height="168" loading="lazy"></picture><i class="pc tl"></i><i class="pc br"></i></div>' +
            '<div><div class="m-role">' + esc(m.role) + '</div><h3 class="m-name">' + esc(m.name) + '</h3><p>' + esc(m.bio) + "</p></div></article>";
        }).join("") + "</section>" +
        (t.hierarchy ? teamChain(t) : "") +
        (t.positions ? teamPositions(t.positions) : "") + "</div>";
      revealSections();
      teamRoster();
    });
  }

  // Chain of command (HP-POL-007): one tier per keycard level, authority badges per role
  function teamChain(t) {
    var A = t.authority || {}, depts = {};
    (t.departments || []).forEach(function (d) { depts[d.id] = d; });
    return '<section class="bf-sec"><div class="label">Chain of command</div>' +
      '<div class="principles">' + (t.principles || []).map(function (p) { return "<div><b>" + esc(p[0]) + "</b><span>" + esc(p[1]) + "</span></div>"; }).join("") + "</div>" +
      '<div class="chain">' + t.hierarchy.map(function (tier, k) {
        return '<div class="tier" style="--k:' + k + '"><span class="tier-lv">' + esc(tier.card) + '</span><div class="tier-nodes">' + tier.nodes.map(function (n) {
          var d = n.dept && /Department/.test(n.sub || "") ? depts[n.dept] : null;
          return '<article class="node' + (n.authority.length ? "" : " plain") + '"><header><h3>' + esc(n.title) + "</h3><small>" + esc(n.sub || "") + "</small></header>" +
            "<p>" + esc(n.job) + "</p>" +
            (n.authority.length ? '<div class="auth">' : '<div class="auth" hidden>') + n.authority.map(function (a) { return '<span class="au ' + a + '" title="' + esc((A[a] || [a, ""])[1]) + '">' + esc((A[a] || [a])[0]) + "</span>"; }).join("") + "</div>" +
            (d && d.units && d.units.length ? '<ul class="chips small">' + d.units.map(function (u) { return "<li>" + esc(u) + "</li>"; }).join("") + "</ul>" : "") +
            '<div class="d-who">' + (n.holders.length ? esc(n.holders.join(" · ")) : "No one yet") + (n.open ? ' <span class="pill warn">' + esc(n.open) + "</span>" : "") + "</div>" + (n.dept === "con" ? activeStrip() : "") + "</article>";
        }).join("") + "</div></div>";
      }).join("") + "</div>" +
      '<div class="auth-key">' + Object.keys(A).map(function (k) { return '<span><i class="au ' + k + '">' + esc(A[k][0]) + "</i>" + esc(A[k][1]) + "</span>"; }).join("") + "</div>" +
      '<p class="source">Authority only flows down, and only in its own kind. Anyone can talk to anyone. See <a href="#/guides/hp-pol-007">HP-POL-007 Chain of Command</a> and <a href="https://hound-protocol.github.io/hound-protocol-web/docs.html#departments">departments and grades</a>.</p></section>';
  }

  // Open positions, grouped by department: seats show filled slots; open roles take anyone
  function teamPositions(list) {
    var depts = [];
    list.forEach(function (p) { if (depts.indexOf(p.dept) < 0) depts.push(p.dept); });
    var open = list.reduce(function (n, p) { return n + (p.kind === "seat" && !p.after ? Math.max(0, p.need - p.holders.length) : p.kind === "open" ? 1 : 0); }, 0);
    return '<section class="bf-sec"><div class="label">Positions</div>' +
      '<p class="sub">' + plural(open, "position") + " open now. Seats have a set number of holders; critical seats are filled once there is a playable prototype. Open roles take anyone who wants to help. Ask on Discord or see <a href=\"#/guides/hp-gde-008\">how roles are given</a>.</p>" +
      '<div class="posgrid">' + depts.map(function (d) {
        var rows = list.filter(function (p) { return p.dept === d; });
        return '<section class="posdept"><header><h3>' + esc(d) + "</h3><small>" + plural(rows.length, "position") + "</small></header>" + rows.map(function (p) {
          var state, pips = "";
          if (p.kind === "seat") {
            var free = Math.max(0, p.need - p.holders.length);
            for (var i = 0; i < p.need; i++) pips += '<i class="' + (i < p.holders.length ? "on" : "") + '"></i>';
            state = !free ? '<span class="pill ok">Filled</span>' : p.after === "prototype" ? '<span class="pill" title="Critical seats are filled once there is a playable prototype">After prototype</span>' : '<span class="pill warn">' + free + " open</span>";
          } else state = p.kind === "open" ? '<span class="pill warn">Open</span>' : '<span class="pill">After 0.1</span>';
          return '<div class="pos k-' + esc(p.kind) + '"><div class="pos-main"><b>' + esc(p.title) + "</b><span>" + esc(p.about) + "</span></div>" +
            '<div class="pos-who">' + (p.holders.length ? esc(p.holders.join(", ")) : p.kind === "seat" ? "Vacant" : "Anyone") + (pips ? '<span class="pips" aria-label="' + p.holders.length + " of " + p.need + ' filled">' + pips + "</span>" : "") + "</div>" + state + "</div>";
        }).join("") + "</section>";
      }).join("") + "</div>" +
      '<div class="toolbar" style="margin-top:18px"><a class="btn primary" href="#/contribute">Join the Hound</a><a class="btn" href="https://hound-protocol.github.io/hound-protocol-web/docs.html#governance">How seats work</a></div></section>';
  }

  // Contractors active in the last 7 days, from signed contributor records (live from data/records.json)
  function activeStrip() {
    var recs = (data.records && data.records.records) || [], since = Date.now() - 7 * 864e5, seen = {}, list = [];
    recs.slice().reverse().forEach(function (r) {
      var t = Date.parse(r.date); if (isNaN(t) || t < since || seen[r.login]) return;
      seen[r.login] = 1; list.push(r);
    });
    return '<div class="active-strip"><span class="as-k"><i></i>Active this week</span>' + (list.length ? list.map(function (r) {
      return '<a class="as-b" href="#/verify" title="Last delivery ' + esc(r.date) + (r.assisted && r.assisted.length ? ", with " + esc(r.assisted.join(", ")) : "") + '">' + esc(r.name || r.login) + "</a>";
    }).join("") : '<span class="as-none">No deliveries in the last 7 days</span>') + "</div>";
  }

  /* The public roster: every signed card, grouped by clearance, highest first. Cards are checked in the browser
     against the records key; banned accounts (LV0) are kept privately and never listed (docs/guides/HP-SOP-012-bans.md). */
  function teamRoster() {
    Promise.all([loadLocal("staff"), loadLocal("records-key")]).then(function (res) {
      if (currentView !== "team") return;
      var staff = ((res[0] && res[0].staff) || []).filter(function (x) { return x.status === "active"; }), keys = (res[1] && res[1].keys) || [];
      /* The owner holds LV7 by owning the GitHub organization; until a signed card exists, show that card too */
      var oc = (cfg.signin || {}).ownerCard, oid = (cfg.signin || {}).owner;
      if (oc && oid && !staff.some(function (x) { return String(x.github_id) === String(oid); }))
        staff.unshift({ id: "OWNER", login: oc.login, name: oc.name, github_id: oid, card: "LV7", department: oc.department || "Administration", since: "", status: "active", owner: true });
      var by = {}; staff.forEach(function (x) { (by[x.card] = by[x.card] || []).push(x); });
      var lv = ["LV7", "LV6", "LV5", "LV4", "LV3", "LV2"].filter(function (l) { return by[l]; });
      var html = '<section class="bf-sec in roster"><div class="label">Roster</div>' +
        '<p class="sub">Everyone holding a Hound ID card, by clearance. Signed cards are checked against the records key in your browser; the owner holds LV7 by owning the GitHub organization. Prove that someone really holds a card on <a href="#/verify">Verify</a>.</p>' +
        (lv.length ? lv.map(function (l) {
          return '<div class="ro-lv" style="--hk:' + (KC_LV[l] || KC_LV.LV3)[1] + '"><h4><i>' + esc(l) + "</i>" + esc((KC_LV[l] || [""])[0]) + "<small>" + plural(by[l].length, "member") + '</small></h4><div class="hks">' + by[l].map(function (x, n) { return keycard(x, { link: !x.owner, i: n }); }).join("") + "</div></div>";
        }).join("") : '<div class="empty">No signed cards yet<small>The roster fills as the owner issues signed cards (<a href="#/guides/hp-gde-009">how</a>).</small></div>') +
        "</section>";
      $(".bf", $("#vb")).insertAdjacentHTML("beforeend", html);
      var signed = staff.filter(function (x) { return !x.owner; });
      if (keys.length) markVerified(signed, keys);
      $$('.roster [data-rid="OWNER"] .vs').forEach(function (el) { el.innerHTML = '<span class="status done">Owner · GitHub</span>'; });
    });
  }

