/* Where the downloaded storyteller-voice files live on this device: Cache Storage, or IndexedDB where
   Cache Storage isn't available (e.g. some in-app web views). Shared by the page and the voice worker. */
export const CACHE = "snuggle-hd-v1";
const DB = "snuggle-hd", STORE = "files";
let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
function idb(mode, fn) {
  return db().then((d) => new Promise((res, rej) => {
    const tx = d.transaction(STORE, mode), st = tx.objectStore(STORE), req = fn(st);
    tx.oncomplete = () => res(req && req.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }));
}
function key(url) { return new URL(url, self.location.href).href; }
let useCaches = null;
async function cachesOk() {
  if (useCaches !== null) return useCaches;
  try { await caches.open(CACHE); useCaches = true; } catch (e) { useCaches = false; }
  return useCaches;
}
export async function has(url) {
  if (await cachesOk()) { const c = await caches.open(CACHE); return !!(await c.match(key(url))); }
  return (await idb("readonly", (s) => s.getKey(key(url)))) !== undefined;
}
export async function put(url, blob) {
  if (await cachesOk()) {
    const c = await caches.open(CACHE);
    await c.put(key(url), new Response(blob, { headers: { "Content-Type": blob.type || "application/octet-stream", "Content-Length": String(blob.size) } }));
    return;
  }
  await idb("readwrite", (s) => s.put(blob, key(url)));
}
export async function readFile(url) {
  if (await cachesOk()) {
    const c = await caches.open(CACHE), r = await c.match(key(url));
    if (r) return await r.arrayBuffer();
  } else {
    const b = await idb("readonly", (s) => s.get(key(url)));
    if (b) return await b.arrayBuffer();
  }
  throw new Error("missing:" + url);
}
export async function removeAll() {
  try { await caches.delete(CACHE); } catch (e) {}
  try { await idb("readwrite", (s) => s.clear()); } catch (e) {}
}
export async function list() {
  if (await cachesOk()) { const c = await caches.open(CACHE); return (await c.keys()).map((r) => r.url); }
  return (await idb("readonly", (s) => s.getAllKeys())) || [];
}
