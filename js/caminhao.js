(function () {
    const root = document.getElementById('caminhao-app');
    if (!root) return;

    const LG_DESKTOP = '(min-width: 1024px)';
    if (window.matchMedia(LG_DESKTOP).matches && !new URLSearchParams(window.location.search).has('mobile')) {
        const target = new URL('pedidos.html', window.location.href);
        target.searchParams.set('caminhao', 'open');
        window.location.replace(target.toString());
        return;
    }

    const cartApi = window.LigeirinhoCart;
    const cartUi = window.LigeirinhoCartUI;
    if (!cartApi) return;

    const STORE_LABEL = 'LIGEIRINHO · BEBIDAS';
    const PAY_LABEL = 'Pagar com Mercado Pago';
    let checkoutBound = false;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) => {
        if (value == null || Number.isNaN(value)) return '—';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const truckIllustration = () => `<div class="caminhao-empty__art" aria-hidden="true">
<svg class="caminhao-empty__svg" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
<ellipse cx="100" cy="118" rx="72" ry="14" fill="#ECECEC"/>
<ellipse cx="62" cy="52" rx="28" ry="28" fill="#F0F0F0"/>
<ellipse cx="138" cy="48" rx="22" ry="22" fill="#F0F0F0"/>
<rect x="28" y="58" width="96" height="52" rx="6" fill="#F7D53C"/>
<path d="M124 62h34c6 0 11 5 11 11v37h-45V62z" fill="#BDBDBD"/>
<rect x="132" y="70" width="22" height="16" rx="2" fill="#E8E8E8"/>
<circle cx="52" cy="112" r="10" fill="#9E9E9E"/>
<circle cx="52" cy="112" r="5" fill="#757575"/>
<circle cx="132" cy="112" r="10" fill="#9E9E9E"/>
<circle cx="132" cy="112" r="5" fill="#757575"/>
<path d="M78 34l6-10 6 10" stroke="#C4B5FD" stroke-width="3" stroke-linecap="round"/>
<path d="M96 30l4-8 4 8" stroke="#C4B5FD" stroke-width="3" stroke-linecap="round"/>
<path d="M114 34l6-10 6 10" stroke="#C4B5FD" stroke-width="3" stroke-linecap="round"/>
</svg>
</div>`;

    const emptyStateHtml = () => {
        const hasLast = Boolean(cartApi.lastOrderSummary());
        return `<div class="caminhao-empty">
${truckIllustration()}
<h2 class="caminhao-empty__title">Caminhão vazio</h2>
<p class="caminhao-empty__text">Produtos adicionados serão exibidos aqui.</p>
<a href="pedidos.html" class="caminhao-empty__cta">Adicionar produtos</a>
${hasLast ? `<button type="button" class="caminhao-empty__reorder" id="caminhao-reorder-btn">Repetir último pedido</button>` : ''}
</div>`;
    };

    const itemRowHtml = (item) => {
        const lineKey = item.cartKey || item.id;
        const subtotal = formatPrice((item.price ?? 0) * item.qty);
        return `<article class="caminhao-item" data-cart-line="${esc(lineKey)}">
<div class="caminhao-item__main">
<p class="caminhao-item__name">${esc(item.name)}</p>
<p class="caminhao-item__meta">${item.qty}x · ${subtotal}</p>
</div>
<div class="caminhao-item__actions">
<button type="button" class="caminhao-item__qty caminhao-item__qty--minus cart-qty-minus" data-id="${esc(lineKey)}" aria-label="Diminuir">−</button>
<span class="caminhao-item__qty-val">${item.qty}</span>
<button type="button" class="caminhao-item__qty caminhao-item__qty--plus cart-qty-plus" data-id="${esc(lineKey)}" aria-label="Aumentar">+</button>
<button type="button" class="caminhao-item__remove cart-remove" data-id="${esc(lineKey)}" aria-label="Remover">
<span class="material-symbols-outlined">delete</span>
</button>
</div>
</article>`;
    };

    const payBtnLogoHtml = () =>
        cartUi?.payButtonHtml?.() ||
        '<img src="img/mercado-pago-logo-white-horizontal.svg" alt="" class="lig-mp-pay-logo" width="108" height="27" decoding="async">';

    const checkoutHtml = () => `<section class="caminhao-checkout cart-checkout" aria-label="Detalhes do pedido">
<p class="caminhao-checkout__label">Detalhes do pedido</p>
<div class="caminhao-checkout__delivery">
<label class="caminhao-delivery-opt">
<input type="radio" name="caminhao-delivery" value="entrega" class="sr-only" data-checkout="deliveryType"> Entrega
</label>
<label class="caminhao-delivery-opt">
<input type="radio" name="caminhao-delivery" value="retirada" class="sr-only" data-checkout="deliveryType"> Retirada
</label>
</div>
<input type="text" data-checkout="address" placeholder="Endereço completo (rua, nº, bairro)" class="caminhao-input" autocomplete="street-address">
<textarea data-checkout="notes" placeholder="Observações (opcional)" rows="2" class="caminhao-input caminhao-input--area"></textarea>
<p class="caminhao-checkout__hint">Pix, cartão de crédito ou débito via Mercado Pago.</p>
</section>
<div class="caminhao-footer">
<div class="caminhao-footer__total">
<span>Total</span>
<strong id="caminhao-total">R$ 0,00</strong>
</div>
<button type="button" id="caminhao-pay-btn" class="caminhao-pay-btn lig-cart-mp-btn" disabled aria-label="${PAY_LABEL}">${payBtnLogoHtml()}</button>
</div>`;

    const setPayButton = (cart) => {
        const btn = document.getElementById('caminhao-pay-btn');
        if (!btn) return;
        const hasItems = cartApi.cartItemCount(cart) > 0;
        const checkout = cartApi.loadCheckout();
        const needsAddress = checkout.deliveryType === 'entrega';
        const addressOk = !needsAddress || Boolean(checkout.address?.trim());
        const canCheckout = hasItems && addressOk;
        btn.disabled = !canCheckout;
        btn.classList.toggle('caminhao-pay-btn--disabled', !canCheckout);
        btn.title = needsAddress && !addressOk ? 'Informe o endereço para entrega' : '';
    };

    const renderCheckoutFields = () => {
        const checkout = cartApi.loadCheckout();
        root.querySelectorAll('.cart-checkout').forEach((section) => {
            section.querySelectorAll('[data-checkout="deliveryType"]').forEach((input) => {
                input.checked = input.value === checkout.deliveryType;
                input.closest('.caminhao-delivery-opt')?.classList.toggle('caminhao-delivery-opt--active', input.checked);
            });
            const addressEl = section.querySelector('[data-checkout="address"]');
            const notesEl = section.querySelector('[data-checkout="notes"]');
            if (addressEl) {
                addressEl.value = checkout.address || '';
                addressEl.classList.toggle('hidden', checkout.deliveryType === 'retirada');
            }
            if (notesEl) notesEl.value = checkout.notes || '';
        });
    };

    const bindCheckoutFields = () => {
        if (checkoutBound) return;
        checkoutBound = true;

        const onCheckoutChange = () => {
            const section = root.querySelector('.cart-checkout');
            const deliveryInput = section?.querySelector('[data-checkout="deliveryType"]:checked');
            cartApi.saveCheckout({
                deliveryType: deliveryInput?.value || 'entrega',
                address: section?.querySelector('[data-checkout="address"]')?.value || '',
                payment: 'mercado_pago',
                notes: section?.querySelector('[data-checkout="notes"]')?.value || '',
            });
            renderCheckoutFields();
            setPayButton(cartApi.loadCart());
        };

        root.addEventListener('change', (e) => {
            if (e.target.matches('[data-checkout]')) onCheckoutChange();
        });
        root.addEventListener('input', (e) => {
            if (e.target.matches('[data-checkout="address"], [data-checkout="notes"]')) onCheckoutChange();
        });
    };

    const changeQty = (id, delta) => {
        const cart = cartApi.loadCart();
        if (!cart[id]) return;
        cart[id].qty += delta;
        if (cart[id].qty <= 0) delete cart[id];
        cartApi.saveCart(cart);
        render();
    };

    const removeFromCart = (id) => {
        const cart = cartApi.loadCart();
        delete cart[id];
        cartApi.saveCart(cart);
        render();
    };

    const render = () => {
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        const count = cartApi.cartItemCount(cart);
        const total = formatPrice(cartApi.cartTotalValue(cart));

        root.innerHTML = `<div class="caminhao-shell">
<header class="caminhao-header">
<h1 class="caminhao-header__title">Caminhão</h1>
<button type="button" class="caminhao-header__store" aria-label="Distribuidora">
<span class="caminhao-header__store-name">${esc(STORE_LABEL)}</span>
<span class="material-symbols-outlined">expand_more</span>
</button>
${count > 0 ? `<p class="caminhao-header__count">${count === 1 ? '1 item' : `${count} itens`}</p>` : ''}
</header>
<div class="caminhao-content">
${items.length ? `<div class="caminhao-items">${items.map(itemRowHtml).join('')}</div>` : emptyStateHtml()}
</div>
${items.length ? checkoutHtml() : ''}
</div>`;

        const totalEl = document.getElementById('caminhao-total');
        if (totalEl) totalEl.textContent = total;

        setPayButton(cart);
        renderCheckoutFields();
        bindCheckoutFields();
        bindActions();
        cartApi.updateNavCartBadge();
    };

    const bindActions = () => {
        root.querySelector('#caminhao-reorder-btn')?.addEventListener('click', () => {
            if (cartApi.restoreLastOrder()) render();
        });

        root.querySelector('#caminhao-pay-btn')?.addEventListener('click', () => {
            cartUi?.startPayment?.(['caminhao-pay-btn']);
        });

        root.querySelectorAll('.cart-qty-minus').forEach((btn) => {
            btn.addEventListener('click', () => changeQty(btn.dataset.id, -1));
        });
        root.querySelectorAll('.cart-qty-plus').forEach((btn) => {
            btn.addEventListener('click', () => changeQty(btn.dataset.id, 1));
        });
        root.querySelectorAll('.cart-remove').forEach((btn) => {
            btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
        });
    };

    window.addEventListener('ligeirinho-cart-changed', render);
    window.addEventListener('ligeirinho-checkout-changed', () => {
        renderCheckoutFields();
        setPayButton(cartApi.loadCart());
    });

    render();
})();
