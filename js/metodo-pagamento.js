(function () {
    const root = document.getElementById('metodo-pagamento-app');
    if (!root) return;

    const cartApi = window.LigeirinhoCart;
    const methods = window.LigeirinhoPaymentMethods;
    if (!cartApi || !methods) return;

    let selectedId = cartApi.loadCheckout().paymentMethod || cartApi.loadCheckout().payment || '';

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) => cartApi.formatMoney(value);

    const optionHtml = (opt) => {
        const active = opt.id === selectedId;
        return `<button type="button" class="pay-method-opt${active ? ' pay-method-opt--active' : ''}" data-payment-id="${esc(opt.id)}" aria-pressed="${active ? 'true' : 'false'}">
<span class="pay-method-opt__icon" aria-hidden="true"><span class="material-symbols-outlined">${esc(opt.icon)}</span></span>
<span class="pay-method-opt__copy">
<strong class="pay-method-opt__label">${esc(opt.label)}</strong>
${opt.hint ? `<span class="pay-method-opt__hint">${esc(opt.hint)}</span>` : ''}
</span>
</button>`;
    };

    const render = () => {
        const cart = cartApi.loadCart();
        if (!cartApi.cartItemCount(cart)) {
            window.location.replace('caminhao.html');
            return;
        }

        const { subtotal } = cartApi.cartSummary(cart);
        const canConfirm = Boolean(selectedId);

        root.innerHTML = `<div class="checkout-flow-shell checkout-flow-shell--plain pay-method-shell">
<header class="checkout-flow-header checkout-flow-header--plain pay-method-header">
<button type="button" class="checkout-flow-header__back" id="pay-method-back-btn" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<div class="pay-method-header__main">
<h1 class="checkout-flow-header__title checkout-flow-header__title--solo pay-method-header__title">Método de Pagamento</h1>
<p class="pay-method-header__lead">Escolha o método de pagamento para este pedido.</p>
</div>
</header>

<div class="checkout-flow-content pay-method-list">
${methods.OPTIONS.map(optionHtml).join('')}
</div>

<footer class="pay-method-footer">
<div class="pay-method-footer__total">
<p class="pay-method-footer__label">Total estimado</p>
<strong class="pay-method-footer__value">${formatPrice(subtotal)}</strong>
</div>
<button type="button" id="pay-method-confirm-btn" class="checkout-continue-btn pay-method-footer__btn${canConfirm ? '' : ' checkout-continue-btn--disabled'}" ${canConfirm ? '' : 'disabled'} aria-label="Confirmar método de pagamento">
<span>Confirmar método</span>
<span class="checkout-continue-btn__icon" aria-hidden="true"><span class="material-symbols-outlined">arrow_forward</span></span>
</button>
</footer>
</div>`;

        bindActions();
    };

    const afterConfirm = () => {
        const checkout = cartApi.loadCheckout();
        if (checkout.deliveryType === 'entrega' && !checkout.deliveryDate) {
            window.location.href = 'data-entrega.html';
            return;
        }
        window.location.href = 'resumo.html';
    };

    const bindActions = () => {
        document.getElementById('pay-method-back-btn')?.addEventListener('click', () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = 'resumo.html';
        });

        root.querySelectorAll('[data-payment-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                selectedId = btn.dataset.paymentId || '';
                render();
            });
        });

        document.getElementById('pay-method-confirm-btn')?.addEventListener('click', () => {
            if (!selectedId) return;
            cartApi.saveCheckout({
                paymentMethod: selectedId,
                payment: selectedId,
            });
            afterConfirm();
        });
    };

    render();
})();
