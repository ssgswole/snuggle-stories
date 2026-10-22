/* Snuggle Stories service worker: caches the app shell so the app opens offline.
   Stories are generated on-device, so there is nothing else to fetch. No analytics, no network calls. */
const CACHE = "snuggle-stories-v2-unlock";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.js", "./pwa.js", "./native-shim.js", "./unlock.js", "./manifest.webmanifest",
  "./icons/icon-48.png", "./icons/icon-72.png", "./icons/icon-96.png", "./icons/icon-144.png",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-192.png", "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Same-origin GET only. Cache first, then refresh the cache in the background (stale-while-revalidate),
// so an update to the files shows up on the next launch.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
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
