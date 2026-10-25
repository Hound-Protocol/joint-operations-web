  /* ---------------- New version announcement ----------------
     Every few minutes, and when the tab comes back into view, the site asks the server for its build number. When a newer
     release is live, a small notice slides in at the top and offers to reload. "Later" hides it until the next release. */
  var upSeen = "", upLast = 0;
  function upCheck() {
    if (EMBED || location.protocol === "file:" || !data.build || !data.build.sha || typeof fetch !== "function") return;
    upLast = Date.now();
    fetch("data/build.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (b) {
      if (!b || !b.sha || b.sha === data.build.sha || b.sha === upSeen) return;
      return fetch("data/config.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : {}; }, function () { return {}; }).then(function (c) { upShow(b, c.version); });
    }, function () { /* offline: try again later */ });
  }
  function upShow(b, version) {
    if ($("#upNote")) return;
    document.body.insertAdjacentHTML("beforeend", '<div class="up-note" id="upNote" role="status"><svg class="up-spin" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 6.2A5.5 5.5 0 0 0 3.1 5"/><path d="M2.8 9.8A5.5 5.5 0 0 0 12.9 11"/><path class="hd" d="M3.1 1.9V5h3.1"/><path class="hd" d="M12.9 14.1V11H9.8"/></svg><b>Update available</b><span>' +
      esc("Site " + (version || "") + (b.build ? " · build " + b.build : "")) + ' is live</span>' +
      '<button class="up-go" id="upGo">Reload</button><button class="up-x" id="upLater" aria-label="Later">✕</button></div>');
    blip();
    $("#upGo").addEventListener("click", function () { location.reload(); });
    $("#upLater").addEventListener("click", function () { upSeen = b.sha; var n = $("#upNote"); n.classList.add("out"); setTimeout(function () { n.remove(); }, 400); });
  }
  setInterval(upCheck, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && Date.now() - upLast > 60 * 1000) upCheck(); });
