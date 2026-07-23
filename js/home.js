(function () {
    const cartApi = window.LigeirinhoCart;
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;
    const productCards = window.LigeirinhoParceirosProductCards;
    const promoCatalog = window.LigeirinhoPromoCatalog;
    const promoCards = window.LigeirinhoParceirosPromoCards;
    const productDetail = window.LigeirinhoParceirosProductDetail;
    if (!cartApi || !catalog || !pricing || !productCards) return;

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
    let promoOffers = { byCartKey: {}, byItemKey: {} };

    const promoLoader = promoCatalog?.createHubPromoLoader?.('/api/promocoes');

    const reloadPromoOffers = async (force = false) => {
        if (!promoLoader || !promoCatalog || !promoCards || !displayItemsCache.length) return;
        const promos = await promoLoader.load(force);
        const prepared = promoCards.preparePromoGroups(promos, displayItemsCache, promoCatalog);
        promoOffers = promoCatalog.buildPromoOfferIndex(prepared.groups, {
            buildCartCtx: (entry) =>
                promoCards.buildCartCtx(entry, { promoCatalog, catalog, pricing }),
        });
        productDetail?.refreshIfOpen?.();
    };

    const addProduct = (ctx, qty = 1) => {
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

    const MIN_SUGGESTED_RAIL = 4;

    const getSuggestedItems = (displayItems) => {
        const last = cartApi.lastOrderSummary();
        const mapped = [];
        const seen = new Set();

        const pushItem = (item, suggestedQty) => {
            if (!item) return;
            const key = String(item.groupKey || item.product?.id || '');
            if (!key || seen.has(key)) return;
            seen.add(key);
            mapped.push(suggestedQty != null ? { ...item, suggestedQty } : item);
        };

        if (last?.items?.length) {
            last.items.forEach((line) => {
                pushItem(findDisplayItem(displayItems, line), line.qty || 1);
            });
        }

        /* Completa a faixa com o catálogo para não deixar vácuo com 1–2 cards. */
        for (const item of displayItems) {
            if (mapped.length >= 12) break;
            pushItem(item);
        }

        return mapped.slice(0, 12);
    };

    const cardDeps = () => ({
        catalog,
        pricing,
        formatPrice: catalog.formatPrice.bind(catalog),
        getCartQty: catalog.getCartQty.bind(catalog),
        promoOffers,
    });

    let displayItemsCache = [];

    const refreshSteppers = () => {
        productCards.syncGridQty(root, displayItemsCache, cardDeps());
    };

    productDetail?.init?.({
        getDisplayItems: () => displayItemsCache,
        getPromoOffers: () => promoOffers,
        onCartChanged: refreshSteppers,
    });

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
            { href: 'ofertas.html', icon: 'local_offer', label: 'Promoções' },
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
        if (items.length < MIN_SUGGESTED_RAIL) return '';
        const cards = productCards.renderScrollHtml(items, cardDeps());
        return `<section class="home-suggested ze-section" aria-labelledby="home-suggested-title">
<div class="ze-section__head">
<h2 id="home-suggested-title" class="ze-section__title">Pedido sugerido</h2>
<a class="home-section__link" href="pedidos.html">Mostrar todos</a>
</div>
<div class="parceiros-product-scroll home-suggested-scroll" id="home-suggested-scroll" role="list">${cards}</div>
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
        displayItemsCache = displayItems;
        const suggestedItems = getSuggestedItems(displayItems);

        const itemsByCategory = {};
        displayItems.forEach((item) => {
            if (!itemsByCategory[item.categoryId]) itemsByCategory[item.categoryId] = [];
            itemsByCategory[item.categoryId].push(item);
        });

        const itemsForCategory = (cat, limit = 8) =>
            (itemsByCategory[cat.id] || []).slice(0, limit);

        const sections = sectionOrder()
            .map((id) => catalog.resolveCatalogCategory(data, id))
            .filter(Boolean)
            .slice(0, 5)
            .map((cat) => {
                const items = itemsForCategory(cat, 8);
                if (!items.length) return '';
                const cards = productCards.renderScrollHtml(items, cardDeps());
                const title = catalog.formatCategoryLabel(cat.name);
                return `<section class="ze-section home-desktop-only" aria-labelledby="sec-${cat.id}">
<div class="ze-section__head">
<h2 id="sec-${cat.id}" class="ze-section__title">${catalog.escapeHtml(title)}</h2>
<a class="ze-section__link" href="pedidos.html?categoria=${encodeURIComponent(cat.id)}">Ver tudo</a>
</div>
<div class="parceiros-product-scroll ze-product-scroll" role="list">${cards}</div>
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
        const cards = productCards.renderScrollHtml(items, cardDeps());
        const title = catalog.formatCategoryLabel(cat.name);
        return `<section class="home-suggested ze-section" aria-labelledby="sec-m-${cat.id}">
<div class="ze-section__head">
<h2 id="sec-m-${cat.id}" class="ze-section__title">${catalog.escapeHtml(title)}</h2>
<a class="home-section__link" href="pedidos.html?categoria=${encodeURIComponent(cat.id)}">Ver tudo</a>
</div>
<div class="parceiros-product-scroll home-suggested-scroll" role="list">${cards}</div>
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

        productCards.bindCatalogGrid(root, {
            getDeps: cardDeps,
            onAdd: (ctx) => {
                addProduct(ctx);
                refreshSteppers();
            },
            onRemove: (ctx) => {
                removeProduct(ctx);
                refreshSteppers();
            },
            onSetQty: (ctx) => {
                setProductQty(ctx, ctx.qty);
                refreshSteppers();
            },
        }, () => displayItemsCache);
    };

    Promise.all([
        window.LigeirinhoCatalogLoader.load(),
        pricing.loadPackConfig(),
        pricing.loadTierImages(),
        window.LigeirinhoHomeStories?.loadConfig?.() ?? Promise.resolve({ stories: [] }),
    ])
        .then(async ([catalogJson, , , storiesCfg]) => {
            homeStoriesConfig = storiesCfg?.stories ? storiesCfg : { stories: [] };
            const groups = pricing.buildGroups(catalogJson);
            const displayItems = pricing.getDisplayProducts(catalogJson, groups);
            displayItemsCache = displayItems;
            await reloadPromoOffers(false);
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

    window.addEventListener('ligeirinho-catalog-synced', async (event) => {
        const catalogJson = event.detail?.catalogData;
        if (!catalogJson) return;
        catalogData = catalogJson;
        const groups = pricing.buildGroups(catalogJson);
        window.__ligProductGroups = groups;
        displayItemsCache = pricing.getDisplayProducts(catalogJson, groups);
        await reloadPromoOffers(true);
        renderHome(catalogJson, displayItemsCache, groups);
    });
})();
