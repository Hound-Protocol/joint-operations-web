  /* Mods */
  var modState = { tab: "compatible", q: "" };
  function viewMods() {
    var v = $("#view");
    v.innerHTML = shell("Community", "Mods", loading("Loading mods"));
    loadLocal("mods").then(function () { if (currentView === "mods") drawMods(); refreshInfo(); });
  }
  function drawMods() {
    var md = data.mods || { compatible: [], issues: [] }, list = (md[modState.tab] || []).filter(function (m) {
      return !modState.q || (m.name + " " + m.author + " " + (m.notes || "")).toLowerCase().indexOf(modState.q.toLowerCase()) > -1;
    });
    $("#vb").innerHTML =
      '<div class="tabs" role="tablist"><button role="tab" data-mt="compatible" aria-selected="' + (modState.tab === "compatible") + '">Compatible<span class="count">' + (md.compatible || []).length + "</span></button>" +
      '<button role="tab" data-mt="issues" aria-selected="' + (modState.tab === "issues") + '">Known issues<span class="count">' + (md.issues || []).length + "</span></button></div>" +
      ((md.compatible || []).length + (md.issues || []).length ? "" : milestone("mods")) +
      '<p class="sub">' + (modState.tab === "compatible" ? "Re-engineered and tested to work with Joint Operations." : "These work, with known issues. Read the notes before you install.") + "</p>" +
      '<div class="toolbar"><input class="field grow" id="mq" type="search" placeholder="Search mods" value="' + esc(modState.q) + '" aria-label="Search mods">' +
      '<a class="btn primary" href="' + esc(repoUrl("/issues/new?template=mod-submission.md")) + '" target="_blank" rel="noopener noreferrer">Upload a mod</a></div>' +
      (list.length ? '<div class="modgrid">' + list.map(function (m, k) {
        return '<article class="modc ' + (modState.tab === "issues" ? "warn" : "ok") + '" style="--k:' + k + '"><header><h3>' + esc(m.name) + '</h3><span class="pill ' + (modState.tab === "issues" ? "warn" : "ok") + '">' + (modState.tab === "issues" ? "Known issues" : "Compatible") + "</span></header>" +
          '<dl><div><dt>Version</dt><dd>' + esc(m.version || "–") + '</dd></div><div><dt>Author</dt><dd>' + esc(m.author || "–") + '</dd></div><div><dt>Tested on</dt><dd>' + esc(m.tested || "–") + "</dd></div></dl>" +
          (m.notes ? "<p>" + esc(m.notes) + "</p>" : "") +
          (m.url && /^https?:/i.test(m.url) ? '<a class="btn small" href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">Get the mod</a>' : "") + "</article>";
      }).join("") + "</div>"
        : '<div class="empty">' + (modState.q ? "No mods match<small>Try another search.</small>" : "No mods listed yet<small>Curated mods appear here after review. Upload yours to be the first.</small>") + "</div>") +
      '<div class="label">How a mod gets listed</div><ol class="modflow"><li><b>Upload</b><span>Open a mod submission on GitHub with a link, version and what it changes.</span></li><li><b>Quality review</b><span>Quality installs it with Joint Operations on Windows and Proton and notes any issues.</span></li><li><b>Listed</b><span>It appears here as Compatible or with Known issues, and is retested on new releases.</span></li></ol>' +
      '<p class="sub">Mods must not contain game files, code copied from other mods without permission, or generative AI art, music or voices (<a href="#/guides/hp-pol-002">AI Use Policy</a>).</p>' +
      '<p class="source">Source: data/mods.json</p>';
    $$("[data-mt]").forEach(function (b) { b.addEventListener("click", function () { modState.tab = b.dataset.mt; drawMods(); }); });
    $("#mq").addEventListener("input", function (e) { modState.q = e.target.value; var p = e.target.selectionStart; drawMods(); var n = $("#mq"); n.focus(); try { n.setSelectionRange(p, p); } catch (x) { /* ignore */ } });
  }
