  /* ---------------- Clearance gate, guest pass requests and messages ----------------
     Everyone who is not signed in holds a temporary LV1 pass. LV1 can READ every section; ACTING (claiming a contract,
     downloading a build, joining a session) asks for LV2 in a small window, with two ways up: sign in with GitHub (LV2 at
     once) or ask the owner for a guest pass (LV3, 24 h). A section that should stay closed at LV1 can be left out of
     LV1_OPEN: it then shows No access over a blurred page.
     A visitor sees the welcome window on each visit until this browser has once signed in with GitHub. This is a gate in the
     interface: the public documents themselves stay public on GitHub. */
  var LV1_OPEN = { briefing: 1, roadmap: 1, team: 1, docs: 1, guides: 1, options: 1, profile: 1, verify: 1, guest: 1, g: 1, download: 1, sessions: 1, contribute: 1, mods: 1 };
  function lv2Has() { return !siOn() || EMBED || siLevel() >= 2; }
  /* An action that needs LV2: a small window with the two ways up. Returns true when the action may go ahead. */
  function needLv2(what) {
    if (lv2Has()) return true;
    var m = hpModal({ kicker: "Hound ID · Clearance", title: "LV2 needed",
      html: "<p>" + esc(what) + " needs <b>LV2</b>. You are on a temporary LV1 pass: you can read everything, but actions need a Hound ID.</p>" +
        '<ul class="gw-ways"><li><b>Sign in with GitHub</b><span>LV2 at once.</span></li><li><b>Request a guest pass</b><span>For people the owner knows: a 24-hour pass, usually LV3, once approved.</span></li></ul>',
      actions: [{ label: "Not now", value: null }, { label: "Request a guest pass", run: function () { m.close(null); setTimeout(askStart, 240); } }, { label: "Sign in with GitHub", primary: true, run: function () { m.close(null); setTimeout(function () { siStart({ stay: true }); }, 240); } }] });
    m.el.classList.add("hm-gate");
    return false;
  }
  function lsv(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (e) { /* storage blocked: this visit only */ } return null; }
  function ssv(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, String(v)); } catch (e) { /* this page only */ } return null; }
  function gateNeeded(view) { return siOn() && !EMBED && siLevel() < 2 && !LV1_OPEN[view]; }
  function gateApply(view) {
    var v = $("#view"), vb = $("#vb"), old = $("#gate");
    if (old) old.remove();
    var need = !!(v && vb && gateNeeded(view));
    if (v) v.classList.toggle("gated", need);
    if (vb) { if (need) { vb.setAttribute("inert", ""); vb.setAttribute("aria-hidden", "true"); } else { vb.removeAttribute("inert"); vb.removeAttribute("aria-hidden"); } }
    if (!need) return;
    var a = askGet();
    v.insertAdjacentHTML("beforeend", '<div class="gate" id="gate" role="alertdialog" aria-labelledby="gateT"><div class="gate-win">' +
      '<div class="gate-top"><span class="gate-lv">LV1</span><small>Restricted clearance</small></div>' +
      '<strong id="gateT">No access</strong><p>This section opens at <b>LV2</b>. You are on a temporary LV1 pass.</p>' +
      (a ? '<p class="gate-wait"><span class="spin"></span>Your guest pass request as <b>' + esc(a.name) + "</b> is waiting for the owner. It opens here by itself once approved.</p>" : "") +
      '<div class="gate-act"><button type="button" class="btn primary" data-gate="in">Sign in with GitHub</button><button type="button" class="btn" data-gate="ask">Request a guest pass</button></div>' +
      '<p class="gate-note">Open to LV1: <a href="#/briefing">About</a> · <a href="#/roadmap">Roadmap</a> · <a href="#/team">Team</a> · <a href="#/docs">Documentation</a> · <a href="#/options">Options</a></p></div></div>');
    var g = $("#gate"); g.style.top = vb.offsetTop + "px";
    gateWire(g);
  }
  /* Both buttons rest for a moment after a click, so they cannot be hammered */
  function gateWire(root) {
    $$("[data-gate]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.disabled) return;
        b.disabled = true; setTimeout(function () { b.disabled = false; }, 4000);
        if (b.getAttribute("data-gate") === "in") siStart({ stay: true }); else askStart();
      });
    });
  }
  /* The welcome window: on each visit, until this browser has signed in with GitHub once */
  function gateWelcome() {
    if (!siOn() || EMBED || siLevel() >= 2 || lsv("hp.verified") || ssv("hp.welcomed") || $("#hpModal") || currentView === "guest") return;
    ssv("hp.welcomed", "1");
    msgAdd("lv1", "Temporary LV1 pass", "You are on restricted clearance. Sign in with GitHub for LV2, or ask the owner for a guest pass.", "lv1");
    var a = askGet();
    var m = hpModal({ kicker: "Hound ID · Clearance", title: "You are on restricted clearance",
      html: '<div class="gw"><div class="gw-lv"><b>LV1</b><span>Visitor<small>Temporary pass</small></span></div>' +
        "<p>Your access is limited. You can <b>read every section</b>. Actions such as claiming a contract, downloading a build or joining a session need a higher clearance.</p>" +
        '<ul class="gw-ways"><li><b>Sign in with GitHub</b><span>LV2 at once: your profile, your keycard, claiming contracts and downloads.</span></li>' +
        "<li><b>Request a guest pass</b><span>For people the owner knows: a 24-hour pass, usually LV3, once the owner approves it.</span></li></ul>" +
        (a ? '<p class="hm-note">Your guest pass request as <b>' + esc(a.name) + "</b> is still waiting for the owner.</p>" : "") + "</div>",
      actions: [{ label: "Continue with LV1", value: null }, { label: "Request a guest pass", run: function () { m.close(null); setTimeout(askStart, 240); } }, { label: "Sign in with GitHub", primary: true, run: function () { m.close(null); setTimeout(function () { siStart({ stay: true }); }, 240); } }] });
    m.el.classList.add("hm-blur", "hm-gate");
  }

  /* ---- Guest pass requests (LV1): a name, at most one request a minute; the pass opens here by itself when approved ---- */
  var ASK_KEY = "hp.ask", ASK_LAST = "hp.ask.last";
  function askGet() { try { return JSON.parse(lsv(ASK_KEY) || "null"); } catch (e) { return null; } }
  function askWait() { return Math.max(0, 60 - Math.floor((Date.now() - (+(lsv(ASK_LAST) || 0))) / 1000)); }
  function askStart() {
    if (!siOn()) return;
    if (sgIn()) { status("You already hold a guest pass"); return; }
    var cur = askGet(), timer = 0;
    var m = hpModal({ kicker: "Hound ID · Guest pass", title: "Request a guest pass",
      html: "<p>Guest passes are for people the owner knows. The owner sees your name and approves or declines; an approved pass opens LV3 here for 24 hours, by itself.</p>" +
        (cur ? '<p class="hm-note">You already asked as <b>' + esc(cur.name) + "</b>. A new request replaces it.</p>" : "") +
        '<label class="ga-f"><span>Your name</span><input id="gaName" type="text" maxlength="40" autocomplete="name" spellcheck="false" placeholder="How the owner knows you"></label>' +
        '<p class="ga-msg" id="gaMsg" aria-live="polite"></p>',
      cancel: function () { clearInterval(timer); },
      actions: [{ label: "Cancel", value: null }, { label: "Send request", primary: true, run: send }] });
    var inp = $("#gaName"); if (inp) { inp.focus(); inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); send(); } }); }
    function btn() { return $("#hpModal .hm-act .primary"); }
    function tick() {
      var b = btn(), w = askWait(); if (!b) { clearInterval(timer); return; }
      b.disabled = w > 0; b.textContent = w > 0 ? "Send request (" + w + " s)" : "Send request";
      if (!w) clearInterval(timer);
    }
    if (askWait()) { tick(); timer = setInterval(tick, 1000); }
    function say(t) { var el = $("#gaMsg"); if (el) el.textContent = t; }
    function send() {
      var name = String((inp && inp.value) || "").replace(/\s+/g, " ").trim();
      if (name.length < 2) { say("Write your name, so the owner knows who is asking."); if (inp) inp.focus(); return; }
      if (askWait()) { say("You can ask again in " + askWait() + " s."); return; }
      lsv(ASK_LAST, Date.now()); var b = btn(); if (b) b.disabled = true; say("Sending…");
      /* A device key goes with the request, so an approved pass is bound to this browser at once. If this browser cannot
         keep one, the request goes without it and an approved pass arrives as a link to claim instead. */
      var made = null;
      gkNew().then(function (k) { return gkPut("ask:pending", k.pair).then(function () { made = k; }); }, function () { made = null; }).then(null, function () { made = null; }).then(function () {
        return fetch(siRelay() + "/guest/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(made ? { name: name, pub: made.pub } : { name: name }), cache: "no-store" });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.id) { var e = new Error(j.code === "invalid" ? "Guest pass requests are not switched on yet. Try again later." : j.error || "HTTP " + r.status); throw e; } return j; });
      }).then(function (j) {
        if (made) gkPut("ask:" + j.id, made.pair).then(function () { gkDel("ask:pending"); });
        lsv(ASK_KEY, JSON.stringify({ id: j.id, key: j.key, name: name, at: Date.now() }));
        msgAdd("ask-" + j.id, "Guest pass requested", "Your request as " + name + " is waiting for the owner. Your pass opens here by itself once approved.", "info");
        m.body('<div class="hm-ok"><b>Request sent</b><small>The owner sees your name, <b>' + esc(name) + "</b>. Keep this page open or come back later: once approved, your guest pass opens here by itself.</small></div>");
        m.actions([{ label: "OK", primary: true, value: true }]);
        gateApply(currentView); blip("go");
      }, function (e) {
        say(e instanceof TypeError ? netHelp() : e.message);
        timer = setInterval(tick, 1000); tick();
      });
    }
    return m.result;
  }
  function askCheck() {
    var a = askGet(); if (!a || !siOn() || typeof fetch !== "function") return;
    fetch(siRelay() + "/guest/ask/status?id=" + encodeURIComponent(a.id) + "&key=" + encodeURIComponent(a.key), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.state === "approved" && j.pass) {
        lsv(ASK_KEY, null);
        msgAdd("ask-" + a.id + "-ok", "Guest pass approved", "Your request as " + a.name + " was approved: guest pass " + j.pass.id + ", LV" + j.pass.lvl + ".", "ok");
        status("Guest pass approved");
        /* Bound to this browser's key already: move the key to the pass and show the credential */
        if (j.pass.bound) return gkGet("ask:" + a.id).then(function (pair) {
          if (!pair) { sgInUse(j.pass.name); return; }
          return gkPut(j.pass.id, pair).then(function () { gkDel("ask:" + a.id); sgGranted(null, { id: j.pass.id, lvl: j.pass.lvl, exp: j.pass.exp, name: j.pass.name, by: "" }); });
        });
        /* Not bound (this browser could not keep a key): open the pass's link to claim it */
        if (j.link) location.hash = "#/" + j.link;
      } else if (j.state === "declined") {
        lsv(ASK_KEY, null); msgAdd("ask-" + a.id + "-no", "Guest pass declined", "The owner declined your request as " + a.name + ". You can still sign in with GitHub for LV2.", "bad");
        gateApply(currentView);
      } else if (j.state === "gone") { lsv(ASK_KEY, null); gateApply(currentView); }
    }, function () { /* offline, or the relay is not updated yet: try again later */ });
  }
  setInterval(function () { if (!document.hidden && askGet()) askCheck(); }, 20 * 1000);

  /* ---- Messages: a small list in the top bar, kept in this browser (clearance changes, guest passes, requests) ---- */
  /* Once you open the menu, each message shows a bar that runs out; when it does, the message clears itself */
  var MSG_KEY = "hp.msgs", MSG_LIFE = 20 * 1000;
  function msgAll() { try { return JSON.parse(lsv(MSG_KEY) || "[]") || []; } catch (e) { return []; } }
  function msgAdd(id, title, body, tone) {
    var all = msgAll(); if (all.some(function (x) { return x.id === id; })) return;
    all.unshift({ id: id, t: title, b: body, k: tone || "info", at: Date.now(), r: 0 });
    lsv(MSG_KEY, JSON.stringify(all.slice(0, 30))); msgDraw();
  }
  /* Clear messages whose timer has run out (the timer starts the first time the menu shows them) */
  setInterval(function () {
    var all = msgAll(), keep = all.filter(function (x) { return !x.s || Date.now() - x.s < MSG_LIFE; });
    if (keep.length !== all.length) { lsv(MSG_KEY, JSON.stringify(keep)); msgDraw(); }
  }, 1000);
  function msgAgo(t) { var s = Math.round((Date.now() - t) / 1000); return s < 60 ? "just now" : s < 3600 ? Math.floor(s / 60) + " min ago" : s < 86400 ? Math.floor(s / 3600) + " h ago" : fmtDate(new Date(t).toISOString().slice(0, 10)); }
  function msgDraw() {
    var b = $("#tbMsg"); if (!b) return;
    var all = msgAll(), n = all.filter(function (x) { return !x.r; }).length;
    b.querySelector(".tb-n").textContent = n > 9 ? "9+" : n || "";
    b.classList.toggle("unread", n > 0);
    b.setAttribute("aria-label", "Messages" + (n ? ", " + n + " unread" : ""));
    var menu = $("#msgMenu");
    if (menu && !menu.hidden) menu.innerHTML = '<div class="mm-head"><b>Messages</b>' + (all.length ? '<button type="button" id="mmClear">Clear all</button>' : "") + "</div>" +
      (all.length ? "<ul>" + all.map(function (x) {
        var left = x.s ? Math.max(0, MSG_LIFE - (Date.now() - x.s)) : MSG_LIFE;
        return '<li class="mm-' + esc(x.k) + (x.r ? "" : " new") + '"><i aria-hidden="true"></i><div><b>' + esc(x.t) + "</b><p>" + esc(x.b) + "</p><small>" + esc(msgAgo(x.at)) + "</small></div>" +
          '<span class="mm-bar" aria-hidden="true"><em style="--f:' + (left / MSG_LIFE).toFixed(3) + "; --t:" + left + 'ms"></em></span></li>';
      }).join("") + "</ul>" : '<p class="mm-none">No messages yet.</p>');
    var c = $("#mmClear"); if (c) c.onclick = function (e) { e.stopPropagation(); lsv(MSG_KEY, "[]"); msgDraw(); };
  }
  function msgToggle(open) {
    var menu = $("#msgMenu"), b = $("#tbMsg"); if (!menu || !b) return;
    if (open == null) open = menu.hidden;
    menu.hidden = !open; b.setAttribute("aria-expanded", String(open));
    if (open) { var all = msgAll(), now = Date.now(); all.forEach(function (x) { x.r = 1; if (!x.s) x.s = now; }); lsv(MSG_KEY, JSON.stringify(all)); msgDraw(); setTimeout(function () { var bb = $("#tbMsg"); if (bb) { bb.querySelector(".tb-n").textContent = ""; bb.classList.remove("unread"); } }, 600); blip(); }
  }
  /* The top bar: messages, then the gear (Profile details), then the access credential */
  function tbMount() {
    if ($("#tbId")) return true;
    var keys = $("#keys"); if (!keys) return false;
    keys.insertAdjacentHTML("beforebegin", '<div class="tb-id" id="tbId">' +
      '<div class="tb-wrap"><button type="button" class="tb-btn" id="tbMsg" aria-haspopup="true" aria-expanded="false" title="Messages"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5h17v11h-17z"/><path d="M3.5 7l8.5 6.5L20.5 7"/></svg><span class="tb-n"></span></button><div class="msg-menu" id="msgMenu" hidden></div></div>' +
      '<a class="tb-btn tb-prof" id="tbGear" href="#/profile" title="View Profile"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/><circle cx="12" cy="12" r="6.6"/></svg><span>View Profile</span></a>' +
      '<div class="si-badge" id="siBadge" role="status"></div></div>');
    $("#tbMsg").addEventListener("click", function (e) { e.stopPropagation(); msgToggle(); });
    document.addEventListener("click", function (e) { var m = $("#msgMenu"); if (m && !m.hidden && !m.contains(e.target)) msgToggle(false); });
    document.addEventListener("keydown", function (e) { var m = $("#msgMenu"); if (e.key === "Escape" && m && !m.hidden) { e.stopPropagation(); msgToggle(false); $("#tbMsg").focus(); } }, true);
    msgDraw();
    return true;
  }
  /* A message when a clearance is reached for the first time in this browser */
  function msgLevel() {
    var c = siCard(); if (!c) return;
    var who = c.guest ? "guest" : c.github_id, lvl = +String(c.card).slice(2), lv = KC_LV[c.card] || KC_LV.LV2;
    msgAdd("lv-" + who + "-" + lvl, "Clearance granted · " + c.card + " " + lv[0], c.guest ? "Guest pass: LV3 (Staff) clearance in this tab, for 24 hours." : "Your Hound ID now holds " + c.card + " (" + lv[0] + ") clearance. See what it opens on your Profile.", "ok");
  }
  /* LV7: a message for each new guest pass request (checked when the site opens, then every five minutes) */
  function asksWatch() {
    if (!siOwner() || document.hidden) return;
    sgOwnerApi("/guest/asks").then(function (j) {
      (j.asks || []).filter(function (x) { return x.state === "pending"; }).forEach(function (x) { msgAdd("req-" + x.id, "Guest pass request", x.name + " asks for a guest pass. Approve or decline it on your Profile.", "req"); });
      (j.extensions || []).forEach(function (x) { msgAdd("ext-" + x.id + "-" + x.ext.at, "Extension request", x.name + " asks for 24 more hours on " + x.id + " (LV" + x.lvl + "). Approve or decline it on your Profile.", "req"); });
    }, function () { /* relay not updated yet */ });
  }
  setInterval(asksWatch, 5 * 60 * 1000);
  /* The relay's health: its version against the one this site expects (config signin.relayVersion). An older relay
     answers /health with its plain greeting, so anything that is not JSON counts as older than version 3. */
  var RH = null;
  function relayHealth() {
    if (RH) return RH;
    var want = +(siCfg().relayVersion || 0);
    RH = !siOn() || typeof fetch !== "function" ? Promise.resolve({ state: "off", want: want }) : fetch(siRelay() + "/health", { cache: "no-store" }).then(function (r) {
      return r.text().then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) { j = null; } return j; });
    }).then(function (j) {
      var v = j && j.ok ? +j.relay || 0 : 0;
      return { state: v >= want ? "ok" : "behind", v: v, want: want, kv: !!(j && j.kv) };
    }, function () { return { state: "down", want: want }; });
    return RH;
  }
  function relayLine(h) {
    return h.state === "ok" ? "Up to date (version " + h.v + ")" + (h.kv ? "" : " · storage not connected")
      : h.state === "behind" ? (h.v ? "Runs version " + h.v + ", this site needs " + h.want : "Runs older code, this site needs version " + h.want) + ": deploy the current worker.js"
      : h.state === "down" ? "Not reachable from this browser. A firewall or privacy tool (Portmaster, uBlock Origin, Pi-hole) may be blocking " + relayHost() : "Sign-in is off";
  }
  /* LV7 is told once per relay version when the relay is behind the site */
  function relayWatch() {
    if (!siOwner()) return;
    relayHealth().then(function (h) {
      if (h.state === "behind") msgAdd("relay-old-" + h.want, "The sign-in relay needs its update", relayLine(h) + ". Until then, guest pass requests, Clear and claims may not work. Steps: sign-in setup, section 6b.", "bad");
      else if (h.state === "ok" && !h.kv) msgAdd("relay-nokv", "The relay has no storage", "Bind the KV namespace as HP_KV on the relay (sign-in setup, section 6).", "bad");
    });
  }
  function gateBoot() {
    setTimeout(relayWatch, 2500);
    askCheck(); setTimeout(asksWatch, 3000);
    setTimeout(gateWelcome, 1200);
  }
