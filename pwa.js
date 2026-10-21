/* Snuggle Stories: installable-app helpers (service worker + "Install app" button + iOS tip).
   Everything here is local. Nothing is tracked or sent anywhere. */
(function () {
  "use strict";
  var bar = document.getElementById("install-bar");
  var btn = document.getElementById("install-btn");
  var tip = document.getElementById("ios-tip");
  var closeBtn = document.getElementById("install-close");
  var DISMISS_KEY = "snuggle.installDismissed";
  var deferred = null;

  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true || /Capacitor|wv\)/.test(navigator.userAgent) || !!window.Capacitor;
  var dismissed = false;
  try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch (e) {}

  // Offline support needs http(s) or localhost; file:// pages simply skip this.
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.Capacitor) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  if (!bar || standalone || dismissed) return;

  function show(mode) {
    bar.hidden = false;
    btn.hidden = mode !== "prompt";
    tip.hidden = mode !== "ios";
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    show("prompt");
  });

  btn.addEventListener("click", function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; bar.hidden = true; });
  });

  window.addEventListener("appinstalled", function () { bar.hidden = true; });

  closeBtn.addEventListener("click", function () {
    bar.hidden = true;
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch (e) {}
  });

  var ua = navigator.userAgent || "";
  var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS && /^https?:$/.test(location.protocol)) show("ios");
})();
