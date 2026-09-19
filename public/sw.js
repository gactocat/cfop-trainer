// Minimal service worker for PLL Manager.
// Strategy: stale-while-revalidate for navigations and static assets, so the
// app loads instantly from cache and the network refresh updates the cache
// for next time. Account traffic must never enter the offline cache.

const CACHE_NAME = 'pll-manager-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function staleWhileRevalidate(event) {
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })(),
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/account' || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) return;

  // Navigation requests (HTML): network-first so deploys propagate quickly,
  // fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(req)) || (await cache.match('/'));
        }
      })(),
    );
    return;
  }

  // Everything else (JS/CSS/SVG/PNG/font): stale-while-revalidate.
  staleWhileRevalidate(event);
});
