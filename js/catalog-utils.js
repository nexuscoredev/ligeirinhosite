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

        cervejas: 'sports_bar',

        destilados: 'liquor',

        whiskys: 'wine_bar',

        vodkas: 'local_bar',

        'gin-s': 'local_bar',

        'refrigerantes-sucos': 'local_cafe',

        energeticos: 'bolt',

        combos: 'local_fire_department',

        gelos: 'ac_unit',

        vinhos: 'wine_bar',

        aguas: 'water_drop',

        salgadinho: 'fastfood',

        tabacaria: 'smoking_rooms',

        cigarros: 'smoking_rooms',

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

        const tier = cardEl?.dataset?.priceTier || 'unidade';

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
<span class="ze-price-block__unit">por unidade</span>
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

        const activeTier = group && p ? p.getDefaultTier(group) : 'unidade';

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

        const activeTier = group && p ? p.getDefaultTier(group) : 'unidade';

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

        const activeTier = group && p ? p.getDefaultTier(group) : 'unidade';

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



    const categoryStoryHtml = (category, ringColor = '#009ee3') => {

        const imgSrc = productImageUrl(category.products?.[0]?.image);

        const icon = categoryIcons[category.id] || 'category';

        const label = formatCategoryLabel(category.name).split(' ')[0].slice(0, 8).toUpperCase();

        const media = imgSrc

            ? `<img alt="" class="home-story__img" src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async">`

            : `<span class="material-symbols-outlined home-story__icon">${icon}</span>`;

        return `<a href="pedidos.html?categoria=${encodeURIComponent(category.id)}" class="home-story" style="--home-story-ring:${escapeHtml(ringColor)}" aria-label="${escapeHtml(formatCategoryLabel(category.name))}">

<div class="home-story__ring">${media}</div>

<span class="home-story__label">${escapeHtml(label)}</span>

</a>`;

    };



    const GRID_PASTELS = ['#fde8ef', '#e8f4fd', '#fef9e7', '#e8f5e9', '#f3e8fd', '#fff3e0', '#e0f7fa', '#fce4ec'];



    const categoryGridTileHtml = (category, index = 0) => {

        const imgSrc = productImageUrl(category.products?.[0]?.image);

        const icon = categoryIcons[category.id] || 'category';

        const label = formatCategoryLabel(category.name);

        const bg = GRID_PASTELS[index % GRID_PASTELS.length];

        const media = imgSrc

            ? `<img alt="" class="home-cat-grid__img" src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async">`

            : `<span class="material-symbols-outlined home-cat-grid__icon">${icon}</span>`;

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



    const categoryTileHtml = (category) => {

        const imgSrc = productImageUrl(category.products?.[0]?.image);

        const icon = categoryIcons[category.id] || 'category';

        const label = formatCategoryLabel(category.name);

        const media = imgSrc

            ? `<img alt="" class="ze-cat-tile__img" src="${escapeHtml(imgSrc)}" loading="lazy" decoding="async">`

            : `<span class="material-symbols-outlined ze-cat-tile__icon">${icon}</span>`;



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

        bindQtySteppers,

        updateCardPriceUi,

        resolveCardContext,

    };

})();

