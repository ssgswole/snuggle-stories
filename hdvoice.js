/* Snuggle Stories: natural "Storyteller voice (HD)".
   An opt-in, one-time download of a small neural voice (Piper, ~32 MB) plus its runtime (~14 MB) and a
   pronunciation list (~3 MB). After that it runs fully on this device, works offline, and story text is
   never sent anywhere. Falls back to the device's own voices when it can't run. */
(function (root) {
  "use strict";
  var IS_NATIVE = !!(root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform());
  // In the store apps the voice files are fetched from the website once (not bundled, to keep the app small).
  var BASE = IS_NATIVE ? "https://ssgswole.github.io/snuggle-stories/hd/" : new URL("hd/", location.href).href;
  var CODE_BASE = new URL("hd/", location.href).href;     // worker + runtime glue ship with the app itself
  var LS = { loading: "snuggle.hdLoading", crashed: "snuggle.hdCrashed", voice: "snuggle.hdVoice", off: "snuggle.hdOff" };
  var VOICES = [
    { id: "kristin", name: "Kristin", desc: "gentle, warm (American)" },
    { id: "norman", name: "Norman", desc: "calm grandpa voice (American)" },
    { id: "cori", name: "Cori", desc: "soft and clear (British)" }
  ];
  var manifest = null, storeMod = null, worker = null, ready = null, readyVoice = null, seq = 0, pending = {};

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function store() { return storeMod || (storeMod = import(CODE_BASE + "hd-store.mjs")); }
  function getManifest() {
    if (manifest) return Promise.resolve(manifest);
    return fetch(CODE_BASE + "manifest.json").then(function (r) { if (!r.ok) throw new Error("manifest " + r.status); return r.json(); })
      .then(function (m) { manifest = m; return m; });
  }

  // ---------- Can this device run it? ----------
  var SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
  function support() {
    var why = [];
    if (typeof WebAssembly !== "object") why.push("no WebAssembly");
    else { try { if (!WebAssembly.validate(SIMD)) why.push("no WebAssembly SIMD (needs iOS 16.4+ / a recent browser)"); } catch (e) { why.push("no WebAssembly SIMD"); } }
    if (typeof Worker === "undefined") why.push("no Web Workers");
    if (typeof BigInt64Array === "undefined") why.push("browser too old");
    if (!("caches" in root) && !("indexedDB" in root)) why.push("no offline storage");
    var mem = navigator.deviceMemory;
    if (mem && mem < 2) why.push("only " + mem + " GB memory");
    return { ok: !why.length, reasons: why, crashed: ls(LS.crashed) === "1" };
  }

  // ---------- Download (grown-up opt-in) ----------
  function filesFor(m, voice) { return m.common.concat(m.voices[voice] || []); }
  function missing(voice) {
    return Promise.all([getManifest(), store()]).then(function (a) {
      var m = a[0], st = a[1], files = filesFor(m, voice);
      return Promise.all(files.map(function (f) { return st.has(BASE + f.path); })).then(function (have) {
        return files.filter(function (f, i) { return !have[i]; });
      });
    });
  }
  function isDownloaded(voice) { return missing(voice).then(function (l) { return l.length === 0; }).catch(function () { return false; }); }
  function downloadedVoices() {
    return Promise.all(VOICES.map(function (v) { return isDownloaded(v.id); }))
      .then(function (ok) { return VOICES.filter(function (v, i) { return ok[i]; }).map(function (v) { return v.id; }); });
  }
  function sizeOf(voice, onlyMissing) {
    return (onlyMissing ? missing(voice) : getManifest().then(function (m) { return filesFor(m, voice); }))
      .then(function (l) { return l.reduce(function (s, f) { return s + f.size; }, 0); });
  }
  function download(voice, onProgress) {
    return Promise.all([missing(voice), store()]).then(function (a) {
      var todo = a[0], st = a[1], total = todo.reduce(function (s, f) { return s + f.size; }, 0), done = 0;
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      var chain = Promise.resolve();
      todo.forEach(function (f) {
        chain = chain.then(function () {
          return fetch(BASE + f.path, { cache: "no-store" }).then(function (r) {
            if (!r.ok) throw new Error("Download failed (" + r.status + ")");
            var chunks = [], got = 0;
            var finish = function () {
              if (got !== f.size) throw new Error("Download incomplete, please try again");
              return st.put(BASE + f.path, new Blob(chunks, { type: f.type || "application/octet-stream" }));
            };
            if (!r.body || !r.body.getReader) {
              return r.arrayBuffer().then(function (b) { chunks.push(b); got = b.byteLength; done += got; onProgress && onProgress(done, total); return finish(); });
            }
            var rd = r.body.getReader();
            var pump = function () {
              return rd.read().then(function (x) {
                if (x.done) return finish();
                chunks.push(x.value); got += x.value.byteLength; done += x.value.byteLength;
                onProgress && onProgress(Math.min(done, total), total);
                return pump();
              });
            };
            return pump();
          });
        });
      });
      return chain.then(function () { ls(LS.voice, voice); ls(LS.off, null); ls(LS.crashed, null); return voice; });
    });
  }
  function remove() {
    stopWorker();
    return store().then(function (st) { return st.removeAll(); }).then(function () { ls(LS.voice, null); });
  }

  // ---------- Worker ----------
  function stopWorker() {
    if (worker) worker.terminate();
    worker = null; ready = null; readyVoice = null;
    Object.keys(pending).forEach(function (k) { pending[k].reject(new Error("stopped")); });
    pending = {};
  }
  function call(msg, transfer) {
    return new Promise(function (resolve, reject) {
      msg.id = ++seq; pending[msg.id] = { resolve: resolve, reject: reject };
      worker.postMessage(msg, transfer || []);
    });
  }
  function load(voice) {
    if (ready && readyVoice === voice) return ready;
    if (!worker) {
      try { worker = new Worker(CODE_BASE + "hd-worker.mjs", { type: "module" }); }
      catch (e) { return Promise.reject(e); }
      worker.onmessage = function (e) {
        var d = e.data, p = d && pending[d.id];
        if (!p) return;
        delete pending[d.id];
        if (d.ok) p.resolve(d.result); else p.reject(new Error(d.error));
      };
      worker.onerror = function (e) {
        var err = new Error("Voice engine error: " + ((e && e.message) || "unknown"));
        Object.keys(pending).forEach(function (k) { pending[k].reject(err); });
        pending = {}; worker = null; ready = null; readyVoice = null;
      };
    }
    readyVoice = voice;
    ls(LS.loading, String(Date.now()));       // if the page dies while loading (out of memory), we'll know next time
    ready = call({ type: "init", base: BASE, voice: voice }).then(function (r) { ls(LS.loading, null); return r; }, function (err) {
      ls(LS.loading, null); ready = null; readyVoice = null; throw err;
    });
    return ready;
  }
  function synth(text, lengthScale) {
    var voice = currentVoice();
    return load(voice).then(function () { return call({ type: "synth", text: text, lengthScale: lengthScale }); });
  }
  function phonemize(text) { return load(currentVoice()).then(function () { return call({ type: "phonemize", text: text }); }); }

  // Page reloaded while the voice was loading/generating → the device most likely ran out of memory.
  if (ls(LS.loading)) { ls(LS.loading, null); ls(LS.crashed, "1"); }

  function currentVoice() { var v = ls(LS.voice); return VOICES.some(function (x) { return x.id === v; }) ? v : null; }
  function setVoice(v) { ls(LS.voice, v); }
  function enabled() { return !!currentVoice() && ls(LS.off) !== "1" && ls(LS.crashed) !== "1" && support().ok; }
  function setEnabled(on) { ls(LS.off, on ? null : "1"); if (on) ls(LS.crashed, null); }
  function markFailed() { ls(LS.crashed, "1"); stopWorker(); }

  root.SnuggleHD = {
    VOICES: VOICES, BASE: BASE, support: support, getManifest: getManifest, isDownloaded: isDownloaded,
    downloadedVoices: downloadedVoices, sizeOf: sizeOf, download: download, remove: remove, load: load,
    synth: synth, phonemize: phonemize, stop: stopWorker, currentVoice: currentVoice, setVoice: setVoice,
    enabled: enabled, setEnabled: setEnabled, markFailed: markFailed,
    clearCrash: function () { ls(LS.crashed, null); }
  };
})(window);
