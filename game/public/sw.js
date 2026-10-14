// Offline cache: pages are network-first, everything else cache-first.
// Bump VERSION to drop old caches after a release.
// Only touches caches named dn-*: other apps on the same github.io origin keep theirs.
const PREFIX = 'dn-';
const VERSION = `${PREFIX}v1`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const save = (response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(VERSION).then((cache) => cache.put(request, copy));
    }
    return response;
  };

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(save).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then(save)));
});
