(function () {
    const auth = window.LigeirinhoAuth;
    const routing = window.LigeirinhoAuthRouting;
    const cartApi = window.LigeirinhoCart;
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;

    if (!auth || !routing || !cartApi || !catalog || !pricing) return;

    const views = {
        welcome: document.getElementById('totem-view-welcome'),
        customer: document.getElementById('totem-view-customer'),
        catalog: document.getElementById('totem-view-catalog'),
        promos: document.getElementById('totem-view-promos'),
    };
    const startBtn = document.getElementById('totem-start-btn');
    const customerForm = document.getElementById('totem-customer-form');
    const customerNameInput = document.getElementById('totem-customer-name');
    const customerPhoneInput = document.getElementById('totem-customer-phone');
    const customerError = document.getElementById('totem-customer-error');
    const customerBackBtn = document.getElementById('totem-customer-back');
    const customerContinueBtn = document.getElementById('totem-customer-continue');
    const customerSteps = {
        register: document.getElementById('totem-customer-step-register'),
        lookup: document.getElementById('totem-customer-step-lookup'),
        confirm: document.getElementById('totem-customer-step-confirm'),
        manual: document.getElementById('totem-customer-step-manual'),
    };
    const customerLookupForm = document.getElementById('totem-customer-lookup-form');
    const customerLookupInput = document.getElementById('totem-customer-lookup-input');
    const customerLookupError = document.getElementById('totem-customer-lookup-error');
    const customerLookupSubmit = document.getElementById('totem-customer-lookup-submit');
    const customerConfirmName = document.getElementById('totem-customer-confirm-name');
    const customerConfirmHint = document.getElementById('totem-customer-confirm-hint');
    const customerConfirmCardName = document.getElementById('totem-customer-confirm-card-name');
    const customerManualEyebrow = document.getElementById('totem-customer-manual-eyebrow');
    const customerManualTitle = document.getElementById('totem-customer-manual-title');
    const customerManualLead = document.getElementById('totem-customer-manual-lead');
    const logoBtn = document.getElementById('totem-logo-btn');
    const promosBtn = document.getElementById('totem-promos-btn');
    const promosBackBtn = document.getElementById('totem-promos-back');
    const cartBtn = document.getElementById('totem-cart-btn');
    const cartBadge = document.getElementById('totem-cart-badge');
    const floatCart = document.getElementById('totem-float-cart');
    const floatCartBtn = document.getElementById('totem-float-cart-btn');
    const floatCartCount = document.getElementById('totem-float-cart-count');
    const floatCartMeta = document.getElementById('totem-float-cart-meta');
    const floatCartTotal = document.getElementById('totem-float-cart-total');
    const cartPanel = document.getElementById('totem-cart-panel');
    const totemHeader = document.querySelector('.totem-header');
    const cartList = document.getElementById('totem-cart-list');
    const cartTotalEl = document.getElementById('totem-cart-total');
    const cartCountEl = document.getElementById('totem-cart-count');
    const checkoutBtn = document.getElementById('totem-checkout-btn');
    const categoriesEl = document.getElementById('totem-categories');
    const categoriesBtn = document.getElementById('totem-categories-btn');
    const categoriesBtnLabel = document.getElementById('totem-categories-btn-label');
    const categoriesModal = document.getElementById('totem-categories-modal');
    const categoriesCloseBtn = document.getElementById('totem-categories-close');
    const categoriesBackdrop = document.getElementById('totem-categories-backdrop');
    const categoriesStats = document.getElementById('totem-categories-stats');
    const productsGrid = document.getElementById('totem-products-grid');
    const productsBody = document.getElementById('totem-products-body');
    const productsHead = document.getElementById('totem-products-head');
    const categoryTitle = document.getElementById('totem-category-title');
    const productsCount = document.getElementById('totem-products-count');
    const productsEmpty = document.getElementById('totem-products-empty');
    const productsEmptyTitle = document.getElementById('totem-products-empty-title');
    const productsEmptyLead = document.getElementById('totem-products-empty-lead');
    const searchForm = document.getElementById('totem-search-form');
    const searchInput = document.getElementById('totem-search-input');
    const searchClearBtn = document.getElementById('totem-search-clear');
    const unitLabel = document.getElementById('totem-unit-label');
    const deviceLabel = document.getElementById('totem-device-label');
    const idleHint = document.getElementById('totem-idle-hint');
    const adminModal = document.getElementById('totem-admin-modal');
    const adminPin = document.getElementById('totem-admin-pin');
    const detailPanel = document.getElementById('totem-product-detail');
    const detailSheet = detailPanel?.querySelector('.totem-detail__sheet');

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
    let lastCartCount = 0;
    let lastAnimatedCategory = '';
    const tierByGroup = new Map();
    let cartToastTimer = null;
    let searchQuery = '';
    let searchTimer = null;
    let totemKeyboard = null;
    let cachedQueryKey = '';
    let cachedQueryInfo = null;
    let detailItemKey = null;
    let detailDraftQty = 1;
    let promosReturnView = 'welcome';
    let totemCustomer = { name: '', phone: '' };
    let customerStep = 'register';
    let customerLookupHit = null;
    const CATALOG_VIEW_KEY = 'lig_totem_catalog_view';
    const CATALOG_VIEWS = new Set(['list', 'grid-s', 'grid-m', 'grid-l']);
    const GRID_DENSITY_CLASSES = ['totem-grid--grid-s', 'totem-grid--grid-m', 'totem-grid--grid-l'];
    const DEFAULT_CATALOG_VIEW = 'grid-m';
    let catalogView = DEFAULT_CATALOG_VIEW;

    const normalizeCatalogView = (raw) => {
        const view = String(raw || '').toLowerCase();
        if (view === 'grid') return 'grid-m';
        return CATALOG_VIEWS.has(view) ? view : DEFAULT_CATALOG_VIEW;
    };

    const loadCatalogView = () => {
        try {
            return normalizeCatalogView(localStorage.getItem(CATALOG_VIEW_KEY));
        } catch {
            return DEFAULT_CATALOG_VIEW;
        }
    };

    const saveCatalogView = (view) => {
        try {
            localStorage.setItem(CATALOG_VIEW_KEY, view);
        } catch {
            /* ignore */
        }
    };

    const applyCatalogViewClasses = () => {
        productsGrid?.classList.remove('totem-grid--list', ...GRID_DENSITY_CLASSES);
        if (catalogView === 'list') {
            productsGrid?.classList.add('totem-grid--list');
        } else {
            productsGrid?.classList.add(`totem-grid--${catalogView}`);
        }
        productsBody?.classList.toggle('totem-products__body--list', catalogView === 'list');
    };

    const updateViewSwitcher = () => {
        const switcher = productsHead?.querySelector('.totem-view-switch');
        productsHead?.querySelectorAll('[data-totem-view]').forEach((btn) => {
            const active = btn.dataset.totemView === catalogView;
            btn.classList.toggle('totem-view-switch__btn--active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        applyCatalogViewClasses();

        const indicator = switcher?.querySelector('.totem-view-switch__indicator');
        const activeBtn = switcher?.querySelector(`[data-totem-view="${catalogView}"]`);
        if (indicator && activeBtn) {
            indicator.style.width = `${activeBtn.offsetWidth}px`;
            indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
        }
    };

    const syncListHead = (visible) => {
        if (!productsBody) return;
        let listHead = productsBody.querySelector('.totem-list-head');
        if (!listHead) {
            listHead = document.createElement('div');
            listHead.className = 'totem-list-head';
            listHead.setAttribute('aria-hidden', 'true');
            listHead.innerHTML = `<span class="totem-list-head__cell totem-list-head__cell--thumb"></span>
<span class="totem-list-head__cell">Produto</span>
<span class="totem-list-head__cell totem-list-head__cell--price">Preço</span>
<span class="totem-list-head__cell totem-list-head__cell--qty">Quantidade</span>`;
            productsBody.insertBefore(listHead, productsGrid);
        }
        listHead.hidden = !visible;
        listHead.style.display = visible ? '' : 'none';
    };

    const setCatalogView = (view) => {
        const next = normalizeCatalogView(view);
        if (catalogView === next) return;
        catalogView = next;
        saveCatalogView(catalogView);
        productsGrid?.classList.add('totem-grid--view-changing');
        updateViewSwitcher();
        renderProducts();
        refreshProductGrid();
        window.requestAnimationFrame(() => {
            productsGrid?.classList.remove('totem-grid--view-changing');
            updateViewSwitcher();
        });
        bumpIdle();
    };

    catalogView = loadCatalogView();

    const shortProductName = (name) => {
        const text = String(name || '').trim();
        if (text.length <= 42) return text;
        return `${text.slice(0, 39)}…`;
    };

    const extractVolume = (name) => {
        const match = String(name || '').match(/(\d+)\s*ml/i);
        return match ? `${match[1]} ml` : '';
    };

    const isReturnable = (name) => /retorn[aá]vel/i.test(String(name || ''));

    const productDetailSubtitle = (group, variant, tier) => {
        const parts = [];
        const packSize = variant?.packSize;
        if (tier === 'caixa' && packSize) {
            parts.push(`1x${packSize} Unidades`);
        } else if (tier === 'pallet' && variant?.boxCount) {
            parts.push(`Pallet · ${variant.boxCount} cx`);
        } else if (tier === 'unidade') {
            parts.push('1 Unidade');
        }
        const vol = extractVolume(group?.baseName || variant?.name || '');
        if (vol) parts.push(`${vol} Garrafa`);
        return parts.join(' • ');
    };

    const unitPriceSuffix = (variant, tier) => {
        if (!variant) return '';
        const unitPrice = pricing.getUnitPrice(variant);
        if (unitPrice == null) return '';
        const unitLabel =
            tier === 'caixa' ? 'un' : tier === 'pallet' ? 'un' : pricing.TIER_LABELS?.[tier] || 'un';
        return `${formatPrice(unitPrice)}/${unitLabel}`;
    };

    const tierPackBadge = (tier, variant) => {
        if (tier === 'caixa' && variant?.packSize) return `CAIXA X ${variant.packSize}`;
        if (tier === 'pallet' && variant?.boxCount) return `PALLET ${variant.boxCount} CX`;
        if (tier === 'unidade') return 'UNIDADE';
        return pricing.TIER_SHORT?.[tier]?.toUpperCase() || '';
    };

    const getDetailContext = () => {
        if (!detailItemKey) return null;
        const item = displayItems.find((i) => (i.group?.key || i.product.id) === detailItemKey);
        if (!item) return null;
        const group = item.group;
        const tier = group ? activeTierFor(group) : item.defaultTier || 'caixa';
        const variant = group ? pricing.getVariant(group, tier) : null;
        const product = item.product;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const cart = cartApi.loadCart();
        const qty = cart[cartKey]?.qty || 0;
        const img = catalog.productImageUrl(group ? pricing.getTierImage(group, tier) : product.image);
        const displayName = group
            ? pricing.cartItemName({ ...variant, tier }, group)
            : product.name;
        return { item, group, tier, variant, product, cartKey, qty, img, displayName };
    };

    const closeProductDetail = () => {
        if (!detailPanel) return;
        detailPanel.classList.add('totem-detail--closing');
        detailPanel.classList.remove('totem-detail--open');
        window.setTimeout(() => {
            detailPanel.classList.remove('totem-detail--closing');
            detailPanel.setAttribute('aria-hidden', 'true');
            detailItemKey = null;
            detailDraftQty = 1;
            if (detailSheet) detailSheet.innerHTML = '';
        }, 280);
    };

    const renderProductDetail = () => {
        if (!detailSheet || !detailItemKey) return;
        const ctx = getDetailContext();
        if (!ctx) {
            closeProductDetail();
            return;
        }

        const { group, tier, variant, product, cartKey, img, displayName } = ctx;
        const price = (variant || product).price;
        const subtitle = productDetailSubtitle(group, variant, tier);
        const returnable = isReturnable(group?.baseName || displayName);
        const vol = extractVolume(group?.baseName || displayName);
        const packBadge = tierPackBadge(tier, variant);
        const tiersHtml = group ? priceTiersHtml(group, tier) : '';

        detailSheet.innerHTML = `<header class="totem-detail__header">
<button type="button" class="totem-detail__back" id="totem-detail-back" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="totem-detail__heading" id="totem-detail-heading">Detalhes do Produto</h1>
</header>
<div class="totem-detail__body">
<h2 class="totem-detail__name">${esc(displayName)}</h2>
<p class="totem-detail__subtitle">${esc(subtitle)}${returnable ? '<span class="material-symbols-outlined" aria-label="Retornável">recycling</span>' : ''}</p>
<div class="totem-detail__pricing">
<strong class="totem-detail__price-main">${formatPrice(price)}</strong>
${unitPriceSuffix(variant, tier) ? `<span class="totem-detail__price-unit">${esc(unitPriceSuffix(variant, tier))}</span>` : ''}
</div>
<div class="totem-detail__media">
${returnable ? '<span class="totem-detail__badge totem-detail__badge--return">Retornável</span>' : ''}
${vol ? `<span class="totem-detail__badge totem-detail__badge--vol">${esc(vol)}</span>` : ''}
${packBadge && !tiersHtml ? `<span class="totem-detail__badge totem-detail__badge--pack">${esc(packBadge)}</span>` : ''}
${img ? `<img src="${esc(img)}" alt="">` : '<span class="material-symbols-outlined totem-detail__placeholder" aria-hidden="true">liquor</span>'}
</div>
${tiersHtml ? `<div class="totem-detail__tiers">${tiersHtml}</div>` : ''}
<div class="totem-detail__actions">
<div class="totem-detail__qty">
<button type="button" class="totem-qty-btn totem-detail-minus" id="totem-detail-minus" aria-label="Diminuir quantidade" ${detailDraftQty <= 1 ? 'disabled' : ''}>−</button>
<span class="totem-detail__qty-value" id="totem-detail-qty">${detailDraftQty}</span>
<button type="button" class="totem-qty-btn totem-detail-plus" id="totem-detail-plus" aria-label="Aumentar quantidade">+</button>
</div>
<button type="button" class="totem-detail__add" id="totem-detail-add" data-cart-key="${esc(cartKey)}" data-item-key="${esc(detailItemKey)}" aria-label="Adicionar ao pedido">
adicionar ao pedido
</button>
</div>
</div>`;
    };

    const openProductDetail = (itemKey) => {
        if (!detailPanel || !detailSheet || !itemKey) return;
        totemKeyboard?.hide?.();
        detailItemKey = itemKey;
        detailDraftQty = 1;
        renderProductDetail();
        detailPanel.setAttribute('aria-hidden', 'false');
        detailPanel.classList.add('totem-detail--open');
        detailPanel.classList.remove('totem-detail--closing');
        bumpIdle();
    };

    const refreshDetailIfOpen = () => {
        if (!detailItemKey || !detailPanel?.classList.contains('totem-detail--open')) return;
        renderProductDetail();
    };

    const hideCartToast = () => {
        const toast = document.getElementById('totem-cart-toast');
        if (!toast) return;
        toast.classList.remove('totem-cart-toast--visible');
        window.clearTimeout(cartToastTimer);
        cartToastTimer = window.setTimeout(() => {
            toast.hidden = true;
        }, 220);
    };

    const showCartAddedToast = (productName, imageUrl) => {
        const toast = document.getElementById('totem-cart-toast');
        const nameEl = document.getElementById('totem-cart-toast-name');
        const thumbEl = document.getElementById('totem-cart-toast-thumb');
        if (!toast) return;

        if (nameEl) nameEl.textContent = shortProductName(productName);
        if (thumbEl) {
            if (imageUrl) {
                thumbEl.src = imageUrl;
                thumbEl.hidden = false;
            } else {
                thumbEl.removeAttribute('src');
                thumbEl.hidden = true;
            }
        }
        toast.hidden = false;
        window.requestAnimationFrame(() => {
            toast.classList.add('totem-cart-toast--visible');
        });
        window.clearTimeout(cartToastTimer);
        cartToastTimer = window.setTimeout(hideCartToast, 2800);

        if (cartBadge) pulseClass(cartBadge, 'totem-btn__badge--pop');
        if (floatCartBtn) pulseClass(floatCartBtn, 'totem-float-cart__btn--pop');
    };

    const activeTierFor = (group) => {
        if (!group?.key) return 'caixa';
        const preferred =
            tierByGroup.get(group.key) ||
            pricing.getTotemDefaultTier(group) ||
            pricing.getDefaultTier(group) ||
            'caixa';
        return pricing.resolveActiveTier?.(group, preferred) || preferred;
    };

    const priceTiersHtml = (group, activeTier) => {
        if (!group) return '';
        const tiers = pricing.getAvailableTiers(group);
        if (tiers.length <= 1) return '';
        const buttons = tiers
            .map((tier) => {
                const active = tier === activeTier;
                const label = pricing.TIER_SHORT?.[tier] || tier;
                return `<button type="button" class="ze-price-tier${active ? ' ze-price-tier--active' : ''}" data-price-tier="${esc(tier)}" aria-pressed="${active ? 'true' : 'false'}">${esc(label)}</button>`;
            })
            .join('');
        return `<div class="ze-price-tiers-slot"><div class="ze-price-tiers" role="group" aria-label="Embalagem">${buttons}</div></div>`;
    };

    const priceBlockHtml = (variant, opts = {}) => {
        if (!variant) return '';
        const meta = pricing.pricePackMeta(variant);
        const packPrice = meta.packagePrice ?? variant.price;
        const units = Math.max(1, Number(variant.packSize) || 1);
        const showUnitBreakdown = units > 1 && meta.unitPrice != null;
        const packLabel =
            meta.tierLabel ||
            (variant.tier === 'pallet' ? 'Pallet' : variant.tier === 'caixa' ? 'Caixa' : 'Unidade');
        const packHtml = opts.hidePackLabel
            ? ''
            : `<span class="totem-price-card__pack">${esc(packLabel)}</span>`;

        const detailHtml = `<p class="totem-price-card__detail">${units > 1 && meta.detail ? esc(meta.detail) : ''}</p>`;
        const unitHtml = `<p class="totem-price-card__unit">${
            showUnitBreakdown ? `${formatPrice(meta.unitPrice)}<span> / un</span>` : ''
        }</p>`;

        return `<div class="totem-price-card ze-price-block totem-product__price-block" data-price-display>
<div class="totem-price-card__main">
<span class="totem-product__price totem-price-card__value">${formatPrice(packPrice)}</span>
${packHtml}
</div>
${detailHtml}
${unitHtml}
</div>`;
    };

    const updatePriceBlock = (card, variant, opts = {}) => {
        if (!variant) return;
        const priceBlock = card.querySelector('[data-price-display]');
        if (!priceBlock) return;
        const next = document.createElement('div');
        next.innerHTML = priceBlockHtml(variant, opts);
        const replacement = next.firstElementChild;
        if (replacement) priceBlock.replaceWith(replacement);
    };

    const refreshTotemProductCard = (card) => {
        if (!card?.dataset?.groupKey) return;
        const group = window.__ligProductGroups?.get?.(card.dataset.groupKey);
        if (!group) return;

        const tier = card.dataset.priceTier || activeTierFor(group);
        const variant = pricing.getVariant(group, tier);
        if (!variant) return;

        const cartKey = catalog.cartKeyFor(variant);
        const cart = cartApi.loadCart();
        const qty = cart[cartKey]?.qty || 0;

        card.dataset.priceTier = tier;
        card.dataset.cartKey = cartKey;
        card.classList.toggle('totem-product--selected', qty > 0);

        const imgEl = card.querySelector('.totem-product__media img');
        const imgSrc = catalog.productImageUrl(pricing.getTierImage(group, tier));
        if (imgEl && imgSrc) imgEl.src = imgSrc;

        const badge = card.querySelector('.totem-product__badge');
        if (qty > 0) {
            if (badge) {
                badge.textContent = String(qty);
                badge.setAttribute('aria-label', `${qty} no carrinho`);
            } else {
                const media = card.querySelector('.totem-product__media');
                if (media) {
                    media.insertAdjacentHTML(
                        'afterbegin',
                        `<span class="totem-product__badge" aria-label="${qty} no carrinho">${qty}</span>`
                    );
                }
            }
        } else if (badge) {
            badge.remove();
        }

        const priceEl = card.querySelector('.totem-product__price');
        if (priceEl && !card.querySelector('[data-price-display]')) {
            priceEl.textContent = formatPrice(variant.price);
        } else {
            const tiers = pricing.getAvailableTiers(group);
            updatePriceBlock(card, variant, { hidePackLabel: tiers.length > 1 });
        }

        const minus = card.querySelector('.totem-minus');
        const plus = card.querySelector('.totem-plus');
        const qtyEl = card.querySelector('.totem-qty-value');
        if (minus) {
            minus.dataset.cartKey = cartKey;
            minus.disabled = qty <= 0;
        }
        if (plus) {
            plus.dataset.cartKey = cartKey;
        }
        if (qtyEl) qtyEl.textContent = String(qty);

        card.querySelectorAll('.ze-price-tier').forEach((btn) => {
            const isActive = btn.dataset.priceTier === tier;
            btn.classList.toggle('ze-price-tier--active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    const pulseClass = (el, className, ms = 450) => {
        if (!el) return;
        el.classList.remove(className);
        void el.offsetWidth;
        el.classList.add(className);
        window.setTimeout(() => el.classList.remove(className), ms);
    };

    const refreshMotion = (el, className) => {
        if (!el) return;
        el.classList.remove(className);
        void el.offsetWidth;
        el.classList.add(className);
        window.setTimeout(() => el.classList.remove(className), 500);
    };

    const refreshProductGrid = () => {
        if (!productsGrid) return;
        productsGrid.classList.remove('totem-grid--refresh');
        void productsGrid.offsetWidth;
        productsGrid.classList.add('totem-grid--refresh');
        window.setTimeout(() => productsGrid.classList.remove('totem-grid--refresh'), 700);
    };

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

    const itemMatchesSearch = (item) => {
        if (!searchQuery) return true;
        const search = window.LigeirinhoSearch;
        const queryInfo = getQueryInfo();
        if (search?.matchesHaystack && item._searchHaystack) {
            return search.matchesHaystack(item._searchHaystack, queryInfo);
        }
        const haystack = `${item.product.id} ${item.product.name} ${item.product.description || ''} ${item.categoryName}`;
        if (search?.matchesSearch) return search.matchesSearch(haystack, queryInfo);
        return haystack.toLowerCase().includes(searchQuery);
    };

    const sortVisibleItems = (items) => {
        const search = window.LigeirinhoSearch;
        const queryInfo = getQueryInfo();
        const sorted = [...items];
        if (searchQuery && queryInfo?.raw && search?.scoreHaystack) {
            sorted.sort((a, b) => {
                const scoreA = a._searchHaystack ? search.scoreHaystack(a._searchHaystack, queryInfo) : 0;
                const scoreB = b._searchHaystack ? search.scoreHaystack(b._searchHaystack, queryInfo) : 0;
                const scoreDiff = scoreB - scoreA;
                if (scoreDiff !== 0) return scoreDiff;
                return (a.group?.baseName || a.product.name).localeCompare(
                    b.group?.baseName || b.product.name,
                    'pt-BR'
                );
            });
            return sorted;
        }
        sorted.sort((a, b) =>
            (a.group?.baseName || a.product.name).localeCompare(b.group?.baseName || b.product.name, 'pt-BR')
        );
        return sorted;
    };

    const getVisibleItems = () => {
        let items = displayItems;
        if (searchQuery) {
            items = items.filter((item) => itemMatchesSearch(item));
        } else if (activeCategory) {
            items = items.filter((item) => item.categoryId === activeCategory);
        }
        return sortVisibleItems(items);
    };

    const updateSearchClear = () => {
        if (!searchClearBtn) return;
        searchClearBtn.hidden = !searchQuery;
    };

    const clearSearch = () => {
        searchQuery = '';
        cachedQueryKey = '';
        cachedQueryInfo = null;
        if (searchInput) searchInput.value = '';
        updateSearchClear();
    };

    const setSearchQuery = (value) => {
        searchQuery = String(value || '').trim().toLowerCase();
        cachedQueryKey = '';
        cachedQueryInfo = null;
        updateSearchClear();
        renderProducts();
        bumpIdle();
    };

    const categoryPillHtml = (catId, label, count, active) => {
        const iconHtml = catalog.categoryTotemIconHtml(catId);
        return `<button type="button" class="ze-filter-pill totem-cat-pill" data-cat="${esc(catId)}" aria-pressed="${active ? 'true' : 'false'}">${iconHtml}<span class="totem-cat-pill__text"><span class="totem-cat-pill__label">${esc(label)}</span><span class="totem-cat-pill__count">${count}</span></span></button>`;
    };

    const resetCustomerForm = () => {
        totemCustomer = { name: '', phone: '' };
        customerLookupHit = null;
        customerStep = 'register';
        if (customerNameInput) customerNameInput.value = '';
        if (customerPhoneInput) customerPhoneInput.value = '';
        if (customerLookupInput) customerLookupInput.value = '';
        showCustomerError('');
        showLookupError('');
        customerNameInput?.classList.remove('totem-customer__input--error');
    };

    const showLookupError = (message) => {
        if (!customerLookupError) return;
        customerLookupError.textContent = message;
        customerLookupError.hidden = !message;
    };

    const showCustomerStep = (step) => {
        customerStep = step;
        Object.entries(customerSteps).forEach(([key, el]) => {
            if (!el) return;
            const active = key === step;
            el.classList.toggle('totem-customer__step--active', active);
            el.hidden = !active;
        });
        if (step === 'lookup') {
            window.setTimeout(() => {
                customerLookupInput?.focus();
                bindCustomerKeyboard(customerLookupInput, 'numeric');
            }, 120);
        } else if (step === 'manual') {
            window.setTimeout(() => {
                customerNameInput?.focus();
                bindCustomerKeyboard(customerNameInput);
            }, 120);
        }
    };

    const startCustomerFlow = () => {
        resetCustomerForm();
        showCustomerStep('register');
    };

    const showCustomerConfirm = (customer) => {
        if (customerConfirmName) customerConfirmName.textContent = customer.name;
        if (customerConfirmCardName) customerConfirmCardName.textContent = customer.name;
        if (customerConfirmHint) {
            customerConfirmHint.textContent = customer.hint
                ? `${customer.hint} — confirme se é você.`
                : 'Confirme se este cadastro é seu.';
        }
    };

    const goManualCustomer = ({ fromReject = false } = {}) => {
        if (fromReject) {
            if (customerManualEyebrow) customerManualEyebrow.textContent = 'Outro cadastro';
            if (customerManualTitle) customerManualTitle.textContent = 'Vamos identificar você';
            if (customerManualLead) {
                customerManualLead.textContent = 'Informe seu nome e telefone para o pedido no caixa.';
            }
        } else {
            if (customerManualEyebrow) customerManualEyebrow.textContent = 'Novo cliente';
            if (customerManualTitle) customerManualTitle.textContent = 'Seja bem-vindo!';
            if (customerManualLead) {
                customerManualLead.textContent = 'Informe seu nome para identificarmos o pedido no caixa.';
            }
        }
        if (customerNameInput) customerNameInput.value = '';
        if (customerPhoneInput) customerPhoneInput.value = fromReject ? customerLookupHit?.phone || '' : '';
        showCustomerError('');
        showCustomerStep('manual');
    };

    const submitCustomerLookup = async () => {
        const query = String(customerLookupInput?.value || '').trim();
        const digits = query.replace(/\D/g, '');
        if (digits.length < 10) {
            showLookupError('Informe telefone, CPF ou CNPJ com pelo menos 10 dígitos.');
            customerLookupInput?.focus();
            bindCustomerKeyboard(customerLookupInput, 'numeric');
            return;
        }
        if (customerLookupSubmit) customerLookupSubmit.disabled = true;
        showLookupError('');
        totemKeyboard?.hide?.();
        try {
            const res = await fetch('/api/totem/customer/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Cadastro não encontrado');
            customerLookupHit = data.customer;
            showCustomerConfirm(data.customer);
            showCustomerStep('confirm');
        } catch (err) {
            showLookupError(err.message || 'Cadastro não encontrado.');
            customerLookupInput?.focus();
            bindCustomerKeyboard(customerLookupInput, 'numeric');
        } finally {
            if (customerLookupSubmit) customerLookupSubmit.disabled = false;
        }
    };

    const confirmCustomerIdentity = () => {
        if (!customerLookupHit?.name) return;
        totemCustomer = {
            name: customerLookupHit.name,
            phone: String(customerLookupHit.phone || '').trim(),
        };
        totemKeyboard?.hide?.();
        enterCatalog();
    };

    const showCustomerError = (message) => {
        if (!customerError) return;
        customerError.textContent = message;
        customerError.hidden = !message;
    };

    const initSearchKeyboard = () => {
        if (!searchInput) return;
        totemKeyboard = window.LigeirinhoTotemKeyboard?.init?.({
            input: searchInput,
            onInput: (value) => {
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = window.setTimeout(() => setSearchQuery(value), 180);
            },
            onSubmit: (value) => setSearchQuery(value),
            onClose: bumpIdle,
        });
    };

    const bindCustomerKeyboard = (field, mode = null) => {
        if (!field) return;
        const keyboardMode =
            mode || (field === customerPhoneInput || field === customerLookupInput ? 'numeric' : 'full');
        totemKeyboard = window.LigeirinhoTotemKeyboard?.init?.({
            input: field,
            mode: keyboardMode,
            submitLabel: 'OK',
            onSubmit: () => totemKeyboard?.hide?.(),
            onClose: bumpIdle,
        });
        field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        totemKeyboard?.show?.();
    };

    const enterCatalog = () => {
        resetCart();
        clearSearch();
        if (!activeCategory && totemCategories[0]) {
            activeCategory = totemCategories[0].id;
        }
        renderCategories();
        renderProducts();
        setView('catalog');
        initSearchKeyboard();
        bumpIdle();
    };

    const submitCustomerAndStart = () => {
        const name = String(customerNameInput?.value || '').trim().replace(/\s+/g, ' ');
        const phone = String(customerPhoneInput?.value || '').trim();
        if (!name) {
            customerNameInput?.classList.add('totem-customer__input--error');
            showCustomerError('Informe seu nome para continuar.');
            customerNameInput?.focus();
            bindCustomerKeyboard(customerNameInput);
            return;
        }
        customerNameInput?.classList.remove('totem-customer__input--error');
        showCustomerError('');
        totemCustomer = { name, phone };
        totemKeyboard?.hide?.();
        enterCatalog();
    };

    const renderCategories = () => {
        if (!categoriesEl) return;
        const totalCount = displayItems.length;
        const pills =
            categoryPillHtml('', 'Todos', totalCount, !activeCategory) +
            totemCategories
                .map((cat) => {
                    const active = cat.id === activeCategory;
                    const label = catalog.formatCategoryLabel(cat.name);
                    return categoryPillHtml(cat.id, label, cat.count, active);
                })
                .join('');
        categoriesEl.innerHTML = pills;
        if (categoriesStats) {
            categoriesStats.textContent = `${totemCategories.length} categorias · ${totalCount} produtos`;
        }
        updateCategoriesBtnLabel();
    };

    const setView = (name) => {
        Object.entries(views).forEach(([key, el]) => {
            if (!el) return;
            const active = key === name;
            el.classList.toggle('totem-view--active', active);
            if (active) {
                el.removeAttribute('hidden');
                el.setAttribute('aria-hidden', 'false');
            } else {
                el.setAttribute('hidden', '');
                el.setAttribute('aria-hidden', 'true');
            }
            if (active) {
                el.classList.add('totem-view--entering');
                window.setTimeout(() => el.classList.remove('totem-view--entering'), 650);
            }
        });
        const inCatalog = name === 'catalog';
        const inPromos = name === 'promos';
        const inShopping = inCatalog || inPromos;
        if (promosBtn) {
            promosBtn.hidden = false;
            promosBtn.classList.toggle('totem-btn--promos-active', inPromos);
            promosBtn.setAttribute('aria-pressed', inPromos ? 'true' : 'false');
        }
        if (cartBtn) cartBtn.hidden = true;
        totemHeader?.classList.toggle('totem-header--catalog', inCatalog);
        totemHeader?.classList.toggle('totem-header--promos', inPromos);
        if (!inShopping) idleHint?.classList.remove('totem-idle-hint--visible');
        if (!inCatalog) {
            totemKeyboard?.hide?.();
            closeCategoriesModal();
        }
        if (name === 'customer' && customerStep === 'register' && !customerSteps.register?.classList.contains('totem-customer__step--active')) {
            startCustomerFlow();
        }
        if (inPromos) {
            window.LigeirinhoTotemPromos?.refresh?.();
            window.LigeirinhoTotemPromos?.startAuto?.();
        } else {
            window.LigeirinhoTotemPromos?.stopAuto?.();
        }
        updateFloatCart(cartApi.loadCart());
    };

    const isCartOpen = () => cartPanel?.classList.contains('totem-cart-panel--open');

    const isInCatalog = () => views.catalog?.classList.contains('totem-view--active');

    const refreshPromosIfOpen = () => {
        if (views.promos?.classList.contains('totem-view--active')) {
            window.LigeirinhoTotemPromos?.refresh?.();
        }
    };

    const isInPromos = () => views.promos?.classList.contains('totem-view--active');

    const isInShopping = () => isInCatalog() || isInPromos();

    const updateFloatCart = (cart) => {
        const cartData = cart || cartApi.loadCart();
        const count = cartApi.cartItemCount(cartData);
        const total = formatPrice(cartApi.cartTotalValue(cartData));

        if (cartBadge) cartBadge.textContent = String(count);
        if (floatCartCount) floatCartCount.textContent = count > 99 ? '99+' : String(count);
        if (floatCartTotal) floatCartTotal.textContent = total;
        if (floatCartMeta) floatCartMeta.textContent = count === 1 ? '1 item' : `${count} itens`;
        if (floatCartBtn) {
            floatCartBtn.setAttribute(
                'aria-label',
                count === 1 ? `Ver carrinho, 1 item, total ${total}` : `Ver carrinho, ${count} itens, total ${total}`
            );
        }

        const visible = count > 0 && isInShopping() && !isCartOpen();
        floatCart?.classList.toggle('totem-float-cart--visible', visible);
        floatCart?.setAttribute('aria-hidden', visible ? 'false' : 'true');
        document.documentElement.classList.toggle('totem-has-float-cart', count > 0 && isInShopping());
    };

    const resetCart = () => {
        cartApi.clearTotemSession?.();
        renderCart();
    };

    const resetSession = () => {
        closeProductDetail();
        closeCart();
        window.LigeirinhoTotemPromos?.closeLightbox?.();
        resetCart();
        resetCustomerForm();
        clearSearch();
        idleHint?.classList.remove('totem-idle-hint--visible');
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
            if (views.catalog?.classList.contains('totem-view--active') || views.promos?.classList.contains('totem-view--active')) {
                idleHint?.classList.add('totem-idle-hint--visible');
            }
        }, hintMs);
    };

    const updateCategoriesBtnLabel = () => {
        const catMeta = activeCategoryMeta();
        const catId = catMeta?.id || '';
        const meta = catalog.resolveTotemCategoryMeta(catId);
        const categoriesBtnIcon = categoriesBtn?.querySelector('.totem-categories-btn__icon');
        const categoriesBtnGlyph = categoriesBtn?.querySelector('.totem-categories-btn__glyph');
        if (categoriesBtnIcon) {
            categoriesBtnIcon.style.setProperty('--totem-cat-icon-bg', meta.bg);
            categoriesBtnIcon.style.setProperty('--totem-cat-icon-fg', meta.fg);
        }
        if (categoriesBtnGlyph) {
            categoriesBtnGlyph.textContent = meta.icon;
        }
        if (!categoriesBtnLabel) return;
        categoriesBtnLabel.textContent = catMeta
            ? catalog.formatCategoryLabel(catMeta.name)
            : 'Todas as categorias';
    };

    const openCategoriesModal = () => {
        if (!categoriesModal) return;
        totemKeyboard?.hide?.();
        renderCategories();
        categoriesModal.classList.add('totem-categories-modal--open');
        categoriesModal.setAttribute('aria-hidden', 'false');
        categoriesCloseBtn?.focus();
        bumpIdle();
    };

    const closeCategoriesModal = () => {
        if (!categoriesModal?.classList.contains('totem-categories-modal--open')) return;
        categoriesModal.classList.remove('totem-categories-modal--open');
        categoriesModal.setAttribute('aria-hidden', 'true');
        categoriesBtn?.focus();
        bumpIdle();
    };

    const applyCategory = (categoryId) => {
        clearSearch();
        activeCategory = categoryId ? canonCategoryId(categoryId) : '';
        renderCategories();
        renderProducts();
        closeCategoriesModal();
        bumpIdle();
    };

    const buildProductCardHtml = (item, index) => {
        const group = item.group || null;
        const product = item.product;
        const tier = group ? activeTierFor(group) : item.defaultTier || 'caixa';
        const variant = group ? pricing.getVariant(group, tier) : null;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const cart = cartApi.loadCart();
        const qty = cart[cartKey]?.qty || 0;
        const img = catalog.productImageUrl(group ? pricing.getTierImage(group, tier) : product.image);
        const name = group?.baseName || product.name;
        const itemKey = group?.key || product.id;
        const tiersHtml = group ? priceTiersHtml(group, tier) : '';
        const tierCount = group ? pricing.getAvailableTiers(group).length : 0;
        const priceHtml = variant
            ? priceBlockHtml(variant, { hidePackLabel: tierCount > 1 })
            : `<div class="totem-price-card ze-price-block totem-product__price-block" data-price-display>
<div class="totem-price-card__main">
<span class="totem-product__price totem-price-card__value">${formatPrice(product.price)}</span>
</div>
<p class="totem-price-card__detail"></p>
<p class="totem-price-card__unit"></p>
</div>`;
        const qtyHtml = `<div class="totem-product__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<span class="totem-qty-value">${qty}</span>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" aria-label="Aumentar">+</button>
</div>`;
        const selectedClass = qty ? ' totem-product--selected' : '';
        const attrs = `role="listitem" data-group-key="${esc(group?.key || '')}" data-price-tier="${esc(tier)}" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" style="--totem-card-i:${Math.min(index, 14)}"`;
        const mediaHtml = `<div class="totem-product__media">
${qty ? `<span class="totem-product__badge" aria-label="${qty} no carrinho">${qty}</span>` : ''}
${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>`;
        const bodyHtml = `<div class="totem-product__body">
<div class="totem-product__name">${esc(name)}</div>
<div class="totem-product__pricing">
${tiersHtml}
${catalogView !== 'list' ? `<div class="totem-product__meta">${priceHtml}</div>` : ''}
</div>
${catalogView !== 'list' ? qtyHtml : ''}
</div>`;

        if (catalogView === 'list') {
            return `<article class="totem-product totem-product--list${selectedClass}" ${attrs}>
${mediaHtml}
${bodyHtml}
<div class="totem-product__list-price">${priceHtml}</div>
${qtyHtml}
</article>`;
        }

        return `<article class="totem-product${selectedClass}" ${attrs}>
${mediaHtml}
${bodyHtml}
</article>`;
    };

    const renderProducts = () => {
        if (!productsGrid) return;
        if (activeCategory && !totemCategories.some((c) => c.id === activeCategory)) {
            activeCategory = totemCategories[0]?.id || '';
        }
        updateCategoriesBtnLabel();
        const searching = Boolean(searchQuery);
        const items = getVisibleItems();
        const catMeta = activeCategoryMeta();
        const catLabel = searching
            ? `Busca: ${searchInput?.value?.trim() || searchQuery}`
            : catMeta
              ? catalog.formatCategoryLabel(catMeta.name)
              : '';

        if (productsHead) productsHead.hidden = !catLabel;
        if (categoryTitle) categoryTitle.textContent = catLabel;
        if (productsCount) {
            productsCount.textContent =
                items.length === 1 ? '1 produto' : `${items.length} produtos`;
        }
        updateViewSwitcher();
        if (!searching && catLabel && activeCategory !== lastAnimatedCategory) {
            refreshMotion(categoryTitle, 'totem-products__title--refresh');
            refreshMotion(productsCount, 'totem-products__count--refresh');
            refreshProductGrid();
            lastAnimatedCategory = activeCategory;
        } else if (searching) {
            refreshMotion(categoryTitle, 'totem-products__title--refresh');
            refreshMotion(productsCount, 'totem-products__count--refresh');
            refreshProductGrid();
        }

        const isEmpty = items.length === 0;
        if (productsEmpty) {
            productsEmpty.hidden = !isEmpty;
            productsEmpty.style.display = isEmpty ? '' : 'none';
        }
        if (productsEmptyTitle) {
            productsEmptyTitle.textContent = searching
                ? 'Nenhum produto encontrado'
                : 'Nenhum produto nesta categoria';
        }
        if (productsEmptyLead) {
            productsEmptyLead.textContent = searching
                ? 'Tente outro termo ou limpe a busca.'
                : 'Selecione outra categoria para continuar.';
        }
        if (productsGrid) {
            productsGrid.hidden = isEmpty;
            productsGrid.style.display = isEmpty ? 'none' : '';
        }
        syncListHead(!isEmpty && catalogView === 'list');

        if (isEmpty) {
            productsGrid.innerHTML = '';
            return;
        }

        productsGrid.innerHTML = items.map((item, index) => buildProductCardHtml(item, index)).join('');
        refreshDetailIfOpen();
        window.requestAnimationFrame(() => updateViewSwitcher());
    };

    const pulseProduct = (cartKey) => {
        const card =
            productsGrid?.querySelector(`[data-cart-key="${cartKey}"]`) ||
            productsGrid?.querySelector(`.totem-plus[data-cart-key="${cartKey}"]`)?.closest('.totem-product');
        pulseClass(card, 'totem-product--pulse');
        const badge = card?.querySelector('.totem-product__badge');
        if (badge) pulseClass(badge, 'totem-product__badge--pop');
        const qtyEl = card?.querySelector('.totem-qty-value');
        if (qtyEl) pulseClass(qtyEl, 'totem-qty-value--pop');
    };

    const findDisplayItem = (cartKey, itemKey) => {
        if (itemKey) {
            const byGroup = displayItems.find((i) => (i.group?.key || i.product.id) === itemKey);
            if (byGroup) return byGroup;
        }
        if (cartKey) {
            const match = displayItems.find((i) => {
                const group = i.group;
                if (!group) return i.product.id === cartKey;
                return pricing.getAvailableTiers(group).some((tier) => {
                    const variant = pricing.getVariant(group, tier);
                    return variant && catalog.cartKeyFor(variant) === cartKey;
                });
            });
            if (match) return match;
        }
        return null;
    };

    const cartLineImage = (item) => {
        const display = findDisplayItem(item.cartKey || item.id, null);
        if (!display) return '';
        const group = display.group;
        const product = display.product;
        const tier = item.packType || (group ? activeTierFor(group) : 'caixa');
        const imageRef = group ? pricing.getTierImage(group, tier) : product.image;
        return catalog.productImageUrl(imageRef) || '';
    };

    const cartLineThumbHtml = (item) => {
        const img = cartLineImage(item);
        if (img) {
            return `<div class="totem-cart-line__thumb"><img src="${esc(img)}" alt="" loading="lazy" decoding="async"></div>`;
        }
        return `<div class="totem-cart-line__thumb totem-cart-line__thumb--empty" aria-hidden="true"><span class="material-symbols-outlined">liquor</span></div>`;
    };

    const formatCartCount = (count) => {
        if (count === 0) return 'Nenhum item';
        if (count === 1) return '1 item';
        return `${count} itens`;
    };

    const cartCategoryFields = (item) => ({
        categoryId: item.categoryId || '',
        categoryName: item.categoryName || '',
    });

    const addItem = (cartKey, itemKey, opts = {}) => {
        const item = findDisplayItem(cartKey, itemKey);
        if (!item) return;
        const group = item.group;
        const card = itemKey ? productsGrid?.querySelector(`[data-item-key="${itemKey}"]`) : null;
        const tier = card?.dataset?.priceTier || (group ? activeTierFor(group) : 'caixa');
        const variant = group ? pricing.getVariant(group, tier) : null;
        const product = item.product;
        const key = cartKey || (variant ? catalog.cartKeyFor(variant) : product.id);
        const packType = variant?.tier || tier || 'caixa';
        const name = group
            ? pricing.cartItemName({ ...variant, tier: packType }, group)
            : product.name;
        const price =
            opts.promoPrice != null && Number.isFinite(Number(opts.promoPrice))
                ? Number(opts.promoPrice)
                : (variant || product).price;
        const cart = cartApi.loadCart();
        if (!cart[key]) {
            cart[key] = {
                id: (variant || product).id,
                cartKey: key,
                name,
                price,
                qty: 0,
                packType,
                ...cartCategoryFields(item),
                ...(opts.promoId ? { promoId: opts.promoId } : {}),
            };
        } else if (opts.promoPrice != null && Number.isFinite(Number(opts.promoPrice))) {
            cart[key].price = Number(opts.promoPrice);
            if (opts.promoId) cart[key].promoId = opts.promoId;
        }
        cart[key].qty += 1;
        cartApi.saveCart(cart);
        renderCart();
        renderProducts();
        refreshPromosIfOpen();
        pulseProduct(key);
        showCartAddedToast(name, cartLineImage(cart[key]));
        bumpIdle();
    };

    const addDetailToCart = (cartKey, itemKey) => {
        const qtyToAdd = Math.max(1, detailDraftQty);
        const item = findDisplayItem(cartKey, itemKey);
        if (!item) return;
        const group = item.group;
        const tier = group ? activeTierFor(group) : item.defaultTier || 'caixa';
        const variant = group ? pricing.getVariant(group, tier) : null;
        const product = item.product;
        const key = cartKey || (variant ? catalog.cartKeyFor(variant) : product.id);
        const packType = variant?.tier || tier || 'caixa';
        const name = group
            ? pricing.cartItemName({ ...variant, tier: packType }, group)
            : product.name;
        const price = (variant || product).price;
        const cart = cartApi.loadCart();
        if (!cart[key]) {
            cart[key] = {
                id: (variant || product).id,
                cartKey: key,
                name,
                price,
                qty: 0,
                packType,
                ...cartCategoryFields(item),
            };
        }
        cart[key].qty += qtyToAdd;
        cartApi.saveCart(cart);
        renderCart();
        renderProducts();
        refreshPromosIfOpen();
        pulseProduct(key);
        showCartAddedToast(name, cartLineImage(cart[key]));
        detailDraftQty = 1;
        refreshDetailIfOpen();
        bumpIdle();
    };

    const changeQty = (cartKey, delta) => {
        const cart = cartApi.loadCart();
        if (!cart[cartKey]) return;
        const line = cart[cartKey];
        const itemName = line.name;
        cart[cartKey].qty += delta;
        if (cart[cartKey].qty <= 0) delete cart[cartKey];
        cartApi.saveCart(cart);
        renderCart();
        renderProducts();
        refreshPromosIfOpen();
        if (delta > 0) {
            pulseProduct(cartKey);
            showCartAddedToast(itemName, cartLineImage(line));
        }
        bumpIdle();
    };

    const removeFromCart = (cartKey) => {
        const cart = cartApi.loadCart();
        if (!cart[cartKey]) return;
        delete cart[cartKey];
        cartApi.saveCart(cart);
        renderCart();
        renderProducts();
        refreshPromosIfOpen();
        refreshDetailIfOpen();
        bumpIdle();
    };

    const renderCart = () => {
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        const count = cartApi.cartItemCount(cart);
        const total = cartApi.cartTotalValue(cart);
        if (cartBadge) cartBadge.textContent = String(count);
        if (cartCountEl) cartCountEl.textContent = formatCartCount(count);
        if (count !== lastCartCount) {
            if (count > 0) pulseClass(cartBadge, 'totem-btn__badge--pop');
            lastCartCount = count;
        }
        if (cartTotalEl) cartTotalEl.textContent = formatPrice(total);
        if (checkoutBtn) {
            checkoutBtn.disabled = count === 0;
            checkoutBtn.textContent = count ? 'Ir para pagamento' : 'Adicione produtos';
        }
        if (!cartList) return;
        cartList.innerHTML = items.length
            ? items
                  .map((item, index) => {
                      const key = item.cartKey || item.id;
                      const pack = cartApi.packTypeLabel(item.packType);
                      const lineTotal = cartApi.lineSubtotal(item);
                      return `<article class="totem-cart-line" style="--totem-line-i:${index}">
${cartLineThumbHtml(item)}
<div class="totem-cart-line__body">
<div class="totem-cart-line__name">${esc(item.name)}</div>
<div class="totem-cart-line__meta">
${item.promoId ? '<span class="totem-cart-line__promo">PROMO</span>' : ''}
<span class="totem-cart-line__pack">${esc(pack)}</span>
<span class="totem-cart-line__sep" aria-hidden="true">·</span>
<span>${formatPrice(item.price)}</span>
</div>
<div class="totem-cart-line__subtotal">${formatPrice(lineTotal)}</div>
</div>
<div class="totem-cart-line__actions">
<div class="totem-cart-line__qty" role="group" aria-label="Quantidade">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(key)}" aria-label="Diminuir">−</button>
<span class="totem-cart-line__qty-val">${item.qty}</span>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(key)}" aria-label="Aumentar">+</button>
</div>
<button type="button" class="totem-cart-line__remove totem-remove" data-cart-key="${esc(key)}" aria-label="Remover item do carrinho">
<span class="material-symbols-outlined" aria-hidden="true">delete</span>
</button>
</div>
</article>`;
                  })
                  .join('')
            : `<div class="totem-cart-empty">
<span class="material-symbols-outlined totem-cart-empty__icon" aria-hidden="true">shopping_cart</span>
<p class="totem-cart-empty__title">Seu carrinho está vazio</p>
<p class="totem-cart-empty__lead">Toque em <strong>+</strong> nos produtos para começar.</p>
</div>`;
        updateFloatCart(cart);
    };

    const openCart = () => {
        cartPanel?.classList.add('totem-cart-panel--open');
        cartPanel?.setAttribute('aria-hidden', 'false');
        updateFloatCart(cartApi.loadCart());
        renderCart();
        bumpIdle();
    };

    const closeCart = () => {
        if (!cartPanel?.classList.contains('totem-cart-panel--open')) return;
        cartPanel.classList.add('totem-cart-panel--closing');
        window.setTimeout(() => {
            cartPanel.classList.remove('totem-cart-panel--open', 'totem-cart-panel--closing');
            cartPanel.setAttribute('aria-hidden', 'true');
            updateFloatCart(cartApi.loadCart());
        }, 300);
    };

    const startCheckout = async () => {
        const cart = cartApi.loadCart();
        if (!cartApi.cartItemCount(cart)) return;
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Enviando pedido…';

        const s = session();
        const items = cartApi.cartEntries(cart).map((item) => ({
            id: item.id,
            cartKey: item.cartKey || item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            packType: item.packType,
            categoryId: item.categoryId || '',
            categoryName: item.categoryName || '',
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
                        name: totemCustomer.name || s?.totemLabel || s?.name || 'Cliente Totem',
                        phone: totemCustomer.phone || s?.phone || '',
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
        document.dispatchEvent(new CustomEvent('totem-admin-open'));
        adminPin.value = '';
        adminPin?.focus();
    };

    const closeAdminModal = () => {
        adminModal?.classList.remove('totem-admin-modal--open');
        adminModal?.setAttribute('aria-hidden', 'true');
        document.dispatchEvent(new CustomEvent('totem-admin-close'));
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
            totemKeyboard?.hide?.();
            setView('customer');
            startCustomerFlow();
            bumpIdle();
        });

        customerBackBtn?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            if (customerStep === 'register') {
                setView('welcome');
            } else if (customerStep === 'lookup') {
                showCustomerStep('register');
            } else if (customerStep === 'confirm') {
                showCustomerStep('lookup');
            } else {
                showCustomerStep('register');
            }
            bumpIdle();
        });

        document.getElementById('totem-customer-registered-yes')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            showCustomerStep('lookup');
            bumpIdle();
        });

        document.getElementById('totem-customer-registered-no')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            goManualCustomer();
            bumpIdle();
        });

        customerLookupForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            void submitCustomerLookup();
        });

        customerLookupInput?.addEventListener('focus', () => bindCustomerKeyboard(customerLookupInput, 'numeric'));

        document.getElementById('totem-customer-confirm-yes')?.addEventListener('click', () => {
            confirmCustomerIdentity();
            bumpIdle();
        });

        document.getElementById('totem-customer-confirm-no')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            goManualCustomer({ fromReject: true });
            bumpIdle();
        });

        customerForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            submitCustomerAndStart();
        });

        customerNameInput?.addEventListener('input', () => {
            customerNameInput.classList.remove('totem-customer__input--error');
            if (customerError?.textContent) showCustomerError('');
        });

        customerNameInput?.addEventListener('focus', () => bindCustomerKeyboard(customerNameInput));
        customerPhoneInput?.addEventListener('focus', () => bindCustomerKeyboard(customerPhoneInput));

        promosBtn?.addEventListener('click', () => {
            if (views.catalog?.classList.contains('totem-view--active')) {
                promosReturnView = 'catalog';
            } else {
                promosReturnView = 'welcome';
            }
            setView('promos');
            bumpIdle();
        });

        promosBackBtn?.addEventListener('click', () => {
            window.LigeirinhoTotemPromos?.stopAuto?.();
            setView(promosReturnView);
            bumpIdle();
        });

        logoBtn?.addEventListener('click', () => {
            if (!isInShopping()) return;
            resetSession();
        });
        cartBtn?.addEventListener('click', openCart);
        floatCartBtn?.addEventListener('click', openCart);
        document.getElementById('totem-cart-toast-open')?.addEventListener('click', () => {
            hideCartToast();
            openCart();
        });
        document.getElementById('totem-cart-close')?.addEventListener('click', closeCart);
        checkoutBtn?.addEventListener('click', startCheckout);

        categoriesBtn?.addEventListener('click', openCategoriesModal);
        categoriesCloseBtn?.addEventListener('click', closeCategoriesModal);
        categoriesBackdrop?.addEventListener('click', closeCategoriesModal);

        categoriesEl?.addEventListener('click', (e) => {
            const pill = e.target.closest('.totem-cat-pill');
            if (!pill) return;
            applyCategory(pill.dataset.cat || '');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && categoriesModal?.classList.contains('totem-categories-modal--open')) {
                closeCategoriesModal();
            }
        });

        productsHead?.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('[data-totem-view]');
            if (!viewBtn) return;
            setCatalogView(viewBtn.dataset.totemView);
        });

        productsGrid?.addEventListener('click', (e) => {
            const tierBtn = e.target.closest('.ze-price-tier');
            if (tierBtn) {
                const card = tierBtn.closest('.totem-product');
                if (!card?.dataset?.groupKey) return;
                const tier = tierBtn.dataset.priceTier;
                tierByGroup.set(card.dataset.groupKey, tier);
                card.dataset.priceTier = tier;
                refreshTotemProductCard(card);
                bumpIdle();
                return;
            }
            const plus = e.target.closest('.totem-plus');
            const minus = e.target.closest('.totem-minus');
            if (plus) {
                addItem(plus.dataset.cartKey, plus.dataset.itemKey);
                return;
            }
            if (minus) {
                changeQty(minus.dataset.cartKey, -1);
                return;
            }
            const card = e.target.closest('.totem-product');
            if (card?.dataset?.itemKey) {
                openProductDetail(card.dataset.itemKey);
            }
        });

        detailPanel?.addEventListener('click', (e) => {
            if (e.target === detailPanel) {
                closeProductDetail();
                return;
            }
            if (e.target.closest('#totem-detail-back')) {
                closeProductDetail();
                return;
            }
            const tierBtn = e.target.closest('.ze-price-tier');
            if (tierBtn && detailItemKey) {
                const ctx = getDetailContext();
                if (!ctx?.group?.key) return;
                tierByGroup.set(ctx.group.key, tierBtn.dataset.priceTier);
                detailDraftQty = 1;
                renderProductDetail();
                renderProducts();
                bumpIdle();
                return;
            }
            const plus = e.target.closest('.totem-detail-plus');
            const minus = e.target.closest('.totem-detail-minus');
            const addBtn = e.target.closest('#totem-detail-add');
            if (plus) {
                detailDraftQty += 1;
                renderProductDetail();
                bumpIdle();
                return;
            }
            if (minus && detailDraftQty > 1) {
                detailDraftQty -= 1;
                renderProductDetail();
                bumpIdle();
                return;
            }
            if (addBtn) {
                addDetailToCart(addBtn.dataset.cartKey, addBtn.dataset.itemKey);
            }
        });

        cartList?.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.totem-remove');
            const plus = e.target.closest('.totem-plus');
            const minus = e.target.closest('.totem-minus');
            if (removeBtn) {
                removeFromCart(removeBtn.dataset.cartKey);
                return;
            }
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

        searchForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            setSearchQuery(searchInput?.value || '');
        });

        searchInput?.addEventListener('input', () => {
            const value = searchInput.value.trim().toLowerCase();
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => setSearchQuery(value), 180);
        });

        searchClearBtn?.addEventListener('click', () => {
            clearSearch();
            renderProducts();
            searchInput?.focus();
            totemKeyboard?.show?.();
            bumpIdle();
        });

        initSearchKeyboard();

        document.getElementById('totem-admin-cancel')?.addEventListener('click', closeAdminModal);
        document.getElementById('totem-admin-confirm')?.addEventListener('click', confirmAdminLogout);
        adminPin?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmAdminLogout();
        });

        ['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
            document.addEventListener(evt, bumpIdle, { passive: true });
        });

        window.addEventListener('resize', () => updateViewSwitcher(), { passive: true });
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
            window.LigeirinhoMktPromos?.warmCache?.() ?? Promise.resolve(),
        ]);
        totemConfig = await configRes.json();
        unitSettings = resolveUnitSettings();
        catalogData = filterCatalog(rawCatalog);
        pricing.rebuildGroups?.(catalogData);
        displayItems = buildDisplayItems();
        normalizeDisplayItems();
        attachSearchIndex(displayItems);
        totemCategories = buildTotemCategories();
        if (totemCategories[0]) {
            activeCategory = totemCategories[0].id;
        }

        bindEvents();
        renderCategories();
        renderProducts();
        renderCart();
        await window.LigeirinhoTotemPromos?.init?.({
            gridEl: document.getElementById('totem-promos-grid'),
            emptyEl: document.getElementById('totem-promos-empty'),
            loadingEl: document.getElementById('totem-promos-loading'),
            errorEl: document.getElementById('totem-promos-error'),
            retryBtn: document.getElementById('totem-promos-retry'),
            onBumpIdle: bumpIdle,
        });
        if (promosBtn) promosBtn.hidden = false;
        resetIdleTimer();

        const returnParams = new URLSearchParams(window.location.search);
        if (returnParams.get('cart') === 'open') {
            if (!cartApi.cartItemCount(cartApi.loadCart())) {
                cartApi.restoreLastOrder?.();
            }
            renderCart();
            setView('catalog');
            openCart();
            returnParams.delete('cart');
            const qs = returnParams.toString();
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
            );
        }
    };

    init();
})();
