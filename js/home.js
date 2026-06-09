(function () {
    const cartApi = window.LigeirinhoCart;
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;
    if (!cartApi || !catalog || !pricing) return;

    const root = document.getElementById('home-app');
    if (!root) return;

    const featuredCategoryIds = [
        'cervejas',
        'destilados',
        'refrigerantes-sucos',
        'energeticos',
        'combos',
        'whiskys',
        'vinhos',
        'gelos',
    ];

    let catalogData = null;

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
        window.LigeirinhoCartUI?.render?.();
        window.LigeirinhoCartUI?.showAddedFeedback?.(name);
    };

    const addProducts = (products) => {
        const cart = cartApi.loadCart();
        products.forEach(({ product, qty }) => {
            if (!cart[product.id]) {
                cart[product.id] = { id: product.id, name: product.name, price: product.price, qty: 0 };
            }
            cart[product.id].qty += qty;
        });
        cartApi.saveCart(cart);
        window.LigeirinhoCartUI?.render?.();
        window.LigeirinhoCartUI?.showAddedFeedback?.('Combo adicionado');
        window.LigeirinhoCartUI?.burstConfetti?.();
    };

    const removeProduct = (ctx) => {
        const key = ctx.cartKey;
        if (!key) return;
        const cart = cartApi.loadCart();
        if (!cart[key]) return;
        cart[key].qty -= 1;
        if (cart[key].qty <= 0) delete cart[key];
        cartApi.saveCart(cart);
        window.LigeirinhoCartUI?.render?.();
    };

    const productById = (data, id) => {
        for (const cat of data.categories) {
            const found = cat.products.find((p) => p.id === id);
            if (found) return found;
        }
        return null;
    };

    const refreshSteppers = () => {
        root.querySelectorAll('.ze-product-h[data-group-key]').forEach((card) => {
            catalog.updateCardPriceUi(card);
        });
    };

    const reorderHtml = () => {
        const summary = cartApi.lastOrderSummary();
        if (!summary) return '';
        return `<section class="ze-reorder" id="home-reorder" aria-label="Repetir último pedido">
<div class="ze-reorder__icon"><span class="material-symbols-outlined">replay</span></div>
<div class="ze-reorder__body">
<p class="ze-reorder__title">Repetir último pedido</p>
<p class="ze-reorder__sub">${summary.count} item(ns) · ${catalog.formatPrice(summary.total)}</p>
</div>
<button type="button" class="ze-reorder__btn" id="home-reorder-btn">Pedir de novo</button>
</section>`;
    };

    const comboCardHtml = (combo, total) => {
        return `<article class="ze-combo-card" data-combo-id="${catalog.escapeHtml(combo.id)}">
<div class="ze-combo-card__icon"><span class="material-symbols-outlined">${catalog.escapeHtml(combo.icon || 'local_mall')}</span></div>
<p class="ze-combo-card__title">${catalog.escapeHtml(combo.title)}</p>
<p class="ze-combo-card__sub">${catalog.escapeHtml(combo.subtitle)}</p>
<p class="ze-combo-card__price">${catalog.formatPrice(total)}</p>
<button type="button" class="ze-combo-card__btn" data-combo-add="${catalog.escapeHtml(combo.id)}">Adicionar combo</button>
</article>`;
    };

    const combosSectionHtml = (combos, data) => {
        if (!combos.length) return '';
        const cards = combos
            .map((combo) => {
                let total = 0;
                combo.items.forEach(({ id, qty }) => {
                    const product = productById(data, id);
                    if (product) total += (product.price ?? 0) * qty;
                });
                return comboCardHtml(combo, total);
            })
            .join('');
        return `<section class="ze-combos-section ze-section" aria-labelledby="home-combos-title">
<div class="ze-section__head">
<h2 id="home-combos-title" class="ze-section__title">Combos para ocasião</h2>
</div>
<div class="ze-combo-scroll">${cards}</div>
</section>`;
    };

    const sectionOrder = () => {
        const prefs = cartApi.loadPrefs()?.categories || [];
        const ordered = [...featuredCategoryIds];
        prefs.forEach((id) => {
            const idx = ordered.indexOf(id);
            if (idx > 0) {
                ordered.splice(idx, 1);
                ordered.unshift(id);
            } else if (idx === -1 && featuredCategoryIds.includes(id)) {
                ordered.unshift(id);
            }
        });
        return [...new Set(ordered)];
    };

    const renderHome = (data, combos = [], displayItems = []) => {
        catalogData = data;
        window.__ligProductGroups = pricing.buildGroups(data);

        const categories = data.categories.filter((c) => c.products.length > 0);
        const catTiles = categories.map((c) => catalog.categoryTileHtml(c)).join('');

        const itemsByCategory = {};
        displayItems.forEach((item) => {
            if (!itemsByCategory[item.categoryId]) itemsByCategory[item.categoryId] = [];
            itemsByCategory[item.categoryId].push(item);
        });

        const sections = sectionOrder()
            .map((id) => data.categories.find((c) => c.id === id))
            .filter(Boolean)
            .slice(0, 5)
            .map((cat) => {
                const items = (itemsByCategory[cat.id] || []).slice(0, 8);
                const cards = items.map((item) => catalog.productCardHorizontal(item)).join('');
                const title = catalog.formatCategoryLabel(cat.name);
                return `<section class="ze-section" aria-labelledby="sec-${cat.id}">
<div class="ze-section__head">
<h2 id="sec-${cat.id}" class="ze-section__title">${catalog.escapeHtml(title)}</h2>
<a class="ze-section__link" href="pedidos.html?categoria=${encodeURIComponent(cat.id)}">Ver tudo</a>
</div>
<div class="ze-product-scroll">${cards}</div>
</section>`;
            })
            .join('');

        root.innerHTML = `<div class="ze-promo">
<div class="ze-promo__icon"><span class="material-symbols-outlined text-vibrant-yellow text-[28px]">ac_unit</span></div>
<div>
<p class="ze-promo__title">Bebida gelada, em minutos</p>
<p class="ze-promo__sub">Peça pelo app e receba na porta da sua casa</p>
</div>
</div>
${reorderHtml()}
<section aria-labelledby="home-categories-title">
<h2 id="home-categories-title" class="sr-only">Categorias</h2>
<div class="ze-cat-scroll">${catTiles}</div>
</section>
${combosSectionHtml(combos, data)}
${sections}`;

        root.querySelector('#home-reorder-btn')?.addEventListener('click', () => {
            if (cartApi.restoreLastOrder()) {
                window.LigeirinhoCartUI?.render?.();
                window.LigeirinhoCartUI?.open?.();
            }
        });

        root.querySelectorAll('[data-combo-add]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const comboId = btn.dataset.comboAdd;
                const combo = combos.find((c) => c.id === comboId);
                if (!combo) return;
                const toAdd = [];
                combo.items.forEach(({ id, qty }) => {
                    const product = productById(data, id);
                    if (product) toAdd.push({ product, qty });
                });
                if (toAdd.length) addProducts(toAdd);
            });
        });

        catalog.bindQtySteppers(root, {
            onAdd: (ctx) => {
                addProduct(ctx);
                refreshSteppers();
            },
            onRemove: (ctx) => {
                removeProduct(ctx);
                refreshSteppers();
            },
        });
    };

    Promise.all([
        fetch('data/catalogo.json').then((r) => {
            if (!r.ok) throw new Error();
            return r.json();
        }),
        fetch('data/combos-ocasiao.json')
            .then((r) => (r.ok ? r.json() : { combos: [] }))
            .catch(() => ({ combos: [] })),
        pricing.loadPackConfig(),
        pricing.loadTierImages(),
    ])
        .then(([catalogJson, combosJson]) => {
            const displayItems = pricing.getDisplayProducts(catalogJson);
            renderHome(catalogJson, combosJson.combos || [], displayItems);
        })
        .catch(() => {
            root.innerHTML =
                '<p class="px-4 py-8 text-center text-[#999] text-sm">Não foi possível carregar o catálogo. Use um servidor local.</p>';
        });

    window.addEventListener('ligeirinho-cart-changed', refreshSteppers);
    window.addEventListener('ligeirinho-prefs-changed', () => {
        if (catalogData) {
            fetch('data/combos-ocasiao.json')
                .then((r) => (r.ok ? r.json() : { combos: [] }))
                .then((combosJson) =>
                    renderHome(
                        catalogData,
                        combosJson.combos || [],
                        pricing.getDisplayProducts(catalogData)
                    )
                )
                .catch(() => renderHome(catalogData, [], pricing.getDisplayProducts(catalogData)));
        }
    });
})();
