(function () {
    const root = document.getElementById('metodo-pagamento-app');
    if (!root) return;

    const cartApi = window.LigeirinhoCart;
    const methods = window.LigeirinhoPaymentMethods;
    const splitsApi = window.LigeirinhoPaymentSplits;
    if (!cartApi || !methods || !splitsApi) return;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) => cartApi.formatMoney(value);
    const paymentLabel = (id) => methods.label(id) || id;

    let selectedIds = [];
    let amountInputs = {};
    let formError = '';

    const initState = (checkout, total) => {
        formError = '';
        selectedIds = splitsApi.selectedMethodIds(checkout);
        amountInputs = {};
        (checkout.paymentSplits || []).forEach((entry) => {
            if (entry?.method) amountInputs[entry.method] = splitsApi.formatMoneyInput(entry.amount);
        });
        if (selectedIds.length === 1 && !amountInputs[selectedIds[0]]) {
            amountInputs[selectedIds[0]] = splitsApi.formatMoneyInput(total);
        }
    };

    const toggleMethod = (id, total) => {
        formError = '';
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter((item) => item !== id);
            delete amountInputs[id];
            return;
        }
        selectedIds.push(id);
        if (selectedIds.length === 1) {
            amountInputs[id] = splitsApi.formatMoneyInput(total);
            return;
        }
        const first = selectedIds[0];
        const firstAmount = splitsApi.parseMoneyInput(amountInputs[first]);
        amountInputs[id] = splitsApi.formatMoneyInput(Math.max(0, total - firstAmount));
    };

    const amountsHtml = (total) => {
        if (selectedIds.length < 2) return '';
        const splits = selectedIds.map((method) => ({
            method,
            amount: splitsApi.parseMoneyInput(amountInputs[method]),
        }));
        const meta = splitsApi.formatAmountsSumMeta(splits, total, {
            labelFn: paymentLabel,
            formatMoney: formatPrice,
        });
        const sumClass =
            meta.state === 'ok'
                ? ' pay-method-amounts__sum--ok'
                : meta.state === 'high'
                  ? ' pay-method-amounts__sum--high'
                  : ' pay-method-amounts__sum--low';
        return `<div class="pay-method-amounts">
<p class="pay-method-amounts__title">Quanto em cada forma?</p>
${selectedIds
    .map(
        (id) => `<label class="pay-method-amounts__row">
<span class="pay-method-amounts__label">${esc(paymentLabel(id))}</span>
<span class="pay-method-amounts__field">
<span class="pay-method-amounts__prefix">R$</span>
<input type="text" inputmode="decimal" class="pay-method-amounts__input" data-payment-amount="${esc(id)}" value="${esc(amountInputs[id] || '')}" placeholder="0,00" autocomplete="off">
</span>
</label>`,
    )
    .join('')}
<p class="pay-method-amounts__sum${sumClass}">${meta.html}</p>
</div>`;
    };

    const optionHtml = (opt, total) => {
        const active = selectedIds.includes(opt.id);
        return `<button type="button" class="pay-method-opt pay-method-opt--multi${active ? ' pay-method-opt--active' : ''}" data-payment-id="${esc(opt.id)}" aria-pressed="${active ? 'true' : 'false'}">
<span class="material-symbols-outlined pay-method-opt__check" aria-hidden="true">${active ? 'check_circle' : 'radio_button_unchecked'}</span>
<span class="pay-method-opt__icon" aria-hidden="true"><span class="material-symbols-outlined">${esc(opt.icon)}</span></span>
<span class="pay-method-opt__copy">
<strong class="pay-method-opt__label">${esc(opt.label)}</strong>
${opt.hint ? `<span class="pay-method-opt__hint">${esc(opt.hint)}</span>` : ''}
</span>
</button>`;
    };

    const saveSelection = (total) => {
        if (!selectedIds.length) {
            formError = 'Selecione pelo menos uma forma de pagamento.';
            return false;
        }
        if (selectedIds.length === 1) {
            cartApi.saveCheckout({
                paymentMethod: selectedIds[0],
                payment: selectedIds[0],
                paymentSplits: [],
            });
            return true;
        }
        const splits = selectedIds.map((method) => ({
            method,
            amount: splitsApi.parseMoneyInput(amountInputs[method]),
        }));
        const check = splitsApi.validateSplits(splits, total, paymentLabel);
        if (!check.ok) {
            formError = check.error;
            return false;
        }
        cartApi.saveCheckout({
            paymentMethod: splits[0].method,
            payment: splits[0].method,
            paymentSplits: check.splits,
        });
        return true;
    };

    const orderTotal = () => {
        const cart = cartApi.loadCart();
        const checkout = cartApi.loadCheckout();
        const subtotal = cartApi.cartSummary(cart).subtotal;
        const feeApi = window.LigeirinhoDeliveryFee;
        const auth = window.LigeirinhoAuth;
        const fee = feeApi?.resolveFee?.(auth?.loadSession?.(), checkout) ?? 0;
        return feeApi?.orderTotal?.(subtotal, fee) ?? subtotal;
    };

    const render = () => {
        const cart = cartApi.loadCart();
        if (!cartApi.cartItemCount(cart)) {
            window.location.replace('caminhao.html');
            return;
        }

        const total = orderTotal();
        const canConfirm = selectedIds.length > 0;

        root.innerHTML = `<div class="checkout-flow-shell checkout-flow-shell--plain pay-method-shell">
<header class="checkout-flow-header checkout-flow-header--plain pay-method-header">
<button type="button" class="checkout-flow-header__back" id="pay-method-back-btn" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<div class="pay-method-header__main">
<h1 class="checkout-flow-header__title checkout-flow-header__title--solo pay-method-header__title">Método de Pagamento</h1>
<p class="pay-method-header__lead">Selecione uma ou mais formas. Com mais de uma, informe o valor de cada.</p>
</div>
</header>

<div class="checkout-flow-content pay-method-list">
${methods.OPTIONS.map((opt) => optionHtml(opt, total)).join('')}
${amountsHtml(total)}
${formError ? `<p class="pay-method-error">${esc(formError)}</p>` : ''}
</div>

<footer class="pay-method-footer">
<div class="pay-method-footer__total">
<p class="pay-method-footer__label">Total estimado</p>
<strong class="pay-method-footer__value">${formatPrice(total)}</strong>
</div>
<button type="button" id="pay-method-confirm-btn" class="checkout-continue-btn pay-method-footer__btn${canConfirm ? '' : ' checkout-continue-btn--disabled'}" ${canConfirm ? '' : 'disabled'} aria-label="Confirmar método de pagamento">
<span>Confirmar método</span>
<span class="checkout-continue-btn__icon" aria-hidden="true"><span class="material-symbols-outlined">arrow_forward</span></span>
</button>
</footer>
</div>`;

        bindActions(total);
    };

    const afterConfirm = () => {
        const checkout = cartApi.loadCheckout();
        if (checkout.deliveryType === 'entrega' && !checkout.deliveryDate) {
            window.location.href = 'data-entrega.html';
            return;
        }
        window.location.href = 'resumo.html';
    };

    const bindActions = (total) => {
        document.getElementById('pay-method-back-btn')?.addEventListener('click', () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = 'resumo.html';
        });

        root.querySelectorAll('[data-payment-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                toggleMethod(btn.dataset.paymentId || '', total);
                render();
            });
        });

        root.querySelectorAll('[data-payment-amount]').forEach((input) => {
            input.addEventListener('input', () => {
                amountInputs[input.dataset.paymentAmount] = input.value;
                const block = root.querySelector('.pay-method-amounts');
                if (block) block.outerHTML = amountsHtml(total);
                bindAmountInputs(total);
            });
            input.addEventListener('blur', () => {
                const id = input.dataset.paymentAmount;
                amountInputs[id] = splitsApi.formatMoneyInput(splitsApi.parseMoneyInput(input.value));
                render();
            });
        });

        document.getElementById('pay-method-confirm-btn')?.addEventListener('click', () => {
            if (!saveSelection(total)) {
                render();
                return;
            }
            afterConfirm();
        });
    };

    const bindAmountInputs = (total) => {
        root.querySelectorAll('[data-payment-amount]').forEach((input) => {
            input.addEventListener('input', () => {
                amountInputs[input.dataset.paymentAmount] = input.value;
                const block = root.querySelector('.pay-method-amounts');
                if (block) block.outerHTML = amountsHtml(total);
                bindAmountInputs(total);
            });
            input.addEventListener('blur', () => {
                const id = input.dataset.paymentAmount;
                amountInputs[id] = splitsApi.formatMoneyInput(splitsApi.parseMoneyInput(input.value));
                render();
            });
        });
    };

    const cart = cartApi.loadCart();
    if (!cartApi.cartItemCount(cart)) {
        window.location.replace('caminhao.html');
    } else {
        initState(cartApi.loadCheckout(), orderTotal());
        render();
    }
})();
