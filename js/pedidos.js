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
    const sortSelects = document.querySelectorAll('[data-catalog-sort]');

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

    const markAddButtonSuccess = (triggerBtn) => {
        const icon = triggerBtn.querySelector('.material-symbols-outlined');
        if (!icon) return;

        triggerBtn.classList.add('catalog-add-btn--success');
        triggerBtn.setAttribute('aria-label', 'Adicionado ao carrinho');
        icon.textContent = 'check';

        window.setTimeout(() => {
            triggerBtn.classList.remove('catalog-add-btn--success');
            triggerBtn.setAttribute('aria-label', 'Adicionar ao carrinho');
            icon.textContent = 'add_shopping_cart';
        }, 1100);
    };

    const addToCart = (product, triggerBtn) => {
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
        updateNavCartBadge();
        cartUi?.showAddedFeedback?.(product.name);

        if (triggerBtn) {
            markAddButtonSuccess(triggerBtn);
        }
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

    const productById = (id) => {
        for (const cat of catalog.categories) {
            const found = cat.products.find((p) => p.id === id);
            if (found) return found;
        }
        return null;
    };

    const renderProducts = () => {
        const scrollY = window.scrollY;
        const items = sortItems(getFilteredProducts());
        statsEl.textContent = `Mostrando ${items.length} de ${catalog.totalProducts} produtos`;
        grid.innerHTML = items.map(({ product, categoryName }) => productCard(product, categoryName)).join('');
        window.scrollTo(0, scrollY);
    };

    const formatCategoryLabel = (name) =>
        name
            .toLowerCase()
            .split(/\s+/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    const selectedCategoryId = () =>
        activeCategories.size === 1 ? [...activeCategories][0] : '';

    const categoryButtonHtml = (categoryId, label, count, layout) => {
        const active = selectedCategoryId() === categoryId;
        const pressed = active ? 'true' : 'false';
        const base =
            'catalog-cat-btn border border-transparent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vibrant-orange focus-visible:ring-offset-2 focus-visible:ring-offset-surface-gray';
        const desktop =
            'w-full text-left px-3 py-2 flex items-center justify-between gap-2 text-sm text-on-surface hover:bg-surface-container-high/80';
        const mobile =
            'shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-on-surface hover:border-vibrant-orange/40 whitespace-nowrap';
        const layoutClass = layout === 'mobile' ? mobile : desktop;
        const countHtml =
            layout === 'mobile'
                ? `<span class="text-[10px] text-on-surface-variant tabular-nums">${count}</span>`
                : `<span class="text-[11px] text-on-surface-variant tabular-nums shrink-0">${count}</span>`;

        return `<button type="button" role="listitem" class="${base} ${layoutClass}" data-category-id="${escapeHtml(categoryId)}" aria-pressed="${pressed}">
<span class="${layout === 'desktop' ? 'truncate min-w-0' : ''}">${escapeHtml(label)}</span>${countHtml}
</button>`;
    };

    const categoryFiltersHtml = (layout) => {
        const allBtn = categoryButtonHtml(
            '',
            layout === 'mobile' ? 'Todas' : 'Todas as categorias',
            catalog.totalProducts,
            layout
        );
        const items = catalog.categories
            .map((cat) =>
                categoryButtonHtml(
                    cat.id,
                    formatCategoryLabel(cat.name),
                    cat.products.length,
                    layout
                )
            )
            .join('');
        return allBtn + items;
    };

    const syncFilterButtons = () => {
        const activeId = selectedCategoryId();
        document.querySelectorAll('.catalog-cat-btn').forEach((btn) => {
            const isActive = (btn.dataset.categoryId || '') === activeId;
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    const applyCategoryFilter = (categoryId) => {
        activeCategories.clear();
        if (categoryId) {
            activeCategories.add(categoryId);
        }
        syncFilterButtons();
        renderProducts();
        const count = getFilteredProducts().length;
        if (categoryId) {
            const label = catalog.categories.find((c) => c.id === categoryId)?.name;
            if (label) {
                statsEl.textContent = `Categoria: ${formatCategoryLabel(label)} — ${count} produto(s)`;
                return;
            }
        }
        statsEl.textContent = `Mostrando ${count} de ${catalog.totalProducts} produtos`;
    };

    const renderFilters = () => {
        if (!catalog) return;
        if (filtersEl) {
            filtersEl.innerHTML = categoryFiltersHtml('desktop');
        }
        if (filtersMobileSelect) {
            filtersMobileSelect.innerHTML = categoryFiltersHtml('mobile');
        }
        syncFilterButtons();
    };

    const onCategoryFilterClick = (e) => {
        const btn = e.target.closest('.catalog-cat-btn');
        if (!btn) return;
        applyCategoryFilter(btn.dataset.categoryId || '');
        if (btn.closest('#catalog-filters-mobile')) {
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            btn.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    };

    filtersEl?.addEventListener('click', onCategoryFilterClick);
    filtersMobileSelect?.addEventListener('click', onCategoryFilterClick);

    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.catalog-add-btn');
        if (!btn || !catalog) return;
        const product = productById(btn.dataset.productId);
        if (product) addToCart(product, btn);
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
            if (!r.ok) throw new Error('Catálogo não encontrado');
            return r.json();
        })
        .then((data) => {
            catalog = data;
            renderFilters();
            const categoriaParam = new URLSearchParams(window.location.search).get('categoria');
            if (categoriaParam && data.categories.some((c) => c.id === categoriaParam)) {
                applyCategoryFilter(categoriaParam);
                const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                grid.scrollIntoView({
                    behavior: reduceMotion ? 'auto' : 'smooth',
                    block: 'start',
                });
            } else {
                renderProducts();
            }
        })
        .catch(() => {
            statsEl.textContent = 'Não foi possível carregar o catálogo.';
            grid.innerHTML =
                '<p class="col-span-full text-on-surface-variant font-body-md">Erro ao carregar <code class="text-gold-accent">data/catalogo.json</code>. Use um servidor local ou publique a pasta <code class="text-gold-accent">data/</code>.</p>';
        });
})();
