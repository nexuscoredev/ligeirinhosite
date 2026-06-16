(function () {
    const root = document.getElementById('conta-app');
    if (!root) return;

    const cart = window.LigeirinhoCart;
    const auth = window.LigeirinhoAuth;
    const WHATSAPP_URL =
        'https://api.whatsapp.com/send/?phone=5511970924909&text&type=phone_number&app_absent=0';
    const MAPS_URL =
        'https://www.google.com/maps/search/?api=1&query=Estr.+do+Campo+Limpo,+2083+-+Vila+Prel,+S%C3%A3o+Paulo+-+SP,+05777-001';

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const categoryOptions = [
        { id: 'cervejas', label: 'Cervejas', icon: 'sports_bar' },
        { id: 'destilados', label: 'Destilados', icon: 'liquor' },
        { id: 'refrigerantes-sucos', label: 'Refrigerantes', icon: 'local_cafe' },
        { id: 'energeticos', label: 'Energéticos', icon: 'bolt' },
        { id: 'combos', label: 'Combos', icon: 'local_fire_department' },
        { id: 'gelos', label: 'Gelos', icon: 'ac_unit' },
        { id: 'whiskys', label: 'Whiskys', icon: 'wine_bar' },
        { id: 'vinhos', label: 'Vinhos', icon: 'wine_bar' },
    ];

    const currentView = () => {
        const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
        return hash || 'menu';
    };

    const session = () => auth?.loadSession?.() || null;

    const showFinance = () => {
        const role = String(session()?.role || '').toUpperCase();
        return role === 'ADMIN' || role === 'OPERADOR';
    };

    const subHeader = (title, backHash = '') =>
        `<header class="conta-sub-header">
<button type="button" class="conta-sub-header__back" data-conta-nav="${esc(backHash)}" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="conta-sub-header__title">${esc(title)}</h1>
</header>`;

    const menuRow = (item) => {
        const href = item.href ? ` href="${esc(item.href)}"` : '';
        const tag = item.href ? 'a' : 'button';
        const attrs = item.href
            ? `${href} class="conta-menu-row"`
            : ` type="button" class="conta-menu-row" data-conta-nav="${esc(item.nav || '')}"`;
        return `<${tag}${attrs}>
<div class="conta-menu-row__body">
<p class="conta-menu-row__title">${esc(item.title)}</p>
${item.sub ? `<p class="conta-menu-row__sub">${esc(item.sub)}</p>` : ''}
</div>
<span class="material-symbols-outlined conta-menu-row__chev">chevron_right</span>
</${tag}>`;
    };

    const renderMenu = () => {
        const s = session();
        const summary = cart?.lastOrderSummary?.();
        const first = s && auth?.firstName ? auth.firstName(s) : null;
        const contact = s && auth?.contactLabel ? auth.contactLabel(s) : '';

        const menuItems = [
            {
                title: 'Pedidos',
                sub: summary
                    ? `Último pedido: ${summary.count} item(ns) · ${formatPrice(summary.total)}`
                    : 'Verifique o status dos seus pedidos e muito mais.',
                nav: 'pedidos',
            },
            ...(showFinance()
                ? [
                      {
                          title: 'Finanças',
                          sub: 'Pagamentos, limite e saldo.',
                          href: 'financeiro.html',
                      },
                  ]
                : []),
            {
                title: 'Informação pessoal',
                sub: 'Gerencie seus dados como nome e contato.',
                nav: 'dados',
            },
            {
                title: 'Preferências',
                sub: 'Categorias favoritas na home.',
                nav: 'preferencias',
            },
            {
                title: 'Ajuda e suporte',
                sub: 'Obtenha ajuda da nossa equipe.',
                nav: 'ajuda',
            },
            {
                title: 'Contato e localização',
                sub: 'WhatsApp, endereço e horários.',
                href: 'contato.html',
            },
        ];

        const authBlock = s?.sub
            ? `<div class="conta-user-card">
<img class="conta-user-card__avatar" src="${esc(/^https?:\/\//i.test(s.picture || '') ? s.picture : 'img/app-icon-192.png')}" alt="" width="48" height="48" loading="lazy" referrerpolicy="no-referrer">
<div class="conta-user-card__info">
<p class="conta-user-card__name">${esc(first || s.name || 'Parceiro')}</p>
<p class="conta-user-card__meta">${esc(contact || s.email || '')}</p>
${s.role ? `<p class="conta-user-card__role">${esc(s.role)}</p>` : ''}
</div>
</div>`
            : `<div class="conta-user-card conta-user-card--guest">
<div class="conta-user-card__avatar conta-user-card__avatar--icon" aria-hidden="true">
<span class="material-symbols-outlined">person</span>
</div>
<div class="conta-user-card__info">
<p class="conta-user-card__name">Entre na sua conta</p>
<p class="conta-user-card__meta">Salve preferências e acesse mais rápido nos pedidos.</p>
</div>
<a href="login.html?next=conta.html" class="conta-user-card__login">Entrar</a>
</div>`;

        root.innerHTML = `<div class="conta-menu-view">
<header class="conta-hero-header">
<div class="conta-hero-header__top">
<h1 class="conta-hero-header__title">Conta</h1>
<button type="button" class="conta-hero-header__settings" data-conta-nav="ajustes" aria-label="Ajustes">
<span class="material-symbols-outlined">settings</span>
</button>
</div>
<button type="button" class="conta-store-bar" data-conta-open-cart>
<img src="img/ligeirinhologo.png" alt="" class="conta-store-bar__logo" width="20" height="20">
<span class="conta-store-bar__name">Ligeirinho Parceiros</span>
<span class="material-symbols-outlined conta-store-bar__chev">expand_more</span>
</button>
</header>
<div class="conta-menu-body">
${authBlock}
<nav class="conta-menu-list" aria-label="Menu da conta">
${menuItems.map(menuRow).join('')}
</nav>
</div>
</div>`;
    };

    const renderPedidos = () => {
        const summary = cart?.lastOrderSummary?.();
        root.innerHTML = `${subHeader('Pedidos', '')}
<div class="conta-sub-body">
${
    summary
        ? `<div class="conta-order-card">
<p class="conta-order-card__label">Último pedido</p>
<p class="conta-order-card__meta">${summary.count} item(ns) · ${formatPrice(summary.total)}</p>
<ul class="conta-order-card__items">${summary.items
              .slice(0, 5)
              .map((i) => `<li>${i.qty}x ${esc(i.name)}</li>`)
              .join('')}${summary.items.length > 5 ? '<li>…</li>' : ''}</ul>
<button type="button" class="conta-btn conta-btn--primary" id="conta-reorder-btn">Repetir pedido</button>
<button type="button" class="conta-btn conta-btn--outline" data-conta-open-cart>Ir ao caminhão</button>
</div>`
        : `<div class="conta-empty">
<span class="material-symbols-outlined conta-empty__icon">inventory_2</span>
<p class="conta-empty__title">Nenhum pedido recente</p>
<p class="conta-empty__sub">Faça seu primeiro pedido pelo catálogo.</p>
<a href="pedidos.html" class="conta-btn conta-btn--primary">Ver catálogo</a>
</div>`
}
<p class="conta-hint">Histórico completo de pedidos em breve nesta área.</p>
</div>`;

        root.querySelector('#conta-reorder-btn')?.addEventListener('click', () => {
            if (cart?.restoreLastOrder?.()) {
                window.LigeirinhoCartUI?.render?.();
                window.LigeirinhoCartUI?.open?.();
            }
        });
    };

    const renderDados = () => {
        const s = session();
        const rows = [
            { label: 'Nome', value: s?.name || '—', editable: false },
            { label: 'Telefone celular', value: s?.phone || '—', editable: false },
            { label: 'E-mail', value: s?.email || '—', editable: false },
        ];

        root.innerHTML = `${subHeader('Informação pessoal', '')}
<div class="conta-sub-body">
${
    s?.sub
        ? `<div class="conta-info-card">
${rows
    .map(
        (r) => `<div class="conta-info-row">
<div class="conta-info-row__main">
<p class="conta-info-row__label">${esc(r.label)}</p>
<p class="conta-info-row__value">${esc(r.value)}</p>
</div>
</div>`
    )
    .join('')}
</div>
<p class="conta-hint">Para alterar seus dados, entre em contato pelo WhatsApp ou fale com nosso time.</p>
<a href="${WHATSAPP_URL}" target="_blank" rel="noopener noreferrer" class="conta-btn conta-btn--outline">Falar no WhatsApp</a>`
        : `<div class="conta-empty">
<span class="material-symbols-outlined conta-empty__icon">person</span>
<p class="conta-empty__title">Faça login para ver seus dados</p>
<a href="login.html?next=conta.html%23dados" class="conta-btn conta-btn--primary">Entrar</a>
</div>`
}
</div>`;
    };

    const renderPreferencias = () => {
        const prefs = cart?.loadPrefs?.() || { categories: [] };
        const chips = categoryOptions
            .map((cat) => {
                const checked = prefs.categories.includes(cat.id);
                return `<label class="lig-pref-chip">
<input type="checkbox" name="conta-cat" value="${esc(cat.id)}"${checked ? ' checked' : ''}>
<span class="material-symbols-outlined text-[16px]">${cat.icon}</span>
${esc(cat.label)}
</label>`;
            })
            .join('');

        root.innerHTML = `${subHeader('Preferências', '')}
<div class="conta-sub-body">
<p class="conta-sub-lead">Destacamos suas categorias favoritas na página inicial.</p>
<div class="conta-prefs-chips" id="conta-prefs">${chips}</div>
<div class="conta-clube-teaser">
<span class="conta-clube-teaser__icon">⚡</span>
<p class="conta-clube-teaser__title">Club Raios</p>
<p class="conta-clube-teaser__sub">Acumule pontos a cada pedido e resgate benefícios.</p>
<a href="raios.html" class="conta-btn conta-btn--outline conta-btn--full mt-3">Abrir Club Raios</a>
</div>
</div>`;

        root.querySelectorAll('input[name="conta-cat"]').forEach((input) => {
            input.addEventListener('change', () => {
                const selected = [...root.querySelectorAll('input[name="conta-cat"]:checked')].map(
                    (el) => el.value
                );
                cart?.savePrefs?.({ categories: selected });
            });
        });
    };

    const renderAjuda = () => {
        root.innerHTML = `${subHeader('Ajuda e suporte', '')}
<div class="conta-sub-body">
<div class="conta-help-hero">
<span class="material-symbols-outlined conta-help-hero__icon">support_agent</span>
<p class="conta-help-hero__title">Estamos aqui para ajudar</p>
</div>
<nav class="conta-menu-list conta-menu-list--flush">
${menuRow({
    title: 'Fale conosco',
    sub: 'WhatsApp · (11) 97092-4909',
    href: WHATSAPP_URL,
})}
${menuRow({
    title: 'Como chegar',
    sub: 'Estr. do Campo Limpo, 2083 — São Paulo',
    href: MAPS_URL,
})}
${menuRow({
    title: 'Perguntas frequentes',
    sub: 'Horários, entrega e pagamento.',
    nav: 'ajuda-faq',
})}
</nav>
</div>`;
    };

    const renderAjudaFaq = () => {
        const faqs = [
            {
                q: 'Como faço um pedido?',
                a: 'Adicione produtos ao caminhão na home ou catálogo e toque em Pagar com Mercado Pago.',
            },
            {
                q: 'Quais formas de pagamento?',
                a: 'Pix, cartão de crédito e débito via Mercado Pago, direto no app.',
            },
            {
                q: 'Horário de funcionamento',
                a: 'Seg–Sáb 08h–20h · Domingo 08h–14h.',
            },
        ];
        root.innerHTML = `${subHeader('Perguntas frequentes', 'ajuda')}
<div class="conta-sub-body">
<div class="conta-faq">${faqs
            .map(
                (f) => `<details class="conta-faq__item">
<summary class="conta-faq__q">${esc(f.q)}</summary>
<p class="conta-faq__a">${esc(f.a)}</p>
</details>`
            )
            .join('')}</div>
</div>`;
    };

    const renderAjustes = () => {
        const s = session();
        root.innerHTML = `${subHeader('Ajustes', '')}
<div class="conta-sub-body">
<section class="conta-settings-group">
<h2 class="conta-settings-group__title">Conta</h2>
<div class="conta-menu-list conta-menu-list--flush">
${s?.sub ? menuRow({ title: 'Sair da conta', nav: 'logout' }) : menuRow({ title: 'Entrar', href: 'login.html?next=conta.html' })}
</div>
</section>
<section class="conta-settings-group">
<h2 class="conta-settings-group__title">Aparência</h2>
<div class="conta-settings-theme" data-lig-theme-mount></div>
</section>
<section class="conta-settings-group">
<h2 class="conta-settings-group__title">Sobre</h2>
<div class="conta-menu-list conta-menu-list--flush">
<a href="versao.html" class="conta-menu-row">
<div class="conta-menu-row__body">
<p class="conta-menu-row__title">Notas de versão</p>
</div>
<span class="material-symbols-outlined conta-menu-row__chev">chevron_right</span>
</a>
</div>
</section>
${
    s?.sub
        ? `<button type="button" class="conta-btn conta-btn--dark conta-btn--full" id="conta-logout-btn">Sair</button>`
        : ''
}
<p class="conta-version" id="conta-app-version">…</p>
</div>`;

        window.LigeirinhoThemeUI?.renderAll?.();
        root.querySelector('#conta-logout-btn')?.addEventListener('click', () => {
            auth?.logout?.();
            navigate('');
        });

        fetch('data/version/manifest.json')
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const el = root.querySelector('#conta-app-version');
                if (el && data?.version) el.textContent = `Versão ${data.version}`;
            })
            .catch(() => {});
    };

    const navigate = (hash) => {
        const target = hash ? `#${hash}` : '';
        if (window.location.hash !== target) {
            window.location.hash = target;
        } else {
            render();
        }
    };

    const render = () => {
        const view = currentView();
        switch (view) {
            case 'pedidos':
                renderPedidos();
                break;
            case 'dados':
                renderDados();
                break;
            case 'preferencias':
                renderPreferencias();
                break;
            case 'ajuda':
                renderAjuda();
                break;
            case 'ajuda-faq':
                renderAjudaFaq();
                break;
            case 'ajustes':
                renderAjustes();
                break;
            case 'logout':
                auth?.logout?.();
                navigate('');
                return;
            default:
                renderMenu();
        }
        bindCommon();
    };

    const bindCommon = () => {
        root.querySelectorAll('[data-conta-nav]').forEach((el) => {
            el.addEventListener('click', () => {
                const nav = el.dataset.contaNav;
                if (nav === 'logout') {
                    auth?.logout?.();
                    navigate('');
                    return;
                }
                navigate(nav);
            });
        });

        root.querySelectorAll('[data-conta-open-cart]').forEach((el) => {
            el.addEventListener('click', () => {
                window.LigeirinhoCartUI?.open?.();
            });
        });
    };

    window.addEventListener('hashchange', render);
    window.addEventListener('ligeirinho-auth-changed', render);
    window.addEventListener('ligeirinho-cart-changed', () => {
        if (currentView() === 'menu' || currentView() === 'pedidos') render();
    });

    render();
})();
