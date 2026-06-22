(function () {
    const root = document.getElementById('resumo-app');
    if (!root) return;

    const cartApi = window.LigeirinhoCart;
    const auth = window.LigeirinhoAuth;
    if (!cartApi) return;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) => cartApi.formatMoney(value);

    const session = () => auth?.loadSession?.() || null;

    const paymentMethods = () => {
        const s = session();
        if (s?.paymentMethods?.length) return s.paymentMethods;
        return [
            { id: 'mercado_pago', label: 'Pix / Cartão (Mercado Pago)', hint: 'Pagamento online imediato' },
            { id: 'boleto', label: 'Boleto', hint: 'Taxas podem ser aplicadas' },
            { id: 'dinheiro', label: 'Dinheiro', hint: 'Na entrega ou retirada' },
        ];
    };

    const deliveryApi = window.LigeirinhoParceiroDelivery;

    const deliveryOptions = () => {
        const s = session();
        const dias = s?.datasEntrega || [];
        if (dias.length && deliveryApi?.deliveryDateOptions) {
            return deliveryApi.deliveryDateOptions(dias);
        }
        if (s?.deliveryDateOptions?.length) return s.deliveryDateOptions;
        return [];
    };

    const syncDeliveryDateWithHub = () => {
        const checkout = cartApi.loadCheckout();
        const dias = session()?.datasEntrega || [];
        if (!checkout.deliveryDate) return;
        if (!dias.length) {
            cartApi.saveCheckout({ deliveryDate: '' });
            return;
        }
        if (deliveryApi?.isDeliveryDateAllowed && !deliveryApi.isDeliveryDateAllowed(checkout.deliveryDate, dias)) {
            cartApi.saveCheckout({ deliveryDate: '' });
        }
    };

    const refreshParceiroProfile = async () => {
        const token = await auth?.getHubAccessToken?.();
        if (!token) return;
        try {
            const res = await fetch('/api/account/profile', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok && data.profile) auth.applyProfile(data.profile);
        } catch {
            /* mantém sessão local */
        }
    };

    let step = 'resumo';
    let pickerMode = null;

    const syncCheckoutFromSession = () => {
        const s = session();
        const patch = {};
        if (s?.condicaoPagamento) patch.condicaoPagamento = s.condicaoPagamento;
        if (Object.keys(patch).length) cartApi.saveCheckout(patch);
    };

    const validateCheckout = (checkout) => {
        const errors = {};
        if (checkout.deliveryType === 'entrega' && !checkout.address?.trim()) {
            errors.address = 'Informe o endereço para entrega.';
        }
        const opts = deliveryOptions();
        if (!opts.length) {
            errors.deliveryDate = 'Nenhum dia de entrega configurado no Hub para sua conta.';
        } else if (!checkout.deliveryDate) {
            errors.deliveryDate = 'Selecione a data de entrega.';
        } else if (!opts.some((d) => d.value === checkout.deliveryDate)) {
            errors.deliveryDate = 'Data de entrega inválida para seu cadastro.';
        }
        if (!checkout.paymentMethod) errors.paymentMethod = 'Selecione o método de pagamento.';
        return errors;
    };

    const headerHtml = (title, backAction) => `<header class="resumo-header">
<button type="button" class="resumo-header__back" id="resumo-back" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<div class="resumo-header__main">
<h1 class="resumo-header__title">${esc(title)}</h1>
<p class="resumo-header__sub">Ligeirinho Parceiros</p>
</div>
</header>`;

    const cardHtml = (title, body, badge = '') => `<section class="resumo-card">
<div class="resumo-card__head">
<h2 class="resumo-card__title">${esc(title)}</h2>
${badge ? `<span class="resumo-card__badge">${esc(badge)}</span>` : ''}
</div>
${body}
</section>`;

    const renderResumo = () => {
        syncCheckoutFromSession();
        const cart = cartApi.loadCart();
        const items = cartApi.cartEntries(cart);
        if (!items.length) {
            root.innerHTML = `${headerHtml('Resumo do pedido')}
<div class="resumo-empty"><p>Carrinho vazio.</p><a href="pedidos.html" class="conta-btn conta-btn--primary">Ver catálogo</a></div>`;
            bindBack('caminhao.html');
            return;
        }

        const checkout = cartApi.loadCheckout();
        const { units, subtotal } = cartApi.cartSummary(cart);
        const s = session();
        const errors = validateCheckout(checkout);
        const condicao = checkout.condicaoPagamento || s?.condicaoPagamento || '—';
        const dateLabel =
            deliveryOptions().find((d) => d.value === checkout.deliveryDate)?.label || 'Selecionar data';
        const diasLabel = s?.diasEntregaLabel || deliveryApi?.rotuloDiasEntrega?.(s?.datasEntrega) || '';
        const payLabel =
            paymentMethods().find((m) => m.id === checkout.paymentMethod)?.label || 'Selecionar método';

        const productsBody = items
            .slice(0, 3)
            .map(
                (item) => `<div class="resumo-product">
<div>
<p class="resumo-product__name">${esc(item.name)}</p>
<p class="resumo-product__meta">${item.qty}x · ${formatPrice(item.price)}</p>
</div>
<strong class="resumo-product__total">${formatPrice((item.price || 0) * item.qty)}</strong>
</div>`
            )
            .join('');

        root.innerHTML = `<div class="resumo-shell">
${headerHtml('Resumo do pedido')}
<div class="resumo-content">
${cardHtml('Condição de pagamento', `<p class="resumo-field-value">${esc(condicao)}</p>${s?.parcelasVencimento ? `<p class="resumo-field-hint">${esc(s.parcelasVencimento)}</p>` : ''}`)}
${cardHtml(
    'Data de entrega',
    `${diasLabel ? `<p class="resumo-field-hint">Dias liberados no seu cadastro: ${esc(diasLabel)}</p>` : '<p class="resumo-field-hint">Campo obrigatório</p>'}
<button type="button" class="resumo-select-btn${errors.deliveryDate ? ' resumo-select-btn--error' : ''}" data-open-picker="date"${deliveryOptions().length ? '' : ' disabled'}>${esc(dateLabel)}</button>
${errors.deliveryDate ? `<p class="resumo-error">${esc(errors.deliveryDate)}</p>` : ''}
${!deliveryOptions().length ? '<p class="resumo-error">Nenhum dia de entrega configurado no Hub para sua conta. Fale com seu representante.</p>' : ''}`
)}
${cardHtml(
    'Método de pagamento',
    `<p class="resumo-field-hint">Campo obrigatório</p>
<button type="button" class="resumo-select-btn${errors.paymentMethod ? ' resumo-select-btn--error' : ''}" data-open-picker="payment">${esc(payLabel)}</button>
${errors.paymentMethod ? `<p class="resumo-error">${esc(errors.paymentMethod)}</p>` : ''}`
)}
${cardHtml('Produtos', `${productsBody}${items.length > 3 ? `<p class="resumo-more">+ ${items.length - 3} itens</p>` : ''}`, String(units))}
${cardHtml(
    'Resumo do pedido',
    `<div class="resumo-total-row"><span>Subtotal (${units} produtos)</span><span>${formatPrice(subtotal)}</span></div>
<div class="resumo-total-row"><span>Taxa de entrega</span><span class="resumo-free">Grátis</span></div>
<div class="resumo-total-row resumo-total-row--final"><span>Total</span><strong>${formatPrice(subtotal)}</strong></div>`
)}
</div>
<div class="resumo-footer">
<p class="resumo-footer__total">Total estimado <strong>${formatPrice(subtotal)}</strong></p>
<button type="button" class="resumo-confirm-btn" id="resumo-confirm" ${Object.keys(errors).length ? 'disabled' : ''}>
<span>Confirmar pedido</span>
<span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>
</button>
</div>
</div>`;

        bindBack('caminhao.html');
        root.querySelectorAll('[data-open-picker]').forEach((btn) => {
            btn.addEventListener('click', () => {
                pickerMode = btn.dataset.openPicker;
                step = 'picker';
                render();
            });
        });
        root.querySelector('#resumo-confirm')?.addEventListener('click', () => confirmOrder());
    };

    const renderPicker = () => {
        const checkout = cartApi.loadCheckout();
        const title = pickerMode === 'date' ? 'Data de entrega' : 'Condições de pagamento';

        let body = '';
        const options = deliveryOptions();
        if (pickerMode === 'date') {
            if (!options.length) {
                const diasLabel =
                    session()?.diasEntregaLabel || deliveryApi?.rotuloDiasEntrega?.(session()?.datasEntrega) || '';
                body = `<p class="resumo-empty-picker">${esc(
                    diasLabel
                        ? `Seu cadastro prevê entrega em ${diasLabel}, mas não há datas disponíveis nos próximos dias. Entre em contato com seu representante.`
                        : 'Nenhum dia de entrega foi configurado no Ligeirinho Hub para sua conta. Entre em contato com seu representante.'
                )}</p>`;
            } else {
                body = options
                    .map(
                        (opt) => `<button type="button" class="resumo-option${checkout.deliveryDate === opt.value ? ' resumo-option--active' : ''}" data-pick-date="${esc(opt.value)}">
<span class="resumo-option__date">${esc(opt.label)}</span>
<span class="resumo-option__meta">${esc(opt.type)} · ${esc(opt.weekday)}</span>
<span class="resumo-option__price">${esc(opt.priceLabel)}</span>
</button>`
                    )
                    .join('');
            }
        } else {
            body = paymentMethods()
                .map(
                    (opt) => `<button type="button" class="resumo-option resumo-option--payment${checkout.paymentMethod === opt.id ? ' resumo-option--active' : ''}" data-pick-payment="${esc(opt.id)}">
<span class="material-symbols-outlined resumo-option__icon">${opt.id === 'dinheiro' ? 'payments' : opt.id === 'boleto' ? 'description' : 'credit_card'}</span>
<div class="resumo-option__body">
<strong>${esc(opt.label)}</strong>
${opt.hint ? `<span>${esc(opt.hint)}</span>` : ''}
</div>
</button>`
                )
                .join('');
        }

        const pickerLead =
            pickerMode === 'date'
                ? (() => {
                      const diasLabel = session()?.diasEntregaLabel || '';
                      return diasLabel
                          ? `Escolha uma data entre os dias liberados no seu cadastro (${diasLabel}).`
                          : 'Escolha a melhor data para receber seu pedido.';
                  })()
                : 'Escolha a forma de pagamento para este pedido.';

        root.innerHTML = `<div class="resumo-shell">
${headerHtml(title)}
<div class="resumo-content resumo-content--picker">
<p class="resumo-picker-lead">${esc(pickerLead)}</p>
<div class="resumo-options">${body}</div>
</div>
</div>`;

        bindBack('resumo');
        root.querySelectorAll('[data-pick-date]').forEach((btn) => {
            btn.addEventListener('click', () => {
                cartApi.saveCheckout({ deliveryDate: btn.dataset.pickDate });
                step = 'picker';
                pickerMode = 'payment';
                render();
            });
        });
        root.querySelectorAll('[data-pick-payment]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.pickPayment;
                cartApi.saveCheckout({ paymentMethod: id, payment: id });
                step = 'resumo';
                pickerMode = null;
                render();
            });
        });
    };

    const confirmOrder = async () => {
        const cart = cartApi.loadCart();
        const checkout = cartApi.loadCheckout();
        const errors = validateCheckout(checkout);
        if (Object.keys(errors).length) {
            step = 'resumo';
            render();
            return;
        }

        const btn = root.querySelector('#resumo-confirm');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Processando…';
        }

        const s = session();
        const items = cartApi.cartEntries(cart).map((item) => ({
            id: item.id,
            cartKey: item.cartKey || item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            packType: item.packType,
        }));

        const paymentMethod = checkout.paymentMethod || 'mercado_pago';
        const notes = [
            checkout.notes,
            checkout.deliveryDate ? `Entrega: ${checkout.deliveryDate}` : '',
            checkout.condicaoPagamento ? `Condição: ${checkout.condicaoPagamento}` : '',
        ]
            .filter(Boolean)
            .join(' · ');

        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    deliveryType: checkout.deliveryType,
                    address: checkout.address,
                    notes,
                    paymentMethod,
                    condicaoPagamento: checkout.condicaoPagamento || s?.condicaoPagamento || '',
                    deliveryDate: checkout.deliveryDate,
                    hubUserId: s?.hubUserId || '',
                    customer: {
                        name: s?.name || s?.razaoSocial || '',
                        phone: s?.phone || '',
                        email: s?.email || '',
                        hubUserId: s?.hubUserId || '',
                        cnpj: s?.cnpj || '',
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível criar o pedido.');

            cartApi.saveLastOrder(cart, checkout);

            if (paymentMethod === 'mercado_pago') {
                window.location.href = `pagamento.html?order=${encodeURIComponent(data.orderId)}`;
                return;
            }

            cartApi.saveCart({});
            window.location.href = `pedido-confirmado.html?order=${encodeURIComponent(data.orderId)}`;
        } catch (err) {
            alert(err.message || 'Erro ao confirmar pedido.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML =
                    '<span>Confirmar pedido</span><span class="resumo-confirm-btn__icon material-symbols-outlined">arrow_forward</span>';
            }
        }
    };

    const bindBack = (fallback) => {
        root.querySelector('#resumo-back')?.addEventListener('click', () => {
            if (step === 'picker') {
                step = 'resumo';
                pickerMode = null;
                render();
                return;
            }
            window.location.href = fallback;
        });
    };

    const render = () => {
        if (step === 'picker') renderPicker();
        else renderResumo();
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('picker') === 'date') {
        step = 'picker';
        pickerMode = 'date';
    } else if (params.get('picker') === 'payment') {
        step = 'picker';
        pickerMode = 'payment';
    }

    const boot = async () => {
        await refreshParceiroProfile();
        syncDeliveryDateWithHub();
        if (params.get('picker') === 'date' && !deliveryOptions().length) {
            step = 'resumo';
            pickerMode = null;
        }
        render();
    };

    boot();
})();
