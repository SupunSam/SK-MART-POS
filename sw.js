const CACHE_NAME = 'sk-mart-pos-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './app.js',
    './db.js',
    './logo.svg',
    './manifest.json',
    './lib/tailwind.js',
    './lib/lucide.js',
    './lib/dexie.js'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Service Worker: Caching Assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Return cached response if found, else fetch from network
            return response || fetch(event.request).then((fetchResponse) => {
                // Cache new successful requests (optional, but good for fonts/CDNs)
                if (event.request.url.startsWith('http') && fetchResponse.status === 200) {
                    const responseToCache = fetchResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return fetchResponse;
            });
        }).catch(() => {
            // Offline fallback if needed (e.g. for images)
            if (event.request.url.includes('.html')) {
                return caches.match('./index.html');
            }
        })
    );
});
