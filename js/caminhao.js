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

    const PAY_LABEL = 'Escolher data de entrega';
    let checkoutBound = false;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) => cartApi.formatMoney(value);

    const PREF_CATEGORY_LABELS = {
        cervejas: 'Cervejas',
        destilados: 'Destilados',
        'refrigerantes-sucos': 'Refrigerantes',
        energeticos: 'Energéticos',
        gelos: 'Gelos',
        whiskys: 'Whiskys',
        vinhos: 'Vinhos',
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

    const emptySuggestionsHtml = () => {
        const cats = (cartApi.loadPrefs?.().categories || []).slice(0, 3);
        if (!cats.length) return '';
        const chips = cats
            .map(
                (id) =>
                    `<a href="pedidos.html?categoria=${encodeURIComponent(id)}" class="caminhao-empty__chip">${esc(PREF_CATEGORY_LABELS[id] || id)}</a>`
            )
            .join('');
        return `<div class="caminhao-empty__suggest">
<p class="caminhao-empty__suggest-label">Sugestões para você</p>
<div class="caminhao-empty__chips">${chips}</div>
</div>`;
    };

    const emptyStateHtml = () => {
        const hasLast = Boolean(cartApi.lastOrderSummary());
        return `<div class="caminhao-empty">
${truckIllustration()}
<h2 class="caminhao-empty__title">Caminhão vazio</h2>
<p class="caminhao-empty__text">Adicione produtos pelo catálogo — eles aparecem aqui, como na sacola do delivery.</p>
<a href="pedidos.html" class="caminhao-empty__cta">Adicionar produtos</a>
${emptySuggestionsHtml()}
${hasLast ? `<button type="button" class="caminhao-empty__reorder" id="caminhao-reorder-btn">Repetir último pedido</button>` : ''}
</div>`;
    };

    const itemRowHtml = (item) => {
        const lineKey = item.cartKey || item.id;
        const meta = cartApi.itemMetaText(item);
        const thumb =
            cartUi?.lineThumbHtml?.(item, 'caminhao-item__thumb') ||
            '<span class="caminhao-item__thumb caminhao-item__thumb--placeholder" aria-hidden="true"><span class="material-symbols-outlined">liquor</span></span>';
        return `<article class="caminhao-item" data-cart-line="${esc(lineKey)}">
${thumb}
<div class="caminhao-item__main">
<p class="caminhao-item__name">${esc(item.name)}</p>
<p class="caminhao-item__meta">${esc(meta)}</p>
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

    const summaryBlockHtml = (cart) => {
        const { units, subtotal } = cartApi.cartSummary(cart);
        const unitsLabel = units === 1 ? '1 item' : `${units} itens`;
        return `<div class="caminhao-summary">
<div class="caminhao-summary__row"><span>Subtotal (${unitsLabel})</span><span>${formatPrice(subtotal)}</span></div>
<div class="caminhao-summary__row caminhao-summary__row--total"><span>Total</span><strong>${formatPrice(subtotal)}</strong></div>
</div>`;
    };

    const checkoutHtml = () => {
        const s = window.LigeirinhoAuth?.loadSession?.();
        const condicao = s?.condicaoPagamento || '';
        const condicaoBlock = condicao
            ? `<div class="caminhao-checkout__condicao">
<p class="caminhao-checkout__label">Condição de pagamento</p>
<p class="caminhao-checkout__condicao-value">${esc(condicao)}</p>
</div>`
            : '';
        return `<a href="pedidos.html" class="caminhao-continue">Continuar comprando</a>
<section class="caminhao-checkout cart-checkout" id="caminhao-checkout" aria-label="Detalhes do pedido">
<p class="caminhao-checkout__label">Detalhes do pedido</p>
${condicaoBlock}
<div class="caminhao-checkout__delivery">
<label class="caminhao-delivery-opt">
<input type="radio" name="caminhao-delivery" value="entrega" class="sr-only" data-checkout="deliveryType"> Entrega
</label>
<label class="caminhao-delivery-opt">
<input type="radio" name="caminhao-delivery" value="retirada" class="sr-only" data-checkout="deliveryType"> Retirada
</label>
</div>
<input type="text" data-checkout="address" id="caminhao-address" placeholder="Endereço completo (rua, nº, bairro)" class="caminhao-input" autocomplete="street-address">
<p class="caminhao-checkout__error hidden" data-checkout-error="address" role="alert"></p>
<textarea data-checkout="notes" placeholder="Observações para o entregador (opcional)" rows="2" class="caminhao-input caminhao-input--area"></textarea>
<p class="caminhao-checkout__hint">Na próxima etapa você escolhe data de entrega e forma de pagamento.</p>
</section>
<div class="caminhao-footer">
<div id="caminhao-summary"></div>
<button type="button" id="caminhao-pay-btn" class="caminhao-pay-btn caminhao-pay-btn--continue" disabled aria-label="${PAY_LABEL}">
<span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
<span>${PAY_LABEL}</span>
<span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
</button>
</div>`;
    };

    const setPayButton = (cart) => {
        const btn = document.getElementById('caminhao-pay-btn');
        if (!btn) return;
        const { canCheckout } = cartUi?.updateCheckoutErrors?.(cart) || { canCheckout: false };
        btn.disabled = !canCheckout;
        btn.classList.toggle('caminhao-pay-btn--disabled', !canCheckout);
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
            const s = window.LigeirinhoAuth?.loadSession?.();
            cartApi.saveCheckout({
                deliveryType: deliveryInput?.value || 'entrega',
                address: section?.querySelector('[data-checkout="address"]')?.value || '',
                payment: cartApi.loadCheckout().paymentMethod || '',
                paymentMethod: cartApi.loadCheckout().paymentMethod || '',
                condicaoPagamento: s?.condicaoPagamento || cartApi.loadCheckout().condicaoPagamento || '',
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
        if (cartUi?.removeFromCart) {
            cartUi.removeFromCart(id);
            return;
        }
        const cart = cartApi.loadCart();
        delete cart[id];
        cartApi.saveCart(cart);
        render();
    };

    const focusAddressIfNeeded = () => {
        if (window.location.hash !== '#endereco') return;
        const checkout = cartApi.loadCheckout();
        if (checkout.deliveryType !== 'entrega') {
            cartApi.saveCheckout({ deliveryType: 'entrega' });
            renderCheckoutFields();
        }
        window.requestAnimationFrame(() => {
            const el = document.getElementById('caminhao-address');
            el?.focus?.();
            el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        });
    };

    const render = () => {
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        const count = cartApi.cartItemCount(cart);

        root.innerHTML = `<div class="caminhao-shell">
<header class="caminhao-header">
<button type="button" class="caminhao-header__back" id="caminhao-back-btn" aria-label="Voltar">
<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span>
</button>
<div class="caminhao-header__main">
<h1 class="caminhao-header__title">Caminhão</h1>
${count > 0 ? `<p class="caminhao-header__count">${count === 1 ? '1 item no caminhão' : `${count} itens no caminhão`}</p>` : '<p class="caminhao-header__count caminhao-header__count--empty">Seu pedido em um só lugar</p>'}
</div>
</header>
<div class="caminhao-content">
${items.length ? `<div class="caminhao-items">${items.map(itemRowHtml).join('')}</div>` : emptyStateHtml()}
</div>
${items.length ? checkoutHtml() : ''}
</div>`;

        const summaryEl = document.getElementById('caminhao-summary');
        if (summaryEl) summaryEl.innerHTML = summaryBlockHtml(cart);

        setPayButton(cart);
        renderCheckoutFields();
        bindCheckoutFields();
        bindActions();
        cartApi.updateNavCartBadge();
        focusAddressIfNeeded();
    };

    const bindActions = () => {
        root.querySelector('#caminhao-back-btn')?.addEventListener('click', () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = 'pedidos.html';
        });

        root.querySelector('#caminhao-reorder-btn')?.addEventListener('click', () => {
            if (cartApi.restoreLastOrder()) render();
        });

        root.querySelector('#caminhao-pay-btn')?.addEventListener('click', () => {
            const cart = cartApi.loadCart();
            const { canCheckout } = cartUi?.updateCheckoutErrors?.(cart) || { canCheckout: false };
            if (!canCheckout) return;
            const s = window.LigeirinhoAuth?.loadSession?.();
            if (s?.condicaoPagamento) {
                cartApi.saveCheckout({ condicaoPagamento: s.condicaoPagamento });
            }
            window.location.href = 'resumo-pedido.html?picker=date';
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
