(function () {
    /** Cards de catálogo Parceiros — réplica do layout Totem (buildProductCardHtml). */
    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const activeTierForItem = (item, pricing, tierOverride, promoOffers) => {
        if (tierOverride) return tierOverride;
        const group = item?.group || null;
        if (!group || !pricing) return item?.defaultTier || 'caixa';

        const tiers = pricing.getTotemAvailableTiers?.(group) || pricing.getAvailableTiers(group) || [];
        const itemKey = group.key;

        if (promoOffers?.byItemKey?.[itemKey]?.tier && tiers.includes(promoOffers.byItemKey[itemKey].tier)) {
            return promoOffers.byItemKey[itemKey].tier;
        }

        for (const tier of tiers) {
            const variant = pricing.getVariant(group, tier);
            const cartKey = variant ? window.LigeirinhoCatalog?.cartKeyFor?.(variant) : '';
            if (cartKey && promoOffers?.byCartKey?.[cartKey]) return tier;
        }

        if (item?.defaultTier && tiers.includes(item.defaultTier)) return item.defaultTier;
        return pricing.getDefaultTier(group);
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
        return `<span class="totem-product__pack-tag" aria-label="Embalagem ${esc(label)}"><span class="totem-product__pack-tag-label">${esc(label)}</span></span>`;
    };

    const mediaCartBadgeHtml = (qty) =>
        qty ? `<span class="totem-product__badge totem-product__cart-badge" aria-label="${qty} no carrinho">${qty}</span>` : '';

    const promoTagHtml = () =>
        '<span class="totem-product__promo-tag" aria-label="Produto em promoção"><img src="img/tag-promocao.png?v=1" alt="" aria-hidden="true"></span>';

    const promoPayTagHtml = () =>
        `<span class="totem-product__pay-tag" aria-label="Pagamento apenas Pix ou Dinheiro"><img src="img/tag-pix-dinheiro.png?v=transparent" alt="" aria-hidden="true"></span>`;

    const priceTiersHtml = (group, activeTier, pricing, promoOffers, itemKey) => {
        if (!group || !pricing) return '';
        const tiers = pricing.getTotemAvailableTiers?.(group) || pricing.getAvailableTiers(group) || [];
        if (tiers.length <= 1) return '';
        const promoCatalog = window.LigeirinhoPromoCatalog;

        const buttons = tiers
            .map((tier) => {
                const active = tier === activeTier;
                const variant = pricing.getVariant(group, tier);
                const cartKey = variant ? window.LigeirinhoCatalog?.cartKeyFor?.(variant) : '';
                const offer = promoCatalog?.resolvePromoOffer?.(promoOffers, cartKey, itemKey, tier);
                const label =
                    pricing.TIER_SHORT?.[tier]?.toUpperCase() ||
                    pricing.TIER_LABELS?.[tier]?.toUpperCase() ||
                    String(tier).toUpperCase();
                const promoClass = offer?.promoId ? ' ze-price-tier--promo' : '';
                const promoMark = offer?.promoId
                    ? `<span class="ze-price-tier__promo">${offer.discountPct > 0 ? `-${offer.discountPct}%` : 'PROMO'}</span>`
                    : '';
                return `<button type="button" class="ze-price-tier${active ? ' ze-price-tier--active' : ''}${promoClass}" data-price-tier="${esc(tier)}" aria-pressed="${active ? 'true' : 'false'}" aria-label="${esc(label)}">${esc(label)}${promoMark}</button>`;
            })
            .join('');

        return `<div class="ze-price-tiers-slot"><div class="ze-price-tiers" role="group" aria-label="Escolher embalagem">${buttons}</div></div>`;
    };

    const priceBlockHtml = (variant, pricing, formatPrice, opts = {}) => {
        if (!variant || !pricing) return '';
        const meta = pricing.pricePackMeta(variant);
        const catalogPrice = meta?.packagePrice ?? variant.price;
        const packPrice =
            opts.promoPrice != null && Number.isFinite(Number(opts.promoPrice))
                ? Number(opts.promoPrice)
                : catalogPrice;
        const originalPrice =
            opts.originalPrice != null && Number.isFinite(Number(opts.originalPrice))
                ? Number(opts.originalPrice)
                : catalogPrice;
        const showOld = originalPrice > packPrice;
        const units = Math.max(1, Number(variant.packSize) || 1);
        const unitPrice = units > 1 ? Math.round((packPrice / units) * 100) / 100 : null;
        const showUnitBreakdown = units > 1 && unitPrice != null;
        const detailHtml = `<p class="totem-price-card__detail">${units > 1 && meta?.detail ? esc(meta.detail) : ''}</p>`;
        const unitHtml = `<p class="totem-price-card__unit">${
            showUnitBreakdown ? `${formatPrice(unitPrice)}<span> / un</span>` : ''
        }</p>`;
        const oldHtml = showOld
            ? `<span class="totem-product__price-old">${formatPrice(originalPrice)}</span>`
            : '<span class="totem-product__price-old totem-product__price-old--spacer" aria-hidden="true"></span>';

        return `<div class="totem-price-card ze-price-block totem-product__price-block${opts.promoId ? ' totem-product__price-block--promo' : ''}" data-price-display>
<div class="totem-price-card__main">
${oldHtml}
<span class="totem-product__price totem-price-card__value">${formatPrice(packPrice)}</span>
</div>
${detailHtml}
${unitHtml}
</div>`;
    };

    const MAX_GRID_QTY = 999;

    const promptGridQty = (currentQty) => {
        const raw = window.prompt('Quantidade', String(Math.max(0, Number(currentQty) || 0)));
        if (raw == null) return null;
        const digits = String(raw).replace(/\D/g, '');
        if (!digits) return 0;
        return Math.min(MAX_GRID_QTY, Math.max(0, parseInt(digits, 10) || 0));
    };

    const resolveItemContext = (item, deps, tierOverride) => {
        const { catalog, pricing, promoOffers } = deps;
        const group = item?.group || null;
        const product = item?.product || item;
        const tier = activeTierForItem(item, pricing, tierOverride, promoOffers);
        const variant = group && pricing ? pricing.getVariant(group, tier) : null;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const itemKey = group?.key || product.id;
        const name = group?.baseName || product.name || '';
        const img = catalog.productImageUrl(group && pricing ? pricing.getTierImage(group, tier) : product.image);
        const offer = window.LigeirinhoPromoCatalog?.resolvePromoOffer?.(promoOffers, cartKey, itemKey, tier);
        return { group, product, tier, variant, cartKey, itemKey, name, img, offer };
    };

    const buildCatalogCardHtml = (item, index, deps, opts = {}) => {
        const { catalog, pricing, formatPrice, getCartQty } = deps;
        const ctx = resolveItemContext(item, deps);
        const { group, product, tier, variant, cartKey, itemKey, name, img, offer } = ctx;
        const qty = getCartQty?.(cartKey) || 0;
        const tiersHtml = group ? priceTiersHtml(group, tier, pricing, deps.promoOffers, itemKey) : '';
        const tiersSlotHtml =
            tiersHtml || '<div class="ze-price-tiers-slot ze-price-tiers-slot--spacer" aria-hidden="true"></div>';
        const priceOpts = {
            hidePackLabel: true,
            promoId: offer?.promoId,
            promoPrice: offer?.promoPrice,
            originalPrice: offer?.originalPrice,
            discountPct: offer?.discountPct,
        };
        const priceHtml = variant
            ? priceBlockHtml(variant, pricing, formatPrice, priceOpts)
            : `<div class="totem-price-card ze-price-block totem-product__price-block${offer?.promoId ? ' totem-product__price-block--promo' : ''}" data-price-display>
<div class="totem-price-card__main">
${offer?.originalPrice > (offer?.promoPrice ?? product.price) ? `<span class="totem-product__price-old">${formatPrice(offer.originalPrice)}</span>` : '<span class="totem-product__price-old totem-product__price-old--spacer" aria-hidden="true"></span>'}
<span class="totem-product__price totem-price-card__value">${formatPrice(offer?.promoPrice ?? product.price ?? 0)}</span>
</div>
<p class="totem-price-card__detail"></p>
<p class="totem-price-card__unit"></p>
</div>`;

        const selectedClass = qty ? ' totem-product--selected' : '';
        const promoClass = offer?.promoId ? ' totem-product--promo' : '';
        const scrollClass = opts.scroll ? ' totem-product--scroll' : '';
        const attrs = `role="listitem" data-group-key="${esc(group?.key || '')}" data-price-tier="${esc(tier)}" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-product-id="${esc(product.id || '')}"${offer?.promoId ? ` data-promo-id="${esc(offer.promoId)}"` : ''} style="--totem-card-i:${Math.min(index, 14)}"`;

        return `<article class="totem-product${selectedClass}${promoClass}${scrollClass}" ${attrs}>
<div class="totem-product__media">
${offer?.promoId ? promoTagHtml() : ''}
${offer?.promoId ? promoPayTagHtml() : ''}
${variant && !tiersHtml ? mediaPackTagHtml(variant, tier) : ''}
${mediaCartBadgeHtml(qty)}
${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-product__body">
<div class="totem-product__name">${esc(name)}</div>
<div class="totem-product__pricing">
${tiersSlotHtml}
<div class="totem-product__meta">${priceHtml}</div>
</div>
<div class="totem-product__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<button type="button" class="totem-qty-value totem-qty-edit" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-price-tier="${esc(tier)}" aria-label="Digitar quantidade">${qty}</button>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-price-tier="${esc(tier)}" aria-label="Aumentar">+</button>
</div>
</div>
</article>`;
    };

    const renderGridHtml = (items, deps) => {
        if (!items.length) return '';
        return items.map((item, index) => buildCatalogCardHtml(item, index, deps)).join('');
    };

    const renderScrollHtml = (items, deps) => {
        if (!items.length) return '';
        return items.map((item, index) => buildCatalogCardHtml(item, index, deps, { scroll: true })).join('');
    };

    const updateCardQty = (card, qty) => {
        if (!card) return;
        card.classList.toggle('totem-product--selected', qty > 0);
        const badge = card.querySelector('.totem-product__cart-badge');
        if (qty > 0) {
            if (badge) badge.textContent = String(qty);
            else {
                const media = card.querySelector('.totem-product__media');
                if (media) {
                    const span = document.createElement('span');
                    span.className = 'totem-product__badge totem-product__cart-badge';
                    span.setAttribute('aria-label', `${qty} no carrinho`);
                    span.textContent = String(qty);
                    media.appendChild(span);
                }
            }
        } else if (badge) {
            badge.remove();
        }
        const valueEl = card.querySelector('.totem-qty-value');
        if (valueEl) valueEl.textContent = String(qty);
        const minus = card.querySelector('.totem-minus');
        if (minus) minus.disabled = qty <= 0;
    };

    const updateCatalogCard = (card, item, deps) => {
        if (!card || !item) return;
        const wrapper = document.createElement('div');
        const index = Number(card.style.getPropertyValue('--totem-card-i')) || 0;
        wrapper.innerHTML = buildCatalogCardHtml(item, index, deps, {
            scroll: card.classList.contains('totem-product--scroll'),
        });
        const next = wrapper.firstElementChild;
        if (next) card.replaceWith(next);
    };

    const findItemForCard = (card, items) => {
        if (!card || !items?.length) return null;
        const itemKey = card.dataset.itemKey;
        const productId = card.dataset.productId;
        return (
            items.find((item) => {
                const group = item?.group;
                const product = item?.product || item;
                return (group?.key && group.key === itemKey) || product.id === productId || product.id === itemKey;
            }) || null
        );
    };

    const syncGridQty = (root, items, deps) => {
        root.querySelectorAll('.totem-product[data-item-key]').forEach((card) => {
            const item = findItemForCard(card, items);
            if (!item) return;
            const tier = card.dataset.priceTier || activeTierForItem(item, deps.pricing, null, deps.promoOffers);
            const ctx = resolveItemContext(item, deps, tier);
            updateCardQty(card, deps.getCartQty?.(ctx.cartKey) || 0);
        });
    };

    const bindCatalogGrid = (root, handlers, getItems) => {
        if (!root || root.dataset.parceirosCatalogBound === '1') return;
        root.dataset.parceirosCatalogBound = '1';
        const resolveDeps = () => handlers.getDeps?.() || handlers.deps || {};

        root.addEventListener('click', (e) => {
            const tierBtn = e.target.closest('.ze-price-tier');
            if (tierBtn) {
                const card = tierBtn.closest('.totem-product');
                if (!card) return;
                const items = getItems?.() || [];
                const item = findItemForCard(card, items);
                if (!item) return;
                card.dataset.priceTier = tierBtn.dataset.priceTier || card.dataset.priceTier;
                updateCatalogCard(card, item, resolveDeps());
                return;
            }

            const plus = e.target.closest('.totem-plus');
            if (plus) {
                const card = plus.closest('.totem-product');
                const items = getItems?.() || [];
                const item = findItemForCard(card, items);
                if (!item) return;
                const tier = card?.dataset?.priceTier || plus.dataset.priceTier;
                const ctx = resolveItemContext(item, resolveDeps(), tier);
                handlers.onAdd?.({ ...ctx, cartKey: ctx.cartKey, variant: ctx.variant, group: ctx.group, tier: ctx.tier, offer: ctx.offer });
                return;
            }

            const minus = e.target.closest('.totem-minus');
            if (minus) {
                const cartKey = minus.dataset.cartKey;
                if (!cartKey) return;
                handlers.onRemove?.({ cartKey });
                return;
            }

            const qtyEdit = e.target.closest('.totem-qty-edit');
            if (qtyEdit) {
                e.preventDefault();
                e.stopPropagation();
                const card = qtyEdit.closest('.totem-product');
                const items = getItems?.() || [];
                const item = findItemForCard(card, items);
                if (!item) return;
                const tier = card?.dataset?.priceTier || qtyEdit.dataset.priceTier;
                const deps = resolveDeps();
                const ctx = resolveItemContext(item, deps, tier);
                const currentQty = deps.getCartQty?.(ctx.cartKey) || 0;
                const qty = promptGridQty(currentQty);
                if (qty == null) return;
                handlers.onSetQty?.({ ...ctx, qty });
                return;
            }

            const card = e.target.closest('.totem-product[data-item-key]');
            if (card && !window.LigeirinhoParceirosProductDetail?.isInteractiveTarget?.(e.target)) {
                const items = getItems?.() || [];
                const item = findItemForCard(card, items);
                if (!item) return;
                const tier = card.dataset.priceTier;
                const deps = resolveDeps();
                const ctx = resolveItemContext(item, deps, tier);
                const offer = ctx.offer;
                window.LigeirinhoParceirosProductDetail?.open?.(
                    card.dataset.itemKey,
                    offer?.promoId ? offer : null,
                );
            }
        });
    };

    window.LigeirinhoParceirosProductCards = {
        buildCatalogCardHtml,
        renderGridHtml,
        renderScrollHtml,
        updateCardQty,
        updateCatalogCard,
        syncGridQty,
        bindCatalogGrid,
        resolveItemContext,
        findItemForCard,
        promptGridQty,
    };
})();
