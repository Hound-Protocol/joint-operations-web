  /* ---------------- Position marker ----------------
     The browser's own scrollbar is hard to see against the frame, so a marker rides beside the right-hand ruler, like the
     depth gauge on a Metal Gear radar: an orange chevron pointing at the ruler, with how far down the page you are.
     It sits just left of the ruler (never over its lines) and between the corner brackets, and hides when the page fits. */
  function scrollMarkBoot() {
    var stage = $("#stage"), ce = $("#center");
    if (!stage || !ce || $("#posMark")) return;
    stage.insertAdjacentHTML("beforeend", '<div class="pos-mark" id="posMark" aria-hidden="true"><i class="pm-track"></i><i class="pm-fill"></i><span class="pm-k"><b>000</b><i class="pm-chev"></i></span></div>');
    var mk = $("#posMark"), k = $(".pm-k", mk), fill = $(".pm-fill", mk), num = $("b", mk), raf = 0;
    function draw() {
      raf = 0;
      var room = ce.scrollHeight - ce.clientHeight;
      /* Never over the content: with a narrow margin only the chevron shows, with less than that nothing does */
      var host = $("#view:not([hidden])") || $("#menuView"), free = host ? stage.getBoundingClientRect().right - host.getBoundingClientRect().right : 99;
      mk.classList.toggle("slim", free < 80);
      /* Start below the section bar's full-width line, so the track never crosses it */
      var sw = $("#view:not([hidden]) .secwrap"), st = stage.getBoundingClientRect().top;
      mk.style.top = Math.max(104, sw ? Math.round(sw.getBoundingClientRect().bottom - st + 16) : 0) + "px";
      var on = room > 24 && free >= 44 && !document.body.classList.contains("print");
      mk.classList.toggle("on", on);
      if (!on) return;
      var f = Math.min(1, Math.max(0, ce.scrollTop / room));
      k.style.top = fill.style.height = (f * 100).toFixed(2) + "%";
      num.textContent = ("00" + Math.round(f * 100)).slice(-3);
      mk.classList.toggle("end", f > 0.995);
    }
    function later() { if (!raf) raf = requestAnimationFrame(draw); }
    ce.addEventListener("scroll", later, { passive: true });
    window.addEventListener("resize", later);
    /* Pages grow as documents and data arrive: watch the content, not only the window */
    if (typeof ResizeObserver === "function") { var ro = new ResizeObserver(later); ro.observe(ce); $$("#center > *").forEach(function (c) { ro.observe(c); }); }
    if (typeof MutationObserver === "function") new MutationObserver(later).observe(ce, { childList: true, subtree: true });
    window.addEventListener("hashchange", function () { setTimeout(later, 60); });
    later();
  }
