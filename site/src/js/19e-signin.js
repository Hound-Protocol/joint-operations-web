  /* ---------------- Sign-in with GitHub and the profile (ADR 0017, docs/signin.md) ----------------
     The relay (tools/signin-relay/worker.js) swaps GitHub's one-time sign-in code for a short-lived user token and posts it
     back to this window. The token stays in this tab only (sessionStorage) and can read nothing but the restricted document
     repositories the person's GitHub teams already allow. The keycard comes from the person's signed staff card, matched by
     GitHub account number; anyone else signed in holds a member card (LV2). While config.signin.relay is empty, sign-in is off. */
  var SI_KEY = "hp.signin", SI_DEV = "hp.signin.device";
  var SI = null;
  try { SI = JSON.parse(sessionStorage.getItem(SI_KEY) || "null"); } catch (e) { SI = null; }
  /* "Keep me signed in on this device": the same sign-in kept in local storage, so every tab on this browser shares it
     until it runs out (at most 24 hours). Opt-in, off by default; the security policy keeps foreign scripts away from it. */
  if (!SI) { try { SI = JSON.parse(localStorage.getItem(SI_DEV) || "null"); if (SI && !(SI.exp > Date.now())) { localStorage.removeItem(SI_DEV); SI = null; } } catch (e) { SI = null; } }
  function siCfg() { return cfg.signin || {}; }
  function siOn() { return !!siCfg().relay; }
  function siSave() {
    try { if (SI && !SI.device) sessionStorage.setItem(SI_KEY, JSON.stringify(SI)); else sessionStorage.removeItem(SI_KEY); } catch (e) { /* private mode: the session lives in this page only */ }
    try { if (SI && SI.device) localStorage.setItem(SI_DEV, JSON.stringify(SI)); else localStorage.removeItem(SI_DEV); } catch (e) { /* storage blocked: this page only */ }
  }
  /* Another tab signed out (or in) on this device: follow it */
  window.addEventListener("storage", function (e) {
    if (e.key !== SI_DEV) return;
    if (!e.newValue && SI && SI.device) { SI = null; siBadge(); if (currentView) route(); }
    else if (e.newValue && !siIn()) { try { SI = JSON.parse(e.newValue); } catch (x) { SI = null; } siBadge(); if (currentView) route(); }
  });
  function siIn() { return !!(SI && SI.token && SI.user && SI.exp && SI.exp > Date.now()); }
  /* LV7 holders (the owner, and any organization owner GitHub confirms) manage guest passes; the relay checks again */
  function siOwner() { if (!siIn()) return false; if (String(SI.user.id) === String(siCfg().owner || "")) return true; var c = siCard(); return !!(c && c.card === "LV7"); }
  /* Reads one restricted file, with the person's own sign-in or, for a guest, through the relay */
  function siRead(repo, path) {
    if (siIn()) return siApi("/repos/" + repo + "/contents/" + path.split("/").map(encodeURIComponent).join("/"), true);
    if (sgIn() && sgRepos().indexOf(repo) > -1) return sgFile(repo, path);
    var e = new Error("No access"); e.status = 403; return Promise.reject(e);
  }
  function siApi(path, raw) {
    var h = { Authorization: "Bearer " + SI.token, Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" };
    if (typeof fetch !== "function") return Promise.reject(new Error("This browser cannot sign in"));
    return fetch("https://api.github.com" + path, { headers: h, cache: "no-store" }).then(function (r) {
      if (r.status === 401) { SI = null; siSave(); siBadge(); }
      if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
      return raw ? r.text() : r.json();
    });
  }
  function signIn(device) {
    if (!siOn()) return Promise.reject(new Error("Sign-in is not switched on yet."));
    var relay = siCfg().relay.replace(/\/$/, ""), origin;
    try { origin = new URL(relay).origin; } catch (e) { return Promise.reject(new Error("The sign-in relay address is not valid.")); }
    /* GitHub cannot be shown inside another page, so it opens in the smallest window its sign-in fits in, centered over this one.
       Browsers do not allow a window to be hidden or minimized; once authorized, GitHub answers at once and the window closes by itself. */
    var W = 400, H = 540, L = Math.round((window.screenX || window.screenLeft || 0) + ((window.outerWidth || screen.width) - W) / 2), T = Math.round((window.screenY || window.screenTop || 0) + ((window.outerHeight || screen.height) - H) / 2);
    var w = window.open(relay + "/login", "hpsignin", "width=" + W + ",height=" + H + ",left=" + L + ",top=" + T + ",menubar=no,toolbar=no,location=no,status=no,scrollbars=yes");
    if (!w) return Promise.reject(new Error("Allow pop-ups for this site to sign in."));
    return new Promise(function (ok, fail) {
      var done = false, t;
      function on(e) {
        if (e.origin !== origin || !e.data || !e.data.houndSignin) return;
        done = true; clearInterval(t); window.removeEventListener("message", on);
        var m = e.data.houndSignin;
        if (m.error || !m.token) { var er = new Error(m.error || "Sign-in failed."); er.code = m.code; fail(er); return; }
        /* A sign-in lasts at most 24 hours at every level (less if GitHub's token expires sooner); then sign in again */
        var cap = Date.now() + 24 * 3600 * 1000;
        SI = { token: m.token, exp: m.expires_in ? Math.min(cap, Date.now() + m.expires_in * 1000) : cap, device: !!device };
        siApi("/user").then(function (u) {
          SI.user = { id: u.id, login: u.login, name: u.name || "", avatar: u.avatar_url };
          siSave(); lsv("hp.verified", "1"); siBadge(); siOrg(); siFresh = Date.now(); ok(SI.user);
        }, function () { SI = null; siSave(); fail(new Error("Could not read your GitHub account.")); });
      }
      window.addEventListener("message", on);
      t = setInterval(function () { if (w.closed && !done) { clearInterval(t); window.removeEventListener("message", on); fail(new Error("The sign-in window was closed.")); } }, 500);
    });
  }
  var siFresh = 0;
  /* Firewalls and privacy tools (Portmaster, uBlock Origin, Pi-hole, NextDNS) can block the relay. When a request cannot
     reach it, say so plainly and name the address to allow, instead of a bare network error. */
  function relayHost() { try { return new URL(siRelay()).host; } catch (e) { return "the sign-in relay"; } }
  function netHelp() { return "This browser could not reach Hound ID's relay (" + relayHost() + "). A firewall or privacy tool such as Portmaster, uBlock Origin or Pi-hole may be blocking it: allow that address, then try again. Help: Using the Website, section 7."; }
  function relayReach() { return typeof fetch !== "function" ? Promise.resolve(true) : fetch(siRelay() + "/health", { cache: "no-store" }).then(function () { return true; }, function () { return false; }); }
  /* The sign-in window: explains the three steps, opens GitHub, waits, and reports back in the site's own design */
  function siStart(o) {
    o = o || {};
    var m = hpModal({ kicker: "Hound ID · Sign in", title: "Sign in with GitHub",
      html: '<ol class="hm-steps"><li><b>GitHub opens</b> in a small window in the middle of your screen.</li><li><b>Authorize Hound ID Sign-in</b> the first time. It can only read what your GitHub teams already allow.</li><li><b>Your keycard</b> appears here, at your clearance.</li></ol>' +
        '<label class="hm-check"><input type="checkbox" id="siDev"><span><b>Keep me signed in on this device (24 h)</b><small>Every tab on this browser stays signed in until the 24 hours run out. Leave it off on shared or work computers.</small></span></label>' +
        '<p class="hm-note">We never see your password, and nothing about you is stored on a server.</p>',
      actions: [{ label: "Cancel", value: null }, { label: "Continue with GitHub", primary: true, run: go }] });
    var dev = false;
    function go() {
      if ($("#siDev")) dev = $("#siDev").checked; /* kept for Try again, when the box is no longer shown */
      m.body('<div class="hm-wait"><span class="spin"></span><b>Waiting for GitHub…</b><small>Finish signing in in the GitHub window. If nothing opened, allow pop-ups for this site.</small></div>');
      m.actions([{ label: "Cancel", value: null }]);
      signIn(dev).then(function () {
        status("Signed in"); blip("go");
        m.body('<div class="hm-ok"><b>Access granted</b><small>Opening your keycard…</small></div>'); m.actions([]);
        setTimeout(function () { m.close(true); if (o.stay || currentView === "profile") route(); else location.hash = "#/profile"; }, opts.motion ? 700 : 0);
      }, function (e) {
        if (e.code === "banned") {
          m.el.querySelector(".hm-win").classList.add("hm-danger");
          m.body('<div class="hm-lv0"><span>LV0</span><b>Access revoked</b><small>This GitHub account is banned from Hound Protocol. It cannot sign in, take contracts or join sessions, on any linked account.</small><small>Appeals: <a href="#/guides/hp-sop-011">HP-SOP-011</a>.</small></div>');
          m.actions([{ label: "Close", value: null }]);
          return;
        }
        /* A blocked relay often shows up only as a closed or broken GitHub window: check it before blaming the window */
        relayReach().then(function (up) {
          m.body('<div class="hm-err"><b>Not signed in</b><small>' + esc(up ? e.message : netHelp()) + "</small></div>");
          m.actions([{ label: "Close", value: null }, { label: "Try again", primary: true, run: go }]);
        });
      });
    }
    return m.result;
  }
  function signOut() { SI = null; siSave(); siBadge(); }
  /* Organization owners hold LV7, as GitHub itself reports it (ADR 0011: keycards come from the organization). This needs
     the sign-in app's read-only "Members" permission; without it the check fails quietly and nothing changes. */
  function siOrg() {
    if (!siIn() || (SI.org && SI.org.at > Date.now() - 10 * 60 * 1000)) return;
    var org = siCfg().org || "Hound-Protocol";
    SI.org = { at: Date.now(), role: "" };
    siApi("/user/memberships/orgs/" + encodeURIComponent(org)).then(function (m) {
      SI.org = { at: Date.now(), role: m && m.state === "active" ? m.role : "", done: true }; siSave(); siBadge();
      if (SI.org.role === "admin" && (currentView === "profile" || currentView === "docs")) route();
    }, function () { /* no Members permission yet, or not a member */ if (SI && SI.org) { SI.org.done = true; siSave(); siBadge(); } });
  }
  /* The person's card: their active staff card, or a member card (LV2) */
  function siCard() {
    if (!siIn()) return sgIn() ? sgCard() : null;
    var staff = (data.staff && data.staff.staff) || [];
    var s = staff.filter(function (x) { return x.github_id === SI.user.id && x.status === "active"; })[0];
    /* A staff card counts only once its signature checks out against the published records key, so an edited
       staff.json can never raise anyone's clearance. Until then (or if it fails) the holder is a member. */
    if (!s && SI.org && SI.org.role === "admin")
      return { id: "OWNER", login: SI.user.login, name: SI.user.name, github_id: SI.user.id, avatar: SI.user.avatar, card: "LV7", department: "Administration", since: "", status: "active", owner: true };
    if (s) {
      var v = siV[s.id];
      if (!v) siVerify(s);
      else if (v === "ok" || v === "unsupported") return Object.assign({}, s, { avatar: SI.user.avatar, name: s.name || SI.user.name, unchecked: v === "unsupported" });
    }
    return { id: "MEMBER", login: SI.user.login, name: SI.user.name, github_id: SI.user.id, avatar: SI.user.avatar, card: "LV2", department: "Member", since: "", status: "active", member: true };
  }
  var siV = {};
  function siVerify(card) {
    siV[card.id] = "wait";
    loadLocal("records-key").then(function (k) { return verifyRecord(card, (k && k.keys) || []); }).then(function (r) {
      siV[card.id] = r; siBadge();
      if (r === "ok" || r === "unsupported") { if (currentView === "profile" || currentView === "docs") route(); }
    });
  }
  function siLevel() { var c = siCard(); return c ? +String(c.card).slice(2) : 1; }
  /* The clearance is settled once GitHub has answered the owner check and any staff card has been checked; before that
     the card shows LV2 for a moment, which must not be announced as a clearance */
  function siSettled() {
    if (!siIn()) return sgIn();
    if (!SI.org || !(SI.org.done || SI.org.role)) return false;
    if (SI.org.role === "admin") return true;
    if (!data.staff) return false;
    var s = (data.staff.staff || []).filter(function (x) { return x.github_id === SI.user.id && x.status === "active"; })[0];
    return !s || (siV[s.id] && siV[s.id] !== "wait");
  }
  /* The badge in the top bar: "Sign in", or the person's level and name */
  function siBadge() {
    if (!siOn()) { var t = $("#tbId"); if (t) t.remove(); return; }
    if (!tbMount()) return;
    var b = $("#siBadge"), c = siCard();
    if (c && siSettled()) msgLevel();
    /* A small access credential: level colour edge, picture, name over "Access Credential · level", the level number */
    var lv = c ? KC_LV[c.card] || KC_LV.LV2 : null, ph = c && !c.guest ? kcPhoto(c) : "";
    b.style.setProperty("--hk", lv ? lv[1] : "var(--jo)");
    b.innerHTML = c
      ? '<span class="sb-pic">' + (ph ? '<img src="' + esc(ph) + '" alt="" referrerpolicy="no-referrer" data-err="remove">' : "") + "</span>" +
        '<span class="sb-txt"><b>' + esc(c.name || c.login) + "</b><small>" + esc(c.guest ? sgLvName(+String(c.card).slice(2)) + " · " + c.id : "Access Credential · " + lv[0]) + "</small></span>" +
        '<span class="sb-lv"><small>LV</small>' + esc(String(c.card).slice(2)) + "</span>"
      : '<span class="sb-pic id">ID</span><span class="sb-txt"><b>Visitor</b><small>Temporary pass · Restricted</small></span><span class="sb-lv"><small>LV</small>1</span>';
    if (!c) b.style.setProperty("--hk", KC_LV.LV1[1]);
    $("#tbId").style.setProperty("--hk", c ? (KC_LV[c.card] || KC_LV.LV2)[1] : KC_LV.LV1[1]);
    b.classList.toggle("guest", !!(c && c.guest));
    b.classList.toggle("in", !!c);
    b.setAttribute("aria-label", c ? "Access credential " + c.card + ", " + (c.guest ? "guest pass" : c.name || c.login) : "Access credential LV1, visitor");
  }

  /* ---- Restricted document areas: one private repository per clearance ---- */
  var siTrees = {};
  function siArea(a) {
    if (!siIn()) {
      if (!sgIn() || sgRepos().indexOf(a.repo) < 0) { var e = new Error("No access"); e.status = 403; return Promise.reject(e); }
      var gk = "guest:" + SG.id + ":" + a.repo;
      return siTrees[gk] || (siTrees[gk] = sgTree(a.repo).then(null, function (er) { delete siTrees[gk]; throw er; }));
    }
    if (siTrees[a.repo]) return siTrees[a.repo];
    return (siTrees[a.repo] = siApi("/repos/" + a.repo).then(function (r) {
      return siApi("/repos/" + a.repo + "/git/trees/" + encodeURIComponent(r.default_branch) + "?recursive=1");
    }).then(function (t) {
      return (t.tree || []).filter(function (n) { return n.type === "blob" && /\.md$/i.test(n.path) && !/(^|\/)README\.md$/i.test(n.path); }).map(function (n) { return n.path; });
    }, function (e) { delete siTrees[a.repo]; throw e; }));
  }
  function siTitle(path) { return path.replace(/\.md$/i, "").split("/").pop().replace(/[-_]+/g, " ").replace(/^\w/, function (c) { return c.toUpperCase(); }); }

  function viewProfile() {
    var v = $("#view");
    v.innerHTML = shell("Hound ID", "Profile", loading("Opening your profile"));
    Promise.all([loadLocal("staff"), loadLocal("records"), loadLocal("records-key"), loadLocal("contracts"), loadLocal("certificates")]).then(function (res) {
      if (currentView !== "profile") return;
      var keys = (res[2] && res[2].keys) || [];
      if (!siIn() && !sgIn()) return drawSignedOut();
      var c = siCard(), lvl = siLevel(), areas = siCfg().areas || [];
      $("#vb").innerHTML =
        '<div class="kc-profile">' + keycard(c, { big: true }) +
        '<div class="kc-side">' + (c.guest ? sgFacts(c) + "</div></div>" :
        '<dl class="kc-facts"><div><dt>GitHub</dt><dd><a href="https://github.com/' + encodeURIComponent(c.login) + '" target="_blank" rel="noopener noreferrer">' + esc(c.login) + "</a> · account #" + esc(c.github_id) + "</dd></div>" +
          "<div><dt>Card</dt><dd>" + (c.owner ? "Owner card: GitHub confirms you own the Hound-Protocol organization." : c.member ? 'Member card. Staff cards are issued by Administration (<a href="#/guides/hp-gde-009">how</a>).' : '<a href="#/verify/' + esc(c.id) + '">Signed staff card ' + esc(c.id) + "</a>") + "</dd></div>" +
          "<div><dt>Session</dt><dd>Signed in until " + esc(new Date(SI.exp).toTimeString().slice(0, 5)) + (SI.device ? " on this device, in every tab" : " in this tab") + " (at most 24 hours)</dd></div>" +
          '</dl><button type="button" class="si-out" id="siOut"><i aria-hidden="true"></i><span>Sign out<small>Sign out of clearance</small></span></button></div></div>') +
        siCerts(c) +
        (siOwner() ? sgPanel() : "") +
        siAccess(lvl, areas) +
        "";
      $("#siOut").addEventListener("click", function () {
        (c.guest ? hpConfirm("End your guest pass?", "It stops working at once, on this device too. This cannot be undone.", "End guest pass", "Keep it", "danger")
          : hpConfirm("Are you sure you want to log out?", SI && SI.device ? "Your Hound ID session ends on this device, in every tab. You can sign in again at any time." : "Your Hound ID session in this tab ends. You can sign in again at any time.", "Log out", "Stay signed in", "danger")).then(function (yes) {
          if (!yes) return;
          if (c.guest) { sgEnd(); return; }
          signOut(); status("Signed out");
          viewProfile();
        });
      });
      if (siOwner()) sgPanelWire();
      if (c.guest) { sgFactsWire(); sgCheck().then(null, function () { /* handled in sgApi */ }); }
      /* Right after signing in (the owner check may redraw the card once, so allow a few seconds) */
      if (siFresh && Date.now() - siFresh < 5000) kcReveal($(".kc-profile .hk")); else siFresh = 0;
      if (keys.length && !c.member && !c.guest && !c.owner) markVerified([c], keys);
      else $$('.kc-profile [data-rid] .vs').forEach(function (el) { el.innerHTML = c.owner ? '<span class="status done">Confirmed by GitHub</span>' : c.guest ? '<span class="status planned">Guest · until ' + esc(new Date(c.exp).toTimeString().slice(0, 5)) + "</span>" : '<span class="status claimed">Signed in</span>'; });
    });
  }
  /* Access granted and access restricted: every level's rights from ADR 0011 (config.signin.access), split at the
     holder's clearance. Restricted document areas show their files inside the level that opens them. */
  function siAccess(lvl, areas) {
    var levels = siCfg().access || [], got = [], not = [];
    levels.forEach(function (L) { (+String(L.card).slice(2) <= lvl ? got : not).push(L); });
    function item(it, open) {
      if (it.area != null) {
        var a = areas[it.area]; if (!a) return "";
        /* Information only: the documents themselves open from the Library */
        return '<li class="ax-doc"><span class="ax-t">' + esc(a.title) + " documents</span></li>";
      }
      return '<li><span class="ax-t">' + esc(it.t) + "</span>" + (it.s ? '<em class="ax-s">' + esc(it.s) + "</em>" : "") + "</li>";
    }
    function group(L, open, n) {
      var lv = KC_LV[L.card] || KC_LV.LV2;
      return '<section class="ax-lv" style="--hk:' + lv[1] + "; --n:" + n + '"><header><i>' + esc(L.card) + "</i><b>" + esc(lv[0]) + "</b>" +
        (open ? "" : "<small>Needs " + esc(L.card) + "</small>") + "</header><ul>" + L.items.map(function (it) { return item(it, open); }).join("") + "</ul></section>";
    }
    var next = not[0];
    return '<div class="ax">' +
      '<div class="ax-col ax-ok"><div class="ax-head"><span class="ax-ico" aria-hidden="true"></span><b>Access granted</b><small>Level ' + lvl + " clearance · " + plural(got.reduce(function (n, L) { return n + L.items.length; }, 0), "right") + "</small></div>" +
        got.slice().reverse().map(function (L, n) { return group(L, true, n); }).join("") + "</div>" +
      '<div class="ax-col ax-no"><div class="ax-head"><span class="ax-ico" aria-hidden="true"></span><b>Access restricted</b><small>' + (not.length ? "Opens with a higher card" : "Nothing: you hold the highest card") + "</small></div>" +
        (not.length ? not.map(function (L, n) { return group(L, false, n); }).join("") : '<p class="sub">Every level is open to you.</p>') +
        (next ? '<p class="ax-how">' + (lvl < 3 ? "A completed contract earns <b>LV3</b>; higher cards come with a department. " : "Higher cards come with a department role. ") + 'How cards are issued: <a href="#/guides/hp-gde-009">Grades, Records and Hound IDs</a>. Not sure where you fit? <a href="#/guides/hp-gde-017">Can I Contribute?</a></p>' : "") + "</div>" +
      "</div>" +
      '<p class="sub ax-note">GitHub decides what you can read in the restricted areas, through your teams; your card shows what your clearance should open. Restricted documents open from the <a href="#/docs/library">Library</a>. Items marked with a date or <em>Planned</em> arrive with the session browser and the API server (<a href="#/docs/adr-0011">ADR 0011</a>).</p>';
  }
  /* The holder's certificates of service, if any */
  function siCerts(c) {
    var mine = ((data.certificates && data.certificates.certificates) || []).filter(function (x) { return !c.guest && x.github_id === c.github_id; });
    if (!mine.length) return "";
    return '<section class="si-certs"><div class="label">Your certificates</div><div class="cert-list">' + mine.slice().reverse().map(function (x, n) {
      return '<a class="cert-card' + (x.status === "revoked" ? " revoked" : "") + '" style="--i:' + n + "; --hk:" + (KC_LV[x.clearance] || KC_LV.LV3)[1] + '" href="#/verify/' + esc(x.id) + '"><small>' + esc(x.id) + " · " + esc(fmtDate(x.issued)) + "</small><b>Certificate of Service</b><span>" + plural(x.records.length, "contract") + " · grade " + esc(x.grade || "–") + "</span></a>";
    }).join("") + "</div></section>";
  }
  function sgLeft(exp) { var m = Math.max(0, Math.round((exp - Date.now()) / 60000)); return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min"; }
  function siOpen(a, path) {
    var d = $("#siDoc"); if (!d) return;
    d.hidden = false; d.className = "dossier si-reader k-project"; d.innerHTML = loading("Opening " + path);
    siRead(a.repo, path).then(function (md) {
      d.style.setProperty("--g", (KC_LV[a.card] || KC_LV.LV3)[1]); d.style.setProperty("--gd", "#4d5a60");
      d.innerHTML = '<div class="ds-tab"><b>' + esc(a.card) + "</b>" + esc(a.title) + '</div><div class="ds-folder"><div class="ds-page">' +
        '<header class="ds-head"><span><img src="assets/brand/hound-protocol-mark-light.svg" alt="" width="20" height="20">Hound Protocol</span><span class="ds-class">Restricted · ' + esc(a.card) + "</span></header>" +
        '<h1 class="ds-title">' + esc(siTitle(path)) + '</h1><div class="ds-meta"><span>' + esc(a.repo) + " · " + esc(path) + '</span><a href="https://github.com/' + esc(a.repo) + "/blob/HEAD/" + esc(path) + '" target="_blank" rel="noopener noreferrer">GitHub</a></div>' +
        '<div class="sh-body ds-body">' + markdown(md.replace(/^# .*\n/, ""), path) + '</div><footer class="ds-foot"><span>Restricted to ' + esc(a.card) + " and up. Do not copy it to public places.</span></footer></div></div>";
      d.classList.remove("in"); void d.offsetWidth; d.classList.add("in");
      if (d.scrollIntoView) d.scrollIntoView({ behavior: opts.motion ? "smooth" : "auto", block: "start" });
    }, function () { d.innerHTML = '<div class="empty">Could not open this document</div>'; });
  }
  /* For visitors: every card lined up, with one line on how clearance works */
  var SI_LV_INFO = {
    LV0: "Banned: refused at sign-in, on every linked account.", LV1: "Everyone at first: read every section; acting needs LV2.", LV2: "Signed in with GitHub: your profile and keycard.", LV3: "Contractors: Staff documents, claiming contracts.",
    LV4: "Quality: reviews and testing.", LV5: "Development: Leads documents, site and contract data.", LV6: "Administration: moderation, Administration documents.", LV7: "The owner: everything."
  };
  function siLevelsIntro() {
    var lv = ["LV0", "LV1", "LV2", "LV3", "LV4", "LV5", "LV6", "LV7"];
    return '<section class="si-levels"><div class="label">Clearance levels</div>' +
      '<ol class="si-how"><li><b>Sign in with GitHub</b> and you hold a member card, <b>LV2</b>.</li><li><b>Higher cards are earned:</b> a completed contract brings LV3; LV4 to LV6 come with a department. Each staff card is signed, so it cannot be faked.</li>' +
      '<li><b>GitHub guards the doors:</b> restricted documents live in private repositories that open at their level. A <b>guest pass</b> opens LV2, LV3, LV5 or LV6 for 24 hours; banned accounts are <b>LV0</b>.</li></ol>' +
      '<div class="si-lvrow">' + lv.map(function (l, k) {
        var n = +l.slice(2), spec = { id: n > 2 ? "HND-000" + n : ["REVOKED", "VISITOR", "MEMBER"][n], login: "agent", name: "Agent", github_id: 0, card: l, department: (KC_LV[l] || [""])[0], since: "", status: n === 0 ? "revoked" : "active" };
        return '<figure style="--k:' + k + '">' + keycard(spec, { specimen: true }) + "<figcaption><b>" + esc(l) + " · " + esc((KC_LV[l] || [""])[0]) + "</b>" + esc(SI_LV_INFO[l]) + "</figcaption></figure>";
      }).join("") + "</div>" +
      '<p class="sub">Full details: <a href="#/guides/hp-gde-009">Grades, Records and Hound IDs</a> · <a href="#/docs/adr-0011">ADR 0011</a></p></section>';
  }
  function drawSignedOut() {
    var on = siOn();
    $("#vb").innerHTML =
      '<div class="kc-profile">' + keycard(KC_SPECIMEN, { big: true, specimen: true }) +
      '<div class="si-intro"><h3>Sign in with your Hound ID</h3>' +
        "<p>Sign in with GitHub to see your keycard and the documents your clearance opens. Staff get their signed staff card; everyone else gets a member card.</p>" +
        (on ? '<p class="si-lv1"><b>LV1</b> You are on a temporary visitor pass with restricted clearance.</p><div class="toolbar"><button class="btn primary" id="siGo">Sign in with GitHub</button><button class="btn" id="siAsk">Request a guest pass</button></div><p class="sub" id="siMsg">A small GitHub window opens. We never see your password, and nothing is stored on a server. A sign-in lasts at most 24 hours.</p>'
            : '<p class="note">Sign-in is not switched on yet.</p>') +
        '<p class="sub">How it works and what is kept: <a href="#/docs/signin">sign-in</a> · <a href="#/docs/privacy">privacy</a></p></div></div>' + siLevelsIntro();
    var go = $("#siGo");
    if (go) go.addEventListener("click", function () {
      if (go.disabled) return; go.disabled = true; setTimeout(function () { go.disabled = false; }, 4000);
      siStart();
    });
    var ask = $("#siAsk");
    if (ask) ask.addEventListener("click", function () { if (ask.disabled) return; ask.disabled = true; setTimeout(function () { ask.disabled = false; }, 4000); askStart(); });
  }
