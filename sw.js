// sw.js — Digital Manabadi Service Worker (v29 — Final)
const CACHE_NAME = 'mpmp-cache-v35';

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
  './hm-leaves.html',
  './hm-diary.html',
  './hm-menu.html',
  './hm-attendance.html',
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
  './js/pages/hm-leaves.js',
  './js/pages/hm-diary.js',
  './js/pages/hm-menu.js',
  './js/pages/hm-attendance.js',
  './js/pages/teacher.js',
  './js/pages/cook.js',
  './js/pages/parent.js'
];

self.addEventListener('install', event => {
  console.log('🔧 SW installing:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('📦 Caching files...');
      return cache.addAll(urlsToCache).catch(err => {
        console.warn('⚠️ Some files failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('🚀 SW activating:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('flaticon') ||
      url.hostname.includes('cdnjs')) {
    return;
  }

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

  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
