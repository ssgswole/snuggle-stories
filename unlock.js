/* Snuggle Stories: "Unlock all worlds" (one-time, non-consumable purchase).
   app.js only talks to window.unlock: isUnlocked(), buy(), restore(), onChange(fn), mode().
   - Native apps (Capacitor): Apple App Store / Google Play billing through cordova-plugin-purchase
     (window.CdvPurchase). The store is the source of truth; localStorage is only a cache so the
     app opens unlocked straight away (and offline) for someone who already bought it.
   - Web / PWA: there is no store and no payment. buy() just reports "web" so the app can say that
     the full version lives in the App Store / Google Play apps.
   - Developer preview (web only): open the page with ?devunlock=1 to unlock, ?devunlock=0 to lock again.
   No ads, no analytics, no accounts. Nothing is sent anywhere except the store's own purchase flow. */
(function () {
  "use strict";
  var PRODUCT_ID = "snuggle_unlock_all";
  var CACHE_KEY = "snuggle.unlocked";
  var DEV_KEY = "snuggle.devunlock";
  var Cap = window.Capacitor;
  var isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  var listeners = [];
  var unlocked = false, dev = false, storeReady = false, storeFailed = false, storeErrored = false, product = null, store = null;
  var pending = null; // { resolve, kind } for the purchase/restore currently in progress

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  function set(v) {
    v = !!v;
    if (!dev) write(CACHE_KEY, v ? "1" : null);
    if (v === unlocked) return;
    unlocked = v;
    listeners.forEach(function (fn) { try { fn(unlocked); } catch (e) {} });
  }

  // Cached state first, so a paying family never sees locks flash on launch.
  unlocked = read(CACHE_KEY) === "1";

  if (!isNative) {
    var m = /[?&]devunlock=([01])\b/.exec(location.search || "");
    if (m) write(DEV_KEY, m[1] === "1" ? "1" : null);
    dev = read(DEV_KEY) === "1";
    if (dev) unlocked = true;
    else unlocked = false; // the web build has nothing to buy, so it never reads the native cache as truth
  }

  /* ---------------- Native store (cordova-plugin-purchase v13) ---------------- */
  function settle(result) {
    if (!pending) return;
    var p = pending; pending = null;
    clearTimeout(p.timer);
    p.resolve(result);
  }

  function refreshFromStore() {
    if (!store) return;
    product = store.get(PRODUCT_ID) || product;
    if (!product) return;
    // "Owned" always counts. "Not owned" only counts once the store has fully loaded the purchases
    // without errors, so a slow or offline launch never locks a family that already paid.
    if (product.owned) set(true);
    else if (storeReady && !storeErrored) set(false);
  }

  function initStore() {
    var C = window.CdvPurchase;
    if (!C || !C.store) { storeFailed = true; return; }
    store = C.store;
    var P = C.Platform, T = C.ProductType;
    var platform = (Cap.getPlatform && Cap.getPlatform() === "ios") ? P.APPLE_APPSTORE : P.GOOGLE_PLAY;
    store.verbosity = C.LogLevel ? C.LogLevel.WARNING : 1;
    store.register([{ id: PRODUCT_ID, type: T.NON_CONSUMABLE, platform: platform }]);
    store.when()
      .productUpdated(function () { refreshFromStore(); })
      .approved(function (tx) { return tx.verify(); })      // local verification (no server)
      .verified(function (receipt) { return receipt.finish(); })
      .finished(function () { refreshFromStore(); if (unlocked) settle({ ok: true }); })
      .receiptUpdated(function () { refreshFromStore(); if (pending && pending.kind === "buy" && unlocked) settle({ ok: true }); });
    store.error(function (err) {
      if (!pending) return;
      var cancelled = err && C.ErrorCode && err.code === C.ErrorCode.PAYMENT_CANCELLED;
      settle({ ok: false, cancelled: !!cancelled, message: (err && err.message) || "The store had a hiccup." });
    });
    store.initialize([platform]).then(function (errors) {
      storeReady = true;
      storeErrored = !!(errors && errors.length);
      refreshFromStore();
    }, function () { storeFailed = true; });
  }

  if (isNative) {
    if (window.CdvPurchase) initStore();
    else document.addEventListener("deviceready", initStore, false);
    // If the plugin never shows up (e.g. an old build), keep the cached state and report it.
    setTimeout(function () { if (!store) storeFailed = true; }, 8000);
  }

  function waitFor(kind, ms) {
    return new Promise(function (resolve) {
      if (pending) settle({ ok: false, message: "Cancelled." });
      pending = { resolve: resolve, kind: kind, timer: setTimeout(function () {
        settle(unlocked ? { ok: true } : { ok: false, timeout: true, message: "The store is taking a while. Please try again in a moment." });
      }, ms) };
    });
  }

  var api = {
    PRODUCT_ID: PRODUCT_ID,
    PRICE_FALLBACK: "$4.99",
    isUnlocked: function () { return unlocked; },
    isDevUnlock: function () { return dev; },
    mode: function () { return isNative ? "native" : "web"; },
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); },
    /** Localized price from the store when known (e.g. "$4.99", "4,99 €"), else "$4.99". */
    price: function () {
      try {
        var o = product && product.getOffer && product.getOffer();
        var ph = o && o.pricingPhases && o.pricingPhases[0];
        if (ph && ph.price) return ph.price;
        if (product && product.pricing && product.pricing.price) return product.pricing.price;
      } catch (e) {}
      return api.PRICE_FALLBACK;
    },
    /** Resolves { ok, cancelled?, web?, message? }. Call only after the parent gate. */
    buy: function () {
      if (unlocked) return Promise.resolve({ ok: true, already: true });
      if (!isNative) return Promise.resolve({ ok: false, web: true });
      if (!store || !storeReady) return Promise.resolve({ ok: false, message: storeFailed ?
        "We couldn't reach the store. Check the internet connection and try again." : "The store is still loading. Try again in a few seconds." });
      refreshFromStore();
      var offer = product && product.getOffer && product.getOffer();
      if (!offer) return Promise.resolve({ ok: false, message: "The unlock isn't available in the store yet." });
      var wait = waitFor("buy", 180000);
      offer.order().then(function (err) {
        if (err) {
          var C = window.CdvPurchase;
          settle({ ok: false, cancelled: !!(C && C.ErrorCode && err.code === C.ErrorCode.PAYMENT_CANCELLED), message: err.message });
        }
      }, function (e) { settle({ ok: false, message: String(e) }); });
      return wait;
    },
    /** Resolves { ok, restored, web?, message? }. Call only after the parent gate. */
    restore: function () {
      if (!isNative) return Promise.resolve({ ok: false, web: true, restored: unlocked });
      if (!store || !storeReady) return Promise.resolve({ ok: false, message: "We couldn't reach the store. Check the internet connection and try again." });
      return Promise.resolve(store.restorePurchases()).then(function (err) {
        return (store.update ? Promise.resolve(store.update()) : Promise.resolve()).then(function () {
          refreshFromStore();
          if (err && !unlocked) return { ok: false, restored: false, message: err.message || "Restore didn't finish." };
          return { ok: true, restored: unlocked };
        });
      }, function (e) { return { ok: false, restored: unlocked, message: String(e) }; });
    }
  };
  window.unlock = api;
})();
