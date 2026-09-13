const CACHE_NAME = 'workspace-shell-v1';
const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first for everything, so live data is never served stale.
  // Falls back to a cached shell file only if the network truly fails.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
