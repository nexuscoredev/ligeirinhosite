(function () {
    /** Modal de detalhes do produto — réplica do Totem para Parceiros. */
    const catalog = window.LigeirinhoCatalog;
    const pricing = window.LigeirinhoPricing;
    const cartApi = window.LigeirinhoCart;
    const promoCatalog = window.LigeirinhoPromoCatalog;

    if (!catalog || !pricing || !cartApi) return;

    const PANEL_ID = 'parceiros-product-detail';
    let detailPanel = null;
    let detailSheet = null;
    let config = null;

    let detailItemKey = null;
    let detailPromoOpts = null;
    let detailDraftQty = 1;
    const detailPayModeByTier = new Map();

    const esc = (value) => catalog.escapeHtml(String(value ?? ''));
    const formatPrice = (value) => catalog.formatPrice(value);

    const ensurePanel = () => {
        detailPanel = document.getElementById(PANEL_ID);
        if (detailPanel) {
            detailSheet = detailPanel.querySelector('.totem-detail__sheet');
            return;
        }
        detailPanel = document.createElement('div');
        detailPanel.id = PANEL_ID;
        detailPanel.className = 'totem-detail';
        detailPanel.setAttribute('aria-hidden', 'true');
        detailPanel.innerHTML =
            '<div class="totem-detail__sheet" role="dialog" aria-modal="true" aria-labelledby="parceiros-detail-heading"></div>';
        document.body.appendChild(detailPanel);
        detailSheet = detailPanel.querySelector('.totem-detail__sheet');
    };

    const detailPayModeFor = (tier) => detailPayModeByTier.get(tier) || 'pix';

    const setDetailPayMode = (tier, mode) => {
        if (!tier || (mode !== 'pix' && mode !== 'card')) return;
        detailPayModeByTier.set(tier, mode);
    };

    const extractVolume = (name) => {
        const match = String(name || '').match(/(\d+)\s*ml/i);
        return match ? `${match[1]} ml` : '';
    };

    const isReturnable = (name) => /retorn[aá]vel/i.test(String(name || ''));

    const tierPackBadge = (tier, variant) => {
        if (tier === 'caixa' && variant?.packSize) return `CAIXA X ${variant.packSize}`;
        if (tier === 'pallet' && variant?.boxCount) return `PALLET ${variant.boxCount} CX`;
        if (tier === 'unidade') return 'UNIDADE';
        return pricing.TIER_SHORT?.[tier]?.toUpperCase() || '';
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

    const findDisplayItem = (itemKey) => {
        const items = config?.getDisplayItems?.() || [];
        return (
            items.find((item) => {
                const group = item?.group;
                const product = item?.product || item;
                return (group?.key && group.key === itemKey) || product.id === itemKey;
            }) || null
        );
    };

    const activeTierForItem = (item) => {
        const group = item?.group || null;
        if (!group) return item?.defaultTier || 'caixa';
        const promoOffers = config?.getPromoOffers?.() || {};
        const tiers = pricing.getTotemAvailableTiers?.(group) || pricing.getAvailableTiers(group) || [];
        const itemKey = group.key;

        if (promoOffers?.byItemKey?.[itemKey]?.tier && tiers.includes(promoOffers.byItemKey[itemKey].tier)) {
            return promoOffers.byItemKey[itemKey].tier;
        }
        for (const tier of tiers) {
            const variant = pricing.getVariant(group, tier);
            const cartKey = variant ? catalog.cartKeyFor(variant) : '';
            if (cartKey && promoOffers?.byCartKey?.[cartKey]) return tier;
        }
        if (item?.defaultTier && tiers.includes(item.defaultTier)) return item.defaultTier;
        return pricing.getDefaultTier(group);
    };

    const resolvePromoOffer = (cartKey, itemKey, tier) => {
        const index = config?.getPromoOffers?.() || {};
        return promoCatalog?.resolvePromoOffer?.(index, cartKey, itemKey, tier) || null;
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

    const getDetailContext = () => {
        if (!detailItemKey) return null;
        const item = findDisplayItem(detailItemKey);
        if (!item) return null;
        const group = item.group;
        const tier =
            detailPromoOpts?.tier || (group ? activeTierForItem(item) : item.defaultTier || 'caixa');
        const variant = group ? pricing.getVariant(group, tier) : null;
        const product = item.product;
        const cartKey = variant ? catalog.cartKeyFor(variant) : product.id;
        const qty = catalog.getCartQty(cartKey);
        const img = catalog.productImageUrl(group ? pricing.getTierImage(group, tier) : product.image);
        const displayName = group
            ? pricing.cartItemName({ ...variant, tier }, group)
            : product.name;
        return { item, group, tier, variant, product, cartKey, qty, img, displayName };
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
            const catalogPrice = Number(refVariant.price);
            let blockPrice = isPromoTier ? Number(tierPromo.promoPrice) : catalogPrice;
            let originalPrice = isPromoTier
                ? Number(tierPromo.originalPrice ?? catalogPrice)
                : null;

            if (tierKey === 'pallet' && group?.variants?.pallet && group?.variants?.caixa) {
                const cxVar = group.variants.caixa;
                const caixas = Number(group.variants.pallet.boxCount) || 1;
                if (caixas > 1) {
                    const cxPromo = detailTierPromoOpts('caixa');
                    const cxPackPromo =
                        cxPromo?.promoPrice != null && Number.isFinite(Number(cxPromo.promoPrice))
                            ? Number(cxPromo.promoPrice)
                            : null;
                    const cxPackCatalog = Number(cxVar.price);
                    const usePromo = isPromoTier || Boolean(cxPromo?.promoId);
                    const cxPack = usePromo && cxPackPromo != null ? cxPackPromo : cxPackCatalog;
                    if (Number.isFinite(cxPack) && cxPack > 0) {
                        blockPrice = Math.round(cxPack * caixas * 100) / 100;
                        const cxOrig =
                            cxPromo?.originalPrice != null
                                ? Number(cxPromo.originalPrice)
                                : cxPackCatalog;
                        if (usePromo && Number.isFinite(cxOrig) && cxOrig > blockPrice) {
                            originalPrice = Math.round(cxOrig * caixas * 100) / 100;
                        }
                    }
                }
            }

            const packUnitLabel = (priceForUnit) => {
                if (tierKey !== 'caixa' && tierKey !== 'pallet') return null;
                const unitPx = pricing.getUnitPrice({
                    ...refVariant,
                    price: priceForUnit,
                    tier: tierKey,
                });
                return unitPx != null ? `${formatPrice(unitPx)} / un` : null;
            };

            blocks.push({
                tier: tierKey,
                label: detailTierLabel(tierKey, refVariant),
                price: blockPrice,
                originalPrice,
                promo: isPromoTier,
                promoOpts: tierPromo,
                perUnit: packUnitLabel(blockPrice),
                originalPerUnit:
                    isPromoTier && originalPrice != null ? packUnitLabel(originalPrice) : null,
                variant: refVariant,
                actionable: true,
            });
        };

        if (group?.variants) {
            if (group.variants.unidade) pushVariant('unidade', group.variants.unidade);
            if (group.variants.caixa) pushVariant('caixa', group.variants.caixa);
            if (group.variants.pallet) pushVariant('pallet', group.variants.pallet);
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
                const payMode = block.promo ? detailPayModeFor(block.tier) : 'pix';
                const showPromoPrice = Boolean(block.promo && payMode === 'pix');
                const displayPrice = showPromoPrice
                    ? block.price
                    : (block.originalPrice ?? block.price);
                const promo = block.promo ? ' totem-detail__price-block--promo' : '';
                const cardPay =
                    block.promo && payMode === 'card' ? ' totem-detail__price-block--card-pay' : '';
                const oldHtml =
                    showPromoPrice &&
                    block.originalPrice != null &&
                    Number.isFinite(block.originalPrice) &&
                    block.originalPrice > block.price
                        ? `<span class="totem-detail__price-old">${formatPrice(block.originalPrice)}</span>`
                        : '';
                const promoBadge = block.promo
                    ? `<div class="totem-detail__promo-tags">
${showPromoPrice ? '<span class="totem-detail__promo-badge">PROMO</span>' : ''}
<div class="totem-detail__pay-toggle" role="group" aria-label="Forma de pagamento do preço">
<button type="button" class="totem-detail__pay-opt${payMode === 'pix' ? ' totem-detail__pay-opt--active' : ''}" data-pay-mode="pix" data-price-tier="${esc(block.tier)}" aria-pressed="${payMode === 'pix' ? 'true' : 'false'}">Pix/Dinheiro</button>
<button type="button" class="totem-detail__pay-opt${payMode === 'card' ? ' totem-detail__pay-opt--active' : ''}" data-pay-mode="card" data-price-tier="${esc(block.tier)}" aria-pressed="${payMode === 'card' ? 'true' : 'false'}">Cartão</button>
</div>
</div>`
                    : '';
                const perUnitLabel = showPromoPrice
                    ? block.perUnit
                    : block.originalPerUnit || block.perUnit;
                const perUnit = perUnitLabel
                    ? `<span class="totem-detail__price-per">${esc(perUnitLabel)}</span>`
                    : '';
                const selectable = ` data-price-tier="${esc(block.tier)}" role="button" tabindex="0" aria-pressed="${block.tier === activeTier ? 'true' : 'false'}" aria-label="Adicionar ${esc(block.label)} ao pedido"`;
                return `<div class="totem-detail__price-block totem-detail__price-block--${mod}${active}${promo}${cardPay}"${selectable}>
<span class="totem-detail__price-label">${esc(block.label)}</span>
<div class="totem-detail__price-row">
${oldHtml}
<strong class="totem-detail__price-value">${formatPrice(displayPrice)}</strong>
</div>
${promoBadge}
${perUnit}
</div>`;
            })
            .join('');

    const playDetailBlockAddedFeedback = (blockEl, qty = 1) => {
        if (!blockEl) return;
        blockEl.classList.remove('totem-detail__price-block--press');
        blockEl.classList.add('totem-detail__price-block--added');
        blockEl.querySelectorAll('.totem-detail__price-block__ripple, .totem-detail__price-block__success').forEach((n) =>
            n.remove(),
        );
        const ripple = document.createElement('span');
        ripple.className = 'totem-detail__price-block__ripple';
        ripple.setAttribute('aria-hidden', 'true');
        blockEl.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        const overlay = document.createElement('div');
        overlay.className = 'totem-detail__price-block__success';
        overlay.setAttribute('role', 'status');
        overlay.innerHTML = `<span class="material-symbols-outlined totem-detail__price-block__check" aria-hidden="true">check_circle</span>
<span class="totem-detail__price-block__success-text">Adicionado!</span>
${qty > 1 ? `<span class="totem-detail__price-block__success-qty">${qty} un. no carrinho</span>` : ''}`;
        blockEl.appendChild(overlay);
        window.setTimeout(() => {
            blockEl.classList.remove('totem-detail__price-block--added');
            overlay.remove();
        }, 920);
    };

    const addLinesToCart = (ctx, tier, qtyToAdd, payMode, tierPromo) => {
        const { item, group, variant, product } = ctx;
        const usePromo = Boolean(tierPromo?.promoId) && payMode !== 'card';
        const packType = tier || variant?.tier || 'caixa';
        const resolvedVariant = group
            ? pricing.getVariant(group, tier) || variant
            : variant || { id: product.id, price: product.price, tier: packType };
        const cartKey = resolvedVariant ? catalog.cartKeyFor(resolvedVariant) : product.id;
        const basePrice = Number(resolvedVariant?.price ?? product.price);
        const autoOffer =
            !usePromo && payMode !== 'card'
                ? resolvePromoOffer(cartKey, detailItemKey || group?.key || product.id, packType)
                : null;
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
            appliedPromo?.promoPrice != null ? Number(appliedPromo.promoPrice) : basePrice;

        const lineCtx = {
            variant: resolvedVariant,
            group,
            cartKey,
            tier: packType,
        };
        const line = catalog.buildCartLineFields(lineCtx, pricing);
        if (!line) return null;
        line.price = finalPrice;
        if (appliedPromo?.promoId && payMode !== 'card') {
            line.promoId = appliedPromo.promoId;
            const finalBase =
                appliedPromo.originalPrice != null ? Number(appliedPromo.originalPrice) : basePrice;
            if (finalBase > finalPrice) {
                line.originalPrice = finalBase;
                line.discountPct = Math.max(0, Math.round((1 - finalPrice / finalBase) * 100));
            }
        }

        const cart = cartApi.loadCart();
        if (!cart[line.key]) {
            cart[line.key] = { ...line, qty: 0 };
        } else {
            cart[line.key].price = finalPrice;
            if (appliedPromo?.promoId && payMode !== 'card') {
                cart[line.key].promoId = appliedPromo.promoId;
                delete cart[line.key].payMode;
            } else {
                delete cart[line.key].promoId;
                delete cart[line.key].originalPrice;
                delete cart[line.key].discountPct;
            }
        }
        cart[line.key].qty += qtyToAdd;
        cartApi.saveCart(cart);
        return line;
    };

    const closeProductDetail = () => {
        if (!detailPanel || detailPanel.classList.contains('totem-detail--closing')) return;
        detailPanel.classList.add('totem-detail--closing');
        detailPanel.classList.remove('totem-detail--open');
        document.documentElement.classList.remove('parceiros-detail-open');
        window.setTimeout(() => {
            detailPanel.classList.remove('totem-detail--closing');
            detailPanel.setAttribute('aria-hidden', 'true');
            detailItemKey = null;
            detailDraftQty = 1;
            detailPromoOpts = null;
            detailPayModeByTier.clear();
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
<button type="button" class="totem-detail__back" id="parceiros-detail-back" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="totem-detail__heading" id="parceiros-detail-heading">Detalhes do Produto</h1>
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
<button type="button" class="totem-qty-btn totem-detail-minus" id="parceiros-detail-minus" aria-label="Diminuir quantidade" ${detailDraftQty <= 1 ? 'disabled' : ''}>−</button>
<button type="button" class="totem-detail__qty-value totem-qty-edit" id="parceiros-detail-qty" aria-label="Digitar quantidade">${detailDraftQty}</button>
<button type="button" class="totem-qty-btn totem-detail-plus" id="parceiros-detail-plus" aria-label="Aumentar quantidade">+</button>
</div>
<button type="button" class="totem-detail__add" id="parceiros-detail-add" data-cart-key="${esc(cartKey)}" data-item-key="${esc(detailItemKey)}" aria-label="Adicionar ao pedido">
adicionar ao pedido
</button>
</div>
</div>`;
    };

    const addDetailBlockToCart = (tier, blockEl) => {
        if (!detailItemKey || !tier || blockEl?.classList.contains('totem-detail__price-block--added')) return;
        const ctx = getDetailContext();
        if (!ctx) return;
        const block = buildDetailPriceBlocks(ctx).find((b) => b.tier === tier);
        if (!block) return;
        const qtyToAdd = Math.max(1, detailDraftQty);
        const payMode = detailPayModeFor(tier);
        const line = addLinesToCart(ctx, tier, qtyToAdd, payMode, block.promoOpts || null);
        if (!line) return;
        playDetailBlockAddedFeedback(blockEl, qtyToAdd);
        window.LigeirinhoCartUI?.render?.();
        window.LigeirinhoCartUI?.showAddedFeedback?.(line.name);
        config?.onCartChanged?.();
        detailDraftQty = 1;
        window.setTimeout(() => renderProductDetail(), 900);
    };

    const addDetailToCart = () => {
        const ctx = getDetailContext();
        if (!ctx) return;
        const tier = ctx.tier;
        const payMode = detailPayModeFor(tier);
        const tierPromo = detailTierPromoOpts(tier);
        const qtyToAdd = Math.max(1, detailDraftQty);
        const line = addLinesToCart(ctx, tier, qtyToAdd, payMode, tierPromo);
        if (!line) return;
        window.LigeirinhoCartUI?.render?.();
        window.LigeirinhoCartUI?.showAddedFeedback?.(line.name);
        config?.onCartChanged?.();
        closeProductDetail();
    };

    const openProductDetail = (itemKey, promoOpts = null) => {
        if (!itemKey) return;
        ensurePanel();
        if (!detailPanel || !detailSheet) return;
        detailItemKey = itemKey;
        detailPromoOpts = promoOpts;
        detailDraftQty = 1;
        detailPayModeByTier.clear();
        renderProductDetail();
        detailPanel.setAttribute('aria-hidden', 'false');
        detailPanel.classList.add('totem-detail--open');
        detailPanel.classList.remove('totem-detail--closing');
        document.documentElement.classList.add('parceiros-detail-open');
    };

    const refreshIfOpen = () => {
        if (!detailItemKey || !detailPanel?.classList.contains('totem-detail--open')) return;
        renderProductDetail();
    };

    const isInteractiveTarget = (target) =>
        Boolean(
            target?.closest?.(
                '.totem-qty-btn, .totem-plus, .totem-minus, .ze-price-tier, .totem-promo-unit-btn, .totem-detail__pay-opt',
            ),
        );

    const bindPanel = () => {
        if (!detailPanel || detailPanel.dataset.parceirosDetailBound === '1') return;
        detailPanel.dataset.parceirosDetailBound = '1';

        detailPanel.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.totem-detail__pay-opt')) return;
            const tierPress = e.target.closest('.totem-detail__price-block[data-price-tier]');
            if (!tierPress || tierPress.classList.contains('totem-detail__price-block--added')) return;
            tierPress.classList.add('totem-detail__price-block--press');
        });

        detailPanel.addEventListener('pointerup', (e) => {
            const tierPress = e.target.closest('.totem-detail__price-block[data-price-tier]');
            if (tierPress) tierPress.classList.remove('totem-detail__price-block--press');
        });

        detailPanel.addEventListener('pointercancel', (e) => {
            const tierPress = e.target.closest('.totem-detail__price-block[data-price-tier]');
            if (tierPress) tierPress.classList.remove('totem-detail__price-block--press');
        });

        detailPanel.addEventListener('click', (e) => {
            if (e.target === detailPanel) {
                closeProductDetail();
                return;
            }
            if (e.target.closest('#parceiros-detail-back')) {
                closeProductDetail();
                return;
            }
            const payOpt = e.target.closest('.totem-detail__pay-opt');
            if (payOpt) {
                e.preventDefault();
                e.stopPropagation();
                setDetailPayMode(payOpt.dataset.priceTier, payOpt.dataset.payMode);
                renderProductDetail();
                return;
            }
            const tierBtn = e.target.closest('.totem-detail__price-block[data-price-tier]');
            if (tierBtn && detailItemKey) {
                addDetailBlockToCart(tierBtn.dataset.priceTier, tierBtn);
                return;
            }
            if (e.target.closest('#parceiros-detail-qty')) {
                e.preventDefault();
                const raw = window.prompt('Quantidade', String(detailDraftQty));
                if (raw == null) return;
                const n = Math.min(999, Math.max(1, parseInt(raw, 10) || 1));
                detailDraftQty = n;
                renderProductDetail();
                return;
            }
            if (e.target.closest('#parceiros-detail-plus')) {
                detailDraftQty += 1;
                renderProductDetail();
                return;
            }
            if (e.target.closest('#parceiros-detail-minus') && detailDraftQty > 1) {
                detailDraftQty -= 1;
                renderProductDetail();
                return;
            }
            if (e.target.closest('#parceiros-detail-add')) {
                addDetailToCart();
            }
        });
    };

    const init = (nextConfig) => {
        config = nextConfig || {};
        ensurePanel();
        bindPanel();
    };

    window.LigeirinhoParceirosProductDetail = {
        init,
        open: openProductDetail,
        close: closeProductDetail,
        refreshIfOpen,
        isInteractiveTarget,
    };
})();
