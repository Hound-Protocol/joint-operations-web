  /* ---------------- Click to copy ----------------
   * Anything players are meant to copy (code in documents, guides, steps and cards) copies to the
   * clipboard with one click. Pointing at it types "click to copy this text" beside the pointer.
   * Works by keyboard too: copyable text is focusable, Enter or Space copies.
   */
  var COPY_SEL = "#view code, #view pre";
  function copyTarget(el) {
    while (el && el !== document) {
      if (el.nodeType === 1 && (el.tagName === "CODE" || el.tagName === "PRE") && el.closest && el.closest("#view")) {
        if (el.tagName === "CODE" && el.parentNode && el.parentNode.tagName === "PRE") return el.parentNode;
        if (el.closest("a, button, .sw, .field")) return null;
        return el;
      }
      el = el.parentNode;
    }
    return null;
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      // Older browsers: copy through a hidden text area
      var t = document.createElement("textarea");
      t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy") ? ok() : fail(); } catch (e) { fail(e); }
      document.body.removeChild(t);
    });
  }
  var copyTip = null, copyTipFor = null;
  function tipEl() {
    if (!copyTip) { copyTip = document.createElement("div"); copyTip.className = "copytip"; copyTip.setAttribute("aria-hidden", "true"); document.body.appendChild(copyTip); }
    return copyTip;
  }
  function typeTip(text, cls) {
    var t = tipEl();
    t.className = "copytip on" + (cls ? " " + cls : "");
    t.innerHTML = String(text).split("").map(function (ch, i) {
      return '<span class="ch" style="animation-delay:' + (opts.motion ? i * 18 : 0) + 'ms">' + (ch === " " ? "&nbsp;" : esc(ch)) + "</span>";
    }).join("");
  }
  function placeTip(x, y) {
    var t = tipEl(), w = t.offsetWidth || 180;
    t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + "px";
    t.style.top = Math.max(8, y + 18) + "px";
  }
  function hideTip() { if (copyTip) copyTip.className = "copytip"; copyTipFor = null; }
  function doCopy(el, x, y) {
    var text = (el.innerText || el.textContent || "").replace(/\s+$/, "");
    copyText(text).then(function () {
      el.classList.add("copied"); setTimeout(function () { el.classList.remove("copied"); }, 900);
      typeTip("copied to clipboard", "ok"); if (x != null) placeTip(x, y);
      status("Copied: " + (text.length > 40 ? text.slice(0, 39) + "…" : text));
      if (typeof blip === "function") blip("go");
    }, function () { typeTip("press Ctrl+C to copy", "bad"); });
  }
  // Mark copyable text so it can be reached by keyboard and is announced as a button
  function markCopyable(root) {
    $$(COPY_SEL, root).forEach(function (el) {
      var t = copyTarget(el);
      if (!t || t.getAttribute("data-copy")) return;
      t.setAttribute("data-copy", "");
      t.setAttribute("tabindex", "0");
      t.setAttribute("role", "button");
      t.setAttribute("aria-label", "Copy: " + (t.textContent || "").trim().slice(0, 80));
    });
  }
  if (window.MutationObserver) {
    new MutationObserver(function () { var v = $("#view"); if (v && !v.hidden) markCopyable(v); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  }
  document.addEventListener("mouseover", function (e) {
    var t = copyTarget(e.target);
    if (t === copyTipFor) return;
    if (!t) { hideTip(); return; }
    copyTipFor = t; typeTip("click to copy this text"); placeTip(e.clientX, e.clientY);
  });
  document.addEventListener("mousemove", function (e) { if (copyTipFor) placeTip(e.clientX, e.clientY); });
  document.addEventListener("click", function (e) {
    var t = copyTarget(e.target);
    if (!t) return;
    var sel = window.getSelection && String(window.getSelection());
    if (sel && sel.length > 0 && t.contains(window.getSelection().anchorNode)) return; // let people select part of it
    doCopy(t, e.clientX, e.clientY);
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.hasAttribute && e.target.hasAttribute("data-copy")) {
      e.preventDefault(); var r = e.target.getBoundingClientRect(); doCopy(e.target, r.left, r.bottom - 10);
    }
  });
  document.addEventListener("scroll", hideTip, true);
