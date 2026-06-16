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

    const STORY_RING_COLORS = ['#009ee3', '#7c4dff', '#00c853', '#ff6d00', '#e91e63', '#5c6bc0', '#00897b', '#d81b60'];

    let catalogData = null;

    const addProduct = (ctx, qty = 1) => {
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
        cart[key].qty += qty;
        cartApi.saveCart(cart);
        window.LigeirinhoCartUI?.render?.();
        window.LigeirinhoCartUI?.showAddedFeedback?.(name);
    };

    const addProducts = (products) => {
        const cart = cartApi.loadCart();
        products.forEach(({ product, qty, ctx }) => {
            if (ctx?.variant) {
                addProduct(ctx, qty);
                return;
            }
            if (!cart[product.id]) {
                cart[product.id] = { id: product.id, name: product.name, price: product.price, qty: 0 };
            }
            cart[product.id].qty += qty;
        });
        cartApi.saveCart(cart);
        window.LigeirinhoCartUI?.render?.();
        window.LigeirinhoCartUI?.showAddedFeedback?.('Itens adicionados');
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

    const findDisplayItem = (displayItems, lineItem) => {
        const key = lineItem.cartKey || lineItem.id;
        return displayItems.find((item) => {
            const product = item?.product || item;
            if (product.id === lineItem.id) return true;
            const group = item?.group;
            if (group && pricing) {
                for (const tier of pricing.getAvailableTiers?.(group) || ['unidade']) {
                    const variant = pricing.getVariant(group, tier);
                    if (variant && catalog.cartKeyFor(variant) === key) return true;
                }
            }
            return false;
        });
    };

    const getSuggestedItems = (displayItems) => {
        const last = cartApi.lastOrderSummary();
        if (last?.items?.length) {
            const mapped = [];
            last.items.forEach((line) => {
                const item = findDisplayItem(displayItems, line);
                if (item) mapped.push({ ...item, suggestedQty: line.qty || 1 });
            });
            if (mapped.length) return mapped.slice(0, 12);
        }
        return displayItems.slice(0, 12);
    };

    const refreshSteppers = () => {
        root.querySelectorAll('.ze-product-h[data-group-key], .home-suggested-card[data-group-key]').forEach((card) => {
            catalog.updateCardPriceUi(card);
        });
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

    const quickChipsHtml = () => {
        const chips = [
            { href: 'ofertas.html', icon: 'local_offer', label: 'Ofertas' },
            { href: 'pedidos.html', icon: 'inventory_2', label: 'Catálogo' },
            { href: 'conta.html#ajuda', icon: 'headset_mic', label: 'Ajuda' },
        ];
        if (cartApi.lastOrderSummary()) {
            chips.unshift({ action: 'reorder', icon: 'replay', label: 'Repetir' });
        }
        return `<div class="home-quick-chips" role="navigation" aria-label="Atalhos">${chips
            .map((chip) => {
                if (chip.action === 'reorder') {
                    return `<button type="button" class="home-quick-chip" data-home-reorder>
<span class="material-symbols-outlined home-quick-chip__icon">${chip.icon}</span>
<span>${chip.label}</span>
</button>`;
                }
                return `<a href="${chip.href}" class="home-quick-chip">
<span class="material-symbols-outlined home-quick-chip__icon">${chip.icon}</span>
<span>${chip.label}</span>
</a>`;
            })
            .join('')}</div>`;
    };

    const storiesHtml = (categories) => {
        const featured = categories.slice(0, 8);
        if (!featured.length) return '';
        const items = featured
            .map((cat, i) => catalog.categoryStoryHtml(cat, STORY_RING_COLORS[i % STORY_RING_COLORS.length]))
            .join('');
        return `<div class="home-stories-scroll" aria-label="Destaques">${items}</div>`;
    };

    const suggestedSectionHtml = (items) => {
        if (!items.length) return '';
        const cards = items.map((item) => catalog.productCardSuggested(item)).join('');
        return `<section class="home-suggested ze-section" aria-labelledby="home-suggested-title">
<div class="ze-section__head">
<h2 id="home-suggested-title" class="ze-section__title">Pedido sugerido</h2>
<a class="home-section__link" href="pedidos.html">Mostrar todos</a>
</div>
<div class="home-suggested-scroll" id="home-suggested-scroll">${cards}</div>
<button type="button" class="home-add-all-btn" id="home-add-all-btn">Adicionar tudo</button>
</section>`;
    };

    const categoryGridHtml = (categories) => {
        const tiles = categories.map((cat, i) => catalog.categoryGridTileHtml(cat, i)).join('');
        return `<section class="home-cat-grid-section ze-section" aria-labelledby="home-grid-title">
<div class="ze-section__head">
<h2 id="home-grid-title" class="ze-section__title">Categorias de produtos</h2>
<a class="home-section__link" href="pedidos.html">Ver catálogo</a>
</div>
<div class="home-cat-grid">${tiles}</div>
</section>`;
    };

    const comboCardHtml = (combo, total) =>
        `<article class="ze-combo-card" data-combo-id="${catalog.escapeHtml(combo.id)}">
<div class="ze-combo-card__icon"><span class="material-symbols-outlined">${catalog.escapeHtml(combo.icon || 'local_mall')}</span></div>
<p class="ze-combo-card__title">${catalog.escapeHtml(combo.title)}</p>
<p class="ze-combo-card__sub">${catalog.escapeHtml(combo.subtitle)}</p>
<p class="ze-combo-card__price">${catalog.formatPrice(total)}</p>
<button type="button" class="ze-combo-card__btn" data-combo-add="${catalog.escapeHtml(combo.id)}">Adicionar combo</button>
</article>`;

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
        return `<section class="ze-combos-section ze-section home-desktop-only" aria-labelledby="home-combos-title">
<div class="ze-section__head">
<h2 id="home-combos-title" class="ze-section__title">Combos para ocasião</h2>
</div>
<div class="ze-combo-scroll">${cards}</div>
</section>`;
    };

    const renderHome = (data, combos = [], displayItems = []) => {
        catalogData = data;
        window.__ligProductGroups = pricing.buildGroups(data);

        const categories = data.categories.filter((c) => c.products.length > 0);
        const suggestedItems = getSuggestedItems(displayItems);

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
                return `<section class="ze-section home-desktop-only" aria-labelledby="sec-${cat.id}">
<div class="ze-section__head">
<h2 id="sec-${cat.id}" class="ze-section__title">${catalog.escapeHtml(title)}</h2>
<a class="ze-section__link" href="pedidos.html?categoria=${encodeURIComponent(cat.id)}">Ver tudo</a>
</div>
<div class="ze-product-scroll">${cards}</div>
</section>`;
            })
            .join('');

        root.innerHTML = `<div class="home-page">
<div class="home-hero-banner" aria-hidden="true">
<div class="home-hero-banner__content">
<p class="home-hero-banner__title">Bebida gelada, em minutos</p>
<p class="home-hero-banner__sub">Peça pelo app · Pix e cartão via Mercado Pago</p>
</div>
<span class="material-symbols-outlined home-hero-banner__icon">ac_unit</span>
</div>
${quickChipsHtml()}
${storiesHtml(categories)}
${suggestedSectionHtml(suggestedItems)}
${combosSectionHtml(combos, data)}
${categoryGridHtml(categories)}
<section class="home-mobile-sections" aria-label="Mais produtos">
${sectionOrder()
    .map((id) => data.categories.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, 3)
    .map((cat) => {
        const items = (itemsByCategory[cat.id] || []).slice(0, 6);
        if (!items.length) return '';
        const cards = items.map((item) => catalog.productCardSuggested(item)).join('');
        const title = catalog.formatCategoryLabel(cat.name);
        return `<section class="home-suggested ze-section" aria-labelledby="sec-m-${cat.id}">
<div class="ze-section__head">
<h2 id="sec-m-${cat.id}" class="ze-section__title">${catalog.escapeHtml(title)}</h2>
<a class="home-section__link" href="pedidos.html?categoria=${encodeURIComponent(cat.id)}">Ver tudo</a>
</div>
<div class="home-suggested-scroll">${cards}</div>
</section>`;
    })
    .join('')}
</section>
<div class="home-desktop-only">${sections}</div>
</div>`;

        root.querySelector('[data-home-reorder]')?.addEventListener('click', () => {
            if (cartApi.restoreLastOrder()) {
                window.LigeirinhoCartUI?.render?.();
                window.LigeirinhoCartUI?.open?.();
            }
        });

        root.querySelector('#home-add-all-btn')?.addEventListener('click', () => {
            const cards = root.querySelector('#home-suggested-scroll')?.querySelectorAll('.home-suggested-card') || [];
            cards.forEach((card, i) => {
                const ctx = catalog.resolveCardContext(card);
                const qty = suggestedItems[i]?.suggestedQty || 1;
                if (ctx?.variant) addProduct(ctx, qty);
            });
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
        window.LigeirinhoCatalogLoader.load(),
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
