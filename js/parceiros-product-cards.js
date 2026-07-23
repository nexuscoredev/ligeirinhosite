(function () {
    /** Cards de catálogo Parceiros — layout Totem (sem tag Pix/Dinheiro). */
    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const activeTierForItem = (item, pricing, tierOverride) => {
        if (tierOverride) return tierOverride;
        const group = item?.group || null;
        if (!group || !pricing) return item?.defaultTier || 'caixa';
        if (item?.defaultTier && pricing.getAvailableTiers(group).includes(item.defaultTier)) {
            return item.defaultTier;
        }
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

    const priceTiersHtml = (group, activeTier, pricing) => {
        if (!group || !pricing) return '';
        const tiers = pricing.getAvailableTiers(group) || [];
        if (tiers.length <= 1) return '';
        const buttons = tiers
            .map((tier) => {
                const active = tier === activeTier;
                const label =
                    pricing.TIER_SHORT?.[tier]?.toUpperCase() ||
                    pricing.TIER_LABELS?.[tier]?.toUpperCase() ||
                    String(tier).toUpperCase();
                return `<button type="button" class="ze-price-tier${active ? ' ze-price-tier--active' : ''}" data-price-tier="${esc(tier)}" aria-pressed="${active ? 'true' : 'false'}" aria-label="${esc(label)}">${esc(label)}</button>`;
            })
            .join('');
        return `<div class="ze-price-tiers-slot"><div class="ze-price-tiers" role="group" aria-label="Escolher embalagem">${buttons}</div></div>`;
    };

    const priceBlockHtml = (variant, pricing, formatPrice, opts = {}) => {
        if (!variant || !pricing) return '';
        const meta = pricing.pricePackMeta(variant);
        const packPrice = meta?.packagePrice ?? variant.price;
        const units = Math.max(1, Number(variant.packSize) || 1);
        const unitPrice = units > 1 ? Math.round((packPrice / units) * 100) / 100 : null;
        const showUnitBreakdown = units > 1 && unitPrice != null;
        const detailHtml = `<p class="totem-price-card__detail">${units > 1 && meta?.detail ? esc(meta.detail) : ''}</p>`;
        const unitHtml = `<p class="totem-price-card__unit">${
            showUnitBreakdown ? `${formatPrice(unitPrice)}<span> / un</span>` : ''
        }</p>`;

        return `<div class="totem-price-card ze-price-block totem-product__price-block" data-price-display>
<div class="totem-price-card__main">
<span class="totem-product__price totem-price-card__value">${formatPrice(packPrice)}</span>
</div>
${detailHtml}
${unitHtml}
</div>`;
    };

    const resolveItemContext = (item, deps, tierOverride) => {
        const { catalog, pricing } = deps;
        const group = item?.group || null;
        const product = item?.product || item;
        const tier = activeTierForItem(item, pricing, tierOverride);
        const variant = group && pricing ? pricing.getVariant(group, tier) : null;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const itemKey = group?.key || product.id;
        const name = group?.baseName || product.name || '';
        const img = catalog.productImageUrl(group && pricing ? pricing.getTierImage(group, tier) : product.image);
        return { group, product, tier, variant, cartKey, itemKey, name, img };
    };

    const buildCatalogCardHtml = (item, index, deps, opts = {}) => {
        const { catalog, pricing, formatPrice, getCartQty } = deps;
        const ctx = resolveItemContext(item, deps);
        const { group, product, tier, variant, cartKey, itemKey, name, img } = ctx;
        const qty = getCartQty?.(cartKey) || 0;
        const tiersHtml = group ? priceTiersHtml(group, tier, pricing) : '';
        const priceHtml = variant
            ? priceBlockHtml(variant, pricing, formatPrice)
            : `<div class="totem-price-card ze-price-block totem-product__price-block" data-price-display>
<div class="totem-price-card__main">
<span class="totem-product__price totem-price-card__value">${formatPrice(product.price ?? 0)}</span>
</div>
<p class="totem-price-card__detail"></p>
<p class="totem-price-card__unit"></p>
</div>`;
        const selectedClass = qty ? ' totem-product--selected' : '';
        const scrollClass = opts.scroll ? ' totem-product--scroll' : '';
        const attrs = `role="listitem" data-group-key="${esc(group?.key || '')}" data-price-tier="${esc(tier)}" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-product-id="${esc(product.id || '')}" style="--totem-card-i:${Math.min(index, 14)}"`;

        return `<article class="totem-product${selectedClass}${scrollClass}" ${attrs}>
<div class="totem-product__media">
${variant && !tiersHtml ? mediaPackTagHtml(variant, tier) : ''}
${qty ? `<span class="totem-product__badge totem-product__cart-badge" aria-label="${qty} no carrinho">${qty}</span>` : ''}
${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-product__body">
<div class="totem-product__name">${esc(catalog.shortName?.(name, opts.scroll ? 36 : 56) || name)}</div>
<div class="totem-product__pricing">
${tiersHtml}
<div class="totem-product__meta">${priceHtml}</div>
</div>
<div class="totem-product__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<span class="totem-qty-value">${qty}</span>
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
        return items
            .map((item, index) => buildCatalogCardHtml(item, index, deps, { scroll: true }))
            .join('');
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
                    media.prepend(span);
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
        const tier = card.dataset.priceTier || activeTierForItem(item, deps.pricing);
        const ctx = resolveItemContext(item, deps, tier);
        const { group, variant, cartKey, img } = ctx;
        const qty = deps.getCartQty?.(cartKey) || 0;

        card.dataset.cartKey = cartKey;
        card.dataset.priceTier = tier;

        const tiersSlot = card.querySelector('.ze-price-tiers-slot');
        const tiersHtml = group ? priceTiersHtml(group, tier, deps.pricing) : '';
        if (tiersSlot) {
            if (tiersHtml) tiersSlot.outerHTML = tiersHtml;
            else tiersSlot.remove();
        } else if (tiersHtml) {
            card.querySelector('.totem-product__pricing')?.insertAdjacentHTML('afterbegin', tiersHtml);
        }

        const priceBlock = card.querySelector('[data-price-display]');
        if (priceBlock) {
            const nextHtml = variant
                ? priceBlockHtml(variant, deps.pricing, deps.formatPrice)
                : `<div class="totem-price-card ze-price-block totem-product__price-block" data-price-display>
<div class="totem-price-card__main">
<span class="totem-product__price totem-price-card__value">${deps.formatPrice(ctx.product?.price ?? 0)}</span>
</div>
<p class="totem-price-card__detail"></p>
<p class="totem-price-card__unit"></p>
</div>`;
            priceBlock.outerHTML = nextHtml;
        }

        const imgEl = card.querySelector('.totem-product__media > img');
        if (imgEl && img) imgEl.src = img;

        let packTag = card.querySelector('.totem-product__pack-tag');
        if (variant && !tiersHtml) {
            const packHtml = mediaPackTagHtml(variant, tier);
            if (packHtml) {
                if (packTag) packTag.outerHTML = packHtml;
                else card.querySelector('.totem-product__media')?.insertAdjacentHTML('afterbegin', packHtml);
            }
        } else if (packTag) {
            packTag.remove();
        }

        const plus = card.querySelector('.totem-plus');
        if (plus) {
            plus.dataset.cartKey = cartKey;
            plus.dataset.priceTier = tier;
        }
        const minus = card.querySelector('.totem-minus');
        if (minus) minus.dataset.cartKey = cartKey;

        updateCardQty(card, qty);
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
            const tier = card.dataset.priceTier || activeTierForItem(item, deps.pricing);
            const ctx = resolveItemContext(item, deps, tier);
            updateCardQty(card, deps.getCartQty?.(ctx.cartKey) || 0);
        });
    };

    const bindCatalogGrid = (root, handlers, getItems) => {
        if (!root || root.dataset.parceirosCatalogBound === '1') return;
        root.dataset.parceirosCatalogBound = '1';

        root.addEventListener('click', (e) => {
            const tierBtn = e.target.closest('.ze-price-tier');
            if (tierBtn) {
                const card = tierBtn.closest('.totem-product');
                if (!card) return;
                const items = getItems?.() || [];
                const item = findItemForCard(card, items);
                if (!item) return;
                card.dataset.priceTier = tierBtn.dataset.priceTier || card.dataset.priceTier;
                updateCatalogCard(card, item, handlers.deps);
                return;
            }

            const plus = e.target.closest('.totem-plus');
            if (plus) {
                const card = plus.closest('.totem-product');
                const items = getItems?.() || [];
                const item = findItemForCard(card, items);
                if (!item) return;
                const tier = card?.dataset?.priceTier || plus.dataset.priceTier;
                const ctx = resolveItemContext(item, handlers.deps, tier);
                handlers.onAdd?.({ ...ctx, cartKey: ctx.cartKey, variant: ctx.variant, group: ctx.group, tier: ctx.tier });
                return;
            }

            const minus = e.target.closest('.totem-minus');
            if (minus) {
                const cartKey = minus.dataset.cartKey;
                if (!cartKey) return;
                handlers.onRemove?.({ cartKey });
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
    };
})();
