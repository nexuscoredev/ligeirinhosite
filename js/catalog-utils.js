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



    const qtyStepperHtml = (cartKey, qty) => {

        if (qty <= 0) {

            return `<button type="button" class="ze-add-btn" data-cart-key="${escapeHtml(cartKey)}" aria-label="Adicionar ao carrinho">

<span class="material-symbols-outlined text-[18px]">add</span>

<span>Adicionar</span>

</button>`;

        }

        return `<div class="ze-qty-stepper" data-cart-key="${escapeHtml(cartKey)}">

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

        if (stepper) stepper.outerHTML = qtyStepperHtml(cartKey, qty);



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

            const card = tierBtn.closest('.ze-product-card, .ze-product-h');

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



            const card = e.target.closest('.ze-product-card, .ze-product-h');

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

        categoryTileHtml,

        bindQtySteppers,

        updateCardPriceUi,

        resolveCardContext,

    };

})();

