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
    const appSectionPages = new Set([
        'inicio',
        'ofertas',
        'pedidos',
        'raios',
        'caminhao',
        'conta',
        'pagamento',
        'pedido',
        'financeiro',
    ]);
    const showSiteFooter = !appSectionPages.has(page);
    const instagramUrl = 'https://www.instagram.com/oficialligeirinhobebidas/?hl=pt';
    const whatsappUrl =
        'https://api.whatsapp.com/send/?phone=5511970924909&text&type=phone_number&app_absent=0&utm_source=ig';
    const mapsUrl =
        'https://www.google.com/maps/search/?api=1&query=Estr.+do+Campo+Limpo,+2083+-+Vila+Prel,+S%C3%A3o+Paulo+-+SP,+05777-001';

    const accountHref = 'conta.html';
    const accountActive = page === 'conta';
    const accountLinkClass = accountActive
        ? 'font-nav lig-nav-account lig-nav-account--active'
        : 'font-nav lig-nav-account';

    const loginHref = (next) => {
        const q = next ? `?next=${encodeURIComponent(next)}` : '';
        return `/${q}`;
    };

    const navMobileLink =
        'font-nav block w-full min-h-[48px] px-4 py-3 rounded-lg text-[15px] font-semibold text-on-surface-variant hover:text-vibrant-yellow hover:bg-surface-variant/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-yellow';
    const navMobileActive =
        'font-nav block w-full min-h-[48px] px-4 py-3 rounded-lg text-[15px] font-bold text-vibrant-yellow bg-vibrant-yellow/10 border border-vibrant-yellow/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-yellow';

    const renderDesktopNavLink = (item) => {
        const active = page === item.id;
        return `<a class="lig-desktop-nav__link${active ? ' lig-desktop-nav__link--active' : ''}" href="${item.href}"${active ? ' aria-current="page"' : ''}>${item.label}</a>`;
    };

    const appNavItems = [
        { id: 'ofertas', href: 'ofertas.html', label: 'Ofertas', icon: 'sell' },
        { id: 'pedidos', href: 'pedidos.html', label: 'Catálogo', icon: 'grid_view' },
        { id: 'raios', href: 'raios.html', label: 'Club Raios', icon: 'bolt' },
    ];

    const institutionalNavItems = [
        { id: 'quemsomos', href: 'quemsomos.html', label: 'Quem Somos', icon: 'storefront' },
        { id: 'contato', href: 'contato.html', label: 'Fale conosco', icon: 'chat' },
    ];

    const navItems = [
        { id: 'inicio', href: 'inicio.html', label: 'Início', icon: 'home' },
        ...appNavItems,
        ...institutionalNavItems,
    ];

    const session = window.LigeirinhoAuth?.loadSession?.();
    const financeRole = String(session?.role || '').toUpperCase();
    if (financeRole === 'ADMIN' || financeRole === 'OPERADOR') {
        navItems.push({ id: 'financeiro', href: 'financeiro.html', label: 'Financeiro', icon: 'payments' });
    }

    const desktopAppNavItems = [
        { id: 'inicio', href: 'inicio.html', label: 'Início', icon: 'home' },
        ...appNavItems,
    ];
    const desktopInstitutionalItems = [...institutionalNavItems];
    const desktopFinanceItems =
        financeRole === 'ADMIN' || financeRole === 'OPERADOR'
            ? [{ id: 'financeiro', href: 'financeiro.html', label: 'Financeiro', icon: 'payments' }]
            : [];

    const desktopNavHtml = `<nav class="lig-desktop-nav hidden md:flex" aria-label="Navegação principal">
<div class="lig-desktop-nav__track">
<div class="lig-desktop-nav__group">
${desktopAppNavItems.map(renderDesktopNavLink).join('\n')}
</div>
<span class="lig-desktop-nav__sep" aria-hidden="true"></span>
<div class="lig-desktop-nav__group lig-desktop-nav__group--site">
${desktopInstitutionalItems.map(renderDesktopNavLink).join('\n')}
${desktopFinanceItems.map(renderDesktopNavLink).join('\n')}
</div>
</div>
</nav>`;

    const navMobileLinksHtml = navItems
        .map(
            (item) =>
                `<a class="${page === item.id ? navMobileActive : navMobileLink}" href="${item.href}">${item.label}</a>`
        )
        .join('\n');

    const showAppChrome = page === 'inicio' || page === 'pedidos';
    const searchPlaceholder =
        page === 'pedidos' ? 'Buscar no catálogo...' : page === 'inicio' ? 'Pesquisar no Ligeirinho' : 'O que você quer pedir?';
    const homeMobileHeader = page === 'inicio' ? ' ze-app-header--home-mobile' : '';

    const navHtml = `<header class="ze-app-header${homeMobileHeader} sticky top-0 z-50">
<nav class="font-nav-bar">
<div class="lig-header-main flex justify-between items-center w-full px-4 md:px-margin-desktop py-2.5 max-w-container-max mx-auto min-h-[56px] gap-4">
<a class="lig-brand nav-brand shrink-0" href="inicio.html" aria-label="Ligeirinho Parceiros — início">
<img class="lig-brand__logo" src="img/ligeirinhologo.png" alt="" width="36" height="36" decoding="async">
<span class="lig-brand__wordmark"><span class="lig-brand__text">Ligeirinho</span><span class="lig-brand__app">Parceiros</span></span>
</a>
${desktopNavHtml}
<div class="lig-header-actions flex items-center gap-0.5 shrink-0">
<a href="${accountHref}" class="${accountLinkClass} hidden md:inline-flex" aria-current="${accountActive ? 'page' : 'false'}">
<span class="material-symbols-outlined lig-nav-account__icon" aria-hidden="true">person</span>
<span class="lig-nav-account__label">Minha conta</span>
</a>
<div id="lig-notifications-mount" class="shrink-0"></div>
<button type="button" data-install-trigger class="lig-install-nav-btn" aria-label="Baixar app" title="Baixar app">
<span class="material-symbols-outlined lig-install-trigger-icon" aria-hidden="true">download</span>
</button>
<div data-lig-theme-mount class="lig-theme-toggle-mount lig-theme-toggle-mount--header" role="group" aria-label="Tema do app"></div>
<button type="button" id="nav-cart-toggle" class="lig-header-cart hidden md:flex" aria-label="Abrir caminhão" aria-expanded="false">
<span class="material-symbols-outlined" aria-hidden="true">local_shipping</span>
<span id="nav-cart-badge" class="lig-header-cart__badge hidden">0</span>
</button>
</div>
</div>
${showAppChrome && page !== 'conta' && page !== 'raios' ? `<button type="button" id="ze-location-bar" class="ze-fulfillment-bar ze-location-bar w-full max-w-container-max mx-auto text-left" aria-label="Forma de recebimento e endereço">
<span class="ze-fulfillment-bar__icon-wrap" aria-hidden="true">
<span class="material-symbols-outlined ze-fulfillment-bar__icon" id="ze-location-icon">location_on</span>
</span>
<span class="ze-fulfillment-bar__copy min-w-0">
<span class="ze-fulfillment-bar__label" id="ze-location-label">Entrega</span>
<span class="ze-fulfillment-bar__meta truncate" id="ze-location-text">Informe seu endereço de entrega</span>
</span>
<span class="material-symbols-outlined ze-fulfillment-bar__chev" aria-hidden="true">expand_more</span>
</button>
<form id="ze-search-form" class="ze-search-bar max-w-container-max mx-auto" role="search" action="pedidos.html" method="get">
<span class="material-symbols-outlined text-[20px] text-[var(--lig-text-subtle)] shrink-0">search</span>
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
<p id="nav-mobile-menu-title" class="font-nav text-base font-bold text-vibrant-yellow">Menu</p>
<button type="button" class="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-yellow" data-nav-menu-close aria-label="Fechar menu">
<span class="material-symbols-outlined text-[24px]" aria-hidden="true">close</span>
</button>
</div>
<nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-4" aria-label="Navegação principal">
<a class="${accountActive ? navMobileActive : navMobileLink}" href="${accountHref}">
<span class="material-symbols-outlined text-[18px] align-middle mr-1" aria-hidden="true">person</span>
Minha conta
</a>
${navMobileLinksHtml}
<button type="button" class="${navMobileLink} w-full text-left" data-install-trigger>
<span class="material-symbols-outlined text-[18px] align-middle mr-1 lig-install-trigger-icon" aria-hidden="true">download</span>
<span class="lig-install-trigger-label">Baixar app</span>
</button>
</nav>
<a class="font-nav mx-4 mb-4 flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-[#25D366]/50 bg-[#25D366]/10 px-4 py-3 text-[15px] font-semibold text-on-surface hover:bg-[#25D366]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-yellow" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">
<img alt="" src="${brandIcons.whatsapp}" class="h-5 w-5 shrink-0 object-contain" width="20" height="20" decoding="async">
                WhatsApp
            </a>
