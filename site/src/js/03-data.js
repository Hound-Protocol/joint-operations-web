  /* ---------------- GitHub (live, cached per session) ---------------- */
  function gh(path, maxMinutes) {
    var key = "jo-gh:" + path, hit = session.get(key), max = (maxMinutes || cfg.cacheMinutes || 10) * 60000;
    if (hit && Date.now() - hit.t < max) return Promise.resolve(hit.v);
    return fetchJSON("https://api.github.com" + path, { headers: { Accept: "application/vnd.github+json" } }).then(function (v) {
      session.set(key, { t: Date.now(), v: v });
      return v;
    });
  }
  function repoUrl(p) { return "https://github.com/" + cfg.repo + (p || ""); }
  function newIssueUrl(title, body, labels) {
    return repoUrl("/issues/new?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body) + (labels ? "&labels=" + encodeURIComponent(labels) : ""));
  }

  // Playable releases start at 0.1; 0.0.x are foundation releases (docs/guides/HP-SOP-003)
  function isPlayable(r) { var m = /^v?(\d+)\.(\d+)/.exec((r && r.tag_name) || ""); return !!m && (+m[1] > 0 || +m[2] >= 1); }
  function playableReleases() { return (data.releases || []).filter(isPlayable); }
  // Live Discord numbers from the server widget (Server Settings → Widget must be on). Optional.
  function loadDiscord() {
    var id = cfg.links && cfg.links.discordGuildId;
    if (!id || !/^\d{15,21}$/.test(id)) return Promise.resolve(null);
    if (data.discord !== undefined) return Promise.resolve(data.discord);
    return fetchJSON("https://discord.com/api/guilds/" + id + "/widget.json").then(function (w) {
      data.discord = { online: +w.presence_count || 0, invite: w.instant_invite || "" };
      return data.discord;
    }, function () { data.discord = null; return null; });
  }
  function loadReleases() {
    if (data.releases !== undefined) return Promise.resolve(data.releases);
    return gh("/repos/" + cfg.repo + "/releases?per_page=10").then(function (list) {
      data.releases = (list || []).filter(function (r) { return !r.draft; });
      return data.releases;
    }, function () { data.releases = null; return null; });
  }

  function loadContracts() {
    if (data.issues !== undefined) return Promise.resolve(data.issues);
    // Claims change often, so contract issues are cached for 2 minutes only
    return gh("/repos/" + cfg.repo + "/issues?labels=contract&state=all&per_page=100", 2).then(function (list) {
      var issues = (list || []).filter(function (i) { return !i.pull_request; });
      var byNum = {};
      issues.forEach(function (i) { byNum[i.number] = i; });
      data.issuesAt = Date.now();
      data.issues = issues.map(function (i) {
        var labels = (i.labels || []).map(function (l) { return typeof l === "string" ? l : l.name; });
        var mod = "", diff = "";
        labels.forEach(function (l) {
          if (l.indexOf("module:") === 0) mod = l.slice(7);
          if (l.indexOf("difficulty:") === 0) diff = l.slice(11).toLowerCase();
        });
        var deps = [], m = /depends on\s+((?:#\d+[\s,]*(?:and\s+)?)+)/i.exec(i.body || "");
        if (m) m[1].replace(/#(\d+)/g, function (_, n) { deps.push(+n); });
        var st = i.state === "closed" ? "done" : labels.indexOf("status:review") > -1 ? "review" : (i.assignees && i.assignees.length) ? "claimed" : "open";
        return {
          id: "#" + i.number, num: i.number, title: i.title, module: mod, difficulty: diff, core: labels.indexOf("core") > -1, skills: "",
          depends: deps.map(function (n) { return "#" + n; }),
          blocked: deps.some(function (n) { return byNum[n] && byNum[n].state !== "closed"; }) || labels.indexOf("blocked") > -1,
          status: st, by: (i.assignees || []).map(function (a) { return a.login; }), url: i.html_url, live: true
        };
      });
      return data.issues;
    }, function () { data.issues = null; return null; });
  }

  function parseRoadmap(md) {
    var phases = [], cur = null;
    String(md).split("\n").forEach(function (l) {
      var h = /^##\s+Phase\s+(\d+):\s*([^(]*)/.exec(l);
      if (h) { cur = { n: +h[1], title: h[2].trim(), done: 0, total: 0, items: [] }; phases.push(cur); return; }
      if (/^##\s/.test(l)) { cur = null; return; }
      var t = /^\s*-\s+\[([ xX])\]\s+(.*)$/.exec(l);
      if (t && cur) { cur.total++; if (t[1] !== " ") cur.done++; cur.items.push({ done: t[1] !== " ", text: t[2] }); }
    });
    return phases;
  }
  function loadRoadmap() {
    if (data.roadmap !== undefined) return Promise.resolve(data.roadmap);
    return loadDoc({ path: "ROADMAP.md" }).then(function (md) { data.roadmap = parseRoadmap(md); return data.roadmap; }, function () { data.roadmap = null; return null; });
  }
  function currentPhase() {
    var r = data.roadmap || [];
    for (var k = 0; k < r.length; k++) if (r[k].done < r[k].total) return r[k];
    return r[r.length - 1] || null;
  }
  var EMBED = window.JO_EMBED || null; // set by tools/bundle_site.py for the single-file build
  function loadLocal(name) {
    if (data[name]) return Promise.resolve(data[name]);
    if (EMBED && EMBED[name]) { data[name] = EMBED[name]; return Promise.resolve(data[name]); }
    // One retry after a short pause, for flaky connections
    function get() { return fetchJSON("data/" + name + ".json").then(function (v) { data[name] = v; return v; }); }
    return get().catch(function () { return new Promise(function (ok) { setTimeout(ok, 700); }).then(get); }).catch(function () { return null; });
  }
