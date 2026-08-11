const CACHE_VERSION = 'catalogo-v2';
const APP_SHELL = [
    '/',
    '/static/css/app.css',
    '/static/js/app.js',
    '/static/manifest.json',
    '/static/icons/icon-192.png',
    '/static/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

function isReadOnlyApiGet(request) {
    const url = new URL(request.url);
    return request.method === 'GET' && (
        url.pathname === '/api/products' ||
        url.pathname === '/api/products/search' ||
        url.pathname === '/api/categories' ||
        url.pathname === '/api/categories/stats' ||
        url.pathname.startsWith('/api/products/category/')
    );
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(request, response.clone());
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(CACHE_VERSION);
        cache.put(request, response.clone());
    }
    return response;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return; // altas/ediciones/eliminaciones siempre van directo a la red

    const url = new URL(request.url);

    if (isReadOnlyApiGet(request)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // El shell de la app (HTML/CSS/JS) usa network-first: así el teléfono siempre ve
    // los cambios más recientes cuando hay conexión, y solo cae a la caché sin internet.
    if (APP_SHELL.includes(url.pathname)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Las fotos de producto casi nunca cambian una vez subidas, así que sí conviene
    // cache-first: ahorra datos y son instantáneas en visitas repetidas.
    if (url.pathname.startsWith('/static/images/')) {
        event.respondWith(cacheFirst(request));
        return;
    }
});
