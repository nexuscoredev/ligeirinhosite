(function () {
    const root = document.getElementById('ofertas-app');
    if (!root) return;

    const cartApi = window.LigeirinhoCart;
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;
    const cartUi = window.LigeirinhoCartUI;
    if (!cartApi || !catalog || !pricing) return;

    let config = {};
    let catalogData = null;
    let displayItems = [];
    let activeTab = 'descontos';
    let sortMode = 'name';
    let filterCategory = '';
    let filterOpen = false;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const hashDiscount = (id) => {
        let h = 0;
        const s = String(id);
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
        const min = config.discountPercentMin || 5;
        const max = config.discountPercentMax || 18;
        return min + (h % (max - min + 1));
    };

    const discountPrice = (price, id) => {
        const pct = hashDiscount(id);
        const sale = Math.round(price * (1 - pct / 100) * 100) / 100;
        return { sale, original: price, pct };
    };

    const addProduct = (ctx) => {
        const line = catalog.buildCartLineFields(ctx, pricing);
        if (!line) return;
        const cart = cartApi.loadCart();
        if (!cart[line.key]) {
            cart[line.key] = { ...line, qty: 0 };
        }
        cart[line.key].qty += 1;
        cartApi.saveCart(cart);
        cartUi?.render?.();
        cartUi?.showAddedFeedback?.(line.name);
        renderList();
    };

    const removeProduct = (ctx) => {
        const key = ctx.cartKey;
        if (!key) return;
        const cart = cartApi.loadCart();
        if (!cart[key]) return;
        cart[key].qty -= 1;
        if (cart[key].qty <= 0) delete cart[key];
        cartApi.saveCart(cart);
        cartUi?.render?.();
        renderList();
    };

    const categoryImage = (categoryId) => {
        const cat =
            catalog.resolveCatalogCategory(catalogData, categoryId) ||
            catalogData?.categories?.find((c) => c.id === categoryId);
        if (!cat) return null;
        const cover = catalog.categoryCoverMedia(cat, catalogData?.categories || []);
        return cover.type === 'img' ? cover.src : null;
    };

    const offerProductRow = (item) => {
        const group = item?.group || null;
        const product = item?.product || item;
        const p = pricing;
        const activeTier = group && p ? p.getDefaultTier(group) : 'caixa';
        const variant = group && p ? p.getVariant(group, activeTier) : null;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const qty = catalog.getCartQty(cartKey);
        const price = variant?.price ?? product.price ?? 0;
        const disc = discountPrice(price, product.id);
        const imgSrc = catalog.productImageUrl(group && p ? p.getTierImage(group, activeTier) : product.image);
        const packLabel = activeTier === 'pallet' ? 'PALLET' : 'CAIXA';
        const groupAttr = group ? ` data-group-key="${esc(group.key)}" data-price-tier="${esc(activeTier)}"` : '';
        const sub = variant && p ? p.packLineLabel({ ...variant, tier: activeTier }) : '';

        return `<article class="ofertas-product-row" data-product-id="${esc(product.id)}"${groupAttr}>
<div class="ofertas-product-row__media">
${imgSrc ? `<img src="${esc(imgSrc)}" alt="" class="ofertas-product-row__img" loading="lazy">` : '<span class="material-symbols-outlined">liquor</span>'}
<span class="ofertas-product-row__badge ofertas-product-row__badge--pack">${packLabel}</span>
</div>
<div class="ofertas-product-row__body">
<h3 class="ofertas-product-row__name">${esc(catalog.shortName(product.name, 56))}</h3>
${sub ? `<p class="ofertas-product-row__sub">${esc(sub)}</p>` : ''}
<p class="ofertas-product-row__prices">
<span class="ofertas-product-row__old">${catalog.formatPrice(disc.original)}</span>
<span class="ofertas-product-row__price">${catalog.formatPrice(disc.sale)}</span>
</p>
<p class="ofertas-product-row__seller"><span class="material-symbols-outlined">store</span> Vendido por Ligeirinho</p>
<p class="ofertas-product-row__promo">Até ${disc.pct}% de desconto</p>
<div class="ofertas-product-row__actions">
${catalog.qtyStepperHtml(cartKey, qty, { dark: false })}
</div>
</div>
</article>`;
    };

    const pointsOfferRow = (offer) => {
        const img = categoryImage(offer.imageCategory || offer.categoryId);
        const member = window.LigeirinhoRaios?.isMember?.();
        return `<article class="ofertas-points-row">
${img ? `<img src="${esc(img)}" alt="" class="ofertas-points-row__img" loading="lazy">` : '<div class="ofertas-points-row__img ofertas-points-row__img--placeholder"><span class="material-symbols-outlined">local_offer</span></div>'}
<div class="ofertas-points-row__body">
${offer.daysLeft ? `<p class="ofertas-points-row__timer"><span class="ofertas-points-row__dot"></span>Faltam ${offer.daysLeft} dias</p>` : ''}
<p class="ofertas-points-row__title">${esc(offer.title)}</p>
<p class="ofertas-points-row__sub">${esc(offer.subtitle)}</p>
<a href="pedidos.html?categoria=${encodeURIComponent(offer.categoryId)}" class="ofertas-points-row__more">Mostrar mais</a>
<span class="ofertas-points-row__pts">⚡ ${member ? 'Ganhe' : 'Até'} ${offer.points} Raios</span>
</div>
</article>`;
    };

    const getDiscountItems = () => {
        const cats = new Set(config.discountCategories || []);
        let items = displayItems.filter((item) => cats.has(item.categoryId));
        if (filterCategory) items = items.filter((i) => i.categoryId === filterCategory);
        items = [...items];
        if (sortMode === 'price-asc') items.sort((a, b) => (a.product.price ?? 0) - (b.product.price ?? 0));
        else if (sortMode === 'price-desc') items.sort((a, b) => (b.product.price ?? 0) - (a.product.price ?? 0));
        else items.sort((a, b) => a.product.name.localeCompare(b.product.name, 'pt-BR'));
        return items.slice(0, 40);
    };

    const renderShell = () => {
        const tabs = [
            { id: 'descontos', label: 'Descontos', icon: 'sell' },
            { id: 'pontos', label: 'Pontos', icon: 'bolt' },
        ];

        const showToolbar = activeTab !== 'pontos';

        root.innerHTML = `<div class="ofertas-shell">
<header class="ofertas-header">
<h1 class="ofertas-header__title">Ofertas</h1>
</header>
${showToolbar ? `<div class="ofertas-toolbar">
<button type="button" class="ofertas-toolbar__btn" id="ofertas-filter-btn" aria-expanded="${filterOpen}">
<span class="material-symbols-outlined">filter_list</span>
<span>Filtro</span>
<span class="material-symbols-outlined ofertas-toolbar__chev">expand_more</span>
</button>
<div class="ofertas-toolbar__sort">
<select id="ofertas-sort" class="ofertas-toolbar__select" aria-label="Ordenar por">
<option value="name">Ordenar por nome</option>
<option value="price-asc">Menor preço</option>
<option value="price-desc">Maior preço</option>
</select>
<span class="material-symbols-outlined ofertas-toolbar__sort-icon">sort</span>
</div>
</div>
<div id="ofertas-filter-panel" class="ofertas-filter-panel${filterOpen ? ' ofertas-filter-panel--open' : ''}"${filterOpen ? '' : ' hidden'}>
<select id="ofertas-filter-cat" class="ofertas-filter-panel__select">
<option value="">Todas as categorias</option>
${(catalogData?.categories || [])
    .filter((c) => c.products?.length)
    .map((c) => `<option value="${esc(c.id)}">${esc(catalog.formatCategoryLabel(c.name))}</option>`)
    .join('')}
</select>
</div>` : ''}
<nav class="ofertas-tabs ofertas-tabs--duo" aria-label="Tipo de oferta">
${tabs
    .map(
        (t) => `<button type="button" class="ofertas-tab${activeTab === t.id ? ' ofertas-tab--active' : ''}" data-ofertas-tab="${t.id}">
<span class="ofertas-tab__icon"><span class="material-symbols-outlined">${t.icon}</span></span>
<span class="ofertas-tab__label">${t.label}</span>
</button>`
    )
    .join('')}
</nav>
<div id="ofertas-list" class="ofertas-list" role="list"></div>
</div>`;
    };

    const renderList = () => {
        const list = root.querySelector('#ofertas-list');
        if (!list) return;

        if (activeTab === 'descontos') {
            const items = getDiscountItems();
            list.innerHTML = items.length
                ? items.map(offerProductRow).join('')
                : '<p class="ofertas-empty">Nenhuma oferta de desconto nesta categoria.</p>';
        } else {
            const offers = config.pointsOffers || [];
            list.innerHTML = offers.length
                ? offers.map(pointsOfferRow).join('')
                : '<p class="ofertas-empty">Nenhuma oferta de pontos no momento.</p>';
        }

        bindListActions();
    };

    const bindListActions = () => {
        catalog.bindQtySteppers(root, {
            onAdd: (ctx) => addProduct(ctx),
            onRemove: (ctx) => removeProduct(ctx),
        });
    };

    const bindShell = () => {
        root.querySelectorAll('[data-ofertas-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.ofertasTab;
                renderShell();
                renderList();
                bindShell();
            });
        });

        root.querySelector('#ofertas-sort')?.addEventListener('change', (e) => {
            sortMode = e.target.value;
            renderList();
        });

        root.querySelector('#ofertas-filter-cat')?.addEventListener('change', (e) => {
            filterCategory = e.target.value;
            renderList();
        });

        root.querySelector('#ofertas-filter-btn')?.addEventListener('click', () => {
            filterOpen = !filterOpen;
            const panel = root.querySelector('#ofertas-filter-panel');
            if (panel) {
                panel.hidden = !filterOpen;
                panel.classList.toggle('ofertas-filter-panel--open', filterOpen);
            }
            root.querySelector('#ofertas-filter-btn')?.setAttribute('aria-expanded', filterOpen ? 'true' : 'false');
        });
    };

    const render = () => {
        renderShell();
        renderList();
        bindShell();
        const sortEl = root.querySelector('#ofertas-sort');
        if (sortEl) sortEl.value = sortMode;
        const filterEl = root.querySelector('#ofertas-filter-cat');
        if (filterEl) filterEl.value = filterCategory;
    };

    const pointsFromRaios = (raiosCfg) =>
        (raiosCfg?.missions || []).map((m) => ({
            id: m.id,
            title: m.title,
            subtitle: m.subtitle || 'Valendo mais Raios!',
            points: m.points,
            daysLeft: 14,
            categoryId: m.categoryId,
            imageCategory: m.categoryId,
        }));

    const init = () => {
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        if (tabParam && ['descontos', 'pontos'].includes(tabParam)) activeTab = tabParam;

        Promise.all([
            window.LigeirinhoCatalogLoader.load(),
            fetch('data/ofertas-config.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
            fetch('data/raios-config.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
            pricing.loadPackConfig(),
            pricing.loadTierImages(),
        ]).then(([catalogJson, cfg, raiosCfg]) => {
            config = { ...cfg, pointsOffers: pointsFromRaios(raiosCfg) };
            catalogData = catalogJson;
            displayItems = pricing.getDisplayProducts(catalogJson);
            window.__ligProductGroups = pricing.buildGroups(catalogJson);
            render();
        });
    };

    window.addEventListener('ligeirinho-cart-changed', () => {
        if (activeTab === 'descontos') renderList();
    });

    init();
})();
