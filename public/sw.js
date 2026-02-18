const CACHE_NAME = 'workx-v2';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/workx-logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
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

  // Skip navigation requests — always go directly to the network
  // This ensures page reloads after Vercel deploys get fresh code
  if (event.request.mode === 'navigate') return;

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

// Push notification event - receive and show notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'workx-notification',
      data: {
        url: data.url || '/dashboard/werk'
      },
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Workx Dashboard', options)
    );
  } catch (error) {
    console.error('Error showing push notification:', error);
  }
});

// Notification click event - open the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/dashboard/werk';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already an open window
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
