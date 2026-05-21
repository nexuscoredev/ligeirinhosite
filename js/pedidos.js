(function () {
    const cartApi = window.LigeirinhoCart;
    const cartUi = window.LigeirinhoCartUI;
    if (!cartApi) return;

    const { saveCart, updateNavCartBadge } = cartApi;

    const grid = document.getElementById('catalog-grid');
    const filtersEl = document.getElementById('catalog-filters');
    const filtersMobileSelect = document.getElementById('catalog-filters-mobile');
    const statsEl = document.getElementById('catalog-stats');
    const searchInputs = document.querySelectorAll('[data-catalog-search]');
    const sortSelect = document.getElementById('catalog-sort');

    if (!grid || !filtersEl) return;

    let catalog = null;
    let activeCategories = new Set();
    let searchQuery = '';

    const productImageUrl = (url) => {
        if (!url) return null;
        if (/\.(webp|jpg|jpeg|png|gif)(\?|$)/i.test(url)) return url;
        return `${url}.webp`;
    };

    const formatPrice = (value) => {
        if (value == null || Number.isNaN(value)) return '—';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const escapeHtml = (str) =>
        String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const addToCart = (product) => {
        const cart = cartApi.loadCart();
        if (!cart[product.id]) {
            cart[product.id] = {
                id: product.id,
                name: product.name,
                price: product.price,
                qty: 0,
            };
        }
        cart[product.id].qty += 1;
        saveCart(cart);
        cartUi?.render();
        cartUi?.open();
        updateNavCartBadge();
    };

    const productCard = (product, categoryName) => {
        const subtitle = product.description || categoryName;
        const imgSrc = productImageUrl(product.image);
        const badge = product.adultOnly
            ? '<div class="absolute top-3 left-3 bg-surface-variant/50 border border-surface-variant text-on-surface-variant font-label-caps text-[10px] leading-none px-1.5 py-0.5 rounded">+18</div>'
            : '';

        const imageBlock = imgSrc
            ? `<img alt="" class="max-h-full max-w-full object-contain drop-shadow-2xl" src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async">`
            : `<span class="material-symbols-outlined text-5xl text-on-surface-variant/40">liquor</span>`;

        return `<article class="product-card bg-surface-gray rounded-xl overflow-hidden border border-surface-variant/30 relative group flex flex-col transition-transform hover:-translate-y-1 duration-300" data-product-id="${product.id}">
<div class="product-glow absolute inset-0 bg-vibrant-orange/5 opacity-0 transition-opacity duration-300 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(255,107,0,0.15)]"></div>
<div class="relative h-48 bg-surface-container flex items-center justify-center p-4">${badge}${imageBlock}</div>
<div class="p-4 flex-grow flex flex-col justify-between z-10">
<div>
<h2 class="font-headline-md text-[13px] leading-tight font-semibold text-on-surface mb-1 line-clamp-2">${escapeHtml(product.name)}</h2>
<p class="font-body-md text-[11px] leading-snug text-on-surface-variant mb-3 line-clamp-2">${escapeHtml(subtitle)}</p>
</div>
<div class="flex items-center justify-between gap-2">
<span class="font-label-caps text-[12px] text-gold-accent shrink-0">${formatPrice(product.price)}</span>
<button type="button" class="catalog-add-btn bg-vibrant-orange hover:bg-primary-container text-deep-black font-bold p-1.5 rounded-lg transition-colors flex items-center justify-center" data-product-id="${product.id}" aria-label="Adicionar ao carrinho">
<span class="material-symbols-outlined text-[20px]">add_shopping_cart</span>
</button>
</div>
</div>
</article>`;
    };

    const getFilteredProducts = () => {
        const items = [];
        catalog.categories.forEach((cat) => {
            if (activeCategories.size && !activeCategories.has(cat.id)) return;
            cat.products.forEach((product) => {
                const haystack = `${product.name} ${product.description || ''} ${cat.name}`.toLowerCase();
                if (searchQuery && !haystack.includes(searchQuery)) return;
                items.push({ product, categoryName: cat.name });
            });
        });
        return items;
    };

    const sortItems = (items) => {
        const mode = sortSelect?.value || 'name';
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

    const productById = (id) => {
        for (const cat of catalog.categories) {
            const found = cat.products.find((p) => p.id === id);
            if (found) return found;
        }
        return null;
    };

    const renderProducts = () => {
        const items = sortItems(getFilteredProducts());
        statsEl.textContent = `Mostrando ${items.length} de ${catalog.totalProducts} produtos`;
        grid.innerHTML = items.map(({ product, categoryName }) => productCard(product, categoryName)).join('');
    };

    const chipClasses = (active) =>
        active
            ? 'catalog-filter-chip bg-vibrant-orange/15 border-vibrant-orange text-vibrant-orange'
            : 'catalog-filter-chip border-surface-variant/40 text-on-surface-variant hover:border-vibrant-orange/35 hover:text-on-surface';

    const renderFilters = () => {
        const allActive = activeCategories.size === 0;

        if (filtersEl) {
            filtersEl.innerHTML = `
<button type="button" class="catalog-filter-all col-span-2 px-2 py-2 rounded-md border text-[12px] font-medium transition-colors ${chipClasses(allActive)}" data-active="${allActive}">
                    Todas (${catalog.totalProducts})
                </button>
${catalog.categories
    .map((cat) => {
        const active = activeCategories.has(cat.id);
        return `<button type="button" class="catalog-filter px-2 py-1.5 rounded-md border text-left transition-colors ${chipClasses(active)}" data-value="${cat.id}" title="${escapeHtml(cat.name)}" data-active="${active}">
<span class="block text-[11px] leading-tight line-clamp-2">${escapeHtml(cat.name)}</span>
<span class="block text-[10px] opacity-70 mt-0.5">${cat.products.length}</span>
</button>`;
    })
    .join('')}`;

            const allBtn = filtersEl.querySelector('.catalog-filter-all');
            const catBtns = filtersEl.querySelectorAll('.catalog-filter');

            allBtn?.addEventListener('click', () => {
                activeCategories.clear();
                renderFilters();
                renderProducts();
            });

            catBtns.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.value;
                    if (activeCategories.has(id)) {
                        activeCategories.delete(id);
                    } else {
                        activeCategories.add(id);
                    }
                    renderFilters();
                    renderProducts();
                });
            });
        }

        if (filtersMobileSelect) {
            const current =
                activeCategories.size === 1 ? [...activeCategories][0] : '';
            filtersMobileSelect.innerHTML = `<option value="">Todas as categorias (${catalog.totalProducts})</option>${catalog.categories
                .map(
                    (cat) =>
                        `<option value="${cat.id}">${escapeHtml(cat.name)} (${cat.products.length})</option>`
                )
                .join('')}`;
            filtersMobileSelect.value = current;
        }
    };

    filtersMobileSelect?.addEventListener('change', () => {
        activeCategories.clear();
        if (filtersMobileSelect.value) {
            activeCategories.add(filtersMobileSelect.value);
        }
        renderFilters();
        renderProducts();
    });

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.catalog-add-btn');
        if (!btn || !catalog) return;
        const product = productById(btn.dataset.productId);
        if (product) addToCart(product);
    });

    searchInputs.forEach((input) => {
        input.addEventListener('input', () => {
            searchQuery = input.value.trim().toLowerCase();
            searchInputs.forEach((el) => {
                if (el !== input) el.value = input.value;
            });
            renderProducts();
        });
    });

    sortSelect?.addEventListener('change', renderProducts);

    fetch('data/catalogo.json')
        .then((r) => {
            if (!r.ok) throw new Error('Catálogo não encontrado');
            return r.json();
        })
        .then((data) => {
            catalog = data;
            const categoriaParam = new URLSearchParams(window.location.search).get('categoria');
            if (categoriaParam && data.categories.some((c) => c.id === categoriaParam)) {
                activeCategories.add(categoriaParam);
            }
            renderFilters();
            renderProducts();
            if (categoriaParam && activeCategories.has(categoriaParam)) {
                const label = data.categories.find((c) => c.id === categoriaParam)?.name;
                if (label) {
                    statsEl.textContent = `Categoria: ${label} — ${getFilteredProducts().length} produto(s)`;
                }
                grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        })
        .catch(() => {
            statsEl.textContent = 'Não foi possível carregar o catálogo.';
            grid.innerHTML =
                '<p class="col-span-full text-on-surface-variant font-body-md">Erro ao carregar <code class="text-gold-accent">data/catalogo.json</code>. Use um servidor local ou publique a pasta <code class="text-gold-accent">data/</code>.</p>';
        });
})();
