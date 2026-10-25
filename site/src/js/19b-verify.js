  /* Verify: signed contributor records and the contributor wall */
  function b64bytes(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  // Same bytes as canonical() in tools/records.py: record without sig, keys sorted, no spaces, UTF-8
  /* The signed bytes: keys sorted at every depth, no spaces, UTF-8, exactly like tools/records.py (json.dumps sort_keys) */
  function canonJSON(v) {
    if (Array.isArray(v)) return "[" + v.map(canonJSON).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + canonJSON(v[k]); }).join(",") + "}";
    return JSON.stringify(v);
  }
  function canonicalRecord(r) {
    var body = {}; Object.keys(r).forEach(function (k) { if (k !== "sig") body[k] = r[k]; });
    return new TextEncoder().encode(canonJSON(body));
  }
  var keyCache = {};
  // Resolves "ok", "bad", "nokey" or "unsupported" (browser without Ed25519 in Web Crypto)
  function verifyRecord(r, keys) {
    var k = (keys || []).filter(function (x) { return x.id === r.key; })[0];
    if (!k) return Promise.resolve("nokey");
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve("unsupported");
    var kp = keyCache[k.id] || (keyCache[k.id] = crypto.subtle.importKey("raw", b64bytes(k.public), { name: "Ed25519" }, false, ["verify"]));
    return kp.then(function (key) {
      return crypto.subtle.verify({ name: "Ed25519" }, key, b64bytes(r.sig || ""), canonicalRecord(r));
    }).then(function (ok) { return ok ? "ok" : "bad"; }, function (e) {
      delete keyCache[k.id];
      return e && (e.name === "NotSupportedError" || e.name === "TypeError") ? "unsupported" : "bad";
    });
  }
  var VSTATE = { ok: ["Verified", "done"], bad: ["Signature invalid", "bad"], nokey: ["Unknown key", "bad"], unsupported: ["Can't check in this browser", "claimed"], wait: ["Checking", "planned"] };
  function vBadge(s) { var v = VSTATE[s] || VSTATE.wait; return '<span class="status ' + v[1] + '">' + v[0] + "</span>"; }
  function recordCard(r, n) {
    return '<article class="card rec" style="--i:' + (n || 0) + '" data-rid="' + esc(r.id) + '"><div class="id">' + esc(r.id) + " · " + esc(fmtDate(r.date)) + "</div>" +
      "<h3>" + esc(r.contract) + " · " + esc(r.title) + "</h3><div>" +
      '<span class="pill">' + esc(r.name ? r.name + " (" + r.login + ")" : r.login) + "</span>" +
      (r.assisted && r.assisted.length ? '<span class="pill agent" title="AI agents used for this contract, credited as the contributor\'s tools">with ' + esc(r.assisted.join(", ")) + "</span>" : "") +
      '<span class="pill">' + esc((DIFF[r.difficulty] || [r.difficulty])[0]) + "</span></div>" +
      '<div class="vs">' + vBadge("wait") + "</div>" +
      '<div class="actions"><a class="btn small" href="#/verify/' + encodeURIComponent(r.id) + '">Details</a>' +
      (r.pr ? '<a class="btn small" href="' + esc(repoUrl("/pull/" + r.pr)) + '" target="_blank" rel="noopener noreferrer">Pull request</a>' : "") +
      (r.commit ? '<a class="btn small" href="' + esc(repoUrl("/commit/" + r.commit)) + '" target="_blank" rel="noopener noreferrer">Commit</a>' : "") + "</div></article>";
  }
  function markVerified(list, keys) {
    list.forEach(function (r) {
      verifyRecord(r, keys).then(function (s) {
        $$('[data-rid="' + r.id + '"] .vs').forEach(function (el) { el.innerHTML = vBadge(s); });
      });
    });
  }
  function viewVerify(rid) {
    var v = $("#view");
    v.innerHTML = shell("Contract network", "Verify", loading("Loading contributor records"));
    Promise.all([loadLocal("records"), loadLocal("records-key"), loadLocal("staff"), loadLocal("contracts"), loadLocal("certificates")]).then(function (res) {
      if (currentView !== "verify") return;
      var recs = (res[0] && res[0].records) || [], keys = (res[1] && res[1].keys) || [], staff = (res[2] && res[2].staff) || [];
      var key = keys[keys.length - 1];
      var keyHtml = key
        ? '<div class="tw"><table><tr><th>Key</th><th>Fingerprint</th><th>Owner</th><th>Since</th></tr>' + keys.map(function (k) {
            return "<tr><td>" + esc(k.id) + '</td><td><code>' + esc(k.fingerprint) + "</code>" + "</td><td>" + esc(k.owner) + "</td><td>" + esc(fmtDate(k.added)) + "</td></tr>";
          }).join("") + "</table></div>"
        : '<div class="empty">No signing key published yet<small>The project lead creates it before the first record is issued.</small></div>';
      if (rid && /^HPC-/i.test(rid)) return viewCertificate(rid.toUpperCase(), recs, keys);
      if (rid && /^HND-/i.test(rid)) {
        var sc = staff.filter(function (x) { return x.id.toUpperCase() === rid.toUpperCase(); })[0];
        var specimen = !sc && rid.toUpperCase() === "HND-0000";
        if (!sc && !specimen) { $("#vb").innerHTML = '<div class="empty">No staff card ' + esc(rid) + '<small><a href="#/verify">Back to Verify</a></small></div>'; return; }
        var c = sc || KC_SPECIMEN;
        $("#vb").innerHTML = '<p class="sub"><a href="#/verify">All staff and records</a></p>' +
          '<div class="kc-profile">' + keycard(c, { big: true, specimen: specimen }) +
          '<dl class="kc-facts"><div><dt>GitHub</dt><dd>' + (specimen ? "–" : '<a href="https://github.com/' + encodeURIComponent(c.login) + '" target="_blank" rel="noopener noreferrer">' + esc(c.login) + "</a> · account #" + esc(c.github_id)) + "</dd></div>" +
          (c.discord_id ? "<div><dt>Discord ID</dt><dd>" + esc(c.discord_id) + "</dd></div>" : "") +
          "<div><dt>Owner key</dt><dd>" + (c.ssh_key ? "<code>" + esc(c.ssh_key) + "</code> (pinned)" : "Any SSH signing key on the GitHub account") + "</dd></div>" +
          "<div><dt>Status</dt><dd>" + (c.status === "revoked" ? "Revoked " + esc(fmtDate(c.revoked)) + (c.reason ? " · " + esc(c.reason) : "") : specimen ? "Specimen, not a real card" : "Active") + "</dd></div></dl></div>" +
          '<div class="label">Prove this card</div>' + kcProofHtml(c.id) +
          (specimen ? "" : '<div class="label">Signed data</div><pre class="code">' + esc(JSON.stringify(c, null, 2)) + "</pre>");
        if (sc && sc.status !== "revoked") markVerified([sc], keys);
        kcProofBind(staff, keys);
        return;
      }
      if (rid) {
        var r = recs.filter(function (x) { return x.id === rid; })[0];
        $("#vb").innerHTML = r
          ? '<p class="sub"><a href="#/verify">All records</a></p><div class="cards">' + recordCard(r) + '</div><div class="label">Signed data</div><pre class="code">' + esc(JSON.stringify(r, null, 2)) + "</pre>"
          : '<div class="empty">No record ' + esc(rid) + '<small><a href="#/verify">Back to all records</a></small></div>';
        if (r) markVerified([r], keys);
        return;
      }
      // Contributor wall
      // Grades per field, from each record's difficulty and its contract's module (data/contracts.json)
      var specs = {}; ((data.contracts && data.contracts.contracts) || []).forEach(function (c) { specs[c.id] = c; });
      var wall = tallyGrades(recs.map(function (r) { return { login: r.login, name: r.name, difficulty: r.difficulty, module: (specs[r.contract] || {}).module }; }));
      // Agents each person worked with, across their records (ADR 0015)
      var tools = {};
      recs.forEach(function (r) { (r.assisted || []).forEach(function (t) { var m = tools[r.login] = tools[r.login] || []; if (m.indexOf(t) < 0) m.push(t); }); });
      $("#vb").innerHTML =
        '<p class="sub">Every completed contract earns a contributor record, signed with the project\'s key. This page checks each signature in your browser. Hand-written and AI-assisted work earn the same record.</p>' +
        '<div class="label">Contributor wall</div>' +
        (wall.length ? '<div class="wall">' + wall.map(function (u, n) {
          var grade = u.best ? u.best[0] : "–";
          return '<a class="op" style="--i:' + n + '" href="https://github.com/' + encodeURIComponent(u.login) + '" target="_blank" rel="noopener noreferrer"><span class="mono">' + esc(grade) + "</span><b>" + esc(u.name || u.login) + "</b><small>Grade " + esc(grade) + " · " + u.n + " contract" + (u.n === 1 ? "" : "s") + (tools[u.login] ? " · with " + esc(tools[u.login].join(", ")) : "") + "</small></a>";
        }).join("") + "</div>" : '<div class="empty">No records yet<small>The wall fills as contracts are completed and signed.</small></div>') +
        (recs.length ? '<div class="label">Records</div><div class="cards">' + recs.slice().reverse().map(recordCard).join("") + "</div>" : "") +
        '<div class="label">Certificates of service</div>' +
        '<p class="sub">A certificate is a signed summary of someone\'s work for the project: every record, grades per field and clearance. Anyone can check it here; the signature breaks if a single line is changed.</p>' +
        (certList().length ? '<div class="cert-list">' + certList().slice().reverse().map(function (c, n) {
          return '<a class="cert-card' + (c.status === "revoked" ? " revoked" : "") + '" style="--i:' + n + "; --hk:" + (KC_LV[c.clearance] || KC_LV.LV3)[1] + '" href="#/verify/' + esc(c.id) + '"><small>' + esc(c.id) + " · " + esc(fmtDate(c.issued)) + "</small><b>" + esc(c.name || c.login) + "</b><span>" + plural(c.records.length, "contract") + " · grade " + esc(c.grade || "–") + " · " + esc(c.clearance) + (c.status === "revoked" ? " · revoked" : "") + "</span></a>";
        }).join("") + "</div>" : '<div class="empty">No certificates issued yet<small>Certificates are issued by the owner from signed records (<a href="#/guides/hp-sop-004">how</a>).</small></div>') +
        '<div class="label">Hound staff</div>' +
        '<p class="sub">Every staff member has a permanent <b class="tint key">Hound ID</b>, tied to their GitHub account number, which never changes even if they rename the account. Check anyone who claims to be staff here.</p>' +
        '<div class="toolbar"><input class="field grow" id="sfind" type="search" placeholder="Hound ID, GitHub name or Discord ID" aria-label="Find staff"><span id="sres"></span></div>' +
        '<div class="hks">' + (staff.length ? staff.map(function (s, n) { return keycard(s, { link: true, i: n }); }).join("") :
          keycard(KC_SPECIMEN, { link: true, specimen: true }) + '<div class="empty">No staff cards issued yet<small>This is a specimen. The owner issues real cards once the signing key exists.</small></div>') + "</div>" +
        '<div class="label">Prove a Hound ID</div>' +
        '<p class="sub">A card can be copied, so it only shows what someone claims. To check that a person really holds a Hound ID, give them a challenge to sign with the SSH key on their GitHub account. You can try it now with any GitHub name.</p>' +
        kcProofHtml("") +
        '<div class="label">Check a record</div>' +
        '<p class="sub">Paste a record someone shared with you.</p>' +
        '<textarea class="field" id="vpaste" rows="5" spellcheck="false" aria-label="Record JSON" placeholder="{&quot;id&quot;: &quot;HP-0001&quot;, ...}"></textarea>' +
        '<div class="toolbar"><button class="btn small primary" id="vcheck">Check</button><span id="vres"></span></div>' +
        '<div class="label">Signing keys</div>' + keyHtml +
        '<p class="source">Source: data/records.json · checked with tools/records.py in CI</p>';
      markVerified(recs, keys);
      markVerified(staff.filter(function (s) { return s.status !== "revoked"; }), keys);
      kcProofBind(staff, keys);
      $("#sfind").addEventListener("input", function (e) {
        var q = e.target.value.trim().toLowerCase(), out = $("#sres");
        if (!q) { out.innerHTML = ""; return; }
        var s = staff.filter(function (x) { return x.id.toLowerCase() === q || String(x.login).toLowerCase() === q || String(x.discord_id || "") === q; })[0];
        if (!s) { out.innerHTML = '<span class="status bad">Not Hound staff</span>'; return; }
        if (s.status === "revoked") { out.innerHTML = '<span class="status bad">' + esc(s.id) + " · card revoked</span>"; return; }
        out.innerHTML = vBadge("wait");
        verifyRecord(s, keys).then(function (st) { out.innerHTML = st === "ok" ? '<span class="status done">' + esc(s.id) + " · " + esc(s.card) + " · " + esc(s.department) + " · verified</span>" : vBadge(st); });
      });
      $("#vcheck").addEventListener("click", function () {
        var out = $("#vres"), r;
        try { r = JSON.parse($("#vpaste").value); } catch (e) { out.innerHTML = vBadge("bad").replace("Signature invalid", "Not valid JSON"); return; }
        if (!r || typeof r !== "object" || !r.sig || !r.key) { out.innerHTML = vBadge("bad").replace("Signature invalid", "Not a record"); return; }
        out.innerHTML = vBadge("wait");
        verifyRecord(r, keys).then(function (s) {
          var listed = recs.some(function (x) { return x.id === r.id && x.sig === r.sig; });
          out.innerHTML = vBadge(s) + (s === "ok" ? ' <span class="sub">' + (listed ? "Listed on this page" : "Valid signature, but not in the published list") + "</span>" : "");
        });
      });
    });
  }

  /* ---------------- Certificates of service (ADR 0020) ----------------
     A signed summary of a person's work: every signed record, grades per field, clearance and AI tools credited.
     The page checks the certificate's signature and every record it lists, in the browser, against the records key. */
  var CERT_FIELDS = { code: "Code", re: "Architecture Research", qa: "Testing", design: "Design and web", docs: "Docs and legal" };
  function certList() { return (data.certificates && data.certificates.certificates) || []; }
  function viewCertificate(id, recs, keys) {
    var c = certList().filter(function (x) { return x.id === id; })[0];
    if (!c) { $("#vb").innerHTML = '<div class="empty">No certificate ' + esc(id) + '<small><a href="#/verify">Back to Verify</a></small></div>'; return; }
    var url = (cfg.siteUrl || "https://hound-protocol.github.io/joint-operations-web/") + "#/verify/" + c.id, lv = (KC_LV[c.clearance] || KC_LV.LV3);
    $("#vb").innerHTML = '<p class="sub"><a href="#/verify">All records and certificates</a></p>' +
      '<div class="toolbar sheet-bar"><button class="btn small primary" id="cPrint">Print or save as PDF</button><button class="btn small" id="cLink">Copy link</button></div>' +
      '<article class="cert' + (c.status === "revoked" ? " revoked" : "") + '" style="--hk:' + lv[1] + '" id="cert">' +
        '<header class="cert-head"><img src="assets/brand/hound-protocol-mark-light.svg" alt="" width="54" height="54"><div><b>Hound Protocol</b><span>Certificate of Service</span></div><div class="cert-id"><small>Certificate</small>' + esc(c.id) + "</div></header>" +
        '<p class="cert-lead">This certifies that</p><h2 class="cert-name">' + esc(c.name || c.login) + '</h2><p class="cert-who">GitHub <b>@' + esc(c.login) + "</b> · account #" + esc(c.github_id) + (c.hound_id ? " · Hound ID <b>" + esc(c.hound_id) + "</b>" : "") + "</p>" +
        '<p class="cert-lead">completed the following work for MGSV: Joint Operations, between ' + esc(fmtDate(c.from)) + " and " + esc(fmtDate(c.to)) + ".</p>" +
        '<div class="cert-sum"><div><small>Contracts</small><b>' + c.records.length + "</b></div><div><small>Overall grade</small><b>" + esc(c.grade || "–") + '</b></div><div><small>Clearance</small><b style="color:var(--hk)">' + esc(c.clearance) + "</b></div><div><small>Issued</small><b>" + esc(fmtDate(c.issued)) + "</b></div></div>" +
        '<table class="cert-t"><tr><th>Record</th><th>Contract</th><th>Difficulty</th><th>Date</th><th>Check</th></tr>' + c.records.map(function (r) {
          return '<tr data-cr="' + esc(r.id) + '"><td><a href="#/verify/' + esc(r.id) + '">' + esc(r.id) + "</a></td><td>" + esc(r.contract) + " · " + esc(r.title) + "</td><td>" + esc((DIFF[r.difficulty] || [r.difficulty])[0]) + "</td><td>" + esc(fmtDate(r.date)) + '</td><td class="vs">' + vBadge("wait") + "</td></tr>";
        }).join("") + "</table>" +
        (c.grades ? '<div class="cert-grades">' + Object.keys(c.grades).map(function (f) { return "<span><small>" + esc(CERT_FIELDS[f] || f) + "</small><b>" + esc(c.grades[f]) + "</b><i>" + esc((c.points || {})[f] || 0) + " points</i></span>"; }).join("") + "</div>" : "") +
        (c.assisted && c.assisted.length ? '<p class="cert-note">AI tools credited as the contributor\'s tools: ' + esc(c.assisted.join(", ")) + ".</p>" : "") +
        (c.statement ? '<blockquote class="cert-q">' + esc(c.statement) + "</blockquote>" : "") +
        '<footer class="cert-foot"><div class="cert-seal" aria-hidden="true"><img src="assets/brand/hound-protocol-mark-light.svg" alt=""></div><div><b>Signed with the Hound Protocol records key</b> <code>' + esc(c.key) + '</code><span class="vs" id="cVs">' + vBadge("wait") + "</span>" +
          "<small>Check it at " + esc(url) + ". The signature covers every line above; changing any of it breaks the check.</small></div></footer>" +
        (c.status === "revoked" ? '<span class="hk-void" aria-hidden="true">REVOKED</span>' : "") +
      "</article>";
    verifyRecord(c, keys).then(function (st) { var el = $("#cVs"); if (el) el.innerHTML = c.status === "revoked" ? '<span class="status bad">Revoked ' + esc(fmtDate(c.revoked || "")) + "</span>" : vBadge(st); });
    c.records.forEach(function (x) {
      var r = recs.filter(function (y) { return y.id === x.id; })[0], el = $('[data-cr="' + x.id + '"] .vs');
      if (!r) { if (el) el.innerHTML = vBadge("bad"); return; }
      verifyRecord(r, keys).then(function (st) { if (el) el.innerHTML = vBadge(st); });
    });
    $("#cPrint").addEventListener("click", function () { document.body.classList.add("print-cert"); window.print(); setTimeout(function () { document.body.classList.remove("print-cert"); }, 500); });
    var cl = $("#cLink"); cl.addEventListener("click", function () { (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { cl.textContent = "Copied"; }, function () { window.prompt("Certificate link", url); }); });
    led($("#ledInfo"), c.id);
  }

