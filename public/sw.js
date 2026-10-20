// Service worker for the installable app. It caches only this app's own files
// (the page, its hashed JS/CSS bundles, icons and manifest) so the app can open
// without a connection. Requests to USGS and the map tiles are never intercepted
// or cached: the dashboard must not show a stale volcano status.

const CACHE = 'kilauea-monitor-v1';
const SCOPE = self.registration.scope; // e.g. https://<user>.github.io/kilauea-monitor/
const PAGE = SCOPE; // index.html is served at the scope root
const ASSETS = `${SCOPE}assets/`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch(PAGE, { cache: 'no-cache' })
      .then((res) => cachePage(res))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Anything outside the app (USGS APIs, webcams, tilt plots, map tiles) goes straight to the network.
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;

  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    if (url.href.split(/[?#]/)[0] !== PAGE && !url.pathname.endsWith('/index.html')) return;
    event.respondWith(pageNetworkFirst(event));
  } else if (url.href.startsWith(ASSETS)) {
    // Bundle names include a content hash, so a cached copy is always correct.
    event.respondWith(caches.match(request).then((cached) => cached ?? fetchAndCache(request)));
  } else {
    event.respondWith(fetchAndCache(request).catch(() => caches.match(request).then((cached) => cached ?? Response.error())));
  }
});

// Alerts from the Worker in worker/: the payload is { title, body }.
self.addEventListener('push', (event) => {
  let alert = { title: 'Kīlauea Monitor', body: 'HVO has posted an update.' };
  try {
    alert = { ...alert, ...event.data?.json() };
  } catch {
    // Keep the generic text; a push must always show a notification.
  }
  event.waitUntil(self.registration.showNotification(alert.title, { body: alert.body, icon: `${SCOPE}icons/icon-192.png` }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(SCOPE));
      return open ? open.focus() : self.clients.openWindow(SCOPE);
    }),
  );
});

// Network first, so a new deploy shows up on the next launch; the cached page is the offline fallback.
async function pageNetworkFirst(event) {
  try {
    const res = await fetch(PAGE, { cache: 'no-cache' });
    if (res.ok) event.waitUntil(cachePage(res.clone()));
    return res;
  } catch {
    return (await caches.match(PAGE)) ?? Response.error();
  }
}

async function fetchAndCache(request) {
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, res.clone());
  }
  return res;
}

// Stores the page plus the bundles it references, and drops bundles from older deploys.
async function cachePage(res) {
  if (!res.ok) throw new Error(`Page request failed: HTTP ${res.status}`);
  const html = await res.clone().text();
  const bundles = [...html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^"]+)"/g)].map((m) => new URL(m[1], SCOPE).href);
  const cache = await caches.open(CACHE);
  for (const bundle of bundles) {
    if (!(await cache.match(bundle))) await cache.add(bundle);
  }
  await cache.put(PAGE, res);
  for (const key of await cache.keys()) {
    if (key.url.startsWith(ASSETS) && !bundles.includes(key.url)) await cache.delete(key);
  }
}
