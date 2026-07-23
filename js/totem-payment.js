(function () {
    const root = document.getElementById('payment-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const caixaUrl = (id) => `totem-caixa.html?order=${encodeURIComponent(id)}`;
    const splitsApi = window.LigeirinhoPaymentSplits;
    const promoPay = () => window.LigeirinhoTotemPromoPayment;

    const TOTEM_METHODS = [
        { id: 'pix', label: 'Pix', brand: 'img/icon-pix.svg' },
        { id: 'cartao_credito', label: 'Cartão de crédito', icon: 'credit_card' },
        { id: 'cartao_debito', label: 'Cartão de débito', icon: 'credit_score' },
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

    const orderHasPromo = (order) => {
        const promo = promoPay();
        if (!promo) return false;
        if (promo.pedidoTemItemPromocional(order)) return true;
        const cart = window.LigeirinhoCart?.loadCart?.() || {};
        const cartItems = Object.values(cart).filter((item) => item?.qty > 0);
        if (cartItems.length && promo.pedidoTemItemPromocional({ items: cartItems })) return true;
        const last = window.LigeirinhoCart?.loadLastOrder?.();
        if (last?.items?.length && promo.pedidoTemItemPromocional({ items: last.items })) return true;
        return false;
    };

    const methodsForOrder = (order) => promoPay()?.metodosPermitidosTotem?.(order, TOTEM_METHODS) ?? TOTEM_METHODS;

    const stripCardFromSelection = (order) => {
        if (!promoPay()?.pagamentoUsaCartao?.(selectedIds)) return;
        selectedIds = selectedIds.filter((id) => !promoPay().metodoUsaCartao(id));
        Object.keys(amountInputs).forEach((key) => {
            if (promoPay().metodoUsaCartao(key)) delete amountInputs[key];
        });
    };

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

    const isCashMethod = (id) => splitsApi?.isCashMethod?.(id) || id === 'dinheiro';

    const initSelection = (order) => {
        currentOrder = order;
        formError = '';
        selectedIds = [];
        amountInputs = {};
        const splits = splitsApi?.resolveOrderSplits?.(order) || [];
        const cashOnlySplit =
            splits.length === 1 && isCashMethod(splits[0]?.method) && Number(splits[0]?.amount) > 0;
        if (splits.length >= 2 || cashOnlySplit) {
            selectedIds = splits.map((s) => s.method);
            splits.forEach((s) => {
                amountInputs[s.method] = splitsApi.formatMoneyInput(s.amount);
            });
            return;
        }
        const method = String(order.paymentMethod || '').toLowerCase();
        if (method && !method.includes('+')) {
            selectedIds = [method.split('+')[0]];
            amountInputs[selectedIds[0]] = isCashMethod(selectedIds[0])
                ? ''
                : splitsApi.formatMoneyInput(order.total);
        }
        stripCardFromSelection(order);
    };

    const currentSplitEntries = () =>
        selectedIds.map((method) => ({
            method,
            amount: splitsApi.parseMoneyInput(amountInputs[method]),
        }));

    const sumSelectedAmounts = (excludeId = null) =>
        splitsApi.roundMoney(
            selectedIds
                .filter((id) => id !== excludeId)
                .reduce((acc, id) => acc + splitsApi.parseMoneyInput(amountInputs[id]), 0),
        );

    /** Pix/Cartões: até o restante sem contar dinheiro. Dinheiro: sem teto (troco). */
    const maxAmountForField = (id, total) => {
        if (isCashMethod(id)) return null;
        const otherNonCash = selectedIds
            .filter((sid) => sid !== id && !isCashMethod(sid))
            .reduce((acc, sid) => acc + splitsApi.parseMoneyInput(amountInputs[sid]), 0);
        return splitsApi.roundMoney(Math.max(0, Math.min(total, total - otherNonCash)));
    };

    const clampFieldAmount = (id, rawValue, total) => {
        const parsed = splitsApi.parseMoneyInput(rawValue);
        if (!parsed) return 0;
        if (isCashMethod(id)) return parsed;
        const max = maxAmountForField(id, total);
        return Math.min(parsed, max ?? total);
    };

    const SPLIT_AMOUNTS_MSG = 'Preencha o valor das formas de pagamento para finalizar.';
    const CASH_AMOUNT_MSG = 'Informe quanto vai pagar em dinheiro.';

    const hasCashSelected = () => selectedIds.some((id) => isCashMethod(id));
    const needsAmountFields = () => selectedIds.length >= 2 || hasCashSelected();
    const isCashOnly = () => selectedIds.length === 1 && isCashMethod(selectedIds[0]);

    const isSplitAmountsValid = (total) => {
        if (!needsAmountFields()) return true;
        const everyFilled = selectedIds.every((id) => splitsApi.parseMoneyInput(amountInputs[id]) > 0);
        if (!everyFilled) return false;
        if (isCashOnly()) {
            const tendered = splitsApi.parseMoneyInput(amountInputs.dinheiro);
            return tendered + 0.009 >= total;
        }
        return Boolean(splitsApi.validateSplits(currentSplitEntries(), total, methodLabel).ok);
    };

    const splitAmountsHintHtml = (total) => {
        if (!needsAmountFields() || isSplitAmountsValid(total)) return '';
        const everyFilled = selectedIds.every((id) => splitsApi.parseMoneyInput(amountInputs[id]) > 0);
        if (!everyFilled) {
            return `<p class="totem-pay-amounts__warn">${esc(
                isCashOnly() ? CASH_AMOUNT_MSG : SPLIT_AMOUNTS_MSG,
            )}</p>`;
        }
        if (isCashOnly()) {
            const tendered = splitsApi.parseMoneyInput(amountInputs.dinheiro);
            const falta = splitsApi.roundMoney(Math.max(0, total - tendered));
            if (falta > 0.009) {
                return `<p class="totem-pay-amounts__warn">Dinheiro insuficiente. Falta ${formatPrice(falta)}.</p>`;
            }
        }
        return '';
    };

    const formatAmountsSumMeta = (total) => {
        const analysis = splitsApi.analyzeSplits(currentSplitEntries(), total);
        const everyFilled = selectedIds.every((id) => splitsApi.parseMoneyInput(amountInputs[id]) > 0);
        const ok = everyFilled && isSplitAmountsValid(total);

        // Quanto ainda falta para cobrir o pedido (mesmo com algum campo vazio).
        const falta = analysis.hasCash
            ? splitsApi.roundMoney(Math.max(0, analysis.neededFromCash - analysis.cashTendered))
            : splitsApi.roundMoney(Math.max(0, analysis.expected - analysis.tenderedSum));

        let sumClass = ' totem-pay-amounts__sum--low';
        let diffHtml = '';

        if (ok && analysis.troco > 0.009) {
            sumClass = ' totem-pay-amounts__sum--ok';
            diffHtml = ` · Troco: <strong>${formatPrice(analysis.troco)}</strong>`;
        } else if (ok) {
            sumClass = ' totem-pay-amounts__sum--ok';
        } else if (falta > 0.009) {
            sumClass = ' totem-pay-amounts__sum--low';
            diffHtml = ` · Falta: <strong>${formatPrice(falta)}</strong>`;
        } else if (analysis.nonCashSum > analysis.expected + 0.009) {
            sumClass = ' totem-pay-amounts__sum--high';
            diffHtml = ` · Excedente: <strong>${formatPrice(analysis.nonCashSum - analysis.expected)}</strong>`;
        } else if (!analysis.hasCash && analysis.tenderedSum > analysis.expected + 0.009) {
            sumClass = ' totem-pay-amounts__sum--high';
            diffHtml = ` · Excedente: <strong>${formatPrice(analysis.tenderedSum - analysis.expected)}</strong>`;
        }

        const prefix = isCashOnly()
            ? `Em dinheiro: <strong>${formatPrice(analysis.cashTendered)}</strong> · Total: <strong>${formatPrice(total)}</strong>`
            : `Informado: <strong>${formatPrice(analysis.tenderedSum)}</strong> · Total: <strong>${formatPrice(total)}</strong>`;

        return {
            ok,
            sumClass,
            html: `${prefix}${diffHtml}`,
        };
    };

    const syncConfirmButton = (total) => {
        const btn = root.querySelector('#totem-pay-confirm');
        if (!btn) return;
        btn.disabled = !selectedIds.length || (needsAmountFields() && !isSplitAmountsValid(total));
    };

    const applyFieldAmount = (input, total) => {
        const id = input.dataset.paymentAmount;
        const clamped = clampFieldAmount(id, amountInputs[id] || input.value, total);
        const formatted = splitsApi.formatMoneyInput(clamped);
        amountInputs[id] = formatted;
        input.value = formatted;
    };

    const toggleMethod = (id) => {
        if (!currentOrder) return;
        if (orderHasPromo(currentOrder) && promoPay()?.metodoUsaCartao?.(id)) {
            formError = promoPay().mensagemCartaoBloqueadoPromo();
            return;
        }
        formError = '';
        if (selectedIds.includes(id)) {
            selectedIds = selectedIds.filter((item) => item !== id);
            delete amountInputs[id];
            return;
        }
        selectedIds.push(id);
        if (selectedIds.length === 1) {
            // Pix/Cartões único: valor = total no confirm. Dinheiro: pede o valor entregue.
            amountInputs[id] = '';
            return;
        }
        if (selectedIds.length === 2) {
            // Campos de valor acabaram de aparecer: todos vazios para o cliente preencher.
            selectedIds.forEach((sid) => {
                amountInputs[sid] = '';
            });
            return;
        }
        amountInputs[id] = '';
    };

    const amountsHtml = (total) => {
        if (!needsAmountFields()) return '';
        const { sumClass, html } = formatAmountsSumMeta(total);
        const cashOnly = isCashOnly();
        const title = cashOnly ? 'Quanto vai pagar em dinheiro?' : 'Quanto em cada forma?';
        const hint = cashOnly
            ? `Informe o valor que vai entregar. O total do pedido é ${formatPrice(total)} — se for maior, o troco aparece abaixo.`
            : hasCashSelected()
              ? `Pix e cartões: até o total (${formatPrice(total)}). Dinheiro pode ser maior — o troco aparece abaixo.`
              : `Máximo por forma: até o total do pedido (${formatPrice(total)}).`;
        const rows = (cashOnly ? ['dinheiro'] : selectedIds)
            .map((id) => {
                const max = maxAmountForField(id, total);
                const ariaMax = max == null ? 'sem limite (troco)' : `máximo ${formatPrice(max)}`;
                const label = cashOnly ? 'Valor em dinheiro' : methodLabel(id);
                return `<label class="totem-pay-amounts__row">
<span class="totem-pay-amounts__label">${esc(label)}</span>
<span class="totem-pay-amounts__field">
<span class="totem-pay-amounts__prefix">R$</span>
<input type="text" inputmode="decimal" class="totem-pay-amounts__input" data-payment-amount="${esc(id)}" value="${esc(amountInputs[id] || '')}" placeholder="0,00" autocomplete="off" aria-label="${esc(label)}, ${ariaMax}">
</span>
</label>`;
            })
            .join('');
        return `<div class="totem-pay-amounts${cashOnly ? ' totem-pay-amounts--cash' : ''}">
<p class="totem-pay-amounts__title">${esc(title)}</p>
<p class="totem-pay-amounts__hint">${esc(hint)}</p>
${rows}
<p class="totem-pay-amounts__sum${sumClass}">${html}</p>
${splitAmountsHintHtml(total)}
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
            const amountsBlock = root.querySelector('.totem-pay-amounts');
            if (!sumEl) return;
            const { sumClass, html } = formatAmountsSumMeta(total);
            sumEl.className = `totem-pay-amounts__sum${sumClass}`;
            sumEl.innerHTML = html;
            amountsBlock?.querySelector('.totem-pay-amounts__warn')?.remove();
            const hint = splitAmountsHintHtml(total);
            if (hint && amountsBlock) {
                sumEl.insertAdjacentHTML('afterend', hint);
            }
            syncConfirmButton(total);
        };

        root.querySelectorAll('[data-payment-amount]').forEach((input) => {
            const attachKeyboard = () => {
                window.LigeirinhoTotemKeyboard?.init?.({
                    input,
                    mode: 'numeric',
                    submitLabel: 'OK',
                    onInput: (value) => {
                        const id = input.dataset.paymentAmount;
                        const parsed = splitsApi.parseMoneyInput(value);
                        const max = maxAmountForField(id, total);
                        if (max != null && parsed > max + 0.009) {
                            const capped = splitsApi.formatMoneyInput(max);
                            amountInputs[id] = capped;
                            input.value = capped;
                        } else {
                            amountInputs[id] = value;
                        }
                        updateAmountsSum();
                    },
                    onSubmit: () => {
                        applyFieldAmount(input, total);
                        updateAmountsSum();
                    },
                });
            };

            input.addEventListener('focus', attachKeyboard);
            input.addEventListener('click', attachKeyboard);

            input.addEventListener('blur', () => {
                applyFieldAmount(input, total);
                updateAmountsSum();
            });
        });

        syncConfirmButton(total);
    };

    const renderMethodPicker = (order) => {
        const total = Number(order.total) || 0;
        const methods = methodsForOrder(order);
        const promoHint = orderHasPromo(order)
            ? `<p class="totem-pay-promo-hint">${esc(promoPay()?.mensagemCartaoBloqueadoPromo?.() || 'Cartão indisponível para promoções.')}</p>`
            : '';
        root.innerHTML = `<div class="lig-payment-card totem-pay-card totem-pay-card--picker">
<div class="totem-pay-card__head">
<h1 class="lig-payment-title">Formas de pagamento</h1>
<p class="lig-payment-lead">Selecione uma ou mais formas. Em dinheiro, informe quanto vai entregar.</p>
</div>
${renderSummary(order)}
<div class="totem-pay-card__footer">
<h2 class="totem-pay-methods__title">Escolha as formas</h2>
${promoHint}
<div class="totem-pay-methods totem-pay-methods--multi" role="group" aria-label="Formas de pagamento">
${methods.map(methodButtonHtml).join('')}
</div>
${amountsHtml(total)}
${formError ? `<p class="totem-pay-error">${esc(formError)}</p>` : ''}
<div class="totem-pay-actions totem-pay-actions--confirm">
<button type="button" class="totem-btn totem-btn--primary totem-btn--xl" id="totem-pay-confirm" ${selectedIds.length && (!needsAmountFields() || isSplitAmountsValid(total)) ? '' : 'disabled'}>
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
            if (orderHasPromo(order) && promoPay()?.metodoUsaCartao?.(selectedIds[0])) {
                formError = promoPay().mensagemCartaoBloqueadoPromo();
                return null;
            }
            if (isCashMethod(selectedIds[0])) {
                const tendered = clampFieldAmount('dinheiro', amountInputs.dinheiro, total);
                if (tendered <= 0) {
                    formError = CASH_AMOUNT_MSG;
                    return null;
                }
                if (tendered + 0.009 < total) {
                    const falta = splitsApi.roundMoney(total - tendered);
                    formError = `Dinheiro insuficiente. Falta ${formatPrice(falta)}.`;
                    return null;
                }
                return {
                    orderId: order.id,
                    method: 'dinheiro',
                    paymentSplits: [{ method: 'dinheiro', amount: tendered }],
                };
            }
            return { orderId: order.id, method: selectedIds[0] };
        }
        if (orderHasPromo(order) && promoPay()?.pagamentoUsaCartao?.(selectedIds)) {
            formError = promoPay().mensagemCartaoBloqueadoPromo();
            return null;
        }
        const splits = selectedIds.map((method) => ({
            method,
            amount: clampFieldAmount(method, amountInputs[method], total),
        }));
        if (splits.some((item) => !isCashMethod(item.method) && item.amount > total + 0.009)) {
            formError = 'Pix e cartões não podem ser maiores que o total do pedido.';
            return null;
        }
        if (splits.some((item) => item.amount <= 0)) {
            formError = SPLIT_AMOUNTS_MSG;
            return null;
        }
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
