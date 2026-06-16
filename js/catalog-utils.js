(function () {

    const pricing = () => window.LigeirinhoPricing;



    const formatPrice = (value) => {

        if (value == null || Number.isNaN(value)) return '—';

        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    };



    const escapeHtml = (str) =>

        String(str)

            .replace(/&/g, '&amp;')

            .replace(/</g, '&lt;')

            .replace(/>/g, '&gt;')

            .replace(/"/g, '&quot;');



    const productImageUrl = (url) => {

        if (!url) return null;

        if (/\.(webp|jpg|jpeg|png|gif)(\?|$)/i.test(url)) return url;

        return `${url}.webp`;

    };



    const formatCategoryLabel = (name) =>

        name

            .toLowerCase()

            .split(/\s+/)

            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))

            .join(' ');



    const shortName = (name, max = 48) => {

        const text = String(name || '').trim();

        if (text.length <= max) return text;

        return `${text.slice(0, max - 1)}…`;

    };



    const categoryIcons = {
        cerveja: 'sports_bar',
        cervejas: 'sports_bar',
        insumos: 'inventory_2',
        destilados: 'liquor',
        whisky: 'wine_bar',
        whiskys: 'wine_bar',
        bebidas: 'local_bar',
        vodka: 'liquor',
        vodkas: 'local_bar',
        gin: 'local_bar',
        gins: 'local_bar',
        'gin-s': 'local_bar',
        rum: 'liquor',
        tequila: 'liquor',
        cachaca: 'liquor',
        vinho: 'wine_bar',
        espumantes: 'wine_bar',
        refrigerante: 'local_drink',
        refrigerantes: 'local_cafe',
        'refrigerantes-sucos': 'local_cafe',
        agua: 'water_drop',
        aguas: 'water_drop',
        energetico: 'bolt',
        energeticos: 'bolt',
        combos: 'local_fire_department',
        gelos: 'ac_unit',
        vinhos: 'wine_bar',
        salgadinho: 'fastfood',
        tabacaria: 'smoking_rooms',
        cigarros: 'smoking_rooms',
    };

    const CATALOG_CATEGORY_ALIASES = {
        'refrigerantes-sucos': 'refrigerantes',
        energeticos: 'energetico',
        whiskys: 'whisky',
        aguas: 'agua',
    };

    const isGeloProductName = (name) => {
        const n = String(name || '').toUpperCase();
        if (/GELINHO/i.test(n)) return false;
        return /^GELO\s/.test(n) || /\bGELO\s+\d/.test(n) || n === 'GELO 5K';
    };

    const categoryProductScore = (categoryId, name, productId = '') => {
        const n = String(name || '').toUpperCase();
        const pid = String(productId || '').toLowerCase();
        const cid = String(categoryId || '').toLowerCase();
        const rules = {
            gelos: [
                [/^GELO\s/, 100],
                [/\bGELO\s+\d/, 90],
            ],
            insumos: [
                [/^GELO\s/, 95],
                [/^COPO\s/, 50],
                [/CANUDO/, 40],
                [/CARVAO/, 35],
            ],
            cerveja: [
                [/\bCX\b|\bCAIXA\b/, 40],
                [/AMSTEL|SKOL|HEINEKEN|BRAHMA/i, 60],
            ],
            cervejas: [[/^CERVEJA\s/, 100]],
            whisky: [[/WHISKY|WHISKIE|BALLANTINE|BUCHANAN|CHIVAS|JACK|OLD PARR|RED LABEL/i, 100]],
            whiskys: [[/WHISKY|WHISKIE|BALLANTINE|BUCHANAN|CHIVAS|JACK|OLD PARR|RED LABEL/i, 100]],
            destilados: [[/APEROL|GIN\s|CACHACA|CACHAÇA|RUM|TEQUILA|VODKA|WHISKY/i, 80]],
            vinhos: [[/VINHO/i, 100]],
            vinho: [[/VINHO/i, 100]],
            espumantes: [[/ESPUMANTE|CHAMPAGNE|PROSECCO|SPUMANTE/i, 100]],
            vodka: [
                [/VODKA/i, 100],
                [/ABSOLUT|SMIRNOFF|ASKOV|CIROC|ORLOFF|GREY GOOSE|HYPNOTIC|WYBOROWA|SKYY/i, 92],
            ],
            vodkas: [
                [/VODKA/i, 100],
                [/ABSOLUT|SMIRNOFF|ASKOV|CIROC|ORLOFF|GREY GOOSE|HYPNOTIC|WYBOROWA|SKYY/i, 92],
            ],
            gin: [[/^GIN\s/i, 100], [/BEEFEATER|BOMBAY|TANQUERAY|SEAGERS|LARIOS|INVICTUS|ETERNITY/i, 88]],
            gins: [[/^GIN\s/i, 100], [/BEEFEATER|BOMBAY|TANQUERAY|SEAGERS|LARIOS|INVICTUS|ETERNITY/i, 88]],
            'gin-s': [[/^GIN\s/i, 100], [/BEEFEATER|BOMBAY|TANQUERAY|SEAGERS|LARIOS|INVICTUS|ETERNITY/i, 88]],
            rum: [[/^RUM\s|\bRUM\b/i, 100]],
            tequila: [[/TEQUILA/i, 100]],
            cachaca: [[/CACHACA|CACHAÇA/i, 100]],
            refrigerante: [[/COCA|PEPSI|GUARANA|GUARANÁ|H2OH|SPRITE|FANTA/i, 100]],
            refrigerantes: [
                [/COCA|PEPSI|GUARANA|GUARANÁ|H2OH|SPRITE|FANTA/i, 95],
                [/^AGUA|^ÁGUA/i, 75],
                [/SUCO/i, 70],
            ],
            'refrigerantes-sucos': [
                [/COCA|PEPSI|GUARANA|GUARANÁ|H2OH|SPRITE|FANTA/i, 95],
                [/^AGUA|^ÁGUA/i, 75],
                [/SUCO/i, 70],
            ],
            agua: [[/^AGUA|^ÁGUA/i, 100]],
            energetico: [[/MONSTER|RED BULL|REDBULL|ENERGET|BALY|FUSION/i, 100]],
            energeticos: [[/MONSTER|RED BULL|REDBULL|ENERGET|BALY|FUSION/i, 100]],
            bebidas: [[/GELINHO/i, -100], [/BAIANINHA|ISOTON|GATORADE/i, 70]],
        };
        let score = 0;
        (rules[categoryId] || rules[cid] || []).forEach(([pattern, points]) => {
            if (pattern.test(n)) score += points;
        });

        const slugStem = cid.replace(/s$/, '');
        if (slugStem && pid.startsWith(`${slugStem}-`)) score += 85;
        if (cid === 'gin-s' && pid.startsWith('gin-')) score += 90;
        if (cid === 'vodkas' && pid.startsWith('vodka-')) score += 90;

        return score;
    };

    const pickRepresentativeProduct = (category, allCategories = []) => {
        const id = category?.id;
        let pool = category?.products || [];

        if (id === 'gelos') {
            pool = (allCategories || []).flatMap((c) => c.products || []).filter((p) => isGeloProductName(p.name));
        }

        let best = null;
        let bestScore = -Infinity;
        pool.forEach((product) => {
            const score = categoryProductScore(id, product.name, product.id);
            if (score > bestScore) {
                bestScore = score;
                best = product;
            }
        });

        if (bestScore > 0) return best;

        const withImage = pool
            .filter((p) => p.image && categoryProductScore(id, p.name, p.id) >= 0)
            .sort(
                (a, b) =>
                    categoryProductScore(id, b.name, b.id) - categoryProductScore(id, a.name, a.id)
            );
        if (withImage.length) return withImage[0];

        return null;
    };

    const resolveCatalogCategory = (catalogData, id) => {
        if (!catalogData?.categories) return null;
        if (id === 'gelos') {
            const products = [];
            catalogData.categories.forEach((c) => {
                (c.products || []).forEach((p) => {
                    if (isGeloProductName(p.name)) products.push(p);
                });
            });
            if (!products.length) return null;
            return { id: 'gelos', name: 'GELOS', products };
        }
        const mapped = CATALOG_CATEGORY_ALIASES[id] || id;
        const direct = catalogData.categories.find((c) => c.id === mapped);
        if (direct) return direct;

        const spiritPools = {
            gin: (p) => /^GIN\s/i.test(p.name) || String(p.id || '').startsWith('gin-'),
            gins: (p) => /^GIN\s/i.test(p.name) || String(p.id || '').startsWith('gin-'),
            'gin-s': (p) => /^GIN\s/i.test(p.name) || String(p.id || '').startsWith('gin-'),
            vodkas: (p) => /VODKA/i.test(p.name) || String(p.id || '').startsWith('vodka-'),
        };
        const matchSpirit = spiritPools[id];
        if (matchSpirit) {
            const products = [];
            catalogData.categories.forEach((c) => {
                (c.products || []).forEach((p) => {
                    if (matchSpirit(p)) products.push(p);
                });
            });
            if (products.length) {
                const label = id === 'gin-s' || id === 'gins' ? 'GINS' : id.toUpperCase().replace(/-/g, ' ');
                return { id, name: label, products };
            }
        }

        return null;
    };

    const categoryCoverMedia = (category, allCategories = []) => {
        const icon = categoryIcons[category?.id] || 'category';
        const product = pickRepresentativeProduct(category, allCategories);
        const src = productImageUrl(product?.image);
        if (!src || !product) return { type: 'icon', icon };
        const score = categoryProductScore(category.id, product.name, product.id);
        if (score < 0) return { type: 'icon', icon };
        return { type: 'img', src, icon };
    };

    const cartKeyFor = (variant) => {

        if (!variant) return '';

        if (!variant.tier || variant.tier === 'unidade') return variant.id;

        return `${variant.id}::${variant.tier}`;

    };



    const getCartQty = (cartKey) => {

        const cart = window.LigeirinhoCart?.loadCart?.() || {};

        return cart[cartKey]?.qty || 0;

    };



    const resolveCardContext = (cardEl) => {

        const groupKey = cardEl?.dataset?.groupKey;

        const tier = cardEl?.dataset?.priceTier || (group ? pricing()?.getDefaultTier?.(group) : null) || 'caixa';

        const groups = window.__ligProductGroups;

        const group = groups?.get?.(groupKey);

        const variant = group ? pricing()?.getVariant?.(group, tier) : null;

        return { group, tier, variant, cartKey: variant ? cartKeyFor(variant) : cardEl?.dataset?.productId };

    };



    const priceTiersHtml = (group, activeTier) => {

        const p = pricing();

        if (!p || !group) {
            return '<div class="ze-price-tiers-slot ze-price-tiers-slot--empty" aria-hidden="true"></div>';
        }

        const tiers = p.getAvailableTiers(group);

        if (tiers.length <= 1) {
            return '<div class="ze-price-tiers-slot ze-price-tiers-slot--empty" aria-hidden="true"></div>';
        }



        const buttons = tiers

            .map((tier) => {

                const active = tier === activeTier;

                const label = p.TIER_SHORT[tier] || tier;

                return `<button type="button" class="ze-price-tier${active ? ' ze-price-tier--active' : ''}" data-price-tier="${escapeHtml(tier)}" aria-pressed="${active ? 'true' : 'false'}" title="${escapeHtml(p.TIER_LABELS[tier] || tier)}">${escapeHtml(label)}</button>`;

            })

            .join('');



        return `<div class="ze-price-tiers-slot"><div class="ze-price-tiers" role="group" aria-label="Embalagem">${buttons}</div></div>`;

    };



    const simplePriceBlockHtml = (price, priceClass = 'ze-product-card__price') =>
        `<div class="ze-price-block" data-price-display>
<span class="${priceClass}">${formatPrice(price)}</span>
<span class="ze-price-block__unit">por caixa</span>
</div>`;



    const priceBlockHtml = (group, activeTier) => {

        const p = pricing();

        const variant = group && p ? p.getVariant(group, activeTier) : null;

        const price = variant?.price;

        const sub = variant && p ? p.packLineLabel({ ...variant, tier: activeTier }) : '';



        return `<div class="ze-price-block" data-price-display>

<span class="ze-product-card__price">${formatPrice(price)}</span>

${sub ? `<span class="ze-price-block__unit">${escapeHtml(sub)}</span>` : ''}

</div>`;

    };



    const qtyStepperHtml = (cartKey, qty, opts = {}) => {

        const dark = opts.dark;

        const addClass = dark ? 'ze-add-btn ze-add-btn--dark' : 'ze-add-btn';

        const stepperClass = dark ? 'ze-qty-stepper ze-qty-stepper--dark' : 'ze-qty-stepper';

        if (qty <= 0) {

            return `<button type="button" class="${addClass}" data-cart-key="${escapeHtml(cartKey)}" aria-label="Adicionar ao caminhão">

Adicionar

</button>`;

        }

        return `<div class="${stepperClass}" data-cart-key="${escapeHtml(cartKey)}">

<button type="button" class="ze-qty-btn ze-qty-minus" data-cart-key="${escapeHtml(cartKey)}" aria-label="Diminuir">−</button>

<span class="ze-qty-value" aria-live="polite">${qty}</span>

<button type="button" class="ze-qty-btn ze-qty-plus" data-cart-key="${escapeHtml(cartKey)}" aria-label="Aumentar">+</button>

</div>`;

    };



    const productCardZe = (item, categoryName) => {

        const group = item?.group || null;

        const product = item?.product || item;

        const catName = item?.categoryName || categoryName || '';

        const p = pricing();

        const activeTier = group && p ? p.getDefaultTier(group) : 'caixa';

        const variant = group && p ? p.getVariant(group, activeTier) : null;

        const cartKey = variant ? cartKeyFor(variant) : product.id;

        const qty = getCartQty(cartKey);

        const imgSrc = productImageUrl(group && p ? p.getTierImage(group, activeTier) : product.image);

        const badge = product.adultOnly ? '<span class="ze-badge-adult">+18</span>' : '';

        const imageBlock = imgSrc

            ? `<img alt="" class="ze-product-card__img ze-product-card__img--${escapeHtml(activeTier)}" src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async">`

            : `<span class="material-symbols-outlined ze-product-card__placeholder">liquor</span>`;



        const groupAttr = group ? ` data-group-key="${escapeHtml(group.key)}" data-price-tier="${escapeHtml(activeTier)}"` : '';



        return `<article class="ze-product-card" data-product-id="${escapeHtml(product.id)}"${groupAttr}>

<div class="ze-product-card__media">${badge}${imageBlock}</div>

<div class="ze-product-card__body">

<div class="ze-product-card__head">

<h3 class="ze-product-card__name">${escapeHtml(shortName(product.name))}</h3>

<p class="ze-product-card__cat">${escapeHtml(formatCategoryLabel(catName))}</p>

</div>

<div class="ze-product-card__pricing">

${priceTiersHtml(group, activeTier)}

${group ? priceBlockHtml(group, activeTier) : simplePriceBlockHtml(product.price)}

</div>

<div class="ze-product-card__footer">

${qtyStepperHtml(cartKey, qty)}

</div>

</div>

</article>`;

    };



    const productCardHorizontal = (item) => {

        const group = item?.group || null;

        const product = item?.product || item;

        const p = pricing();

        const activeTier = group && p ? p.getDefaultTier(group) : 'caixa';

        const variant = group && p ? p.getVariant(group, activeTier) : null;

        const cartKey = variant ? cartKeyFor(variant) : product.id;

        const qty = getCartQty(cartKey);

        const imgSrc = productImageUrl(group && p ? p.getTierImage(group, activeTier) : product.image);

        const imageBlock = imgSrc

            ? `<img alt="" class="ze-product-h__img ze-product-card__img--${escapeHtml(activeTier)}" src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async">`

            : `<span class="material-symbols-outlined text-3xl text-on-surface-variant/40">liquor</span>`;



        const groupAttr = group ? ` data-group-key="${escapeHtml(group.key)}" data-price-tier="${escapeHtml(activeTier)}"` : '';



        return `<article class="ze-product-h" data-product-id="${escapeHtml(product.id)}"${groupAttr}>

<div class="ze-product-h__media">${imageBlock}</div>

<div class="ze-product-h__body">

<p class="ze-product-h__name">${escapeHtml(shortName(product.name, 36))}</p>

<div class="ze-product-h__pricing">

${priceTiersHtml(group, activeTier)}

${group ? priceBlockHtml(group, activeTier) : simplePriceBlockHtml(product.price, 'ze-product-h__price ze-product-card__price')}

</div>

<div class="ze-product-h__actions">

${qtyStepperHtml(cartKey, qty)}

</div>

</div>

</article>`;

    };



    const tierPackBadge = (tier, group) => {

        const p = pricing();

        if (tier === 'caixa') return 'CAIXA';

        if (tier === 'pallet') return 'PALLET';

        if (group && p) {

            const variant = p.getVariant(group, tier);

            const sub = variant && p.packLineLabel({ ...variant, tier });

            if (sub) return sub.split('•')[0]?.trim().slice(0, 12).toUpperCase() || '';

        }

        return '';

    };



    const productCardSuggested = (item) => {

        const group = item?.group || null;

        const product = item?.product || item;

        const p = pricing();

        const activeTier = group && p ? p.getDefaultTier(group) : 'caixa';

        const variant = group && p ? p.getVariant(group, activeTier) : null;

        const cartKey = variant ? cartKeyFor(variant) : product.id;

        const qty = getCartQty(cartKey);

        const imgSrc = productImageUrl(group && p ? p.getTierImage(group, activeTier) : product.image);

        const packBadge = tierPackBadge(activeTier, group);

        const imageBlock = imgSrc

            ? `<img alt="" class="home-suggested-card__img ze-product-h__img ze-product-card__img--${escapeHtml(activeTier)}" src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async">`

            : `<span class="material-symbols-outlined text-3xl text-on-surface-variant/40">liquor</span>`;

        const groupAttr = group ? ` data-group-key="${escapeHtml(group.key)}" data-price-tier="${escapeHtml(activeTier)}"` : '';

        const price = variant?.price ?? product.price;

        const priceHtml = group

            ? priceBlockHtml(group, activeTier)

            : simplePriceBlockHtml(price, 'home-suggested-card__price');



        return `<article class="home-suggested-card ze-product-h" data-product-id="${escapeHtml(product.id)}"${groupAttr}>

<div class="home-suggested-card__media">

${packBadge ? `<span class="home-suggested-card__badge">${escapeHtml(packBadge)}</span>` : ''}

${imageBlock}

</div>

<p class="home-suggested-card__name">${escapeHtml(shortName(product.name, 42))}</p>

<div class="home-suggested-card__pricing">${priceTiersHtml(group, activeTier)}${priceHtml}</div>

<div class="home-suggested-card__actions">${qtyStepperHtml(cartKey, qty, { dark: true })}</div>

</article>`;

    };



    const categoryStoryHtml = (category, ringColor = '#009ee3', allCategories = []) => {
        const cover = categoryCoverMedia(category, allCategories);
        const label = formatCategoryLabel(category.name).split(' ')[0].slice(0, 8).toUpperCase();
        const media =
            cover.type === 'img'
                ? `<img alt="" class="home-story__img" src="${escapeHtml(cover.src)}" loading="lazy" decoding="async">`
                : `<span class="material-symbols-outlined home-story__icon">${cover.icon}</span>`;

        return `<a href="pedidos.html?categoria=${encodeURIComponent(category.id)}" class="home-story" style="--home-story-ring:${escapeHtml(ringColor)}" aria-label="${escapeHtml(formatCategoryLabel(category.name))}">

<div class="home-story__ring">${media}</div>

<span class="home-story__label">${escapeHtml(label)}</span>

</a>`;

    };



    const GRID_PASTELS = ['#fde8ef', '#e8f4fd', '#fef9e7', '#e8f5e9', '#f3e8fd', '#fff3e0', '#e0f7fa', '#fce4ec'];



    const categoryGridTileHtml = (category, index = 0, allCategories = []) => {
        const cover = categoryCoverMedia(category, allCategories);
        const label = formatCategoryLabel(category.name);
        const bg = GRID_PASTELS[index % GRID_PASTELS.length];
        const media =
            cover.type === 'img'
                ? `<img alt="" class="home-cat-grid__img" src="${escapeHtml(cover.src)}" loading="lazy" decoding="async">`
                : `<span class="material-symbols-outlined home-cat-grid__icon">${cover.icon}</span>`;

        return `<a href="pedidos.html?categoria=${encodeURIComponent(category.id)}" class="home-cat-grid__tile" style="--home-cat-bg:${bg}" aria-label="${escapeHtml(label)}">

<div class="home-cat-grid__media">${media}</div>

<span class="home-cat-grid__label">${escapeHtml(label)}</span>

</a>`;

    };



    const updateCardPriceUi = (card) => {

        const p = pricing();

        if (!p || !card?.dataset?.groupKey) return;

        const groups = window.__ligProductGroups;

        const group = groups?.get?.(card.dataset.groupKey);

        if (!group) return;

        const tier = card.dataset.priceTier || p.getDefaultTier(group);

        const variant = p.getVariant(group, tier);

        const cartKey = cartKeyFor(variant);

        const qty = getCartQty(cartKey);



        const display = card.querySelector('[data-price-display]');

        if (display) display.outerHTML = priceBlockHtml(group, tier);



        const stepper = card.querySelector('.ze-add-btn, .ze-qty-stepper');

        const dark = card.classList.contains('home-suggested-card');

        if (stepper) stepper.outerHTML = qtyStepperHtml(cartKey, qty, { dark });



        card.querySelectorAll('.ze-price-tier').forEach((btn) => {

            const isActive = btn.dataset.priceTier === tier;

            btn.classList.toggle('ze-price-tier--active', isActive);

            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

        });



        const imgEl = card.querySelector('.ze-product-card__img, .ze-product-h__img');

        if (imgEl) {

            const src = productImageUrl(p.getTierImage(group, tier));

            if (src) imgEl.src = src;

            imgEl.classList.remove('ze-product-card__img--unidade', 'ze-product-card__img--caixa', 'ze-product-card__img--pallet');

            imgEl.classList.add(`ze-product-card__img--${tier}`);

        }

    };



    const categoryTileHtml = (category, allCategories = []) => {
        const cover = categoryCoverMedia(category, allCategories);
        const label = formatCategoryLabel(category.name);
        const media =
            cover.type === 'img'
                ? `<img alt="" class="ze-cat-tile__img" src="${escapeHtml(cover.src)}" loading="lazy" decoding="async">`
                : `<span class="material-symbols-outlined ze-cat-tile__icon">${cover.icon}</span>`;



        return `<a href="pedidos.html?categoria=${encodeURIComponent(category.id)}" class="ze-cat-tile" aria-label="${escapeHtml(label)}">

<div class="ze-cat-tile__circle">${media}</div>

<span class="ze-cat-tile__label">${escapeHtml(label)}</span>

</a>`;

    };



    const bindPriceTiers = (root) => {

        root.addEventListener('click', (e) => {

            const tierBtn = e.target.closest('.ze-price-tier');

            if (!tierBtn) return;

            const card = tierBtn.closest('.ze-product-card, .ze-product-h, .home-suggested-card, .ofertas-product-row');

            if (!card?.dataset?.groupKey) return;

            card.dataset.priceTier = tierBtn.dataset.priceTier;

            updateCardPriceUi(card);

        });

    };



    const bindQtySteppers = (root, handlers) => {

        bindPriceTiers(root);



        root.addEventListener('click', (e) => {

            const addBtn = e.target.closest('.ze-add-btn');

            const minus = e.target.closest('.ze-qty-minus');

            const plus = e.target.closest('.ze-qty-plus');

            const cartKey = addBtn?.dataset.cartKey || minus?.dataset.cartKey || plus?.dataset.cartKey;

            if (!cartKey) return;



            const card = e.target.closest('.ze-product-card, .ze-product-h, .home-suggested-card, .ofertas-product-row');

            const ctx = card ? resolveCardContext(card) : { cartKey, variant: null, group: null };



            if (addBtn || plus) {

                handlers.onAdd(ctx, e.target.closest('[data-product-id]'));

                const btn = addBtn;

                if (btn) {

                    btn.classList.remove('ze-add-btn--pop');

                    void btn.offsetWidth;

                    btn.classList.add('ze-add-btn--pop');

                }

            } else if (minus) handlers.onRemove(ctx, e.target.closest('[data-product-id]'));

        });

    };



    const buildCartLineFields = (ctx, pricing) => {
        const { variant, group, cartKey, tier } = ctx || {};
        if (!variant) return null;
        const packType = variant.tier || tier || 'caixa';
        const key = cartKey || cartKeyFor(variant);
        const name = pricing.cartItemName({ ...variant, tier: packType }, group);
        const image = productImageUrl(
            group && pricing ? pricing.getTierImage(group, packType) : variant.image
        );
        return {
            key,
            id: variant.id,
            cartKey: key,
            name,
            price: variant.price,
            packType,
            image: image || '',
        };
    };



    window.LigeirinhoCatalog = {

        formatPrice,

        escapeHtml,

        productImageUrl,

        formatCategoryLabel,

        shortName,

        cartKeyFor,

        getCartQty,

        qtyStepperHtml,

        productCardZe,

        productCardHorizontal,

        productCardSuggested,

        categoryStoryHtml,

        categoryGridTileHtml,

        categoryTileHtml,

        categoryCoverMedia,

        resolveCatalogCategory,

        isGeloProductName,

        bindQtySteppers,

        updateCardPriceUi,

        resolveCardContext,

        buildCartLineFields,

    };

})();

