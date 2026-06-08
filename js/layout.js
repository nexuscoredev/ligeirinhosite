(function () {
    if (!document.getElementById('ligeirinho-nav-font')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'ligeirinho-nav-font';
        fontLink.rel = 'stylesheet';
        fontLink.href =
            'https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap';
        document.head.appendChild(fontLink);

        const fontStyle = document.createElement('style');
        fontStyle.id = 'ligeirinho-nav-font-style';
        fontStyle.textContent = `
            .font-nav {
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            }
            nav.font-nav-bar .nav-brand {
                font-size: 1.0625rem;
                font-weight: 700;
                letter-spacing: -0.03em;
                line-height: 1.2;
            }
            .lig-brand__text {
                font-family: 'Plus Jakarta Sans', 'Hanken Grotesk', system-ui, sans-serif;
            }
            .lig-brand__app {
                font-family: 'Caveat', cursive;
            }
            nav.font-nav-bar .nav-link {
                font-size: 0.9375rem;
                font-weight: 600;
                letter-spacing: 0.02em;
            }
            nav.font-nav-bar .nav-link-active {
                font-weight: 700;
                letter-spacing: 0.01em;
            }
            html.lig-menu-open {
                overflow: hidden;
                overscroll-behavior: none;
            }
            html.lig-menu-open body {
                overflow: hidden;
                overscroll-behavior: none;
            }
            html.lig-menu-open #lig-page-main,
            html.lig-menu-open #site-footer {
                pointer-events: none;
                user-select: none;
            }
            html.lig-menu-open .glass-panel,
            html.lig-menu-open nav.font-nav-bar {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
            html.lig-menu-open nav.font-nav-bar {
                background: rgba(255, 255, 255, 0.97) !important;
            }
            #nav-mobile-menu .nav-mobile-panel {
                transform: translate3d(0, 0, 0);
            }
            #nav-mobile-menu .nav-mobile-backdrop {
                background: rgba(8, 8, 8, 0.88);
            }
        `;
        document.head.appendChild(fontStyle);
    }

    if (!document.querySelector('link[href="css/site.css"]')) {
        const siteCss = document.createElement('link');
        siteCss.rel = 'stylesheet';
        siteCss.href = 'css/site.css';
        document.head.appendChild(siteCss);
    }

    const page = document.body.dataset.page || '';
    const instagramUrl = 'https://www.instagram.com/oficialligeirinhobebidas/?hl=pt';
    const whatsappUrl =
        'https://api.whatsapp.com/send/?phone=5511970924909&text&type=phone_number&app_absent=0&utm_source=ig';
    const mapsUrl =
        'https://www.google.com/maps/search/?api=1&query=Estr.+do+Campo+Limpo,+2083+-+Vila+Prel,+S%C3%A3o+Paulo+-+SP,+05777-001';

    const navActive =
        'font-nav nav-link nav-link-active text-vibrant-orange border-b-2 border-vibrant-orange pb-1 transition-colors duration-200';
    const navLink =
        'font-nav nav-link text-[#666] hover:text-vibrant-orange transition-colors duration-200 hover:bg-orange-50 px-3 py-1.5 rounded-md';

    const accountHref = 'contato.html#minha-conta';
    const accountActive = page === 'contato';
    const accountLinkClass = accountActive
        ? 'font-nav lig-nav-account lig-nav-account--active'
        : 'font-nav lig-nav-account';

    const navItems = [
        { id: 'inicio', href: 'index.html', label: 'Início', icon: 'home' },
        { id: 'pedidos', href: 'pedidos.html', label: 'Pedidos', icon: 'local_mall' },
        { id: 'quemsomos', href: 'quemsomos.html', label: 'Quem Somos', icon: 'storefront' },
        { id: 'contato', href: 'contato.html', label: 'Contato', icon: 'chat' },
    ];

    const navLinksHtml = navItems
        .map(
            (item) =>
                `<a class="${page === item.id ? navActive : navLink}" href="${item.href}">${item.label}</a>`
        )
        .join('\n');

    const navMobileLink =
        'font-nav block w-full min-h-[48px] px-4 py-3 rounded-lg text-[15px] font-semibold text-on-surface-variant hover:text-gold-accent hover:bg-surface-variant/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-orange';
    const navMobileActive =
        'font-nav block w-full min-h-[48px] px-4 py-3 rounded-lg text-[15px] font-bold text-vibrant-orange bg-vibrant-orange/10 border border-vibrant-orange/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-orange';

    const navMobileLinksHtml = navItems
        .map(
            (item) =>
                `<a class="${page === item.id ? navMobileActive : navMobileLink}" href="${item.href}">${item.label}</a>`
        )
        .join('\n');

    const showAppChrome = page === 'inicio' || page === 'pedidos';
    const searchPlaceholder = page === 'pedidos' ? 'Buscar no catálogo...' : 'O que você quer pedir?';

    const navHtml = `<header class="ze-app-header sticky top-0 z-50">
<nav class="font-nav-bar">
<div class="flex justify-between items-center w-full px-4 md:px-margin-desktop py-3 max-w-container-max mx-auto min-h-[52px]">
<a class="lig-brand nav-brand" href="index.html" aria-label="Ligeirinho App — início">
<img class="lig-brand__logo" src="img/ligeirinhologo.png" alt="" width="36" height="36" decoding="async">
<span class="lig-brand__wordmark"><span class="lig-brand__text">Ligeirinho</span><span class="lig-brand__app">App</span></span>
</a>
<div class="hidden md:flex items-center gap-6">
${navLinksHtml}
</div>
<div class="flex items-center gap-1 shrink-0">
<a href="${accountHref}" class="${accountLinkClass} hidden md:inline-flex" aria-current="${accountActive ? 'page' : 'false'}">
<span class="material-symbols-outlined lig-nav-account__icon" aria-hidden="true">person</span>
<span>Minha conta</span>
</a>
<div data-lig-theme-mount class="lig-theme-toggle-mount lig-theme-toggle-mount--header" role="group" aria-label="Tema do app"></div>
<button type="button" id="nav-cart-toggle" class="hidden md:flex p-2 hover:bg-orange-50 rounded-full transition-all relative text-vibrant-orange" aria-label="Abrir carrinho" aria-expanded="false">
<span class="material-symbols-outlined">shopping_cart</span>
<span id="nav-cart-badge" class="absolute top-0 right-0 bg-vibrant-orange text-white text-[10px] font-bold min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center hidden">0</span>
</button>
</div>
</div>
${showAppChrome ? `<button type="button" id="ze-location-bar" class="ze-location-bar w-full max-w-container-max mx-auto text-left">
<span class="material-symbols-outlined text-vibrant-orange text-[18px] shrink-0">location_on</span>
<span class="truncate"><strong>Entregar em</strong> · <span id="ze-location-text">Informe seu endereço no carrinho</span></span>
<span class="material-symbols-outlined text-[18px] shrink-0 ml-auto text-[#999]">expand_more</span>
</button>
<form id="ze-search-form" class="ze-search-bar max-w-container-max mx-auto" role="search" action="pedidos.html" method="get">
<span class="material-symbols-outlined text-[20px] text-[#999] shrink-0">search</span>
<input type="search" name="q" id="ze-search-input" placeholder="${searchPlaceholder}" autocomplete="off" aria-label="Buscar produtos">
</form>` : ''}
</nav>
</header>`;

    const brandIcons = {
        whatsapp: 'img/icon-whatsapp.svg',
        instagram: 'img/icon-instagram.png',
        maps: 'img/icon-google-maps.png',
    };

    const mobileMenuHtml = `<div id="nav-mobile-menu" class="fixed inset-0 z-[60] hidden md:hidden" aria-hidden="true">
<div class="nav-mobile-backdrop absolute inset-0" data-nav-menu-close tabindex="-1" aria-hidden="true"></div>
<div class="nav-mobile-panel absolute top-0 right-0 flex h-full w-full max-w-[20rem] flex-col border-l border-surface-variant/40 bg-surface-gray shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="nav-mobile-menu-title">
<div class="flex shrink-0 items-center justify-between border-b border-surface-variant/30 px-4 py-3.5">
<p id="nav-mobile-menu-title" class="font-nav text-base font-bold text-gold-accent">Menu</p>
<button type="button" class="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-orange" data-nav-menu-close aria-label="Fechar menu">
<span class="material-symbols-outlined text-[24px]" aria-hidden="true">close</span>
</button>
</div>
<nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-4" aria-label="Navegação principal">
<a class="${accountActive ? navMobileActive : navMobileLink}" href="${accountHref}">
<span class="material-symbols-outlined text-[18px] align-middle mr-1" aria-hidden="true">person</span>
Minha conta
</a>
${navMobileLinksHtml}
</nav>
<a class="font-nav mx-4 mb-4 flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#25D366]/50 bg-[#25D366]/10 px-4 py-3 text-[15px] font-semibold text-on-surface hover:bg-[#25D366]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-orange" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">
<img alt="" src="${brandIcons.whatsapp}" class="h-5 w-5 shrink-0 object-contain" width="20" height="20" decoding="async">
                WhatsApp
            </a>
</div>
</div>`;

    const bottomTabItems = [
        { id: 'inicio', href: 'index.html', label: 'Início', icon: 'home' },
        { id: 'pedidos', href: 'pedidos.html', label: 'Categorias', icon: 'grid_view' },
        { id: 'cart', action: 'cart', label: 'Carrinho', icon: 'shopping_cart' },
        { id: 'contato', href: accountHref, label: 'Conta', icon: 'person' },
    ];

    const bottomNavHtml = `<nav id="app-bottom-nav" class="fixed bottom-0 left-0 right-0 z-50 md:hidden" aria-label="Navegação do app">
<div class="grid grid-cols-4 max-w-container-max mx-auto lig-bottom-nav-grid">
${bottomTabItems
    .map((item) => {
        const isActive = page === item.id;
        const activeClass = isActive ? 'app-tab-active text-vibrant-orange' : 'text-[#999]';
        if (item.action === 'cart') {
            return `<button type="button" id="app-tab-cart" class="relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] ${activeClass} transition-colors" aria-label="Abrir carrinho">
<span class="material-symbols-outlined text-[24px]">${item.icon}</span>
<span id="app-tab-cart-badge" class="absolute top-1.5 right-[calc(50%-22px)] bg-vibrant-orange text-white text-[9px] font-bold min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center hidden">0</span>
<span class="text-[10px] font-semibold">${item.label}</span>
</button>`;
        }
        return `<a href="${item.href}" class="flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] ${activeClass} transition-colors hover:text-vibrant-orange" ${isActive ? 'aria-current="page"' : ''}${item.id === 'contato' ? ' aria-label="Minha conta"' : ''}>
<span class="material-symbols-outlined text-[24px]">${item.icon}</span>
<span class="text-[10px] font-semibold">${item.label}</span>
</a>`;
    })
    .join('')}
</div>
</nav>`;

    const brandIcon = (src, px) =>
        `<img src="${src}" alt="" width="${px}" height="${px}" class="block shrink-0 object-contain" style="width:${px}px;height:${px}px" decoding="async">`;

    const footerHtml = `<footer class="lig-site-footer">
<div class="lig-footer-inner">
<div class="lig-footer-grid">
<div class="lig-footer-col lig-footer-col--brand">
<a class="lig-brand lig-footer-brand" href="index.html" aria-label="Ligeirinho App — início">
<img class="lig-brand__logo" src="img/ligeirinhologo.png" alt="" width="32" height="32" decoding="async">
<span class="lig-brand__wordmark"><span class="lig-brand__text">Ligeirinho</span><span class="lig-brand__app">App</span></span>
</a>
<p class="lig-footer-lead">Sua distribuidora de bebidas com rapidez, variedade e atendimento de confiança.</p>
<div class="lig-footer-social">
<a class="lig-footer-social-btn" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${brandIcon(brandIcons.whatsapp, 26)}</a>
<a class="lig-footer-social-btn" href="${instagramUrl}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${brandIcon(brandIcons.instagram, 26)}</a>
<a class="lig-footer-social-btn" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" aria-label="Google Maps">${brandIcon(brandIcons.maps, 26)}</a>
</div>
</div>
<div class="lig-footer-col">
<h4 class="lig-footer-title">Navegação</h4>
<nav class="lig-footer-nav" aria-label="Links do site">
<a class="lig-footer-link" href="index.html">Início</a>
<a class="lig-footer-link" href="pedidos.html">Catálogo</a>
<a class="lig-footer-link" href="quemsomos.html">Quem somos</a>
<a class="lig-footer-link" href="${accountHref}">Minha conta</a>
<a class="lig-footer-link" href="contato.html">Contato</a>
</nav>
</div>
<div class="lig-footer-col">
<h4 class="lig-footer-title">Fale conosco</h4>
<div class="lig-footer-nav">
<a class="lig-footer-link lig-footer-link--icon" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">${brandIcon(brandIcons.whatsapp, 20)}<span>WhatsApp · (11) 97092-4909</span></a>
<a class="lig-footer-link lig-footer-link--icon" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">${brandIcon(brandIcons.instagram, 20)}<span>Instagram</span></a>
</div>
</div>
<div class="lig-footer-col">
<h4 class="lig-footer-title">Encontre-nos</h4>
<div class="lig-footer-card">
<div class="lig-footer-card__row">
<span class="material-symbols-outlined lig-footer-card__icon">location_on</span>
<div>
<p class="lig-footer-card__label">Endereço</p>
<p class="lig-footer-card__text">Estr. do Campo Limpo, 2083<br>Vila Prel — São Paulo, SP<br>CEP 05777-001</p>
</div>
</div>
<div class="lig-footer-card__divider"></div>
<div class="lig-footer-card__row">
<span class="material-symbols-outlined lig-footer-card__icon">schedule</span>
<div class="lig-footer-card__schedule">
<p class="lig-footer-card__label">Horário</p>
<div class="lig-footer-schedule-row"><span>Seg – Sáb</span><span>08h – 20h</span></div>
<div class="lig-footer-schedule-row lig-footer-schedule-row--highlight"><span>Domingo</span><span>08h – 14h</span></div>
</div>
</div>
</div>
<a class="lig-footer-maps-btn" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
${brandIcon(brandIcons.maps, 20)}<span>Como chegar</span>
</a>
</div>
</div>
<div class="lig-footer-bar">
<p class="lig-footer-copy">© 2026 Ligeirinho App · Entrega de confiança · <span id="lig-app-version">…</span></p>
</div>
</div>
</footer>`;

    const navMount = document.getElementById('site-nav');
    const footerMount = document.getElementById('site-footer');

    let menuIsOpen = false;
    let menuBound = false;

    const lockMenuScroll = () => {
        document.documentElement.classList.add('lig-menu-open');
    };

    const unlockMenuScroll = () => {
        document.documentElement.classList.remove('lig-menu-open');
    };

    const clearBodyScrollStyles = () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
    };

    const resetPageLocks = () => {
        const menu = document.getElementById('nav-mobile-menu');
        const menuHidden = !menu || menu.classList.contains('hidden');

        if (menuHidden) {
            menuIsOpen = false;
            unlockMenuScroll();
        }
        clearBodyScrollStyles();
    };

    const bindMobileMenu = () => {
        if (menuBound) return;
        const menu = document.getElementById('nav-mobile-menu');
        const toggle = document.getElementById('nav-menu-toggle');
        const iconMenu = toggle?.querySelector('.nav-menu-icon-menu');
        const iconClose = toggle?.querySelector('.nav-menu-icon-close');
        if (!menu || !toggle) return;
        menuBound = true;

        const setOpen = (open) => {
            if (menuIsOpen === open) return;
            menuIsOpen = open;

            if (open) {
                if (window.LigeirinhoCartUI?.isOpen?.()) {
                    window.LigeirinhoCartUI.close();
                }
                lockMenuScroll();
            } else {
                unlockMenuScroll();
            }

            menu.classList.toggle('hidden', !open);
            menu.setAttribute('aria-hidden', open ? 'false' : 'true');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
            iconMenu?.classList.toggle('hidden', open);
            iconClose?.classList.toggle('hidden', !open);
        };

        const closeMobileMenu = () => setOpen(false);
        const openMenu = () => {
            if (window.matchMedia('(min-width: 768px)').matches) return;
            setOpen(true);
        };

        window.LigeirinhoNav = { closeMobileMenu, isOpen: () => menuIsOpen, resetPageLocks };

        window.addEventListener('pageshow', resetPageLocks);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') resetPageLocks();
        });

        toggle.addEventListener('click', () => {
            if (menuIsOpen) closeMobileMenu();
            else openMenu();
        });

        menu.addEventListener('click', (e) => {
            if (e.target.closest('[data-nav-menu-close]')) {
                closeMobileMenu();
                return;
            }
            if (e.target.closest('nav a[href]')) {
                closeMobileMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menuIsOpen) {
                closeMobileMenu();
                toggle.focus({ preventScroll: true });
            }
        });

        window.matchMedia('(min-width: 768px)').addEventListener('change', (e) => {
            if (e.matches) closeMobileMenu();
        });
    };

    const bindAppChrome = () => {
        const locationBar = document.getElementById('ze-location-bar');
        const locationText = document.getElementById('ze-location-text');
        const searchForm = document.getElementById('ze-search-form');
        const searchInput = document.getElementById('ze-search-input');

        const syncLocation = () => {
            if (!locationText) return;
            const checkout = window.LigeirinhoCart?.loadCheckout?.();
            if (!checkout) return;
            if (checkout.deliveryType === 'retirada') {
                locationText.textContent = 'Retirada na loja';
                return;
            }
            locationText.textContent = checkout.address?.trim() || 'Informe seu endereço no carrinho';
        };

        locationBar?.addEventListener('click', () => {
            window.LigeirinhoCartUI?.open?.();
        });

        window.addEventListener('ligeirinho-checkout-changed', syncLocation);
        syncLocation();

        if (searchForm && page === 'pedidos') {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const q = searchInput?.value?.trim();
                if (q) {
                    const url = new URL(window.location.href);
                    url.searchParams.set('q', q);
                    window.location.href = url.toString();
                }
            });
            const qParam = new URLSearchParams(window.location.search).get('q');
            if (qParam && searchInput) searchInput.value = qParam;
        }

        if (searchForm && page === 'inicio') {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const q = searchInput?.value?.trim();
                window.location.href = q ? `pedidos.html?q=${encodeURIComponent(q)}` : 'pedidos.html';
            });
        }
    };

    const bindBottomNav = () => {
        document.documentElement.classList.add('lig-app-mode');

        const tabCart = document.getElementById('app-tab-cart');
        tabCart?.addEventListener('click', (e) => {
            e.preventDefault();
            window.LigeirinhoCartUI?.open?.();
        });

        const syncTabBadge = () => {
            const badge = document.getElementById('app-tab-cart-badge');
            const navBadge = document.getElementById('nav-cart-badge');
            if (!badge || !navBadge) return;
            badge.textContent = navBadge.textContent;
            badge.classList.toggle('hidden', navBadge.classList.contains('hidden'));
        };

        window.addEventListener('ligeirinho-cart-changed', syncTabBadge);
        syncTabBadge();
    };

    if (navMount && page !== 'login') {
        navMount.outerHTML = navHtml;
        if (!document.getElementById('nav-mobile-menu')) {
            document.body.insertAdjacentHTML('beforeend', mobileMenuHtml);
        }
        if (!document.getElementById('app-bottom-nav') && page !== 'login') {
            document.body.insertAdjacentHTML('beforeend', bottomNavHtml);
        }
        bindMobileMenu();
        bindBottomNav();
        bindAppChrome();
    }

    if (page === 'login') {
        window.LigeirinhoThemeUI?.renderAll?.();
        return;
    }
    if (footerMount) {
        footerMount.outerHTML = footerHtml;
    }

    window.LigeirinhoThemeUI?.renderAll?.();

    window.LigeirinhoCart?.updateNavCartBadge();
    window.LigeirinhoCartUI?.init();
    window.LigeirinhoCartUI?.bindNavToggle();

    if (document.body.dataset.page === 'quemsomos') {
        resetPageLocks();
    }

    if (page !== 'login' && !document.querySelector('script[data-lig-app-version]')) {
        const versionScript = document.createElement('script');
        versionScript.src = 'js/app-version.js';
        versionScript.dataset.ligAppVersion = '1';
        document.body.appendChild(versionScript);
    }
})();
