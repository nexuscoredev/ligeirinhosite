(function () {
    if (!document.getElementById('ligeirinho-nav-font')) {
        const fontLink = document.createElement('link');
        fontLink.id = 'ligeirinho-nav-font';
        fontLink.rel = 'stylesheet';
        fontLink.href =
            'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap';
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
            nav.font-nav-bar .nav-link {
                font-size: 0.9375rem;
                font-weight: 600;
                letter-spacing: 0.02em;
            }
            nav.font-nav-bar .nav-link-active {
                font-weight: 700;
                letter-spacing: 0.01em;
            }
        `;
        document.head.appendChild(fontStyle);
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
        'font-nav nav-link text-on-surface-variant hover:text-gold-accent transition-colors duration-200 hover:bg-surface-variant/40 px-3 py-1.5 rounded-md';

    const navItems = [
        { id: 'inicio', href: 'index.html', label: 'Início' },
        { id: 'pedidos', href: 'pedidos.html', label: 'Pedidos' },
        { id: 'quemsomos', href: 'quemsomos.html', label: 'Quem Somos' },
    ];

    const navLinksHtml = navItems
        .map(
            (item) =>
                `<a class="${page === item.id ? navActive : navLink}" href="${item.href}">${item.label}</a>`
        )
        .join('\n');

    const navHtml = `<nav class="font-nav-bar bg-deep-black/90 backdrop-blur-xl dark:bg-deep-black/90 docked full-width top-0 sticky z-50 border-b border-surface-variant/30 shadow-lg shadow-vibrant-orange/5">
<div class="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-3.5 max-w-container-max mx-auto">
<a class="font-nav nav-brand text-gold-accent flex items-center gap-2.5 group" href="index.html">
<img alt="" src="img/ligeirinhologo.png" class="h-8 w-8 object-contain group-hover:rotate-12 transition-transform" width="32" height="32">
                Ligeirinho Bebidas
            </a>
<div class="hidden md:flex items-center gap-8">
${navLinksHtml}
</div>
<div class="flex items-center gap-4 text-vibrant-orange dark:text-gold-accent">
<button type="button" id="nav-cart-toggle" class="p-2 hover:bg-surface-variant/50 rounded-full transition-all duration-200 scale-95 active:scale-90 relative" aria-label="Abrir seu pedido" aria-expanded="false" aria-controls="cart-panel cart-mobile-sheet">
<span class="material-symbols-outlined">shopping_cart</span>
<span id="nav-cart-badge" class="absolute top-0 right-0 bg-vibrant-orange text-deep-black text-[10px] font-bold min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center hidden">0</span>
</button>
<button type="button" class="md:hidden p-2 text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-all duration-200" aria-label="Abrir menu">
<span class="material-symbols-outlined">menu</span>
</button>
</div>
</div>
</nav>`;

    const brandIcons = {
        whatsapp: 'img/icon-whatsapp.svg',
        instagram: 'img/icon-instagram.png',
        maps: 'img/icon-google-maps.png',
    };

    const brandIcon = (src, px) =>
        `<img src="${src}" alt="" width="${px}" height="${px}" class="block shrink-0 object-contain" style="width:${px}px;height:${px}px" decoding="async">`;

    const socialPill =
        'flex h-12 w-12 items-center justify-center rounded-full bg-surface-gray border border-surface-variant/40 hover:border-vibrant-orange/40 hover:bg-surface-container-high transition-all duration-200';
    const footerHeading =
        'font-headline-md text-headline-md text-gold-accent mb-3 tracking-tight';
    const footerLink =
        'group font-body-md text-body-md text-on-surface-variant hover:text-vibrant-orange transition-colors flex items-center gap-3 py-2';
    const footerCard =
        'rounded-xl border border-surface-variant/25 bg-surface-gray/40 p-4 space-y-3';

    const footerHtml = `<footer class="bg-deep-black dark:bg-deep-black full-width bg-surface-container-lowest border-t border-surface-variant/20 mt-auto">
<div class="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-gutter px-margin-mobile md:px-margin-desktop py-12 max-w-container-max mx-auto">
<div class="md:col-span-4 flex flex-col gap-4">
<a class="text-headline-md font-headline-lg text-vibrant-orange flex items-center gap-2" href="index.html">
<img alt="" src="img/ligeirinhologo.png" class="h-8 w-8 object-contain" width="32" height="32">
                    Ligeirinho Bebidas
                </a>
<p class="font-body-md text-body-md text-on-surface-variant max-w-sm leading-relaxed">
                    Sua distribuidora de bebidas com rapidez, variedade e atendimento de confiança.
                </p>
<div class="flex flex-wrap gap-3 pt-1">
<a class="${socialPill}" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${brandIcon(brandIcons.whatsapp, 28)}</a>
<a class="${socialPill}" href="${instagramUrl}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${brandIcon(brandIcons.instagram, 28)}</a>
<a class="${socialPill}" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" aria-label="Google Maps">${brandIcon(brandIcons.maps, 28)}</a>
</div>
</div>
<div class="md:col-span-3 flex flex-col">
<h4 class="${footerHeading}">Fale conosco</h4>
<div class="flex flex-col gap-1">
<a class="${footerLink}" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">${brandIcon(brandIcons.whatsapp, 22)}<span>WhatsApp</span></a>
<a class="${footerLink}" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">${brandIcon(brandIcons.instagram, 22)}<span>Instagram</span></a>
</div>
</div>
<div class="md:col-span-5 flex flex-col gap-4">
<h4 class="${footerHeading}">Encontre-nos</h4>
<div class="${footerCard}">
<div class="flex items-start gap-3">
<span class="material-symbols-outlined text-gold-accent text-[20px] mt-0.5 shrink-0">location_on</span>
<div>
<p class="font-label-caps text-label-caps text-gold-accent mb-1.5">Endereço</p>
<p class="font-body-md text-body-md text-on-surface leading-relaxed">Estr. do Campo Limpo, 2083<br>Vila Prel — São Paulo, SP<br>CEP: 05777-001</p>
</div>
</div>
<div class="h-px bg-surface-variant/30"></div>
<div class="flex items-start gap-3">
<span class="material-symbols-outlined text-gold-accent text-[20px] mt-0.5 shrink-0">schedule</span>
<div class="w-full">
<p class="font-label-caps text-label-caps text-gold-accent mb-2">Horário de funcionamento</p>
<div class="space-y-1.5 font-body-md text-body-md">
<div class="flex justify-between gap-4 text-on-surface-variant"><span>Segunda – Sexta</span><span class="text-on-surface">08h – 20h</span></div>
<div class="flex justify-between gap-4 text-on-surface-variant"><span>Sábado</span><span class="text-on-surface">08h – 20h</span></div>
<div class="flex justify-between gap-4 pt-1.5 border-t border-surface-variant/20"><span class="text-vibrant-orange font-semibold">Domingo</span><span class="text-vibrant-orange font-semibold">08h – 14h</span></div>
</div>
</div>
</div>
</div>
<a class="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-vibrant-orange/10 hover:bg-vibrant-orange border border-vibrant-orange/50 hover:border-vibrant-orange text-vibrant-orange hover:text-deep-black font-headline-md text-[16px] py-3 px-5 rounded-lg transition-all duration-200" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
${brandIcon(brandIcons.maps, 22)}
                    Como chegar
                </a>
</div>
</div>
<div class="w-full border-t border-surface-variant/10 py-6 px-margin-mobile md:px-margin-desktop text-center md:text-left">
<div class="max-w-container-max mx-auto">
<p class="font-label-caps text-label-caps text-on-surface-variant opacity-60">© 2026 Ligeirinho Bebidas. Entrega de confiança.</p>
</div>
</div>
</footer>`;

    const navMount = document.getElementById('site-nav');
    const footerMount = document.getElementById('site-footer');

    if (navMount) {
        navMount.outerHTML = navHtml;
    }
    if (footerMount) {
        footerMount.outerHTML = footerHtml;
    }

    window.LigeirinhoCart?.updateNavCartBadge();
    window.LigeirinhoCartUI?.init();
    window.LigeirinhoCartUI?.bindNavToggle();
})();
