(function () {

    const cartApi = window.LigeirinhoCart;

    const catalog = window.LigeirinhoCatalog;

    const pricing = window.LigeirinhoPricing;

    const cartUi = window.LigeirinhoCartUI;

    if (!cartApi || !catalog || !pricing) return;



    const grid = document.getElementById('catalog-grid');

    const filtersEl = document.getElementById('catalog-filters');

    const filtersMobileEl = document.getElementById('catalog-filters-mobile');

    const statsEl = document.getElementById('catalog-stats');

    const sortSelects = document.querySelectorAll('[data-catalog-sort]');

    const searchInput = () => document.getElementById('ze-search-input');



    if (!grid) return;



    let catalogData = null;

    let displayItems = [];

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



    const updateStats = (count) => {

        if (!statsEl) return;

        if (activeCategory) {

            const label = catalogData.categories.find((c) => c.id === activeCategory)?.name;

            statsEl.textContent = label

                ? `${catalog.formatCategoryLabel(label)} · ${count} produto(s)`

                : `${count} produto(s)`;

            return;

        }

        statsEl.textContent = `${count} de ${displayItems.length} produtos`;

    };



    const refreshCards = () => {

        grid.querySelectorAll('.ze-product-card[data-group-key]').forEach((card) => {

            catalog.updateCardPriceUi(card);

        });

    };



    const renderProducts = () => {

        const scrollY = window.scrollY;

        const items = sortItems(getFilteredProducts());

        updateStats(items.length);

        grid.innerHTML = items.length

            ? items.map((item) => catalog.productCardZe(item)).join('')

            : '<p class="col-span-full text-center text-on-surface-variant py-12 text-sm">Nenhum produto encontrado.</p>';

        window.scrollTo(0, scrollY);

    };



    const filterPillHtml = (id, label, count) => {

        const active = activeCategory === id;

        return `<button type="button" class="ze-filter-pill" data-category-id="${catalog.escapeHtml(id)}" aria-pressed="${active ? 'true' : 'false'}">${catalog.escapeHtml(label)}${count ? ` <span class="opacity-60">${count}</span>` : ''}</button>`;

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



    const applyCategory = (categoryId) => {

        activeCategory = categoryId;

        renderFilters();

        renderProducts();

    };



    const onFilterClick = (e) => {

        const pill = e.target.closest('.ze-filter-pill');

        if (!pill) return;

        applyCategory(pill.dataset.categoryId || '');

        pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

    };



    filtersEl?.addEventListener('click', onFilterClick);

    filtersMobileEl?.addEventListener('click', onFilterClick);



    catalog.bindQtySteppers(grid, {

        onAdd: (ctx) => {

            addProduct(ctx);

            refreshCards();

        },

        onRemove: (ctx) => {

            removeProduct(ctx);

            refreshCards();

        },

    });



    searchInput()?.addEventListener('input', () => {

        const value = searchInput()?.value?.trim().toLowerCase() || '';

        if (searchTimer) clearTimeout(searchTimer);

        searchTimer = window.setTimeout(() => {

            searchQuery = value;

            renderProducts();

        }, 200);

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

        .then((data) => {

            catalogData = data;

            const groups = pricing.buildGroups(data);

            window.__ligProductGroups = groups;

            displayItems = attachSearchIndex(pricing.getDisplayProducts(data, groups));

            renderFilters();



            const params = new URLSearchParams(window.location.search);

            const catParam = params.get('categoria');

            const searchParam = params.get('q');



            if (searchParam) {

                searchQuery = searchParam.toLowerCase();

                if (searchInput()) searchInput().value = searchParam;

            }



            if (catParam && data.categories.some((c) => c.id === catParam)) {

                applyCategory(catParam);

            } else {

                renderProducts();

            }

        })

        .catch(() => {

            if (statsEl) statsEl.textContent = 'Erro ao carregar catálogo';

            grid.innerHTML =

                '<p class="col-span-full text-center text-on-surface-variant py-8 text-sm">Erro ao carregar o catálogo.</p>';

        });



    window.addEventListener('ligeirinho-cart-changed', refreshCards);

})();

