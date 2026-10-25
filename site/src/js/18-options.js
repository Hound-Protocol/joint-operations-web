  /* Options */
  var OPT_PRESETS = {
    full: ["Full effects", "Everything on, as designed", { glitch: true, grid: true, motion: true, ledFx: true, emblem: true }],
    calm: ["Calm", "No glitch or flicker, gentle motion", { glitch: false, grid: true, motion: true, ledFx: false, emblem: true }],
    light: ["Performance", "Static and light, for older or slower computers", { glitch: false, grid: false, motion: false, ledFx: false, emblem: false }]
  };
  function presetNow() {
    var hit = "";
    Object.keys(OPT_PRESETS).forEach(function (k) {
      var p = OPT_PRESETS[k][2], same = Object.keys(p).every(function (o) { return !!opts[o] === p[o]; });
      if (same && !hit) hit = k;
    });
    return hit;
  }
  function viewOptions() {
    var v = $("#view");
    function sw(k, label, sub) {
      return '<div class="orow"><span>' + label + "<small>" + sub + '</small></span><button class="sw" role="switch" data-opt="' + k + '" aria-checked="' + !!opts[k] + '" aria-label="' + label + '"></button></div>';
    }
    function seg(id, cur, list, label) {
      return '<div class="seg" role="radiogroup" aria-label="' + label + '" id="' + id + '">' + list.map(function (s) {
        return '<button role="radio" data-v="' + s[0] + '" aria-checked="' + (cur === s[0]) + '">' + s[1] + "</button>";
      }).join("") + "</div>";
    }
    var pre = presetNow();
    v.innerHTML = shell("Settings", "Options",
      '<div class="presets">' + Object.keys(OPT_PRESETS).map(function (k) {
        var p = OPT_PRESETS[k];
        return '<button class="preset' + (pre === k ? " on" : "") + '" data-preset="' + k + '"><b>' + p[0] + "</b><small>" + p[1] + "</small></button>";
      }).join("") + "</div>" +
      '<div class="opt">' +
        '<section class="ogroup"><div class="label">Look</div>' +
          sw("glitch", "Glitch effect", "A light distortion every 5 to 20 seconds") +
          sw("grid", "Background grid", "The tactical grid behind every page") +
          sw("emblem", "Background logo", "The faint Joint Operations badge behind the menu") +
          sw("ledFx", "LED glow", "Glowing, letter-by-letter status lines") +
          sw("contrast", "High contrast", "Brighter secondary text and lines") +
        "</section>" +
        '<section class="ogroup"><div class="label">Motion and sound</div>' +
          sw("motion", "Animations", "Turn off for a static interface. Off by default if your system asks for reduced motion") +
          sw("sound", "Interface sounds", "Short, quiet tones when selecting and opening sections") +
          '<div class="label">Reading</div>' +
          '<div class="orow"><span>Text size<small>Applies to the whole site</small></span>' + seg("osz", opts.size, [["1", "Normal"], ["1.1", "Large"], ["1.2", "Larger"]], "Text size") + "</div>" +
        "</section>" +
        '<section class="ogroup"><div class="label">Data</div>' +
          '<div class="orow"><span>GitHub data<small>Releases and contracts are cached for ' + (cfg.cacheMinutes || 10) + ' minutes</small></span><button class="btn small" id="oclr">Refresh now</button></div>' +
          '<div class="orow"><span>Site build<small>' + esc(buildLabel()) + " · " + esc(cfg.stage) + (data.build && data.build.date ? " · " + esc(fmtDate(data.build.date)) : "") + "</small></span><a class=\"btn small\" href=\"#/docs/devlog\">Dev log</a></div>" +
          '<div class="orow"><span>Sign-in relay<small id="oRelay">Checking…</small></span><a class="btn small" href="#/docs/signin">Setup</a></div>' +
          '<div class="orow"><span>Privacy<small>No cookies, analytics or trackers. Settings stay in this browser</small></span><a class="btn small" href="#/docs/privacy">Read</a></div>' +
          '<div class="orow"><span>Restore defaults<small>Resets every setting on this page</small></span><button class="btn small" id="orst">Reset</button></div>' +
        "</section>" +
      "</div>");
    relayHealth().then(function (h) { var el = $("#oRelay"); if (el) el.textContent = relayLine(h); });
    function changed(msg) { store.set(OPT_KEY, opts); applyOpts(); status(msg); var p = presetNow(); $$("[data-preset]").forEach(function (b) { b.classList.toggle("on", b.dataset.preset === p); }); }
    $$("[data-opt]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.opt; opts[k] = !opts[k];
        b.setAttribute("aria-checked", String(!!opts[k])); changed(b.getAttribute("aria-label") + (opts[k] ? " on" : " off"));
      });
    });
    $$("[data-preset]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = OPT_PRESETS[b.dataset.preset];
        Object.keys(p[2]).forEach(function (k) { opts[k] = p[2][k]; });
        $$("[data-opt]").forEach(function (s) { s.setAttribute("aria-checked", String(!!opts[s.dataset.opt])); });
        changed(p[0] + " preset applied");
      });
    });
    function segBind(id, fn) {
      $$("#" + id + " button").forEach(function (b) {
        b.addEventListener("click", function () { $$("#" + id + " button").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); }); fn(b.dataset.v); });
      });
    }
    segBind("osz", function (val) { opts.size = val; changed("Text size changed"); });
    $("#oclr").addEventListener("click", function () { JO.refresh(); status("GitHub data cleared · reloading"); });
    $("#orst").addEventListener("click", function () { opts = Object.assign({}, DEFAULT_OPTS); store.set(OPT_KEY, opts); applyOpts(); viewOptions(); status("Settings reset"); });
  }
