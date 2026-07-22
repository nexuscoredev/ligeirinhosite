(function () {
    const catalog = () => window.LigeirinhoCatalog;
    const pricing = () => window.LigeirinhoPricing;
    const promoCatalog = () => window.LigeirinhoPromoCatalog;

    let deps = null;
    let bound = false;
    let promoGroups = [];
    let selectedUnits = new Map();
    let fetchError = false;
    let promoLoader = null;
    let searchQuery = '';
    let searchTimer = null;

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

    const activeUnitForGroup = (grupo) =>
        selectedUnits.get(grupo.chave) || promoCatalog().unidadePadraoPromoGrupo(grupo);

    const activeEntryForGroup = (grupo) =>
        promoCatalog().entryAtivoPromoGrupo(grupo, activeUnitForGroup(grupo));

    const resolveTier = (entry) =>
        promoCatalog().tierForPromoUnit(promoCatalog().normalizePromoUnit(entry?.promo?.unidade));

    const resolvePromoVariant = (entry) => {
        const { promo, item } = entry || {};
        const group = item?.group || null;
        const product = item?.product;
        const tier = resolveTier(entry);
        const fromGroup = group && tier ? pricing()?.getVariant?.(group, tier) : null;
        if (fromGroup?.tier === tier) return fromGroup;

        const promoUnit = promoCatalog().normalizePromoUnit(promo?.unidade);
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
            tierLabel: pricing()?.TIER_LABELS?.[tier] || tier,
            image: promo?.imageUrl || product?.image || group?.image || '',
            unidade: promoUnit,
        };
    };

    const buildCartCtx = (entry) => {
        const { promo, item } = entry || {};
        const group = item?.group || null;
        const product = item?.product;
        const tier = resolveTier(entry);
        const variant = resolvePromoVariant(entry);
        const cartKey = variant?.id ? catalog()?.cartKeyFor?.(variant) : product?.id || '';
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
            promoUnit: promoCatalog().normalizePromoUnit(promo?.unidade),
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

    const grupoSearchHaystack = (grupo) => {
        const entry = activeEntryForGroup(grupo);
        const promo = entry?.promo;
        const item = entry?.item;
        const group = item?.group;
        const variantBits = [];
        if (group?.variants) {
            Object.values(group.variants).forEach((variant) => {
                if (!variant) return;
                if (variant.sku) variantBits.push(variant.sku);
                if (variant.hubId) variantBits.push(variant.hubId);
                if (variant.name) variantBits.push(variant.name);
                if (variant.id) variantBits.push(variant.id);
            });
        }
        return [
            grupo?.nomeExibicao,
            promo?.name,
            promo?.hubProductName,
            promo?.hubProductId,
            promo?.hubFamilyId,
            promo?.sku,
            promo?.unidade,
            group?.baseName,
            group?.key,
            item?.product?.name,
            item?.product?.sku,
            item?.product?.hubId,
            item?.product?.id,
            item?.categoryName,
            ...variantBits,
            ...Object.values(grupo?.byUnit || {}).flatMap((unitEntry) => [
                unitEntry?.promo?.name,
                unitEntry?.promo?.sku,
                unitEntry?.promo?.unidade,
                unitEntry?.item?.product?.name,
                unitEntry?.item?.product?.sku,
            ]),
        ]
            .filter(Boolean)
            .join(' ');
    };

    const getVisiblePromoGroups = () => {
        const q = String(searchQuery || '').trim();
        if (!q) return promoGroups;
        const search = window.LigeirinhoSearch;
        if (search?.expandSearchQuery && search?.matchesHaystack && search?.buildHaystack) {
            const queryInfo = search.expandSearchQuery(q);
            return promoGroups.filter((grupo) =>
                search.matchesHaystack(search.buildHaystack(grupoSearchHaystack(grupo)), queryInfo),
            );
        }
        const norm = q
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        return promoGroups.filter((grupo) =>
            grupoSearchHaystack(grupo)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .includes(norm),
        );
    };

    const updateSearchClearBtn = () => {
        const clearBtn = deps?.searchClearBtn;
        if (clearBtn) clearBtn.hidden = !searchQuery;
    };

    const updateEmptyCopy = ({ searching = false } = {}) => {
        const titleEl = deps?.emptyTitleEl || document.getElementById('totem-promos-empty-title');
        const leadEl = deps?.emptyLeadEl || document.getElementById('totem-promos-empty-lead');
        if (titleEl) {
            titleEl.textContent = searching
                ? 'Nenhuma promoção encontrada'
                : 'Nenhuma promoção no momento';
        }
        if (leadEl) {
            leadEl.textContent = searching
                ? 'Tente outro termo ou limpe a busca.'
                : 'Cadastre itens na tabela PROMOCAO no Ligeirinho Operacional para exibir aqui.';
        }
    };

    const setSearchQuery = (value) => {
        searchQuery = String(value || '').trim();
        updateSearchClearBtn();
        if (!promoGroups.length && !fetchError) {
            updateEmptyCopy({ searching: false });
            return;
        }
        renderGrid();
        deps.onBumpIdle?.();
    };

    const clearSearch = () => {
        searchQuery = '';
        if (deps?.searchInput) deps.searchInput.value = '';
        updateSearchClearBtn();
        if (promoGroups.length) renderGrid();
        else updateEmptyCopy({ searching: false });
    };

    const buildPromoPriceHtml = (ctx) => {
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
        if (!isUnitPromo && ctx.variant && pricing()?.getUnitPrice) {
            unitPrice = pricing().getUnitPrice({
                ...ctx.variant,
                price: packPrice,
                tier: ctx.tier,
            });
        } else if (!isUnitPromo && packSize > 1) {
            unitPrice = Math.round((packPrice / packSize) * 100) / 100;
        }
        const showUnitBreakdown = !isUnitPromo && packSize > 1 && unitPrice != null;
        const unitHtml = `<p class="totem-price-card__unit">${
            showUnitBreakdown ? `${formatPrice(unitPrice)}<span> / un</span>` : ''
        }</p>`;

        return `<div class="totem-price-card ze-price-block totem-product__price-block totem-product__price-block--promo" data-price-display>
<div class="totem-price-card__main">
${showOld ? `<span class="totem-product__price-old">${formatPrice(packOriginal)}</span>` : ''}
<span class="totem-product__price totem-price-card__value">${formatPrice(packPrice)}</span>
</div>
${unitHtml}
</div>`;
    };

    const buildUnitToggleHtml = (grupo) => {
        if (!grupo.multiplo) return '';
        const active = activeUnitForGroup(grupo);
        return `<div class="totem-promo-unit-toggle" role="group" aria-label="Escolher unidade ou caixa">
${grupo.unidadesDisponiveis
    .map((unit) => {
        const isActive = unit === active;
        return `<button type="button" class="totem-promo-unit-btn${isActive ? ' totem-promo-unit-btn--active' : ''}" data-promo-group-key="${esc(grupo.chave)}" data-promo-unit="${esc(unit)}" aria-pressed="${isActive ? 'true' : 'false'}">${esc(promoCatalog().rotuloUnidadePromoTotem(unit))}</button>`;
    })
    .join('')}
</div>`;
    };

    const mediaPackTagHtml = (promoUnit) => {
        const packLabel = promoCatalog().tagEmbalagemPromoTotem(promoUnit);
        if (!packLabel) return '';
        return `<span class="totem-product__pack-tag" aria-label="Embalagem ${esc(packLabel)}"><span class="totem-product__pack-tag-label">${esc(packLabel)}</span></span>`;
    };

    const promoPayTagHtml = () =>
        `<span class="totem-product__pay-tag" aria-label="Pagamento apenas Pix ou Dinheiro"><img src="img/tag-pix-dinheiro.png?v=transparent" alt="" aria-hidden="true"></span>`;

    const promoTagHtml = () =>
        '<span class="totem-product__promo-tag" aria-label="Produto em promoção"><img src="img/tag-promocao.png?v=1" alt="" aria-hidden="true"></span>';

    const buildPromoOnlyCardHtml = (grupo, entry, index) => {
        const { promo } = entry;
        const ctx = buildCartCtx(entry);
        const name = grupo.nomeExibicao || promo.name || promo.hubProductName || 'Promoção';
        const imgSrc = promo.imageUrl ? catalog().productImageUrl(promo.imageUrl) : '';
        const validade = promoCatalog()?.formatValidade?.(promo) || '';
        const attrs = `role="listitem" data-promo-group-key="${esc(grupo.chave)}" data-item-key="${esc(ctx.product?.id || '')}" data-promo-id="${esc(promo.id || '')}" data-promo-unlinked="true" style="--totem-card-i:${Math.min(index, 14)}"`;

        return `<article class="totem-product totem-product--promo totem-product--promo-unlinked" ${attrs}>
<div class="totem-product__media">
${promoTagHtml()}
${promoPayTagHtml()}
${mediaPackTagHtml(ctx.promoUnit)}
${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>
<div class="totem-product__body">
<div class="totem-product__name">${esc(catalog().shortName?.(name, 56) || name)}</div>
${buildUnitToggleHtml(grupo)}
<div class="totem-product__pricing">
<div class="totem-product__meta">${buildPromoPriceHtml(ctx)}</div>
${validade ? `<p class="totem-product__promo-valid">${esc(validade)}</p>` : ''}
</div>
<p class="totem-product__promo-note">Indisponível no catálogo do totem</p>
</div>
</article>`;
    };

    const buildPromoCardHtml = (grupo, index) => {
        const entry = activeEntryForGroup(grupo);
        if (!entry) return '';
        if (!entry.item) return buildPromoOnlyCardHtml(grupo, entry, index);

        const ctx = buildCartCtx(entry);
        const { group, product, tier, cartKey, promo } = ctx;
        if (!product || !cartKey) return buildPromoOnlyCardHtml(grupo, entry, index);

        const qty = deps?.getCartQty?.(cartKey) || 0;
        const itemKey = group?.key || product.id;
        const name = grupo.nomeExibicao || promo.name || promo.hubProductName || group?.baseName || product.name || 'Promoção';
        const imgSrc = promo.imageUrl
            ? catalog().productImageUrl(promo.imageUrl)
            : catalog().productImageUrl(group && pricing() ? pricing().getTierImage(group, tier) : product.image);
        const selectedClass = qty ? ' totem-product--selected' : '';
        const validade = promoCatalog()?.formatValidade?.(promo) || '';
        const packTag = mediaPackTagHtml(ctx.promoUnit);
        const attrs = `role="listitem" data-promo-group-key="${esc(grupo.chave)}" data-group-key="${esc(group?.key || '')}" data-price-tier="${esc(tier)}" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-promo-id="${esc(promo.id || '')}" style="--totem-card-i:${Math.min(index, 14)}"`;

        const mediaHtml = `<div class="totem-product__media">
${promoTagHtml()}
${promoPayTagHtml()}
${packTag}
${qty ? `<span class="totem-product__badge totem-product__cart-badge" aria-label="${qty} no carrinho">${qty}</span>` : ''}
${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy">` : '<span class="material-symbols-outlined totem-product__placeholder" aria-hidden="true">liquor</span>'}
</div>`;

        const qtyHtml = `<div class="totem-product__qty">
<button type="button" class="totem-qty-btn totem-minus" data-cart-key="${esc(cartKey)}" aria-label="Diminuir" ${qty ? '' : 'disabled'}>−</button>
<span class="totem-qty-value">${qty}</span>
<button type="button" class="totem-qty-btn totem-plus" data-cart-key="${esc(cartKey)}" data-item-key="${esc(itemKey)}" data-price-tier="${esc(tier)}" aria-label="Aumentar">+</button>
</div>`;

        const bodyHtml = `<div class="totem-product__body">
<div class="totem-product__name">${esc(catalog().shortName?.(name, 56) || name)}</div>
${buildUnitToggleHtml(grupo)}
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

    const findPromoCard = (groupKey) => {
        if (!deps?.gridEl || !groupKey) return null;
        return [...deps.gridEl.querySelectorAll('[data-promo-group-key]')].find(
            (el) => el.dataset.promoGroupKey === groupKey,
        );
    };

    const replacePromoCard = (grupo, index) => {
        if (!deps?.gridEl) return;
        const card = findPromoCard(grupo.chave);
        if (!card) return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildPromoCardHtml(grupo, index);
        const next = wrapper.firstElementChild;
        if (next) card.replaceWith(next);
    };

    const syncCart = () => {
        if (!deps?.gridEl || !promoGroups.length) return;
        getVisiblePromoGroups().forEach((grupo) => {
            const entry = activeEntryForGroup(grupo);
            if (!entry) return;
            const ctx = buildCartCtx(entry);
            if (!ctx.cartKey) return;
            const card = findPromoCard(grupo.chave);
            updateCardQty(card, deps.getCartQty?.(ctx.cartKey) || 0);
        });
    };

    const renderGrid = () => {
        if (!deps?.gridEl) return;
        if (!promoGroups.length) {
            updateEmptyCopy({ searching: false });
            setPanelVisibility({ showEmpty: true });
            deps.gridEl.innerHTML = '';
            deps.gridEl.classList.remove('totem-promos__grid--carousel');
            return;
        }

        const visible = getVisiblePromoGroups();
        if (!visible.length) {
            updateEmptyCopy({ searching: Boolean(searchQuery) });
            setPanelVisibility({ showEmpty: true });
            deps.gridEl.innerHTML = '';
            deps.gridEl.classList.remove('totem-promos__grid--carousel');
            return;
        }

        setPanelVisibility({ showGrid: true });
        deps.gridEl.classList.remove('totem-promos__grid--carousel');
        deps.gridEl.innerHTML = `<div class="totem-grid totem-grid--grid-m totem-grid--promos" role="list">
${visible.map((grupo, index) => buildPromoCardHtml(grupo, index)).join('')}
</div>`;
    };

    const getPromoCatalogItems = () =>
        deps?.getPromoCatalogItems?.() || deps?.getDisplayItems?.() || [];

    const collectPromoCatalogExclusions = () => {
        const cartKeys = new Set();
        const productIds = new Set();
        const groupKeys = new Set();
        const hubIds = new Set();
        const byCartKey = new Map();
        const byItemKey = new Map();

        const noteCtx = (ctx) => {
            if (!ctx) return;
            if (ctx.cartKey) cartKeys.add(ctx.cartKey);
            if (ctx.product?.id) productIds.add(ctx.product.id);
            if (ctx.group?.key) groupKeys.add(ctx.group.key);
            if (ctx.product?.hubId) hubIds.add(String(ctx.product.hubId).trim());
            if (ctx.group?.variants) {
                Object.values(ctx.group.variants).forEach((variant) => {
                    if (variant?.id) productIds.add(variant.id);
                    if (variant?.hubId) hubIds.add(String(variant.hubId).trim());
                });
            }
            if (ctx.group) {
                ['caixa', 'unidade', 'pallet'].forEach((tier) => {
                    const variant = pricing()?.getVariant?.(ctx.group, tier);
                    const key = variant ? catalog()?.cartKeyFor?.(variant) : '';
                    if (key) cartKeys.add(key);
                });
            }
        };

        promoGroups.forEach((grupo) => {
            const tiers = {};
            (grupo.unidadesDisponiveis || []).forEach((unit) => {
                const entry = promoCatalog().entryAtivoPromoGrupo(grupo, unit);
                if (!entry) return;
                const ctx = buildCartCtx(entry);
                noteCtx(ctx);
                if (!ctx.cartKey || !ctx.promo?.id) return;
                byCartKey.set(ctx.cartKey, {
                    promoId: ctx.promo.id,
                    promoPrice: ctx.promoPrice,
                    originalPrice: ctx.originalPrice,
                    discountPct: ctx.discountPct,
                    tier: ctx.tier,
                });
                if (ctx.tier) {
                    tiers[ctx.tier] = {
                        promoPrice: ctx.promoPrice,
                        promoId: ctx.promo.id,
                        originalPrice: ctx.originalPrice,
                    };
                }
            });

            const activeEntry = activeEntryForGroup(grupo);
            const activeCtx = activeEntry ? buildCartCtx(activeEntry) : null;
            const itemKey = resolvePromoDetailItemKey(grupo);
            if (itemKey && activeCtx?.promo?.id) {
                byItemKey.set(itemKey, {
                    promoPrice: activeCtx.promoPrice,
                    promoId: activeCtx.promo.id,
                    tier: activeCtx.tier,
                    originalPrice: activeCtx.originalPrice,
                    tiers,
                    multiplo: Boolean(grupo.multiplo),
                });
            }
        });

        return { cartKeys, productIds, groupKeys, hubIds, byCartKey, byItemKey };
    };

    const syncPromoCatalogKeys = () => {
        deps.registerPromoCatalogExclusions?.(collectPromoCatalogExclusions());
        deps.onPromoCatalogChange?.();
    };

    const loadPromos = async (force = false) => {
        const loader = getLoader();
        if (!loader) {
            fetchError = true;
            promoGroups = [];
            syncPromoCatalogKeys();
            return;
        }
        const catalogItems = [
            ...(deps?.getDisplayItems?.() || []),
            ...getPromoCatalogItems(),
        ];
        const promocoes = await loader.load(force);
        fetchError = loader.hadError?.() && !promocoes.length;
        const entries = promoCatalog()
            .buildPromoEntries(promocoes, catalogItems, { matchedOnly: false })
            .map((entry) => promoCatalog().enrichPromoEntry(entry, catalogItems))
            .filter((entry) => entry.item);
        deps.registerPromoDisplayItems?.(entries.map((entry) => entry.item));
        promoGroups = promoCatalog().agruparPromocoesTotem(entries);
        promoGroups = promoGroups.filter((grupo) => {
            const entry = activeEntryForGroup(grupo);
            if (!entry) return false;
            const ctx = buildCartCtx(entry);
            return ctx.cartKey && !deps.isProductHidden?.(ctx.cartKey);
        });
        const nextSelected = new Map();
        promoGroups.forEach((grupo) => {
            const prev = selectedUnits.get(grupo.chave);
            nextSelected.set(
                grupo.chave,
                prev && grupo.byUnit[prev] ? prev : promoCatalog().unidadePadraoPromoGrupo(grupo),
            );
        });
        selectedUnits = nextSelected;
        syncPromoCatalogKeys();
    };

    const render = async (options = {}) => {
        if (!deps?.gridEl) return;
        const force = Boolean(options.force);
        setPanelVisibility({ showLoading: true });
        await loadPromos(force);
        if (fetchError && !promoGroups.length) {
            setPanelVisibility({ showError: true });
            return;
        }
        if (!promoGroups.length) {
            updateEmptyCopy({ searching: false });
            setPanelVisibility({ showEmpty: true });
            deps.gridEl.innerHTML = '';
            return;
        }
        renderGrid();
    };

    const resolvePromoDetailItemKey = (grupo) => {
        if (!grupo) return '';
        for (const unit of grupo.unidadesDisponiveis || []) {
            const key = grupo.byUnit?.[unit]?.item?.group?.key;
            if (key) return key;
        }
        const entry = activeEntryForGroup(grupo);
        const ctx = buildCartCtx(entry);
        return ctx.group?.key || ctx.product?.id || '';
    };

    const buildDetailPromoOpts = (grupo, activeCtx) => {
        const tiers = {};
        (grupo?.unidadesDisponiveis || []).forEach((unit) => {
            const entry = promoCatalog().entryAtivoPromoGrupo(grupo, unit);
            if (!entry) return;
            const tierCtx = buildCartCtx(entry);
            if (!tierCtx.tier || !tierCtx.promo?.id) return;
            tiers[tierCtx.tier] = {
                promoPrice: tierCtx.promoPrice,
                promoId: tierCtx.promo.id,
                originalPrice: tierCtx.originalPrice,
            };
        });
        return {
            promoPrice: activeCtx.promoPrice,
            promoId: activeCtx.promo?.id,
            tier: activeCtx.tier,
            originalPrice: activeCtx.originalPrice,
            tiers,
            multiplo: Boolean(grupo?.multiplo),
        };
    };

    const bindSearch = () => {
        const input = deps?.searchInput;
        const form = deps?.searchForm;
        const clearBtn = deps?.searchClearBtn;
        if (!input) return;

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            setSearchQuery(input.value);
        });

        clearBtn?.addEventListener('click', () => {
            clearSearch();
            deps.onBumpIdle?.();
            input.focus();
            window.LigeirinhoTotemKeyboard?.init?.({
                input,
                onInput: (value) => {
                    deps.onBumpIdle?.();
                    if (searchTimer) clearTimeout(searchTimer);
                    searchTimer = window.setTimeout(() => setSearchQuery(value), 180);
                },
                onSubmit: (value) => setSearchQuery(value),
                onClose: () => deps.onBumpIdle?.(),
            });
        });

        const attachKeyboard = () => {
            window.LigeirinhoTotemKeyboard?.init?.({
                input,
                onInput: (value) => {
                    deps.onBumpIdle?.();
                    if (searchTimer) clearTimeout(searchTimer);
                    searchTimer = window.setTimeout(() => setSearchQuery(value), 180);
                },
                onSubmit: (value) => setSearchQuery(value),
                onClose: () => deps.onBumpIdle?.(),
            });
        };

        input.addEventListener('focus', attachKeyboard);
        input.addEventListener('click', attachKeyboard);
        updateSearchClearBtn();
    };

    const bindGrid = () => {
        if (!deps?.gridEl || bound) return;
        bound = true;
        bindSearch();
        deps.retryBtn?.addEventListener('click', () => refresh());
        const handlePromoGridTap = (e) => {
            const unitBtn = e.target.closest('[data-promo-unit]');
            if (unitBtn) {
                const groupKey = unitBtn.dataset.promoGroupKey;
                const unit = unitBtn.dataset.promoUnit;
                const grupo = promoGroups.find((item) => item.chave === groupKey);
                if (!grupo || !unit || !grupo.byUnit[unit]) return;
                selectedUnits.set(groupKey, unit);
                const visible = getVisiblePromoGroups();
                const index = visible.indexOf(grupo);
                replacePromoCard(grupo, index >= 0 ? index : promoGroups.indexOf(grupo));
                deps.onBumpIdle?.();
                return;
            }

            const plus = e.target.closest('.totem-plus');
            const minus = e.target.closest('.totem-minus');
            if (plus) {
                const card = plus.closest('[data-promo-group-key]');
                const grupo = promoGroups.find((item) => item.chave === card?.dataset?.promoGroupKey);
                const entry = grupo ? activeEntryForGroup(grupo) : null;
                if (!entry?.item) return;
                const ctx = buildCartCtx(entry);
                deps.addPromoItem?.(ctx.cartKey, ctx.group?.key || ctx.product?.id, {
                    promoPrice: ctx.promoPrice,
                    promoId: ctx.promo?.id,
                    tier: ctx.tier,
                    productId: ctx.variant?.id,
                    promoOriginalPrice: ctx.originalPrice,
                });
                syncCart();
                return;
            }
            if (minus) {
                deps.changeQty?.(minus.dataset.cartKey, -1);
                syncCart();
                return;
            }

            const card = e.target.closest('.totem-product');
            if (card?.dataset?.itemKey) {
                const grupo = promoGroups.find((item) => item.chave === card.dataset.promoGroupKey);
                const entry = grupo ? activeEntryForGroup(grupo) : null;
                if (!entry?.item) return;
                const ctx = buildCartCtx(entry);
                const itemKey = resolvePromoDetailItemKey(grupo);
                if (!itemKey) return;
                deps.openProductDetail?.(itemKey, buildDetailPromoOpts(grupo, ctx));
                deps.onBumpIdle?.();
            }
        };
        deps.gridEl.addEventListener('click', (e) => {
            if (window.LigeirinhoTotemActivity?.guardGhostClick?.(e)) return;
            handlePromoGridTap(e);
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
        clearSearch,
        closeLightbox: () => {},
        stopAuto: () => {},
        startAuto: () => {},
    };
})();
