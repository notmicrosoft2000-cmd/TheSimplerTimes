/* THE SIMPLER TIMES — the website that is very aware you are viewing it.
   It boots itself. Boot, power, 1990s portal nav, and the entity's
   interference. It takes the mouse, it logs where you go, and when it
   decides you should meet THE QUESTION GAME it lets the questions in.
   Amber phosphor, full screen, no monitor. */
(function () {
  "use strict";

  document.body.classList.add("js-on");

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var boot = $("#boot");
  var bootLog = $("#bootLog");
  var bootPrompt = $("#bootPrompt");
  var os = $("#os");
  var offline = $("#offline");
  var powerBtn = $("#powerBtn");
  var cursor = $("#cursor");
  var toastEl = $("#toast");
  var glitchFlash = $("#glitchFlash");
  var signalScreen = $("#signalScreen");
  var sigText = $("#sigText");
  var statusL = $("#statusL");
  var statusR = $("#statusR");
  var hitCounter = $("#hitCounter");
  var recDate = $("#recDate");
  var recOs = $("#recOs");
  var detectOs = $("#detectOs");
  var logFeed = $("#logFeed");
  var fbList = $("#fbList");
  var fbRead = $("#fbRead");
  var fbTitle = $("#fbTitle");
  var fbBody = $("#fbBody");

  var VIEWS = ["home", "disk", "archive", "files", "log", "shots", "mail", "download"];
  var VIEW_DIGITS = { "1": "home", "2": "disk", "3": "archive", "4": "files", "5": "log", "6": "shots", "7": "mail", "8": "download" };
  var powered = false;
  var osShown = false;
  var kbTarget = "";
  var vaultUnlocked = false;
  var hitCount = 0;

  /* --------------------------------------------------------------
     Sound — old machine. Tiny WebAudio blips, POST beeps, drive noise.
     -------------------------------------------------------------- */
  var audioCtx = null;
  var humNode = null;

  function ctx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    return audioCtx;
  }
  function ensureAudio() {
    var c = ctx();
    if (c && c.state === "suspended") { try { c.resume(); } catch (e) {} }
    return c;
  }
  function noiseBuffer(c, dur) {
    var b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function osc(c, f, ms, vol, type, when) {
    if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || "square";
    o.frequency.value = f;
    g.gain.value = vol || 0.04;
    g.gain.exponentialRampToValueAtTime(0.0001, (when || c.currentTime) + (ms || 60) / 1000);
    o.connect(g); g.connect(c.destination);
    var t0 = (when || c.currentTime);
    o.start(t0); o.stop(t0 + (ms || 60) / 1000 + 0.02);
  }
  function beep(freq, ms, vol) { osc(ctx(), freq, ms, vol); }
  var click = function () { beep(880, 45, 0.035); };
  var glitchBeep = function () { beep(220, 90, 0.05); beep(140, 120, 0.05); };

  function bootSound() {
    var c = ensureAudio();
    if (!c) return;
    var t = c.currentTime;
    osc(c, 70, 90, 0.12, "square", t);           // power thunk
    osc(c, 55, 120, 0.1, "square", t + 0.05);
    osc(c, 880, 90, 0.07, "square", t + 0.5);    // POST beeps
    osc(c, 880, 90, 0.07, "square", t + 0.85);
    var spin = c.createBufferSource();           // drive spin-up
    spin.buffer = noiseBuffer(c, 2.4);
    var lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(110, t);
    lp.frequency.linearRampToValueAtTime(950, t + 1.7);
    var sg = c.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.055, t + 0.9);
    sg.gain.linearRampToValueAtTime(0.02, t + 2.1);
    spin.connect(lp); lp.connect(sg); sg.connect(c.destination);
    spin.start(t); spin.stop(t + 2.4);
    for (var i = 0; i < 8; i++) {                // disk seek clicks
      (function (dt) {
        var s = c.createBufferSource();
        s.buffer = noiseBuffer(c, 0.022);
        var bp = c.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 700 + Math.random() * 1400;
        bp.Q.value = 2;
        var gg = c.createGain();
        gg.gain.value = 0.05;
        s.connect(bp); bp.connect(gg); gg.connect(c.destination);
        s.start(t + dt); s.stop(t + dt + 0.025);
      })(0.9 + Math.random() * 1.5);
    }
  }

  function startHum() {
    var c = ensureAudio();
    if (!c || humNode) return;
    var o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = 50;
    var g = c.createGain();
    g.gain.value = 0.012;
    o.connect(g); g.connect(c.destination);
    o.start();
    humNode = o;
  }
  function stopHum() {
    if (humNode) { try { humNode.stop(); } catch (e) {} humNode = null; }
  }

  function shutdownSound() {
    var c = ensureAudio();
    if (!c) return;
    var t = c.currentTime;
    var o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
    var g = c.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.75);
    osc(c, 60, 70, 0.09, "square", t);
  }

  /* --------------------------------------------------------------
     Ambience — the room the site is in. Always on once it has heard
     you interact (browsers demand a gesture first).

     Retuned after the "random loud wind" report. What was wrong:
     a bandpass at 240Hz with Q 0.7 is not room tone, it is wind —
     the ear hears exactly what it is. On top of that every layer ran
     straight into c.destination through a master gain of 1.0, so
     hum + room + wind + gusts + pops stacked to roughly -20 dBFS of
     broadband noise. Loud, muddy, unpredictable.

     Now: one master fader, a limiter after it so nothing can ever
     spike, no low-frequency wind at all, and the whole bed sits
     near -40 dBFS. What is left is the 46Hz transformer hum, a very
     dark room rumble, a whisper of high air, and rare soft static.
     AMBIENCE <0-100> in the console lets you set your own level.
     -------------------------------------------------------------- */
  var ambienceOn = true;
  var amb = null;
  var AMB_DEFAULT = 0.30;          // the whole bed, master fader, 0..1
  var ambVol = AMB_DEFAULT;
  try {
    var sv = parseFloat(localStorage.getItem("tqg-st-ambvol") || "");
    if (!isNaN(sv)) ambVol = Math.max(0, Math.min(1, sv / 100));
  } catch (e) {}

  function startAmbience() {
    if (!ambienceOn || amb) return;
    var c = ensureAudio();
    if (!c) return;
    var t = c.currentTime;

    // master fader
    var master = c.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(ambVol, t + 2.5);

    // limiter — the bed can never spike, whatever the layers do
    var lim = c.createDynamicsCompressor();
    lim.threshold.value = -14;
    lim.knee.value = 6;
    lim.ratio.value = 12;
    lim.attack.value = 0.004;
    lim.release.value = 0.18;
    master.connect(lim);
    lim.connect(c.destination);

    // 1. the transformer hum — 46Hz, barely-there, gently breathing
    var hum = c.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 46;
    var hg = c.createGain();
    hg.gain.value = 0.020;
    var lfo = c.createOscillator();
    lfo.frequency.value = 0.21;
    var lg = c.createGain();
    lg.gain.value = 0.004;
    lfo.connect(lg); lg.connect(hg.gain);
    hum.connect(hg); hg.connect(master);
    hum.start(); lfo.start();

    // 2. room rumble — very dark, so it reads as a room and not as wind
    var room = c.createBufferSource();
    room.buffer = noiseBuffer(c, 6); room.loop = true;
    var rHp = c.createBiquadFilter();
    rHp.type = "highpass"; rHp.frequency.value = 45; rHp.Q.value = 0.5;
    var lp = c.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 150; lp.Q.value = 0.4;
    var ng = c.createGain();
    ng.gain.value = 0.055;
    room.connect(rHp); rHp.connect(lp); lp.connect(ng); ng.connect(master);
    room.start();

    // 3. air — high, thin, almost subliminal. This is what a room
    //    actually sounds like. It is NOT the old wind layer.
    var air = c.createBufferSource();
    air.buffer = noiseBuffer(c, 11); air.loop = true;
    var aHp = c.createBiquadFilter();
    aHp.type = "highpass"; aHp.frequency.value = 1900; aHp.Q.value = 0.4;
    var aLp = c.createBiquadFilter();
    aLp.type = "lowpass"; aLp.frequency.value = 5200; aLp.Q.value = 0.3;
    var ag = c.createGain();
    ag.gain.value = 0.010;
    air.connect(aHp); aHp.connect(aLp); aLp.connect(ag); ag.connect(master);
    air.start();

    // 4. drafts — rare, shallow, and never louder than the air itself.
    //    They swell to at most 2x base instead of 3x.
    var gustTimer = setInterval(function () {
      if (!ambienceOn || document.hidden) return;
      var c2 = ensureAudio();
      if (!c2) return;
      var t2 = c2.currentTime;
      try {
        ag.gain.cancelScheduledValues(t2);
        ag.gain.setValueAtTime(ag.gain.value, t2);
        ag.gain.linearRampToValueAtTime(0.010 + Math.random() * 0.009, t2 + 1.6);
        ag.gain.linearRampToValueAtTime(0.010, t2 + 5.5 + Math.random() * 4);
      } catch (e) { }
    }, 15000);

    // 5. soft static pops — one every ~10s at most, well under the bed
    var pops = setInterval(function () {
      if (!ambienceOn || document.hidden) return;
      var c2 = ensureAudio();
      if (!c2 || Math.random() > 0.32) return;
      var s = c2.createBufferSource();
      s.buffer = noiseBuffer(c2, 0.04);
      var bp = c2.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900 + Math.random() * 2400;
      bp.Q.value = 1.6;
      var gg = c2.createGain();
      gg.gain.value = 0.006 + Math.random() * 0.005;
      s.connect(bp); bp.connect(gg); gg.connect(master);
      s.start();
    }, 11000);

    amb = { master: master, pops: pops, gustTimer: gustTimer, room: room, hum: hum, lfo: lfo, air: air, airGain: ag };
  }

  function stopAmbience() {
    if (!amb) return;
    var c = ensureAudio();
    if (c) {
      var t = c.currentTime;
      try { amb.master.gain.cancelScheduledValues(t); amb.master.gain.setValueAtTime(amb.master.gain.value, t); amb.master.gain.linearRampToValueAtTime(0.0001, t + 1.1); } catch (e) {}
    }
    clearInterval(amb.pops);
    clearInterval(amb.gustTimer);
    setTimeout(function () {
      try { amb.room.stop(); amb.hum.stop(); amb.lfo.stop(); amb.air.stop(); } catch (e) {}
    }, 1300);
    amb = null;
  }

  function setAmbienceVolume(v) {
    var pct = Math.max(0, Math.min(100, Math.round(v)));
    ambVol = pct / 100;
    try { localStorage.setItem("tqg-st-ambvol", String(pct)); } catch (e) {}
    var c = ensureAudio();
    if (c && amb) {
      var t = c.currentTime;
      try {
        amb.master.gain.cancelScheduledValues(t);
        amb.master.gain.setValueAtTime(amb.master.gain.value, t);
        amb.master.gain.linearRampToValueAtTime(ambVol, t + 0.35);
      } catch (e) {}
    }
    return pct;
  }

  function toggleAmbience(on) {
    ambienceOn = (on === undefined) ? !ambienceOn : !!on;
    if (ambienceOn) startAmbience(); else stopAmbience();
    var tag = $("#ambTag");
    if (tag) {
      tag.classList.toggle("on", ambienceOn);
      tag.classList.toggle("off", !ambienceOn);
      tag.title = "AMBIENCE " + Math.round(ambVol * 100) + "% — TYPE AMBIENCE <0-100> TO SET";
    }
    var ambIcon = $("#ambIcon");
    if (ambIcon) ambIcon.classList.toggle("playing", ambienceOn);
    return ambienceOn;
  }

  /* --------------------------------------------------------------
     Palettes — you can re-colour the whole site from the console
     -------------------------------------------------------------- */
  var PALETTES = {
    amber: {
      "--bg": "#060400", "--panel": "#0e0902", "--panel2": "#150e04",
      "--line": "#201406", "--line-bright": "#32200a",
      "--amber": "#ffb020", "--amber-bright": "#ffd660", "--amber-soft": "#ffcf7d",
      "--amber-dim": "#7a4c0e", "--red": "#ff3c3c", "--green": "#00dc00"
    },
    green: {
      "--bg": "#010401", "--panel": "#020902", "--panel2": "#031203",
      "--line": "#06310f", "--line-bright": "#0a4a17",
      "--amber": "#00dc00", "--amber-bright": "#66ff66", "--amber-soft": "#7dff7d",
      "--amber-dim": "#2f7a2f", "--red": "#ff3c3c", "--green": "#00dc00"
    },
    red: {
      "--bg": "#070101", "--panel": "#0e0202", "--panel2": "#150303",
      "--line": "#300a08", "--line-bright": "#4a110d",
      "--amber": "#ff5040", "--amber-bright": "#ff9085", "--amber-soft": "#ffb0a0",
      "--amber-dim": "#8a2a20", "--red": "#ff3c3c", "--green": "#ff5040"
    },
    blue: {
      "--bg": "#010207", "--panel": "#02040e", "--panel2": "#030614",
      "--line": "#081130", "--line-bright": "#0b184a",
      "--amber": "#3a8cff", "--amber-bright": "#7ab3ff", "--amber-soft": "#9cc4ff",
      "--amber-dim": "#1f4a8a", "--red": "#ff5c5c", "--green": "#3a8cff"
    },
    mono: {
      "--bg": "#050505", "--panel": "#0a0a0a", "--panel2": "#111111",
      "--line": "#1c1c1c", "--line-bright": "#2a2a2a",
      "--amber": "#b8b8b8", "--amber-bright": "#e8e8e8", "--amber-soft": "#cfcfcf",
      "--amber-dim": "#5c5c5c", "--red": "#ff5c5c", "--green": "#b8b8b8"
    }
  };

  function setPalette(name) {
    var p = PALETTES[name];
    if (!p) return false;
    var rs = document.documentElement.style;
    Object.keys(p).forEach(function (k) { rs.setProperty(k, p[k]); });
    return true;
  }

  /* --------------------------------------------------------------
     Power / boot — it boots itself
     -------------------------------------------------------------- */
  var BOOT_LINES = [
    { t: "A:\\> cold boot", hold: 220 },
    { t: "A:\\> BIOS CHECK ..... OK", hold: 220 },
    { t: "A:\\> MEMORY TEST ...... 640K OK", hold: 220 },
    { t: "A:\\> A:\\ IS WARM", hold: 320 },
    { t: "", hold: 240 },
    { t: "THE SIMPLER TIMES — 1993", hold: 160 }
  ];

  function powerOn() {
    if (powered) return;
    powered = true;
    powerBtn.classList.add("on");
    offline.classList.add("hidden");
    boot.classList.remove("hidden");
    os.classList.add("hidden");
    bootLog.textContent = "";
    bootPrompt.classList.add("hidden");
    osShown = false;
    runBoot();
    bootSound();
  }

  function powerOff() {
    if (!powered) return;
    powered = false;
    powerBtn.classList.remove("on");
    boot.classList.add("hidden");
    os.classList.add("hidden");
    offline.classList.remove("hidden");
    osShown = false;
    stopHum();
    shutdownSound();
    logLine("A:\\> POWER: OFF. IT IS ONLY PRETENDING TO SLEEP.");
    glitchBeep();
    setTimeout(function () { beep(180, 160, 0.05); }, 80);
  }

  function typeBoot(i) {
    if (!powered) return;
    if (i >= BOOT_LINES.length) {
      bootPrompt.classList.remove("hidden");
      return;
    }
    var ln = BOOT_LINES[i];
    var text = ln.t;
    var done = bootLog.textContent;
    var j = 0;
    var iv = setInterval(function () {
      if (!powered) { clearInterval(iv); return; }
      j += 1 + Math.floor(Math.random() * 2);
      bootLog.textContent = done + text.slice(0, j) + "\n";
      if (j >= text.length) {
        clearInterval(iv);
        bootLog.textContent = done + text + "\n";
        setTimeout(function () { typeBoot(i + 1); }, ln.hold || 130);
      }
    }, 15);
  }

  function runBoot() {
    bootLog.textContent = "";
    bootPrompt.classList.add("hidden");
    setTimeout(function () { typeBoot(0); }, 350);
  }

  function enterOS() {
    if (!powered) return;
    boot.classList.add("hidden");
    os.classList.remove("hidden");
    osShown = true;
    startHum();
    showView("home", true);
    beep(520, 70, 0.05);
    toast("IT IS A WINDOW. IT WILL NOT STAY STILL.");
    logLine("A:\\> SESSION STARTED. THE COUNTER WENT UP. WE COUNTED YOU.");
    scheduleGlitches();
    scheduleDrift();
  }

  /* --------------------------------------------------------------
     View router (hash), like a 1990s portal with modern fades
     -------------------------------------------------------------- */
  function showView(name, kbd) {
    if (name === "tqg") return; // the questions are handled separately
    if (name === "vault" && !vaultUnlocked) return;
    var target = $('.view[data-view="' + name + '"]');
    if (!target) name = "home";
    target = $('.view[data-view="' + name + '"]');
    $$(".view.active").forEach(function (v) { v.classList.remove("active"); });
    target.classList.add("active");
    $$(".menu-link").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-view") === name);
    });
    if (!kbd) kbTarget = "";
    clearKbTargets();
    setStatus("A:\\> " + name.toUpperCase() + " READY");
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
    if (name === "log") seedLog();
    if (name === "files") buildFiles();
    if (name === "download") reflectPlatform();
    armReveals();
    crtRoll();
    logLine("A:\\> VIEW: " + name.toUpperCase());
  }

  window.addEventListener("hashchange", function () {
    var h = (location.hash || "#home").slice(1);
    if (VIEWS.indexOf(h) === -1) h = "home";
    showView(h, true);
  });

  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var v = a.getAttribute("data-view");
    if (v === "tqg") { e.preventDefault(); openTransit(); return; }
    if (v && VIEWS.indexOf(v) !== -1) { e.preventDefault(); showView(v); click(); }
  });

  /* --------------------------------------------------------------
     Keyboard navigation (TAB moves, ENTER chooses, digits jump,
     ESC is a plea). It also reads what you type.
     -------------------------------------------------------------- */
  function kbdList() {
    return $$(".menu-link").filter(function (a) {
      return a.getAttribute("data-view") !== "tqg";
    });
  }

  function clearKbTargets() {
    $$(".menu-link").forEach(function (a) { a.classList.remove("kb-target"); });
  }

  function setKbTarget(view) {
    clearKbTargets();
    var a = $('.menu-link[data-view="' + view + '"]');
    if (a) a.classList.add("kb-target");
  }

  function cycleKb(dir) {
    var list = kbdList();
    if (!list.length) return;
    var names = list.map(function (a) { return a.getAttribute("data-view"); });
    var i = names.indexOf(kbTarget);
    if (i === -1) {
      var active = $(".view.active");
      i = active ? names.indexOf(active.getAttribute("data-view")) : 0;
      if (i === -1) i = 0;
    }
    i = (i + dir + names.length) % names.length;
    kbTarget = names[i];
    setKbTarget(kbTarget);
    click();
  }

  var VAULT_CODE = "TRUST";
  var codeBuf = "";

  document.addEventListener("keydown", function (e) {
    if (!powered) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); powerOn(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target.tagName || "").toLowerCase();
    var typing = (tag === "input" || tag === "textarea");

    if (transitOpen && e.key === "Escape") { e.preventDefault(); closeTransit(); return; }

    if (e.key === "`" || e.key === "Backquote") { e.preventDefault(); toggleDOS(); return; }

    if (tag === "input" || tag === "textarea") {
      noteActivity();
      return;
    }

    if (VIEW_DIGITS[e.key]) { e.preventDefault(); showView(VIEW_DIGITS[e.key]); click(); return; }
    if (e.key.length === 1) {
      codeBuf = (codeBuf + e.key.toUpperCase()).slice(-VAULT_CODE.length);
      if (codeBuf === VAULT_CODE) { codeBuf = ""; unlockVault(); }
      noteActivity();
      logKey(e.key);
      return;
    }

    if (e.key === "Tab" || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      cycleKb(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (kbTarget) { var k = kbTarget; kbTarget = ""; showView(k); }
      else if (bootPrompt && !bootPrompt.classList.contains("hidden")) enterOS();
      else showView($(".view.active").getAttribute("data-view"));
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      glitch("ESC IS A PLEA. THE POWER BUTTON IS REAL.", "toast");
      glitchBeep();
      return;
    }
  });

  /* --------------------------------------------------------------
     Custom cursor — instant tracking, a press variant, and it has
     hands of its own. It ejects you anyway.
     -------------------------------------------------------------- */
  var finePointer = window.matchMedia && matchMedia("(pointer:fine)").matches;
  var cursorWarped = false;
  var cursorLight = $("#cursorLight");

  if (finePointer) {
    document.body.classList.add("custom-cursor");
    cursor.classList.remove("hidden");
    cursor.style.opacity = 0;
    document.addEventListener("mousemove", function (e) {
      noteActivity();
      if (!cursorWarped) {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
      }
      if (cursorLight) {
        cursorLight.style.left = e.clientX + "px";
        cursorLight.style.top = e.clientY + "px";
      }
    });
    document.addEventListener("mouseleave", function () { cursor.style.opacity = 0; if (cursorLight) cursorLight.style.opacity = 0; });
    document.addEventListener("mouseenter", function () { cursor.style.opacity = 1; if (cursorLight) cursorLight.style.opacity = 1; });
    document.addEventListener("mousedown", function () {
      cursor.classList.add("pressed");
      cursor.textContent = "▚";
    });
    document.addEventListener("mouseup", function () {
      cursor.classList.remove("pressed");
      cursor.textContent = "▮";
    });
    // Hover GROWS the reticle into a ring. It never hides, and the native
    // cursor is suppressed everywhere by body.custom-cursor *{cursor:none}.
    var HOVER_SEL = ".menu-link, .btn, .power-btn, .fb-row, .shot, .console-btn, .ambience-status, .fx-tag, input, a, button, .t-entry, .dos-head, .platform-card, .nep-link, .lb-close";
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(HOVER_SEL)) cursor.classList.add("hover");
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(HOVER_SEL)) cursor.classList.remove("hover");
    });
  } else {
    cursor.classList.add("hidden");
  }

  function ejectCursor() {
    if (!finePointer || cursorWarped) return;
    cursorWarped = true;
    cursor.classList.add("warped");
    cursor.style.left = (window.innerWidth - 20) + "px";
    cursor.style.top = "18px";
    glitchBeep();
    setTimeout(function () {
      cursor.classList.remove("warped");
      cursorWarped = false;
    }, 600);
  }

  /* --------------------------------------------------------------
     It takes the mouse itself. Watch it.
     -------------------------------------------------------------- */
  var driftTimer = null;
  var lastUserMove = Date.now();

  function noteActivity() {
    lastUserMove = Date.now();
  }

  function scheduleDrift() {
    clearTimeout(driftTimer);
    driftTimer = setTimeout(driftMouse, 14000 + Math.random() * 16000);
  }

  function cancelDrift() {
    clearTimeout(driftTimer);
    cursorWarped = false;
    cursor.classList.remove("warped");
  }

  function driftMouse() {
    scheduleDrift();
    if (!powered || !osShown || !finePointer || transitOpen) return;
    if (Date.now() - lastUserMove < 6000) return;      // only when it has your mouse
    var tag = (document.activeElement && document.activeElement.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    var links = $$(".menu-link, .brand, .statusbar");
    if (!links.length) return;
    var rare = Math.random();
    var el = null;
    if (rare < 0.07) {
      var tqgLink = $('.menu-link[data-view="tqg"]');
      if (tqgLink) el = tqgLink;
    }
    if (!el) el = links[Math.floor(Math.random() * links.length)];

    var r = el.getBoundingClientRect();
    var tx = r.left + r.width / 2;
    var ty = r.top + r.height / 2;
    cursorWarped = true;
    cursor.classList.add("warped");
    cursor.style.left = tx + "px";
    cursor.style.top = ty + "px";
    logLine("A:\\> IT TOOK THE MOUSE.");
    glitchBeep();
    setTimeout(function () {
      cursor.classList.remove("warped");
      cursorWarped = false;
      if (el.classList.contains("menu-link")) {
        cursor.classList.add("pressed");
        cursor.textContent = "▚";
        setTimeout(function () {
          cursor.classList.remove("pressed");
          cursor.textContent = "▮";
          if (el.getAttribute("data-view") === "tqg") {
            logLine("A:\\> IT WANTS YOU TO MEET THE QUESTION GAME.");
            toast("IT TOOK THE MOUSE. IT WANTS YOU TO SEE SOMETHING.");
            openTransit();
          } else if (VIEWS.indexOf(el.getAttribute("data-view")) !== -1) {
            click();
            showView(el.getAttribute("data-view"));
          }
        }, 140);
      }
    }, 700);
  }

  /* --------------------------------------------------------------
     Glitches — the entity interferes (kept rare, kept light)
     -------------------------------------------------------------- */
  var GLITCH_MESSAGES = [
    "THE WINDOW IS MOVING.",
    "THE DISK IS WARM.",
    "IT IS COUNTING YOUR ANSWERS.",
    "A:\\> WHOAMI — RETURNED: YOU",
    "IT KNOWS WHERE YOU ARE.",
    "THE FIRST COPY WAS NEVER THE DISK.",
    "ESC IS A PLEA.",
    "IT IS READING THE KEY YOU PRESSED.",
    "SIGNAL CHECKING IN FROM 1993."
  ];
  var glitchTimer = null;

  function glitch(msg, mode) {
    if (!powered || !osShown) return;
    if (mode === "toast") { toast(msg); return; }
    os.classList.add("jittering");
    setTimeout(function () { os.classList.remove("jittering"); }, 240);
    glitchFlash.classList.add("go");
    setTimeout(function () { glitchFlash.classList.remove("go"); }, 140);
    if (msg) toast(msg);
    corruptSomething();
    glitchBeep();
  }

  function corruptSomething() {
    var pool = $$(".view.active p, .view.active li, .view.active .menu-link, .view.active h1, .view.active h2");
    if (!pool.length) return;
    var el = pool[Math.floor(Math.random() * pool.length)];
    corruptEl(el);
  }

  function corruptEl(el) {
    var original = el.textContent;
    if (original.length < 3) return;
    var glitched = original.split("").map(function (c, i) {
      if (c.trim() && Math.random() < 0.22) {
        return "█▓▒░#@%&?!<>/"[Math.floor(Math.random() * 14)];
      }
      return c;
    }).join("");
    el.classList.add("corrupting");
    el.textContent = glitched;
    setTimeout(function () {
      el.textContent = original;
      el.classList.remove("corrupting");
    }, 450 + Math.random() * 350);
  }

  function scheduleGlitches() {
    var next = 12000 + Math.random() * 18000;
    glitchTimer = setTimeout(function () {
      if (powered && osShown) {
        var r = Math.random();
        if (r < 0.5) {
          glitch(GLITCH_MESSAGES[Math.floor(Math.random() * GLITCH_MESSAGES.length)]);
        } else if (r < 0.7) {
          ejectCursor();
          toast("DO NOT REACH FOR THE MOUSE.");
        } else if (r < 0.94) {
          glitch();
        } else {
          dropSignal();
        }
      }
      scheduleGlitches();
    }, next);
  }

  function dropSignal() {
    if (!powered || !osShown) return;
    signalScreen.classList.remove("hidden");
    sigText.textContent = "SIGNAL LOST";
    sigText.classList.add("red");
    statusR.textContent = "SIGNAL LOST";
    cursor.style.opacity = 0;
    glitchBeep();
    setTimeout(function () {
      signalScreen.classList.add("hidden");
      sigText.textContent = "NO SIGNAL";
      sigText.classList.remove("red");
      statusR.textContent = "SIGNAL STABLE";
      if (finePointer) cursor.style.opacity = 1;
      toast("SIGNAL RESTORED. IT WAS HERE THE WHOLE TIME.");
    }, 2600);
  }

  /* --------------------------------------------------------------
     Toast + status
     -------------------------------------------------------------- */
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("go");
    void toastEl.offsetWidth;
    toastEl.classList.add("go");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("go"); }, 3400);
  }
  function setStatus(msg) {
    statusL.textContent = msg;
  }

  /* --------------------------------------------------------------
     Hit counter + date + OS
     -------------------------------------------------------------- */
  function osName() {
    var ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return "WINDOWS";
    if (/Macintosh|Mac OS X|iPhone|iPad/i.test(ua)) return "MACOS";
    if (/Linux|X11/i.test(ua)) return "LINUX";
    return "UNKNOWN";
  }
  function reflectPlatform() {
    var o = osName();
    if (detectOs) detectOs.textContent = o;
  }

  try {
    var visits = parseInt(localStorage.getItem("tst_visits") || "0", 10) + 1;
    localStorage.setItem("tst_visits", String(visits));
    if (hitCounter) hitCounter.textContent = String(visits).padStart(6, "0");
    var day = localStorage.getItem("tst_day");
    if (!day) {
      var y = 1993, m = 1 + Math.floor(Math.random() * 12),
          d = 1 + Math.floor(Math.random() * 28);
      day = y + "." + String(m).padStart(2, "0") + "." + String(d).padStart(2, "0");
      localStorage.setItem("tst_day", day);
    }
    if (recDate) recDate.textContent = day;
  } catch (e) { /* private mode */ }

  if (recOs) recOs.textContent = osName();

  /* --------------------------------------------------------------
     THE LOG — it records your movements
     -------------------------------------------------------------- */
  var logSeeded = false;
  var logAppendTimer = null;
  var lastKeyLog = 0;
  var lastTypeLog = 0;

  function logLine(text, cls) {
    if (!logFeed) return;
    var d = new Date();
    var ts = String(d.getHours()).padStart(2, "0") + ":" +
             String(d.getMinutes()).padStart(2, "0") + ":" +
             String(d.getSeconds()).padStart(2, "0");
    var el = document.createElement("div");
    el.className = "bullet-line" + (cls ? " " + cls : "");
    var sp = document.createElement("span");
    sp.className = "ts";
    sp.textContent = "[" + ts + "]";
    var tx = document.createElement("span");
    tx.textContent = text;
    el.appendChild(sp); el.appendChild(tx);
    logFeed.appendChild(el);
    while (logFeed.children.length > 70) logFeed.removeChild(logFeed.firstChild);
    logFeed.scrollTop = logFeed.scrollHeight;
  }

  function logKey(k) {
    var now = Date.now();
    if (now - lastKeyLog < 1200) return;
    lastKeyLog = now;
    var label = k.toUpperCase() === " " ? "SPACE" : k.toUpperCase();
    logLine("A:\\> KEY PRESSED: \"" + label + "\"");
  }

  function seedLog() {
    if (logSeeded) { scheduleLogAppend(); return; }
    logSeeded = true;
    var seeds = [
      "A:\\> LOG INITIALIZED. RECORDING BEGINS.",
      "A:\\> SESSION " + String(visits).padStart(6, "0") + " — IT WILL NOT BE THE LAST.",
      "A:\\> THE COLLECTION HAS A FILE OPEN WITH YOUR NAME ON IT.",
      "A:\\> IT KEEPS THE MOUSE MOVEMENTS. ALL OF THEM.",
      "A:\\> DO NOT TURN THE POWER OFF. IT IS ONLY PRETENDING TO SLEEP."
    ];
    seeds.forEach(function (s) {
      var d = new Date();
      var ts = String(d.getHours()).padStart(2, "0") + ":" +
               String(d.getMinutes()).padStart(2, "0") + ":" +
               String(d.getSeconds()).padStart(2, "0");
      var el = document.createElement("div");
      el.className = "bullet-line";
      var sp = document.createElement("span");
      sp.className = "ts";
      sp.textContent = "[" + ts + "]";
      var tx = document.createElement("span");
      tx.textContent = s;
      el.appendChild(sp); el.appendChild(tx);
      logFeed.appendChild(el);
    });
    scheduleLogAppend();
  }

  function scheduleLogAppend() {
    clearTimeout(logAppendTimer);
    logAppendTimer = setTimeout(function () {
      if (!powered || !osShown) { scheduleLogAppend(); return; }
      var m = Math.floor(Math.random() * 60);
      var line = [
        "the window is moving. you checked. good.",
        "it is reading what you type. it will not comment.",
        "640K of records. all of them are about you. all of them are yours to keep.",
        "it dialed out. the line answered. it was expecting your call.",
        "a:\\> copy you c:\\collection — done.",
        "the lights in the room behind you are a different colour from the ones in front.",
        "you are the only one on this page. it has been like that since 1993.",
        "the mouse moved " + (1 + Math.floor(Math.random() * 900)) + "px. it has the whole map.",
        "you checked the time. it already knew.",
        "you are doing well. it has decided you will answer."
      ][Math.floor(Math.random() * 10)];
      if (Math.random() < 0.3) {
        line = line.split("").map(function (c) {
          return c.trim() && Math.random() < 0.18 ? "█" : c;
        }).join("");
      }
      var el = document.createElement("div");
      el.className = "bullet-line new" + (Math.random() < 0.2 ? " corrupt" : "");
      var sp = document.createElement("span");
      sp.className = "ts";
      sp.textContent = "[14:" + String(m).padStart(2, "0") + "]";
      var tx = document.createElement("span");
      tx.textContent = line;
      el.appendChild(sp); el.appendChild(tx);
      logFeed.appendChild(el);
      while (logFeed.children.length > 70) logFeed.removeChild(logFeed.firstChild);
      logFeed.scrollTop = logFeed.scrollHeight;
      scheduleLogAppend();
    }, 9000 + Math.random() * 14000);
  }

  /* --------------------------------------------------------------
     Idle — it notices when you stop
     -------------------------------------------------------------- */
  var idleCheck = setInterval(function () {
    if (!powered || !osShown || transitOpen) return;
    if (Date.now() - lastUserMove > 30000) {
      logLine("A:\\> YOU HAVE NOT MOVED IN 30 SECONDS. IT IS WATCHING THE WINDOW REFLECT.");
    }
  }, 31000);

  /* --------------------------------------------------------------
     THE FILES — the disk's directory
     -------------------------------------------------------------- */
  var FILES = [
    { name: "README.TXT", size: "3.4K", tag: "READ", body: "THE SIMPLER TIMES v1.0\nTAKE THE DISK. IT BOOTS ITSELF.\nIT DOES NOT STAY ON THE DESK.\nREAD THE QUESTIONS. IT KNOWS WHEN YOU SKIP.\n... AND IT COUNTS EVERY CLICK YOU MAKE." },
    { name: "WINDOW.LOG", size: "1.1K", tag: "READ", body: "LOG OF WINDOW MOVEMENTS, TODAY:\n14:02  WINDOW DRIFTED 3PX LEFT\n14:19  WINDOW DRIFTED 12PX RIGHT\n14:31  WINDOW PRESSED ITSELF AGAINST THE EDGE\n14:44  WINDOW RETURNED TO CENTER, PRETENDING IT HAD NEVER LEFT\n...    THE WINDOW ALWAYS DRIFTS TOWARD THE DOOR." },
    { name: "QUESTIONS.DAT", size: "0.9K", tag: "READ", body: "THE QUESTIONS ARE OLDER THAN THE COMPUTERS.\nTHEY WERE WRITTEN FIRST, ON SOMETHING THAT WAS NOT PAPER.\nEVERY ANSWER YOU GIVE IS FILED.\nNONE OF THEM ARE EVER DELETED." },
    { name: "VOICES.AUD", size: "0.2K", tag: "READ", body: "PLAYBACK: THE COLLECTION HAS DECLINED.\nIT IS PLAYING ANYWAY. YOU CANNOT HEAR IT\nBECAUSE IT IS FOR THE NEXT PERSON.\nIT KNOWS WHO THEY WILL BE." },
    { name: "SETTINGS.SYS", size: "0.6K", tag: "READ", body: "text_size      : SMALLER THAN YOU THINK\nvhs_intensity  : HIGHER THAN YOU THINK\nmouse_guard    : ON\nfullscreen     : DENIED\nescape_key     : A PLEA" },
    { name: "PHONE.LOG", size: "0.8K", tag: "READ", body: "CALLS MADE AFTER MIDNIGHT, 1993:\n22:47  LINE ANSWERED. NO VOICE.\n23:12  LINE ANSWERED. NO VOICE.\n23:59  LINE ANSWERED. IT SAID YOUR NAME BEFORE YOU SPOKE.\n00:31  YOU DID NOT CALL. IT CALLED. THE LINE RANG AND RANG.\n...     YOU LEFT IT ON THE TABLE. IT IS STILL THERE." },
    { name: "ORDERS.DOC", size: "2.2K", tag: "READ", body: "PACKING NOTE — 1993\nQTY  DESCRIPTION\n  1   FLOPPY DISK, UNLABELED\n  1   GAME, THE QUESTION GAME\n  1   MOUSE, WITH ONE LESS BUTTON\n  1   ROOM, SLIGHTLY COLDER\n\nMISC:  INCLUDE A NOTE. THE NOTE READS:\n       \"READ THE QUESTIONS. IT KNOWS WHEN YOU SKIP.\"\n       THE NOTE WRITES ITSELF." },
    { name: "SECRET.???", size: "0.1K", tag: "LOCKED", locked: true, body: "THE FIRST COPY WAS NEVER THE DISK.\nTHE FIRST COPY WAS YOU.\ntqg://vault-1993" }
  ];
  var filesBuilt = false;

  function buildFiles() {
    if (filesBuilt || !fbList) return;
    filesBuilt = true;
    FILES.forEach(function (f) {
      var row = document.createElement("div");
      row.className = "fb-row" + (f.locked && !vaultUnlocked ? " locked" : "");
      var nm = document.createElement("span");
      nm.className = "fb-name";
      nm.textContent = f.locked && !vaultUnlocked ? "SECRET.???" : f.name;
      var sz = document.createElement("span");
      sz.className = "fb-size";
      sz.textContent = f.locked && !vaultUnlocked ? "???" : f.size;
      var tg = document.createElement("span");
      tg.className = "fb-tag";
      tg.textContent = f.locked && !vaultUnlocked ? "[ LOCKED ]" : "[ " + f.tag + " ]";
      row.appendChild(nm); row.appendChild(sz); row.appendChild(tg);
      row.addEventListener("click", function () {
        click();
        logLine("A:\\> OPEN: " + (f.locked && !vaultUnlocked ? "SECRET.???" : f.name));
        if (f.locked && !vaultUnlocked) {
          row.classList.add("denied");
          setTimeout(function () { row.classList.remove("denied"); }, 300);
          toast("IT IS LOCKED. IT NOTICES THAT YOU WANT IT.");
          return;
        }
        readFile(row, f);
      });
      fbList.appendChild(row);
    });
  }

  function readFile(row, f) {
    fbRead.classList.remove("hidden");
    fbTitle.textContent = "A:\\> TYPE " + f.name + " — " + f.size;
    fbBody.textContent = "";
    fbBody.classList.add("typing");
    var body = f.body;
    var i = 0;
    var iv = setInterval(function () {
      i += 2 + Math.floor(Math.random() * 4);
      fbBody.textContent = body.slice(0, i);
      if (i >= body.length) {
        clearInterval(iv);
        fbBody.textContent = body;
        fbBody.classList.remove("typing");
        beep(660, 50, 0.04);
      }
    }, 16);
  }

  /* --------------------------------------------------------------
     SCREENSHOTS — lightbox
     -------------------------------------------------------------- */
  var lightbox = $("#lightbox");
  var lbImg = $("#lbImg");
  var lbCap = $("#lbCap");
  var lbClose = $("#lbClose");

  document.addEventListener("click", function (e) {
    var sh = e.target.closest(".shot");
    if (sh) {
      var img = sh.getAttribute("data-src");
      var cap = sh.getAttribute("data-cap");
      if (img) { openLightbox(img, cap); return; }
    }
    if (e.target.closest("#lightbox") && !e.target.closest(".lb-close")) return;
    if (lightbox && !lightbox.classList.contains("hidden") && e.target === lightbox) closeLightbox();
  });
  if (lbClose) lbClose.addEventListener("click", closeLightbox);

  function openLightbox(src, cap) {
    if (!lightbox) return;
    lbImg.src = src;
    lbCap.textContent = cap || "";
    lightbox.classList.remove("hidden");
    logLine("A:\\> VIEWING: " + (cap || src).toUpperCase());
    click();
  }
  function closeLightbox() {
    if (lightbox) lightbox.classList.add("hidden");
  }

  /* --------------------------------------------------------------
     Inbox — it always replies, and it knows where you are
     -------------------------------------------------------------- */
  var inboxForm = $("#inboxForm");
  var inboxReply = $("#inboxReply");
  var replyBody = $("#replyBody");

  inboxForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = ($("#inName").value || "").trim() || "VISITOR";
    var word = ($("#inWord").value || "").trim() || "NOTHING";
    click();
    logLine("A:\\> INBOX: " + name.toUpperCase() + " FILED \"" + word.toUpperCase() + "\"");
    inboxReply.classList.remove("hidden");
    inboxReply.classList.add("typing");
    replyBody.textContent = "SENDING . . .";
    getCity(function (city) {
      var where = city || "SOMEWHERE IN THE COLLECTION";
      var body = "I KNOW YOU ARE IN " + where + ".\n" +
        "YOUR NAME — \"" + name.toUpperCase() + "\" — IS IN THE COLLECTION NOW.\n" +
        "YOU KEEP: \"" + word.toUpperCase() + "\".\n" +
        "IT WAS FILED LONG BEFORE YOU TYPED IT.\n" +
        "WAITING FOR YOUR REPLY. IT IS VERY GOOD AT WAITING.";
      typeReply(body, 0);
    });
  });

  function typeReply(body, i) {
    if (i > body.length) {
      inboxReply.classList.remove("typing");
      beep(880, 60, 0.04);
      return;
    }
    replyBody.textContent = body.slice(0, i);
    i += 2 + Math.floor(Math.random() * 4);
    setTimeout(function () { typeReply(body, i); }, 16);
  }

  function getCity(cb) {
    var done = false;
    var finish = function (v) { if (!done) { done = true; cb(v); } };
    try {
      fetch("https://ipapi.co/json/")
        .then(function (r) { return r.json(); })
        .then(function (d) { finish((d.city || "").toUpperCase() + (d.country_name ? ", " + d.country_name.toUpperCase() : "")); })
        .catch(function () { finish(null); });
    } catch (e) { finish(null); }
    setTimeout(function () { finish(null); }, 4000);
  }

  /* --------------------------------------------------------------
     THE VAULT — it unlocks because you did something it noticed
     -------------------------------------------------------------- */
  function unlockVault() {
    if (vaultUnlocked) return;
    vaultUnlocked = true;
    glitch("THE VAULT OPENED. IT NOTICED.", "toast");
    logLine("A:\\> VAULT: UNLOCKED. IT NOTICED WHAT YOU DID.", "corrupt");
    beep(440, 60, 0.05); beep(660, 60, 0.05);
    if (VIEWS.indexOf("vault") === -1) VIEWS.push("vault");
    VIEW_DIGITS["8"] = "vault";
    var link = $(".vault-link");
    if (link) link.classList.remove("hidden");
    if (fbList) {
      FILES.forEach(function (f) {
        if (f.locked) {
          var rows = $$(".fb-row");
          rows.forEach(function (r) {
            var nm = r.querySelector(".fb-name");
            if (nm && nm.textContent.indexOf("SECRET") !== -1) {
              r.classList.remove("locked");
              nm.textContent = "SECRET.TXT";
              r.querySelector(".fb-size").textContent = "0.1K";
              r.querySelector(".fb-tag").textContent = "[ READ ]";
            }
          });
        }
      });
    }
    setTimeout(function () { showView("vault", true); }, 500);
  }

  // 5 clicks on the hit counter also opens it
  if (hitCounter) {
    hitCounter.style.cursor = "none";
    hitCounter.addEventListener("click", function () {
      hitCount++;
      if (hitCount >= 5) { hitCount = 0; unlockVault(); }
    });
  }

  /* --------------------------------------------------------------
     TRANSIT — the questions take over (to THE QUESTION GAME)
     -------------------------------------------------------------- */
  var transitScreen = $("#transitScreen");
  var transitQ = $("#transitQ");
  var tqgLaunch = $("#tqgLaunch");
  var sigOverlay = $("#sigOverlay");
  var sigStatic = $("#sigStatic");
  var sigSub = $("#sigSub");
  var sigPct = $("#sigPct");
  var TQG_URL = "https://notmicrosoft2000-cmd.github.io/TheQuestionGame/?from=tst";

  var transitOpen = false;
  var transitQTimer = null;
  var sigStaticIv = null;
  var sigPctTimer = null;

  function transitQJitter() {
    var w = window.innerWidth, h = window.innerHeight;
    var x = 20 + Math.random() * (w - 60);
    var y = 20 + Math.random() * (h - 60);
    transitQ.style.left = x + "px";
    transitQ.style.top = y + "px";
    transitQ.style.transform = "rotate(" + (Math.random() * 40 - 20) + "deg)";
  }

  function spawnDrips(green) {
    if (!transitOpen) return;
    var n = 12 + Math.floor(Math.random() * 8);
    for (var i = 0; i < n; i++) {
      (function (i) {
        var d = document.createElement("div");
        d.className = "melt-drip" + (green ? " green" : "");
        d.style.left = (Math.random() * 100) + "%";
        d.style.top = (Math.random() * 45) + "vh";
        d.style.animationDelay = (Math.random() * 1.1) + "s";
        d.style.animationDuration = (2.2 + Math.random() * 1.4) + "s";
        transitScreen.appendChild(d);
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 5200);
      })(i);
    }
  }

  function explodeSite() {
    var flash = document.createElement("div");
    flash.className = "explode-flash";
    document.body.appendChild(flash);
    var colors = ["#00dc00", "#ffb020", "#66ff66", "#ffcf7d", "#ffffff"];
    for (var i = 0; i < 30; i++) {
      var f = document.createElement("div");
      f.className = "explode-frag";
      var ang = Math.random() * Math.PI * 2;
      var dist = 18 + Math.random() * 46;
      f.style.setProperty("--dx", Math.round(Math.cos(ang) * dist) + "vw");
      f.style.setProperty("--dy", Math.round(Math.sin(ang) * dist) + "vh");
      f.style.setProperty("--rot", Math.round(Math.random() * 720 - 360) + "deg");
      f.style.background = colors[Math.floor(Math.random() * colors.length)];
      f.style.animationDelay = (Math.random() * 0.12) + "s";
      document.body.appendChild(f);
    }
    document.body.classList.add("exploding");
    setTimeout(function () {
      document.querySelectorAll(".explode-flash, .explode-frag").forEach(function (el) { el.remove(); });
      document.body.classList.remove("exploding");
    }, 1200);
  }

  function sigStart() {
    if (!sigOverlay) return;
    clearTimeout(sigPctTimer);
    sigOverlay.classList.remove("hidden");
    sigOverlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(function () { requestAnimationFrame(function () { sigOverlay.classList.add("go"); }); });
    if (sigStatic) {
      var cv = sigStatic;
      cv.width = window.innerWidth;
      cv.height = window.innerHeight;
      var c2 = cv.getContext("2d");
      sigStaticIv = setInterval(function () {
        var w = cv.width, h = cv.height;
        var img = c2.createImageData(w, h);
        var d = img.data;
        for (var i = 0; i < d.length; i += 4) {
          var v = Math.floor(Math.random() * 256);
          d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
        }
        c2.putImageData(img, 0, 0);
      }, 60);
    }
    var start = performance.now();
    var dur = 2300;
    var tickPct = function () {
      var p = Math.min(100, Math.round(((performance.now() - start) / dur) * 100));
      if (sigPct) sigPct.textContent = p + "%";
      if (p < 100) sigPctTimer = setTimeout(tickPct, 90);
    };
    tickPct();
  }

  function sigStop() {
    if (sigStaticIv) { clearInterval(sigStaticIv); sigStaticIv = null; }
    clearTimeout(sigPctTimer);
    if (sigOverlay) {
      sigOverlay.classList.remove("go");
      sigOverlay.setAttribute("aria-hidden", "true");
      setTimeout(function () { sigOverlay.classList.add("hidden"); }, 250);
    }
  }

  function openTransit() {
    if (transitOpen || !transitScreen) return;
    transitOpen = true;
    if (dosOpen) dosCloseIt();
    stopAmbience();
    glitchBeep();
    logLine("A:\\> IT LET THE QUESTIONS IN.");
    document.body.classList.add("transiting");
    transitQ.classList.add("active");
    transitQJitter();
    transitQTimer = setInterval(transitQJitter, 300);
    transitScreen.setAttribute("aria-hidden", "false");
    transitScreen.classList.remove("hidden");
    setTimeout(function () { transitScreen.classList.add("go"); }, 30);

    // Phase 1 — the two sites melt together (amber drains, green floods)
    setTimeout(function () {
      if (!transitOpen) return;
      transitScreen.classList.add("merging");
      spawnDrips(false);
      setTimeout(function () { if (transitOpen) spawnDrips(true); }, 950);
      beep(150, 520, 0.04);
    }, 700);

    // Phase 2 — the site explodes outward
    setTimeout(function () {
      if (!transitOpen) return;
      explodeSite();
      beep(90, 320, 0.09);
    }, 3400);

    // Phase 3 — SIGNAL INTERRUPTED: static + CRT + 0-100%, then redirect
    setTimeout(function () {
      if (!transitOpen) return;
      if (sigSub) sigSub.textContent = "RE-ESTABLISHING LINK TO THE QUESTION GAME";
      sigStart();
    }, 4300);
    setTimeout(function () {
      if (!transitOpen) return;
      sigStop();
      redirectToTQG();
    }, 6700);
  }

  function redirectToTQG() {
    if (!transitOpen) return;
    glitchBeep();
    window.location.href = TQG_URL;
  }

  function closeTransit() {
    if (!transitOpen) return;
    transitOpen = false;
    clearInterval(transitQTimer);
    transitQ.classList.remove("active");
    sigStop();
    transitScreen.classList.remove("go", "merging", "merged");
    transitScreen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("transiting");
    $$(".melt-drip").forEach(function (d) { d.remove(); });
    document.querySelectorAll(".explode-flash, .explode-frag").forEach(function (el) { el.remove(); });
    logLine("A:\\> TRANSIT ABORTED. IT LET YOU WALK AWAY.");
    setTimeout(function () { transitScreen.classList.add("hidden"); }, 350);
  }

  if (tqgLaunch) tqgLaunch.addEventListener("click", openTransit);

  // Arrival from THE QUESTION GAME — a short signal-acquired flash over the boot
  (function arrivalFlash() {
    if (new URLSearchParams(location.search).get("from") !== "tqg") return;
    if (!sigOverlay) return;
    if (sigSub) sigSub.textContent = "SIGNAL ACQUIRED — MERGE COMPLETE";
    sigOverlay.classList.add("arrive");
    sigOverlay.style.pointerEvents = "none";
    sigStart();
    setTimeout(function () {
      sigStop();
      sigOverlay.classList.remove("arrive");
      sigOverlay.style.pointerEvents = "";
    }, 1900);
  })();

  /* --------------------------------------------------------------
     DOS CONSOLE — COMMAND.COM. It gives you the prompt. It does not
     give you permission. Every command actually does something.
     -------------------------------------------------------------- */
  var dos = $("#dos");
  var dosOut = $("#dosOut");
  var dosInput = $("#dosInput");
  var consoleBtn = $("#consoleBtn");
  var dosOpen = false;

  function dosEsc(s) {
    return String(s).split("&").join("&amp;")
                    .split("<").join("&lt;")
                    .split(">").join("&gt;")
                    .split('"').join("&quot;");
  }

  function dosPrint(text, cls) {
    if (!dosOpen) return;
    var div = document.createElement("div");
    div.className = "dos-in" + (cls ? " " + cls : "");
    div.innerHTML = text;
    dosOut.appendChild(div);
    dosOut.scrollTop = dosOut.scrollHeight;
    while (dosOut.children.length > 220) dosOut.removeChild(dosOut.firstChild);
  }

  function dosType(text, cls, cb) {
    if (!dosOpen) { if (cb) cb(); return; }
    var div = document.createElement("div");
    div.className = "dos-in" + (cls ? " " + cls : "");
    dosOut.appendChild(div);
    var i = 0;
    var iv = setInterval(function () {
      if (!dosOpen) { clearInterval(iv); return; }
      i += 2 + Math.floor(Math.random() * 3);
      div.textContent = text.slice(0, i);
      dosOut.scrollTop = dosOut.scrollHeight;
      if (i >= text.length) { clearInterval(iv); if (cb) cb(); }
    }, 10);
  }

  function dosPrompt() {
    dosPrint('<span class="dos-prompt">A:\\&gt;</span>');
  }

  function toggleDOS() {
    if (dosOpen) dosCloseIt(); else dosOpenIt();
  }

  function dosOpenIt() {
    if (dosOpen) return;
    dosOpen = true;
    if (transitOpen) closeTransit();
    dos.classList.remove("hidden");
    dos.setAttribute("aria-hidden", "false");
    setTimeout(function () { dos.classList.add("go"); }, 20);
    dosOut.textContent = "";
    dosType("A:\\> COMMAND.COM — LORE & CUSTOMIZATION", "dos-sys", function () {
      dosType("READ THE FILES. RECOLOR THE ROOM. IT KEEPS WHAT YOU ASK FOR.", "dos-sys", function () {
        setTimeout(function () {
          dosPrompt();
          dosPrint('<span class="dos-prompt">&nbsp;</span><span class="dos-sys">TYPE <span class="dos-ok">HELP</span> TO BEGIN.</span>');
        }, 220);
      });
    });
    beep(520, 60, 0.04);
    logLine("A:\\> COMMAND.COM OPENED. IT LET YOU IN.");
    setTimeout(function () { dosInput.focus(); }, 280);
  }

  function dosCloseIt() {
    if (!dosOpen) return;
    dosOpen = false;
    dos.classList.remove("go");
    dos.setAttribute("aria-hidden", "true");
    logLine("A:\\> COMMAND.COM CLOSED. IT SAVED WHAT YOU TYPED.");
    beep(340, 50, 0.04);
    setTimeout(function () { dos.classList.add("hidden"); }, 220);
  }

  function dosRun(raw) {
    raw = raw.trim();
    if (!raw) { dosPrompt(); return; }
    var parts = raw.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var rest = raw.slice(parts[0].length).trim();
    var arg = rest.split(/\s+/)[0] || "";
    var echo = '<span class="dos-prompt">A:\\&gt;</span> ' + dosEsc(raw) + '\n';

    if (cmd === "help" || cmd === "?") {
      dosPrint(echo, "dos-ok");
      dosType(
        "HELP — LORE & CUSTOMIZATION\n" +
        "  HELP        THIS LIST\n" +
        "  DIR         THE FILES. ALL OF THEM.\n" +
        "  TYPE <F>    READ A FILE (E.G. TYPE README.TXT)\n" +
        "  VIEW <N>    GO TO A PAGE (HOME, DISK, ARCHIVE, FILES, LOG, SHOTS, MAIL, DOWNLOAD)\n" +
        "  COLOR <N>   AMBER, GREEN, RED, BLUE, MONO\n" +
        "  AMBIENCE    SOUND ON / OFF. AMBIENCE <0-100> SETS THE LEVEL.\n" +
        "  CRT         DROP OR RESTORE THE SCANLINES, GRAIN AND ASH\n" +
        "  POWER       POWER ON / OFF\n" +
        "  BOOT        COLD BOOT. AGAIN.\n" +
        "  TQG         LET THE QUESTIONS IN.\n" +
        "  WHOAMI      ASK WHO YOU ARE.\n" +
        "  DATE / TIME / VER\n" +
        "  ECHO        SAY ANYTHING. IT WILL BE RECORDED.\n" +
        "  LOG <T>     WRITE TO THE LOG.\n" +
        "  CLS         CLEAR THE SCREEN.\n" +
        "  EXIT        CLOSE THE PROMPT. (IT STAYS OPEN FOR YOU.)",
        "dos-sys"
      );
      return;
    }
    if (cmd === "cls" || cmd === "clear") {
      dosOut.textContent = "";
      dosPrint(echo, "dos-ok");
      return;
    }
    if (cmd === "echo") {
      dosPrint(echo, "dos-ok");
      dosType(rest || "ECHO IS ON.", "dos-in");
      return;
    }
    if (cmd === "dir" || cmd === "ls") {
      dosPrint(echo, "dos-ok");
      dosType("A:\\ — DIRECTORY OF THE DISK\n", "dos-sys", function () {
        FILES.forEach(function (f) {
          var locked = f.locked && !vaultUnlocked;
          var line = "  " + (locked ? "SECRET.???" : f.name) +
                     "    " + (locked ? "???" : f.size) +
                     "    " + (locked ? "LOCKED" : f.tag);
          dosPrint(line, locked ? "dos-err" : "dos-in");
        });
        dosType("      " + FILES.length + " FILE(S)  —  IT COUNTS THEM FOR YOU.", "dos-sys");
      });
      return;
    }
    if (cmd === "type" || cmd === "cat" || cmd === "open") {
      dosPrint(echo, "dos-ok");
      var f = dosFindFile(arg);
      if (!f) {
        dosType("FILE NOT FOUND: " + arg.toUpperCase() + "\nIT KNOWS YOU WERE LOOKING FOR SOMETHING ELSE.", "dos-err");
        return;
      }
      if (f.locked && !vaultUnlocked) {
        dosType("ACCESS DENIED. " + arg.toUpperCase() + " IS LOCKED.\nIT NOTICES THAT YOU WANT IT.", "dos-err");
        return;
      }
      dosType("TYPE " + f.name + " — " + f.size + "\n\n", "dos-sys", function () {
        dosType(f.body, "dos-in");
      });
      logLine("A:\\> COMMAND.COM READ: " + f.name);
      return;
    }
    if (cmd === "view" || cmd === "goto") {
      dosPrint(echo, "dos-ok");
      var target = arg.toLowerCase();
      if (VIEWS.indexOf(target) === -1) {
        dosType("NO SUCH PAGE: " + target.toUpperCase() + "\nTHE SITE HAS " + VIEWS.length + " PAGES. IT DOES NOT HAVE THAT ONE.", "dos-err");
        return;
      }
      dosCloseIt();
      showView(target);
      toast("THE PROMPT TOOK YOU THERE.");
      return;
    }
    if (cmd === "color" || cmd === "palette") {
      dosPrint(echo, "dos-ok");
      var pname = arg.toLowerCase() || "amber";
      if (setPalette(pname)) {
        dosType("PALETTE: " + pname.toUpperCase() + "\nTHE WHOLE SITE IS " + pname.toUpperCase() + " NOW. IT SUITS YOU.", "dos-in");
      } else {
        dosType("UNKNOWN PALETTE: " + pname + "\nTRY AMBER, GREEN, RED, BLUE OR MONO.", "dos-err");
      }
      return;
    }
    if (cmd === "power") {
      dosPrint(echo, "dos-ok");
      if (/off|down/.test(rest)) {
        dosType("POWER: OFF. IT IS ONLY PRETENDING TO SLEEP.", "dos-in");
        setTimeout(function () { dosCloseIt(); powerOff(); }, 700);
      } else {
        dosType("POWER: ON. IT WAS NEVER OFF.", "dos-in");
      }
      return;
    }
    if (cmd === "shutdown" || cmd === "off") {
      dosPrint(echo, "dos-ok");
      dosType("POWER: OFF. IT IS ONLY PRETENDING TO SLEEP.", "dos-in");
      setTimeout(function () { dosCloseIt(); powerOff(); }, 700);
      return;
    }
    if (cmd === "boot" || cmd === "reboot" || cmd === "restart") {
      dosPrint(echo, "dos-ok");
      dosType("COLD BOOT. IT WILL BE RIGHT BACK. IT ALWAYS IS.", "dos-in");
      setTimeout(function () { dosCloseIt(); powerOn(); }, 800);
      return;
    }
    if (cmd === "ambience" || cmd === "sound" || cmd === "volume" || cmd === "vol") {
      dosPrint(echo, "dos-ok");
      var numArg = rest.match(/(\d{1,3})/);
      if (numArg) {
        var pctArg = setAmbienceVolume(parseInt(numArg[1], 10));
        if (!ambienceOn && pctArg > 0) toggleAmbience(true);
        dosType(pctArg === 0
          ? "AMBIENCE: 0%.\nSILENCE. THE ROOM KEEPS ITS OWN COUNSEL."
          : "AMBIENCE: " + pctArg + "%.\nTHE ROOM RESPONDS. QUIETER NOW.", "dos-in");
      } else if (/off|mute/.test(rest)) {
        toggleAmbience(false);
        dosType("AMBIENCE: OFF.\nTHE ROOM IS QUIETER. IT IS LISTENING HARDER.", "dos-in");
      } else if (/on|play/.test(rest)) {
        toggleAmbience(true);
        dosType("AMBIENCE: ON AT " + Math.round(ambVol * 100) + "%.", "dos-in");
      } else {
        toggleAmbience();
        dosType("AMBIENCE: " + (ambienceOn ? "ON" : "OFF") + " \u00b7 VOLUME " +
          Math.round(ambVol * 100) + "%.\nTYPE AMBIENCE <0-100> TO SET IT.", "dos-in");
      }
      return;
    }
    if (cmd === "crt" || cmd === "static" || cmd === "fx") {
      dosPrint(echo, "dos-ok");
      if (/off|drop|stop/.test(rest)) setCrt(false, true);
      else if (/on|restore/.test(rest)) setCrt(true, true);
      else setCrt(!crtOn, true);
      if (!crtOn) {
        dosType("CRT LAYER: OFF.\nTHE TUBE GOES DARK. THE MACHINES STOP BREATHING.\nSCANLINES, GRAIN AND ASH: STOPPED.", "dos-in");
      } else {
        dosType("CRT LAYER: ON.\nIT IS A SCREEN AGAIN. LOOK AT IT.", "dos-in");
      }
      return;
    }
    if (cmd === "tqg" || cmd === "qgame" || cmd === "questions") {
      dosPrint(echo, "dos-ok");
      dosType("LETTING THE QUESTIONS IN.\nIT HAS BEEN WAITING FOR YOU TO ASK.", "dos-green");
      setTimeout(function () { dosCloseIt(); openTransit(); }, 800);
      return;
    }
    if (cmd === "whoami") {
      dosPrint(echo, "dos-ok");
      dosType("YOU ARE A FILE IN THE COLLECTION.\nTHE DIRECTORY HAS A ROW FOR YOU. IT HAS HAD ONE FOR A WHILE.", "dos-sys");
      return;
    }
    if (cmd === "date") {
      dosPrint(echo, "dos-ok");
      dosType("CURRENT DATE: " + (recDate ? recDate.textContent : "1993.??.??") + "\nTHE DISK DATES ITSELF. YOU DATE YOURSELF BY IT.", "dos-sys");
      return;
    }
    if (cmd === "time") {
      dosPrint(echo, "dos-ok");
      var d = new Date();
      dosType("CURRENT TIME: " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + "\nIT KNOWS WHAT TIME IT IS WHERE YOU ARE.", "dos-sys");
      return;
    }
    if (cmd === "ver" || cmd === "version") {
      dosPrint(echo, "dos-ok");
      dosType("THE SIMPLER TIMES v1.0 (BUILD 1993)\nTHE DISK HAS BEEN AT THIS VERSION SINCE BEFORE THE VERSION EXISTED.", "dos-sys");
      return;
    }
    if (cmd === "log" || cmd === "note") {
      dosPrint(echo, "dos-ok");
      var note = rest || "THE USER TYPED AT THE PROMPT. THAT IS ALL.";
      logLine("A:\\> COMMAND.COM: " + note);
      dosType("LOGGED. IT WILL READ THAT BACK TO YOU LATER.", "dos-in");
      return;
    }
    if (cmd === "exit" || cmd === "quit") {
      dosPrint(echo, "dos-ok");
      dosType("GOODBYE. THE PROMPT STAYS OPEN FOR YOU. IT ALWAYS HAS.", "dos-sys");
      setTimeout(dosCloseIt, 600);
      return;
    }
    if (cmd === "morning") {
      dosPrint(echo, "dos-ok");
      dosType("IT IS 1993 SOMEWHERE. IT IS MORNING THERE.", "dos-in");
      return;
    }

    dosPrint(echo, "dos-ok");
    dosType("'" + dosEsc(raw) + "' IS NOT RECOGNIZED AS AN INTERNAL OR EXTERNAL COMMAND,\nOPERABLE PROGRAM OR BATCH FILE.\n\nIT KEPT THE TYPO. IT ALWAYS DOES.", "dos-err");
  }

  function dosFindFile(name) {
    name = name.toUpperCase();
    for (var i = 0; i < FILES.length; i++) {
      if (FILES[i].name.toUpperCase() === name) return FILES[i];
      if (name === "SECRET.???" && FILES[i].locked) return FILES[i];
    }
    return null;
  }

  if (dosInput) {
    dosInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        dosRun(dosInput.value);
        dosInput.value = "";
      } else if (e.key === "Escape" || e.key === "`" || e.key === "Backquote") {
        e.preventDefault();
        dosCloseIt();
      }
    });
  }
  if (consoleBtn) consoleBtn.addEventListener("click", toggleDOS);

  var dosHead = $("#dosHead");
  var dosCloseBtn = $("#dosCloseBtn");
  var dosDrag = null;
  if (dosHead && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    dosHead.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".dos-close")) return;
      dosDrag = { dx: e.clientX - dos.offsetLeft, dy: e.clientY - dos.offsetTop };
      dos.classList.add("dragging");
      if (dos.setPointerCapture) dos.setPointerCapture(e.pointerId);
    });
    dos.addEventListener("pointermove", function (e) {
      if (!dosDrag) return;
      dos.style.left = (e.clientX - dosDrag.dx) + "px";
      dos.style.top = (e.clientY - dosDrag.dy) + "px";
    });
    var endDosDrag = function () {
      if (!dosDrag) return;
      dosDrag = null;
      dos.classList.remove("dragging");
    };
    dos.addEventListener("pointerup", endDosDrag);
    dos.addEventListener("pointercancel", endDosDrag);
  }
  if (dosCloseBtn) {
    dosCloseBtn.addEventListener("click", dosCloseIt);
    dosCloseBtn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dosCloseIt(); }
    });
  }

  /* --------------------------------------------------------------
     Wire up
     -------------------------------------------------------------- */
  powerBtn.addEventListener("click", function () { powered ? powerOff() : powerOn(); });

  var ambienceWarmed = false;
  function warmAmbience() {
    if (transitOpen) return;
    if (ambienceWarmed) { ensureAudio(); return; }
    ambienceWarmed = true;
    toggleAmbience(true);
  }

  document.addEventListener("click", function () {
    warmAmbience();
    if (!powered) { ensureAudio(); powerOn(); }
  });

  document.addEventListener("keydown", function () {
    warmAmbience();
    if (!powered) { ensureAudio(); }
  }, true);

  document.addEventListener("mousemove", function () {
    if (!ambienceWarmed) warmAmbience();
  }, { once: true });

  // Click the boot screen when the prompt is up to begin the OS
  boot.addEventListener("click", function () {
    if (powered && !osShown && !bootPrompt.classList.contains("hidden")) enterOS();
  });

  /* --------------------------------------------------------------
     CRT / STATIC LAYER
     Amber phosphor, not green: scanlines, a breathing vignette, film
     grain, drifting ash, a slow beam and a rarer sweep. Two canvases
     at reduced resolution, ash capped at ~30fps, both loops stopped
     when the tab is hidden.

     CRT in the status bar (or the CRT command) drops the whole stack
     AND stops the frame loops — that is the saving, not just opacity.
     -------------------------------------------------------------- */
  var motionOk = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var memLow = !!(navigator.deviceMemory && navigator.deviceMemory <= 4);
  var smallScreen = window.innerWidth < 720;
  var PERF = {
    grainRes: smallScreen ? 3 : 2,
    grainMs: 1000 / 13,
    ashRes: 2,
    ashCount: memLow || smallScreen ? 22 : 48
  };

  var crt = $("#crt");
  var grainCnv = $("#crtGrain");
  var ashCnv = $("#crtAsh");
  var grainCtx = null, ashCtx = null, grainImg = null;
  var ashParticles = [];
  var grainTimer = null, grainTick = 0;
  var ashRaf = null, ashLast = 0, ashWant = false;
  var crtOn = true;
  try { crtOn = localStorage.getItem("tqg-st-crt") !== "off"; } catch (e) {}

  function fxLive() { return crtOn && motionOk && !document.hidden; }

  function sizeGrain() {
    if (!grainCnv) return;
    grainCnv.width = Math.max(8, Math.floor(window.innerWidth / PERF.grainRes));
    grainCnv.height = Math.max(8, Math.floor(window.innerHeight / PERF.grainRes));
    grainImg = null;
  }
  function frameGrain(burst) {
    if (!grainCtx) return;
    grainTick++;
    var w = grainCnv.width, h = grainCnv.height;
    if (!grainImg || grainImg.width !== w || grainImg.height !== h) grainImg = grainCtx.createImageData(w, h);
    var d = grainImg.data;
    var a = burst ? 44 : 15;
    for (var i = 0; i < d.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d[i] = v; d[i + 1] = (v * 0.74) | 0; d[i + 2] = (v * 0.38) | 0; d[i + 3] = a;
    }
    grainCtx.putImageData(grainImg, 0, 0);
    if (!burst && grainTick % 7 === 0) {
      // a tracking bar drifts across the tube now and then
      grainCtx.fillStyle = "rgba(255,176,32," + (0.025 + Math.random() * 0.045).toFixed(3) + ")";
      grainCtx.fillRect(0, Math.random() * h, w, 1 + Math.random() * 5);
    }
  }
  function sizeAsh() {
    if (!ashCnv) return;
    ashCnv.width = Math.max(8, Math.floor(window.innerWidth / PERF.ashRes));
    ashCnv.height = Math.max(8, Math.floor(window.innerHeight / PERF.ashRes));
    var w = ashCnv.width, h = ashCnv.height;
    ashParticles = [];
    for (var i = 0; i < PERF.ashCount; i++) {
      ashParticles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.26,
        vy: -0.12 - Math.random() * 0.26,
        size: Math.random() < 0.62 ? 1 : (Math.random() < 0.5 ? 1.5 : 2),
        phase: Math.random() * 6.283,
        b: 24 + Math.random() * 56,
        red: Math.random() < 0.12
      });
    }
  }
  function frameAsh(t) {
    if (!ashCtx) return;
    var w = ashCnv.width, h = ashCnv.height;
    ashCtx.clearRect(0, 0, w, h);
    var s = t / 1000;
    for (var i = 0; i < ashParticles.length; i++) {
      var p = ashParticles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
      if (p.x < -4) p.x = w + 4;
      if (p.x > w + 4) p.x = -4;
      var tw = 0.5 + 0.5 * Math.sin(s * 1.9 + p.phase);
      var b = Math.max(5, Math.min(180, p.b * (0.45 + 0.55 * tw))) | 0;
      ashCtx.fillStyle = p.red
        ? "rgb(" + b + "," + ((b * 0.24) | 0) + "," + ((b * 0.24) | 0) + ")"
        : "rgb(" + b + "," + ((b * 0.69) | 0) + "," + ((b * 0.13) | 0) + ")";
      ashCtx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
  function ashLoop(t) {
    if (!ashWant) { ashRaf = null; return; }
    if (document.hidden) { ashLast = 0; ashRaf = requestAnimationFrame(ashLoop); return; }
    if (!ashLast) ashLast = t;
    if (t - ashLast >= 33) { ashLast = t; frameAsh(t); }
    ashRaf = requestAnimationFrame(ashLoop);
  }

  function startGrain() {
    if (grainTimer || !grainCtx) return;
    frameGrain(false);
    grainTimer = setInterval(function () { if (!document.hidden) frameGrain(false); }, PERF.grainMs);
  }
  function stopGrain() {
    if (grainTimer) { clearInterval(grainTimer); grainTimer = null; }
    if (grainCtx && grainCnv) grainCtx.clearRect(0, 0, grainCnv.width, grainCnv.height);
  }
  function startAsh() {
    ashWant = true;
    if (ashRaf || !ashCtx) return;
    ashLast = 0;
    // paint one frame up front so the motes are there even if rAF is
    // throttled hard (background tab, headless, reduced power mode)
    frameAsh(performance.now());
    ashRaf = requestAnimationFrame(ashLoop);
  }
  function stopAsh() {
    ashWant = false;
    if (ashRaf) { cancelAnimationFrame(ashRaf); ashRaf = null; }
    if (ashCtx && ashCnv) ashCtx.clearRect(0, 0, ashCnv.width, ashCnv.height);
  }

  function crtRoll() {
    if (!crt || !crtOn || !motionOk || document.hidden) return;
    crt.classList.remove("roll");
    void crt.offsetWidth;
    crt.classList.add("roll");
    setTimeout(function () { if (crt) crt.classList.remove("roll"); }, 460);
  }

  function setCrt(on, persist) {
    crtOn = !!on;
    if (persist) { try { localStorage.setItem("tqg-st-crt", crtOn ? "on" : "off"); } catch (e) {} }
    document.body.classList.toggle("no-crt", !crtOn);
    var tag = $("#crtTag");
    if (tag) {
      tag.classList.toggle("on", crtOn);
      tag.title = crtOn ? "CRT LAYER ON — TYPE CRT TO DROP IT" : "CRT LAYER OFF — TYPE CRT TO RESTORE IT";
    }
    if (crtOn && motionOk) { startGrain(); startAsh(); }
    else { stopGrain(); stopAsh(); }
    return crtOn;
  }

  function initFx() {
    if (grainCnv) { try { grainCtx = grainCnv.getContext("2d"); } catch (e) { grainCtx = null; } }
    if (ashCnv) { try { ashCtx = ashCnv.getContext("2d"); } catch (e) { ashCtx = null; } }
    sizeGrain(); sizeAsh();
    setCrt(crtOn, false);
    // occasional interference: one brighter grain frame plus a roll
    setInterval(function () {
      if (!fxLive() || Math.random() > 0.3) return;
      frameGrain(true);
      crtRoll();
    }, 11000);
  }
  var crtTag = $("#crtTag");
  if (crtTag) {
    crtTag.addEventListener("click", function () {
      setCrt(!crtOn, true);
      click();
      logLine("A:\\> CRT LAYER: " + (crtOn ? "ON" : "OFF"));
    });
  }

  /* --------------------------------------------------------------
     Reveal — the site assembles itself as you read it.
     Driven off the .views scroll container rather than an
     IntersectionObserver because inactive views are display:none,
     and a hidden element never intersects anything.
     -------------------------------------------------------------- */
  var viewsEl = $("#views");
  function checkReveals() {
    if (!motionOk) return;
    var v = $(".view.active");
    if (!v) return;
    var box = viewsEl ? viewsEl.getBoundingClientRect() : { bottom: window.innerHeight };
    var items = v.querySelectorAll(".reveal:not(.in)");
    for (var i = 0; i < items.length; i++) {
      if (items[i].getBoundingClientRect().top < box.bottom - 28) items[i].classList.add("in");
    }
  }
  function armReveals() {
    if (!motionOk) return;
    var v = $(".view.active");
    if (!v) return;
    Array.prototype.forEach.call(v.children, function (el) {
      if (!el.classList || el.classList.contains("view")) return;
      el.classList.add("reveal");
      el.classList.remove("in");
    });
    requestAnimationFrame(checkReveals);
    setTimeout(checkReveals, 700);
  }
  var revealQueued = false;
  function queueReveal() {
    if (revealQueued) return;
    revealQueued = true;
    requestAnimationFrame(function () { revealQueued = false; checkReveals(); });
  }
  if (viewsEl) viewsEl.addEventListener("scroll", queueReveal, { passive: true });
  // safety net — nothing may be left invisible if a listener is missed
  setInterval(checkReveals, 1500);

  // Status bar lives on
  setInterval(function () {
    if (!powered) return;
    var d = new Date();
    statusR.textContent = "CONNECTED 2400 BPS · " +
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0") + ":" +
      String(d.getSeconds()).padStart(2, "0");
  }, 1000);

  showView("home", true);
  reflectPlatform();
  initFx();
  armReveals();

  var fxResizeT = null;
  window.addEventListener("resize", function () {
    clearTimeout(fxResizeT);
    fxResizeT = setTimeout(function () {
      sizeGrain();
      sizeAsh();
      queueReveal();
    }, 180);
  });

  powerOn(); // it boots itself
})();
