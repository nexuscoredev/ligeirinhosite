(function () {
    let deps = null;
    let bound = false;
    let loading = false;

    const promoCatalog = window.LigeirinhoPromoCatalog;
    const promoLoader = promoCatalog?.createHubPromoLoader('/api/promocoes');

    const setPanelVisibility = ({ showLoading = false, showError = false, showGrid = false, showEmpty = false } = {}) => {
        const { loadingEl, errorEl, gridEl, emptyEl } = deps || {};
        if (loadingEl) {
            loadingEl.hidden = !showLoading;
            loadingEl.style.display = showLoading ? '' : 'none';
        }
        if (errorEl) {
            errorEl.hidden = !showError;
            errorEl.style.display = showError ? '' : 'none';
        }
        if (gridEl) {
            gridEl.hidden = !showGrid;
            gridEl.style.display = showGrid ? '' : 'none';
        }
        if (emptyEl) {
            emptyEl.hidden = !showEmpty;
            emptyEl.style.display = showEmpty ? '' : 'none';
        }
    };

    const buildEntries = async () => {
        if (!promoLoader || !promoCatalog) return [];
        const promos = await promoLoader.load();
        return promoCatalog.buildPromoEntries(promos, deps?.getDisplayItems?.() || []);
    };

    const buildCardHtml = (entry, index) => {
        const { catalog, pricing, cartApi, formatPrice, esc } = deps;
        const { promo, item } = entry;
        const matched = Boolean(item);
        const group = item?.group || null;
        const product = item?.product;
        const tier = group ? pricing.getDefaultTier(group) : item?.defaultTier || 'caixa';
        const variant = group ? pricing.getVariant(group, tier) : null;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product?.id || '';
        const cart = cartApi.loadCart();
        const qty = cartKey ? cart[cartKey]?.qty || 0 : 0;
        const originalPrice = promo.originalPrice ?? variant?.price ?? product?.price ?? 0;
        const promoPrice = promo.promoPrice ?? originalPrice;
        const discountPct =
            promo.discountPct ||
            (originalPrice > 0 ? Math.max(0, Math.round((1 - promoPrice / originalPrice) * 100)) : 0);
        const img = promo.imageUrl
            ? catalog.productImageUrl(promo.imageUrl)
            : catalog.productImageUrl(group && pricing ? pricing.getTierImage(group, tier) : product?.image);
        const name = promo.name || group?.baseName || product?.name || 'Promoção';
        const itemKey = group?.key || product?.id || promo.id;
        const packLabel =
            tier === 'caixa' && variant?.packSize
                ? `CAIXA × ${variant.packSize}`
                : promo.sku
                  ? `SKU ${promo.sku}`
                  : 'PROMOÇÃO';
        const validade = promoCatalog.formatValidade(promo);
        const selectedClass = qty ? ' totem-promo-card--selected' : '';
        const unavailableClass = matched ? '' : ' totem-promo-card--unavailable';
        const attrs = matched
            ? `role="listitem" data-group-key="${esc(group?.key || '')}" data-price-tier="${esc(tier)}" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-promo-id="${esc(promo.id)}" data-promo-price="${esc(promoPrice)}" style="--totem-promo-i:${Math.min(index, 16)}"`
            : `role="listitem" data-promo-id="${esc(promo.id)}" style="--totem-promo-i:${Math.min(index, 16)}"`;

        return `<article class="totem-promo-card${selectedClass}${unavailableClass}" ${attrs}>
<div class="totem-promo-card__shine" aria-hidden="true"></div>
${discountPct > 0 ? `<span class="totem-promo-card__pct">-${discountPct}%</span>` : ''}
<div class="totem-promo-card__media">
${qty ? `<span class="totem-product__badge" aria-label="${qty} no carrinho">${qty}</span>` : ''}
${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-promo-card__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-promo-card__body">
<p class="totem-promo-card__pack">${esc(packLabel)}</p>
<h3 class="totem-promo-card__name">${esc(name)}</h3>
${validade ? `<p class="totem-promo-card__validity">${esc(validade)}</p>` : ''}
<p class="totem-promo-card__prices">
<span class="totem-promo-card__old">${formatPrice(originalPrice)}</span>
<span class="totem-promo-card__price">${formatPrice(promoPrice)}</span>
</p>
${!matched ? '<p class="totem-promo-card__unavailable">Produto indisponível nesta unidade</p>' : ''}
</div>
${
    matched
        ? `<div class="totem-promo-card__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<span class="totem-qty-value">${qty}</span>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-promo-id="${esc(promo.id)}" data-promo-price="${esc(promoPrice)}" aria-label="Aumentar">+</button>
</div>`
        : ''
}
</article>`;
    };

    const render = async () => {
        if (!deps?.gridEl || !promoLoader) return;
        loading = true;
        setPanelVisibility({ showLoading: true });
        const entries = await buildEntries();
        loading = false;

        if (promoLoader.hadError() && !entries.length) {
            setPanelVisibility({ showError: true });
            return;
        }

        if (!entries.length) {
            setPanelVisibility({ showEmpty: true });
            return;
        }

        setPanelVisibility({ showGrid: true });
        deps.gridEl.innerHTML = entries.map((entry, i) => buildCardHtml(entry, i)).join('');
    };

    const bindGrid = () => {
        if (!deps?.gridEl || bound) return;
        bound = true;
        deps.gridEl.addEventListener('click', (e) => {
            const plus = e.target.closest('.totem-plus');
            const minus = e.target.closest('.totem-minus');
            if (plus) {
                const promoPrice = Number(plus.dataset.promoPrice);
                deps.onAdd?.(plus.dataset.cartKey, plus.dataset.itemKey, {
                    promoPrice: Number.isFinite(promoPrice) ? promoPrice : undefined,
                    promoId: plus.dataset.promoId || undefined,
                });
                render();
                return;
            }
            if (minus) {
                deps.onChangeQty?.(minus.dataset.cartKey, -1);
                render();
                return;
            }
            const card = e.target.closest('.totem-promo-card');
            if (card?.classList.contains('totem-promo-card--unavailable')) return;
            if (card?.dataset?.itemKey) {
                deps.onOpenDetail?.(card.dataset.itemKey);
                deps.onBumpIdle?.();
            }
        });
        deps.retryBtn?.addEventListener('click', () => refresh());
    };

    const init = async (nextDeps) => {
        deps = nextDeps;
        bindGrid();
        await render();
    };

    const refresh = async () => {
        promoLoader?.clear();
        await promoLoader?.load(true);
        await render();
    };

    window.LigeirinhoTotemPromos = { init, render, refresh };
})();
