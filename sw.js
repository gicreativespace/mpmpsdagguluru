// sw.js — Digital Manabadi Service Worker
const CACHE_NAME = 'mpmp-cache-v3';

const urlsToCache = [
  './',
  './index.html',
  './headmaster.html',
  './valiass-admin.html',
  './hm-dashboard.html',
  './style.css',
  './manifest.json',
  './js/config.js',
  './js/ui.js',
  './js/app.js',
  './js/auth.js',
  './js/pages/headmaster.js',
  './js/pages/valiass-admin.js',
  './js/pages/hm-dashboard.js'
];

// =====================================================
// INSTALL — ఫైల్స్ క్యాష్ చేయి
// =====================================================
self.addEventListener('install', event => {
  console.log('🔧 SW installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching files...');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('⚠️ Some files failed to cache (404?):', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// =====================================================
// ACTIVATE — పాత క్యాష్ క్లియర్ చేయి
// =====================================================
self.addEventListener('activate', event => {
  console.log('🚀 SW activating...');
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// =====================================================
// FETCH — Cache-first (లోకల్), Network-first (HTML)
// =====================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase / Google APIs / CDN → network only
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('flaticon') ||
      url.hostname.includes('cdnjs')) {
    return; // browser default
  }

  // HTML → network-first (తాజా వెర్షన్)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CSS/JS/images → cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
