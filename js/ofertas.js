(function () {
    const root = document.getElementById('ofertas-app');
    if (!root) return;

    const cartApi = window.LigeirinhoCart;
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;
    const cartUi = window.LigeirinhoCartUI;
    const promoCatalog = window.LigeirinhoPromoCatalog;
    const promoCards = window.LigeirinhoParceirosPromoCards;
    const productCards = window.LigeirinhoParceirosProductCards;
    const productDetail = window.LigeirinhoParceirosProductDetail;
    if (!cartApi || !catalog || !pricing || !promoCatalog || !promoCards || !productCards) return;

    let catalogData = null;
    let displayItems = [];
    let promoGroups = [];
    let selectedUnits = new Map();
    let sortMode = 'discount';
    let filterCategory = '';
    let filterOpen = false;
    let loading = true;
    let loadError = false;

    const promoLoader = promoCatalog.createHubPromoLoader('/api/promocoes');

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) => catalog.formatPrice(value);

    const cardDeps = () => ({
        promoCatalog,
        catalog,
        pricing,
        formatPrice,
        selectedUnits,
        getCartQty: (key) => catalog.getCartQty(key),
    });

    const reloadPromoGroups = (promos) => {
        const prepared = promoCards.preparePromoGroups(promos, displayItems, promoCatalog);
        promoGroups = prepared.groups;
        selectedUnits = prepared.selectedUnits;
    };

    const buildCartCtx = (entry) => promoCards.buildCartCtx(entry, cardDeps());

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
            pricing,
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
        syncGridQty();
    };

    const removeProduct = (cartKey) => {
        if (!cartKey) return;
        const cart = cartApi.loadCart();
        if (!cart[cartKey]) return;
        cart[cartKey].qty -= 1;
        if (cart[cartKey].qty <= 0) delete cart[cartKey];
        cartApi.saveCart(cart);
        cartUi?.render?.();
        syncGridQty();
    };

    const setProductQty = (entry, qty) => {
        const ctx = buildCartCtx(entry);
        if (!ctx.variant || !ctx.cartKey) return;
        const line = catalog.buildCartLineFields(
            {
                variant: ctx.variant,
                group: ctx.group,
                cartKey: ctx.cartKey,
                tier: ctx.tier,
            },
            pricing,
        );
        if (!line) return;
        line.price = ctx.promoPrice;
        if (ctx.promo?.id) line.promoId = ctx.promo.id;
        const cart = cartApi.loadCart();
        if (qty <= 0) {
            delete cart[line.key];
        } else {
            if (!cart[line.key]) {
                cart[line.key] = { ...line, qty: 0 };
            } else {
                cart[line.key].price = ctx.promoPrice;
                if (ctx.promo?.id) cart[line.key].promoId = ctx.promo.id;
            }
            cart[line.key].qty = qty;
        }
        cartApi.saveCart(cart);
        cartUi?.render?.();
        syncGridQty();
    };

    const getFilteredGroups = () => {
        let groups = [...promoGroups];
        if (filterCategory) {
            groups = groups.filter((grupo) => {
                const entry = promoCards.activeEntryForGroup(grupo, selectedUnits, promoCatalog);
                return entry?.item?.categoryId === filterCategory;
            });
        }
        if (sortMode === 'price-asc') {
            groups.sort(
                (a, b) =>
                    buildCartCtx(promoCards.activeEntryForGroup(a, selectedUnits, promoCatalog)).promoPrice -
                    buildCartCtx(promoCards.activeEntryForGroup(b, selectedUnits, promoCatalog)).promoPrice,
            );
        } else if (sortMode === 'price-desc') {
            groups.sort(
                (a, b) =>
                    buildCartCtx(promoCards.activeEntryForGroup(b, selectedUnits, promoCatalog)).promoPrice -
                    buildCartCtx(promoCards.activeEntryForGroup(a, selectedUnits, promoCatalog)).promoPrice,
            );
        } else if (sortMode === 'name') {
            groups.sort((a, b) =>
                (a.nomeExibicao || '').localeCompare(b.nomeExibicao || '', 'pt-BR'),
            );
        } else {
            groups.sort(
                (a, b) =>
                    buildCartCtx(promoCards.activeEntryForGroup(b, selectedUnits, promoCatalog)).discountPct -
                    buildCartCtx(promoCards.activeEntryForGroup(a, selectedUnits, promoCatalog)).discountPct,
            );
        }
        return groups;
    };

    const findPromoCard = (groupKey) => {
        if (!groupKey) return null;
        return (
            [...root.querySelectorAll('[data-promo-group-key]')].find(
                (el) => el.dataset.promoGroupKey === groupKey,
            ) || null
        );
    };

    const replacePromoCard = (grupo, index) => {
        const card = findPromoCard(grupo.chave);
        if (!card) return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = promoCards.buildPromoCardHtml(grupo, index, cardDeps());
        const next = wrapper.firstElementChild;
        if (next) card.replaceWith(next);
    };

    const syncGridQty = () => {
        getFilteredGroups().forEach((grupo) => {
            const entry = promoCards.activeEntryForGroup(grupo, selectedUnits, promoCatalog);
            if (!entry) return;
            const ctx = buildCartCtx(entry);
            if (!ctx.cartKey) return;
            promoCards.updateCardQty(findPromoCard(grupo.chave), catalog.getCartQty(ctx.cartKey));
        });
    };

    productDetail?.init?.({
        getDisplayItems: () => displayItems,
        getPromoOffers: () => ({}),
        onCartChanged: syncGridQty,
    });

    const renderShell = () => {
        root.innerHTML = `<div class="ofertas-shell">
<header class="ofertas-header">
<h1 class="ofertas-header__title">Promoções</h1>
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
<button type="button" class="ofertas-toolbar__btn" id="ofertas-refresh" title="Atualizar catálogo e promoções" aria-label="Atualizar catálogo e promoções">
<span class="material-symbols-outlined">refresh</span>
<span>Atualizar</span>
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
<div id="ofertas-status" class="ofertas-status" hidden></div>
<div id="ofertas-list" class="ofertas-list ofertas-promos-grid totem-promos__grid" role="list"></div>
</div>`;
    };

    const renderList = () => {
        const list = root.querySelector('#ofertas-list');
        const status = root.querySelector('#ofertas-status');
        if (!list) return;

        if (loading) {
            if (status) {
                status.hidden = false;
                status.textContent = 'Carregando promoções do Hub…';
            }
            list.innerHTML = '';
            return;
        }

        if (loadError && !promoGroups.length) {
            if (status) {
                status.hidden = false;
                status.innerHTML =
                    'Não foi possível carregar as promoções. <button type="button" class="ofertas-status__retry" id="ofertas-retry">Tentar novamente</button>';
                status.querySelector('#ofertas-retry')?.addEventListener('click', () => void refreshAll());
            }
            list.innerHTML = '';
            return;
        }

        const groups = getFilteredGroups();
        if (status) status.hidden = true;

        if (groups.length) {
            list.innerHTML = promoCards.renderGridHtml(groups, cardDeps());
        } else {
            list.innerHTML =
                '<p class="ofertas-empty">Nenhuma promoção ativa no momento. Cadastre promoções no Ligeirinho Hub.</p>';
        }
    };

    const bindGrid = () => {
        if (root.dataset.promoGridBound === '1') return;
        root.dataset.promoGridBound = '1';

        root.addEventListener('click', (e) => {
            const list = root.querySelector('#ofertas-list');
            if (!list || !list.contains(e.target)) return;
            const unitBtn = e.target.closest('[data-promo-unit]');
            if (unitBtn) {
                const groupKey = unitBtn.dataset.promoGroupKey;
                const unit = unitBtn.dataset.promoUnit;
                const grupo = promoGroups.find((item) => item.chave === groupKey);
                if (!grupo || !unit || !grupo.byUnit[unit]) return;
                selectedUnits.set(groupKey, unit);
                const visible = getFilteredGroups();
                const index = visible.indexOf(grupo);
                replacePromoCard(grupo, index >= 0 ? index : promoGroups.indexOf(grupo));
                return;
            }

            const plus = e.target.closest('.totem-plus');
            if (plus) {
                const card = plus.closest('[data-promo-group-key]');
                const grupo = promoGroups.find((item) => item.chave === card?.dataset?.promoGroupKey);
                const entry = grupo ? promoCards.activeEntryForGroup(grupo, selectedUnits, promoCatalog) : null;
                if (!entry?.item) return;
                addProduct(entry);
                return;
            }

            const minus = e.target.closest('.totem-minus');
            if (minus) {
                removeProduct(minus.dataset.cartKey);
                return;
            }

            const qtyEdit = e.target.closest('.totem-qty-edit');
            if (qtyEdit) {
                e.preventDefault();
                e.stopPropagation();
                const card = qtyEdit.closest('[data-promo-group-key]');
                const grupo = promoGroups.find((item) => item.chave === card?.dataset?.promoGroupKey);
                const entry = grupo ? promoCards.activeEntryForGroup(grupo, selectedUnits, promoCatalog) : null;
                if (!entry?.item) return;
                const ctx = buildCartCtx(entry);
                const currentQty = catalog.getCartQty(ctx.cartKey) || 0;
                const qty = productCards?.promptGridQty?.(currentQty);
                if (qty == null) return;
                setProductQty(entry, qty);
                return;
            }

            const card = e.target.closest('.totem-product[data-item-key]');
            if (
                card &&
                !card.dataset.promoUnlinked &&
                !productDetail?.isInteractiveTarget?.(e.target)
            ) {
                const grupo = promoGroups.find((item) => item.chave === card.dataset.promoGroupKey);
                const entry = grupo ? promoCards.activeEntryForGroup(grupo, selectedUnits, promoCatalog) : null;
                if (!entry?.item) return;
                const ctx = promoCards.buildCartCtx(entry, cardDeps());
                const itemKey = promoCatalog.resolvePromoDetailItemKey(grupo, (grupoRef) =>
                    promoCards.activeEntryForGroup(grupoRef, selectedUnits, promoCatalog),
                );
                if (!itemKey) return;
                productDetail?.open?.(
                    itemKey,
                    promoCards.buildDetailPromoOpts(grupo, ctx, cardDeps()),
                );
            }
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
        bindGrid();
        const sortEl = root.querySelector('#ofertas-sort');
        if (sortEl) sortEl.value = sortMode;
        const filterEl = root.querySelector('#ofertas-filter-cat');
        if (filterEl) filterEl.value = filterCategory;
    };

    const reloadPromos = async () => {
        loading = true;
        loadError = false;
        renderList();
        try {
            const promos = await promoLoader.load(true);
            loadError = promoLoader.hadError();
            reloadPromoGroups(promos);
        } catch {
            loadError = true;
        }
        loading = false;
        renderList();
    };

    const refreshAll = async () => {
        loading = true;
        loadError = false;
        renderList();
        try {
            if (window.LigeirinhoCatalogSync?.sync) {
                const result = await window.LigeirinhoCatalogSync.sync();
                if (result?.ok && result.catalogData) {
                    catalogData = result.catalogData;
                    displayItems = pricing.getDisplayProducts(catalogData);
                    window.__ligProductGroups = pricing.buildGroups(catalogData);
                } else if (!result?.busy) {
                    loadError = true;
                }
            }
            promoLoader.clear();
            const promos = await promoLoader.load(true);
            loadError = loadError || promoLoader.hadError();
            reloadPromoGroups(promos);
        } catch {
            loadError = true;
        }
        loading = false;
        renderList();
    };

    const init = async () => {
        await window.LigeirinhoPromoEntryNotice?.show?.({ variant: 'site' });
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
        syncGridQty();
    });

    window.addEventListener('ligeirinho-catalog-sync-start', () => {
        promoLoader.clear();
    });

    window.addEventListener('ligeirinho-catalog-synced', (event) => {
        const catalogJson = event.detail?.catalogData;
        if (!catalogJson) return;
        catalogData = catalogJson;
        displayItems = pricing.getDisplayProducts(catalogJson);
        window.__ligProductGroups = pricing.buildGroups(catalogJson);
        promoLoader.clear();
        void reloadPromos();
    });

    init();
})();
