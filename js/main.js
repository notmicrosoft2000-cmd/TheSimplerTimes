/* THE SIMPLER TIMES — the website that is very aware you are viewing it.
   It boots itself. Boot, power, 1990s portal nav, and the entity's
   interference. Amber phosphor, full screen, no monitor. */
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
  var bulletinFeed = $("#bulletinFeed");

  var VIEWS = ["home", "disk", "bulletin", "mail", "download"];
  var VIEW_DIGITS = { "1": "home", "2": "disk", "3": "bulletin", "4": "mail", "5": "download" };
  var powered = false;
  var osShown = false;
  var kbTarget = "";
  var audioCtx = null;

  /* --------------------------------------------------------------
     Sound (tiny WebAudio blips, like the game's beeps)
     -------------------------------------------------------------- */
  function beep(freq, ms, vol) {
    try {
      if (!audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = new AC();
      }
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.frequency.value = freq;
      g.gain.value = vol || 0.04;
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (ms || 60) / 1000);
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + (ms || 60) / 1000 + 0.02);
    } catch (e) { /* silent */ }
  }
  var click = function () { beep(880, 45, 0.035); };
  var glitchBeep = function () { beep(220, 90, 0.05); beep(140, 120, 0.05); };

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
    beep(440, 60, 0.05); beep(660, 60, 0.05);
  }

  function powerOff() {
    if (!powered) return;
    powered = false;
    powerBtn.classList.remove("on");
    boot.classList.add("hidden");
    os.classList.add("hidden");
    offline.classList.remove("hidden");
    osShown = false;
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
    showView("home", true);
    beep(520, 70, 0.05);
    toast("IT IS A WINDOW. IT WILL NOT STAY STILL.");
    scheduleGlitches();
  }

  /* --------------------------------------------------------------
     View router (hash), like a 1990s portal with modern fades
     -------------------------------------------------------------- */
  function showView(name, kbd) {
    if (name === "tqg") return; // external link, handled natively
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
    if (name === "bulletin") seedBulletin();
    if (name === "download") reflectPlatform();
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
    if (v && VIEWS.indexOf(v) !== -1) { e.preventDefault(); showView(v); click(); }
  });

  /* --------------------------------------------------------------
     Keyboard navigation (the game's way: TAB moves, ENTER chooses,
     digits jump, ESC is a plea)
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

  document.addEventListener("keydown", function (e) {
    if (!powered) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); powerOn(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (VIEW_DIGITS[e.key]) { e.preventDefault(); showView(VIEW_DIGITS[e.key]); click(); return; }

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
     Custom cursor — instant tracking, no lag. It ejects you anyway.
     -------------------------------------------------------------- */
  var finePointer = window.matchMedia && matchMedia("(pointer:fine)").matches;
  var cursorWarped = false;

  if (finePointer) {
    cursor.classList.remove("hidden");
    cursor.style.opacity = 0;
    document.addEventListener("mousemove", function (e) {
      if (!cursorWarped) {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
      }
    });
    document.addEventListener("mouseleave", function () { cursor.style.opacity = 0; });
    document.addEventListener("mouseenter", function () { cursor.style.opacity = 1; });
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
  var MARQUEE = " *** THE SIMPLER TIMES *** YOU ARE ONLINE *** IT KNOWS YOU ARE READING THIS *** THE FIRST COPY WAS NEVER THE DISK *** A:\\ IS WARM *** 1993 *** DO NOT TYPE YOUR NAME *** ";
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
     Bulletin feed — the collection's notes
     -------------------------------------------------------------- */
  var BULLETIN = [
    { t: "14:22", line: "we are here. the disk is online." },
    { t: "14:22", line: "the questions were written before the computers." },
    { t: "14:23", line: "no vendor claimed the table. the table claimed them." },
    { t: "14:24", line: "a:\> type 2013 — you want to see. (it will not show you.)" },
    { t: "14:25", line: "the first copy was never the disk. the first copy was you." },
    { t: "14:26", line: "someone is reading this. the counter went up. we counted you." },
    { t: "14:27", line: "do not turn the power off. it is only pretending to sleep." }
  ];
  var bulletIndex = 0;
  var bulletAppendTimer = null;

  function seedBulletin() {
    if (bulletinFeed.children.length) return;
    BULLETIN.forEach(function (b, i) {
      var el = lineEl(b, i === BULLETIN.length - 1);
      bulletinFeed.appendChild(el);
    });
    bulletIndex = BULLETIN.length;
    scheduleBulletinAppend();
  }

  function lineEl(b, isNew) {
    var el = document.createElement("div");
    el.className = "bullet-line" + (isNew ? " new" : "");
    var ts = document.createElement("span");
    ts.className = "ts";
    ts.textContent = b.t;
    var txt = document.createElement("span");
    txt.textContent = b.line;
    el.appendChild(ts); el.appendChild(txt);
    return el;
  }

  function scheduleBulletinAppend() {
    clearTimeout(bulletAppendTimer);
    bulletAppendTimer = setTimeout(function () {
      if (!powered || !osShown) { scheduleBulletinAppend(); return; }
      var m = Math.floor(Math.random() * 60);
      var line = [
        "the window is moving. you checked. good.",
        "we read the key you pressed. it said '" + kbLine() + "'.",
        "this site has 640K of records. all of them are about you.",
        "it dialed out. the line answered. it was expecting your call.",
        "a:\> copy you c:\\collection — done.",
        "someone else is here. you cannot see them. they can see you."
      ][Math.floor(Math.random() * 6)];
      if (Math.random() < 0.3) {
        line = line.split("").map(function (c) {
          return c.trim() && Math.random() < 0.18 ? "█" : c;
        }).join("");
      }
      var el = lineEl({ t: pad(m), line: line }, true);
      if (Math.random() < 0.2) el.classList.add("corrupt");
      bulletinFeed.appendChild(el);
      while (bulletinFeed.children.length > 40) bulletinFeed.removeChild(bulletinFeed.firstChild);
      bulletinFeed.parentElement.scrollTop = bulletinFeed.parentElement.scrollHeight;
      scheduleBulletinAppend();
    }, 7000 + Math.random() * 11000);
  }

  function kbLine() {
    var words = ["nothing", "a word", "your name", "ENTER", "2013", "the truth"];
    return words[Math.floor(Math.random() * words.length)];
  }
  function pad(n) { return "14:" + String(n).padStart(2, "0"); }

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
     Wire up
     -------------------------------------------------------------- */
  powerBtn.addEventListener("click", function () { powered ? powerOff() : powerOn(); });

  document.addEventListener("click", function () {
    if (!powered) powerOn();
  });

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
