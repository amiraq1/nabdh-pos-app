const CACHE_NAME = 'nabdh-pos-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

function shouldCache(request, response) {
  if (response.type !== 'basic' || !response.ok) {
    return false;
  }

  const contentType = response.headers.get('content-type') || '';

  return (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    contentType.includes('javascript') ||
    contentType.includes('css') ||
    contentType.startsWith('image/')
  );
}

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.all(
        ASSETS_TO_CACHE.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch {
            // Ignore optional assets that are not present in development builds.
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__manus__/')) return;

  event.respondWith(
    (async () => {
      if (request.mode === 'navigate') {
        try {
          return await fetch(request);
        } catch {
          return (await caches.match('/index.html')) || Response.error();
        }
      }

      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(request);

        if (shouldCache(request, networkResponse)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch {
        return Response.error();
      }
    })()
  );
});
