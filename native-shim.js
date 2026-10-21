/* Snuggle Stories: native-app bridge. Does nothing in a normal browser.
   Inside the Android app (Capacitor), Android's WebView has no Web Speech API, so this maps
   speechSynthesis / SpeechSynthesisUtterance onto the device's own text-to-speech engine
   via @capacitor-community/text-to-speech. Speech stays on the device. */
(function () {
  "use strict";
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  document.documentElement.classList.add("native-app");
  var TTS = (Cap.Plugins && Cap.Plugins.TextToSpeech) || (Cap.registerPlugin && Cap.registerPlugin("TextToSpeech"));
  if (!TTS) return;

  var voices = [], listeners = {}, current = null;
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

  var synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: function () { return voices.slice(); },
    addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { listeners[t] = (listeners[t] || []).filter(function (f) { return f !== fn; }); },
    speak: function (u) {
      synth.cancel();
      var mine = current = { u: u, dead: false };
      var idx = u.voice ? voices.indexOf(u.voice) : -1;
      var opts = { text: u.text, lang: (u.voice && u.voice.lang) || u.lang || "en-US",
        rate: u.rate || 1, pitch: u.pitch || 1, volume: u.volume == null ? 1 : u.volume, category: "playback" };
      if (idx >= 0) opts.voice = idx;
      synth.speaking = true;
      if (typeof u.onstart === "function") u.onstart({ utterance: u });
      TTS.speak(opts).then(function () {
        if (mine.dead) return;
        mine.dead = true; current = null; synth.speaking = false;
        if (typeof u.onend === "function") u.onend({ utterance: u });
      }, function (err) {
        if (mine.dead) return;
        mine.dead = true; current = null; synth.speaking = false;
        if (typeof u.onerror === "function") u.onerror({ utterance: u, error: "synthesis-failed", message: String(err) });
      });
    },
    cancel: function () {
      if (current && !current.dead) {
        var u = current.u; current.dead = true;
        if (typeof u.onerror === "function") u.onerror({ utterance: u, error: "interrupted" });
      }
      current = null; synth.speaking = false;
      TTS.stop().catch(function () {});
    },
    pause: function () { synth.cancel(); }, resume: function () {}
  };

  window.SpeechSynthesisUtterance = Utterance;
  try { Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true }); }
  catch (e) { window.speechSynthesis = synth; }

  TTS.getSupportedVoices().then(function (r) {
    voices = (r && r.voices) || [];
    emit("voiceschanged");
  }).catch(function () {});
})();
