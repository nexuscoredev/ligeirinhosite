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
        const sum = splitsApi.roundMoney(
            selectedIds.reduce((acc, id) => acc + splitsApi.parseMoneyInput(amountInputs[id]), 0),
        );
        const diff = splitsApi.roundMoney(total - sum);
        const sumClass =
            Math.abs(diff) < 0.01
                ? ' pay-method-amounts__sum--ok'
                : diff > 0
                  ? ' pay-method-amounts__sum--low'
                  : ' pay-method-amounts__sum--high';
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
<p class="pay-method-amounts__sum${sumClass}">Informado: <strong>${formatPrice(sum)}</strong> · Total: <strong>${formatPrice(total)}</strong>${Math.abs(diff) >= 0.01 ? ` · Falta: <strong>${formatPrice(Math.abs(diff))}</strong>` : ''}</p>
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

    const render = () => {
        const cart = cartApi.loadCart();
        if (!cartApi.cartItemCount(cart)) {
            window.location.replace('caminhao.html');
            return;
        }

        const { subtotal } = cartApi.cartSummary(cart);
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
${methods.OPTIONS.map((opt) => optionHtml(opt, subtotal)).join('')}
${amountsHtml(subtotal)}
${formError ? `<p class="pay-method-error">${esc(formError)}</p>` : ''}
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

        bindActions(subtotal);
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
        initState(cartApi.loadCheckout(), cartApi.cartSummary(cart).subtotal);
        render();
    }
})();
