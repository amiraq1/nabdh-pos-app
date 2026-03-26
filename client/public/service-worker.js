/**
 * Nabdh POS — Service Worker (Offline-First)
 *
 * Strategy:
 *   Static assets   → Cache-First (install-time + runtime)
 *   Navigation       → Network-First w/ offline fallback to App Shell
 *   API (/api/trpc)  → Network-First w/ stale response fallback for GET
 *   Google Fonts     → Cache-First (long-lived)
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `nabdh-pos-static-${CACHE_VERSION}`;
const API_CACHE = `nabdh-pos-api-${CACHE_VERSION}`;
const FONT_CACHE = `nabdh-pos-fonts-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// API paths to cache for offline reads (GET queries only)
const CACHEABLE_API_PATTERNS = [
  'products.list',
  'categories.list',
  'products.get',
  'products.getBySku',
  'products.getByBarcode',
  'auth.me',
];

// ---------------------------------------------------------------------------
// Install — Pre-cache app shell
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      await Promise.all(
        STATIC_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch {
            // Ignore assets not present in dev builds
          }
        })
      );
    })()
  );

  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — Purge old caches
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => {
          const isCurrentCache =
            key === STATIC_CACHE || key === API_CACHE || key === FONT_CACHE;

          if (!isCurrentCache) {
            return caches.delete(key);
          }
        })
      );
    })()
  );

  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — Routing logic
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip manus debug endpoints
  if (url.pathname.startsWith('/__manus__/')) return;

  // --- Google Fonts: Cache-First ---
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Only handle same-origin from here
  if (url.origin !== self.location.origin) return;

  // --- API Requests: Network-First with stale fallback ---
  if (url.pathname.startsWith('/api/trpc')) {
    const isCacheableQuery = CACHEABLE_API_PATTERNS.some((pattern) =>
      url.pathname.includes(pattern) || url.search.includes(pattern)
    );

    if (isCacheableQuery) {
      event.respondWith(networkFirstWithCache(request, API_CACHE));
    }
    // Non-cacheable API: let it go through normally (will fail if offline)
    return;
  }

  // --- Navigation: Network-First with App Shell fallback ---
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          // Cache the latest shell
          const cache = await caches.open(STATIC_CACHE);
          await cache.put('/index.html', networkResponse.clone());
          return networkResponse;
        } catch {
          return (await caches.match('/index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // --- Static Assets: Cache-First with network update ---
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ---------------------------------------------------------------------------
// Caching Strategies
// ---------------------------------------------------------------------------

/**
 * Cache-First: Check cache, fall back to network.
 * Best for: fonts, images, rarely-changing assets.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return Response.error();
  }
}

/**
 * Network-First with Cache Fallback: Try network, cache the response, fall back to cached version.
 * Best for: API data that should be fresh but available offline.
 */
async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify([{
        error: {
          message: 'غير متصل بالإنترنت — البيانات غير متوفرة في الكاش',
          code: -32603,
          data: { code: 'OFFLINE', httpStatus: 503 },
        },
      }]),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Stale-While-Revalidate: Serve from cache immediately, update cache in background.
 * Best for: JS/CSS bundles, static assets with hashed filenames.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const fetchPromise = (async () => {
    try {
      const networkResponse = await fetch(request);

      if (networkResponse.ok && shouldCacheResponse(request, networkResponse)) {
        const cache = await caches.open(cacheName);
        await cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    } catch {
      return null;
    }
  })();

  // Return cache immediately, update in background
  if (cached) {
    // Fire and forget the network update
    fetchPromise.catch(() => {});
    return cached;
  }

  // No cache — must wait for network
  const networkResponse = await fetchPromise;
  return networkResponse || Response.error();
}

/**
 * Determine whether a response should be cached.
 */
function shouldCacheResponse(request, response) {
  if (response.type !== 'basic' || !response.ok) return false;

  const contentType = response.headers.get('content-type') || '';

  return (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    contentType.includes('javascript') ||
    contentType.includes('css') ||
    contentType.startsWith('image/') ||
    contentType.includes('font')
  );
}
