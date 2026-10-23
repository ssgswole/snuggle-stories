/* Snuggle Stories service worker: caches the app shell so the app opens offline.
   Stories are generated on-device, so there is nothing else to fetch. No analytics, no network calls.
   The optional storyteller voice (big model files under hd/) is NOT precached here: a grown-up downloads it
   on purpose, and the page keeps it in its own cache ("snuggle-hd-…"), which this worker never deletes. */
const CACHE = "snuggle-stories-v5-hdvoice";
const HD_PREFIX = "snuggle-hd-";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.js", "./pwa.js", "./native-shim.js", "./unlock.js", "./recorder.js", "./hdvoice.js",
  "./manifest.webmanifest",
  "./hd/hd-worker.mjs", "./hd/hd-store.mjs", "./hd/g2p.js", "./hd/ort.wasm.bundle.min.mjs", "./hd/manifest.json",
  "./icons/icon-48.png", "./icons/icon-72.png", "./icons/icon-96.png", "./icons/icon-144.png",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-192.png", "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png"
];
const BIG = /\/hd\/(voices\/|samples\/|lexicon\.txt|context\.json|ort-wasm-simd-threaded\.wasm)/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && !k.startsWith(HD_PREFIX)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Same-origin GET only. Cache first, then refresh the cache in the background (stale-while-revalidate),
// so an update to the files shows up on the next launch. Big voice files: from the voice cache if downloaded,
// otherwise straight from the network (never copied into the app-shell cache).
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (BIG.test(url.pathname)) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit || (req.mode === "navigate" ? cache.match("./index.html") : undefined));
        return hit || net;
      })
    )
  );
});
