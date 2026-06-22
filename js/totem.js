(function () {
    const auth = window.LigeirinhoAuth;
    const routing = window.LigeirinhoAuthRouting;
    const cartApi = window.LigeirinhoCart;
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;

    if (!auth || !routing || !cartApi || !catalog || !pricing) return;

    const views = {
        welcome: document.getElementById('totem-view-welcome'),
        catalog: document.getElementById('totem-view-catalog'),
    };
    const startBtn = document.getElementById('totem-start-btn');
    const homeBtn = document.getElementById('totem-home-btn');
    const cartBtn = document.getElementById('totem-cart-btn');
    const cartBadge = document.getElementById('totem-cart-badge');
    const cartPanel = document.getElementById('totem-cart-panel');
    const cartList = document.getElementById('totem-cart-list');
    const cartTotalEl = document.getElementById('totem-cart-total');
    const checkoutBtn = document.getElementById('totem-checkout-btn');
    const categoriesEl = document.getElementById('totem-categories');
    const productsGrid = document.getElementById('totem-products-grid');
    const productsHead = document.getElementById('totem-products-head');
    const categoryTitle = document.getElementById('totem-category-title');
    const productsCount = document.getElementById('totem-products-count');
    const productsEmpty = document.getElementById('totem-products-empty');
    const unitLabel = document.getElementById('totem-unit-label');
    const deviceLabel = document.getElementById('totem-device-label');
    const idleHint = document.getElementById('totem-idle-hint');
    const adminModal = document.getElementById('totem-admin-modal');
    const adminPin = document.getElementById('totem-admin-pin');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) => catalog.escapeHtml(String(s ?? ''));

    let catalogData = null;
    let displayItems = [];
    let totemCategories = [];
    let activeCategory = '';
    let totemConfig = { defaults: {}, units: {}, loginUnitMap: {} };
    let unitSettings = null;
    let idleTimer = null;
    let idleHintTimer = null;
    let adminTapCount = 0;
    let adminTapTimer = null;

    const session = () => auth.loadSession();

    const resolveUnitSettings = () => {
        const s = session();
        const mapped = totemConfig.loginUnitMap?.[s?.login] || totemConfig.loginUnitMap?.[s?.email];
        const unitId = s?.totemUnitId || mapped || 'default';
        return totemConfig.units?.[unitId] || totemConfig.units?.default || { label: 'Ligeirinho', hiddenCategories: [], hiddenProductIds: [] };
    };

    const CATEGORY_CANON = {
        cerveja: { id: 'cerveja', name: 'Cerveja' },
        cervejas: { id: 'cerveja', name: 'Cerveja' },
        whisky: { id: 'whisky', name: 'Whiskys' },
        whiskys: { id: 'whisky', name: 'Whiskys' },
        vodka: { id: 'vodka', name: 'Vodkas' },
        vodkas: { id: 'vodka', name: 'Vodkas' },
        gin: { id: 'gin', name: 'Gins' },
        gins: { id: 'gin', name: 'Gins' },
        refrigerante: { id: 'refrigerante', name: 'Refrigerante' },
        refrigerantes: { id: 'refrigerante', name: 'Refrigerante' },
        destilado: { id: 'destilados', name: 'Destilados' },
        destilados: { id: 'destilados', name: 'Destilados' },
    };

    const canonCategoryId = (id) => {
        const key = String(id || '').toLowerCase();
        return CATEGORY_CANON[key]?.id || key;
    };

    const canonCategoryName = (id, fallback = '') => {
        const key = String(id || '').toLowerCase();
        return CATEGORY_CANON[key]?.name || fallback || catalog.formatCategoryLabel(fallback || id);
    };

    const buildTotemCategories = () => {
        const order = (catalogData?.categories || []).map((c) => canonCategoryId(c.id));
        const orderIndex = new Map(order.map((id, i) => [id, i]));
        const counts = new Map();

        displayItems.forEach((item) => {
            const cid = canonCategoryId(item.categoryId);
            counts.set(cid, (counts.get(cid) || 0) + 1);
        });

        const merged = [];
        const seen = new Set();
        (catalogData?.categories || []).forEach((cat) => {
            const cid = canonCategoryId(cat.id);
            if (seen.has(cid)) return;
            const count = counts.get(cid) || 0;
            if (!count) return;
            seen.add(cid);
            merged.push({
                id: cid,
                name: canonCategoryName(cat.id, cat.name),
                count,
            });
        });

        counts.forEach((count, cid) => {
            if (seen.has(cid)) return;
            merged.push({ id: cid, name: canonCategoryName(cid, cid), count });
        });

        merged.sort(
            (a, b) =>
                (orderIndex.get(a.id) ?? 999) - (orderIndex.get(b.id) ?? 999) ||
                a.name.localeCompare(b.name, 'pt-BR')
        );
        return merged;
    };

    const normalizeDisplayItems = () => {
        displayItems = displayItems.map((item) => ({
            ...item,
            categoryId: canonCategoryId(item.categoryId),
            categoryName: canonCategoryName(item.categoryId, item.categoryName),
        }));
    };

    const filterCatalog = (data) => {
        const hiddenCats = new Set((unitSettings?.hiddenCategories || []).map((c) => String(c).toLowerCase()));
        const hiddenIds = new Set(unitSettings?.hiddenProductIds || []);
        const categories = (data.categories || [])
            .filter((cat) => !hiddenCats.has(String(cat.id).toLowerCase()))
            .map((cat) => ({
                ...cat,
                products: (cat.products || []).filter((p) => !hiddenIds.has(p.id)),
            }))
            .filter((cat) => cat.products.length > 0);
        return { ...data, categories, totalProducts: categories.reduce((n, c) => n + c.products.length, 0) };
    };

    const buildDisplayItems = () => {
        if (!catalogData) return [];
        return pricing.getTotemDisplayProducts(catalogData);
    };

    const activeCategoryMeta = () =>
        totemCategories.find((cat) => cat.id === activeCategory) || null;

    const itemsForActiveCategory = () => {
        if (!activeCategory) return displayItems;
        return displayItems.filter((item) => item.categoryId === activeCategory);
    };

    const categoryIcon = (cat) => {
        const cover = catalog.categoryCoverMedia(cat, catalogData?.categories || []);
        return cover.icon || 'liquor';
    };

    const setView = (name) => {
        Object.entries(views).forEach(([key, el]) => {
            if (!el) return;
            const active = key === name;
            el.classList.toggle('totem-view--active', active);
            el.hidden = !active;
            if (active) {
                el.classList.add('totem-view--entering');
                window.setTimeout(() => el.classList.remove('totem-view--entering'), 480);
            }
        });
        const inCatalog = name === 'catalog';
        homeBtn.hidden = !inCatalog;
        cartBtn.hidden = !inCatalog;
    };

    const resetCart = () => {
        cartApi.saveCart({});
        cartApi.saveCheckout({ deliveryType: 'retirada', address: '', payment: 'pix', notes: '' });
        renderCart();
    };

    const resetSession = () => {
        closeCart();
        resetCart();
        setView('welcome');
        resetIdleTimer();
    };

    const bumpIdle = () => {
        resetIdleTimer();
        idleHint?.classList.remove('totem-idle-hint--visible');
    };

    const resetIdleTimer = () => {
        const idleMs = Number(totemConfig.defaults?.idleTimeoutMs) || 120000;
        const hintMs = Math.max(idleMs - 30000, 60000);
        clearTimeout(idleTimer);
        clearTimeout(idleHintTimer);
        idleTimer = window.setTimeout(resetSession, idleMs);
        idleHintTimer = window.setTimeout(() => {
            if (views.catalog?.classList.contains('totem-view--active')) {
                idleHint?.classList.add('totem-idle-hint--visible');
            }
        }, hintMs);
    };

    const renderCategories = () => {
        if (!categoriesEl) return;
        categoriesEl.innerHTML = totemCategories
            .map((cat) => {
                const active = cat.id === activeCategory;
                const catForIcon = catalogData?.categories?.find(
                    (c) => canonCategoryId(c.id) === cat.id
                ) || { id: cat.id, name: cat.name, products: [] };
                const icon = categoryIcon(catForIcon);
                const label = catalog.formatCategoryLabel(cat.name);
                return `<button type="button" class="totem-cat-btn${active ? ' totem-cat-btn--active' : ''}" data-cat="${esc(cat.id)}" aria-current="${active ? 'true' : 'false'}">
<span class="totem-cat-btn__icon material-symbols-outlined" aria-hidden="true">${esc(icon)}</span>
<span class="totem-cat-btn__label">${esc(label)}</span>
<span class="totem-cat-btn__count">${cat.count}</span>
</button>`;
            })
            .join('');
    };

    const renderProducts = () => {
        if (!productsGrid) return;
        if (activeCategory && !totemCategories.some((c) => c.id === activeCategory)) {
            activeCategory = totemCategories[0]?.id || '';
        }
        const items = itemsForActiveCategory();
        const catMeta = activeCategoryMeta();
        const catLabel = catMeta ? catalog.formatCategoryLabel(catMeta.name) : '';

        if (productsHead) productsHead.hidden = !catLabel;
        if (categoryTitle) categoryTitle.textContent = catLabel;
        if (productsCount) {
            productsCount.textContent =
                items.length === 1 ? '1 produto' : `${items.length} produtos`;
        }

        const isEmpty = items.length === 0;
        if (productsEmpty) {
            productsEmpty.hidden = !isEmpty;
            productsEmpty.style.display = isEmpty ? '' : 'none';
        }
        if (productsGrid) {
            productsGrid.hidden = isEmpty;
            productsGrid.style.display = isEmpty ? 'none' : '';
        }

        if (isEmpty) {
            productsGrid.innerHTML = '';
            return;
        }

        productsGrid.innerHTML = items
            .map((item, index) => {
                const group = item.group || null;
                const product = item.product;
                const tier = item.defaultTier || pricing.getTotemDefaultTier(group) || pricing.getDefaultTier(group);
                const variant = group ? pricing.getVariant(group, tier) : null;
                const active = variant || product;
                const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
                const cart = cartApi.loadCart();
                const qty = cart[cartKey]?.qty || 0;
                const img = catalog.productImageUrl(
                    group ? pricing.getTierImage(group, tier) : product.image
                );
                const name = group
                    ? pricing.cartItemName({ ...variant, tier }, group)
                    : product.name;
                const price = active.price;
                const tierLabel = pricing.TIER_SHORT?.[tier] || '';
                return `<article class="totem-product${qty ? ' totem-product--selected' : ''}" role="listitem" data-cart-key="${esc(cartKey)}" data-item-key="${esc(group?.key || product.id)}" style="--totem-card-i:${index}">
<div class="totem-product__media">
${qty ? `<span class="totem-product__badge" aria-label="${qty} no carrinho">${qty}</span>` : ''}
${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-product__body">
<div class="totem-product__name">${esc(name)}</div>
<div class="totem-product__meta">
${tierLabel ? `<span class="totem-product__tier">${esc(tierLabel)}</span>` : ''}
<span class="totem-product__price">${formatPrice(price)}</span>
</div>
<div class="totem-product__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<span class="totem-qty-value">${qty}</span>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(cartKey)}" data-item-key="${esc(group?.key || product.id)}" aria-label="Aumentar">+</button>
</div>
</div>
</article>`;
            })
            .join('');
    };

    const addItem = (cartKey, itemKey) => {
        const item = displayItems.find((i) => (i.group?.key || i.product.id) === itemKey);
        if (!item) return;
        const group = item.group;
        const tier = item.defaultTier || pricing.getTotemDefaultTier(group) || pricing.getDefaultTier(group);
        const variant = group ? pricing.getVariant(group, tier) : null;
        const product = item.product;
        const key = cartKey || (variant ? catalog.cartKeyFor(variant) : product.id);
        const packType = variant?.tier || tier || 'unidade';
        const name = group
            ? pricing.cartItemName({ ...variant, tier: packType }, group)
            : product.name;
        const price = (variant || product).price;
        const cart = cartApi.loadCart();
        if (!cart[key]) {
            cart[key] = { id: (variant || product).id, cartKey: key, name, price, qty: 0, packType };
        }
        cart[key].qty += 1;
        cartApi.saveCart(cart);
        renderCart();
        renderProducts();
        bumpIdle();
    };

    const changeQty = (cartKey, delta) => {
        const cart = cartApi.loadCart();
        if (!cart[cartKey]) return;
        cart[cartKey].qty += delta;
        if (cart[cartKey].qty <= 0) delete cart[cartKey];
        cartApi.saveCart(cart);
        renderCart();
        renderProducts();
        bumpIdle();
    };

    const renderCart = () => {
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        const count = cartApi.cartItemCount(cart);
        const total = cartApi.cartTotalValue(cart);
        if (cartBadge) cartBadge.textContent = String(count);
        if (cartTotalEl) cartTotalEl.textContent = formatPrice(total);
        if (checkoutBtn) {
            checkoutBtn.disabled = count === 0;
            checkoutBtn.textContent = count ? 'Ir para pagamento' : 'Adicione produtos';
        }
        if (!cartList) return;
        cartList.innerHTML = items.length
            ? items
                  .map(
                      (item) => `<div class="totem-cart-line">
<div><div class="totem-cart-line__name">${esc(item.name)}</div><div class="totem-cart-line__meta">${item.qty}x ${formatPrice(item.price)}</div></div>
<div class="flex gap-2"><button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(item.cartKey || item.id)}">−</button><button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(item.cartKey || item.id)}">+</button></div>
</div>`
                  )
                  .join('')
            : '<p class="totem-muted">Seu carrinho está vazio.</p>';
    };

    const openCart = () => {
        cartPanel?.classList.add('totem-cart-panel--open');
        cartPanel?.setAttribute('aria-hidden', 'false');
        renderCart();
        bumpIdle();
    };

    const closeCart = () => {
        cartPanel?.classList.remove('totem-cart-panel--open');
        cartPanel?.setAttribute('aria-hidden', 'true');
    };

    const startCheckout = async () => {
        const cart = cartApi.loadCart();
        if (!cartApi.cartItemCount(cart)) return;
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Criando pedido…';

        const s = session();
        const items = cartApi.cartEntries(cart).map((item) => ({
            id: item.id,
            cartKey: item.cartKey || item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            packType: item.packType,
        }));

        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    deliveryType: 'retirada',
                    notes: 'Pedido Totem',
                    channel: 'totem',
                    totemId: s?.hubUserId || s?.sub || '',
                    totemLabel: s?.totemLabel || s?.name || s?.login || 'Totem',
                    unitId: s?.totemUnitId || 'default',
                    customer: {
                        name: s?.totemLabel || s?.name || 'Cliente Totem',
                        phone: s?.phone || '',
                        email: s?.email || '',
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível criar o pedido');
            cartApi.saveLastOrder(cart, cartApi.loadCheckout());
            window.location.href = `totem-pagamento.html?order=${encodeURIComponent(data.orderId)}`;
        } catch (err) {
            window.alert(err.message || 'Erro ao iniciar pagamento.');
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Ir para pagamento';
        }
    };

    const openAdminModal = () => {
        adminModal?.classList.add('totem-admin-modal--open');
        adminModal?.setAttribute('aria-hidden', 'false');
        adminPin.value = '';
        adminPin?.focus();
    };

    const closeAdminModal = () => {
        adminModal?.classList.remove('totem-admin-modal--open');
        adminModal?.setAttribute('aria-hidden', 'true');
    };

    const confirmAdminLogout = () => {
        const pin = String(adminPin?.value || '');
        const expected = String(totemConfig.defaults?.adminPin || '123456');
        if (pin !== expected) {
            window.alert('PIN incorreto.');
            return;
        }
        auth.logout();
        window.location.href = '/';
    };

    const bindEvents = () => {
        startBtn?.addEventListener('click', () => {
            resetCart();
            if (!activeCategory && totemCategories[0]) {
                activeCategory = totemCategories[0].id;
            }
            renderCategories();
            renderProducts();
            setView('catalog');
            bumpIdle();
        });

        homeBtn?.addEventListener('click', resetSession);
        cartBtn?.addEventListener('click', openCart);
        document.getElementById('totem-cart-close')?.addEventListener('click', closeCart);
        checkoutBtn?.addEventListener('click', startCheckout);

        categoriesEl?.addEventListener('click', (e) => {
            const btn = e.target.closest('.totem-cat-btn');
            if (!btn) return;
            activeCategory = canonCategoryId(btn.dataset.cat || '');
            renderCategories();
            renderProducts();
            bumpIdle();
        });

        productsGrid?.addEventListener('click', (e) => {
            const plus = e.target.closest('.totem-plus');
            const minus = e.target.closest('.totem-minus');
            if (plus) addItem(plus.dataset.cartKey, plus.dataset.itemKey);
            if (minus) changeQty(minus.dataset.cartKey, -1);
        });

        cartList?.addEventListener('click', (e) => {
            const plus = e.target.closest('.totem-plus');
            const minus = e.target.closest('.totem-minus');
            if (plus) changeQty(plus.dataset.cartKey, 1);
            if (minus) changeQty(minus.dataset.cartKey, -1);
        });

        cartPanel?.addEventListener('click', (e) => {
            if (e.target === cartPanel) closeCart();
        });

        document.getElementById('totem-brand-tap')?.addEventListener('click', () => {
            adminTapCount += 1;
            clearTimeout(adminTapTimer);
            adminTapTimer = window.setTimeout(() => {
                adminTapCount = 0;
            }, 1200);
            if (adminTapCount >= 5) {
                adminTapCount = 0;
                openAdminModal();
            }
        });

        document.getElementById('totem-footer-tap')?.addEventListener('click', openAdminModal);
        document.getElementById('totem-admin-cancel')?.addEventListener('click', closeAdminModal);
        document.getElementById('totem-admin-confirm')?.addEventListener('click', confirmAdminLogout);
        adminPin?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmAdminLogout();
        });

        ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
            document.addEventListener(evt, bumpIdle, { passive: true });
        });
    };

    const init = async () => {
        if (!routing.guardPageAccess()) return;

        const s = session();
        unitSettings = resolveUnitSettings();
        if (unitLabel) {
            unitLabel.innerHTML =
                '<span class="lig-brand__wordmark"><span class="lig-brand__text">Ligeirinho</span><span class="lig-brand__app">Totem</span></span>';
        }
        if (deviceLabel) {
            const unitName = unitSettings?.label;
            const device = s?.totemLabel || s?.login || s?.name;
            const parts = [];
            if (unitName && unitName !== 'Ligeirinho') parts.push(unitName);
            if (device && !/^totem$/i.test(String(device))) parts.push(device);
            deviceLabel.textContent = parts.join(' · ') || 'Autoatendimento';
        }

        const [rawCatalog, configRes, packCfg, tierCfg] = await Promise.all([
            window.LigeirinhoCatalogLoader.load(),
            fetch('data/totem-units.json'),
            pricing.loadPackConfig(),
            pricing.loadTierImages(),
        ]);
        totemConfig = await configRes.json();
        unitSettings = resolveUnitSettings();
        catalogData = filterCatalog(rawCatalog);
        pricing.rebuildGroups?.(catalogData);
        displayItems = buildDisplayItems();
        normalizeDisplayItems();
        totemCategories = buildTotemCategories();
        if (totemCategories[0]) {
            activeCategory = totemCategories[0].id;
        }

        bindEvents();
        renderCategories();
        renderProducts();
        renderCart();
        resetIdleTimer();
    };

    init();
})();
