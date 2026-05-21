(function () {
    const grid = document.getElementById('catalog-grid');
    const filtersEl = document.getElementById('catalog-filters');
    const statsEl = document.getElementById('catalog-stats');
    const searchInputs = document.querySelectorAll('[data-catalog-search]');
    const sortSelect = document.getElementById('catalog-sort');

    if (!grid || !filtersEl) return;

    let catalog = null;
    let activeCategories = new Set();
    let searchQuery = '';

    const formatPrice = (product) => {
        if (product.price != null) {
            return product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        if (product.priceLabel) {
            return product.priceLabel.replace(/\u00a0/g, ' ').replace(/Â\s/g, ' ');
        }
        return '—';
    };

    const productCard = (product, categoryName) => {
        const subtitle = product.description || categoryName;
        const badge = product.adultOnly
            ? '<div class="absolute top-3 left-3 bg-surface-variant/50 border border-surface-variant text-on-surface-variant font-label-caps text-label-caps px-2 py-1 rounded">+18</div>'
            : '';

        const imageBlock = product.image
            ? `<img alt="" class="max-h-full object-contain drop-shadow-2xl" src="${product.image}" loading="lazy">`
            : `<span class="material-symbols-outlined text-5xl text-on-surface-variant/40">liquor</span>`;

        return `<article class="product-card bg-surface-gray rounded-xl overflow-hidden border border-surface-variant/30 relative group flex flex-col transition-transform hover:-translate-y-1 duration-300" data-product-id="${product.id}">
<div class="product-glow absolute inset-0 bg-vibrant-orange/5 opacity-0 transition-opacity duration-300 rounded-xl pointer-events-none shadow-[0_0_15px_rgba(255,107,0,0.15)]"></div>
<div class="relative h-48 bg-surface-container flex items-center justify-center p-4">${badge}${imageBlock}</div>
<div class="p-5 flex-grow flex flex-col justify-between z-10">
<div>
<h2 class="font-headline-md text-headline-md text-on-surface text-lg mb-1 line-clamp-2">${product.name}</h2>
<p class="font-body-md text-sm text-on-surface-variant mb-4 line-clamp-2">${subtitle}</p>
</div>
<div class="flex items-center justify-between gap-3">
<span class="font-label-caps text-[16px] text-gold-accent shrink-0">${formatPrice(product)}</span>
<button type="button" class="catalog-add-btn bg-vibrant-orange/80 hover:bg-primary-container text-deep-black font-bold p-2 rounded-lg transition-colors flex items-center justify-center" title="Protótipo — carrinho em breve" disabled>
<span class="material-symbols-outlined">add_shopping_cart</span>
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

    const renderProducts = () => {
        const items = sortItems(getFilteredProducts());
        statsEl.textContent = `Mostrando ${items.length} de ${catalog.totalProducts} produtos`;
        grid.innerHTML = items.map(({ product, categoryName }) => productCard(product, categoryName)).join('');
    };

    const renderFilters = () => {
        const allChecked = activeCategories.size === 0;
        filtersEl.innerHTML = `
<li>
<label class="flex items-center gap-3 cursor-pointer group">
<input type="checkbox" class="catalog-filter-all form-checkbox bg-deep-black border-surface-variant text-vibrant-orange focus:ring-vibrant-orange rounded" ${allChecked ? 'checked' : ''}>
<span class="text-on-surface group-hover:text-vibrant-orange transition-colors">Todos</span>
</label>
</li>
${catalog.categories
    .map(
        (cat) => `
<li>
<label class="flex items-center gap-3 cursor-pointer group">
<input type="checkbox" value="${cat.id}" class="catalog-filter form-checkbox bg-deep-black border-surface-variant text-vibrant-orange focus:ring-vibrant-orange rounded" ${activeCategories.has(cat.id) ? 'checked' : ''}>
<span class="text-on-surface-variant group-hover:text-vibrant-orange transition-colors">${cat.name}</span>
<span class="text-on-surface-variant/50 text-xs ml-auto">${cat.products.length}</span>
</label>
</li>`
    )
    .join('')}`;

        const allInput = filtersEl.querySelector('.catalog-filter-all');
        const catInputs = filtersEl.querySelectorAll('.catalog-filter');

        allInput?.addEventListener('change', () => {
            activeCategories.clear();
            catInputs.forEach((input) => {
                input.checked = false;
            });
            allInput.checked = true;
            renderProducts();
        });

        catInputs.forEach((input) => {
            input.addEventListener('change', () => {
                if (input.checked) {
                    activeCategories.add(input.value);
                } else {
                    activeCategories.delete(input.value);
                }
                allInput.checked = activeCategories.size === 0;
                renderProducts();
            });
        });
    };

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
            renderFilters();
            renderProducts();
        })
        .catch(() => {
            statsEl.textContent = 'Não foi possível carregar o catálogo.';
            grid.innerHTML =
                '<p class="col-span-full text-on-surface-variant font-body-md">Erro ao carregar <code class="text-gold-accent">data/catalogo.json</code>. Use um servidor local ou publique a pasta <code class="text-gold-accent">data/</code>.</p>';
        });
})();
