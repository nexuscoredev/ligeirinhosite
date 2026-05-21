(function () {
    const page = document.body.dataset.page || '';
    const instagramUrl = 'https://www.instagram.com/oficialligeirinhobebidas/?hl=pt';
    const whatsappUrl =
        'https://api.whatsapp.com/send/?phone=5511970924909&text&type=phone_number&app_absent=0&utm_source=ig';
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

    const iconSvg = {
        whatsapp: (className) =>
            `<svg class="${className}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
        instagram: (className, gradientId) =>
            `<svg class="${className}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${gradientId}" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#F58529"/><stop offset="50%" stop-color="#DD2A7B"/><stop offset="100%" stop-color="#8134AF"/></linearGradient></defs><path fill="url(#${gradientId})" d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.974 1.246 2.241 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.974.974-2.241 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.974-.974-1.246-2.241-1.308-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.974-.974 2.241-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.014 7.052.072 5.775.13 4.602.402 3.635 1.37 2.668 2.337 2.396 3.51 2.338 4.788 2.28 6.068 2.266 6.477 2.266 12c0 5.523.014 5.932.072 7.212.058 1.278.33 2.451 1.297 3.418.967.967 2.14 1.239 3.418 1.297 1.28.058 1.689.072 7.212.072s5.932-.014 7.212-.072c1.278-.058 2.451-.33 3.418-1.297.967-.967 1.239-2.14 1.297-3.418.058-1.28.072-1.689.072-7.212s-.014-5.932-.072-7.212c-.058-1.278-.33-2.451-1.297-3.418-.967-.967-2.14-1.239-3.418-1.297C15.932.014 15.523 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
        maps: (className) =>
            `<svg class="${className}" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#48b564" d="M24 4C14.6 4 7 11.6 7 21c0 12.5 17 23 17 23s17-10.5 17-23C41 11.6 33.4 4 24 4z"/><path fill="#fec412" d="M24 4v44s17-10.5 17-23C41 11.6 33.4 4 24 4z"/><path fill="#d33f2f" d="M24 4C14.6 4 7 11.6 7 21c0 1.7.3 3.4.8 5h32.4c.5-1.6.8-3.3.8-5 0-9.4-7.6-17-17-17z"/><circle fill="#fff" cx="24" cy="21" r="7"/><circle fill="#4285f4" cx="24" cy="21" r="5"/></svg>`,
    };

    const socialPill =
        'flex h-11 w-11 items-center justify-center rounded-full bg-surface-gray border border-surface-variant/40 hover:border-vibrant-orange/40 hover:bg-surface-container-high transition-all duration-200';
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
<a class="${socialPill}" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${iconSvg.whatsapp('h-6 w-6')}</a>
<a class="${socialPill}" href="${instagramUrl}" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${iconSvg.instagram('h-6 w-6', 'igFooterSocial')}</a>
<a class="${socialPill}" href="${mapsUrl}" target="_blank" rel="noopener noreferrer" aria-label="Google Maps">${iconSvg.maps('h-6 w-6')}</a>
</div>
</div>
<div class="md:col-span-3 flex flex-col">
<h4 class="${footerHeading}">Fale conosco</h4>
<div class="flex flex-col gap-1">
<a class="${footerLink}" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">${iconSvg.whatsapp('h-5 w-5 shrink-0')}<span>WhatsApp</span></a>
<a class="${footerLink}" href="${instagramUrl}" target="_blank" rel="noopener noreferrer">${iconSvg.instagram('h-5 w-5 shrink-0', 'igFooterLink')}<span>Instagram</span></a>
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
${iconSvg.maps('h-5 w-5 shrink-0')}
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
})();
