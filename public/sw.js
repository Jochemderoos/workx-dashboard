const CACHE_NAME = 'workx-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/workx-logo.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/apple-touch-icon.png'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls and auth - always go to network
  if (event.request.url.includes('/api/') ||
      event.request.url.includes('/auth/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseClone = response.clone();

        // Cache successful responses for static assets
        if (response.ok &&
            (event.request.url.includes('/icons/') ||
             event.request.url.includes('.png') ||
             event.request.url.includes('.svg') ||
             event.request.url.includes('.woff'))) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }

        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request);
      })
  );
});
