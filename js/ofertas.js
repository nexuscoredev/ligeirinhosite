(function () {
    const root = document.getElementById('ofertas-app');
    if (!root) return;

    const cartApi = window.LigeirinhoCart;
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;
    const cartUi = window.LigeirinhoCartUI;
    const promoCatalog = window.LigeirinhoPromoCatalog;
    if (!cartApi || !catalog || !pricing || !promoCatalog) return;

    void window.LigeirinhoMktPromos?.warmCache?.();

    let catalogData = null;
    let displayItems = [];
    let promoEntries = [];
    let sortMode = 'discount';
    let filterCategory = '';
    let filterOpen = false;
    let loading = true;
    let loadError = false;
    let mktGalleryImages = [];

    const promoLoader = promoCatalog.createHubPromoLoader('/api/promocoes');

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const buildCartCtx = (entry) => {
        const { promo, item } = entry;
        const group = item?.group || null;
        const product = item?.product;
        const tier = group ? pricing.getDefaultTier(group) : item?.defaultTier || 'caixa';
        const variant = group ? pricing.getVariant(group, tier) : null;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product?.id || '';
        const originalPrice = promo.originalPrice ?? variant?.price ?? product?.price ?? 0;
        const promoPrice = promo.promoPrice ?? originalPrice;
        const discountPct =
            promo.discountPct ||
            (originalPrice > 0 ? Math.max(0, Math.round((1 - promoPrice / originalPrice) * 100)) : 0);
        return {
            group,
            product,
            tier,
            variant,
            cartKey,
            originalPrice,
            promoPrice,
            discountPct,
            promo,
        };
    };

    const addProduct = (entry) => {
        const ctx = buildCartCtx(entry);
        if (!ctx.variant || !ctx.cartKey) return;
        const line = catalog.buildCartLineFields(
            {
                variant: ctx.variant,
                group: ctx.group,
                cartKey: ctx.cartKey,
                tier: ctx.tier,
            },
            pricing
        );
        if (!line) return;
        line.price = ctx.promoPrice;
        if (ctx.promo?.id) line.promoId = ctx.promo.id;
        const cart = cartApi.loadCart();
        if (!cart[line.key]) {
            cart[line.key] = { ...line, qty: 0 };
        } else {
            cart[line.key].price = ctx.promoPrice;
            if (ctx.promo?.id) cart[line.key].promoId = ctx.promo.id;
        }
        cart[line.key].qty += 1;
        cartApi.saveCart(cart);
        cartUi?.render?.();
        cartUi?.showAddedFeedback?.(line.name);
        renderList();
    };

    const removeProduct = (cartKey) => {
        if (!cartKey) return;
        const cart = cartApi.loadCart();
        if (!cart[cartKey]) return;
        cart[cartKey].qty -= 1;
        if (cart[cartKey].qty <= 0) delete cart[cartKey];
        cartApi.saveCart(cart);
        cartUi?.render?.();
        renderList();
    };

    const getFilteredEntries = () => {
        let items = promoEntries.filter((e) => e.item);
        if (filterCategory) {
            items = items.filter((e) => e.item?.categoryId === filterCategory);
        }
        items = [...items];
        if (sortMode === 'price-asc') {
            items.sort((a, b) => buildCartCtx(a).promoPrice - buildCartCtx(b).promoPrice);
        } else if (sortMode === 'price-desc') {
            items.sort((a, b) => buildCartCtx(b).promoPrice - buildCartCtx(a).promoPrice);
        } else if (sortMode === 'name') {
            items.sort((a, b) =>
                (a.promo.name || a.item?.product?.name || '').localeCompare(
                    b.promo.name || b.item?.product?.name || '',
                    'pt-BR'
                )
            );
        } else {
            items.sort((a, b) => buildCartCtx(b).discountPct - buildCartCtx(a).discountPct);
        }
        return items;
    };

    const loadMktGallery = async () => {
        const api = window.LigeirinhoMktPromos;
        if (!api?.loadMarketingStories) {
            mktGalleryImages = [];
            return;
        }
        try {
            const data = await api.loadMarketingStories();
            mktGalleryImages = api.collectImageUrls(data.stories);
            void api.preloadImages(mktGalleryImages.slice(0, 3), 3);
        } catch {
            mktGalleryImages = [];
        }
    };

    const mktGalleryHtml = () => {
        if (!mktGalleryImages.length) return '';
        return `<section class="ofertas-mkt-gallery" aria-label="Encartes promocionais">
<h2 class="ofertas-mkt-gallery__title">Promoções do dia</h2>
<div class="ofertas-mkt-gallery__grid">
${mktGalleryImages
    .map(
        (url, index) =>
            `<figure class="ofertas-mkt-gallery__item"><img src="${esc(url)}" alt="Promoção ${index + 1}" class="ofertas-mkt-gallery__img" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async"${index < 2 ? ' fetchpriority="high"' : ''}></figure>`
    )
    .join('')}
</div>
</section>`;
    };

    const offerProductRow = (entry) => {
        const ctx = buildCartCtx(entry);
        const { group, product, tier, variant, cartKey, originalPrice, promoPrice, discountPct, promo } = ctx;
        const qty = catalog.getCartQty(cartKey);
        const unitPrice =
            variant && pricing?.getUnitPrice
                ? pricing.getUnitPrice({ ...variant, price: promoPrice, tier })
                : promoPrice;
        const unitOriginal =
            variant && pricing?.getUnitPrice
                ? pricing.getUnitPrice({ ...variant, price: originalPrice, tier })
                : originalPrice;
        const imgSrc = promo.imageUrl
            ? catalog.productImageUrl(promo.imageUrl)
            : catalog.productImageUrl(group && pricing ? pricing.getTierImage(group, tier) : product?.image);
        const packLabel = variant?.packSize ? `CAIXA × ${variant.packSize}` : 'CAIXA';
        const validade = promoCatalog.formatValidade(promo);
        const name = promo.name || group?.baseName || product?.name || 'Promoção';
        const groupAttr = group ? ` data-group-key="${esc(group.key)}" data-price-tier="${esc(tier)}"` : '';
        const sub =
            variant
                ? [
                      'por unidade',
                      `Caixa c/ ${variant.packSize || '?'} un`,
                      `total ${catalog.formatPrice(promoPrice)}`,
                  ].join(' · ')
                : '';

        return `<article class="ofertas-product-row" data-product-id="${esc(product?.id || '')}" data-cart-key="${esc(cartKey)}"${groupAttr}>
<div class="ofertas-product-row__media">
${imgSrc ? `<img src="${esc(imgSrc)}" alt="" class="ofertas-product-row__img" loading="lazy">` : '<span class="material-symbols-outlined">liquor</span>'}
<span class="ofertas-product-row__badge ofertas-product-row__badge--pack">${esc(packLabel)}</span>
${discountPct > 0 ? `<span class="ofertas-product-row__badge ofertas-product-row__badge--pct">-${discountPct}%</span>` : ''}
</div>
<div class="ofertas-product-row__body">
<h3 class="ofertas-product-row__name">${esc(catalog.shortName(name, 56))}</h3>
${sub ? `<p class="ofertas-product-row__sub">${esc(sub)}</p>` : ''}
<p class="ofertas-product-row__prices">
<span class="ofertas-product-row__old">${catalog.formatPrice(unitOriginal)}</span>
<span class="ofertas-product-row__price">${catalog.formatPrice(unitPrice)}</span>
</p>
<p class="ofertas-product-row__seller"><span class="material-symbols-outlined">store</span> Promoção Ligeirinho Hub</p>
${validade ? `<p class="ofertas-product-row__promo">${esc(validade)}</p>` : ''}
<div class="ofertas-product-row__actions">
${catalog.qtyStepperHtml(cartKey, qty, { dark: false })}
</div>
</div>
</article>`;
    };

    const renderShell = () => {
        root.innerHTML = `<div class="ofertas-shell">
<header class="ofertas-header">
<h1 class="ofertas-header__title">Ofertas</h1>
<p class="ofertas-header__lead">Promoções ativas cadastradas no Ligeirinho Hub</p>
</header>
<div class="ofertas-toolbar">
<button type="button" class="ofertas-toolbar__btn" id="ofertas-filter-btn" aria-expanded="${filterOpen}">
<span class="material-symbols-outlined">filter_list</span>
<span>Filtro</span>
<span class="material-symbols-outlined ofertas-toolbar__chev">expand_more</span>
</button>
<div class="ofertas-toolbar__sort">
<select id="ofertas-sort" class="ofertas-toolbar__select" aria-label="Ordenar por">
<option value="discount">Maior desconto</option>
<option value="name">Ordenar por nome</option>
<option value="price-asc">Menor preço</option>
<option value="price-desc">Maior preço</option>
</select>
<span class="material-symbols-outlined ofertas-toolbar__sort-icon">sort</span>
</div>
<button type="button" class="ofertas-toolbar__btn" id="ofertas-refresh" title="Atualizar promoções">
<span class="material-symbols-outlined">refresh</span>
</button>
</div>
<div id="ofertas-filter-panel" class="ofertas-filter-panel${filterOpen ? ' ofertas-filter-panel--open' : ''}"${filterOpen ? '' : ' hidden'}>
<select id="ofertas-filter-cat" class="ofertas-filter-panel__select">
<option value="">Todas as categorias</option>
${(catalogData?.categories || [])
    .filter((c) => c.products?.length)
    .map((c) => `<option value="${esc(c.id)}">${esc(catalog.formatCategoryLabel(c.name))}</option>`)
    .join('')}
</select>
</div>
<div id="ofertas-mkt-gallery"></div>
<div id="ofertas-status" class="ofertas-status" hidden></div>
<div id="ofertas-list" class="ofertas-list" role="list"></div>
</div>`;
    };

    const renderList = () => {
        const list = root.querySelector('#ofertas-list');
        const status = root.querySelector('#ofertas-status');
        const gallery = root.querySelector('#ofertas-mkt-gallery');
        if (!list) return;

        if (gallery) gallery.innerHTML = mktGalleryHtml();

        if (loading) {
            if (status) {
                status.hidden = false;
                status.textContent = 'Carregando promoções do Hub…';
            }
            list.innerHTML = '';
            return;
        }

        if (loadError && !promoEntries.length && !mktGalleryImages.length) {
            if (status) {
                status.hidden = false;
                status.innerHTML =
                    'Não foi possível carregar as promoções. <button type="button" class="ofertas-status__retry" id="ofertas-retry">Tentar novamente</button>';
                status.querySelector('#ofertas-retry')?.addEventListener('click', () => void refreshAll());
            }
            list.innerHTML = '';
            return;
        }

        const items = getFilteredEntries();
        if (status) status.hidden = true;

        if (items.length) {
            list.innerHTML = items.map(offerProductRow).join('');
        } else if (!mktGalleryImages.length) {
            list.innerHTML =
                '<p class="ofertas-empty">Nenhuma promoção ativa no momento. Cadastre ofertas no Ligeirinho Hub.</p>';
        } else {
            list.innerHTML = '';
        }

        bindListActions();
    };

    const bindListActions = () => {
        catalog.bindQtySteppers(root, {
            onAdd: (ctx) => {
                const key = ctx.cartKey;
                const entry = promoEntries.find((e) => buildCartCtx(e).cartKey === key);
                if (entry) addProduct(entry);
            },
            onRemove: (ctx) => removeProduct(ctx.cartKey),
        });
    };

    const bindShell = () => {
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

        root.querySelector('#ofertas-refresh')?.addEventListener('click', () => void refreshAll());
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

    const refreshAll = async () => {
        loading = true;
        loadError = false;
        renderList();
        await loadMktGallery();
        const promos = await promoLoader.load(true);
        loadError = promoLoader.hadError();
        promoEntries = promoCatalog.buildPromoEntries(promos, displayItems, { matchedOnly: true });
        loading = false;
        renderList();
    };

    const refreshPromos = refreshAll;

    const init = async () => {
        loading = true;
        render();
        try {
            const catalogJson = await window.LigeirinhoCatalogLoader.load();
            await Promise.all([pricing.loadPackConfig(), pricing.loadTierImages()]);
            catalogData = catalogJson;
            displayItems = pricing.getDisplayProducts(catalogJson);
            window.__ligProductGroups = pricing.buildGroups(catalogJson);
            await refreshAll();
        } catch {
            loadError = true;
            loading = false;
            renderList();
        }
    };

    window.addEventListener('ligeirinho-cart-changed', () => {
        renderList();
    });

    init();
})();
