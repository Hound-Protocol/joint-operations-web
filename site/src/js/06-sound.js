  /* ---------------- Interface sounds (optional, off by default) ---------------- */
  var audioCtx = null;
  function blip(kind) {
    if (!opts.sound) return;
    try {
      if (!audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; audioCtx = new AC(); }
      if (audioCtx.state === "suspended") audioCtx.resume();
      var t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "triangle";
      if (kind === "go") { o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.07); }
      else { o.frequency.setValueAtTime(1250, t); }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(kind === "go" ? 0.05 : 0.03, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "go" ? 0.11 : 0.05));
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.12);
    } catch (e) { /* audio unavailable */ }
  }
