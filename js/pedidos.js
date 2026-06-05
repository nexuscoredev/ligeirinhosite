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



    const addProduct = (ctx) => {

        const { variant, group, cartKey, tier } = ctx;

        if (!variant) return;

        const key = cartKey || catalog.cartKeyFor(variant);

        const packType = variant.tier || tier || 'unidade';

        const name = pricing.cartItemName({ ...variant, tier: packType }, group);

        const cart = cartApi.loadCart();

        if (!cart[key]) {

            cart[key] = {

                id: variant.id,

                cartKey: key,

                name,

                price: variant.price,

                qty: 0,

                packType,

            };

        }

        cart[key].qty += 1;

        cartApi.saveCart(cart);

        cartUi?.render?.();

        cartUi?.showAddedFeedback?.(name);

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



    const getFilteredProducts = () => {

        const search = window.LigeirinhoSearch;

        const queryInfo = search?.expandSearchQuery?.(searchQuery) || { raw: searchQuery, terms: searchQuery ? [searchQuery] : [] };

        return displayItems.filter((item) => {

            if (activeCategory && item.categoryId !== activeCategory) return false;

            const haystack = `${item.product.name} ${item.product.description || ''} ${item.categoryName}`.toLowerCase();

            if (search?.matchesSearch) return search.matchesSearch(haystack, queryInfo);

            return !searchQuery || haystack.includes(searchQuery);

        });

    };



    const sortItems = (items) => {

        const mode = sortSelects[0]?.value || 'name';

        const sorted = [...items];

        if (mode === 'price-asc') {

            sorted.sort((a, b) => (a.product.price ?? 0) - (b.product.price ?? 0));

        } else if (mode === 'price-desc') {

            sorted.sort((a, b) => (b.product.price ?? 0) - (a.product.price ?? 0));

        } else {

            sorted.sort((a, b) => a.product.name.localeCompare(b.product.name, 'pt-BR'));

        }

        return sorted;

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

            renderProducts();

        },

        onRemove: (ctx) => {

            removeProduct(ctx);

            renderProducts();

        },

    });



    searchInput()?.addEventListener('input', () => {

        searchQuery = searchInput()?.value?.trim().toLowerCase() || '';

        renderProducts();

    });



    sortSelects.forEach((select) => {

        select.addEventListener('change', () => {

            sortSelects.forEach((el) => {

                if (el !== select) el.value = select.value;

            });

            renderProducts();

        });

    });



    fetch('data/catalogo.json')

        .then((r) => {

            if (!r.ok) throw new Error();

            return r.json();

        })

        .then((data) => Promise.all([pricing.loadPackConfig(), pricing.loadTierImages()]).then(() => data))

        .then((data) => {

            catalogData = data;

            window.__ligProductGroups = pricing.buildGroups(data);

            displayItems = pricing.getDisplayProducts(data);

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

                '<p class="col-span-full text-center text-on-surface-variant py-8 text-sm">Erro ao carregar <code class="text-gold-accent">data/catalogo.json</code>.</p>';

        });



    window.addEventListener('ligeirinho-cart-changed', refreshCards);

})();

