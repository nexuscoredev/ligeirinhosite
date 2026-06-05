const CACHE_NAME = 'ligeirinho-app-v10';

const APP_SHELL = [
    '/',
    '/index.html',
    '/pedidos.html',
    '/quemsomos.html',
    '/contato.html',
    '/login.html',
    '/versao.html',
    '/manifest.webmanifest',
    '/css/site.css',
    '/js/theme.js',
    '/js/theme-ui.js',
    '/js/app.js',
    '/js/layout.js',
    '/js/cart-store.js',
    '/js/cart-ui.js',
    '/js/product-pricing.js',
    '/js/catalog-utils.js',
    '/js/search-synonyms.js',
    '/js/home.js',
    '/js/pedidos.js',
    '/js/onboarding.js',
    '/js/profile.js',
    '/js/auth-store.js',
    '/js/auth-config-loader.js',
    '/js/phone-auth.js',
    '/js/login-phone.js',
    '/js/login.js',
    '/js/app-version.js',
    '/data/version/manifest.json',
    '/data/version/timeline.json',
    '/data/catalogo.json',
    '/data/site.json',
    '/data/auth-config.json',
    '/data/combos-ocasiao.json',
    '/data/precos-embalagem.json',
    '/data/imagem-embalagem.json',
    '/img/embalagens/brahma-pallet.webp',
    '/img/embalagens/pallet-generico.webp',
    '/img/ligeirinhologo.png',
    '/img/app-icon-192.png',
    '/img/app-icon-512.png',
    '/img/app-icon-512-maskable.png',
    '/img/icon-whatsapp.svg',
    '/img/icon-instagram.svg',
    '/img/icon-google-maps.svg',
    '/img/icon-google.svg',
    '/img/icon-apple.svg',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(request).then((cached) => {
            const networkFetch = fetch(request)
                .then((response) => {
                    if (response.ok && url.pathname.startsWith('/')) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || networkFetch;
        })
    );
});