</div>
</div>`;

    const bottomTabItems = [
        { id: 'inicio', href: 'inicio.html', label: 'Início', icon: 'home' },
        { id: 'ofertas', href: 'ofertas.html', label: 'Ofertas', icon: 'sell' },
        { id: 'pedidos', href: 'pedidos.html', label: 'Catálogo', icon: 'grid_view' },
        { id: 'raios', href: 'raios.html', label: 'Raios', icon: 'bolt' },
        { id: 'caminhao', href: 'caminhao.html', label: 'Caminhão', icon: 'local_shipping' },
        { id: 'conta', href: accountHref, label: 'Conta', icon: 'person' },
    ];

    const bottomNavHtml = `<nav id="app-bottom-nav" class="fixed bottom-0 left-0 right-0 z-50 md:hidden" aria-label="Navegação do app">
<div class="grid grid-cols-6 max-w-container-max mx-auto lig-bottom-nav-grid lig-bottom-nav-grid--6">
${bottomTabItems
    .map((item) => {
        const isActive = page === item.id;
        const activeClass = isActive ? 'app-tab-active text-vibrant-yellow' : 'text-[var(--lig-text-subtle)]';
        return `<a href="${item.href}" class="relative flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] ${activeClass} transition-colors hover:text-vibrant-yellow"${item.id === 'caminhao' ? ' id="app-tab-cart"' : ''} ${isActive ? 'aria-current="page"' : ''}${item.id === 'conta' ? ' aria-label="Minha conta"' : ''}${item.id === 'caminhao' ? ' aria-label="Caminhão"' : ''}>
<span class="material-symbols-outlined text-[24px]">${item.icon}</span>
${item.id === 'caminhao' ? '<span id="app-tab-cart-badge" class="absolute top-1.5 right-[calc(50%-22px)] bg-vibrant-yellow text-deep-black text-[9px] font-bold min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center hidden">0</span>' : ''}
<span class="text-[10px] font-semibold">${item.label}</span>
</a>`;
    })
    .join('')}
