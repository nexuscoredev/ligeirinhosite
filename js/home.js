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
        'whiskys',
        'vinhos',
        'gelos',
    ];

    let catalogData = null;
    let homeStoriesConfig = { stories: [] };

    const addProduct = (ctx, qty = 1) => {
        const line = catalog.buildCartLineFields(ctx, pricing);
        if (!line) return;
        const cart = cartApi.loadCart();
        if (!cart[line.key]) {
            cart[line.key] = { ...line, qty: 0 };
        }
        cart[line.key].qty += qty;
        cartApi.saveCart(cart);
        window.LigeirinhoCartUI?.render?.();
        window.LigeirinhoCartUI?.showAddedFeedback?.(line.name);
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

    const findDisplayItem = (displayItems, lineItem) => {
        const key = lineItem.cartKey || lineItem.id;
        return displayItems.find((item) => {
            const product = item?.product || item;
            if (product.id === lineItem.id) return true;
            const group = item?.group;
            if (group && pricing) {
                for (const tier of pricing.getAvailableTiers?.(group) || ['caixa']) {
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

    const promoStoriesHtml = () => {
        const storiesApi = window.LigeirinhoHomeStories;
        if (!storiesApi || !homeStoriesConfig.stories?.length) return '';
        return storiesApi.storyRailHtml(homeStoriesConfig.stories, catalog, catalogData);
    };

    const bindPromoStories = () => {
        const storiesApi = window.LigeirinhoHomeStories;
        const mount = root.querySelector('[data-home-promo-stories]');
        if (!storiesApi || !mount || !homeStoriesConfig.stories?.length) return;

        const refreshRail = () => {
            mount.innerHTML = storiesApi.storyRailHtml(homeStoriesConfig.stories, catalog, catalogData);
            storiesApi.bindRail(mount, homeStoriesConfig.stories, catalog, catalogData, refreshRail);
        };

        storiesApi.bindRail(mount, homeStoriesConfig.stories, catalog, catalogData, refreshRail);
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

    const renderHome = (data, displayItems = [], groups = null) => {
        catalogData = data;
        if (groups) {
            window.__ligProductGroups = groups;
        } else if (!window.__ligProductGroups) {
            window.__ligProductGroups = pricing.buildGroups(data);
        }

        const categories = data.categories.filter((c) => c.products.length > 0);
        const suggestedItems = getSuggestedItems(displayItems);

        const itemsByCategory = {};
        displayItems.forEach((item) => {
            if (!itemsByCategory[item.categoryId]) itemsByCategory[item.categoryId] = [];
            itemsByCategory[item.categoryId].push(item);
        });

        const itemsForCategory = (cat, limit = 8) => {
            if (cat.id === 'gelos') {
                return displayItems.filter((item) => catalog.isGeloProductName(item.product.name)).slice(0, limit);
            }
            return (itemsByCategory[cat.id] || []).slice(0, limit);
        };

        const sections = sectionOrder()
            .map((id) => catalog.resolveCatalogCategory(data, id))
            .filter(Boolean)
            .slice(0, 5)
            .map((cat) => {
                const items = itemsForCategory(cat, 8);
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
${quickChipsHtml()}
<div data-home-promo-stories>${promoStoriesHtml()}</div>
${suggestedSectionHtml(suggestedItems)}
<section class="home-mobile-sections" aria-label="Mais produtos">
${sectionOrder()
    .map((id) => catalog.resolveCatalogCategory(data, id))
    .filter(Boolean)
    .slice(0, 3)
    .map((cat) => {
        const items = itemsForCategory(cat, 6);
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

        bindPromoStories();

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
        pricing.loadPackConfig(),
        pricing.loadTierImages(),
        window.LigeirinhoHomeStories?.loadConfig?.() ?? Promise.resolve({ stories: [] }),
    ])
        .then(([catalogJson, , , storiesCfg]) => {
            homeStoriesConfig = storiesCfg?.stories ? storiesCfg : { stories: [] };
            const groups = pricing.buildGroups(catalogJson);
            const displayItems = pricing.getDisplayProducts(catalogJson, groups);
            renderHome(catalogJson, displayItems, groups);
        })
        .catch(() => {
            root.innerHTML =
                '<p class="px-4 py-8 text-center text-[var(--lig-text-subtle)] text-sm">Não foi possível carregar o catálogo. Use um servidor local.</p>';
        });

    window.addEventListener('ligeirinho-cart-changed', refreshSteppers);
    window.addEventListener('ligeirinho-prefs-changed', () => {
        if (catalogData) {
            const groups = window.__ligProductGroups || pricing.buildGroups(catalogData);
            renderHome(catalogData, pricing.getDisplayProducts(catalogData, groups), groups);
        }
    });
})();
