(function () {
    const catalog = () => window.LigeirinhoCatalog;
    const pricing = () => window.LigeirinhoPricing;
    const promoCatalog = () => window.LigeirinhoPromoCatalog;

    let deps = null;
    let bound = false;
    let promoEntries = [];
    let fetchError = false;
    let promoLoader = null;

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const getLoader = () => {
        if (!promoLoader && promoCatalog()?.createHubPromoLoader) {
            promoLoader = promoCatalog().createHubPromoLoader('/api/totem/promocoes');
        }
        return promoLoader;
    };

    const buildCartCtx = (entry) => {
        const { promo, item } = entry;
        const group = item?.group || null;
        const product = item?.product;
        const tier = group ? pricing()?.getDefaultTier?.(group) : item?.defaultTier || null;
        const variant = group && tier ? pricing()?.getVariant?.(group, tier) : null;
        const cartKey = variant ? catalog()?.cartKeyFor?.(variant) : product?.id || '';
        const originalPrice =
            promo.originalPrice != null && Number.isFinite(Number(promo.originalPrice))
                ? Number(promo.originalPrice)
                : variant?.price ?? product?.price ?? 0;
        const promoPrice =
            promo.promoPrice != null && Number.isFinite(Number(promo.promoPrice))
                ? Number(promo.promoPrice)
                : originalPrice;
        const discountPct =
            promo.discountPct != null && Number.isFinite(Number(promo.discountPct))
                ? Number(promo.discountPct)
                : originalPrice > 0
                  ? Math.max(0, Math.round((1 - promoPrice / originalPrice) * 100))
                  : 0;
        return {
            group,
            product,
            tier,
            variant,
            cartKey,
            originalPrice,
            promoPrice,
            discountPct,
            promo,
            item,
        };
    };

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

    const formatPrice = (value) => deps?.formatPrice?.(value) ?? catalog()?.formatPrice?.(value) ?? String(value ?? '');

    const buildPromoPriceHtml = (ctx) => {
        const unitPrice = ctx.promoPrice;
        const unitOriginal = ctx.originalPrice;
        const showOld = ctx.discountPct > 0 && unitOriginal > unitPrice;
        return `<div class="totem-price-card ze-price-block totem-product__price-block totem-product__price-block--promo" data-price-display>
<div class="totem-price-card__main">
${showOld ? `<span class="totem-product__price-old">${formatPrice(unitOriginal)}</span>` : ''}
<span class="totem-product__price totem-price-card__value">${formatPrice(unitPrice)}</span>
${ctx.discountPct > 0 ? `<span class="totem-product__promo-badge">-${ctx.discountPct}%</span>` : ''}
</div>
</div>`;
    };

    const buildPromoOnlyCardHtml = (entry, index) => {
        const { promo } = entry;
        const ctx = buildCartCtx(entry);
        const name = promo.name || promo.hubProductName || 'Promoção';
        const imgSrc = promo.imageUrl ? catalog().productImageUrl(promo.imageUrl) : '';
        const validade = promoCatalog()?.formatValidade?.(promo) || '';
        const attrs = `role="listitem" data-promo-id="${esc(promo.id || '')}" data-promo-unlinked="true" style="--totem-card-i:${Math.min(index, 14)}"`;

        return `<article class="totem-product totem-product--promo totem-product--promo-unlinked" ${attrs}>
<div class="totem-product__media">
${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-product__body">
<div class="totem-product__name">${esc(catalog().shortName?.(name, 56) || name)}</div>
<div class="totem-product__pricing">
<div class="totem-product__meta">${buildPromoPriceHtml(ctx)}</div>
${validade ? `<p class="totem-product__promo-valid">${esc(validade)}</p>` : ''}
</div>
<p class="totem-product__promo-note">Indisponível no catálogo do totem</p>
</div>
</article>`;
    };

    const buildPromoCardHtml = (entry, index) => {
        if (!entry?.item) return buildPromoOnlyCardHtml(entry, index);

        const ctx = buildCartCtx(entry);
        const { group, product, tier, cartKey, promo } = ctx;
        if (!product || !cartKey) return buildPromoOnlyCardHtml(entry, index);

        const qty = deps?.getCartQty?.(cartKey) || 0;
        const itemKey = group?.key || product.id;
        const name = promo.name || promo.hubProductName || group?.baseName || product.name || 'Promoção';
        const imgSrc = promo.imageUrl
            ? catalog().productImageUrl(promo.imageUrl)
            : catalog().productImageUrl(group && pricing() ? pricing().getTierImage(group, tier) : product.image);
        const selectedClass = qty ? ' totem-product--selected' : '';
        const validade = promoCatalog()?.formatValidade?.(promo) || '';
        const attrs = `role="listitem" data-group-key="${esc(group?.key || '')}" data-price-tier="${esc(tier)}" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-promo-id="${esc(promo.id || '')}" style="--totem-card-i:${Math.min(index, 14)}"`;

        const packTag = `<span class="totem-product__pack-tag" aria-label="Embalagem Caixa"><span class="totem-product__pack-tag-label">Caixa</span></span>`;

        const mediaHtml = `<div class="totem-product__media">
${packTag}
${qty ? `<span class="totem-product__badge totem-product__cart-badge" aria-label="${qty} no carrinho">${qty}</span>` : ''}
${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>`;

        const qtyHtml = `<div class="totem-product__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<span class="totem-qty-value">${qty}</span>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" aria-label="Aumentar">+</button>
</div>`;

        const bodyHtml = `<div class="totem-product__body">
<div class="totem-product__name">${esc(catalog().shortName?.(name, 56) || name)}</div>
<div class="totem-product__pricing">
<div class="totem-product__meta">${buildPromoPriceHtml(ctx)}</div>
${validade ? `<p class="totem-product__promo-valid">${esc(validade)}</p>` : ''}
</div>
${qtyHtml}
</div>`;

        return `<article class="totem-product totem-product--promo${selectedClass}" ${attrs}>
${mediaHtml}
${bodyHtml}
</article>`;
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

    const syncCart = () => {
        if (!deps?.gridEl || !promoEntries.length) return;
        promoEntries.forEach((entry) => {
            const ctx = buildCartCtx(entry);
            if (!ctx.cartKey) return;
            const card = deps.gridEl.querySelector(`[data-cart-key="${ctx.cartKey}"]`);
            updateCardQty(card, deps.getCartQty?.(ctx.cartKey) || 0);
        });
    };

    const renderGrid = () => {
        if (!deps?.gridEl) return;
        if (!promoEntries.length) {
            setPanelVisibility({ showEmpty: true });
            deps.gridEl.innerHTML = '';
            deps.gridEl.classList.remove('totem-promos__grid--carousel');
            return;
        }

        setPanelVisibility({ showGrid: true });
        deps.gridEl.classList.remove('totem-promos__grid--carousel');
        deps.gridEl.innerHTML = `<div class="totem-grid totem-grid--grid-m totem-grid--promos" role="list">
${promoEntries.map((entry, index) => buildPromoCardHtml(entry, index)).join('')}
</div>`;
    };

    const getPromoCatalogItems = () =>
        deps?.getPromoCatalogItems?.() || deps?.getDisplayItems?.() || [];

    const loadPromos = async (force = false) => {
        const loader = getLoader();
        if (!loader) {
            fetchError = true;
            promoEntries = [];
            return;
        }
        const catalogItems = getPromoCatalogItems();
        const promocoes = await loader.load(force);
        fetchError = loader.hadError?.() && !promocoes.length;
        promoEntries = promoCatalog().buildPromoEntries(promocoes, catalogItems, { matchedOnly: true });
        const seenCartKeys = new Set();
        promoEntries = promoEntries.filter((entry) => {
            const cartKey = buildCartCtx(entry).cartKey;
            if (!cartKey || seenCartKeys.has(cartKey)) return false;
            seenCartKeys.add(cartKey);
            return true;
        });
    };

    const render = async (options = {}) => {
        if (!deps?.gridEl) return;
        const force = Boolean(options.force);
        setPanelVisibility({ showLoading: true });
        await loadPromos(force);
        if (fetchError && !promoEntries.length) {
            setPanelVisibility({ showError: true });
            return;
        }
        if (!promoEntries.length) {
            setPanelVisibility({ showEmpty: true });
            deps.gridEl.innerHTML = '';
            return;
        }
        renderGrid();
    };

    const bindGrid = () => {
        if (!deps?.gridEl || bound) return;
        bound = true;
        deps.retryBtn?.addEventListener('click', () => refresh());
        deps.gridEl.addEventListener('click', (e) => {
            const plus = e.target.closest('.totem-plus');
            const minus = e.target.closest('.totem-minus');
            if (plus) {
                const entry = promoEntries.find((item) => buildCartCtx(item).cartKey === plus.dataset.cartKey);
                if (!entry?.item) return;
                const ctx = buildCartCtx(entry);
                deps.addPromoItem?.(ctx.cartKey, ctx.group?.key || ctx.product?.id, {
                    promoPrice: ctx.promoPrice,
                    promoId: ctx.promo?.id,
                });
                syncCart();
                return;
            }
            if (minus) {
                deps.changeQty?.(minus.dataset.cartKey, -1);
                syncCart();
            }
        });
    };

    const init = async (nextDeps) => {
        deps = nextDeps;
        bindGrid();
        await render();
    };

    const refresh = async (options = {}) => {
        const force = Boolean(options?.force);
        if (force) getLoader()?.clear?.();
        fetchError = false;
        await render({ force: true });
    };

    const invalidate = () => {
        getLoader()?.clear?.();
        fetchError = false;
    };

    window.addEventListener('ligeirinho-catalog-sync-start', () => {
        invalidate();
    });

    window.LigeirinhoTotemPromos = {
        init,
        render,
        refresh,
        invalidate,
        syncCart,
        closeLightbox: () => {},
        stopAuto: () => {},
        startAuto: () => {},
    };
})();
