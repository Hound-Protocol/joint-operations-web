  /* ---------------- Ready, then reveal ----------------
     A page stays hidden behind a thin loading line until its content is in place: the loading placeholder has been
     replaced, web fonts are ready and the images inside have loaded (or 2.5 s have passed). Then it fades in at once,
     so nothing pops in piece by piece. The first screen after a cold start is revealed the same way. */
  var readyObs = null, readyTimer = 0;
  function waitAssets(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll("img")).filter(function (i) { return !i.complete && i.loading !== "lazy"; });
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var all = Promise.all([fonts].concat(imgs.map(function (i) { return new Promise(function (ok) { i.addEventListener("load", ok); i.addEventListener("error", ok); }); })));
    return Promise.race([all, new Promise(function (ok) { setTimeout(ok, 2500); })]);
  }
  function readyView() {
    var view = $("#view");
    if (!view) return;
    if (readyObs) { readyObs.disconnect(); readyObs = null; }
    clearTimeout(readyTimer);
    view.classList.remove("vw-ready"); view.classList.add("vw-wait");
    var done = false, waiting = false;
    function reveal() {
      if (done) return; done = true;
      if (readyObs) { readyObs.disconnect(); readyObs = null; }
      clearTimeout(readyTimer);
      requestAnimationFrame(function () { view.classList.remove("vw-wait"); view.classList.add("vw-ready"); bootDone(); });
    }
    function check() {
      if (done || waiting) return;
      var vb = $("#vb");
      if (!vb || !vb.children.length || $(".spin", vb)) return;
      waiting = true;
      waitAssets(vb).then(reveal);
    }
    if (window.MutationObserver) { readyObs = new MutationObserver(check); readyObs.observe(view, { childList: true, subtree: true }); }
    readyTimer = setTimeout(reveal, 4000);
    check();
  }
  /* The whole interface fades in once, after the config, the first screen and the fonts are ready */
  var booting = true;
  function bootDone() {
    if (!booting) return;
    booting = false;
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(function (ok) { setTimeout(ok, 1500); })]).then(function () {
      requestAnimationFrame(function () { document.documentElement.classList.remove("booting"); });
    });
  }
