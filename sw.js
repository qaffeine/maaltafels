// Offline support. Saves every game file on the device on first visit.
// Online: always fetch the newest version (and refresh the saved copy).
// Offline or very slow network: use the saved copy.
'use strict';

const CACHE = 'maaltafels-v1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/logic.js',
  './js/storage.js',
  './js/sound.js',
  './js/themes.js',
  './js/app.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(req), NETWORK_TIMEOUT_MS);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    // Opening the app from the home screen asks for the start page.
    if (req.mode === 'navigate') return cache.match('./index.html');
    throw e;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
