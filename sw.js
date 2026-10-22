// sw.js — Digital Manabadi Service Worker
const CACHE_NAME = 'mpmp-cache-v4';

const urlsToCache = [
  './',
  './index.html',
  './headmaster.html',
  './valiass-admin.html',
  './hm-dashboard.html',
  './hm-staff.html',
  './hm-notice.html',
  './hm-classrooms.html',
  './hm-approvals.html',
  './teacher.html',
  './cook.html',
  './parent.html',
  './style.css',
  './manifest.json',
  './js/config.js',
  './js/ui.js',
  './js/app.js',
  './js/auth.js',
  './js/pages/headmaster.js',
  './js/pages/valiass-admin.js',
  './js/pages/hm-dashboard.js',
  './js/pages/hm-staff.js',
  './js/pages/hm-notice.js',
  './js/pages/hm-classrooms.js',
  './js/pages/hm-approvals.js',
  './js/pages/teacher.js',
  './js/pages/cook.js',
  './js/pages/parent.js'
];

// INSTALL — ఫైల్స్ క్యాష్ చేయి
self.addEventListener('install', event => {
  console.log('🔧 SW installing v4...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching files...');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('⚠️ Some files failed to cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — పాత క్యాష్ క్లియర్ చేయి
self.addEventListener('activate', event => {
  console.log('🚀 SW activating v4...');
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase / Google APIs / CDN → network only
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('flaticon') ||
      url.hostname.includes('cdnjs')) {
    return;
  }

  // HTML → network-first
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

  // CSS/JS → cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
