  /* ---------------- Hooks ---------------- */
  window.JO = {
    env: ENV,
    setServers: function (list) { data.servers = { servers: Array.isArray(list) ? list : [] }; data.serversHooked = true; if (currentView === "sessions") drawSessions(); refreshInfo(); },
    setMods: function (m) { data.mods = { compatible: (m && m.compatible) || [], issues: (m && m.issues) || [] }; if (currentView === "mods") drawMods(); refreshInfo(); },
    docsView: function () { var f = document.querySelector(".fold.on"); return { mode: "cabinet", open: f ? f.getAttribute("data-id") : "", drawers: document.querySelectorAll(".drawer").length }; },
    refresh: function () { session.clear("jo-gh:"); data.releases = undefined; data.issues = undefined; preload(); if (currentView) route(); }
  };
