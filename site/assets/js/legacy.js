/* Old-browser check (ES3 only). Without Promise or CSS variables the app cannot run, so show a plain page instead. */
(function () {
  var ok = false;
  try { ok = !!(window.Promise && window.JSON && document.querySelector && window.CSS && CSS.supports && CSS.supports("--a", "0")); } catch (e) { ok = false; }
  if (!ok) {
    window.JO_LEGACY = true;
    var st = document.getElementById("stage") || document.querySelector(".stage");
    if (st) st.style.display = "none";
    document.getElementById("legacy").style.display = "block";
    document.body.style.overflow = "auto";
  }
})();
