/* Snuggle Stories: native-app bridge. Does nothing in a normal browser.
   Inside the Android/iOS app (Capacitor) this maps speechSynthesis / SpeechSynthesisUtterance onto the
   device's own text-to-speech engine via @capacitor-community/text-to-speech (Android's WebView has no
   Web Speech API). app.js already speaks one sentence at a time, so each speak() here is short.
   Speech stays on the device. */
(function () {
  "use strict";
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  document.documentElement.classList.add("native-app");
  var TTS = (Cap.Plugins && Cap.Plugins.TextToSpeech) || (Cap.registerPlugin && Cap.registerPlugin("TextToSpeech"));
  if (!TTS) return;
  var platform = Cap.getPlatform ? Cap.getPlatform() : "";

  var voices = [], pvVoices = [], listeners = {}, current = null;
  // Apple Personal Voice (iPhone/iPad, iOS 17+): local plugin in ios/App/App/PersonalVoicePlugin.swift.
  var PV = platform === "ios" && Cap.registerPlugin ? Cap.registerPlugin("PersonalVoice") : null;
  function emit(type) {
    var ev = { type: type };
    (listeners[type] || []).forEach(function (fn) { try { fn(ev); } catch (e) {} });
    if (typeof synth["on" + type] === "function") synth["on" + type](ev);
  }

  function Utterance(text) {
    this.text = text || ""; this.lang = "en-US"; this.voice = null;
    this.rate = 1; this.pitch = 1; this.volume = 1;
    this.onend = null; this.onerror = null; this.onstart = null;
  }

  // The plugin's iOS side squashes rates above 1 (1.3 sounds almost like 1.0); stretch them so the
  // Speed slider behaves like Android/Chrome. Below 1 both platforms are linear already.
  function nativeRate(r) {
    r = Math.min(1.5, Math.max(0.5, +r || 1));
    if (platform === "ios") r = r < 1 ? 1 - (1 - r) * 0.8 : 1 + (r - 1) * 5;
    return r;
  }
  function voiceIndex(v) {
    if (!v) return -1;
    var i = voices.indexOf(v);
    if (i >= 0) return i;
    var key = v.voiceURI || v.name;
    for (var k = 0; k < voices.length; k++) if ((voices[k].voiceURI || voices[k].name) === key) return k;
    return -1;
  }
  function kill(reason) {
    if (current && !current.dead) {
      var u = current.u; current.dead = true;
      if (typeof u.onerror === "function") u.onerror({ utterance: u, error: reason || "interrupted" });
    }
    current = null; synth.speaking = false;
  }

  var synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: function () { return voices.concat(pvVoices); },
    addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { listeners[t] = (listeners[t] || []).filter(function (f) { return f !== fn; }); },
    speak: function (u) {
      kill("interrupted");   // the plugin's speak() flushes the native queue itself (QUEUE_FLUSH)
      var mine = current = { u: u, dead: false };
      var done = function () {
        if (mine.dead) return;
        mine.dead = true; current = null; synth.speaking = false;
        if (typeof u.onend === "function") u.onend({ utterance: u });
      };
      var fail = function (err) {
        if (mine.dead) return;
        mine.dead = true; current = null; synth.speaking = false;
        if (typeof u.onerror === "function") u.onerror({ utterance: u, error: "synthesis-failed", message: String(err) });
      };
      if (u.voice && u.voice.personal && PV) {          // grown-up's own Personal Voice
        synth.speaking = true;
        if (typeof u.onstart === "function") u.onstart({ utterance: u });
        var r = +u.rate || 1; if (r < 1) r = 1 - (1 - r) * 0.8;
        PV.speak({ text: u.text, voiceId: u.voice.personalId, rate: r, pitch: +u.pitch || 1 }).then(done, fail);
        return;
      }
      var idx = voiceIndex(u.voice);
      var opts = { text: u.text, lang: (u.voice && u.voice.lang) || u.lang || "en-US",
        rate: nativeRate(u.rate), pitch: Math.min(1.5, Math.max(0.7, +u.pitch || 1)),
        volume: u.volume == null ? 1 : u.volume, category: "playback", queueStrategy: 0 };
      if (idx >= 0) opts.voice = idx;
      synth.speaking = true;
      if (typeof u.onstart === "function") u.onstart({ utterance: u });
      TTS.speak(opts).then(done, fail);
    },
    cancel: function () {
      kill("interrupted");
      TTS.stop().catch(function () {});   // always: also silences anything the engine still has queued
      if (PV) PV.stop().catch(function () {});
    },
    pause: function () { synth.cancel(); }, resume: function () {}
  };

  window.SpeechSynthesisUtterance = Utterance;
  try { Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true }); }
  catch (e) { window.speechSynthesis = synth; }

  // Android's TTS engine may not be ready at launch (empty list): retry a few times.
  var tries = 0;
  function fetchVoices() {
    TTS.getSupportedVoices().then(function (r) {
      var list = (r && r.voices) || [];
      if (list.length) { voices = list; emit("voiceschanged"); }
      else if (++tries < 6) setTimeout(fetchVoices, 600 * tries);
    }).catch(function () { if (++tries < 6) setTimeout(fetchVoices, 600 * tries); });
  }
  fetchVoices();

  /* Personal Voice: listed as "My Personal Voice" once the grown-up allows it. app.js shows it only
     with the full version and offers the request button (behind the grown-up check). */
  function setPersonal(res) {
    var list = (res && res.status === "authorized" && res.voices) || [];
    pvVoices = list.map(function (v) {
      return { name: "My Personal Voice" + (v.name ? " (" + v.name + ")" : ""), lang: v.lang || "en-US",
        voiceURI: "personal:" + v.id, personalId: v.id, personal: true, localService: true, "default": false };
    });
    emit("voiceschanged");
    return { status: (res && res.status) || "unsupported", count: pvVoices.length };
  }
  window.SnugglePersonalVoice = PV ? {
    available: true,
    status: function () { return PV.getStatus().then(setPersonal, function () { return { status: "unsupported", count: 0 }; }); },
    request: function () { return PV.requestAuthorization().then(setPersonal, function () { return { status: "unsupported", count: 0 }; }); }
  } : { available: false };
  if (PV) {
    window.SnugglePersonalVoice.status();
    document.addEventListener("visibilitychange", function () { if (!document.hidden) window.SnugglePersonalVoice.status(); }); // back from Settings
  }
})();
