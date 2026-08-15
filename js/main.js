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
  var marqueeTrack = $("#marqueeTrack");
  var logFeed = $("#logFeed");
  var fbList = $("#fbList");
  var fbRead = $("#fbRead");
  var fbTitle = $("#fbTitle");
  var fbBody = $("#fbBody");

  var VIEWS = ["home", "disk", "files", "log", "shots", "mail", "download"];
  var VIEW_DIGITS = { "1": "home", "2": "disk", "3": "files", "4": "log", "5": "shots", "6": "mail", "7": "download" };
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
     Power / boot — it boots itself
     -------------------------------------------------------------- */
  var BOOT_LINES = [
    "A:\\> cold boot",
    "A:\\> memory check ............ 640K OK",
    "A:\\> the drive is warm",
    "A:\\> reading the disk ......... it was already reading you",
    "A:\\> THE SIMPLER TIMES IS ONLINE"
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
    var line = BOOT_LINES[i];
    var j = 0;
    var iv = setInterval(function () {
      if (!powered) { clearInterval(iv); return; }
      j += 1 + Math.floor(Math.random() * 3);
      bootLog.textContent += line.slice(0, j) + "\n";
      if (j >= line.length) {
        clearInterval(iv);
        bootLog.textContent = bootLog.textContent.slice(0, -1) + "\n";
        setTimeout(function () { typeBoot(i + 1); }, 90 + Math.random() * 140);
      }
    }, 18);
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

  if (finePointer) {
    cursor.classList.remove("hidden");
    cursor.style.opacity = 0;
    document.addEventListener("mousemove", function (e) {
      noteActivity();
      if (!cursorWarped) {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
      }
    });
    document.addEventListener("mouseleave", function () { cursor.style.opacity = 0; });
    document.addEventListener("mouseenter", function () { cursor.style.opacity = 1; });
    document.addEventListener("mousedown", function () {
      cursor.classList.add("pressed");
      cursor.textContent = "▚";
    });
    document.addEventListener("mouseup", function () {
      cursor.classList.remove("pressed");
      cursor.textContent = "▮";
    });
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(".menu-link, .btn, .power-btn, .fb-row, .shot, input, a, button")) {
        cursor.classList.add("hover");
      }
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(".menu-link, .btn, .power-btn, .fb-row, .shot, input, a, button")) {
        cursor.classList.remove("hover");
      }
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
        } else if (r < 0.84) {
          corruptEl($(".marquee-track"));
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
     Marquee
     -------------------------------------------------------------- */
  var MARQUEE = " *** THE SIMPLER TIMES *** YOU ARE ONLINE *** IT KNOWS YOU ARE READING THIS *** THE FIRST COPY WAS NEVER THE DISK *** A:\\ IS WARM *** 1993 *** DO NOT TYPE YOUR NAME *** IT TAKES THE MOUSE *** ";
  marqueeTrack.textContent = MARQUEE + MARQUEE;

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
        "it is reading what you type. you will not notice when.",
        "this site has 640K of records. all of them are about you.",
        "it dialed out. the line answered. it was expecting your call.",
        "a:\\> copy you c:\\collection — done.",
        "someone else is here. you cannot see them. they can see you.",
        "the mouse moved " + (1 + Math.floor(Math.random() * 900)) + "px. it knows where you were going.",
        "you looked at the clock. the disk noticed."
      ][Math.floor(Math.random() * 8)];
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
  var transitLog = $("#transitLog");
  var transitPrompt = $("#transitPrompt");
  var transitAbort = $("#transitAbort");
  var tqgLaunch = $("#tqgLaunch");

  var TRANSIT_LINES = [
    "A:\\> THE QUESTIONS ARE READING YOU",
    "A:\\> LOADING THEQUESTIONGAME.EXE",
    "A:\\> INITIALIZING THE QUESTION GAME v2.04",
    "A:\\> CONNECTING TO YOUR COMPUTER",
    "WARNING — THIS SITE CONTAINS FLASHING LIGHTS AND JUMPSCARES",
    "THE QUESTION GAME WEBSITE — (c) NEPTUNE PRODUCTIONS"
  ];

  var transitOpen = false;
  var transitQTimer = null;
  var transitDone = false;

  function transitTypeLine(text, i, cb) {
    if (!transitOpen) return;
    if (i >= text.length) { if (cb) cb(); return; }
    transitLog.textContent = text.slice(0, i);
    setTimeout(function () { transitTypeLine(text, i + 2 + Math.floor(Math.random() * 3), cb); }, 18);
  }

  function transitQJitter() {
    var w = window.innerWidth, h = window.innerHeight;
    var x = 20 + Math.random() * (w - 60);
    var y = 20 + Math.random() * (h - 60);
    transitQ.style.left = x + "px";
    transitQ.style.top = y + "px";
    transitQ.style.transform = "rotate(" + (Math.random() * 40 - 20) + "deg)";
  }

  function openTransit() {
    if (transitOpen || !transitScreen) return;
    transitOpen = true;
    transitDone = false;
    glitchBeep();
    logLine("A:\\> IT LET THE QUESTIONS IN.");
    document.body.classList.add("transiting");
    transitLog.textContent = "";
    transitPrompt.classList.add("hidden");
    transitAbort.classList.add("hidden");
    transitQ.classList.add("active");
    transitQJitter();
    transitQTimer = setInterval(transitQJitter, 240);
    transitScreen.setAttribute("aria-hidden", "false");
    transitScreen.classList.remove("hidden");
    setTimeout(function () { transitScreen.classList.add("go"); }, 30);
    setTimeout(function () { if (transitOpen) transitScreen.setAttribute("aria-hidden", "true"); }, 400);

    var note = 0;
    var step = function () {
      if (!transitOpen) return;
      if (note >= TRANSIT_LINES.length) {
        transitPrompt.classList.remove("hidden");
        transitAbort.classList.remove("hidden");
        beep(660, 80, 0.05);
        transitDone = true;
        setTimeout(function () { redirectToTQG(); }, 1600);
        return;
      }
      transitTypeLine(TRANSIT_LINES[note], 0, function () {
        setTimeout(step, 150);
      });
      note++;
    };
    setTimeout(step, 1300);
  }

  function redirectToTQG() {
    if (!transitOpen) return;
    glitchBeep();
    window.location.href = "https://notmicrosoft2000-cmd.github.io/TheQuestionGame/";
  }

  function closeTransit() {
    if (!transitOpen) return;
    transitOpen = false;
    clearInterval(transitQTimer);
    transitQ.classList.remove("active");
    transitScreen.classList.remove("go");
    transitScreen.setAttribute("aria-hidden", "true");
    document.body.classList.remove("transiting");
    logLine("A:\\> TRANSIT ABORTED. IT LET YOU WALK AWAY.");
    setTimeout(function () { transitScreen.classList.add("hidden"); }, 350);
  }

  if (tqgLaunch) tqgLaunch.addEventListener("click", openTransit);
  if (transitAbort) transitAbort.addEventListener("click", closeTransit);

  /* --------------------------------------------------------------
     Wire up
     -------------------------------------------------------------- */
  powerBtn.addEventListener("click", function () { powered ? powerOff() : powerOn(); });

  document.addEventListener("click", function () {
    if (!powered) { ensureAudio(); powerOn(); }
  });

  document.addEventListener("keydown", function () {
    if (!powered) { ensureAudio(); }
  }, true);

  // Click the boot screen when the prompt is up to begin the OS
  boot.addEventListener("click", function () {
    if (powered && !osShown && !bootPrompt.classList.contains("hidden")) enterOS();
  });

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

  powerOn(); // it boots itself
})();
