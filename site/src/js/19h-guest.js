  /* ---------------- Guest Pass 2.0 (tools/signin-relay/worker.js, docs/signin.md section 6) ----------------
     LV7 grants numbered passes (GC-00001 ...) at LV2, LV3, LV5 or LV6. The link is <site>#/GC-00001-7KQ4XW: the number and a
     6-character secret. Opening it shows the clearance; the recipient writes their name (required, for the pass index) and
     claims it. The claim binds the pass to this browser with a key pair made here, whose private half can never be read
     out (WebCrypto, non-extractable, kept in IndexedDB). Every request to the relay is signed with it, so the link is
     useless on any other device, which is told the pass is in use and by whom. The pass runs 24 hours from the claim; an
     hour before the end the guest is warned and may ask for 24 more hours, which only LV7 can approve, one at a time. */
  var SG_KEY = "hp.guest2", SG = null;
  try { SG = JSON.parse(localStorage.getItem(SG_KEY) || "null"); } catch (e) { SG = null; }
  try { sessionStorage.removeItem("hp.guest"); sessionStorage.removeItem("hp.guest.issued"); } catch (e) { /* the old tab-only passes, before Site 1.3.0 */ }
  function sgSave() { try { if (SG) localStorage.setItem(SG_KEY, JSON.stringify(SG)); else localStorage.removeItem(SG_KEY); } catch (e) { /* this page only */ } }
  function sgIn() { return !!(SG && SG.id && SG.exp > Date.now()); }
  function siRelay() { return String(siCfg().relay || "").replace(/\/$/, ""); }
  var GP_LV_NAME = { 2: "Guest Pass", 3: "Guest Pass", 5: "Guest Pass · Low Clearance", 6: "Guest Pass · High Clearance" };
  var GP_LV_OPENS = { 2: "Every section; no restricted documents", 3: "Staff documents", 5: "Staff and Leads documents", 6: "Staff, Leads and Administration documents" };
  function sgLvName(l) { return GP_LV_NAME[l] || "Guest Pass"; }
  function sgWhen(t) { return fmtDate(new Date(t).toISOString().slice(0, 10)) + " at " + new Date(t).toTimeString().slice(0, 5); }
  function sgLink(id, code) { return (cfg.siteUrl || "https://hound-protocol.github.io/joint-operations-web/") + "#/" + id + "-" + code; }

  /* ---- The device key, in IndexedDB. The private half is made non-extractable: not even this page can read it out. ---- */
  function gkDb() {
    return new Promise(function (ok, no) {
      if (!window.indexedDB) { no(new Error("no_idb")); return; }
      var r; try { r = indexedDB.open("hp-guest", 1); } catch (e) { no(new Error("no_idb")); return; }
      r.onupgradeneeded = function () { r.result.createObjectStore("keys"); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(new Error("no_idb")); };
    });
  }
  function gkDo(mode, fn) {
    return gkDb().then(function (db) {
      return new Promise(function (ok, no) {
        var tx = db.transaction("keys", mode), q = fn(tx.objectStore("keys"));
        tx.oncomplete = function () { ok(q && q.result); };
        tx.onerror = tx.onabort = function () { no(new Error("no_idb")); };
      });
    });
  }
  function gkGet(id) { return gkDo("readonly", function (st) { return st.get(id); }).then(function (v) { return v || null; }, function () { return null; }); }
  function gkPut(id, pair) { return gkDo("readwrite", function (st) { return st.put(pair, id); }); }
  function gkDel(id) { return gkDo("readwrite", function (st) { return st.delete(id); }).then(null, function () { /* nothing to remove */ }); }
  function gkNew() {
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.reject(new Error("no_crypto"));
    return crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]).then(function (pair) {
      return crypto.subtle.exportKey("jwk", pair.publicKey).then(function (j) { return { pair: pair, pub: { kty: "EC", crv: "P-256", x: j.x, y: j.y } }; });
    });
  }
  function gkB64u(buf) { var s = "", u = new Uint8Array(buf); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function gkErr(e) { return e && (e.message === "no_crypto" || e.message === "no_idb") ? "This browser cannot keep a device key (a private window, or an old browser). Open the link in an up-to-date browser, in a normal window." : e instanceof TypeError ? netHelp() : (e && e.message) || "Something went wrong."; }

  /* ---- Signed requests: "<pass>.<time>.<signature over time, method, path and query>" ---- */
  function sgApi(path, raw, method) {
    method = method || "GET";
    if (!sgIn()) { var e0 = new Error("No guest pass"); e0.status = 401; return Promise.reject(e0); }
    var u = new URL(siRelay() + path), id = SG.id, ts = Date.now();
    return gkGet(id).then(function (pair) {
      if (!pair) { var e1 = new Error("This browser no longer holds the key for this pass."); e1.code = "nokey"; throw e1; }
      return crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(ts + "\n" + method + "\n" + u.pathname + u.search));
    }).then(function (sig) {
      return fetch(u.href, { method: method, headers: { "X-HP-Guest": id + "." + ts + "." + gkB64u(sig) }, cache: "no-store" });
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error(j.error || "HTTP " + r.status); e.status = r.status; e.code = j.code; throw e; });
      return raw ? r.text() : r.json();
    }).then(null, function (e) { if ((e.status === 401 && e.code !== "clock") || e.code === "nokey") sgLost(e); throw e; });
  }
  /* The pass no longer works here: tell the holder why, once, and forget it on this device */
  function sgLost(e) {
    if (!SG) return;
    var id = SG.id; SG = null; sgSave(); gkDel(id); siBadge();
    if (e.code === "ended") { if (currentView === "profile" || currentView === "docs") route(); return; }
    var t = { revoked: ["Your guest pass has been revoked", "LV7 has ended guest pass " + id + ". Its clearance is closed to you now."], expired: ["Your guest pass has ended", "Guest pass " + id + " has run its time. Ask the person who sent it if you need a new one."] }[e.code] ||
      ["This guest pass no longer works here", "Guest pass " + id + " is not valid on this device any more. If you cleared this browser's data, ask the person who sent it for a new code."];
    var m = hpModal({ kicker: "Hound ID · Guest Pass", title: t[0], tone: "danger", html: "<p>" + esc(t[1]) + "</p>", actions: [{ label: "OK", primary: true, value: true }] });
    m.result.then(function () { if (currentView === "profile" || currentView === "docs") route(); });
  }
  /* Check the pass now and then: a revoked pass closes within a minute, an approved extension shows up */
  function sgCheck() {
    var before = SG && SG.ext ? SG.ext.state : "";
    return sgApi("/guest/check").then(function (j) {
      if (!SG) return j;
      Object.assign(SG, { lvl: j.lvl, exp: j.exp, name: j.name, by: j.by, ext: j.ext, exts: j.exts, repos: j.repos || [] }); sgSave(); siBadge();
      var now = j.ext ? j.ext.state : "";
      if (before === "pending" && now === "approved") { msgAdd("gpx-" + SG.id + "-" + j.ext.at, "Extension approved", "Guest pass " + SG.id + " now runs until " + sgWhen(j.exp) + ".", "ok"); status("Guest pass extended"); if (currentView === "profile") route(); }
      if (before === "pending" && now === "declined") { msgAdd("gpx-" + SG.id + "-" + j.ext.at, "Extension declined", "LV7 declined your request. Guest pass " + SG.id + " ends at " + sgWhen(j.exp) + ".", "bad"); if (currentView === "profile") route(); }
      return j;
    });
  }
  setInterval(function () {
    if (!sgIn()) return;
    if (!document.hidden) sgCheck().then(null, function () { /* handled in sgApi */ });
    /* One hour before the end: a message and a window offering the extension */
    var left = SG.exp - Date.now(), wk = "hp.gwarn." + SG.id + "." + SG.exp;
    if (left > 0 && left < 3600 * 1000 && !lsv(wk)) {
      lsv(wk, "1");
      msgAdd("gpw-" + SG.id + "-" + SG.exp, "Guest pass ends soon", "Guest pass " + SG.id + " ends at " + new Date(SG.exp).toTimeString().slice(0, 5) + ". You can ask LV7 for 24 more hours on your Profile.", "req");
      var pend = SG.ext && SG.ext.state === "pending";
      var m = hpModal({ kicker: "Hound ID · Guest Pass", title: "Your guest pass ends within the hour",
        html: "<p>Guest pass <b>" + esc(SG.id) + "</b> ends at <b>" + esc(new Date(SG.exp).toTimeString().slice(0, 5)) + "</b>.</p><p>" + (pend ? "Your extension request is already waiting for LV7." : "You can ask LV7 for 24 more hours. Only LV7 can approve it.") + "</p>",
        actions: pend ? [{ label: "OK", primary: true, value: true }] : [{ label: "Not now", value: null }, { label: "Request 24 h extension", primary: true, run: function () { m.close(true); sgExtend(); } }] });
    }
  }, 60 * 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && sgIn()) sgCheck().then(null, function () { /* handled in sgApi */ }); });
  function sgExtend() {
    return sgApi("/guest/extend", false, "POST").then(function (j) {
      SG.ext = j.ext; sgSave();
      msgAdd("gpr-" + SG.id + "-" + j.ext.at, "Extension requested", "Your request for 24 more hours on guest pass " + SG.id + " is waiting for LV7.", "info");
      status("Extension requested"); blip("go"); if (currentView === "profile") route();
    }, function (e) { if (e.code === "pending") status("An extension request is already waiting"); else if (e.status !== 401) hpModal({ kicker: "Hound ID · Guest Pass", title: "No extension requested", html: "<p>" + esc(gkErr(e)) + "</p>", actions: [{ label: "OK", primary: true, value: true }] }); });
  }
  function sgEnd() {
    var id = SG && SG.id;
    return sgApi("/guest/end", false, "POST").then(null, function () { /* ends here either way */ }).then(function () { SG = null; sgSave(); if (id) gkDel(id); siBadge(); status("Guest pass ended"); route(); });
  }
  /* The guest's card, from the pass */
  function sgCard() { return { id: SG.id, login: "guest", name: SG.name || "Guest", github_id: 0, avatar: "", card: "LV" + SG.lvl, department: sgLvName(SG.lvl), since: "", status: "active", guest: true, exp: SG.exp }; }
  function sgRepos() { return (SG && SG.repos) || []; }
  function sgTree(repo) { return sgApi("/guest/tree?repo=" + encodeURIComponent(repo)).then(function (j) { return j.paths || []; }); }
  function sgFile(repo, path) { return sgApi("/guest/file?repo=" + encodeURIComponent(repo) + "&path=" + encodeURIComponent(path), true); }
  /* The Profile's facts for a guest, with the extension request and End pass */
  function sgFacts(c) {
    var ext = SG.ext, es = ext ? ext.state : "", n = SG.exts || 0;
    var extTxt = es === "pending" ? "Your request for 24 more hours is waiting for LV7 (since " + new Date(ext.at).toTimeString().slice(0, 5) + ")." : es === "declined" ? "LV7 declined your last request." + (n ? " Extended " + plural(n, "time") + " before." : "") : n ? "Extended " + plural(n, "time") + ". You can ask for 24 more hours." : "You can ask LV7 for 24 more hours. Only LV7 can approve it.";
    return '<dl class="kc-facts"><div><dt>Pass</dt><dd><b>' + esc(SG.id) + "</b> · LV" + esc(SG.lvl) + " " + esc(sgLvName(SG.lvl)) + (SG.by ? ", granted by " + esc(SG.by) : "") + ".</dd></div>" +
      "<div><dt>Holder</dt><dd>" + esc(SG.name || "Guest") + " (as written in the pass index)</dd></div>" +
      "<div><dt>Expires</dt><dd>" + esc(sgWhen(c.exp)) + " · " + esc(sgLeft(c.exp)) + " left.</dd></div>" +
      "<div><dt>Extension</dt><dd>" + esc(extTxt) + "</dd></div>" +
      "<div><dt>Device</dt><dd>Bound to this browser. The pass works nowhere else.</dd></div></dl>" +
      '<div class="toolbar gp-own"><button type="button" class="btn" id="gpExt"' + (es === "pending" ? " disabled" : "") + ">Request 24 h extension</button></div>" +
      '<button type="button" class="si-out" id="siOut"><i aria-hidden="true"></i><span>End pass<small>End guest clearance</small></span></button>';
  }
  function sgFactsWire() {
    var b = $("#gpExt"); if (b) b.addEventListener("click", function () { if (b.disabled) return; b.disabled = true; sgExtend(); });
  }

  /* ---- Opening a pass link: #/GC-00001-7KQ4XW ---- */
  function sgDenied(msg) {
    $("#vb").innerHTML = '<div class="ad gp-bad"><div class="ad-box"><small>Security</small><strong>Access denied</strong><em>' + esc(msg) + "</em><p>Ask the person who sent it for a new one, or contact Administration.</p>" +
      '<div class="ad-act"><a class="btn small" href="#/briefing">About Joint Operations</a><a class="btn small" href="#/guides/hp-gde-015">Using the website</a></div></div></div>';
  }
  function sgInUse(name) {
    sgDenied("This pass is already in use" + (name ? " by " + name : "") + ".");
    hpModal({ kicker: "Hound ID · Guest Pass", title: "This pass is already in use", tone: "danger",
      html: "<p>This pass is already in use by <b>" + esc(name || "someone else") + "</b>.</p><p class=\"hm-note\">A guest pass works on one device only: the one that claimed it. If this is your pass and you changed browser or cleared its data, ask the person who sent it for a new code.</p>",
      actions: [{ label: "OK", primary: true, value: true }] });
  }
  function viewGuest(param) {
    var v = $("#view");
    v.innerHTML = shell("Hound ID", "Guest Pass", loading("Checking your guest pass"));
    var m = /^(GC-\d{5})-([2-9A-HJ-NP-Z]{6})$/i.exec(String(param || "")), id = m && m[1].toUpperCase(), code = m && m[2].toUpperCase();
    if (!siOn()) { sgDenied("Guest passes are not switched on yet."); return; }
    if (!m) { sgDenied("This link does not hold a valid guest pass. Links from before Site 1.3.0 no longer work."); return; }
    fetch(siRelay() + "/guest/peek?id=" + id + "&code=" + code, { cache: "no-store" }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); }).then(function (x) {
      if (currentView !== "guest") return;
      var j = x.j;
      if (!x.ok || !j.state) { sgDenied(j.error && j.code === "invalid" ? j.error : "This guest pass is not valid."); return; }
      if (j.state === "unclaimed") { sgClaim(id, code, j); return; }
      if (j.state === "active") {
        /* Claimed already: on the device that claimed it, carry on; anywhere else, say who holds it */
        return gkGet(id).then(function (pair) {
          if (!pair) { sgInUse(j.name); return; }
          SG = { id: id, lvl: j.lvl, exp: j.exp, name: j.name, by: j.by }; sgSave();
          return sgCheck().then(function () { siBadge(); location.replace("#/profile"); }, function () { sgInUse(j.name); });
        });
      }
      sgDenied({ revoked: "This guest pass has been revoked.", ended: "This guest pass was ended by its holder.", expired: "This guest pass has run its time.", lapsed: "This guest pass was not claimed within 72 hours." }[j.state] || "This guest pass is no longer valid.");
    }, function (e) { if (currentView === "guest") sgDenied(e instanceof TypeError ? netHelp() : "This guest pass could not be checked. Try again in a minute."); });
  }
  /* The claim window: the clearance, a name (required), Claim. Then the credential rises in the middle of the window. */
  function sgClaim(id, code, j) {
    $("#vb").innerHTML = '<div class="gp-await"><span class="gp-await-id">' + esc(id) + "</span></div>";
    var lv = KC_LV["LV" + j.lvl] || KC_LV.LV3, busy = false;
    var m = hpModal({ kicker: "Hound ID · Guest Pass", title: "You have been granted temporary clearance via Guest Pass",
      html: '<div class="gc-lv" style="--hk:' + lv[1] + '"><b>LV' + esc(j.lvl) + "</b><span>" + esc(sgLvName(j.lvl)) + "<small>" + esc(GP_LV_OPENS[j.lvl] || "") + " · " + esc(id) + "</small></span></div>" +
        "<p>Granted by <b>" + esc(j.by || "LV7") + "</b>. It lasts <b>24 hours</b> from the moment you claim it, and is bound to <b>this device</b>: once claimed, it works in this browser only.</p>" +
        '<label class="ga-f"><span>Your name</span><input id="gcName" type="text" maxlength="40" autocomplete="name" spellcheck="false" placeholder="Kept in the pass index"></label><p class="ga-msg" id="gcMsg" aria-live="polite"></p>' +
        '<p class="hm-note">Claim before ' + esc(sgWhen(j.claimBy)) + ". Do not share this link.</p>",
      actions: [{ label: "Not now", value: null }, { label: "Claim", primary: true, run: claim }] });
    m.el.classList.add("hm-blur", "hm-gate");
    var inp = $("#gcName"); if (inp) { inp.focus(); inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); claim(); } }); }
    function say(t) { var el = $("#gcMsg"); if (el) el.textContent = t; }
    function claim() {
      if (busy) return;
      var name = String((inp && inp.value) || "").replace(/\s+/g, " ").trim(), btn = $("#hpModal .hm-act .primary");
      if (name.length < 2) { say("Write your name. It is kept in the pass index, and the pass cannot be claimed without it."); if (inp) inp.focus(); return; }
      busy = true; if (btn) btn.disabled = true; say("Binding the pass to this device…");
      var made;
      /* The key is stored before the claim, so a claimed pass never ends up without its key on this device */
      gkNew().then(function (k) { made = k; return gkPut(id, k.pair); }).then(function () {
        return fetch(siRelay() + "/guest/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, code: code, name: name, pub: made.pub }), cache: "no-store" });
      }).then(function (r) { return r.json().then(function (k) { if (!r.ok) { var e = new Error(k.error || "HTTP " + r.status); e.code = k.code; e.holder = k.name; throw e; } return k; }); }).then(function (k) {
        sgGranted(m, { id: id, lvl: k.lvl, exp: k.exp, name: k.name, by: j.by });
      }, function (e) {
        busy = false; if (btn) btn.disabled = false; gkDel(id);
        if (e.code === "in_use") { m.close(null); sgInUse(e.holder); return; }
        say(gkErr(e));
      });
    }
  }
  /* Access granted: the guest's credential in the middle of the window, with the sign-in reveal, then the Profile */
  function sgGranted(m, p) {
    SG = { id: p.id, lvl: p.lvl, exp: p.exp, name: p.name, by: p.by }; sgSave(); siFresh = Date.now(); siBadge();
    msgAdd("gpg-" + p.id, "Clearance granted · LV" + p.lvl + " guest pass", "Guest pass " + p.id + " (" + sgLvName(p.lvl) + ") is yours on this device until " + sgWhen(p.exp) + ".", "ok");
    sgCheck().then(null, function () { /* the Profile checks again */ });
    if (!m) m = hpModal({ kicker: "Hound ID · Guest Pass", title: "You have been granted temporary clearance via Guest Pass", html: "", actions: [] });
    $(".hm-win", m.el).classList.add("hm-wide");
    $("#hmTitle", m.el).textContent = "Access granted";
    m.body('<div class="gc-reveal">' + keycard(sgCard(), { big: true }) + '</div><p class="gc-done">LV' + esc(p.lvl) + " · " + esc(sgLvName(p.lvl)) + " · until " + esc(sgWhen(p.exp)) + "</p>");
    kcReveal($(".gc-reveal .hk", m.el));
    m.actions([{ label: "Open my profile", primary: true, value: true }]);
    m.result.then(function () { location.replace("#/profile"); });
    blip("go");
  }

  /* ---- LV7: the guest pass desk ---- */
  function sgOwnerApi(path, method, body) {
    var o = { method: method || "GET", headers: { Authorization: "Bearer " + SI.token }, cache: "no-store" };
    if (body) { o.headers["Content-Type"] = "application/json"; o.body = JSON.stringify(body); }
    return fetch(siRelay() + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          /* An older relay does not know these commands */
          var old = j.code === "invalid" || /guest pass is not valid|Unknown request|Unknown pass\b/.test(j.error || "");
          var e = new Error(old ? "The sign-in relay runs older code: Guest Pass 2.0 needs its update (sign-in setup, section 6)." : j.error || "HTTP " + r.status);
          e.code = old ? "old_relay" : j.code; throw e;
        }
        return j;
      });
    });
  }
  function sgPanel() {
    return '<section class="gp"><header><span class="gp-ico" aria-hidden="true"></span><div><b>Guest passes</b><small>LV7 only · LV2, LV3, LV5 or LV6 for 24 hours from the claim. Each pass is claimed once, by name, and works on that one device.</small></div>' +
      '<button class="btn primary" id="gpGrant">Grant Guest Pass</button></header><p class="sub" id="gpMsg" aria-live="polite"></p>' +
      '<div class="gp-cols"><div class="gp-col"><div class="gp-ch"><b>Passes</b><button class="btn small danger" id="gpAll" type="button">Clear all</button></div><ul class="gp-list" id="gpList"><li class="none"><span>Loading…</span></li></ul></div>' +
      '<div class="gp-col"><div class="gp-ch"><b>Requests</b><small>Visitors and extensions</small></div><ul class="gp-list gp-asks" id="gpAsks"><li class="none"><span>Loading…</span></li></ul></div></div>' +
      '<details class="gp-hist"><summary>History <small id="gpHistN"></small></summary><div class="gp-hist-w" id="gpHist"></div></details></section>';
  }
  var GP_STATE = { active: ["Active", "ok"], unclaimed: ["Not claimed", "wait"], expired: ["Expired", "ex"], revoked: ["Revoked", "rv"], ended: ["Ended by holder", "ex"], lapsed: ["Never claimed", "ex"] };
  function sgLvTag(l) { return '<span class="gp-lv" style="--hk:' + (KC_LV["LV" + l] || KC_LV.LV3)[1] + '">LV' + esc(l) + "</span>"; }
  function sgLoad() {
    var ul = $("#gpList"); if (!ul) return;
    sgOwnerApi("/guest/list").then(function (j) {
      var ps = j.passes || [], live = ps.filter(function (x) { return !x.hidden && (x.state === "active" || x.state === "unclaimed"); });
      ul.innerHTML = (live.map(function (x) {
        var st = GP_STATE[x.state] || [x.state, ""];
        return '<li class="' + st[1] + '"><span class="gp-st">' + st[0] + "</span><code>" + esc(x.id) + "</code>" + sgLvTag(x.lvl) +
          '<span class="gp-who"><b>' + esc(x.name || "Not claimed yet") + "</b><small>" + (x.state === "active" ? "Until " + esc(sgWhen(x.exp)) + " · " + esc(sgLeft(x.exp)) + " left" + (x.ext && x.ext.state === "pending" ? " · extension asked" : "") : "Claim by " + esc(sgWhen(x.claimBy))) + " · by " + esc(x.by) + "</small></span>" +
          '<span class="gp-btns"><button class="btn small" data-gpnew="' + esc(x.id) + '" data-live="' + (x.state === "active" ? 1 : 0) + '">New code</button><button class="btn small danger" data-gprv="' + esc(x.id) + '">Revoke</button><button class="btn small" data-gpclr="' + esc(x.id) + '">Clear</button></span></li>';
      }).join("") || '<li class="none"><span>No live guest passes.</span></li>');
      sgHistory(ps);
      sgWireList();
    }, function (e) { $("#gpMsg").textContent = e instanceof TypeError ? netHelp() : e.message; ul.innerHTML = ""; });
  }
  /* Every pass ever issued: to whom, at which level, and what became of it */
  function sgHistory(ps) {
    var box = $("#gpHist"); if (!box) return;
    $("#gpHistN").textContent = plural(ps.length, "pass") + " issued";
    function out(x) {
      if (x.state === "active") return "Active until " + sgWhen(x.exp);
      if (x.state === "unclaimed") return "Not claimed yet";
      if (x.state === "revoked") return "Revoked by " + (x.revokedBy || "LV7") + ", " + sgWhen(x.revokedAt);
      if (x.state === "ended") return "Ended by the holder, " + sgWhen(x.endedAt);
      if (x.state === "expired") return "Ran out of time, " + sgWhen(x.exp);
      return "Never claimed";
    }
    box.innerHTML = ps.length ? '<table class="gp-ht"><thead><tr><th>Pass</th><th>Level</th><th>Holder</th><th>Issued</th><th>Claimed</th><th>Outcome</th><th>Ext.</th><th></th></tr></thead><tbody>' + ps.map(function (x) {
      var live = x.state === "active" || x.state === "unclaimed";
      return "<tr><td><code>" + esc(x.id) + "</code>" + (x.fromAsk ? ' <small title="From a visitor request">req</small>' : "") + "</td><td>" + sgLvTag(x.lvl) + "</td><td>" + esc(x.name || "–") + "</td><td>" + esc(sgWhen(x.at)) + "<small>by " + esc(x.by) + "</small></td><td>" + (x.claimedAt ? esc(sgWhen(x.claimedAt)) : "–") + '</td><td class="gp-o-' + esc(x.state) + '">' + esc(out(x)) + "</td><td>" + (x.exts || 0) + "</td><td>" + (live ? "" : '<button class="btn small" data-gpfg="' + esc(x.id) + '" title="Delete this pass from the history">Forget</button>') + "</td></tr>";
    }).join("") + "</tbody></table>" : '<p class="sub">No guest pass has been issued yet.</p>';
    $$("[data-gpfg]", box).forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-gpfg");
        hpConfirm("Forget " + id + "?", "It is deleted from the history for good, with the holder's name. Use this when someone asks for their name to be removed.", "Forget", "Keep it", "danger").then(function (y) {
          if (!y) return; b.disabled = true;
          sgOwnerApi("/guest/forget?id=" + encodeURIComponent(id), "POST").then(function () { status(id + " forgotten"); sgLoad(); }, function (e) { b.disabled = false; $("#gpMsg").textContent = e.message; });
        });
      };
    });
  }
  /* The link window for LV7, after a grant or a new code: shown once, with Copy */
  function sgShowLink(m, k) {
    var u = sgLink(k.id, k.code);
    $("#hmTitle", m.el).textContent = "Guest pass " + k.id + " issued";
    m.body('<p class="gp-lead">' + sgLvTag(k.lvl) + " <b>" + esc(sgLvName(k.lvl)) + "</b> · " + esc(GP_LV_OPENS[k.lvl] || "") + ". It runs 24 hours from the claim, and can be claimed once, by one device, before " + esc(sgWhen(k.claimBy)) + ".</p>" +
      '<div class="gp-link"><textarea id="gpUrl" readonly rows="2" spellcheck="false" aria-label="Guest pass link">' + esc(u) + '</textarea><button type="button" class="btn small primary" id="gpCopy">Copy</button></div>' +
      '<p class="hm-note">Send it privately. This link is shown only now; if it is lost, use <b>New code</b> on the pass.</p>');
    m.actions([{ label: "Done", primary: true, value: true }]);
    var inp = $("#gpUrl"), cb = $("#gpCopy");
    inp.addEventListener("focus", function () { inp.select(); });
    cb.addEventListener("click", function () {
      function done() { cb.textContent = "Copied"; status("Guest link copied"); blip("go"); }
      function fallback() { inp.focus(); inp.select(); var ok2 = false; try { ok2 = document.execCommand("copy"); } catch (e) { ok2 = false; } if (ok2) done(); else cb.textContent = "Press Ctrl+C"; }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(u).then(done, fallback); else fallback();
    });
    setTimeout(function () { inp.focus(); inp.select(); }, 60);
  }
  function sgLvPick(name, sel) {
    return '<div class="gl-pick" role="radiogroup">' + [2, 3, 5, 6].map(function (l) {
      return '<label class="gl-opt" style="--hk:' + (KC_LV["LV" + l] || KC_LV.LV3)[1] + '"><input type="radio" name="' + name + '" value="' + l + '"' + (l === sel ? " checked" : "") + "><b>LV" + l + "</b><span>" + esc(sgLvName(l)) + "<small>" + esc(GP_LV_OPENS[l]) + "</small></span></label>";
    }).join("") + "</div>";
  }
  function sgWireList() {
    $$("[data-gprv]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-gprv");
        hpConfirm("Revoke guest pass " + id + "?", "Its holder loses access within a minute. This cannot be undone.", "Revoke pass", "Keep it", "danger").then(function (y) {
          if (!y) return; b.disabled = true;
          sgOwnerApi("/guest/revoke?id=" + encodeURIComponent(id), "POST").then(function () { status("Guest pass revoked"); blip("go"); sgLoad(); }, function (e) { b.disabled = false; $("#gpMsg").textContent = e.message; });
        });
      };
    });
    $$("[data-gpclr]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-gpclr");
        hpConfirm("Clear guest pass " + id + "?", "It is revoked at once and leaves this list. It stays in the history.", "Clear pass", "Keep it", "danger").then(function (y) {
          if (!y) return; b.disabled = true;
          sgOwnerApi("/guest/delete?id=" + encodeURIComponent(id), "POST").then(function () { status("Guest pass cleared"); sgLoad(); }, function (e) { b.disabled = false; $("#gpMsg").textContent = e.message; });
        });
      };
    });
    $$("[data-gpnew]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-gpnew"), live = b.getAttribute("data-live") === "1";
        hpConfirm("A new code for " + id + "?", live ? "Its holder loses access now; the pass becomes unclaimed again, with a new link for whoever should hold it." : "The old link stops working, and a new one is shown once.", "New code", "Cancel", live ? "danger" : "").then(function (y) {
          if (!y) return; b.disabled = true;
          var m = hpModal({ kicker: "Hound ID · Guest Pass", title: "New code", html: '<div class="hm-wait"><span class="spin"></span><b>Making a new code…</b></div>', actions: [] });
          sgOwnerApi("/guest/reissue?id=" + encodeURIComponent(id), "POST").then(function (k) { sgShowLink(m, k); sgLoad(); }, function (e) { m.body('<div class="hm-err"><b>No new code</b><small>' + esc(e.message) + "</small></div>"); m.actions([{ label: "Close", value: null }]); b.disabled = false; });
        });
      };
    });
  }
  function sgAsks() {
    var ul = $("#gpAsks"); if (!ul) return;
    sgOwnerApi("/guest/asks").then(function (j) {
      var a = j.asks || [], open = a.filter(function (x) { return x.state === "pending"; }), done = a.filter(function (x) { return x.state !== "pending"; }), ex = j.extensions || [];
      function t(at) { return esc(new Date(at).toTimeString().slice(0, 5)) + " · " + esc(msgAgo(at)); }
      ul.innerHTML = '<li class="gp-h"><b>Extensions</b><span>' + ex.length + "</span></li>" +
        (ex.map(function (x) { return '<li class="ok"><span class="gp-st">+24 h</span><code>' + esc(x.id) + "</code>" + sgLvTag(x.lvl) + '<span class="gp-who"><b>' + esc(x.name) + "</b><small>Asked " + t(x.ext.at) + " · ends " + esc(sgWhen(x.exp)) + '</small></span><button class="btn small primary" data-exok="' + esc(x.id) + '">Approve</button><button class="btn small" data-exno="' + esc(x.id) + '">Decline</button></li>'; }).join("") || '<li class="none"><span>No extension requests.</span></li>') +
        '<li class="gp-h"><b>Visitors</b><span>' + open.length + "</span></li>" +
        (open.map(function (x) { return '<li class="ok"><span class="gp-st">New</span><span class="gp-who"><b>' + esc(x.name) + "</b><small>Asked " + t(x.at) + '</small></span><select class="field gp-sel" data-asklv="' + esc(x.id) + '" aria-label="Clearance for ' + esc(x.name) + '"><option value="2">LV2</option><option value="3" selected>LV3</option><option value="5">LV5 · Low</option><option value="6">LV6 · High</option></select><button class="btn small primary" data-ok="' + esc(x.id) + '">Approve</button><button class="btn small" data-no="' + esc(x.id) + '">Decline</button></li>'; }).join("") || '<li class="none"><span>No visitor requests waiting.</span></li>') +
        (done.length ? '<li class="gp-h"><b>Answered</b><span>' + done.length + " · kept 2 days</span></li>" + done.map(function (x) { return '<li class="' + (x.state === "approved" ? "ex" : "rv") + '"><span class="gp-st">' + (x.state === "approved" ? "Approved" : "Declined") + '</span><span class="gp-who"><b>' + esc(x.name) + "</b><small>" + t(x.at) + (x.by ? " · by " + esc(x.by) : "") + (x.pass ? " · " + esc(x.pass) + (x.lvl ? " LV" + esc(x.lvl) : "") : "") + "</small></span></li>"; }).join("") : "");
      $$("[data-ok],[data-no]", ul).forEach(function (b) {
        b.onclick = function () {
          var ok2 = b.hasAttribute("data-ok"), id = b.getAttribute(ok2 ? "data-ok" : "data-no"), sel = $('[data-asklv="' + id + '"]', ul), lvl = sel ? sel.value : "3";
          $$("button, select", b.parentNode).forEach(function (x) { x.disabled = true; });
          sgOwnerApi("/guest/" + (ok2 ? "approve" : "decline") + "?id=" + encodeURIComponent(id) + (ok2 ? "&lvl=" + encodeURIComponent(lvl) : ""), "POST").then(function (k) {
            $("#gpMsg").textContent = ok2 ? "Approved as " + k.pass + " at LV" + lvl + ". The pass opens on the visitor's device by itself." : "Declined. They are told on their side.";
            status(ok2 ? "Guest pass approved" : "Request declined"); blip("go"); sgLoad(); sgAsks();
          }, function (e) { $("#gpMsg").textContent = e.message; $$("button, select", b.parentNode).forEach(function (x) { x.disabled = false; }); });
        };
      });
      $$("[data-exok],[data-exno]", ul).forEach(function (b) {
        b.onclick = function () {
          var ok2 = b.hasAttribute("data-exok"), id = b.getAttribute(ok2 ? "data-exok" : "data-exno");
          $$("button", b.parentNode).forEach(function (x) { x.disabled = true; });
          sgOwnerApi("/guest/extend-" + (ok2 ? "approve" : "decline") + "?id=" + encodeURIComponent(id), "POST").then(function () {
            $("#gpMsg").textContent = ok2 ? id + " runs 24 hours longer. The holder is told within a minute." : "Extension declined. The holder is told within a minute.";
            status(ok2 ? "Extension approved" : "Extension declined"); blip("go"); sgLoad(); sgAsks();
          }, function (e) { $("#gpMsg").textContent = e.message; $$("button", b.parentNode).forEach(function (x) { x.disabled = false; }); });
        };
      });
    }, function (e) { ul.innerHTML = '<li class="none"><span>' + esc(e.code === "no_kv" ? "Guest passes need the KV storage on the relay (sign-in setup, section 6)." : e instanceof TypeError ? netHelp() : e.message) + "</span></li>"; });
  }
  function sgPanelWire() {
    sgLoad(); sgAsks();
    var g = $("#gpGrant");
    if (g) g.addEventListener("click", function () {
      if (g.disabled) return;
      var m = hpModal({ kicker: "Hound ID · Guest Pass", title: "Grant a guest pass", html: "<p>Choose the clearance. The pass runs 24 hours from the claim, on the one device that claims it.</p>" + sgLvPick("gpLv", 3),
        actions: [{ label: "Cancel", value: null }, { label: "Grant", primary: true, run: grant }] });
      function grant() {
        var pick = $('input[name="gpLv"]:checked'), lvl = pick ? +pick.value : 3;
        g.disabled = true;
        m.body('<div class="hm-wait"><span class="spin"></span><b>Issuing a guest pass…</b></div>'); m.actions([]);
        sgOwnerApi("/guest/grant", "POST", { lvl: lvl }).then(function (k) { sgShowLink(m, k); sgLoad(); blip("go"); }, function (e) {
          m.body('<div class="hm-err"><b>No pass issued</b><small>' + esc(e instanceof TypeError ? netHelp() : e.message) + "</small></div>"); m.actions([{ label: "Close", value: null }]);
        }).then(function () { setTimeout(function () { g.disabled = false; }, 1500); });
      }
    });
    var all = $("#gpAll");
    if (all) all.addEventListener("click", function () {
      hpConfirm("Clear every guest pass?", "Every live pass is revoked at once and leaves the list. The history keeps them all. Requests are not touched.", "Clear all", "Cancel", "danger").then(function (y) {
        if (!y) return; all.disabled = true;
        sgOwnerApi("/guest/purge?all=1", "POST").then(function (j) { status(plural(j.cleared || 0, "guest pass") + " cleared"); sgLoad(); }, function (e) { $("#gpMsg").textContent = e.message; }).then(function () { all.disabled = false; });
      });
    });
  }
