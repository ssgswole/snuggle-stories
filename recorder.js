/* Snuggle Stories: "Record yourself reading" (part of the full version).
   A grown-up reads the current story aloud from a calm teleprompter, line by line. Audio is recorded
   with MediaRecorder and saved ONLY on this device (IndexedDB). Nothing is uploaded, ever.
   Children replay the stories from "My recordings" with the same follow-along highlighting.

   Recording model: a recording is a list of "takes". A take runs from Record to Pause; each take
   remembers when every line started (marks), so playback can highlight the right sentence and
   "Redo last part" can throw away just the last take. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var A = window.SnuggleApp;
  if (!A) return;
  var $ = function (s) { return document.querySelector(s); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ":" + ("0" + (sec % 60)).slice(-2); }
  function mb(bytes) { return bytes < 1e6 ? Math.max(1, Math.round(bytes / 1e3)) + " KB" : bytes < 1e9 ? (bytes / 1e6).toFixed(1) + " MB" : (bytes / 1e9).toFixed(1) + " GB"; }

  var UA = navigator.userAgent || "";
  var IS_IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var IS_ANDROID = /Android/i.test(UA);
  var IS_NATIVE = document.documentElement.classList.contains("native-app");
  var IS_APPLE = IS_IOS || (/Macintosh/.test(UA) && /Safari/.test(UA) && !/Chrome|Chromium|Edg/.test(UA));

  /* ---------------- Storage (IndexedDB, this device only) ---------------- */
  var DB_NAME = "snuggle-recordings", STORE = "recordings", dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error("no-indexeddb")); return; }
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: "id" }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  function run(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), st = t.objectStore(STORE), out;
        var req = fn(st);
        if (req) req.onsuccess = function () { out = req.result; };
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(t.error || new Error("db")); };
      });
    });
  }
  var Store = {
    all: function () { return run("readonly", function (st) { return st.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return b.date < a.date ? -1 : 1; }); }); },
    get: function (id) { return run("readonly", function (st) { return st.get(id); }); },
    put: function (rec) { return run("readwrite", function (st) { return st.put(rec); }); },
    del: function (id) { return run("readwrite", function (st) { return st["delete"](id); }); }
  };

  /* ---------------- Microphone ---------------- */
  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    var prefs = IS_APPLE ? ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm"]
                         : ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    for (var i = 0; i < prefs.length; i++) if (MediaRecorder.isTypeSupported(prefs[i])) return prefs[i];
    return "";
  }
  function deniedHint() {
    if (IS_NATIVE && IS_IOS) return "To allow it: open the iPhone Settings app › Snuggle Stories › turn on Microphone. Then try again.";
    if (IS_NATIVE && IS_ANDROID) return "To allow it: press and hold the Snuggle Stories icon › App info › Permissions › Microphone › Allow. Then try again.";
    if (IS_IOS) return "To allow it: in Safari tap the “aA” button › Website Settings › Microphone › Allow (for the home-screen app: Settings › Apps › Safari › Microphone). Then try again.";
    if (IS_ANDROID) return "To allow it: tap the icon left of the web address › Permissions › Microphone › Allow. Then try again.";
    return "To allow it: click the icon left of the web address, allow the microphone for this site, then try again.";
  }
  function micErrorText(err) {
    var n = err && err.name;
    if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError")
      return "👪 The microphone is turned off for Snuggle Stories. " + deniedHint();
    if (n === "NotFoundError" || n === "DevicesNotFoundError") return "👪 No microphone was found. Plug one in or try on a phone.";
    if (n === "NotReadableError") return "👪 Another app is using the microphone. Close it and try again.";
    if (n === "unsupported") return "👪 This browser can't record audio. Try Safari on iPhone/iPad, or Chrome.";
    return "👪 The microphone couldn't start. Please try again.";
  }

  /* ---------------- Studio (recording screen) ---------------- */
  var S = null;   // studio session
  function newSession() {
    var story = A.story();
    return { story: story, script: A.script(), idx: 0, takes: [], rec: null, take: null, stream: null,
      ctx: null, analyser: null, raf: 0, saved: false, level: 0, voiced: 0, quietSince: 0 };
  }

  function openStudio() {
    if (!A.story()) return;
    A.stopSpeech();
    S = newSession();
    $("#studio-title").textContent = S.story.title;
    $("#studio-msg").textContent = "";
    $("#studio-msg").className = "studio-msg";
    $("#studio").hidden = false;
    document.body.classList.add("screen-open");
    renderStudio();
    setTimeout(function () { $("#rec-btn").focus(); }, 50);
  }

  function recordedSeconds() {
    var t = S.takes.reduce(function (a, k) { return a + k.dur; }, 0);
    if (S.take) t += (performance.now() - S.take.t0) / 1000;
    return t;
  }

  function renderStudio() {
    if (!S) return;
    var sc = S.script, i = S.idx, cur = sc[i] || { text: "", kind: "para" };
    $("#tp-prev").textContent = i > 0 ? sc[i - 1].text : "";
    var c = $("#tp-cur"); c.textContent = cur.text; c.className = "tp-cur tp-" + cur.kind;
    $("#tp-next").textContent = sc[i + 1] ? sc[i + 1].text : "The End";
    $("#tp-pos").textContent = "Line " + (i + 1) + " of " + sc.length;
    $("#tp-bar").style.width = Math.round(100 * (i + (S.take ? 0.5 : 0)) / sc.length) + "%";
    var recording = !!S.take;
    var rb = $("#rec-btn");
    rb.classList.toggle("is-rec", recording);
    rb.innerHTML = recording ? '<span aria-hidden="true">⏸️</span> Pause' : (S.takes.length ? '<span aria-hidden="true">🔴</span> Keep recording' : '<span aria-hidden="true">🔴</span> Start recording');
    $("#tp-back").disabled = recording || i === 0;
    $("#tp-next-btn").disabled = i >= sc.length - 1 && !recording;
    $("#rec-redo").disabled = !recording && !S.takes.length;
    $("#rec-save").disabled = !S.takes.length && !recording;
    $("#rec-time").textContent = fmt(recordedSeconds()) + (S.takes.length ? " · " + S.takes.length + (S.takes.length === 1 ? " part" : " parts") : "");
    $("#studio").classList.toggle("is-recording", recording);
  }

  function getStream() {
    if (S.stream && S.stream.active) return Promise.resolve(S.stream);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      var e = new Error("unsupported"); e.name = "unsupported"; return Promise.reject(e);
    }
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
      .then(function (st) { S.stream = st; startMeter(st); return st; });
  }

  function startMeter(stream) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!S.ctx) S.ctx = new AC();
      if (S.ctx.state === "suspended") S.ctx.resume();
      var src = S.ctx.createMediaStreamSource(stream);
      S.analyser = S.ctx.createAnalyser(); S.analyser.fftSize = 1024;
      src.connect(S.analyser);
      var buf = new Float32Array(S.analyser.fftSize);
      var tick = function () {
        if (!S || !S.analyser) return;
        S.analyser.getFloatTimeDomainData(buf);
        var sum = 0; for (var k = 0; k < buf.length; k++) sum += buf[k] * buf[k];
        var rms = Math.sqrt(sum / buf.length), lvl = Math.min(1, rms * 6);
        S.level = S.level * 0.7 + lvl * 0.3;
        $("#rec-level").style.width = Math.round(S.level * 100) + "%";
        autoTurn(rms);
        if (S.take) $("#rec-time").textContent = fmt(recordedSeconds()) + (S.takes.length ? " · " + S.takes.length + (S.takes.length === 1 ? " part" : " parts") : "");
        S.raf = requestAnimationFrame(tick);
      };
      S.raf = requestAnimationFrame(tick);
    } catch (e) { /* meter is optional */ }
  }

  // Optional: turn to the next line after the grown-up finishes a line and pauses for a moment.
  function autoTurn(rms) {
    if (!S.take || !$("#auto-turn").checked) { S.voiced = 0; S.quietSince = 0; return; }
    var now = performance.now();
    if (rms > 0.02) { S.voiced += 16; S.quietSince = 0; return; }
    if (S.voiced < 500) return;                      // need about half a second of reading first
    if (!S.quietSince) S.quietSince = now;
    if (now - S.quietSince > 1300) { S.voiced = 0; S.quietSince = 0; nextLine(); }
  }

  function startTake() {
    $("#studio-msg").textContent = "";
    var mime = pickMime();
    getStream().then(function (stream) {
      if (!S || S.take) return;
      var rec;
      try { rec = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 }) : new MediaRecorder(stream); }
      catch (e) { rec = new MediaRecorder(stream); }
      var take = { rec: rec, chunks: [], t0: performance.now(), marks: [{ i: S.idx, t: 0 }], mime: rec.mimeType || mime || "audio/webm", discard: false };
      rec.ondataavailable = function (e) { if (e.data && e.data.size) take.chunks.push(e.data); };
      take.done = new Promise(function (res) {
        rec.onstop = function () {
          if (!take.discard && S) {
            var blob = new Blob(take.chunks, { type: take.mime });
            if (blob.size) S.takes.push({ blob: blob, dur: take.dur, marks: take.marks, mime: take.mime });
          }
          res(); if (S) renderStudio();
        };
      });
      S.take = take;
      rec.start(1000);
      renderStudio();
    }, function (err) {
      var m = $("#studio-msg"); m.textContent = micErrorText(err); m.className = "studio-msg warn";
    });
  }

  function endTake(discard) {
    if (!S || !S.take) return Promise.resolve();
    var take = S.take; S.take = null;
    take.dur = (performance.now() - take.t0) / 1000;
    take.discard = !!discard;
    try { if (take.rec.state !== "inactive") take.rec.stop(); else take.rec.onstop(); } catch (e) { take.rec.onstop && take.rec.onstop(); }
    renderStudio();
    return take.done;
  }

  function toggleRecord() { if (!S) return; if (S.take) endTake(false); else startTake(); }

  function nextLine() {
    if (!S) return;
    if (S.idx >= S.script.length - 1) {
      if (S.take) { endTake(false).then(function () { flash("🎉 That's the whole story! Tap Save to keep it."); }); }
      return;
    }
    S.idx++;
    if (S.take) S.take.marks.push({ i: S.idx, t: (performance.now() - S.take.t0) / 1000 });
    renderStudio();
  }
  function prevLine() { if (!S || S.take || S.idx === 0) return; S.idx--; renderStudio(); }

  function redo() {
    if (!S) return;
    if (S.take) { var start = S.take.marks[0].i; endTake(true).then(function () { S.idx = start; renderStudio(); flash("Okay! Let's try that part again."); }); return; }
    var last = S.takes.pop();
    if (last) { S.idx = last.marks[0].i; renderStudio(); flash("Removed the last part. Read it again when you're ready."); }
  }

  function flash(t) { var m = $("#studio-msg"); m.textContent = t; m.className = "studio-msg"; }

  function save() {
    if (!S) return;
    var go = S.take ? endTake(false) : Promise.resolve();
    go.then(function () {
      if (!S.takes.length) { flash("Record at least one line first."); return; }
      $("#rec-save").disabled = true;
      flash("Saving on this device…");
      return Promise.all(S.takes.map(function (k) { return blobToBuffer(k.blob); })).then(function (bufs) {
        var st = S.story, size = 0;
        var rec = {
          id: "rec-" + Date.now() + "-" + Math.floor(Math.random() * 1e6),
          title: st.title, hero: st.hero, theme: st.theme, emoji: st.emoji, seed: st.seed,
          name: "", date: new Date().toISOString(),
          duration: S.takes.reduce(function (a, k) { return a + k.dur; }, 0),
          script: S.script.map(function (l) { return { text: l.text, kind: l.kind, seg: l.seg }; }),
          takes: S.takes.map(function (k, n) { size += bufs[n].byteLength; return { data: bufs[n], mime: k.mime, dur: k.dur, marks: k.marks }; })
        };
        rec.size = size;
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
        return Store.put(rec).then(function () {
          S.saved = true;
          flash("💛 Saved on this device! Find it in “My recordings”.");
          $("#rec-save").disabled = true;
          refreshShelfButton();
          setTimeout(function () { if (S && S.saved) { closeStudio(true); openShelf(rec.id); } }, 1200);
        });
      }).catch(function (e) {
        var m = $("#studio-msg"); m.className = "studio-msg warn";
        m.textContent = "👪 Couldn't save (the device may be out of space or in private browsing). " + (e && e.message ? "" : "");
        renderStudio();
      });
    });
  }
  function blobToBuffer(b) {
    if (b.arrayBuffer) return b.arrayBuffer();
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsArrayBuffer(b); });
  }

  function closeStudio(force) {
    if (!S) return;
    if (!force && !S.saved && (S.takes.length || S.take) && !window.confirm("Leave without saving this recording?")) return;
    var s = S;
    if (s.take) { s.take.discard = true; try { s.take.rec.stop(); } catch (e) {} }
    S = null;
    cancelAnimationFrame(s.raf);
    if (s.stream) s.stream.getTracks().forEach(function (t) { t.stop(); });
    if (s.ctx && s.ctx.close) s.ctx.close().catch(function () {});
    $("#studio").hidden = true;
    document.body.classList.remove("screen-open");
  }

  /* ---------------- My recordings (shelf + player) ---------------- */
  var shelfEdit = false, P = null;  // P = player session

  function refreshShelfButton() {
    var b = $("#shelf-open"); if (!b) return Promise.resolve();
    return Store.all().then(function (l) {
      b.hidden = !l.length && !A.isUnlocked();
      $("#shelf-count").textContent = l.length ? "(" + l.length + ")" : "";
      return l;
    }, function () { b.hidden = true; return []; });
  }

  function openShelf(playId) {
    A.stopSpeech();
    shelfEdit = false;
    $("#shelf").hidden = false;
    document.body.classList.add("screen-open");
    renderShelf().then(function () { if (playId) openPlayer(playId); });
  }
  function closeShelf() { closePlayer(); $("#shelf").hidden = true; document.body.classList.remove("screen-open"); refreshShelfButton(); }

  function renderShelf() {
    $("#shelf-list-view").hidden = false; $("#player-view").hidden = true;
    $("#shelf-edit").textContent = shelfEdit ? "✓ Done editing" : "👪 Grown-ups: rename or delete";
    return Store.all().then(function (list) {
      var ul = $("#shelf-list"); ul.innerHTML = "";
      $("#shelf-empty").hidden = !!list.length;
      $("#shelf-edit").hidden = !list.length;
      var total = 0;
      list.forEach(function (r) {
        total += r.size || 0;
        var li = el("li", "rec-card");
        var play = el("button", "rec-play"); play.type = "button";
        play.appendChild(el("span", "rec-emoji", r.emoji || "📖")).setAttribute("aria-hidden", "true");
        var txt = el("span", "rec-text");
        txt.appendChild(el("span", "rec-title", r.title));
        txt.appendChild(el("span", "rec-sub", "Read by " + (r.name || "a grown-up") + " · " + new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + fmt(r.duration)));
        play.appendChild(txt);
        play.appendChild(el("span", "rec-go", "▶️")).setAttribute("aria-hidden", "true");
        play.setAttribute("aria-label", "Play " + r.title);
        play.addEventListener("click", function () { if (!shelfEdit) openPlayer(r.id); });
        li.appendChild(play);
        if (shelfEdit) {
          var ed = el("div", "rec-edit");
          var inp = el("input"); inp.type = "text"; inp.maxLength = 30; inp.value = r.name || ""; inp.placeholder = "Read by… (e.g. Mommy, Grandpa)";
          inp.setAttribute("aria-label", "Who read " + r.title);
          var sv = el("button", "btn btn-small", "💾 Save name"); sv.type = "button";
          sv.addEventListener("click", function () { r.name = inp.value.replace(/[<>]/g, "").trim().slice(0, 30); Store.put(r).then(renderShelf); });
          var del = el("button", "btn btn-small btn-danger", "🗑️ Delete"); del.type = "button";
          del.addEventListener("click", function () {
            if (!window.confirm("Delete “" + r.title + "”? This can't be undone.")) return;
            Store.del(r.id).then(function () { renderShelf(); refreshShelfButton(); });
          });
          ed.appendChild(inp); ed.appendChild(sv); ed.appendChild(del);
          li.appendChild(ed);
        }
        ul.appendChild(li);
      });
      var st = $("#shelf-storage");
      st.textContent = list.length ? "💾 Recordings use " + mb(total) + " on this device. They're never uploaded." : "";
      if (list.length && navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) {
        if (e && e.quota) st.textContent += " (Space left for the app: about " + mb(Math.max(0, e.quota - (e.usage || 0))) + ".)";
      }).catch(function () {});
    }, function () {
      $("#shelf-empty").hidden = false;
      $("#shelf-empty").textContent = "Recordings aren't available in this browser mode (private browsing?).";
    });
  }

  function openPlayer(id) {
    Store.get(id).then(function (r) {
      if (!r) return;
      closePlayer();
      $("#shelf-list-view").hidden = true; $("#player-view").hidden = false;
      var starts = [], acc = 0;
      r.takes.forEach(function (k) { starts.push(acc); acc += k.dur; });
      var lines = [];   // {i, T}
      r.takes.forEach(function (k, n) { k.marks.forEach(function (m) { lines.push({ i: m.i, T: starts[n] + m.t, take: n }); }); });
      lines.sort(function (a, b) { return a.T - b.T; });
      P = { rec: r, urls: r.takes.map(function (k) { return URL.createObjectURL(new Blob([k.data], { type: k.mime })); }),
        starts: starts, total: acc, lines: lines, take: 0, playing: false, spans: [], audio: $("#player-audio"), raf: 0, cur: -1 };
      $("#player-title").textContent = r.title;
      $("#player-sub").textContent = "Read by " + (r.name || "a grown-up");
      // story text with one span per line
      var book = $("#player-text"); book.innerHTML = "";
      var lastSeg = null, p = null;
      r.script.forEach(function (l, i) {
        var span;
        if (l.kind === "title") { span = el("h3", "pl-title", l.text); book.appendChild(span); p = null; }
        else if (l.kind === "heading") { span = el("h4", "pl-heading", l.text); book.appendChild(span); p = null; }
        else {
          if (!p || l.seg !== lastSeg) { p = el("p", "pl-para"); book.appendChild(p); }
          span = el("span", "sent", l.text + " "); p.appendChild(span);
        }
        lastSeg = l.seg;
        var hasLine = lines.filter(function (x) { return x.i === i; })[0];
        if (hasLine) { span.classList.add("pl-tap"); span.addEventListener("click", function () { seek(hasLine.T + 0.01, true); }); }
        else span.classList.add("pl-unread");
        P.spans[i] = span;
      });
      $("#pl-seek").max = Math.max(0.1, acc).toFixed(2); $("#pl-seek").value = 0;
      $("#pl-total").textContent = fmt(acc); $("#pl-now").textContent = "0:00";
      loadTake(0, 0);
      updatePlayBtn();
      $("#pl-play").focus();
    });
  }

  function loadTake(n, offset, thenPlay) {
    var a = P.audio; P.take = n;
    a.src = P.urls[n];
    var go = function () {
      a.removeEventListener("loadedmetadata", go);
      if (offset > 0.05) { try { a.currentTime = offset; } catch (e) {} }
      if (thenPlay) a.play().catch(function () { P && (P.playing = false, updatePlayBtn()); });
    };
    a.addEventListener("loadedmetadata", go);
    a.load();
  }
  function globalTime() { return P ? P.starts[P.take] + Math.min(P.audio.currentTime || 0, P.rec.takes[P.take].dur) : 0; }
  function seek(T, play) {
    if (!P) return;
    T = Math.max(0, Math.min(T, P.total - 0.05));
    var n = 0; for (var k = 0; k < P.starts.length; k++) if (P.starts[k] <= T) n = k;
    var off = T - P.starts[n];
    if (play) P.playing = true;
    if (n !== P.take) loadTake(n, off, P.playing);
    else { try { P.audio.currentTime = off; } catch (e) {} if (P.playing && P.audio.paused) P.audio.play().catch(function () {}); }
    tickPlayer(true); updatePlayBtn();
  }
  function togglePlay() {
    if (!P) return;
    if (P.playing) { P.playing = false; P.audio.pause(); }
    else {
      if (globalTime() >= P.total - 0.1) seek(0);
      P.playing = true; P.audio.play().catch(function () { P.playing = false; updatePlayBtn(); });
      loop();
    }
    updatePlayBtn();
  }
  function updatePlayBtn() {
    if (!P) return;
    $("#pl-play").innerHTML = P.playing ? '<span aria-hidden="true">⏸️</span> Pause' : '<span aria-hidden="true">▶️</span> Play';
    $("#pl-play").classList.toggle("is-playing", P.playing);
  }
  function loop() { if (!P) return; cancelAnimationFrame(P.raf); var f = function () { if (!P || !P.playing) return; tickPlayer(); P.raf = requestAnimationFrame(f); }; P.raf = requestAnimationFrame(f); }
  function tickPlayer(force) {
    if (!P) return;
    var T = globalTime();
    if (!P.scrubbing) $("#pl-seek").value = T.toFixed(2);
    $("#pl-now").textContent = fmt(T);
    var cur = -1;
    for (var k = 0; k < P.lines.length; k++) if (P.lines[k].T <= T + 0.05) cur = P.lines[k].i;
    if (cur !== P.cur || force) {
      if (P.spans[P.cur]) P.spans[P.cur].classList.remove("reading-now");
      P.cur = cur;
      var sp = P.spans[cur];
      if (sp) {
        sp.classList.add("reading-now");
        var r = sp.getBoundingClientRect(), box = $("#player-text").getBoundingClientRect();
        if (r.top < box.top + 10 || r.bottom > box.bottom - 10) sp.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }
  function onEnded() {
    if (!P) return;
    if (P.take < P.urls.length - 1) loadTake(P.take + 1, 0, P.playing);
    else { P.playing = false; updatePlayBtn(); tickPlayer(); $("#pl-now").textContent = fmt(P.total); }
  }
  function closePlayer() {
    if (!P) return;
    cancelAnimationFrame(P.raf);
    P.audio.pause(); P.audio.removeAttribute("src"); try { P.audio.load(); } catch (e) {}
    P.urls.forEach(function (u) { URL.revokeObjectURL(u); });
    P = null;
  }

  /* ---------------- Wiring ---------------- */
  function init() {
    var rb = $("#record-btn");
    if (!rb) return;
    var updateLock = function () { rb.classList.toggle("locked", !A.isUnlocked()); refreshShelfButton(); };
    rb.addEventListener("click", function () {
      if (!A.story()) return;
      if (!A.isUnlocked()) { A.openUpsell({ feature: "record" }); return; }
      A.parentGate("Record yourself reading this story", function () { A.closeModal(); openStudio(); });
    });
    A.onUnlockChange(updateLock); updateLock();
    $("#shelf-open").addEventListener("click", function () { openShelf(); });
    $("#studio-close").addEventListener("click", function () { closeStudio(false); });
    $("#rec-btn").addEventListener("click", toggleRecord);
    $("#tp-next-btn").addEventListener("click", nextLine);
    $("#tp-cur").addEventListener("click", nextLine);
    $("#tp-back").addEventListener("click", prevLine);
    $("#rec-redo").addEventListener("click", redo);
    $("#rec-save").addEventListener("click", save);
    $("#shelf-close").addEventListener("click", closeShelf);
    $("#player-back").addEventListener("click", function () { closePlayer(); renderShelf(); });
    $("#shelf-edit").addEventListener("click", function () {
      if (shelfEdit) { shelfEdit = false; renderShelf(); return; }
      A.parentGate("Rename or delete recordings", function () { A.closeModal(); shelfEdit = true; renderShelf(); });
    });
    $("#pl-play").addEventListener("click", togglePlay);
    var sk = $("#pl-seek");
    sk.addEventListener("input", function () { if (P) { P.scrubbing = true; $("#pl-now").textContent = fmt(+sk.value); } });
    sk.addEventListener("change", function () { if (P) { P.scrubbing = false; seek(+sk.value); } });
    var au = $("#player-audio");
    au.addEventListener("ended", onEnded);
    au.addEventListener("timeupdate", function () { tickPlayer(); });
    au.addEventListener("play", function () { if (P) { P.playing = true; updatePlayBtn(); loop(); } });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !$("#modal-backdrop").hidden) return;
      if (!$("#studio").hidden) closeStudio(false); else if (!$("#shelf").hidden) closeShelf();
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && S && S.take) { endTake(false).then(function () { flash("Paused while the app was in the background. Tap Keep recording to carry on."); }); }
    });
  }

  window.SnuggleRecorder = { store: Store, openStudio: openStudio, openShelf: openShelf, refresh: refreshShelfButton,   // for tests
    state: function () { return S ? { idx: S.idx, takes: S.takes.length, recording: !!S.take, marks: S.takes.map(function (k) { return k.marks; }) } : null; },
    player: function () { return P ? { take: P.take, playing: P.playing, cur: P.cur, total: P.total, T: globalTime() } : null; } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
