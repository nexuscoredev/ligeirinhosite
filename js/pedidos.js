(function () {
    const cartApi = window.LigeirinhoCart;
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;
    const cartUi = window.LigeirinhoCartUI;
    const productCards = window.LigeirinhoParceirosProductCards;
    const promoCatalog = window.LigeirinhoPromoCatalog;
    const promoCards = window.LigeirinhoParceirosPromoCards;
    const productDetail = window.LigeirinhoParceirosProductDetail;

    if (!cartApi || !catalog || !pricing || !productCards) return;

    const grid = document.getElementById('catalog-grid');
    const filtersEl = document.getElementById('catalog-filters');
    const filtersMobileEl = document.getElementById('catalog-filters-mobile');
    const statsEl = document.getElementById('catalog-stats');
    const modalStatsEl = document.getElementById('catalog-categories-modal-stats');
    const categoryTitleEl = document.getElementById('catalog-category-title');
    const categoryEyebrowEl = document.getElementById('catalog-category-eyebrow');
    const categoriesBtnLabel = document.getElementById('catalog-categories-btn-label');
    const categoriesModal = document.getElementById('catalog-categories-modal');
    const sortSelects = document.querySelectorAll('[data-catalog-sort]');
    const searchInput = () => document.getElementById('ze-search-input');

    if (!grid) return;

    let catalogData = null;
    let displayItems = [];
    let promoOffers = { byCartKey: {}, byItemKey: {} };
    let activeCategory = '';
    let searchQuery = '';
    let searchTimer = null;
    let cachedQueryInfo = null;
    let cachedQueryKey = '';

    const attachSearchIndex = (items) => {
        const search = window.LigeirinhoSearch;
        if (!search?.buildHaystack) return items;
        items.forEach((item) => {
            const text = `${item.product.id} ${item.product.name} ${item.product.description || ''} ${item.categoryName}`;
            item._searchHaystack = search.buildHaystack(text);
        });
        return items;
    };

    const getQueryInfo = () => {
        const search = window.LigeirinhoSearch;
        if (!search?.expandSearchQuery) {
            return { raw: searchQuery, words: searchQuery ? [searchQuery] : [], volumes: [] };
        }
        if (cachedQueryKey === searchQuery && cachedQueryInfo) return cachedQueryInfo;
        cachedQueryKey = searchQuery;
        cachedQueryInfo = search.expandSearchQuery(searchQuery);
        return cachedQueryInfo;
    };

    const getFilteredProducts = () => {
        const search = window.LigeirinhoSearch;
        const queryInfo = getQueryInfo();
        return displayItems.filter((item) => {
            if (activeCategory && item.categoryId !== activeCategory) return false;
            if (!searchQuery) return true;
            if (search?.matchesHaystack && item._searchHaystack) {
                return search.matchesHaystack(item._searchHaystack, queryInfo);
            }
            const haystack = `${item.product.id} ${item.product.name} ${item.product.description || ''} ${item.categoryName}`;
            if (search?.matchesSearch) return search.matchesSearch(haystack, queryInfo);
            return haystack.toLowerCase().includes(searchQuery);
        });
    };

    const sortItems = (items) => {
        const search = window.LigeirinhoSearch;
        const queryInfo = getQueryInfo();
        const mode = sortSelects[0]?.value || 'name';
        const sorted = [...items];

        if (searchQuery && queryInfo?.raw && search?.scoreHaystack) {
            sorted.sort((a, b) => {
                const scoreA = a._searchHaystack ? search.scoreHaystack(a._searchHaystack, queryInfo) : 0;
                const scoreB = b._searchHaystack ? search.scoreHaystack(b._searchHaystack, queryInfo) : 0;
                const scoreDiff = scoreB - scoreA;
                if (scoreDiff !== 0) return scoreDiff;
                return a.product.name.localeCompare(b.product.name, 'pt-BR');
            });
            return sorted;
        }

        if (searchQuery && queryInfo?.raw && search?.scoreSearch) {
            sorted.sort((a, b) => {
                const hayA = `${a.product.id} ${a.product.name} ${a.product.description || ''} ${a.categoryName}`;
                const hayB = `${b.product.id} ${b.product.name} ${b.product.description || ''} ${b.categoryName}`;
                const scoreDiff = search.scoreSearch(hayB, queryInfo) - search.scoreSearch(hayA, queryInfo);
                if (scoreDiff !== 0) return scoreDiff;
                return a.product.name.localeCompare(b.product.name, 'pt-BR');
            });
            return sorted;
        }

        if (mode === 'price-asc') {
            sorted.sort((a, b) => (a.product.price ?? 0) - (b.product.price ?? 0));
        } else if (mode === 'price-desc') {
            sorted.sort((a, b) => (b.product.price ?? 0) - (a.product.price ?? 0));
        } else {
            sorted.sort((a, b) => a.product.name.localeCompare(b.product.name, 'pt-BR'));
        }
        return sorted;
    };

    const promoLoader = promoCatalog?.createHubPromoLoader?.('/api/promocoes');

    const reloadPromoOffers = async (force = false) => {
        if (!promoLoader || !promoCatalog || !promoCards || !displayItems.length) return;
        const promos = await promoLoader.load(force);
        const prepared = promoCards.preparePromoGroups(promos, displayItems, promoCatalog);
        promoOffers = promoCatalog.buildPromoOfferIndex(prepared.groups, {
            buildCartCtx: (entry) =>
                promoCards.buildCartCtx(entry, { promoCatalog, catalog, pricing }),
        });
        productDetail?.refreshIfOpen?.();
    };

    const addProduct = (ctx) => {
        const line = catalog.buildCartLineFields(ctx, pricing);
        if (!line) return;
        const offer = ctx.offer;
        if (offer?.promoPrice != null && Number.isFinite(Number(offer.promoPrice))) {
            line.price = Number(offer.promoPrice);
            if (offer.promoId) line.promoId = offer.promoId;
        }
        const cart = cartApi.loadCart();
        if (!cart[line.key]) {
            cart[line.key] = { ...line, qty: 0 };
        } else if (offer?.promoPrice != null && Number.isFinite(Number(offer.promoPrice))) {
            cart[line.key].price = Number(offer.promoPrice);
            if (offer.promoId) cart[line.key].promoId = offer.promoId;
        }
        cart[line.key].qty += 1;
        cartApi.saveCart(cart);
        cartUi?.render?.();
        cartUi?.showAddedFeedback?.(line.name);
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
    };

    const setProductQty = (ctx, qty) => {
        const line = catalog.buildCartLineFields(ctx, pricing);
        if (!line) return;
        const offer = ctx.offer;
        const cart = cartApi.loadCart();
        if (qty <= 0) {
            delete cart[line.key];
        } else {
            if (!cart[line.key]) {
                cart[line.key] = { ...line, qty: 0 };
            }
            if (offer?.promoPrice != null && Number.isFinite(Number(offer.promoPrice))) {
                cart[line.key].price = Number(offer.promoPrice);
                if (offer.promoId) cart[line.key].promoId = offer.promoId;
            }
            cart[line.key].qty = qty;
        }
        cartApi.saveCart(cart);
        cartUi?.render?.();
    };

    const activeCategoryLabel = () => {
        if (!activeCategory || !catalogData) return '';
        const cat = catalogData.categories.find((c) => c.id === activeCategory);
        return cat ? catalog.formatCategoryLabel(cat.name) : '';
    };

    const updateCategoryHead = () => {
        const label = activeCategoryLabel();
        if (categoryTitleEl) categoryTitleEl.textContent = label || 'Catálogo';
        if (categoryEyebrowEl) {
            categoryEyebrowEl.textContent = label ? 'Categoria' : 'Escolha seus produtos';
        }
        if (categoriesBtnLabel) {
            categoriesBtnLabel.textContent = label || 'Categorias';
        }
    };

    const updateStats = (count) => {
        const text = activeCategory
            ? `${activeCategoryLabel()} · ${count} produto(s)`
            : `${count} de ${displayItems.length} produtos`;
        if (statsEl) statsEl.textContent = text;
        if (modalStatsEl) modalStatsEl.textContent = text;
    };

    const cardDeps = () => ({
        catalog,
        pricing,
        formatPrice: catalog.formatPrice.bind(catalog),
        getCartQty: catalog.getCartQty.bind(catalog),
        promoOffers,
    });

    const refreshCards = () => {
        productCards.syncGridQty(grid, sortItems(getFilteredProducts()), cardDeps());
    };

    productDetail?.init?.({
        getDisplayItems: () => displayItems,
        getPromoOffers: () => promoOffers,
        onCartChanged: refreshCards,
    });

    const renderProducts = () => {
        const scrollY = window.scrollY;
        const items = sortItems(getFilteredProducts());
        updateStats(items.length);
        updateCategoryHead();
        grid.innerHTML = items.length
            ? productCards.renderGridHtml(items, cardDeps())
            : '<p class="parceiros-catalog-empty">Nenhum produto encontrado.</p>';
        window.scrollTo(0, scrollY);
    };

    const filterPillHtml = (id, label, count) => {
        const active = activeCategory === id;
        const iconHtml = id
            ? catalog.categoryTotemIconHtml(id).replace(/totem-cat-pill__icon/g, 'ze-cat-pill__icon')
            : `<span class="ze-cat-pill__icon ze-cat-pill__icon--all" aria-hidden="true"><span class="material-symbols-outlined">apps</span></span>`;
        return `<button type="button" class="ze-filter-pill ze-cat-pill" data-category-id="${catalog.escapeHtml(id)}" aria-pressed="${active ? 'true' : 'false'}">${iconHtml}<span class="ze-cat-pill__text"><span class="ze-cat-pill__label">${catalog.escapeHtml(label)}</span><span class="ze-cat-pill__count">${count}</span></span></button>`;
    };

    const renderFilters = () => {
        if (!catalogData) return;
        const categoryCounts = {};
        displayItems.forEach((item) => {
            categoryCounts[item.categoryId] = (categoryCounts[item.categoryId] || 0) + 1;
        });

        const pills =
            filterPillHtml('', 'Todos', displayItems.length) +
            catalogData.categories
                .filter((cat) => categoryCounts[cat.id])
                .map((cat) =>
                    filterPillHtml(
                        cat.id,
                        catalog.formatCategoryLabel(cat.name),
                        categoryCounts[cat.id]
                    )
                )
                .join('');

        if (filtersEl) filtersEl.innerHTML = pills;
        if (filtersMobileEl) filtersMobileEl.innerHTML = pills;
    };

    const closeCategoriesModal = () => {
        if (!categoriesModal) return;
        categoriesModal.classList.remove('ze-catalog-categories-modal--open');
        categoriesModal.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('lig-catalog-modal-open');
    };

    const openCategoriesModal = () => {
        if (!categoriesModal) return;
        categoriesModal.classList.add('ze-catalog-categories-modal--open');
        categoriesModal.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('lig-catalog-modal-open');
    };

    const applyCategory = (categoryId) => {
        activeCategory = categoryId;
        renderFilters();
        renderProducts();
        closeCategoriesModal();
    };

    const onFilterClick = (e) => {
        const pill = e.target.closest('.ze-filter-pill');
        if (!pill) return;
        applyCategory(pill.dataset.categoryId || '');
    };

    filtersEl?.addEventListener('click', onFilterClick);
    filtersMobileEl?.addEventListener('click', onFilterClick);

    document.getElementById('catalog-categories-open')?.addEventListener('click', openCategoriesModal);
    document.getElementById('catalog-categories-close')?.addEventListener('click', closeCategoriesModal);
    document.getElementById('catalog-categories-backdrop')?.addEventListener('click', closeCategoriesModal);

    productCards.bindCatalogGrid(grid, {
        getDeps: cardDeps,
        onAdd: (ctx) => {
            addProduct(ctx);
            refreshCards();
        },
        onRemove: (ctx) => {
            removeProduct(ctx);
            refreshCards();
        },
        onSetQty: (ctx) => {
            setProductQty(ctx, ctx.qty);
            refreshCards();
        },
    }, () => sortItems(getFilteredProducts()));

    const applySearchQuery = (raw, { updateUrl = false } = {}) => {
        const value = String(raw || '').trim();
        searchQuery = value.toLowerCase();
        cachedQueryKey = '';
        cachedQueryInfo = null;

        if (updateUrl) {
            const url = new URL(window.location.href);
            if (value) url.searchParams.set('q', value);
            else url.searchParams.delete('q');
            const next = `${url.pathname}${url.search}${url.hash}`;
            if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
                window.history.replaceState(null, '', next);
            }
        }

        if (catalogData) renderProducts();
    };

    const bindSearchInput = () => {
        const input = searchInput();
        if (!input || input.dataset.ligCatalogSearchBound === '1') return;
        input.dataset.ligCatalogSearchBound = '1';

        input.addEventListener('input', () => {
            const value = input.value || '';
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => {
                applySearchQuery(value, { updateUrl: true });
            }, 160);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (searchTimer) clearTimeout(searchTimer);
            applySearchQuery(input.value, { updateUrl: true });
        });
    };

    bindSearchInput();
    window.addEventListener('ligeirinho-catalog-search', (event) => {
        const q = event.detail?.q ?? searchInput()?.value ?? '';
        const input = searchInput();
        if (input && input.value !== q) input.value = q;
        if (searchTimer) clearTimeout(searchTimer);
        applySearchQuery(q, { updateUrl: true });
    });

    sortSelects.forEach((select) => {
        select.addEventListener('change', () => {
            sortSelects.forEach((el) => {
                if (el !== select) el.value = select.value;
            });
            renderProducts();
        });
    });

    window.LigeirinhoCatalogLoader.load()
        .then((data) => Promise.all([pricing.loadPackConfig(), pricing.loadTierImages()]).then(() => data))
        .then(async (data) => {
            catalogData = data;
            const groups = pricing.buildGroups(data);
            window.__ligProductGroups = groups;
            displayItems = attachSearchIndex(pricing.getDisplayProducts(data, groups));

            const params = new URLSearchParams(window.location.search);
            const catParam = params.get('categoria');
            const searchParam = params.get('q');

            bindSearchInput();
            if (searchParam) {
                searchQuery = searchParam.toLowerCase();
                const input = searchInput();
                if (input) input.value = searchParam;
            }

            renderFilters();
            if (catParam && data.categories.some((c) => c.id === catParam)) {
                applyCategory(catParam);
            } else {
                renderProducts();
            }

            try {
                await reloadPromoOffers(false);
                refreshCards();
            } catch {
                /* promo opcional — não bloqueia a busca */
            }
        })
        .catch(() => {
            if (statsEl) statsEl.textContent = 'Erro ao carregar catálogo';
            grid.innerHTML =
                '<p class="parceiros-catalog-empty">Erro ao carregar o catálogo.</p>';
        });

    window.addEventListener('ligeirinho-cart-changed', refreshCards);

    window.addEventListener('ligeirinho-catalog-synced', async (event) => {
        const data = event.detail?.catalogData;
        if (!data) return;
        catalogData = data;
        const groups = pricing.buildGroups(data);
        window.__ligProductGroups = groups;
        displayItems = attachSearchIndex(pricing.getDisplayProducts(data, groups));
        renderFilters();
        renderProducts();
        try {
            await reloadPromoOffers(true);
            refreshCards();
        } catch {
            /* ignore */
        }
    });

    document.getElementById('catalog-refresh')?.addEventListener('click', () => {
        document.getElementById('lig-catalog-sync-btn')?.click();
    });
})();
