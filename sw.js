// sw.js — Digital Manabadi Service Worker (Auto Update)
const CACHE_NAME = 'mpmp-cache-v21'; // ⚠️ ప్రతిసారి కోడ్ మార్చినప్పుడు ఈ నంబర్ పెంచండి

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

// =====================================================
// INSTALL
// =====================================================
self.addEventListener('install', event => {
  console.log('🔧 SW installing:', CACHE_NAME);
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

// =====================================================
// ACTIVATE
// =====================================================
self.addEventListener('activate', event => {
  console.log('🚀 SW activating:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// =====================================================
// FETCH
// =====================================================
self.addEventListener('fetch', event => {
  // ✅ GET కాకుండా (POST/PUT/DELETE) → network only
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Firebase / Google APIs / CDN → network only
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('flaticon') ||
      url.hostname.includes('cdnjs')) {
    return;
  }

  // HTML → Network First
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

  // CSS/JS/Images → Cache First
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// =====================================================
// MESSAGE
// =====================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
