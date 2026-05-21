(function () {
    const page = document.body.dataset.page || '';
    const instagramUrl = 'https://www.instagram.com/oficialligeirinhobebidas/?hl=pt';
    const whatsappUrl = 'https://api.whatsapp.com/send/?phone=5511970924909&text&type=phone_number&app_absent=0&utm_source=ig';
    const mapsUrl =
        'https://www.google.com/maps/search/?api=1&query=Estr.+do+Campo+Limpo,+2083+-+Vila+Prel,+S%C3%A3o+Paulo+-+SP,+05777-001';

    const navActive =
        'text-vibrant-orange font-bold border-b-2 border-vibrant-orange pb-1 scale-95 active:scale-90 transition-transform';
    const navLink =
        'text-on-surface-variant hover:text-gold-accent transition-colors duration-300 hover:bg-surface-variant/50 transition-all duration-200 px-3 py-1 rounded';

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

    const navHtml = `<nav class="bg-deep-black/90 backdrop-blur-xl dark:bg-deep-black/90 docked full-width top-0 sticky z-50 border-b border-surface-variant/30 shadow-lg shadow-vibrant-orange/5">
<div class="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
<a class="text-headline-md font-headline-lg-mobile text-gold-accent tracking-tight flex items-center gap-2 group" href="index.html">
<img alt="" src="img/ligeirinhologo.png" class="h-8 w-8 object-contain group-hover:rotate-12 transition-transform" width="32" height="32">
                Ligeirinho Bebidas
            </a>
<div class="hidden md:flex items-center gap-8">
${navLinksHtml}
</div>
<div class="flex items-center gap-4 text-vibrant-orange dark:text-gold-accent">
<button type="button" class="p-2 hover:bg-surface-variant/50 rounded-full transition-all duration-200 scale-95 active:scale-90 relative" aria-label="Carrinho">
<span class="material-symbols-outlined">shopping_cart</span>
<span class="absolute top-0 right-0 bg-vibrant-orange text-deep-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">3</span>
</button>
<button type="button" class="p-2 hover:bg-surface-variant/50 rounded-full transition-all duration-200 scale-95 active:scale-90" aria-label="Conta">
<span class="material-symbols-outlined">account_circle</span>
</button>
<button type="button" class="md:hidden p-2 text-on-surface-variant hover:bg-surface-variant/50 rounded-full transition-all duration-200" aria-label="Abrir menu">
<span class="material-symbols-outlined">menu</span>
</button>
</div>
</div>
</nav>`;

    const footerHeading =
        'font-headline-md text-headline-md md:font-headline-lg md:text-headline-lg text-gold-accent mb-4';
    const footerLink =
        'font-body-lg text-body-lg text-on-surface hover:text-vibrant-orange transition-colors flex items-center gap-2.5 py-1';
    const footerIcon =
        'text-on-surface-variant hover:text-vibrant-orange transition-colors opacity-80 hover:opacity-100 p-2 rounded-full hover:bg-surface-variant/30';
    const brandIcon = (file, sizeClass = 'h-6 w-6') =>
        `<img src="img/${file}" alt="" class="${sizeClass} object-contain shrink-0" width="24" height="24" loading="lazy">`;

    const footerHtml = `<footer class="bg-deep-black dark:bg-deep-black full-width bg-surface-container-lowest border-t border-surface-variant/20 flat no shadows mt-auto">
<div class="grid grid-cols-1 md:grid-cols-3 gap-gutter px-margin-mobile md:px-margin-desktop py-12 max-w-container-max mx-auto">
<div class="flex flex-col gap-4">
<a class="text-headline-md font-headline-lg text-vibrant-orange flex items-center gap-2" href="index.html">
<img alt="" src="img/ligeirinhologo.png" class="h-8 w-8 object-contain" width="32" height="32">
                    Ligeirinho Bebidas
                </a>
<p class="font-body-md text-body-md text-on-surface-variant max-w-xs">
                    Sua distribuidora de bebidas com rapidez, variedade e atendimento de confiança.
                </p>
<div class="flex gap-2 mt-2">
<a class="${footerIcon}" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${brandIcon('icon-whatsapp.svg')}</a>
<a class="${footerIcon}" href="${instagramUrl}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${brandIcon('icon-instagram.svg')}</a>
<a class="${footerIcon}" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" aria-label="Google Maps">${brandIcon('icon-google-maps.svg')}</a>
</div>
</div>
<div class="flex flex-col gap-2 md:gap-3">
<h4 class="${footerHeading}">Fale conosco</h4>
<a class="${footerLink}" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">${brandIcon('icon-whatsapp.svg', 'h-5 w-5')}WhatsApp</a>
<a class="${footerLink}" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">${brandIcon('icon-instagram.svg', 'h-5 w-5')}Instagram</a>
</div>
<div class="flex flex-col gap-2 md:gap-3">
<h4 class="${footerHeading}">Encontre-nos</h4>
<p class="font-body-md text-body-md text-on-surface-variant max-w-xs">Estr. do Campo Limpo, 2083<br>Vila Prel — São Paulo, SP<br>CEP: 05777-001</p>
<p class="font-body-md text-body-md text-on-surface-variant">Segunda a sábado: 08h às 20h<br>Domingo: 08h às 14h</p>
<a class="${footerLink}" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
${brandIcon('icon-google-maps.svg', 'h-5 w-5')}
                    Como chegar
                </a>
</div>
</div>
<div class="w-full border-t border-surface-variant/10 py-6 px-margin-mobile md:px-margin-desktop text-center md:text-left">
<div class="max-w-container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
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
})();
