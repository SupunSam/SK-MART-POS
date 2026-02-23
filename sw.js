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

// Fetch Event - Network First Strategy
self.addEventListener('fetch', (event) => {
    // Skip external requests (CDNs, etc) - use default cache logic or network
    if (!event.request.url.startsWith(self.location.origin)) {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
        return;
    }

    // For local assets: Network First
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If network is available, cache the latest version (GET only)
                if (event.request.method === 'GET') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(event.request).then((response) => {
                    if (response) return response;

                    // Fallback for HTML
                    if (event.request.url.includes('.html')) {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
