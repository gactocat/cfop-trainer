// Minimal service worker for PLL Manager.
// Strategy: stale-while-revalidate for navigations and static assets, so the
// app loads instantly from cache and the network refresh updates the cache
// for next time. Account traffic must never enter the offline cache, and
// Vercel's own scripts and endpoints go straight to the network: Web Analytics
// is served from /_vercel/insights/ or, once enabled for the project, from a
// per-project path such as /<hash>/script.js.
//
// Web Workers are network-first. Turbopack starts a worker from one loader
// whose URL names the worker's chunks after a '#'; the cache matches URLs
// without it, so a cached loader from an earlier deploy would answer, the
// worker would take that response's URL as its own and load the earlier
// deploy's code (the scramble worker making the wrong kind of scramble).

const CACHE_NAME = 'pll-manager-v9';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/logo.svg'];

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
  if (url.pathname.startsWith('/_vercel/')) return;
  // The app's own scripts are all under /_next/; any other script is Vercel's.
  if (req.destination === 'script' && !url.pathname.startsWith('/_next/')) return;

  // Navigation requests (HTML): network-first so deploys propagate quickly,
  // fall back to cache when offline. Workers likewise (see above).
  if (req.mode === 'navigate' || req.destination === 'worker') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(req)) || (req.mode === 'navigate' ? await cache.match('/') : undefined) || Response.error();
        }
      })(),
    );
    return;
  }

  // Everything else (JS/CSS/SVG/PNG/font): stale-while-revalidate.
  staleWhileRevalidate(event);
});
