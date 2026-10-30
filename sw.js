// Offline cache for the app files. Serves from cache first, then refreshes the cache in the
// background so a new version shows up on the next launch. Google Sheet requests pass through.
const CACHE = 'showcaller-v10';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, which GitHub Pages keeps for up to 10 minutes.
  const fresh = FILES.map((f) => new Request(f, { cache: 'reload' }));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = url.pathname.slice(self.registration.scope.length - self.location.origin.length);
  if (!FILES.includes(path || './')) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => {
        const fresh = fetch(req)
          .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || fresh;
      })
    )
  );
});
