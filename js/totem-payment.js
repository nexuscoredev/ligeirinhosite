(function () {
    const root = document.getElementById('payment-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const caixaUrl = (id) => `totem-caixa.html?order=${encodeURIComponent(id)}`;
    const splitsApi = window.LigeirinhoPaymentSplits;

    const TOTEM_METHODS = [
        { id: 'pix', label: 'Pix', brand: 'img/icon-pix.svg' },
        { id: 'cartao', label: 'Cartão', icon: 'credit_card' },
        { id: 'dinheiro', label: 'Dinheiro', icon: 'payments' },
    ];

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const loading = window.LigeirinhoTotemLoading;

    let currentOrder = null;
    let selectedIds = [];
    let amountInputs = {};
    let formError = '';

    const methodLabel = (id) => TOTEM_METHODS.find((m) => m.id === id)?.label || id;

    const showError = (msg) => {
        root.innerHTML = `<div class="lig-payment-card lig-payment-card--error totem-pay-card">
<h1 class="lig-payment-title">Não foi possível continuar</h1>
<p class="lig-payment-lead">${esc(msg)}</p>
<a href="totem.html" class="totem-btn totem-btn--primary totem-pay-back" data-totem-cancel>Voltar ao totem</a>
</div>`;
    };

    const formatCategoryLabel = (id, name) => {
        if (name) return String(name);
        const raw = String(id || '')
            .replace(/[-_]+/g, ' ')
            .trim();
        if (!raw || raw === 'outros') return 'Outros';
        return raw
            .toLowerCase()
            .split(/\s+/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const inferCategoryFromName = (name) => {
        const n = String(name || '').toUpperCase();
        if (/\bCERVEJA\b|\bCHOPP\b|\bCHOP\b|\bLAGER\b|\bPILSEN\b/.test(n)) {
            return { id: 'cervejas', label: 'Cervejas' };
        }
        if (/\bGIN\b/.test(n)) return { id: 'gins', label: 'Gins' };
        if (/\bVODKA\b/.test(n)) return { id: 'vodkas', label: 'Vodkas' };
        if (/\bWHISKY\b|\bWHISKEY\b/.test(n)) return { id: 'whiskys', label: 'Whiskys' };
        if (/\bVINHO\b|\bWINE\b/.test(n)) return { id: 'vinhos', label: 'Vinhos' };
        if (/\bREFRIG\b|\bSUCO\b|\bAGUA\b|\bÁGUA\b/.test(n)) return { id: 'refrigerantes', label: 'Refrigerantes' };
        if (/\bDESTILAD/.test(n) || /\bRUM\b|\bTEQUILA\b|\bCACHACA\b|\bCACHAÇA\b/.test(n)) {
            return { id: 'destilados', label: 'Destilados' };
        }
        return { id: 'outros', label: 'Outros' };
    };

    const resolveItemCategory = (item) => {
        if (item.categoryId || item.categoryName) {
            const id = String(item.categoryId || item.categoryName).toLowerCase();
            return {
                id,
                label: formatCategoryLabel(item.categoryId, item.categoryName),
            };
        }
        return inferCategoryFromName(item.name);
    };

    const groupItemsByCategory = (items) => {
        const groups = new Map();
        (items || []).forEach((item) => {
            const { id, label } = resolveItemCategory(item);
            if (!groups.has(id)) {
                groups.set(id, { id, label, items: [] });
            }
            groups.get(id).items.push(item);
        });
        return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    };

    const renderSummary = (order) => {
        const groups = groupItemsByCategory(order.items || []);
        const groupsHtml = groups
            .map((group) => {
                const lines = group.items
                    .map(
                        (item) =>
                            `<li><span class="totem-pay-summary__item-name">${item.qty}x ${esc(item.name)}</span><span class="totem-pay-summary__item-price">${formatPrice(item.price * item.qty)}</span></li>`
                    )
                    .join('');
                return `<section class="totem-pay-summary__group">
<h3 class="totem-pay-summary__cat">${esc(group.label)}</h3>
<ul class="lig-payment-summary__list totem-pay-summary__list">${lines}</ul>
</section>`;
            })
            .join('');
        return `<div class="lig-payment-summary totem-pay-summary">
<h2 class="lig-payment-summary__title">Resumo do pedido</h2>
<div class="totem-pay-summary__scroll" tabindex="0" aria-label="Itens do pedido">${groupsHtml}</div>
<p class="lig-payment-summary__total totem-pay-summary__total"><span>Total</span><strong>${formatPrice(order.total)}</strong></p>
</div>`;
    };

    const initSelection = (order) => {
        currentOrder = order;
        formError = '';
        selectedIds = [];
        amountInputs = {};
        const splits = splitsApi?.resolveOrderSplits?.(order) || [];
        if (splits.length >= 2) {
            selectedIds = splits.map((s) => s.method);
            splits.forEach((s) => {
                amountInputs[s.method] = splitsApi.formatMoneyInput(s.amount);
            });
            return;
        }
        const method = String(order.paymentMethod || '').toLowerCase();
        if (method && !method.includes('+')) {
            selectedIds = [method.split('+')[0]];
            amountInputs[selectedIds[0]] = splitsApi.formatMoneyInput(order.total);
        }
    };

    const toggleMethod = (id) => {
        if (!currentOrder) return;
        formError = '';
        const total = Number(currentOrder.total) || 0;
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
                ? ' totem-pay-amounts__sum--ok'
                : diff > 0
                  ? ' totem-pay-amounts__sum--low'
                  : ' totem-pay-amounts__sum--high';
        return `<div class="totem-pay-amounts">
<p class="totem-pay-amounts__title">Quanto em cada forma?</p>
${selectedIds
    .map(
        (id) => `<label class="totem-pay-amounts__row">
<span class="totem-pay-amounts__label">${esc(methodLabel(id))}</span>
<span class="totem-pay-amounts__field">
<span class="totem-pay-amounts__prefix">R$</span>
<input type="text" inputmode="decimal" class="totem-pay-amounts__input" data-payment-amount="${esc(id)}" value="${esc(amountInputs[id] || '')}" placeholder="0,00" autocomplete="off">
</span>
</label>`,
    )
    .join('')}
<p class="totem-pay-amounts__sum${sumClass}">Informado: <strong>${formatPrice(sum)}</strong> · Total: <strong>${formatPrice(total)}</strong>${Math.abs(diff) >= 0.01 ? ` · Falta: <strong>${formatPrice(Math.abs(diff))}</strong>` : ''}</p>
</div>`;
    };

    const methodButtonHtml = (opt) => {
        const active = selectedIds.includes(opt.id);
        const icon = opt.brand
            ? `<img src="${esc(opt.brand)}" class="totem-pay-mark totem-pay-mark--pix totem-pay-method__brand" width="72" height="26" alt="">`
            : `<span class="material-symbols-outlined" aria-hidden="true">${esc(opt.icon)}</span>`;
        return `<button type="button" class="totem-pay-method totem-pay-method--multi${active ? ' totem-pay-method--active' : ''}" data-method="${esc(opt.id)}" aria-pressed="${active ? 'true' : 'false'}" aria-label="${esc(opt.label)}">
<span class="material-symbols-outlined totem-pay-method__check" aria-hidden="true">${active ? 'check_circle' : 'radio_button_unchecked'}</span>
${icon}
<span class="totem-pay-method__label">${esc(opt.label)}</span>
</button>`;
    };

    const bindAmountInputs = (total) => {
        const updateAmountsSum = () => {
            const sumEl = root.querySelector('.totem-pay-amounts__sum');
            if (!sumEl) return;
            const sum = splitsApi.roundMoney(
                selectedIds.reduce((acc, id) => acc + splitsApi.parseMoneyInput(amountInputs[id]), 0),
            );
            const diff = splitsApi.roundMoney(total - sum);
            const sumClass =
                Math.abs(diff) < 0.01
                    ? ' totem-pay-amounts__sum--ok'
                    : diff > 0
                      ? ' totem-pay-amounts__sum--low'
                      : ' totem-pay-amounts__sum--high';
            sumEl.className = `totem-pay-amounts__sum${sumClass}`;
            sumEl.innerHTML = `Informado: <strong>${formatPrice(sum)}</strong> · Total: <strong>${formatPrice(total)}</strong>${Math.abs(diff) >= 0.01 ? ` · Falta: <strong>${formatPrice(Math.abs(diff))}</strong>` : ''}`;
        };

        root.querySelectorAll('[data-payment-amount]').forEach((input) => {
            const attachKeyboard = () => {
                window.LigeirinhoTotemKeyboard?.init?.({
                    input,
                    mode: 'numeric',
                    submitLabel: 'OK',
                    onInput: (value) => {
                        amountInputs[input.dataset.paymentAmount] = value;
                        updateAmountsSum();
                    },
                    onSubmit: () => {
                        const id = input.dataset.paymentAmount;
                        const formatted = splitsApi.formatMoneyInput(
                            splitsApi.parseMoneyInput(amountInputs[id] || input.value),
                        );
                        amountInputs[id] = formatted;
                        input.value = formatted;
                        updateAmountsSum();
                    },
                });
            };

            input.addEventListener('focus', attachKeyboard);
            input.addEventListener('click', attachKeyboard);

            input.addEventListener('blur', () => {
                const id = input.dataset.paymentAmount;
                const formatted = splitsApi.formatMoneyInput(
                    splitsApi.parseMoneyInput(amountInputs[id] || input.value),
                );
                amountInputs[id] = formatted;
                input.value = formatted;
                updateAmountsSum();
            });
        });
    };

    const renderMethodPicker = (order) => {
        const total = Number(order.total) || 0;
        root.innerHTML = `<div class="lig-payment-card totem-pay-card totem-pay-card--picker">
<div class="totem-pay-card__head">
<h1 class="lig-payment-title">Formas de pagamento</h1>
<p class="lig-payment-lead">Selecione uma ou mais formas. Com mais de uma, informe o valor de cada.</p>
</div>
${renderSummary(order)}
<div class="totem-pay-card__footer">
<h2 class="totem-pay-methods__title">Escolha as formas</h2>
<div class="totem-pay-methods totem-pay-methods--multi" role="group" aria-label="Formas de pagamento">
${TOTEM_METHODS.map(methodButtonHtml).join('')}
</div>
${amountsHtml(total)}
${formError ? `<p class="totem-pay-error">${esc(formError)}</p>` : ''}
<div class="totem-pay-actions totem-pay-actions--confirm">
<button type="button" class="totem-btn totem-btn--primary totem-btn--xl" id="totem-pay-confirm" ${selectedIds.length ? '' : 'disabled'}>
Confirmar pagamento
</button>
<a href="totem.html" class="totem-btn totem-btn--ghost totem-pay-back" data-totem-back-cart>Cancelar</a>
</div>
</div>
</div>`;

        root.querySelectorAll('[data-method]').forEach((btn) => {
            btn.addEventListener('click', () => {
                toggleMethod(btn.dataset.method);
                renderMethodPicker(order);
            });
        });
        bindAmountInputs(total);
        root.querySelector('#totem-pay-confirm')?.addEventListener('click', () => {
            void confirmPayment(order);
        });
    };

    const buildPayload = (order) => {
        const total = Number(order.total) || 0;
        if (!selectedIds.length) {
            formError = 'Selecione pelo menos uma forma de pagamento.';
            return null;
        }
        if (selectedIds.length === 1) {
            return { orderId: order.id, method: selectedIds[0] };
        }
        const splits = selectedIds.map((method) => ({
            method,
            amount: splitsApi.parseMoneyInput(amountInputs[method]),
        }));
        const check = splitsApi.validateSplits(splits, total, methodLabel);
        if (!check.ok) {
            formError = check.error;
            return null;
        }
        return { orderId: order.id, paymentSplits: check.splits };
    };

    const confirmPayment = async (order) => {
        const payload = buildPayload(order);
        if (!payload) {
            renderMethodPicker(order);
            return;
        }
        loading?.mountPreset?.(root, 'paymentConfirm');
        try {
            const res = await fetch('/api/orders/select-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível registrar o pagamento');
            window.location.replace(caixaUrl(order.id));
        } catch (err) {
            formError = err.message || 'Erro ao continuar';
            renderMethodPicker(order);
        }
    };

    const init = async () => {
        loading?.mountPreset?.(root, 'payment');

        if (!orderId) {
            showError('Pedido não informado.');
            return;
        }

        if (!splitsApi) {
            showError('Módulo de pagamento não carregado.');
            return;
        }

        try {
            const orderRes = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`);
            const orderData = await orderRes.json();

            if (!orderRes.ok) {
                showError(orderData.error || 'Pedido não encontrado');
                return;
            }

            const order = orderData.order;
            void window.LigeirinhoTotemReceipt?.prewarmPrint?.();

            if (order.status === 'paid') {
                window.location.replace(`totem-sucesso.html?order=${encodeURIComponent(order.id)}`);
                return;
            }

            if (order.paymentChosen && order.paymentMethod) {
                window.location.replace(caixaUrl(order.id));
                return;
            }

            initSelection(order);
            renderMethodPicker(order);
        } catch (err) {
            showError(err.message || 'Erro ao carregar pagamento');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
