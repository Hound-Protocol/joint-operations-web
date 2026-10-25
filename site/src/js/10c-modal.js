  /* ---------------- Modal window ----------------
     A centered window in the site's own design, used for sign-in and confirmations. Esc or the backdrop cancels. */
  function hpModal(o) {
    var old = $("#hpModal"); if (old) old.remove();
    document.body.insertAdjacentHTML("beforeend", '<div class="hm" id="hpModal" role="dialog" aria-modal="true" aria-labelledby="hmTitle"><div class="hm-back"></div>' +
      '<div class="hm-win' + (o.tone ? " hm-" + o.tone : "") + '"><div class="hm-bar"><span>' + esc(o.kicker || "Hound Protocol") + '</span><button type="button" class="hm-x" aria-label="Close">✕</button></div>' +
      '<div class="hm-body"><h3 id="hmTitle">' + esc(o.title || "") + '</h3><div class="hm-content">' + (o.html || "") + '</div></div><div class="hm-act"></div></div></div>');
    var el = $("#hpModal"), act = $(".hm-act", el), done = null, prev = document.activeElement, stage = $("#stage");
    /* While a window is open, the page behind it is out of reach for the keyboard and screen readers */
    if (stage) stage.setAttribute("inert", "");
    var m = {
      el: el,
      body: function (html) { $(".hm-content", el).innerHTML = html; },
      actions: function (list) {
        act.innerHTML = (list || []).map(function (a, i) { return '<button type="button" class="btn' + (a.primary ? " primary" : "") + (a.danger ? " danger" : "") + '" data-i="' + i + '">' + esc(a.label) + "</button>"; }).join("");
        $$("button", act).forEach(function (b) { b.addEventListener("click", function () { var a = list[+b.getAttribute("data-i")]; if (a.run) a.run(m); else m.close(a.value); }); });
        var f = $(".primary, .danger", act) || $("button", act); if (f) f.focus();
      },
      close: function (v) {
        document.removeEventListener("keydown", key);
        el.classList.add("out");
        setTimeout(function () {
          el.remove();
          if (stage && !document.querySelector(".hm:not(.out)")) stage.removeAttribute("inert");
          if (prev && prev.focus && document.body.contains(prev) && !document.querySelector(".hm:not(.out)")) prev.focus();
        }, opts.motion ? 220 : 0);
        if (done) { var d = done; done = null; d(v); }
      },
      result: new Promise(function (ok) { done = ok; })
    };
    function key(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (o.cancel) o.cancel(); m.close(null); return; }
      /* Tab stays inside the window */
      if (e.key === "Tab") {
        var f = $$("button:not([disabled]), a[href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex='-1'])", el).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", key);
    $(".hm-x", el).addEventListener("click", function () { if (o.cancel) o.cancel(); m.close(null); });
    $(".hm-back", el).addEventListener("click", function () { if (o.cancel) o.cancel(); m.close(null); });
    m.actions(o.actions);
    blip();
    return m;
  }
  /* A yes-or-no question in a modal window; resolves true when confirmed */
  function hpConfirm(title, text, yes, no, tone) {
    var m = hpModal({ kicker: "Confirm", title: title, html: "<p>" + esc(text) + "</p>", tone: tone, actions: [{ label: no || "Cancel", value: false }, { label: yes || "OK", value: true, danger: tone === "danger", primary: tone !== "danger" }] });
    return m.result.then(function (v) { return !!v; });
  }
  /* Broken pictures (a GitHub avatar that does not load): one handler for the whole page instead of inline onerror
     attributes, which the Content Security Policy does not allow. data-err says what to do. */
  document.addEventListener("error", function (e) {
    var t = e.target; if (!t || t.tagName !== "IMG" || !t.hasAttribute("data-err")) return;
    var how = t.getAttribute("data-err");
    if (how === "hide") t.style.visibility = "hidden";
    else if (how === "photo") { var box = t.parentNode, card = box && box.parentNode; if (card && card.classList) card.classList.remove("has-photo"); if (box) box.remove(); }
    else t.remove();
  }, true);
