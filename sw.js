/* =============================================================================
   sw.js — Minute Muse offline shell
   A study room should open even when the network is poor. Strategy:
   · shell (HTML, CSS, JS, icons) — stale-while-revalidate, so updates arrive on
     the next visit without ever blocking a load
   · data (quotes.json, images.json) — network-first, falling back to cache
   · audio — cache-first after first play
   · everything else same-origin — network with cache fallback
   ========================================================================== */

const VERSION = 'v3';
const SHELL_CACHE = `mm-shell-${VERSION}`;
const DATA_CACHE = `mm-data-${VERSION}`;
const MEDIA_CACHE = `mm-media-${VERSION}`;

const SHELL_ASSETS = [
  './',
  'index.html',
  'styles.css',
  'favicon.svg',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'js/app.js',
  'js/store.js',
  'js/util.js',
  'js/audio.js',
  'js/quotes.js',
  'js/timer.js',
  'js/ui/overlays.js',
  'js/ui/backdrop.js',
  'js/ui/clock.js',
  'js/ui/reader.js',
  'js/ui/timer-panel.js',
  'js/ui/tasks.js',
  'js/ui/sounds.js',
  'js/ui/journal.js',
  'js/ui/library.js',
  'js/ui/stats.js',
  'js/ui/settings-panel.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !key.endsWith(VERSION))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    // Fonts: cache-first, quiet failure elsewhere.
    if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
      event.respondWith(cacheFirst(request, MEDIA_CACHE));
    }
    return;
  }

  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (/\.(mp3|m4a|wav|ogg|png|jpe?g|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(request, SHELL_CACHE, 'index.html'));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

async function networkFirst(request, cacheName, fallbackUrl = null) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Offline — reconnect to refresh this.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}
