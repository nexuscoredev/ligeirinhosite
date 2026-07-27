const CACHE_NAME = 'ligeirinho-app-v413';
const MKT_IMAGE_HOST = 'liszpwocwvkytzyaxvit.supabase.co';
const MKT_IMAGE_CACHE = 'ligeirinho-mkt-images-v1';

/* Só estes ficam network-first — o resto do shell usa cache + revalidação em background. */
const NETWORK_FIRST_STATIC = new Set([
    '/js/pwa-update.js',
    '/manifest.webmanifest',
]);

const APP_SHELL = [
    '/',
    '/inicio',
    '/pedidos',
    '/ofertas',
    '/caminhao',
    '/conta',
    '/meus-pedidos',
    '/quemsomos',
    '/contato',
    '/login',
    '/totem',
    '/totem-pagamento',
    '/totem-caixa',
    '/totem-sucesso',
    '/pagamento',
    '/pedido-confirmado',
    '/data-entrega',
    '/resumo',
    '/metodo-pagamento',
    '/versao',
    '/manifest.webmanifest',
    '/css/site.css',
    '/css/totem.css',
    '/css/theme-forms.css',
    '/img/tag-pix-dinheiro.png',
    '/img/tag-promocao.png',
    '/js/theme.js',
    '/js/theme-ui.js',
    '/js/app.js',
    '/js/install-app.js',
    '/js/client-notifications.js',
    '/js/auth-store.js',
    '/js/layout.js',
    '/js/mobile-scroll.js',
    '/js/motion.js',
    '/js/cart-store.js',
    '/js/cart-ui.js',
    '/js/product-pricing.js',
    '/js/catalog-utils.js',
    '/js/catalog-loader.js',
    '/js/catalog-sync.js',
    '/js/search-synonyms.js',
    '/js/home-stories.js',
    '/js/mkt-promo-images.js',
    '/js/home.js',
    '/js/pedidos.js',
    '/js/ofertas.js',
    '/js/promo-entry-notice.js',
    '/js/meus-pedidos.js',
    '/js/promo-catalog-match.js',
    '/js/caminhao.js',
    '/js/parceiro-delivery.js',
    '/js/resumo-pedido.js',
    '/js/delivery-schedule.js',
    '/js/data-entrega.js',
    '/js/resumo.js',
    '/js/metodo-pagamento.js',
    '/js/payment-methods.js',
    '/data/ofertas-config.json',
    '/data/delivery-schedule.json',
    '/data/ofertas-config.json',
    '/data/client-notifications.json',
    '/js/onboarding.js',
    '/js/address-picker.js',
    '/js/profile-avatar.js',
    '/js/conta.js',
    '/js/conta-cnpj-modal.js',
    '/js/auth-config-loader.js',
    '/js/phone-auth.js',
    '/js/login-phone.js',
    '/js/login.js',
    '/js/login-hub.js',
    '/js/auth-routing.js',
    '/js/splash.js',
    '/js/payment-providers.js',
    '/js/payment.js',
    '/js/mkt-promo-images.js',
    '/js/totem-promos.js',
    '/js/totem-promo-payment.js',
    '/js/promo-catalog-match.js',
    '/js/cpf.js',
    '/js/cnpj.js',
    '/js/totem.js',
    '/js/totem-payment.js',
    '/js/totem-caixa.js',
    '/js/totem-loading.js',
    '/js/totem-barcode.js',
    '/js/totem-receipt.js',
    '/js/totem-success.js',
    '/js/totem-viewport.js',
    '/js/totem-keyboard.js',
    '/js/totem-kiosk-guard.js',
    '/js/totem-activity.js',
    '/js/totem-pwa-update.js',
    '/js/pwa-update.js',
    '/js/order-status.js',
    '/js/payment-methods.js',
    '/css/totem.css',
    '/css/totem-receipt.css',
    '/data/totem-units.json',
    '/js/app-version.js',
    '/js/site-config.js',
    '/data/version/manifest.json',
    '/data/version/timeline.json',
    '/data/catalogo.json',
    '/data/site.json',
    '/data/auth-config.json',
    '/data/precos-embalagem.json',
    '/data/imagem-embalagem.json',
    '/img/ligeirinhologo.png',
    '/img/app-icon-light-192.png',
    '/img/app-icon-light-512.png',
    '/img/app-icon-light-512-maskable.png',
    '/img/icon-whatsapp.svg',
    '/img/icon-pix.svg',
    '/img/icon-cartoes.svg',
    '/img/icon-instagram.svg',
    '/img/icon-google-maps.png',
    '/img/icon-google.svg',
    '/img/icon-apple.svg',
    '/img/mercado-pago-logo-color.png',
    '/img/mercado-pago-logo.svg',
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
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cacheShellUrls(cache, APP_SHELL)));
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME && key !== MKT_IMAGE_CACHE)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

function shellPath(pathname) {
    if (pathname === '/index.html') return '/';
    if (pathname.endsWith('.html')) return pathname.slice(0, -5);
    return pathname;
}

function isStaticAsset(pathname) {
    return (
        pathname.startsWith('/js/') ||
        pathname.startsWith('/css/') ||
        pathname.startsWith('/data/') ||
        pathname.startsWith('/img/')
    );
}

function isMktStorageRequest(url) {
    return (
        url.hostname === MKT_IMAGE_HOST &&
        url.pathname.includes('/storage/v1/') &&
        url.pathname.includes('/marketing-artes/')
    );
}

const matchCache = (request, urlHint) =>
    caches.match(request, { ignoreSearch: true }).then(async (hit) => {
        if (hit) return hit;
        if (urlHint) return caches.match(urlHint, { ignoreSearch: true });
        return null;
    });

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (isMktStorageRequest(url)) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(MKT_IMAGE_CACHE);
                const cached = await cache.match(request);
                const network = fetch(request)
                    .then((response) => {
                        if (response.ok) cache.put(request, response.clone());
                        return response;
                    })
                    .catch(() => null);
                if (cached) {
                    event.waitUntil(network);
                    return cached;
                }
                const live = await network;
                if (live) return live;
                throw new Error('offline');
            })()
        );
        return;
    }

    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(request));
        return;
    }

    const isNavigate = request.mode === 'navigate';
    const canonicalPath = shellPath(url.pathname);
    const canonicalUrl = canonicalPath === url.pathname ? null : new URL(canonicalPath, url.origin).href;

    event.respondWith(
        (async () => {
            const cached =
                (await matchCache(request, canonicalUrl)) ||
                (isNavigate ? await caches.match('/') : null);

            const revalidate = (req) =>
                fetch(req)
                    .then((response) => {
                        if (response.ok) {
                            return caches.open(CACHE_NAME).then((cache) => {
                                cache.put(req, response.clone());
                            });
                        }
                        return undefined;
                    })
                    .catch(() => undefined);

            if (isStaticAsset(url.pathname)) {
                if (NETWORK_FIRST_STATIC.has(url.pathname)) {
                    try {
                        const response = await fetch(canonicalUrl || request);
                        if (response.ok) {
                            const cache = await caches.open(CACHE_NAME);
                            cache.put(canonicalUrl || request, response.clone());
                        }
                        return response;
                    } catch {
                        if (cached) return cached;
                        throw new Error('offline');
                    }
                }

                if (cached) {
                    event.waitUntil(revalidate(canonicalUrl || request));
                    return cached;
                }
            }

            /* Navegação: responde do cache na hora e atualiza em background (troca de tela instantânea). */
            if (isNavigate && cached) {
                event.waitUntil(revalidate(canonicalUrl || request));
                return cached;
            }

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
