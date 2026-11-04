// Service Worker cho Ứng dụng Chấm Công & Km (v4 - Offline Photo + GPS)
const CACHE_NAME = 'chamcong-km-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bỏ qua Google Apps Script & Nominatim (luôn qua mạng)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('nominatim')) {
    return;
  }

  // Network-first cho app.js (luôn lấy bản mới nhất nếu có mạng)
  if (url.pathname.endsWith('app.js')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // Cache bản mới (bỏ query string)
          const cleanUrl = new Request(url.origin + url.pathname);
          cache.put(cleanUrl, clone);
          cache.put(event.request, response.clone());
        });
        return response;
      }).catch(() => {
        // Offline: thử cache có query string trước, rồi không query string
        return caches.match(event.request).then(r => r || caches.match(url.origin + url.pathname));
      })
    );
    return;
  }

  // Cache-first cho các asset tĩnh khác (style.css, font-awesome, index.html)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache asset mới
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback offline cho trang HTML
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
