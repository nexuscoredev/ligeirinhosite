const CACHE_NAME = 'ligeirinho-app-v22';

const APP_SHELL = [
    '/',
    '/pedidos',
    '/quemsomos',
    '/contato',
    '/login',
    '/totem',
    '/totem-pagamento',
    '/totem-sucesso',
    '/pagamento',
    '/pedido-confirmado',
    '/versao',
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
    '/js/login-hub.js',
    '/js/auth-routing.js',
    '/js/payment-providers.js',
    '/js/payment.js',
    '/js/totem.js',
    '/js/totem-success.js',
    '/js/order-status.js',
    '/css/totem.css',
    '/data/totem-units.json',
    '/js/app-version.js',
    '/js/site-config.js',
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

function cacheShellUrls(cache, urls) {
    return Promise.all(
        urls.map((url) =>
            cache.add(url).catch(() => {
                /* cleanUrls: ignore individual preload failures */
            })
        )
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cacheShellUrls(cache, APP_SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

function shellPath(pathname) {
    if (pathname === '/index.html') return '/';
    if (pathname.endsWith('.html')) return pathname.slice(0, -5);
    return pathname;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;

    const isNavigate = request.mode === 'navigate';
    const canonicalPath = shellPath(url.pathname);
    const canonicalUrl = canonicalPath === url.pathname ? null : new URL(canonicalPath, url.origin).href;

    event.respondWith(
        (async () => {
            const cached =
                (await caches.match(request)) ||
                (canonicalUrl ? await caches.match(canonicalUrl) : null) ||
                (isNavigate ? await caches.match('/') : null);

            try {
                const response = await fetch(canonicalUrl || request);
                if (response.ok && url.pathname.startsWith('/')) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(canonicalUrl || request, clone);
                    });
                }
                return response;
            } catch {
                if (cached) return cached;
                if (isNavigate) {
                    const fallback = (await caches.match('/')) || (await caches.match('/index.html'));
                    if (fallback) return fallback;
                }
                throw new Error('offline');
            }
        })()
    );
});
