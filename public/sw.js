// Casita de Juana service worker.
// It lets phones install Casita as an app and shows a friendly page when there is no internet.
// It NEVER stores pages or data: rent, payments, receipts and IDs are private and always come fresh from
// the server. Only the offline page and the logo it shows are kept on the device.
const CACHE = "casita-offline-v1";
const OFFLINE_URL = "/offline.html";
const ASSETS = [OFFLINE_URL, "/brand/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Page loads: from the network; the offline page only when there is no connection.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // The offline page's logo: from the network when online, from the device when offline.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && ASSETS.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
  }
  // Everything else (data, receipts, photos, sign-in) goes to the network untouched.
});
