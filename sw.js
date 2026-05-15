/* StudyAlready PWA cache - reseaux instables, experience mobile. */
const CACHE_VERSION = 'studyalready-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/assets/css/style.css',
  '/assets/js/main.js',
  '/assets/js/config.js',
  '/assets/img/logo-icon.svg',
  '/assets/img/logo.svg',
  '/equivalence',
  '/tarifs-packs',
  '/prequalification-dossier',
  '/communaute',
  '/blog'
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isSensitivePath(pathname) {
  return (
    pathname.indexOf('/admin') === 0 ||
    pathname.indexOf('/espace-etudiant') === 0 ||
    pathname.indexOf('/dashboard') === 0 ||
    pathname.indexOf('/php/') === 0
  );
}

async function putIfOk(cacheName, request, response) {
  if (!response || !response.ok) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return putIfOk(PAGE_CACHE, request, response);
  } catch (_e) {
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
}

async function staleWhileRevalidate(request, cacheName = STATIC_CACHE) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then((response) => putIfOk(cacheName, request, response))
    .catch(() => null);
  return cached || refresh;
}

async function pageStaleWhileRevalidate(request) {
  const response = await staleWhileRevalidate(request, PAGE_CACHE);
  return response || caches.match('/offline.html');
}

function isHtmlLikeRequest(request, url) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.indexOf('text/html') !== -1) return true;
  if (url.pathname === '/' || url.pathname.endsWith('/')) return true;
  const last = url.pathname.split('/').pop() || '';
  return last.indexOf('.') === -1;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.all(PRECACHE_URLS.map((url) =>
        fetch(url, { cache: 'reload' }).then((response) => {
          if (response.ok) return cache.put(url, response);
          return null;
        }).catch(() => null)
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.indexOf(CACHE_VERSION) !== 0)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (isSensitivePath(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isHtmlLikeRequest(request, url)) {
    event.respondWith(pageStaleWhileRevalidate(request));
    return;
  }

  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.indexOf('/assets/') === 0 ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