</div>
</nav>`;

    const brandIcon = (src, px) =>
        `<img src="${src}" alt="" width="${px}" height="${px}" class="block shrink-0 object-contain" style="width:${px}px;height:${px}px" decoding="async">`;

    const footerClass = showSiteFooter ? 'lig-site-footer hidden md:block' : 'lig-site-footer';
    const footerHtml = `<footer class="${footerClass}">
<div class="lig-footer-inner">
<div class="lig-footer-grid">
<div class="lig-footer-col lig-footer-col--brand">
<a class="lig-brand lig-footer-brand" href="inicio.html" aria-label="Ligeirinho Parceiros — início">
<img class="lig-brand__logo" src="img/ligeirinhologo.png" alt="" width="32" height="32" decoding="async">
<span class="lig-brand__wordmark"><span class="lig-brand__text">Ligeirinho</span><span class="lig-brand__app">Parceiros</span></span>
</a>
<p class="lig-footer-lead">Atacado em caixas e pallets para revendedores parceiros — rapidez e confiança na entrega.</p>
<div class="lig-footer-social">
<a class="lig-footer-social-btn" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${brandIcon(brandIcons.whatsapp, 26)}</a>
<a class="lig-footer-social-btn" href="${instagramUrl}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${brandIcon(brandIcons.instagram, 26)}</a>
<a class="lig-footer-social-btn" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" aria-label="Google Maps">${brandIcon(brandIcons.maps, 26)}</a>
</div>
</div>
<div class="lig-footer-col">
<h4 class="lig-footer-title">Navegação</h4>
<nav class="lig-footer-nav" aria-label="Links do site">
<a class="lig-footer-link" href="inicio.html">Início</a>
<a class="lig-footer-link" href="ofertas.html">Ofertas</a>
<a class="lig-footer-link" href="pedidos.html">Catálogo</a>
<a class="lig-footer-link" href="raios.html">Club Raios</a>
<a class="lig-footer-link" href="caminhao.html">Caminhão</a>
<a class="lig-footer-link" href="${accountHref}">Minha conta</a>
<a class="lig-footer-link" href="quemsomos.html">Quem somos</a>
<a class="lig-footer-link" href="contato.html">Fale conosco</a>
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
<p class="lig-footer-copy">© 2026 Ligeirinho Parceiros · Entrega de confiança · <span id="lig-app-version">…</span></p>
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

        window.LigeirinhoNav = { closeMobileMenu, isOpen: () => menuIsOpen, resetPageLocks, loginHref };

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
        const searchForm = document.getElementById('ze-search-form');
        const searchInput = document.getElementById('ze-search-input');

        const PICKUP_META = 'Estr. Campo Limpo, 2083 · SP';

        const syncLocation = () => {
            const labelEl = document.getElementById('ze-location-label');
            const metaEl = document.getElementById('ze-location-text');
            const iconEl = document.getElementById('ze-location-icon');
            if (!labelEl || !metaEl) return;

            const checkout = window.LigeirinhoCart?.loadCheckout?.();
            const emptyAddress = 'Toque para informar o endereço';

            if (!checkout) {
                labelEl.textContent = 'Entrega';
                metaEl.textContent = emptyAddress;
                if (iconEl) iconEl.textContent = 'add_location_alt';
                locationBar?.setAttribute('aria-label', 'Entrega. Toque para informar o endereço.');
                return;
            }

            if (checkout.deliveryType === 'retirada') {
                labelEl.textContent = 'Retirada no depósito';
                metaEl.textContent = PICKUP_META;
                if (iconEl) iconEl.textContent = 'storefront';
                locationBar?.setAttribute('aria-label', 'Retirada no depósito. Toque para alterar.');
                return;
            }

            labelEl.textContent = 'Entrega';
            metaEl.textContent = checkout.address?.trim() || emptyAddress;
            if (iconEl) iconEl.textContent = checkout.address?.trim() ? 'location_on' : 'add_location_alt';
            locationBar?.setAttribute(
                'aria-label',
                checkout.address?.trim()
                    ? `Entrega em ${checkout.address}. Toque para alterar.`
                    : 'Entrega. Toque para informar o endereço.'
            );
        };

        locationBar?.addEventListener('click', () => {
            window.LigeirinhoCartUI?.open?.({ focusAddress: true });
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

    const ensureScript = (src) =>
        new Promise((resolve) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => resolve();
            document.body.appendChild(script);
        });

    const initHeaderExtras = () => {
        Promise.all([
            ensureScript('js/auth-store.js'),
            ensureScript('js/install-app.js'),
            ensureScript('js/hub-notifications.js'),
        ]).then(() => {
            window.LigeirinhoInstall?.init?.();
            window.LigeirinhoHubNotifications?.mount?.('#lig-notifications-mount');
        });
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
        initHeaderExtras();
    }

    window.addEventListener('ligeirinho-auth-changed', () => {
        window.LigeirinhoHubNotifications?.mount?.('#lig-notifications-mount');
    });

    if (page === 'login') {
        window.LigeirinhoThemeUI?.renderAll?.();
        return;
    }
    if (footerMount) {
        if (showSiteFooter) {
            footerMount.outerHTML = footerHtml;
        } else {
            footerMount.remove();
        }
    }

    window.LigeirinhoThemeUI?.renderAll?.();

    window.LigeirinhoCart?.updateNavCartBadge();
    window.LigeirinhoCartUI?.init();
    window.LigeirinhoCartUI?.bindNavToggle();

    const caminhaoParam = new URLSearchParams(window.location.search).get('caminhao');
    if (caminhaoParam === 'open' && window.LigeirinhoCartUI) {
        window.LigeirinhoCartUI.open?.();
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('caminhao');
        window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    }

    if (document.body.dataset.page === 'quemsomos') {
        resetPageLocks();
    }

    if (page !== 'login' && !document.querySelector('script[data-lig-app-version]')) {
        const versionScript = document.createElement('script');
        versionScript.src = 'js/app-version.js';
        versionScript.dataset.ligAppVersion = '1';
        document.body.appendChild(versionScript);
    }

    if (page !== 'login' && page !== 'totem' && page !== 'totem-pagamento' && page !== 'totem-sucesso') {
        ensureScript('js/motion.js').then(() => {
            window.LigeirinhoMotion?.refresh?.();
        });
    }
})();
