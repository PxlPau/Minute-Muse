/* =============================================================================
   sw.js — Minute Muse offline shell
   A study room should open even when the network is poor. Strategy:
   · shell (HTML, CSS, JS, icons, legal pages) — stale-while-revalidate
   · data (quotes.json, images.json) — network-first, falling back to the
     precached collection even when the app's cache-busting query differs
   · audio — cache-first after first play
   · everything else same-origin — network with cache fallback
   ========================================================================== */

const VERSION = 'v4';
const SHELL_CACHE = `mm-shell-${VERSION}`;
const DATA_CACHE = `mm-data-${VERSION}`;
const MEDIA_CACHE = `mm-media-${VERSION}`;

const SHELL_ASSETS = [
  './',
  'index.html',
  '404.html',
  'terms.html',
  'privacy.html',
  'disclaimer.html',
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
const DATA_ASSETS = ['quotes.json', 'images.json'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const [shell, data] = await Promise.all([
      caches.open(SHELL_CACHE),
      caches.open(DATA_CACHE),
    ]);
    // Cache assets individually: one missing optional file must not abort the
    // entire precache with addAll()'s all-or-nothing behaviour.
    const addQuietly = async (cache, asset) => {
      try {
        await cache.add(asset);
      } catch {
        /* A failed optional asset is handled by runtime fallbacks. */
      }
    };
    await Promise.all([
      ...SHELL_ASSETS.map((asset) => addQuietly(shell, asset)),
      ...DATA_ASSETS.map((asset) => addQuietly(data, asset)),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          // Only clean up this app's caches, and keep every bucket of this version.
          .filter((key) => key.startsWith('mm-') && !key.endsWith(VERSION))
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
      event.respondWith(cacheFirst(request, MEDIA_CACHE, event));
    }
    return;
  }

  if (url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request, DATA_CACHE, { ignoreSearch: true, event }));
    return;
  }

  if (/\.(mp3|m4a|wav|ogg|png|jpe?g|webp|svg)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE, event));
    return;
  }

  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(request, SHELL_CACHE, { fallbackUrl: 'index.html', event }));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE, event));
});

async function networkFirst(request, cacheName, options = {}) {
  const { fallbackUrl = null, ignoreSearch = false, event = null } = options;
  const cache = await caches.open(cacheName);
  const matchOptions = ignoreSearch ? { ignoreSearch: true } : undefined;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const stored = cache.put(request, response.clone()).catch(() => {});
      if (event?.waitUntil) event.waitUntil(stored);
      else await stored;
      return response;
    }
    // A transient 404/503 should not discard a perfectly good cached copy.
    const cached = await cache.match(request, matchOptions);
    return cached || response;
  } catch {
    const cached = await cache.match(request, matchOptions);
    if (cached) return cached;
    if (fallbackUrl) {
      const absoluteFallback = new URL(fallbackUrl, self.registration.scope).href;
      const fallback = await cache.match(absoluteFallback, matchOptions);
      if (fallback) return fallback;
    }
    return new Response('Offline — reconnect to refresh this.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request, cacheName, event = null) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      const stored = cache.put(request, response.clone()).catch(() => {});
      if (event?.waitUntil) event.waitUntil(stored);
      else await stored;
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName, event = null) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        try {
          await cache.put(request, response.clone());
        } catch {
          /* Storage pressure must not break the response. */
        }
      }
      return response;
    })
    .catch(() => null);
  // Keep the worker alive long enough for the background refresh to complete.
  if (event?.waitUntil) event.waitUntil(network);
  if (cached) return cached;
  return (await network) || new Response('', { status: 504, statusText: 'Offline' });
}
