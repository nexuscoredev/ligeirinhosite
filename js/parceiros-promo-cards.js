(function () {
    /** Cards de promoção Parceiros — réplica do Totem (totem-promos.js). */
    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const resolveTier = (entry, promoCatalog) =>
        promoCatalog.tierForPromoUnit(promoCatalog.normalizePromoUnit(entry?.promo?.unidade));

    const resolvePromoVariant = (entry, promoCatalog, pricing, catalog) => {
        const { promo, item } = entry || {};
        const group = item?.group || null;
        const product = item?.product;
        const tier = resolveTier(entry, promoCatalog);
        const fromGroup = group && tier ? pricing?.getVariant?.(group, tier) : null;
        if (fromGroup?.tier === tier) return fromGroup;

        const promoUnit = promoCatalog.normalizePromoUnit(promo?.unidade);
        const packSize =
            tier === 'unidade'
                ? 1
                : Math.max(
                      1,
                      Number(promo?.fatorMultiplicacao) ||
                          Number(fromGroup?.packSize) ||
                          Number(product?.fatorMultiplicacao) ||
                          1,
                  );

        return {
            id: String(promo?.catalogProductId || product?.id || promo?.hubProductId || '').trim(),
            hubId: String(promo?.hubProductId || product?.hubId || '').trim() || null,
            sku: String(promo?.sku || product?.sku || '').trim() || null,
            name: String(promo?.name || promo?.hubProductName || product?.name || '').trim(),
            price:
                promo?.originalPrice != null && Number.isFinite(Number(promo.originalPrice))
                    ? Number(promo.originalPrice)
                    : Number(fromGroup?.price ?? product?.price ?? promo?.promoPrice ?? 0),
            packSize,
            tier,
            tierLabel: pricing?.TIER_LABELS?.[tier] || tier,
            image: promo?.imageUrl || product?.image || group?.image || '',
            unidade: promoUnit,
        };
    };

    const buildCartCtx = (entry, { promoCatalog, pricing, catalog }) => {
        const { promo, item } = entry || {};
        const group = item?.group || null;
        const product = item?.product;
        const tier = resolveTier(entry, promoCatalog);
        const variant = resolvePromoVariant(entry, promoCatalog, pricing, catalog);
        const cartKey = variant?.id ? catalog?.cartKeyFor?.(variant) : product?.id || '';
        const originalPrice =
            promo?.originalPrice != null && Number.isFinite(Number(promo.originalPrice))
                ? Number(promo.originalPrice)
                : variant?.price ?? product?.price ?? 0;
        const promoPrice =
            promo?.promoPrice != null && Number.isFinite(Number(promo.promoPrice))
                ? Number(promo.promoPrice)
                : originalPrice;
        const discountPct =
            promo?.discountPct != null && Number.isFinite(Number(promo.discountPct))
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
            promoUnit: promoCatalog.normalizePromoUnit(promo?.unidade),
        };
    };

    const activeUnitForGroup = (grupo, selectedUnits, promoCatalog) =>
        selectedUnits.get(grupo.chave) || promoCatalog.unidadePadraoPromoGrupo(grupo);

    const activeEntryForGroup = (grupo, selectedUnits, promoCatalog) =>
        promoCatalog.entryAtivoPromoGrupo(grupo, activeUnitForGroup(grupo, selectedUnits, promoCatalog));

    const preparePromoGroups = (promos, catalogItems, promoCatalog) => {
        const entries = promoCatalog
            .buildPromoEntries(promos, catalogItems, { matchedOnly: false })
            .map((entry) => promoCatalog.enrichPromoEntry(entry, catalogItems))
            .filter((entry) => entry.item);

        const groups = promoCatalog.agruparPromocoesTotem(entries);
        const selectedUnits = new Map();
        groups.forEach((grupo) => {
            selectedUnits.set(grupo.chave, promoCatalog.unidadePadraoPromoGrupo(grupo));
        });
        return { groups, selectedUnits };
    };

    const buildPromoPriceHtml = (ctx, formatPrice, pricing) => {
        const packPrice = ctx.promoPrice;
        const packOriginal = ctx.originalPrice;
        const showOld = ctx.discountPct > 0 && packOriginal > packPrice;
        const isUnitPromo = ctx.tier === 'unidade' || ctx.promoUnit === 'UN';
        const packSize = isUnitPromo
            ? 1
            : Math.max(
                  1,
                  Number(ctx.variant?.packSize) ||
                      Number(ctx.promo?.fatorMultiplicacao) ||
                      Number(ctx.product?.fatorMultiplicacao) ||
                      1,
              );
        let unitPrice = null;
        if (!isUnitPromo && ctx.variant && pricing?.getUnitPrice) {
            unitPrice = pricing.getUnitPrice({
                ...ctx.variant,
                price: packPrice,
                tier: ctx.tier,
            });
        } else if (!isUnitPromo && packSize > 1) {
            unitPrice = Math.round((packPrice / packSize) * 100) / 100;
        }
        const showUnitBreakdown = !isUnitPromo && packSize > 1 && unitPrice != null;
        let detailText = '';
        if (!isUnitPromo && ctx.variant && pricing?.pricePackMeta) {
            const meta = pricing.pricePackMeta({ ...ctx.variant, price: packPrice, tier: ctx.tier });
            detailText = meta?.detail || '';
        } else if (!isUnitPromo && packSize > 1) {
            detailText = ctx.tier === 'pallet' ? `PL c/ ${packSize}` : `CX c/ ${packSize} un`;
        }
        const detailHtml = `<p class="totem-price-card__detail">${detailText ? esc(detailText) : ''}</p>`;
        const unitHtml = `<p class="totem-price-card__unit">${
            showUnitBreakdown ? `${formatPrice(unitPrice)}<span> / un</span>` : ''
        }</p>`;

        return `<div class="totem-price-card ze-price-block totem-product__price-block totem-product__price-block--promo" data-price-display>
<div class="totem-price-card__main">
${showOld ? `<span class="totem-product__price-old">${formatPrice(packOriginal)}</span>` : ''}
<span class="totem-product__price totem-price-card__value">${formatPrice(packPrice)}</span>
</div>
${detailHtml}
${unitHtml}
</div>`;
    };

    const promoTagHtml = () =>
        '<span class="totem-product__promo-tag" aria-label="Produto em promoção"><img src="img/tag-promocao.png?v=1" alt="" aria-hidden="true"></span>';

    const promoPayTagHtml = () =>
        `<span class="totem-product__pay-tag" aria-label="Pagamento apenas Pix ou Dinheiro"><img src="img/tag-pix-dinheiro.png?v=transparent" alt="" aria-hidden="true"></span>`;

    const mediaPackTagHtml = (promoUnit, promoCatalog) => {
        const packLabel = promoCatalog.tagEmbalagemPromoTotem(promoUnit);
        if (!packLabel) return '';
        return `<span class="totem-product__pack-tag" aria-label="Embalagem ${esc(packLabel)}"><span class="totem-product__pack-tag-label">${esc(packLabel)}</span></span>`;
    };

    const buildUnitToggleHtml = (grupo, selectedUnits, promoCatalog) => {
        if (!grupo.multiplo) return '';
        const active = activeUnitForGroup(grupo, selectedUnits, promoCatalog);
        return `<div class="totem-promo-unit-toggle" role="group" aria-label="Escolher unidade ou caixa">
${grupo.unidadesDisponiveis
    .map((unit) => {
        const isActive = unit === active;
        return `<button type="button" class="totem-promo-unit-btn${isActive ? ' totem-promo-unit-btn--active' : ''}" data-promo-group-key="${esc(grupo.chave)}" data-promo-unit="${esc(unit)}" aria-pressed="${isActive ? 'true' : 'false'}">${esc(promoCatalog.rotuloUnidadePromoTotem(unit))}</button>`;
    })
    .join('')}
</div>`;
    };

    const buildPromoOnlyCardHtml = (grupo, entry, index, deps) => {
        const { promoCatalog, catalog, pricing, formatPrice } = deps;
        const { promo } = entry;
        const ctx = buildCartCtx(entry, deps);
        const name = grupo.nomeExibicao || promo.name || promo.hubProductName || 'Promoção';
        const imgSrc = promo.imageUrl ? catalog.productImageUrl(promo.imageUrl) : '';
        const validade = promoCatalog.formatValidade(promo);
        const attrs = `role="listitem" data-promo-group-key="${esc(grupo.chave)}" data-item-key="${esc(ctx.product?.id || '')}" data-promo-id="${esc(promo.id || '')}" data-promo-unlinked="true" style="--totem-card-i:${Math.min(index, 14)}"`;

        return `<article class="totem-product totem-product--promo totem-product--promo-unlinked" ${attrs}>
<div class="totem-product__media">
${promoTagHtml()}
${promoPayTagHtml()}
${mediaPackTagHtml(ctx.promoUnit, promoCatalog)}
${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-product__body">
<div class="totem-product__name">${esc(catalog.shortName?.(name, 56) || name)}</div>
${buildUnitToggleHtml(grupo, deps.selectedUnits, promoCatalog)}
<div class="totem-product__pricing">
<div class="totem-product__meta">${buildPromoPriceHtml(ctx, formatPrice, pricing)}</div>
${validade ? `<p class="totem-product__promo-valid">${esc(validade)}</p>` : ''}
</div>
<p class="totem-product__promo-note">Indisponível no catálogo</p>
</div>
</article>`;
    };

    const buildPromoCardHtml = (grupo, index, deps) => {
        const { promoCatalog, catalog, pricing, formatPrice, getCartQty, selectedUnits } = deps;
        const entry = activeEntryForGroup(grupo, selectedUnits, promoCatalog);
        if (!entry) return '';
        if (!entry.item) return buildPromoOnlyCardHtml(grupo, entry, index, deps);

        const ctx = buildCartCtx(entry, deps);
        const { group, product, tier, cartKey, promo } = ctx;
        if (!product || !cartKey) return buildPromoOnlyCardHtml(grupo, entry, index, deps);

        const qty = getCartQty?.(cartKey) || 0;
        const itemKey = group?.key || product.id;
        const name = grupo.nomeExibicao || promo.name || promo.hubProductName || group?.baseName || product.name || 'Promoção';
        const imgSrc = promo.imageUrl
            ? catalog.productImageUrl(promo.imageUrl)
            : catalog.productImageUrl(group && pricing ? pricing.getTierImage(group, tier) : product.image);
        const selectedClass = qty ? ' totem-product--selected' : '';
        const validade = promoCatalog.formatValidade(promo);
        const packTag = mediaPackTagHtml(ctx.promoUnit, promoCatalog);
        const attrs = `role="listitem" data-promo-group-key="${esc(grupo.chave)}" data-group-key="${esc(group?.key || '')}" data-price-tier="${esc(tier)}" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-promo-id="${esc(promo.id || '')}" style="--totem-card-i:${Math.min(index, 14)}"`;

        return `<article class="totem-product totem-product--promo${selectedClass}" ${attrs}>
<div class="totem-product__media">
${promoTagHtml()}
${promoPayTagHtml()}
${packTag}
${qty ? `<span class="totem-product__badge totem-product__cart-badge" aria-label="${qty} no carrinho">${qty}</span>` : ''}
${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-product__body">
<div class="totem-product__name">${esc(catalog.shortName?.(name, 56) || name)}</div>
${buildUnitToggleHtml(grupo, selectedUnits, promoCatalog)}
<div class="totem-product__pricing">
<div class="totem-product__meta">${buildPromoPriceHtml(ctx, formatPrice, pricing)}</div>
${validade ? `<p class="totem-product__promo-valid">${esc(validade)}</p>` : ''}
</div>
<div class="totem-product__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<span class="totem-qty-value">${qty}</span>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-price-tier="${esc(tier)}" aria-label="Aumentar">+</button>
</div>
</div>
</article>`;
    };

    const renderGridHtml = (groups, deps) => {
        if (!groups.length) return '';
        return `<div class="totem-grid totem-grid--grid-m totem-grid--promos" role="list">
${groups.map((grupo, index) => buildPromoCardHtml(grupo, index, deps)).join('')}
</div>`;
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

    window.LigeirinhoParceirosPromoCards = {
        buildCartCtx,
        activeEntryForGroup,
        activeUnitForGroup,
        preparePromoGroups,
        buildPromoCardHtml,
        renderGridHtml,
        updateCardQty,
    };
})();
