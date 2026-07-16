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
    const customerManualEmailInput = document.getElementById('totem-customer-manual-email');
    const customerManualDocInput = document.getElementById('totem-customer-manual-doc');
    const customerContactTabs = document.getElementById('totem-customer-contact-tabs');
    const customerError = document.getElementById('totem-customer-error');
    const customerBackBtn = document.getElementById('totem-customer-back');
    const customerContinueBtn = document.getElementById('totem-customer-continue');
    const customerSteps = {
        register: document.getElementById('totem-customer-step-register'),
        login: document.getElementById('totem-customer-step-login'),
        lookup: document.getElementById('totem-customer-step-lookup'),
        confirm: document.getElementById('totem-customer-step-confirm'),
        manual: document.getElementById('totem-customer-step-manual'),
        invoice: document.getElementById('totem-customer-step-invoice'),
        cpf: document.getElementById('totem-customer-step-cpf'),
    };
    const customerCpfForm = document.getElementById('totem-customer-cpf-form');
    const customerCpfInput = document.getElementById('totem-customer-cpf-input');
    const customerCpfError = document.getElementById('totem-customer-cpf-error');
    const cpfApi = window.LigeirinhoCpf;
    const cnpjApi = window.LigeirinhoCnpj;

    const contactDigits = (value) => String(value || '').replace(/\D/g, '');

    const looksLikePhoneDigits = (digits) => {
        const d = contactDigits(digits);
        if (d.length === 10) return true;
        if (d.length === 11 && d[2] === '9') return true;
        return false;
    };

    const sanitizeCustomerPhone = (phone, cpf = '', cnpj = '') => {
        const raw = String(phone || '').trim();
        const phoneDigits = contactDigits(raw);
        if (!phoneDigits || !looksLikePhoneDigits(phoneDigits)) return '';
        const cpfDigits = contactDigits(cpf);
        const cnpjDigits = contactDigits(cnpj);
        if (cpfDigits && phoneDigits === cpfDigits) return '';
        if (cnpjDigits && phoneDigits === cnpjDigits) return '';
        return raw;
    };

    const customerLookupForm = document.getElementById('totem-customer-lookup-form');
    const customerLookupInput = document.getElementById('totem-customer-lookup-input');
    const customerLookupError = document.getElementById('totem-customer-lookup-error');
    const customerLookupLead = document.getElementById('totem-customer-lookup-lead');
    const customerLookupLabel = document.getElementById('totem-customer-lookup-label-text');
    const customerLookupTitle = document.getElementById('totem-customer-lookup-title');
    const customerLookupSubmit = document.getElementById('totem-customer-lookup-submit');
    const customerConfirmName = document.getElementById('totem-customer-confirm-name');
    const customerConfirmHint = document.getElementById('totem-customer-confirm-hint');
    const customerConfirmCardName = document.getElementById('totem-customer-confirm-card-name');
    const customerManualEyebrow = document.getElementById('totem-customer-manual-eyebrow');
    const customerManualTitle = document.getElementById('totem-customer-manual-title');
    const customerManualLead = document.getElementById('totem-customer-manual-lead');
    const logoBtn = document.getElementById('totem-logo-btn');
    const promosBtn = document.getElementById('totem-promos-btn');
    const syncBtn = document.getElementById('totem-sync-btn');
    const adminEditBtn = document.getElementById('totem-admin-edit-btn');
    const refreshBtn = document.getElementById('totem-refresh-btn');
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
    const headerActions = document.getElementById('totem-header-actions');
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
    const productsEyebrow = document.getElementById('totem-products-eyebrow');
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
    const idleCountdownEl = document.getElementById('totem-idle-countdown');
    const adminModal = document.getElementById('totem-admin-modal');
    const adminPin = document.getElementById('totem-admin-pin');
    const detailPanel = document.getElementById('totem-product-detail');
    const detailSheet = detailPanel?.querySelector('.totem-detail__sheet');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) => catalog.escapeHtml(String(s ?? ''));

    let catalogData = null;
    let rawCatalogData = null;
    let displayItems = [];
    const CATALOG_API_URL = '/api/totem/catalog';
    let promoCatalogItems = [];
    let promoDisplayItems = [];
    let promoCatalogCartKeys = new Set();
    let promoCatalogProductIds = new Set();
    let promoCatalogGroupKeys = new Set();
    let promoCatalogHubIds = new Set();
    let promoOffersByCartKey = new Map();
    let promoOffersByItemKey = new Map();

    const loadTotemCatalog = (options = {}) =>
        window.LigeirinhoCatalogLoader.load({ ...options, apiUrl: CATALOG_API_URL });

    let totemCategories = [];
    let activeCategory = '';
    let totemConfig = { defaults: {}, units: {}, loginUnitMap: {} };
    let unitSettings = null;
    let storeHiddenProductIds = new Set();
    let idlePaused = false;
    let unbindActivity = null;
    let sessionTimeout = null;
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
    let detailPromoOpts = null;
    let promosReturnView = 'welcome';
    let customerIdentified = false;
    let customerSkippedIdentification = false;
    let syncBusy = false;
    let refreshBusy = false;
    let totemCustomer = { name: '', phone: '', email: '', cpf: '', cnpj: '', pessoaId: '' };
    let customerStep = 'register';
    let customerLookupMode = 'doc';
    let customerManualContactMode = 'phone';
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

    const packLabelForTier = (tier) => {
        if (tier === 'pallet') return 'PALLET';
        if (tier === 'caixa') return 'CAIXA';
        return 'UNIDADE';
    };

    const mediaPackTagHtml = (variant, tier) => {
        if (!variant) return '';
        const activeTier = tier || variant.tier || 'caixa';
        const label = packLabelForTier(activeTier);
        const aria = `Embalagem ${label}`;
        return `<span class="totem-product__pack-tag" aria-label="${esc(aria)}"><span class="totem-product__pack-tag-label">${esc(label)}</span></span>`;
    };

    const mediaCartBadgeHtml = (qty) =>
        qty
            ? `<span class="totem-product__badge totem-product__cart-badge" aria-label="${qty} no carrinho">${qty}</span>`
            : '';

    const getDetailContext = () => {
        if (!detailItemKey) return null;
        const item = findDisplayItem(null, detailItemKey);
        if (!item) return null;
        const group = item.group;
        const tier =
            detailPromoOpts?.tier || (group ? activeTierFor(group) : item.defaultTier || 'caixa');
        const variant = group ? pricing.getVariant(group, tier) : null;
        const product = item.product;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const cart = cartApi.loadCart();
        const qty = cart[cartKey]?.qty || 0;
        const img = catalog.productImageUrl(group ? pricing.getTierImage(group, tier) : product.image);
        const displayName = group
            ? pricing.cartItemName({ ...variant, tier }, group)
            : product.name;
        const catalogPrice = Number((variant || product).price);
        const price =
            detailPromoOpts?.promoPrice != null && Number.isFinite(Number(detailPromoOpts.promoPrice))
                ? Number(detailPromoOpts.promoPrice)
                : catalogPrice;
        const promoOriginal =
            detailPromoOpts?.promoPrice != null
                ? Number(detailPromoOpts.originalPrice ?? catalogPrice)
                : null;
        return { item, group, tier, variant, product, cartKey, qty, img, displayName, price, promoOriginal };
    };

    const detailTierLabel = (tierKey, variant) => {
        if (tierKey === 'unidade') return 'Unidade';
        if (tierKey === 'caixa') {
            return variant?.packSize ? `Caixa c/ ${variant.packSize} un` : 'Caixa';
        }
        if (tierKey === 'pallet') {
            return variant?.boxCount ? `Pallet · ${variant.boxCount} cx` : 'Pallet';
        }
        return 'Produto';
    };

    const isDetailPromoContext = () =>
        detailPromoOpts?.promoId != null ||
        (detailPromoOpts?.promoPrice != null && Number.isFinite(Number(detailPromoOpts.promoPrice)));

    const detailTierPromoOpts = (tierKey) => {
        if (!isDetailPromoContext()) return null;
        const tiers = detailPromoOpts?.tiers;
        if (tiers?.[tierKey]?.promoId) return tiers[tierKey];
        if (detailPromoOpts?.tier === tierKey && detailPromoOpts?.promoId) {
            return {
                promoPrice: detailPromoOpts.promoPrice,
                promoId: detailPromoOpts.promoId,
                originalPrice: detailPromoOpts.originalPrice,
            };
        }
        return null;
    };

    const buildDetailPriceBlocks = (ctx) => {
        const { group, tier, variant, product } = ctx;
        const promoDetail = isDetailPromoContext();
        const blocks = [];

        const pushVariant = (tierKey, v) => {
            const tierPromo = detailTierPromoOpts(tierKey);
            if (!v && !tierPromo) return;
            const refVariant =
                (group ? pricing.getVariant(group, tierKey) : null) ||
                (v ? { ...v, tier: v.tier || tierKey } : null) ||
                (tierPromo
                    ? {
                          id: product?.id,
                          price: tierPromo.originalPrice ?? product?.price ?? 0,
                          tier: tierKey,
                      }
                    : null);
            if (!refVariant) return;
            const isPromoTier = Boolean(tierPromo);
            const blockPrice = isPromoTier ? Number(tierPromo.promoPrice) : Number(refVariant.price);
            const perUnit =
                tierKey === 'caixa' || tierKey === 'pallet'
                    ? (() => {
                          const unitPx = pricing.getUnitPrice({
                              ...refVariant,
                              price: blockPrice,
                              tier: tierKey,
                          });
                          return unitPx != null ? `${formatPrice(unitPx)} / un` : null;
                      })()
                    : null;
            blocks.push({
                tier: tierKey,
                label: detailTierLabel(tierKey, refVariant),
                price: blockPrice,
                originalPrice: isPromoTier ? Number(tierPromo.originalPrice ?? refVariant.price) : null,
                promo: isPromoTier,
                promoOpts: tierPromo,
                perUnit,
                variant: refVariant,
                actionable: true,
            });
        };

        if (group?.variants) {
            if (group.variants.unidade) pushVariant('unidade', group.variants.unidade);
            if (group.variants.caixa) pushVariant('caixa', group.variants.caixa);
            else if (group.variants.pallet) pushVariant('pallet', group.variants.pallet);
        } else if (variant || product) {
            const activeTier = tier || 'unidade';
            const refVariant = variant || { id: product.id, price: product.price, tier: activeTier };
            pushVariant(activeTier, refVariant);
        }

        if (promoDetail) {
            const promoTierKeys = detailPromoOpts?.tiers ? Object.keys(detailPromoOpts.tiers) : [];
            if (promoTierKeys.length) {
                promoTierKeys.forEach((tierKey) => {
                    if (blocks.some((b) => b.tier === tierKey)) return;
                    pushVariant(tierKey, group ? pricing.getVariant(group, tierKey) : null);
                });
            } else if (group) {
                ['unidade', 'caixa', 'pallet'].forEach((tierKey) => {
                    if (blocks.some((b) => b.tier === tierKey)) return;
                    const tierPromo = detailTierPromoOpts(tierKey);
                    if (!tierPromo?.promoId) return;
                    pushVariant(tierKey, pricing.getVariant(group, tierKey));
                });
            }

            if (detailPromoOpts?.multiplo && group?.variants) {
                ['unidade', 'caixa', 'pallet'].forEach((tierKey) => {
                    if (!group.variants[tierKey]) return;
                    if (blocks.some((b) => b.tier === tierKey)) return;
                    pushVariant(tierKey, group.variants[tierKey]);
                });
            }
        }

        const order = { unidade: 0, caixa: 1, pallet: 2 };
        blocks.sort((a, b) => (order[a.tier] ?? 9) - (order[b.tier] ?? 9));
        return blocks;
    };

    const buildDetailPriceBlocksHtml = (blocks, activeTier) =>
        blocks
            .map((block) => {
                const isPack = block.tier === 'caixa' || block.tier === 'pallet';
                const mod = isPack ? 'pack' : 'unit';
                const active = block.tier === activeTier ? ' totem-detail__price-block--active' : '';
                const promo = block.promo ? ' totem-detail__price-block--promo' : '';
                const info = block.actionable === false ? ' totem-detail__price-block--info' : '';
                const oldHtml =
                    block.originalPrice != null &&
                    Number.isFinite(block.originalPrice) &&
                    block.originalPrice > block.price
                        ? `<span class="totem-detail__price-old">${formatPrice(block.originalPrice)}</span>`
                        : '';
                const promoBadge = block.promo
                    ? '<span class="totem-detail__promo-badge">PROMO</span><span class="totem-detail__pay-tag">Pix/Dinheiro</span>'
                    : '';
                const perUnit = block.perUnit
                    ? `<span class="totem-detail__price-per">${esc(block.perUnit)}</span>`
                    : '';
                const selectable =
                    block.actionable !== false
                        ? ` data-price-tier="${esc(block.tier)}" role="button" tabindex="0" aria-pressed="${block.tier === activeTier ? 'true' : 'false'}" aria-label="Adicionar ${esc(block.label)} ao pedido"`
                        : ` aria-label="${esc(block.label)} — apenas informativo"`;
                return `<div class="totem-detail__price-block totem-detail__price-block--${mod}${active}${promo}${info}"${selectable}>
<span class="totem-detail__price-label">${esc(block.label)}</span>
<div class="totem-detail__price-row">
${oldHtml}
<strong class="totem-detail__price-value">${formatPrice(block.price)}</strong>
${promoBadge}
</div>
${perUnit}
</div>`;
            })
            .join('');

    const closeProductDetail = () => {
        if (!detailPanel) return;
        detailPanel.classList.add('totem-detail--closing');
        detailPanel.classList.remove('totem-detail--open');
        window.setTimeout(() => {
            detailPanel.classList.remove('totem-detail--closing');
            detailPanel.setAttribute('aria-hidden', 'true');
            detailItemKey = null;
            detailDraftQty = 1;
            detailPromoOpts = null;
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
        const returnable = isReturnable(group?.baseName || displayName);
        const vol = extractVolume(group?.baseName || displayName);
        const packBadge = tierPackBadge(tier, variant);
        const detailTitle = String(group?.baseName || product.name || displayName)
            .trim()
            .toUpperCase();
        const priceBlocks = buildDetailPriceBlocks(ctx);
        const priceBlocksHtml = buildDetailPriceBlocksHtml(priceBlocks, tier);

        detailSheet.innerHTML = `<header class="totem-detail__header">
<button type="button" class="totem-detail__back" id="totem-detail-back" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="totem-detail__heading" id="totem-detail-heading">Detalhes do Produto</h1>
</header>
<div class="totem-detail__body">
<h2 class="totem-detail__name">${esc(detailTitle)}</h2>
<div class="totem-detail__showcase">
<div class="totem-detail__media">
${returnable ? '<span class="totem-detail__badge totem-detail__badge--return">Retornável</span>' : ''}
${vol ? `<span class="totem-detail__badge totem-detail__badge--vol">${esc(vol)}</span>` : ''}
${packBadge ? `<span class="totem-detail__badge totem-detail__badge--pack">${esc(packBadge)}</span>` : ''}
${img ? `<img src="${esc(img)}" alt="">` : '<span class="material-symbols-outlined totem-detail__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-detail__price-stack" role="group" aria-label="Opções de preço">
${priceBlocksHtml}
</div>
</div>
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

    const openProductDetail = (itemKey, promoOpts = null) => {
        if (!detailPanel || !detailSheet || !itemKey) return;
        totemKeyboard?.hide?.();
        detailItemKey = itemKey;
        detailPromoOpts = promoOpts;
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

    const playDetailBlockAddedFeedback = (blockEl, qty = 1) => {
        if (!blockEl) return;
        blockEl.classList.remove('totem-detail__price-block--press');
        blockEl.classList.add('totem-detail__price-block--added');

        blockEl.querySelectorAll('.totem-detail__price-block__ripple, .totem-detail__price-block__success').forEach((n) =>
            n.remove()
        );

        const ripple = document.createElement('span');
        ripple.className = 'totem-detail__price-block__ripple';
        ripple.setAttribute('aria-hidden', 'true');
        blockEl.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });

        const overlay = document.createElement('div');
        overlay.className = 'totem-detail__price-block__success';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        const qtyLine =
            qty > 1
                ? `<span class="totem-detail__price-block__success-qty">${qty} un. no carrinho</span>`
                : '';
        overlay.innerHTML = `<span class="material-symbols-outlined totem-detail__price-block__check" aria-hidden="true">check_circle</span>
<span class="totem-detail__price-block__success-text">Adicionado!</span>
${qtyLine}`;
        blockEl.appendChild(overlay);

        window.setTimeout(() => {
            blockEl.classList.remove('totem-detail__price-block--added');
            overlay.remove();
        }, 920);
    };

    const showCartAddedToast = (productName, imageUrl, qty = 1) => {
        const toast = document.getElementById('totem-cart-toast');
        const nameEl = document.getElementById('totem-cart-toast-name');
        const thumbEl = document.getElementById('totem-cart-toast-thumb');
        const titleEl = toast?.querySelector('.totem-cart-toast__title');
        if (!toast) return;

        if (titleEl) {
            titleEl.textContent =
                qty > 1 ? `${qty} itens adicionados ao carrinho` : 'Adicionado ao carrinho';
        }
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
        const iconEl = toast.querySelector('.totem-cart-toast__icon');
        if (iconEl) pulseClass(iconEl, 'totem-cart-toast__icon--pop');
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
        const preferred = tierByGroup.get(group.key);
        if (preferred && group.variants?.[preferred]?.price != null) return preferred;

        // Preferência: embalagem que está em promoção.
        for (const tier of ['caixa', 'unidade']) {
            const variant = group.variants?.[tier];
            if (!variant || variant.price == null) continue;
            const key = catalog.cartKeyFor({ ...variant, tier });
            if (promoOffersByCartKey.has(key)) return tier;
        }

        const fallback =
            pricing.getTotemDefaultTier(group) ||
            pricing.getDefaultTier(group) ||
            'caixa';
        if (group.variants?.[fallback]?.price != null) return fallback;
        if (group.variants?.caixa?.price != null) return 'caixa';
        if (group.variants?.unidade?.price != null) return 'unidade';
        if (group.variants?.pallet?.price != null) return 'pallet';
        return fallback;
    };

    const priceTiersHtml = (group, activeTier) => {
        if (!group) return '';
        const tiers =
            pricing.getTotemAvailableTiers?.(group) ||
            pricing.getAvailableTiers(group) ||
            [];
        if (tiers.length <= 1) return '';
        const buttons = tiers
            .map((tier) => {
                const active = tier === activeTier;
                const variant = pricing.getVariant(group, tier);
                const cartKey = variant ? catalog.cartKeyFor(variant) : '';
                const offer = resolvePromoOffer(cartKey, group.key, tier);
                const label =
                    pricing.TIER_LABELS?.[tier]?.toUpperCase() ||
                    (tier === 'caixa' ? 'CAIXA' : tier === 'unidade' ? 'UNIDADE' : String(tier).toUpperCase());
                const promoClass = offer?.promoId ? ' ze-price-tier--promo' : '';
                const promoMark = offer?.promoId
                    ? `<span class="ze-price-tier__promo">${offer.discountPct > 0 ? `-${offer.discountPct}%` : 'PROMO'}</span>`
                    : '';
                return `<button type="button" class="ze-price-tier${active ? ' ze-price-tier--active' : ''}${promoClass}" data-price-tier="${esc(tier)}" aria-pressed="${active ? 'true' : 'false'}" aria-label="${esc(label)}${offer?.discountPct > 0 ? ` em promoção -${offer.discountPct}%` : offer?.promoId ? ' em promoção' : ''}">${esc(label)}${promoMark}</button>`;
            })
            .join('');
        return `<div class="ze-price-tiers-slot"><div class="ze-price-tiers" role="group" aria-label="Escolher embalagem">${buttons}</div></div>`;
    };

    const priceBlockHtml = (variant, opts = {}) => {
        if (!variant) return '';
        const meta = pricing.pricePackMeta(variant);
        const catalogPrice = meta.packagePrice ?? variant.price;
        const packPrice =
            opts.promoPrice != null && Number.isFinite(Number(opts.promoPrice))
                ? Number(opts.promoPrice)
                : catalogPrice;
        const originalPrice =
            opts.originalPrice != null && Number.isFinite(Number(opts.originalPrice))
                ? Number(opts.originalPrice)
                : catalogPrice;
        const showOld = originalPrice > packPrice;
        const discountPct =
            opts.discountPct != null && Number.isFinite(Number(opts.discountPct))
                ? Number(opts.discountPct)
                : showOld
                  ? Math.max(0, Math.round((1 - packPrice / originalPrice) * 100))
                  : 0;
        const units = Math.max(1, Number(variant.packSize) || 1);
        const unitPrice =
            units > 1 ? Math.round((packPrice / units) * 100) / 100 : null;
        const showUnitBreakdown = units > 1 && unitPrice != null;
        const packLabel =
            meta.tierLabel ||
            (variant.tier === 'pallet' ? 'Pallet' : variant.tier === 'caixa' ? 'Caixa' : 'Unidade');
        const packHtml = opts.hidePackLabel
            ? ''
            : `<span class="totem-price-card__pack totem-price-card__pack--inline">${esc(packLabel)}</span>`;
        const oldHtml = showOld
            ? `<span class="totem-product__price-old">${formatPrice(originalPrice)}</span>`
            : '';
        const badgeHtml =
            discountPct > 0
                ? `<span class="totem-product__promo-badge">-${discountPct}%</span>`
                : opts.promoId
                  ? '<span class="totem-product__promo-badge">PROMO</span>'
                  : '';

        const detailHtml = `<p class="totem-price-card__detail">${units > 1 && meta.detail ? esc(meta.detail) : ''}</p>`;
        const unitHtml = `<p class="totem-price-card__unit">${
            showUnitBreakdown ? `${formatPrice(unitPrice)}<span> / un</span>` : ''
        }</p>`;

        return `<div class="totem-price-card ze-price-block totem-product__price-block${opts.promoId ? ' totem-product__price-block--promo' : ''}" data-price-display>
<div class="totem-price-card__main">
${oldHtml}
<span class="totem-product__price totem-price-card__value">${formatPrice(packPrice)}</span>
${badgeHtml}
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

        const badge = card.querySelector('.totem-product__cart-badge');
        if (qty > 0) {
            if (badge) {
                badge.textContent = String(qty);
                badge.setAttribute('aria-label', `${qty} no carrinho`);
            } else {
                const media = card.querySelector('.totem-product__media');
                if (media) {
                    media.insertAdjacentHTML(
                        'beforeend',
                        `<span class="totem-product__badge totem-product__cart-badge" aria-label="${qty} no carrinho">${qty}</span>`
                    );
                }
            }
        } else if (badge) {
            badge.remove();
        }

        const priceEl = card.querySelector('.totem-product__price');
        const offer = resolvePromoOffer(cartKey, card.dataset.itemKey, tier);
        if (priceEl && !card.querySelector('[data-price-display]')) {
            priceEl.textContent = formatPrice(offer?.promoPrice ?? variant.price);
        } else {
            updatePriceBlock(card, variant, {
                hidePackLabel: true,
                promoId: offer?.promoId,
                promoPrice: offer?.promoPrice,
                originalPrice: offer?.originalPrice,
                discountPct: offer?.discountPct,
            });
        }
        card.classList.toggle('totem-product--promo', Boolean(offer?.promoId));
        const payTag = card.querySelector('.totem-product__pay-tag');
        if (offer?.promoId && !payTag) {
            card.querySelector('.totem-product__media')?.insertAdjacentHTML(
                'afterbegin',
                `<span class="totem-product__pay-tag" aria-label="Pagamento apenas Pix ou Dinheiro"><span class="totem-product__pay-tag-label">Pix/Dinheiro</span></span>`,
            );
        } else if (!offer?.promoId && payTag) {
            payTag.remove();
        }

        const packTag = card.querySelector('.totem-product__pack-tag');
        const hasTierSelector = card.querySelectorAll('.ze-price-tier').length > 1;
        if (hasTierSelector) {
            packTag?.remove();
        } else if (packTag && variant) {
            const label = packLabelForTier(tier);
            const labelEl = packTag.querySelector('.totem-product__pack-tag-label');
            if (labelEl) labelEl.textContent = label;
            packTag.setAttribute('aria-label', `Embalagem ${label}`);
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
            plus.dataset.priceTier = tier;
        }
        if (qtyEl) qtyEl.textContent = String(qty);

        card.querySelectorAll('.ze-price-tier').forEach((btn) => {
            const btnTier = btn.dataset.priceTier;
            const isActive = btnTier === tier;
            const btnVariant = pricing.getVariant(group, btnTier);
            const btnKey = btnVariant ? catalog.cartKeyFor(btnVariant) : '';
            const btnOffer = resolvePromoOffer(btnKey, group.key, btnTier);
            btn.classList.toggle('ze-price-tier--active', isActive);
            btn.classList.toggle('ze-price-tier--promo', Boolean(btnOffer?.promoId));
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            let promoMark = btn.querySelector('.ze-price-tier__promo');
            if (btnOffer?.promoId) {
                const text =
                    btnOffer.discountPct > 0 ? `-${btnOffer.discountPct}%` : 'PROMO';
                if (promoMark) promoMark.textContent = text;
                else {
                    promoMark = document.createElement('span');
                    promoMark.className = 'ze-price-tier__promo';
                    promoMark.textContent = text;
                    btn.appendChild(promoMark);
                }
            } else if (promoMark) {
                promoMark.remove();
            }
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

    const resolveStoreKey = () => {
        const s = session();
        const login = String(s?.login || '').trim();
        if (login) return login.toLowerCase().replace(/\s+/g, '-');
        const mapped = totemConfig.loginUnitMap?.[s?.login] || totemConfig.loginUnitMap?.[s?.email];
        const unitId = s?.totemUnitId || mapped || 'default';
        return String(unitId).trim().toLowerCase().replace(/\s+/g, '-');
    };

    const applyCatalogFromRaw = (rawCatalog) => {
        rawCatalogData = rawCatalog;
        catalogData = filterCatalog(rawCatalog);
        pricing.rebuildGroups?.(catalogData);
        displayItems = buildDisplayItems();
        promoCatalogItems = buildPromoCatalogItems();
        normalizeDisplayItems();
        attachSearchIndex(displayItems);
        totemCategories = buildTotemCategories();
        renderCategories();
        updateCategoriesBtnLabel();
        renderProducts();
        refreshProductGrid();
        refreshDetailIfOpen();
    };

    const applyStoreHiddenIds = (ids) => {
        storeHiddenProductIds = new Set((ids || []).map((id) => String(id).trim()).filter(Boolean));
        if (rawCatalogData) applyCatalogFromRaw(rawCatalogData);
        window.LigeirinhoTotemPromos?.refresh?.();
    };
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

        merged.sort((a, b) => {
            const labelA = catalog.formatCategoryLabel(a.name);
            const labelB = catalog.formatCategoryLabel(b.name);
            return labelA.localeCompare(labelB, 'pt-BR', { sensitivity: 'base' });
        });
        return merged;
    };

    const normalizeDisplayItems = () => {
        displayItems = displayItems.map((item) => ({
            ...item,
            categoryId: canonCategoryId(item.categoryId),
            categoryName: canonCategoryName(item.categoryId, item.categoryName),
        }));
    };

    const isTotemSellableProduct = (product) => {
        if (!product) return false;
        if (product.vendaParceiros === false) return false;
        const price = Number(product.price);
        if (!Number.isFinite(price) || price <= 0) return false;
        const pack = pricing.parsePack?.(product);
        return pack?.type === 'caixa' || pack?.type === 'unidade';
    };

    const filterCatalog = (data) => {
        const hiddenCats = new Set((unitSettings?.hiddenCategories || []).map((c) => String(c).toLowerCase()));
        const hiddenIds = new Set([
            ...(unitSettings?.hiddenProductIds || []),
            ...storeHiddenProductIds,
        ]);
        const categories = (data.categories || [])
            .filter((cat) => !hiddenCats.has(String(cat.id).toLowerCase()))
            .map((cat) => ({
                ...cat,
                products: (cat.products || []).filter(
                    (p) => !hiddenIds.has(p.id) && isTotemSellableProduct(p),
                ),
            }))
            .filter((cat) => cat.products.length > 0);
        return { ...data, categories, totalProducts: categories.reduce((n, c) => n + c.products.length, 0) };
    };

    const buildDisplayItems = () => {
        if (!catalogData) return [];
        return pricing.getTotemDisplayProducts(catalogData, window.__ligProductGroups);
    };

    const buildPromoCatalogItems = () => {
        if (!rawCatalogData) return [];
        const items = [];
        rawCatalogData.categories.forEach((cat) => {
            cat.products.forEach((product) => {
                const price = Number(product.price);
                if (!Number.isFinite(price) || price <= 0) return;
                const pack = pricing.parsePack?.(product);
                const baseProduct = {
                    id: product.id,
                    hubId: product.hubId,
                    sku: product.sku,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    adultOnly: product.adultOnly,
                    description: product.description,
                    unidade: product.unidade,
                    fatorMultiplicacao: product.fatorMultiplicacao,
                };
                const categoryFields = {
                    categoryId: canonCategoryId(cat.id),
                    categoryName: canonCategoryName(cat.id, cat.name),
                };
                if (pack?.type === 'unidade') {
                    items.push({
                        product: baseProduct,
                        group: null,
                        defaultTier: 'unidade',
                        ...categoryFields,
                    });
                    return;
                }
                if (!isTotemSellableProduct(product)) return;
                items.push({
                    product: baseProduct,
                    group: null,
                    ...categoryFields,
                });
            });
        });
        return items;
    };

    const registerPromoDisplayItems = (items = []) => {
        promoDisplayItems = Array.isArray(items) ? items.filter(Boolean) : [];
    };

    const registerPromoCatalogExclusions = (exclusions = {}) => {
        const toSet = (value) =>
            value instanceof Set ? value : new Set(Array.isArray(value) ? value.filter(Boolean) : []);
        const toMap = (value) =>
            value instanceof Map
                ? value
                : new Map(value && typeof value === 'object' ? Object.entries(value) : []);
        promoCatalogCartKeys = toSet(exclusions.cartKeys);
        promoCatalogProductIds = toSet(exclusions.productIds);
        promoCatalogGroupKeys = toSet(exclusions.groupKeys);
        promoCatalogHubIds = toSet(exclusions.hubIds);
        promoOffersByCartKey = toMap(exclusions.byCartKey);
        promoOffersByItemKey = toMap(exclusions.byItemKey);
    };

    const cartKeyForDisplayItem = (item) => {
        const group = item.group || null;
        const product = item.product;
        const tier = group ? activeTierFor(group) : item.defaultTier || 'caixa';
        const variant = group ? pricing.getVariant(group, tier) : null;
        return variant ? catalog.cartKeyFor(variant) : product.id;
    };

    const isPromoCatalogItem = (item) => {
        if (promoCatalogCartKeys.has(cartKeyForDisplayItem(item))) return true;
        const product = item.product;
        const group = item.group;
        if (product?.id && promoCatalogProductIds.has(product.id)) return true;
        if (group?.key && promoCatalogGroupKeys.has(group.key)) return true;
        if (product?.hubId && promoCatalogHubIds.has(String(product.hubId).trim())) return true;
        if (group?.variants) {
            for (const variant of Object.values(group.variants)) {
                if (variant?.id && promoCatalogProductIds.has(variant.id)) return true;
                if (variant?.hubId && promoCatalogHubIds.has(String(variant.hubId).trim())) return true;
            }
        }
        return false;
    };

    const resolvePromoOffer = (cartKey, itemKey, tier) => {
        if (cartKey && promoOffersByCartKey.has(cartKey)) {
            const byCart = promoOffersByCartKey.get(cartKey);
            if (!tier || !byCart?.tier || byCart.tier === tier) return byCart;
        }
        const byItem = itemKey ? promoOffersByItemKey.get(itemKey) : null;
        if (!byItem) return null;
        if (tier) {
            const tierOffer = byItem.tiers?.[tier];
            if (!tierOffer) return null;
            return {
                promoId: tierOffer.promoId,
                promoPrice: tierOffer.promoPrice,
                originalPrice: tierOffer.originalPrice,
                discountPct:
                    tierOffer.originalPrice > tierOffer.promoPrice
                        ? Math.max(
                              0,
                              Math.round((1 - tierOffer.promoPrice / tierOffer.originalPrice) * 100),
                          )
                        : 0,
                tier,
                tiers: byItem.tiers,
                multiplo: byItem.multiplo,
            };
        }
        return byItem;
    };

    const promoAddOpts = (offer) => {
        if (!offer?.promoId || offer.promoPrice == null) return null;
        return {
            promoId: offer.promoId,
            promoPrice: offer.promoPrice,
            promoOriginalPrice: offer.originalPrice,
            tier: offer.tier,
        };
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

    const LOOKUP_COPY = {
        doc: {
            title: 'Como podemos te achar?',
            lead: 'Digite seu telefone, CPF ou CNPJ cadastrado na Ligeirinho.',
            label: 'Telefone, CPF ou CNPJ',
            placeholder: '(00) 00000-0000 ou documento',
            maxlength: 18,
        },
        email: {
            title: 'Qual é o seu e-mail?',
            lead: 'Digite o e-mail cadastrado na Ligeirinho (Gmail, Outlook etc.).',
            label: 'E-mail',
            placeholder: 'seu@email.com',
            maxlength: 120,
        },
    };

    const isValidEmail = (raw) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(raw || '').trim());

    const setCustomerLookupCopy = (mode) => {
        customerLookupMode = mode === 'email' ? 'email' : 'doc';
        const copy = LOOKUP_COPY[customerLookupMode];
        if (customerLookupTitle) customerLookupTitle.textContent = copy.title;
        if (customerLookupLead) customerLookupLead.textContent = copy.lead;
        if (customerLookupLabel) customerLookupLabel.textContent = copy.label;
        if (customerLookupInput) {
            customerLookupInput.placeholder = copy.placeholder;
            customerLookupInput.maxLength = copy.maxlength;
            customerLookupInput.setAttribute('autocomplete', customerLookupMode === 'email' ? 'email' : 'off');
        }
    };

    const startCustomerLookup = (mode) => {
        setCustomerLookupCopy(mode);
        if (customerLookupInput) customerLookupInput.value = '';
        showLookupError('');
        showCustomerStep('lookup');
    };

    const lookupKeyboardMode = () => (customerLookupMode === 'email' ? 'email' : 'numeric');

    const manualContactField = () => {
        if (customerManualContactMode === 'email') return customerManualEmailInput;
        if (customerManualContactMode === 'doc') return customerManualDocInput;
        return customerPhoneInput;
    };

    const setManualContactMode = (mode, { focus = false } = {}) => {
        customerManualContactMode = mode === 'email' || mode === 'doc' ? mode : 'phone';
        customerContactTabs?.querySelectorAll('[data-manual-contact]').forEach((tab) => {
            const active = tab.getAttribute('data-manual-contact') === customerManualContactMode;
            tab.classList.toggle('totem-customer__contact-tab--active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.querySelectorAll('[data-manual-contact-panel]').forEach((panel) => {
            const active = panel.getAttribute('data-manual-contact-panel') === customerManualContactMode;
            panel.hidden = !active;
            panel.classList.toggle('totem-customer__contact-panel--active', active);
        });
        if (focus) {
            window.setTimeout(() => {
                const field = manualContactField();
                field?.focus();
                bindCustomerKeyboard(field, customerManualContactMode === 'email' ? 'email' : 'numeric');
            }, 80);
        }
    };

    const formatManualDocInput = (value) => {
        const digits = String(value || '').replace(/\D/g, '');
        if (digits.length <= 11) return cpfApi?.formatCpf?.(value) || value;
        return cnpjApi?.formatCnpj?.(value) || value;
    };

    const resetCustomerForm = () => {
        totemCustomer = { name: '', phone: '', email: '', cpf: '', cnpj: '', pessoaId: '' };
        customerLookupHit = null;
        customerStep = 'register';
        customerSkippedIdentification = false;
        customerLookupMode = 'doc';
        customerManualContactMode = 'phone';
        if (customerNameInput) customerNameInput.value = '';
        if (customerPhoneInput) customerPhoneInput.value = '';
        if (customerManualEmailInput) customerManualEmailInput.value = '';
        if (customerManualDocInput) customerManualDocInput.value = '';
        if (customerLookupInput) customerLookupInput.value = '';
        if (customerCpfInput) customerCpfInput.value = '';
        setManualContactMode('phone');
        showCustomerError('');
        showLookupError('');
        showCpfError('');
        customerNameInput?.classList.remove('totem-customer__input--error');
        customerPhoneInput?.classList.remove('totem-customer__input--error');
        customerManualEmailInput?.classList.remove('totem-customer__input--error');
        customerManualDocInput?.classList.remove('totem-customer__input--error');
        customerCpfInput?.classList.remove('totem-customer__input--error');
        updateCatalogGreeting();
    };

    const showLookupError = (message) => {
        if (!customerLookupError) return;
        customerLookupError.textContent = message;
        customerLookupError.hidden = !message;
    };

    const showCpfError = (message) => {
        if (!customerCpfError) return;
        customerCpfError.textContent = message;
        customerCpfError.hidden = !message;
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
            setCustomerLookupCopy(customerLookupMode);
            window.setTimeout(() => {
                customerLookupInput?.focus();
                bindCustomerKeyboard(customerLookupInput, lookupKeyboardMode());
            }, 120);
        } else if (step === 'manual') {
            window.setTimeout(() => {
                customerNameInput?.focus();
                bindCustomerKeyboard(customerNameInput);
            }, 120);
        } else if (step === 'cpf') {
            window.setTimeout(() => {
                customerCpfInput?.focus();
                bindCustomerKeyboard(customerCpfInput, 'numeric');
            }, 120);
        } else {
            totemKeyboard?.hide?.();
        }
    };

    const parseManualDocs = () => {
        const raw = String(customerManualDocInput?.value || '');
        const digits = raw.replace(/\D/g, '');
        if (!digits) return { cpfDigits: '', cnpjDigits: '' };
        if (digits.length <= 11) {
            return { cpfDigits: cpfApi?.normalizeCpfDigits?.(raw) || digits, cnpjDigits: '' };
        }
        return { cpfDigits: '', cnpjDigits: cnpjApi?.normalizeCnpjDigits?.(raw) || digits };
    };

    const validateManualDocs = ({ optional = false } = {}) => {
        const { cpfDigits, cnpjDigits } = parseManualDocs();
        customerManualDocInput?.classList.remove('totem-customer__input--error');

        if (!cpfDigits && !cnpjDigits) {
            if (optional) return { cpf: '', cnpj: '' };
            customerManualDocInput?.classList.add('totem-customer__input--error');
            showCustomerError('Informe CPF ou CNPJ válido.');
            customerManualDocInput?.focus();
            bindCustomerKeyboard(customerManualDocInput, 'numeric');
            return null;
        }
        if (cpfDigits.length > 0 && cpfDigits.length < 11) {
            customerManualDocInput?.classList.add('totem-customer__input--error');
            showCustomerError('CPF incompleto. Informe 11 dígitos.');
            customerManualDocInput?.focus();
            bindCustomerKeyboard(customerManualDocInput, 'numeric');
            return null;
        }
        if (cpfDigits.length === 11 && !cpfApi?.isValidCpf?.(cpfDigits)) {
            customerManualDocInput?.classList.add('totem-customer__input--error');
            showCustomerError('CPF inválido. Confira os dígitos.');
            customerManualDocInput?.focus();
            bindCustomerKeyboard(customerManualDocInput, 'numeric');
            return null;
        }
        if (cnpjDigits.length > 0 && cnpjDigits.length < 14) {
            customerManualDocInput?.classList.add('totem-customer__input--error');
            showCustomerError('CNPJ incompleto. Informe 14 dígitos.');
            customerManualDocInput?.focus();
            bindCustomerKeyboard(customerManualDocInput, 'numeric');
            return null;
        }
        if (cnpjDigits.length === 14 && !cnpjApi?.isValidCnpj?.(cnpjDigits)) {
            customerManualDocInput?.classList.add('totem-customer__input--error');
            showCustomerError('CNPJ inválido. Confira os dígitos.');
            customerManualDocInput?.focus();
            bindCustomerKeyboard(customerManualDocInput, 'numeric');
            return null;
        }

        return {
            cpf: cpfDigits.length === 11 ? cpfDigits : '',
            cnpj: cnpjDigits.length === 14 ? cnpjDigits : '',
        };
    };

    const validateActiveManualContact = ({ optional = false } = {}) => {
        customerPhoneInput?.classList.remove('totem-customer__input--error');
        customerManualEmailInput?.classList.remove('totem-customer__input--error');
        customerManualDocInput?.classList.remove('totem-customer__input--error');

        if (customerManualContactMode === 'phone') {
            const phone = String(customerPhoneInput?.value || '').trim();
            const phoneDigits = contactDigits(phone);
            if (!phoneDigits) {
                if (optional) return { phone: '', email: '', cpf: '', cnpj: '' };
                customerPhoneInput?.classList.add('totem-customer__input--error');
                showCustomerError('Informe telefone com DDD.');
                customerPhoneInput?.focus();
                bindCustomerKeyboard(customerPhoneInput, 'numeric');
                return null;
            }
            if (phoneDigits.length < 10) {
                customerPhoneInput?.classList.add('totem-customer__input--error');
                showCustomerError('Informe telefone com DDD.');
                customerPhoneInput?.focus();
                bindCustomerKeyboard(customerPhoneInput, 'numeric');
                return null;
            }
            if (!looksLikePhoneDigits(phoneDigits)) {
                customerPhoneInput?.classList.add('totem-customer__input--error');
                showCustomerError('Informe telefone com DDD, não CPF ou CNPJ.');
                customerPhoneInput?.focus();
                bindCustomerKeyboard(customerPhoneInput, 'numeric');
                return null;
            }
            return { phone, email: '', cpf: '', cnpj: '' };
        }

        if (customerManualContactMode === 'email') {
            const emailRaw = String(customerManualEmailInput?.value || '').trim();
            const email = emailRaw ? emailRaw.toLowerCase() : '';
            if (!email) {
                if (optional) return { phone: '', email: '', cpf: '', cnpj: '' };
                customerManualEmailInput?.classList.add('totem-customer__input--error');
                showCustomerError('Informe um e-mail válido (ex.: nome@gmail.com).');
                customerManualEmailInput?.focus();
                bindCustomerKeyboard(customerManualEmailInput, 'email');
                return null;
            }
            if (!isValidEmail(email)) {
                customerManualEmailInput?.classList.add('totem-customer__input--error');
                showCustomerError('Informe um e-mail válido (ex.: nome@gmail.com).');
                customerManualEmailInput?.focus();
                bindCustomerKeyboard(customerManualEmailInput, 'email');
                return null;
            }
            return { phone: '', email, cpf: '', cnpj: '' };
        }

        const docs = validateManualDocs({ optional });
        if (!docs) return null;
        return { phone: '', email: '', cpf: docs.cpf, cnpj: docs.cnpj };
    };

    const manualFormHasInput = () => {
        const name = String(customerNameInput?.value || '').trim();
        const phone = String(customerPhoneInput?.value || '').trim();
        const email = String(customerManualEmailInput?.value || '').trim();
        const doc = String(customerManualDocInput?.value || '').trim();
        return Boolean(name || phone || email || doc);
    };

    const customerHasPersistData = (customer = totemCustomer) => {
        const name = String(customer?.name || '').trim();
        const phone = sanitizeCustomerPhone(customer?.phone, customer?.cpf, customer?.cnpj);
        const email = String(customer?.email || '').trim().toLowerCase();
        const cpf = String(customer?.cpf || '').replace(/\D/g, '');
        const cnpj = String(customer?.cnpj || '').replace(/\D/g, '');
        return Boolean(name && (phone.replace(/\D/g, '') || email || cpf || cnpj));
    };

    const skipCustomerIdentification = ({ skipInvoice = false } = {}) => {
        totemKeyboard?.hide?.();
        customerLookupHit = null;
        totemCustomer = { name: '', phone: '', email: '', cpf: '', cnpj: '', pessoaId: '' };
        customerSkippedIdentification = true;
        if (skipInvoice) {
            enterCatalog({ guest: true });
            return;
        }
        goInvoiceStep();
    };

    const readManualDocs = () => {
        if (customerManualContactMode !== 'doc') return { cpf: '', cnpj: '' };
        const { cpfDigits, cnpjDigits } = parseManualDocs();
        return {
            cpf: cpfDigits.length === 11 && cpfApi?.isValidCpf?.(cpfDigits) ? cpfDigits : '',
            cnpj: cnpjDigits.length === 14 && cnpjApi?.isValidCnpj?.(cnpjDigits) ? cnpjDigits : '',
        };
    };

    const customerHasCpfOnFile = () => {
        const manual = readManualDocs();
        return Boolean(String(totemCustomer.cpf || manual.cpf || '').trim());
    };

    const customerHasCnpjOnFile = () => {
        const manual = readManualDocs();
        return Boolean(String(totemCustomer.cnpj || manual.cnpj || '').trim());
    };

    const customerHasDocOnFile = () => customerHasCpfOnFile() || customerHasCnpjOnFile();

    const proceedAfterCustomerRegister = () => {
        const manual = readManualDocs();
        if (manual.cpf || manual.cnpj) {
            totemCustomer = {
                ...totemCustomer,
                cpf: manual.cpf || totemCustomer.cpf,
                cnpj: manual.cnpj || totemCustomer.cnpj,
            };
        }
        goInvoiceStep();
    };

    const goInvoiceStep = () => {
        showCpfError('');
        if (customerCpfInput) customerCpfInput.value = '';
        showCustomerStep('invoice');
        bumpIdle();
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

    const lookupPhoneFallback = () => {
        if (customerLookupMode !== 'doc') return '';
        const digits = contactDigits(customerLookupInput?.value);
        return looksLikePhoneDigits(digits) ? digits : '';
    };

    const goManualCustomer = ({ fromReject = false } = {}) => {
        if (fromReject) {
            if (customerManualEyebrow) customerManualEyebrow.textContent = 'Outro cadastro';
            if (customerManualTitle) customerManualTitle.textContent = 'Vamos identificar você';
            if (customerManualLead) {
                customerManualLead.textContent =
                    'Informe seu nome e, se quiser, um contato para reconhecermos você depois.';
            }
        } else {
            if (customerManualEyebrow) customerManualEyebrow.textContent = 'Novo cliente';
            if (customerManualTitle) customerManualTitle.textContent = 'Seja bem-vindo!';
            if (customerManualLead) {
                customerManualLead.textContent =
                    'Informe seu nome e, se quiser, um contato para reconhecermos você depois.';
            }
        }
        if (customerNameInput) customerNameInput.value = '';
        if (customerManualDocInput) customerManualDocInput.value = '';
        if (fromReject && customerLookupHit?.email) {
            if (customerManualEmailInput) customerManualEmailInput.value = customerLookupHit.email;
            if (customerPhoneInput) customerPhoneInput.value = customerLookupHit.phone || lookupPhoneFallback();
            setManualContactMode(customerLookupHit.phone ? 'phone' : 'email');
        } else if (fromReject && lookupPhoneFallback()) {
            if (customerPhoneInput) customerPhoneInput.value = customerLookupHit?.phone || lookupPhoneFallback();
            if (customerManualEmailInput) customerManualEmailInput.value = '';
            setManualContactMode('phone');
        } else {
            if (customerPhoneInput) customerPhoneInput.value = lookupPhoneFallback();
            if (customerManualEmailInput) customerManualEmailInput.value = '';
            setManualContactMode('phone');
        }
        showCustomerError('');
        showCustomerStep('manual');
    };

    const submitCustomerLookup = async () => {
        const query = String(customerLookupInput?.value || '').trim();
        if (customerLookupMode === 'email') {
            const email = query.toLowerCase();
            if (!isValidEmail(email)) {
                showLookupError('Informe um e-mail válido (ex.: nome@gmail.com).');
                customerLookupInput?.focus();
                bindCustomerKeyboard(customerLookupInput, 'email');
                return;
            }
        } else {
            const digits = query.replace(/\D/g, '');
            if (digits.length < 10) {
                showLookupError('Informe telefone, CPF ou CNPJ com pelo menos 10 dígitos.');
                customerLookupInput?.focus();
                bindCustomerKeyboard(customerLookupInput, 'numeric');
                return;
            }
        }
        if (customerLookupSubmit) customerLookupSubmit.disabled = true;
        showLookupError('');
        totemKeyboard?.hide?.();
        try {
            const payload =
                customerLookupMode === 'email'
                    ? { query: query.toLowerCase(), type: 'email' }
                    : { query, type: 'contact' };
            const res = await fetch('/api/totem/customer/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Cadastro não encontrado');
            customerLookupHit = data.customer;
            showCustomerConfirm(data.customer);
            showCustomerStep('confirm');
        } catch (err) {
            showLookupError(err.message || 'Cadastro não encontrado.');
            customerLookupInput?.focus();
            bindCustomerKeyboard(customerLookupInput, lookupKeyboardMode());
        } finally {
            if (customerLookupSubmit) customerLookupSubmit.disabled = false;
        }
    };

    const confirmCustomerIdentity = () => {
        if (!customerLookupHit?.name) return;
        totemCustomer = {
            name: customerLookupHit.name,
            phone: sanitizeCustomerPhone(
                customerLookupHit.phone,
                customerLookupHit.cpf,
                customerLookupHit.cnpj,
            ),
            email: String(customerLookupHit.email || '').trim(),
            cpf: String(customerLookupHit.cpf || '').trim(),
            cnpj: String(customerLookupHit.cnpj || '').trim(),
            pessoaId: customerLookupHit.pessoaId || '',
        };
        totemKeyboard?.hide?.();
        proceedAfterCustomerRegister();
    };

    const saveCustomerDocToHub = async () => {
        const name = String(totemCustomer.name || '').trim();
        const phone = sanitizeCustomerPhone(
            totemCustomer.phone,
            totemCustomer.cpf,
            totemCustomer.cnpj,
        );
        const email = String(totemCustomer.email || '').trim().toLowerCase();
        const cpf = String(totemCustomer.cpf || '').trim();
        const cnpj = String(totemCustomer.cnpj || '').trim();
        if (!name || (!phone.replace(/\D/g, '') && !email && !cpf.replace(/\D/g, '') && !cnpj.replace(/\D/g, ''))) {
            return { ok: false, error: 'Informe nome e pelo menos telefone, e-mail, CPF ou CNPJ.' };
        }
        try {
            const res = await fetch('/api/totem/customer/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    phone,
                    email,
                    cpf,
                    cnpj,
                    pessoaId: totemCustomer.pessoaId || customerLookupHit?.pessoaId || '',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = String(data.error || '');
                if (msg.includes('pessoas_cliente_cpf_cnpj_digits_uidx')) {
                    return { ok: false, error: 'Este CPF já está vinculado a outro cadastro.' };
                }
                return { ok: false, error: data.error || 'Não foi possível salvar o cadastro.' };
            }
            if (data.customer?.pessoaId) {
                totemCustomer.pessoaId = data.customer.pessoaId;
            }
            if (data.customer?.name) {
                totemCustomer.name = data.customer.name;
            }
            return { ok: true };
        } catch {
            return { ok: false, error: 'Falha de conexão ao salvar cadastro. Tente novamente.' };
        }
    };

    const persistTotemCustomer = async () => {
        if (totemCustomer.pessoaId || customerLookupHit?.pessoaId) {
            return saveCustomerDocToHub();
        }
        const name = String(totemCustomer.name || '').trim();
        const phone = sanitizeCustomerPhone(
            totemCustomer.phone,
            totemCustomer.cpf,
            totemCustomer.cnpj,
        );
        const email = String(totemCustomer.email || '').trim().toLowerCase();
        const cpf = String(totemCustomer.cpf || '').trim();
        const cnpj = String(totemCustomer.cnpj || '').trim();
        if (!name) return { ok: false, error: 'Informe seu nome para salvar o cadastro.' };
        if (!phone.replace(/\D/g, '') && !email && !cpf.replace(/\D/g, '') && !cnpj.replace(/\D/g, '')) {
            return { ok: false, error: 'Informe telefone, e-mail, CPF ou CNPJ para salvar o cadastro.' };
        }
        return saveCustomerDocToHub();
    };

    const showCustomerError = (message) => {
        if (!customerError) return;
        customerError.textContent = message;
        customerError.hidden = !message;
    };

    const attachCatalogSearchKeyboard = () => {
        if (!searchInput) return;
        totemKeyboard = window.LigeirinhoTotemKeyboard?.init?.({
            input: searchInput,
            onInput: (value) => {
                bumpIdle();
                if (searchTimer) clearTimeout(searchTimer);
                searchTimer = window.setTimeout(() => setSearchQuery(value), 180);
            },
            onSubmit: (value) => setSearchQuery(value),
            onClose: bumpIdle,
        });
    };

    const initSearchKeyboard = () => {
        if (!searchInput) return;
        // Re-liga o teclado a cada foco: o TotemKeyboard é singleton e a aba
        // Promoções (ou outros campos) pode ter roubado o input ativo.
        if (!searchInput.dataset.totemCatalogVkBound) {
            searchInput.dataset.totemCatalogVkBound = '1';
            searchInput.addEventListener('focus', attachCatalogSearchKeyboard);
            searchInput.addEventListener('click', attachCatalogSearchKeyboard);
        }
        attachCatalogSearchKeyboard();
    };

    const bindCustomerKeyboard = (field, mode = null) => {
        if (!field) return;
        const keyboardMode =
            mode ||
            (field === customerPhoneInput ||
            field === customerCpfInput ||
            field === customerManualDocInput
                ? 'numeric'
                : field === customerManualEmailInput || field === customerLookupInput
                  ? field === customerLookupInput
                      ? lookupKeyboardMode()
                      : 'email'
                  : 'full');
        totemKeyboard = window.LigeirinhoTotemKeyboard?.init?.({
            input: field,
            mode: keyboardMode,
            submitLabel: 'OK',
            onInput:
                field === customerCpfInput
                    ? (value) => {
                          bumpIdle();
                          if (!customerCpfInput) return;
                          customerCpfInput.value = cpfApi?.formatCpf?.(value) || value;
                      }
                    : field === customerManualDocInput
                      ? (value) => {
                            bumpIdle();
                            if (!customerManualDocInput) return;
                            customerManualDocInput.value = formatManualDocInput(value);
                        }
                      : () => bumpIdle(),
            onSubmit: () => {
                bumpIdle();
                if (field === customerNameInput) {
                    const contactField = manualContactField();
                    contactField?.focus();
                    bindCustomerKeyboard(
                        contactField,
                        customerManualContactMode === 'email' ? 'email' : 'numeric',
                    );
                    return;
                }
                if (
                    field === customerPhoneInput ||
                    field === customerManualEmailInput ||
                    field === customerManualDocInput
                ) {
                    void submitCustomerAndStart();
                    return;
                }
                if (field === customerCpfInput) {
                    void submitCustomerCpf();
                    return;
                }
                totemKeyboard?.hide?.();
            },
            onClose: bumpIdle,
        });
        field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        window.requestAnimationFrame(() => {
            const content = field.closest('.totem-customer__content');
            if (content) content.scrollLeft = 0;
        });
        totemKeyboard?.show?.();
    };

    const enterCatalog = ({ guest = false } = {}) => {
        customerIdentified = true;
        if (!guest && customerHasPersistData()) {
            void persistTotemCustomer();
        }
        resetCart();
        clearSearch();
        activeCategory = '';
        renderCategories();
        renderProducts();
        updateCatalogGreeting();
        setView('catalog');
        initSearchKeyboard();
        bumpIdle();
    };

    const formatGreetingName = (raw) => {
        const name = String(raw || '').trim().replace(/\s+/g, ' ');
        if (!name) return '';
        const first = name.split(' ')[0];
        return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    };

    const updateCatalogGreeting = () => {
        if (!productsEyebrow) return;
        const display = formatGreetingName(totemCustomer.name);
        if (display) {
            productsEyebrow.textContent = `Olá, ${display}`;
            productsEyebrow.classList.add('totem-products__eyebrow--greeting');
        } else {
            productsEyebrow.textContent = 'Escolha seus produtos';
            productsEyebrow.classList.remove('totem-products__eyebrow--greeting');
        }
    };

    const catalogHeadVisible = (catLabel) =>
        Boolean(catLabel) || Boolean(formatGreetingName(totemCustomer.name));

    const submitCustomerAndStart = async () => {
        const name = String(customerNameInput?.value || '').trim().replace(/\s+/g, ' ');
        const contact = validateActiveManualContact({ optional: true });
        if (!contact) return;

        if (!manualFormHasInput()) {
            skipCustomerIdentification();
            return;
        }

        customerNameInput?.classList.remove('totem-customer__input--error');
        showCustomerError('');
        totemCustomer = {
            name,
            phone: sanitizeCustomerPhone(contact.phone, contact.cpf, contact.cnpj),
            email: contact.email,
            cpf: contact.cpf,
            cnpj: contact.cnpj,
            pessoaId: '',
        };
        totemKeyboard?.hide?.();

        if (!customerHasPersistData()) {
            proceedAfterCustomerRegister();
            return;
        }

        if (customerContinueBtn) {
            customerContinueBtn.disabled = true;
            const label = customerContinueBtn.querySelector('span');
            if (label) label.textContent = 'Salvando cadastro…';
        }
        const saved = await persistTotemCustomer();
        if (customerContinueBtn) {
            customerContinueBtn.disabled = false;
            const label = customerContinueBtn.querySelector('span');
            if (label) label.textContent = 'Continuar';
        }
        if (!saved.ok) {
            showCustomerError(saved.error || 'Não foi possível salvar o cadastro.');
            return;
        }
        proceedAfterCustomerRegister();
    };

    const submitCustomerCpf = async () => {
        const digits = cpfApi?.normalizeCpfDigits?.(customerCpfInput?.value) || '';
        if (!cpfApi?.isValidCpf?.(digits)) {
            customerCpfInput?.classList.add('totem-customer__input--error');
            showCpfError('Informe um CPF válido com 11 dígitos.');
            customerCpfInput?.focus();
            bindCustomerKeyboard(customerCpfInput, 'numeric');
            return;
        }
        customerCpfInput?.classList.remove('totem-customer__input--error');
        showCpfError('');
        totemCustomer = { ...totemCustomer, cpf: digits };
        totemKeyboard?.hide?.();
        if (customerHasPersistData()) {
            const saved = await saveCustomerDocToHub();
            if (!saved.ok) {
                showCpfError(saved.error || 'Não foi possível salvar o CPF.');
                return;
            }
        }
        enterCatalog({ guest: customerSkippedIdentification });
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

    const updateShoppingChrome = () => {
        const inCatalog = views.catalog?.classList.contains('totem-view--active');
        const inPromos = views.promos?.classList.contains('totem-view--active');
        const inShopping = inCatalog || inPromos;
        const showShoppingActions = Boolean(customerIdentified && inShopping);
        const pendingSystemUpdate = Boolean(window.LigeirinhoTotemPwaUpdate?.isPending?.());
        const showHeaderActions = showShoppingActions || pendingSystemUpdate;

        if (headerActions) {
            headerActions.hidden = !showHeaderActions;
            headerActions.classList.toggle('totem-header__actions--visible', showHeaderActions);
            headerActions.classList.toggle(
                'totem-header__actions--update-only',
                pendingSystemUpdate && !showShoppingActions,
            );
        }

        if (promosBtn) {
            promosBtn.hidden = !showShoppingActions;
            if (showShoppingActions) {
                promosBtn.classList.toggle('totem-btn--promos-active', inPromos);
                promosBtn.setAttribute('aria-pressed', inPromos ? 'true' : 'false');
            }
        }

        if (cartBtn) {
            cartBtn.hidden = !showShoppingActions;
        }

        if (syncBtn) {
            syncBtn.hidden = !showShoppingActions;
            syncBtn.disabled = syncBusy;
            syncBtn.classList.toggle('totem-btn--refreshing', syncBusy);
            syncBtn.setAttribute('aria-busy', syncBusy ? 'true' : 'false');
            syncBtn.setAttribute(
                'aria-label',
                syncBusy ? 'Sincronizando catálogo…' : 'Sincronizar catálogo com o Hub',
            );
        }

        if (adminEditBtn) {
            window.LigeirinhoTotemStoreAdmin?.updateAdminChrome?.();
        }

        if (refreshBtn) {
            refreshBtn.hidden = !pendingSystemUpdate;
            refreshBtn.disabled = refreshBusy || window.LigeirinhoTotemPwaUpdate?.status?.() === 'checking';
            refreshBtn.classList.toggle('totem-btn--update-pending', pendingSystemUpdate);
            refreshBtn.setAttribute(
                'aria-label',
                pendingSystemUpdate ? 'Aplicar atualização do sistema' : 'Atualizar',
            );
        }

        document.documentElement.classList.toggle('totem--shopping-chrome', showShoppingActions);
        document.documentElement.classList.toggle('totem--system-update-pending', pendingSystemUpdate);
    };

    const refreshTotemData = async () => {
        if (syncBusy) return;
        syncBusy = true;
        syncBtn?.classList.add('totem-btn--refreshing');
        syncBtn?.setAttribute('aria-busy', 'true');
        syncBtn?.setAttribute('aria-label', 'Sincronizando catálogo…');
        updateShoppingChrome();
        bumpIdle();

        const applyCatalogRefresh = (rawCatalog) => {
            applyCatalogFromRaw(rawCatalog);
        };

        try {
            window.__ligCatalogSyncTs = Date.now();
            let rawCatalog = null;

            if (window.LigeirinhoCatalogSync?.sync) {
                const result = await window.LigeirinhoCatalogSync.sync({
                    apiUrl: CATALOG_API_URL,
                    promoApiUrl: '/api/totem/promocoes',
                });
                if (!result?.ok) {
                    if (result?.busy) return;
                    throw new Error(result?.error || 'sync failed');
                }
                rawCatalog = result.catalogData;
            } else {
                window.LigeirinhoCatalogLoader?.clear?.();
                if (window.__ligPackConfig) window.__ligPackConfig = null;
                if (window.__ligTierImages) window.__ligTierImages = null;
                rawCatalog = await loadTotemCatalog({ force: true });
                await Promise.all([
                    pricing.loadPackConfig?.() ?? Promise.resolve(),
                    pricing.loadTierImages?.() ?? Promise.resolve(),
                ]);
            }

            applyCatalogRefresh(rawCatalog);

            if (isInPromos()) {
                await window.LigeirinhoTotemPromos?.refresh?.({ force: true });
            } else {
                window.LigeirinhoTotemPromos?.invalidate?.();
            }

            updateFloatCart(cartApi.loadCart());
            if (categoriesStats) {
                const syncedAt = new Date().toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                const hubAt = rawCatalog?.exportedAt
                    ? new Date(rawCatalog.exportedAt).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                      })
                    : null;
                const hubLabel = hubAt ? ` · Hub ${hubAt}` : '';
                categoriesStats.textContent = `Sincronizado às ${syncedAt}${hubLabel} · ${totemCategories.length} categorias · ${displayItems.length} produtos`;
            }
        } catch (err) {
            const msg = err?.message || '';
            window.alert(
                msg && !msg.includes('sync failed')
                    ? msg
                    : 'Não foi possível sincronizar. Verifique a conexão e tente novamente.',
            );
        } finally {
            syncBusy = false;
            syncBtn?.classList.remove('totem-btn--refreshing');
            syncBtn?.setAttribute('aria-busy', 'false');
            updateShoppingChrome();
        }
    };

    const setView = (name) => {
        if ((name === 'catalog' || name === 'promos') && !customerIdentified) {
            name = 'customer';
        }
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
        updateShoppingChrome();
        totemHeader?.classList.toggle('totem-header--catalog', inCatalog);
        totemHeader?.classList.toggle('totem-header--promos', inPromos);
        if (name === 'welcome') hideIdleWarning();
        if (!inCatalog) {
            totemKeyboard?.hide?.();
            closeCategoriesModal();
        }
        resetIdleTimer();
        if (name === 'customer' && customerStep === 'register' && !customerSteps.register?.classList.contains('totem-customer__step--active')) {
            startCustomerFlow();
        }
        if (inPromos) {
            window.LigeirinhoTotemPromos?.refresh?.();
        }
        updateFloatCart(cartApi.loadCart());
    };

    const isCartOpen = () => cartPanel?.classList.contains('totem-cart-panel--open');

    const isInCatalog = () => views.catalog?.classList.contains('totem-view--active');

    const refreshPromosIfOpen = () => {
        if (views.promos?.classList.contains('totem-view--active')) {
            window.LigeirinhoTotemPromos?.syncCart?.();
        }
    };

    const isInPromos = () => views.promos?.classList.contains('totem-view--active');

    const isInShopping = () => isInCatalog() || isInPromos();

    const resolvePromosBackTarget = () => (customerIdentified ? 'catalog' : promosReturnView || 'welcome');

    const leavePromosView = () => {
        window.LigeirinhoTotemPromos?.stopAuto?.();
        window.LigeirinhoTotemPromos?.clearSearch?.();
        const target = resolvePromosBackTarget();
        setView(target);
        renderCart();
        renderProducts();
        if (target === 'catalog') initSearchKeyboard();
    };

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

        const visible = customerIdentified && count > 0 && isInShopping() && !isCartOpen();
        floatCart?.classList.toggle('totem-float-cart--visible', visible);
        floatCart?.setAttribute('aria-hidden', visible ? 'false' : 'true');
        document.documentElement.classList.toggle(
            'totem-has-float-cart',
            customerIdentified && count > 0 && isInShopping(),
        );
    };

    const resetCart = () => {
        cartApi.clearTotemSession?.();
        renderCart();
    };

    const clearIdleTimers = () => {
        sessionTimeout?.cancel();
    };

    const hideIdleWarning = () => {
        if (!idleHint) return;
        idleHint.classList.remove('totem-idle-hint--visible');
        idleHint.hidden = true;
        idleHint.setAttribute('aria-hidden', 'true');
        if (idleCountdownEl) {
            idleCountdownEl.textContent = String(
                Math.round((Number(totemConfig.defaults?.countdownMs) || 10000) / 1000),
            );
        }
    };

    const updateIdleCountdown = (seconds) => {
        if (idleCountdownEl) idleCountdownEl.textContent = String(Math.max(0, seconds));
    };

    const showIdleWarning = () => {
        if (views.welcome?.classList.contains('totem-view--active')) return;
        if (idleHint) {
            idleHint.hidden = false;
            idleHint.setAttribute('aria-hidden', 'false');
            idleHint.classList.add('totem-idle-hint--visible');
        }
    };

    const resetSession = () => {
        customerIdentified = false;
        closeProductDetail();
        closeCart();
        window.LigeirinhoTotemPromos?.closeLightbox?.();
        resetCart();
        resetCustomerForm();
        clearSearch();
        activeCategory = '';
        hideIdleWarning();
        clearIdleTimers();
        setView('welcome');
    };

    const isIdleBlocked = () => {
        if (detailPanel?.classList.contains('totem-detail--open')) return true;
        if (isCartOpen()) return true;
        if (categoriesModal?.classList.contains('totem-categories-modal--open')) return true;
        if (totemKeyboard?.isOpen?.()) return true;
        if (adminModal?.classList.contains('totem-admin-modal--open')) return true;
        return false;
    };

    const timeoutDefaults = () => ({
        idleBeforeCountdownMs: Number(totemConfig.defaults?.idleBeforeCountdownMs) || 15000,
        countdownMs: Number(totemConfig.defaults?.countdownMs) || 10000,
    });

    const bumpIdle = () => {
        if (idlePaused) return;
        sessionTimeout?.bump();
    };

    const resetIdleTimer = () => {
        if (views.welcome?.classList.contains('totem-view--active')) {
            sessionTimeout?.cancel();
            hideIdleWarning();
            return;
        }

        const cfg = timeoutDefaults();
        const activity = window.LigeirinhoTotemActivity;
        sessionTimeout?.cancel();
        sessionTimeout = activity?.createCountdownTimeout?.({
            idleBeforeCountdownMs: cfg.idleBeforeCountdownMs,
            countdownMs: cfg.countdownMs,
            canStartCountdown: () =>
                !idlePaused &&
                !isIdleBlocked() &&
                !views.welcome?.classList.contains('totem-view--active'),
            onCountdownStart: () => {
                if (
                    views.catalog?.classList.contains('totem-view--active') ||
                    views.promos?.classList.contains('totem-view--active') ||
                    views.customer?.classList.contains('totem-view--active')
                ) {
                    updateIdleCountdown(Math.ceil(cfg.countdownMs / 1000));
                    showIdleWarning();
                }
            },
            onTick: (remaining) => {
                updateIdleCountdown(remaining);
            },
            onReset: () => {
                hideIdleWarning();
            },
            onComplete: () => {
                if (idlePaused || isIdleBlocked()) {
                    resetIdleTimer();
                    return;
                }
                resetSession();
            },
        });
        sessionTimeout?.arm();
        hideIdleWarning();
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

    /** Limite inicial: evita ~5s ao pintar todas as CX de uma vez no "Todos". */
    const PRODUCT_GRID_INITIAL = 36;
    const PRODUCT_GRID_BATCH = 36;
    let productGridRenderToken = 0;

    const buildProductCardHtml = (item, index, cart = null) => {
        const group = item.group || null;
        const product = item.product;
        const tier = group ? activeTierFor(group) : item.defaultTier || 'caixa';
        const variant = group ? pricing.getVariant(group, tier) : null;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const itemKey = group?.key || product.id;
        const offer = resolvePromoOffer(cartKey, itemKey, tier);
        const cartMap = cart || cartApi.loadCart();
        const qty = cartMap[cartKey]?.qty || 0;
        const img = catalog.productImageUrl(group ? pricing.getTierImage(group, tier) : product.image);
        const name = group?.baseName || product.name;
        const tiersHtml = group ? priceTiersHtml(group, tier) : '';
        const priceOpts = {
            hidePackLabel: true,
            promoId: offer?.promoId,
            promoPrice: offer?.promoPrice,
            originalPrice: offer?.originalPrice,
            discountPct: offer?.discountPct,
        };
        const priceHtml = variant
            ? priceBlockHtml(variant, priceOpts)
            : `<div class="totem-price-card ze-price-block totem-product__price-block${offer?.promoId ? ' totem-product__price-block--promo' : ''}" data-price-display>
<div class="totem-price-card__main">
${offer?.originalPrice > (offer?.promoPrice ?? product.price) ? `<span class="totem-product__price-old">${formatPrice(offer.originalPrice)}</span>` : ''}
<span class="totem-product__price totem-price-card__value">${formatPrice(offer?.promoPrice ?? product.price)}</span>
${offer?.discountPct > 0 ? `<span class="totem-product__promo-badge">-${offer.discountPct}%</span>` : offer?.promoId ? '<span class="totem-product__promo-badge">PROMO</span>' : ''}
</div>
<p class="totem-price-card__detail"></p>
<p class="totem-price-card__unit"></p>
</div>`;
        const qtyHtml = `<div class="totem-product__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<span class="totem-qty-value">${qty}</span>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-price-tier="${esc(tier)}" aria-label="Aumentar">+</button>
</div>`;
        const selectedClass = qty ? ' totem-product--selected' : '';
        const promoClass = offer?.promoId ? ' totem-product--promo' : '';
        const attrs = `role="listitem" data-group-key="${esc(group?.key || '')}" data-price-tier="${esc(tier)}" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}"${offer?.promoId ? ` data-promo-id="${esc(offer.promoId)}"` : ''} style="--totem-card-i:${Math.min(index, 14)}"`;
        const payTag = offer?.promoId
            ? `<span class="totem-product__pay-tag" aria-label="Pagamento apenas Pix ou Dinheiro"><span class="totem-product__pay-tag-label">Pix/Dinheiro</span></span>`
            : '';
        const mediaHtml = `<div class="totem-product__media">
${payTag}
${variant && !tiersHtml ? mediaPackTagHtml(variant, tier) : ''}
${mediaCartBadgeHtml(qty)}
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
            return `<article class="totem-product totem-product--list${selectedClass}${promoClass}" ${attrs}>
${mediaHtml}
${bodyHtml}
<div class="totem-product__list-price">${priceHtml}</div>
${qtyHtml}
</article>`;
        }

        return `<article class="totem-product${selectedClass}${promoClass}" ${attrs}>
${mediaHtml}
${bodyHtml}
</article>`;
    };

    const renderProducts = () => {
        if (!productsGrid) return;
        if (activeCategory && !totemCategories.some((c) => c.id === activeCategory)) {
            activeCategory = '';
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

        if (productsHead) productsHead.hidden = !catalogHeadVisible(catLabel);
        if (categoryTitle) {
            categoryTitle.textContent = catLabel;
            categoryTitle.hidden = !catLabel;
        }
        updateCatalogGreeting();
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
            productGridRenderToken += 1;
            productsGrid.innerHTML = '';
            return;
        }

        const cart = cartApi.loadCart();
        const token = ++productGridRenderToken;
        const paintSlice = (from, to) =>
            items
                .slice(from, to)
                .map((item, i) => buildProductCardHtml(item, from + i, cart))
                .join('');

        // Primeiro paint rápido; restante em batches no idle para não travar o totem.
        const firstEnd = Math.min(items.length, PRODUCT_GRID_INITIAL);
        productsGrid.innerHTML = paintSlice(0, firstEnd);
        refreshDetailIfOpen();
        window.requestAnimationFrame(() => updateViewSwitcher());

        if (firstEnd >= items.length) return;

        let cursor = firstEnd;
        const appendNext = () => {
            if (token !== productGridRenderToken || !productsGrid) return;
            const next = Math.min(cursor + PRODUCT_GRID_BATCH, items.length);
            productsGrid.insertAdjacentHTML('beforeend', paintSlice(cursor, next));
            cursor = next;
            if (cursor < items.length) {
                if (typeof window.requestIdleCallback === 'function') {
                    window.requestIdleCallback(appendNext, { timeout: 120 });
                } else {
                    window.requestAnimationFrame(appendNext);
                }
            }
        };
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(appendNext, { timeout: 80 });
        } else {
            window.requestAnimationFrame(appendNext);
        }
    };

    const bumpProductCardInGrid = (itemKey, tier, cartKey) => {
        const item = itemKey ? findDisplayItem(null, itemKey) : null;
        const group = item?.group;
        if (group?.key && tier) tierByGroup.set(group.key, tier);

        let card = itemKey
            ? productsGrid?.querySelector(`.totem-product[data-item-key="${itemKey}"]`)
            : null;
        if (!card && cartKey) {
            card =
                productsGrid?.querySelector(`[data-cart-key="${cartKey}"]`) ||
                productsGrid?.querySelector(`.totem-plus[data-cart-key="${cartKey}"]`)?.closest('.totem-product');
        }
        if (!card) return false;

        if (tier) card.dataset.priceTier = tier;
        refreshTotemProductCard(card);
        pulseClass(card, 'totem-product--pulse');
        const badge = card.querySelector('.totem-product__cart-badge');
        if (badge) pulseClass(badge, 'totem-product__badge--pop');
        const qtyEl = card.querySelector('.totem-qty-value');
        if (qtyEl) pulseClass(qtyEl, 'totem-qty-value--pop');
        return true;
    };

    const pulseProduct = (cartKey) => {
        const card =
            productsGrid?.querySelector(`[data-cart-key="${cartKey}"]`) ||
            productsGrid?.querySelector(`.totem-plus[data-cart-key="${cartKey}"]`)?.closest('.totem-product');
        pulseClass(card, 'totem-product--pulse');
        const badge = card?.querySelector('.totem-product__cart-badge');
        if (badge) pulseClass(badge, 'totem-product__badge--pop');
        const qtyEl = card?.querySelector('.totem-qty-value');
        if (qtyEl) pulseClass(qtyEl, 'totem-qty-value--pop');
    };

    const findDisplayItem = (cartKey, itemKey) => {
        const pools = [displayItems, promoCatalogItems, promoDisplayItems];
        for (const pool of pools) {
            if (itemKey) {
                const byGroup = pool.find((i) => (i.group?.key || i.product.id) === itemKey);
                if (byGroup) return byGroup;
            }
            if (cartKey) {
                const match = pool.find((i) => {
                    const group = i.group;
                    if (!group) return i.product.id === cartKey;
                    return pricing.getAvailableTiers(group).some((tier) => {
                        const variant = pricing.getVariant(group, tier);
                        return variant && catalog.cartKeyFor(variant) === cartKey;
                    });
                });
                if (match) return match;
            }
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
        if (!customerIdentified) return;
        totemKeyboard?.hide?.();
        const item = findDisplayItem(cartKey, itemKey);
        if (!item) return;
        const group = item.group;
        const card = itemKey ? productsGrid?.querySelector(`[data-item-key="${itemKey}"]`) : null;
        const tier =
            opts.tier ||
            card?.dataset?.priceTier ||
            item?.defaultTier ||
            (group ? activeTierFor(group) : 'caixa');
        const variant = group ? pricing.getVariant(group, tier) : null;
        const product = item.product;
        const key = cartKey || (variant ? catalog.cartKeyFor(variant) : product.id);
        const packType = opts.tier || variant?.tier || tier || 'caixa';
        const name = group
            ? pricing.cartItemName({ ...(variant || {}), tier: packType }, group)
            : product.name;
        const price =
            opts.promoPrice != null && Number.isFinite(Number(opts.promoPrice))
                ? Number(opts.promoPrice)
                : (variant || product).price;
        const basePrice =
            opts.promoOriginalPrice != null && Number.isFinite(Number(opts.promoOriginalPrice))
                ? Number(opts.promoOriginalPrice)
                : Number((variant || product).price);
        const cart = cartApi.loadCart();
        const autoOffer =
            !opts.promoPrice && !opts.promoId
                ? resolvePromoOffer(key, itemKey || group?.key || product.id, packType)
                : null;
        const promoOpts = opts.promoId
            ? opts
            : autoOffer
              ? {
                    promoId: autoOffer.promoId,
                    promoPrice: autoOffer.promoPrice,
                    promoOriginalPrice: autoOffer.originalPrice,
                    tier: autoOffer.tier || packType,
                }
              : opts;
        const finalPrice =
            promoOpts.promoPrice != null && Number.isFinite(Number(promoOpts.promoPrice))
                ? Number(promoOpts.promoPrice)
                : price;
        const finalBase =
            promoOpts.promoOriginalPrice != null && Number.isFinite(Number(promoOpts.promoOriginalPrice))
                ? Number(promoOpts.promoOriginalPrice)
                : basePrice;
        if (!cart[key]) {
            cart[key] = {
                id: promoOpts.productId || (variant || product).id,
                cartKey: key,
                name,
                price: finalPrice,
                qty: 0,
                packType,
                ...cartCategoryFields(item),
                ...(promoOpts.promoId
                    ? {
                          promoId: promoOpts.promoId,
                          isPromo: true,
                          originalPrice: finalBase,
                          discountPct:
                              finalBase > finalPrice
                                  ? Math.max(0, Math.round((1 - finalPrice / finalBase) * 100))
                                  : 0,
                      }
                    : {}),
            };
        } else if (promoOpts.promoPrice != null && Number.isFinite(Number(promoOpts.promoPrice))) {
            cart[key].price = Number(promoOpts.promoPrice);
            if (promoOpts.promoId) {
                cart[key].promoId = promoOpts.promoId;
                cart[key].isPromo = true;
                cart[key].originalPrice = finalBase;
                cart[key].discountPct =
                    finalBase > Number(promoOpts.promoPrice)
                        ? Math.max(0, Math.round((1 - Number(promoOpts.promoPrice) / finalBase) * 100))
                        : 0;
            }
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

    const addDetailBlockToCart = (tier, blockEl) => {
        if (!customerIdentified || !detailItemKey || !tier) return;
        if (blockEl?.classList.contains('totem-detail__price-block--added')) return;
        totemKeyboard?.hide?.();
        const item = findDisplayItem(null, detailItemKey);
        if (!item) return;
        const group = item.group;
        if (group?.key) tierByGroup.set(group.key, tier);

        const ctx = getDetailContext();
        if (!ctx) return;
        const block = buildDetailPriceBlocks(ctx).find((b) => b.tier === tier);
        if (!block || block.actionable === false) return;

        const qtyToAdd = Math.max(1, detailDraftQty);
        const tierPromo = block.promoOpts || null;
        const usePromo = Boolean(tierPromo?.promoId);
        const variant = group
            ? pricing.getVariant(group, tier) ||
              (block?.variant ? { ...block.variant, tier: block.variant.tier || tier } : null)
            : block.variant
              ? { ...block.variant, tier: block.variant.tier || tier }
              : null;
        const product = item.product;
        const key = variant ? catalog.cartKeyFor(variant) : product.id;
        const packType = tier || variant?.tier || 'caixa';
        const name = group
            ? pricing.cartItemName({ ...(variant || {}), tier: packType }, group)
            : product.name;
        const price =
            usePromo && tierPromo?.promoPrice != null
                ? Number(tierPromo.promoPrice)
                : Number((variant || product).price);
        const basePrice = Number((variant || product).price);
        const cart = cartApi.loadCart();
        const autoOffer =
            !usePromo ? resolvePromoOffer(key, detailItemKey || group?.key || product.id, packType) : null;
        const appliedPromo = usePromo
            ? tierPromo
            : autoOffer
              ? {
                    promoId: autoOffer.promoId,
                    promoPrice: autoOffer.promoPrice,
                    originalPrice: autoOffer.originalPrice,
                }
              : null;
        const finalPrice =
            appliedPromo?.promoPrice != null ? Number(appliedPromo.promoPrice) : price;
        const finalBase =
            appliedPromo?.originalPrice != null ? Number(appliedPromo.originalPrice) : basePrice;

        if (!cart[key]) {
            cart[key] = {
                id: (variant || product).id,
                cartKey: key,
                name,
                price: finalPrice,
                qty: 0,
                packType,
                ...cartCategoryFields(item),
                ...(appliedPromo?.promoId
                    ? {
                          promoId: appliedPromo.promoId,
                          isPromo: true,
                          originalPrice: finalBase,
                          discountPct:
                              finalBase > finalPrice
                                  ? Math.max(0, Math.round((1 - finalPrice / finalBase) * 100))
                                  : 0,
                      }
                    : {}),
            };
        } else if (appliedPromo?.promoId) {
            cart[key].price = finalPrice;
            cart[key].promoId = appliedPromo.promoId;
            cart[key].isPromo = true;
            cart[key].originalPrice = finalBase;
            cart[key].discountPct =
                finalBase > finalPrice
                    ? Math.max(0, Math.round((1 - finalPrice / finalBase) * 100))
                    : 0;
        }

        cart[key].qty += qtyToAdd;
        cartApi.saveCart(cart);
        renderCart();
        refreshPromosIfOpen();
        const bumped = bumpProductCardInGrid(detailItemKey, tier, key);
        if (!bumped) renderProducts();
        playDetailBlockAddedFeedback(blockEl, qtyToAdd);
        showCartAddedToast(name, cartLineImage(cart[key]), qtyToAdd);

        detailDraftQty = 1;
        window.setTimeout(() => renderProductDetail(), 900);
        bumpIdle();
    };

    const addDetailToCart = (cartKey, itemKey) => {
        if (!customerIdentified) return;
        totemKeyboard?.hide?.();
        const qtyToAdd = Math.max(1, detailDraftQty);
        if (detailPromoOpts?.promoId) {
            for (let i = 0; i < qtyToAdd; i += 1) {
                addItem(cartKey, itemKey, {
                    promoPrice: detailPromoOpts.promoPrice,
                    promoId: detailPromoOpts.promoId,
                    tier: detailPromoOpts.tier,
                });
            }
            detailDraftQty = 1;
            refreshDetailIfOpen();
            return;
        }
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
        if (!customerIdentified && delta > 0) return;
        totemKeyboard?.hide?.();
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
${item.promoId ? '<span class="totem-cart-line__promo">PROMO</span><span class="totem-cart-line__pay-tag">Pix/Dinheiro</span>' : ''}
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
        if (!customerIdentified) return;
        cartPanel?.classList.add('totem-cart-panel--open');
        cartPanel?.setAttribute('aria-hidden', 'false');
        updateFloatCart(cartApi.loadCart());
        renderCart();
        bumpIdle();
    };

    const closeCart = () => {
        if (!cartPanel?.classList.contains('totem-cart-panel--open')) return;
        bumpIdle();
        cartPanel.classList.add('totem-cart-panel--closing');
        window.setTimeout(() => {
            cartPanel.classList.remove('totem-cart-panel--open', 'totem-cart-panel--closing');
            cartPanel.setAttribute('aria-hidden', 'true');
            updateFloatCart(cartApi.loadCart());
        }, 300);
    };

    const startCheckout = async () => {
        if (!customerIdentified) return;
        const cart = cartApi.loadCart();
        if (!cartApi.cartItemCount(cart)) return;
        checkoutBtn.disabled = true;
        checkoutBtn.textContent = 'Enviando pedido…';
        idlePaused = true;
        bumpIdle();

        const s = session();
        const items = cartApi.cartEntries(cart).map((item) => {
            const originalPrice =
                item.originalPrice != null ? Number(item.originalPrice) : null;
            const price = Number(item.price);
            const discountPct =
                item.discountPct != null
                    ? Number(item.discountPct)
                    : originalPrice != null && originalPrice > price + 0.009
                      ? Math.max(0, Math.round((1 - price / originalPrice) * 100))
                      : null;
            const isPromo = Boolean(
                item.promoId ||
                    item.isPromo ||
                    (discountPct != null && discountPct > 0) ||
                    (originalPrice != null && originalPrice > price + 0.009),
            );
            return {
                id: item.id,
                cartKey: item.cartKey || item.id,
                name: item.name,
                price: item.price,
                qty: item.qty,
                packType: item.packType,
                categoryId: item.categoryId || '',
                categoryName: item.categoryName || '',
                ...(item.promoId ? { promoId: item.promoId } : {}),
                ...(isPromo ? { isPromo: true } : {}),
                ...(originalPrice != null ? { originalPrice } : {}),
                ...(discountPct != null ? { discountPct } : {}),
            };
        });

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
                        phone:
                            sanitizeCustomerPhone(
                                totemCustomer.phone,
                                totemCustomer.cpf,
                                totemCustomer.cnpj,
                            ) ||
                            s?.phone ||
                            '',
                        email: s?.email || '',
                        cpf: totemCustomer.cpf || '',
                        cnpj: totemCustomer.cnpj || '',
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível criar o pedido');
            cartApi.saveLastOrder(cart, cartApi.loadCheckout(), data.orderId);
            window.location.href = `totem-pagamento.html?order=${encodeURIComponent(data.orderId)}`;
        } catch (err) {
            idlePaused = false;
            resetIdleTimer();
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

        document.querySelectorAll('[data-customer-skip]').forEach((btn) => {
            btn.addEventListener('click', () => {
                skipCustomerIdentification();
                bumpIdle();
            });
        });

        customerBackBtn?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            if (customerStep === 'register') {
                setView('welcome');
            } else if (customerStep === 'login') {
                showCustomerStep('register');
            } else if (customerStep === 'lookup') {
                showCustomerStep('login');
            } else if (customerStep === 'confirm') {
                showCustomerStep('lookup');
            } else if (customerStep === 'invoice') {
                if (customerSkippedIdentification) {
                    showCustomerStep('register');
                } else {
                    showCustomerStep(customerLookupHit?.name ? 'confirm' : 'manual');
                }
            } else if (customerStep === 'cpf') {
                showCustomerStep('invoice');
            } else if (customerStep === 'manual') {
                showCustomerStep('register');
            } else {
                showCustomerStep('register');
            }
            bumpIdle();
        });

        document.getElementById('totem-customer-gate-yes')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            showCustomerStep('login');
            bumpIdle();
        });

        document.getElementById('totem-customer-gate-no')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            goManualCustomer();
            bumpIdle();
        });

        document.getElementById('totem-customer-registered-doc')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            startCustomerLookup('doc');
            bumpIdle();
        });

        document.getElementById('totem-customer-registered-email')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            startCustomerLookup('email');
            bumpIdle();
        });

        customerLookupForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            void submitCustomerLookup();
        });

        customerLookupInput?.addEventListener('focus', () =>
            bindCustomerKeyboard(customerLookupInput, lookupKeyboardMode()),
        );

        document.getElementById('totem-customer-confirm-yes')?.addEventListener('click', () => {
            confirmCustomerIdentity();
            bumpIdle();
        });

        document.getElementById('totem-customer-confirm-no')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            customerLookupHit = null;
            goManualCustomer({ fromReject: true });
            bumpIdle();
        });

        customerForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            void submitCustomerAndStart();
        });

        document.getElementById('totem-customer-invoice-yes')?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            showCpfError('');
            if (customerCpfInput) {
                const digits = cpfApi?.normalizeCpfDigits?.(totemCustomer.cpf) || String(totemCustomer.cpf || '').replace(/\D/g, '');
                customerCpfInput.value = digits ? cpfApi?.formatCpf?.(digits) || digits : '';
            }
            showCustomerStep('cpf');
            bumpIdle();
        });

        document.getElementById('totem-customer-invoice-no')?.addEventListener('click', () => {
            totemCustomer = { ...totemCustomer, cpf: '' };
            totemKeyboard?.hide?.();
            enterCatalog({ guest: customerSkippedIdentification });
            bumpIdle();
        });

        customerCpfForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            submitCustomerCpf();
        });

        customerCpfInput?.addEventListener('focus', () => bindCustomerKeyboard(customerCpfInput, 'numeric'));

        customerNameInput?.addEventListener('input', () => {
            bumpIdle();
            customerNameInput.classList.remove('totem-customer__input--error');
            if (customerError?.textContent) showCustomerError('');
        });

        customerPhoneInput?.addEventListener('input', () => bumpIdle());

        customerNameInput?.addEventListener('focus', () => bindCustomerKeyboard(customerNameInput));
        customerPhoneInput?.addEventListener('focus', () => bindCustomerKeyboard(customerPhoneInput, 'numeric'));
        customerManualEmailInput?.addEventListener('input', () => {
            customerManualEmailInput.classList.remove('totem-customer__input--error');
            showCustomerError('');
        });
        customerManualEmailInput?.addEventListener('focus', () =>
            bindCustomerKeyboard(customerManualEmailInput, 'email'),
        );
        customerManualDocInput?.addEventListener('input', () => {
            customerManualDocInput.classList.remove('totem-customer__input--error');
            showCustomerError('');
        });
        customerManualDocInput?.addEventListener('focus', () =>
            bindCustomerKeyboard(customerManualDocInput, 'numeric'),
        );
        customerContactTabs?.addEventListener('click', (e) => {
            const tab = e.target.closest('[data-manual-contact]');
            if (!tab) return;
            setManualContactMode(tab.getAttribute('data-manual-contact'), { focus: true });
            showCustomerError('');
            bumpIdle();
        });

        promosBtn?.addEventListener('click', () => {
            if (!customerIdentified) {
                setView('customer');
                startCustomerFlow();
                bumpIdle();
                return;
            }
            if (views.promos?.classList.contains('totem-view--active')) {
                leavePromosView();
                bumpIdle();
                return;
            }
            promosReturnView = 'catalog';
            void (async () => {
                await window.LigeirinhoPromoEntryNotice?.show?.({ variant: 'totem' });
                setView('promos');
                void window.LigeirinhoTotemPromos?.render?.();
                bumpIdle();
            })();
        });

        syncBtn?.addEventListener('click', () => {
            void refreshTotemData();
            bumpIdle();
        });

        refreshBtn?.addEventListener('click', () => {
            if (refreshBusy || !window.LigeirinhoTotemPwaUpdate?.isPending?.()) return;
            refreshBusy = true;
            refreshBtn.classList.add('totem-btn--refreshing');
            refreshBtn.setAttribute('aria-busy', 'true');
            void window.LigeirinhoTotemPwaUpdate.aplicar();
        });

        promosBackBtn?.addEventListener('click', () => {
            leavePromosView();
            bumpIdle();
        });

        logoBtn?.addEventListener('click', () => {
            totemKeyboard?.hide?.();
            // Sempre volta à home (tela inicial), em qualquer etapa do fluxo.
            if (views.welcome?.classList.contains('totem-view--active')) return;
            resetSession();
            bumpIdle();
        });
        cartBtn?.addEventListener('click', () => {
            if (!customerIdentified) return;
            openCart();
        });
        floatCartBtn?.addEventListener('click', () => {
            if (!customerIdentified) return;
            openCart();
        });
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
                const offer = resolvePromoOffer(
                    plus.dataset.cartKey,
                    plus.dataset.itemKey,
                    plus.dataset.priceTier,
                );
                addItem(plus.dataset.cartKey, plus.dataset.itemKey, promoAddOpts(offer) || {});
                return;
            }
            if (minus) {
                changeQty(minus.dataset.cartKey, -1);
                return;
            }
            const card = e.target.closest('.totem-product');
            if (card?.dataset?.itemKey) {
                if (window.LigeirinhoTotemStoreAdmin?.isEditMode?.()) {
                    const item = findDisplayItem(card.dataset.cartKey, card.dataset.itemKey);
                    if (item) {
                        window.LigeirinhoTotemStoreAdmin.openItemModal(item);
                        bumpIdle();
                        return;
                    }
                }
                const offer =
                    promoOffersByItemKey.get(card.dataset.itemKey) ||
                    resolvePromoOffer(
                        card.dataset.cartKey,
                        card.dataset.itemKey,
                        card.dataset.priceTier,
                    );
                openProductDetail(card.dataset.itemKey, offer?.promoId ? offer : null);
            }
        });

        detailPanel?.addEventListener('pointerdown', (e) => {
            const tierPress = e.target.closest('.totem-detail__price-block[data-price-tier]');
            if (!tierPress || tierPress.classList.contains('totem-detail__price-block--added')) return;
            tierPress.classList.add('totem-detail__price-block--press');
        });

        detailPanel?.addEventListener('pointerup', (e) => {
            const tierPress = e.target.closest('.totem-detail__price-block[data-price-tier]');
            if (tierPress) tierPress.classList.remove('totem-detail__price-block--press');
        });

        detailPanel?.addEventListener('pointercancel', (e) => {
            const tierPress = e.target.closest('.totem-detail__price-block[data-price-tier]');
            if (tierPress) tierPress.classList.remove('totem-detail__price-block--press');
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
            const tierBtn = e.target.closest('.totem-detail__price-block[data-price-tier]');
            if (tierBtn && detailItemKey) {
                addDetailBlockToCart(tierBtn.dataset.priceTier, tierBtn);
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
                closeProductDetail();
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
            initSearchKeyboard();
            searchInput?.focus();
            totemKeyboard?.show?.();
            bumpIdle();
        });

        initSearchKeyboard();

        const activity = window.LigeirinhoTotemActivity;
        unbindActivity?.();
        unbindActivity = activity?.bind?.(bumpIdle, document);
        activity?.bindScroll?.(bumpIdle, productsBody, productsGrid, cartList, detailSheet);

        document.getElementById('totem-admin-cancel')?.addEventListener('click', closeAdminModal);
        document.getElementById('totem-admin-confirm')?.addEventListener('click', confirmAdminLogout);
        adminPin?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmAdminLogout();
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
            loadTotemCatalog(),
            fetch('data/totem-units.json'),
            pricing.loadPackConfig(),
            pricing.loadTierImages(),
        ]);
        totemConfig = await configRes.json();
        unitSettings = resolveUnitSettings();
        applyCatalogFromRaw(rawCatalog);
        activeCategory = '';

        await window.LigeirinhoTotemStoreAdmin?.init?.({
            auth,
            session,
            catalog,
            formatPrice,
            adminBtn: adminEditBtn,
            resolveStoreKey,
            onHiddenChange: applyStoreHiddenIds,
            onBumpIdle: bumpIdle,
            showAdminChrome: () => {
                const inCatalog = views.catalog?.classList.contains('totem-view--active');
                const inPromos = views.promos?.classList.contains('totem-view--active');
                return Boolean(customerIdentified && (inCatalog || inPromos));
            },
            onModeChange: () => bumpIdle(),
        });

        bindEvents();
        window.LigeirinhoTotemPwaUpdate?.onStatusChange?.(() => updateShoppingChrome());
        window.addEventListener('lig-totem-pwa', () => updateShoppingChrome());
        renderCategories();
        renderProducts();
        renderCart();
        await window.LigeirinhoTotemPromos?.init?.({
            gridEl: document.getElementById('totem-promos-grid'),
            emptyEl: document.getElementById('totem-promos-empty'),
            emptyTitleEl: document.getElementById('totem-promos-empty-title'),
            emptyLeadEl: document.getElementById('totem-promos-empty-lead'),
            loadingEl: document.getElementById('totem-promos-loading'),
            errorEl: document.getElementById('totem-promos-error'),
            retryBtn: document.getElementById('totem-promos-retry'),
            searchForm: document.getElementById('totem-promos-search-form'),
            searchInput: document.getElementById('totem-promos-search-input'),
            searchClearBtn: document.getElementById('totem-promos-search-clear'),
            getDisplayItems: () => displayItems,
            getPromoCatalogItems: () => promoCatalogItems,
            isProductHidden: (productId) =>
                storeHiddenProductIds.has(String(productId || '').trim()),
            formatPrice,
            getCartQty: (cartKey) => cartApi.loadCart()[cartKey]?.qty || 0,
            registerPromoDisplayItems,
            registerPromoCatalogExclusions,
            onPromoCatalogChange: () => {
                renderCategories();
                renderProducts();
            },
            openProductDetail,
            addPromoItem: (cartKey, itemKey, opts) => addItem(cartKey, itemKey, opts),
            changeQty,
            onBumpIdle: bumpIdle,
        });
        updateShoppingChrome();
        resetIdleTimer();

        const returnParams = new URLSearchParams(window.location.search);
        if (returnParams.get('cart') === 'open') {
            returnParams.delete('cart');
            const qs = returnParams.toString();
            window.history.replaceState(
                null,
                '',
                `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`,
            );
            if (!customerIdentified) {
                skipCustomerIdentification({ skipInvoice: true });
            }
            if (!cartApi.cartItemCount(cartApi.loadCart())) {
                cartApi.restoreLastOrder?.();
            }
            renderCart();
            setView('catalog');
            openCart();
        }
    };

    init();
})();
