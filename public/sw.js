// Workx Dashboard service worker — app-shell pre-cache + smart strategies.
// Bump versie bij elke wijziging zodat oude caches worden opgeruimd.
const CACHE_NAME = 'workx-v3';

// Essentiële assets die we pre-cachen bij install — visible op elke pagina
// of nodig voor de PWA-shell.
const PRECACHE_ASSETS = [
  '/workx-logo.svg',
  '/workx-logo.png',
  '/workx-dashboard-icon.svg',
  '/workx-pand.png',
  '/fiets.png',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
];

// Install — preloads het app-shell. We laten de cache mislukt-toleren
// (één 404 mag de hele install niet blokkeren).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[sw] precache miss', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate — ruim oude versies op
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

// Helpers
function isStaticAsset(url) {
  return (
    url.includes('/icons/') ||
    url.endsWith('.png') ||
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.webp') ||
    url.endsWith('.svg') ||
    url.endsWith('.woff') ||
    url.endsWith('.woff2') ||
    url.endsWith('.ico')
  );
}

// Next.js compileert assets in /_next/static/ met content-hashes — die zijn
// immutable. Cache-first geeft de snelste navigatie zonder verouderingsrisico.
function isNextImmutable(url) {
  return url.includes('/_next/static/');
}

// Cache-first met fallback naar network
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return cached || Response.error();
  }
}

// Stale-while-revalidate: serveer uit cache als beschikbaar, update in bg
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || networkPromise || fetch(request);
}

// Fetch handler
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Navigation: laat naar netwerk gaan zodat Vercel-deploys verse HTML geven
  if (event.request.mode === 'navigate') return;

  const url = event.request.url;

  // API & auth: altijd netwerk
  if (url.includes('/api/') || url.includes('/auth/')) return;

  if (isNextImmutable(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'workx-notification',
      data: { url: data.url || '/dashboard/werk' },
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'Workx Dashboard', options)
    );
  } catch (error) {
    console.error('Error showing push notification:', error);
  }
});

// Notification click event — open de relevante pagina
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard/werk';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
