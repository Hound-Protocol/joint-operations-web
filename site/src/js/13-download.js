  /* Download */
  var dlOS = null;
  function guessOS() {
    var ua = (navigator.userAgent || "") + " " + (navigator.platform || "");
    return /Linux|X11|SteamOS/i.test(ua) && !/Android/i.test(ua) ? "linux" : "windows";
  }
  var DL_STEPS = {
    windows: ["Install Metal Gear Solid V from Steam and start it once.", "Download the latest release.", "Run the installer. It backs up your saves first.", "Start the game, then host a session or join one from the Session Browser."],
    linux: ["Install Metal Gear Solid V in Steam and start it once with Proton.", "Download the same release as Windows and install it into the game folder.", 'In Steam, open MGSV → Properties → Launch Options and paste:<br><code>WINEDLLOVERRIDES="dinput8=n,b" %command%</code>', 'Start the game. Full steps and Bazzite notes: <a href="#/guides/hp-gde-002">Linux and Proton Guide</a>.']
  };
  function viewDownload() {
    var v = $("#view");
    v.innerHTML = shell("Releases", "Download", loading("Checking releases on GitHub"));
    // Everything on this page is about the game mod. Website and foundation updates are in the Changelog and the Dev Log (Library).
    Promise.all([loadReleases(), loadRoadmap()]).then(function (res) {
      var rel = res[0];
      if (currentView !== "download") return;
      dlOS = dlOS || guessOS();
      var latest = playableReleases()[0], ph = currentPhase(), road = data.roadmap || [];
      var done = road.reduce(function (a, p) { return a + p.done; }, 0), total = road.reduce(function (a, p) { return a + p.total; }, 0);
      var files = latest ? (latest.assets || []) : [];
      var hero = latest
        ? '<div class="dl-hero ready"><div class="dl-main"><span class="kicker">Latest release · ' + (latest.prerelease ? "Pre-release" : "Stable") + '</span><h3>Joint Operations ' + esc(latest.tag_name) + '</h3><p>Published ' + fmtDate(latest.published_at) + ". Free and open source.</p>" +
            '<div class="dl-files">' + (files.length ? files.map(function (a) {
              return '<a class="btn primary" data-dl href="' + esc(a.browser_download_url) + '">' + esc(a.name) + ' <small>' + fmtBytes(a.size) + "</small></a>";
            }).join("") : '<span class="sub">This release has no attached files yet.</span>') + "</div>" +
            '<div class="toolbar"><a class="btn" href="' + esc(latest.html_url) + '" target="_blank" rel="noopener noreferrer">Release notes</a><a class="btn" href="' + repoUrl("/releases") + '" target="_blank" rel="noopener noreferrer">All releases</a></div></div></div>'
        : '<div class="dl-hero"><div class="dl-main"><span class="kicker">Game release</span><h3>Joint Operations 0.1 is on its way</h3>' +
            "<p>" + (rel === null ? "GitHub could not be reached, so the release status is not shown. Try again later." : "The mod is in development and there is no playable version yet. When 0.1 is released, the download appears here automatically, for Windows and Linux.") + "</p>" +
            '<div class="dl-status"><div><span>Mod status</span><b>In development</b></div><div><span>First playable</span><b>Version 0.1</b></div><div><span>Current phase</span><b>' + (ph ? "Phase " + ph.n + " · " + esc(ph.title) : "–") + "</b></div></div>" +
            (total ? '<div class="dl-progress"><div class="meter"><i style="width:' + Math.round(done / total * 100) + '%"></i></div><small>Road to 0.1: ' + done + " of " + total + " roadmap tasks done</small></div>" : "") +
            '<div class="toolbar"><a class="btn primary" href="#/roadmap">Follow the road to 0.1</a><a class="btn" href="#/contribute">Contribute to Joint Operations</a></div></div></div>';
      var req = [["Game", "Your own copy of MGSV: The Phantom Pain on Steam"], ["Windows", "Windows 10 or 11"], ["Linux", "Through Proton, including Steam Deck and Bazzite"], ["Online", "Steam running. No ports to open"], ["Players", "Up to 16 per session"], ["Price", "Free"]];
      var body = hero +
        '<div class="dl-grid"><section class="panel"><div class="label">Install</div>' +
          '<div class="tabs small" role="tablist">' + [["windows", "Windows"], ["linux", "Linux · Proton"]].map(function (t) {
            return '<button role="tab" data-os="' + t[0] + '" aria-selected="' + (dlOS === t[0]) + '">' + (t[0] === "windows" ? ICON_WIN : ICON_LNX) + t[1] + "</button>";
          }).join("") + "</div>" +
          '<ol class="steps" id="dlSteps">' + DL_STEPS[dlOS].map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ol>" +
          '<p class="sub">We guessed your system from your browser. Pick the other tab if that is wrong.</p></section>' +
        '<section class="panel"><div class="label">Requirements</div><dl class="dl-req">' + req.map(function (r) { return "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>"; }).join("") + "</dl></section></div>" +
        '<p class="note">You need your own copy of Metal Gear Solid V. Joint Operations never includes game files and has no connection to Konami. Step-by-step help: <a href="#/guides/hp-gde-001">Player Guide</a>.</p>';
      v.querySelector("#vb").innerHTML = body;
      /* Downloading a build is an action: LV1 is asked to sign in or request a guest pass first */
      $$("[data-dl]").forEach(function (a) { a.addEventListener("click", function (e) { if (!needLv2("Downloading Joint Operations")) e.preventDefault(); }); });
      $$('[data-os]').forEach(function (b) {
        b.addEventListener("click", function () {
          dlOS = b.dataset.os;
          $$('[data-os]').forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
          $("#dlSteps").innerHTML = DL_STEPS[dlOS].map(function (s) { return "<li>" + s + "</li>"; }).join("");
        });
      });
      refreshInfo();
    });
  }
