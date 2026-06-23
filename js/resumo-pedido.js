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

    const loadCheckoutState = () => cartApi.loadCheckout();

    const assetUrl = (path) => {
        const value = String(path || '').trim();
        if (!value || /^https?:/i.test(value)) return value;
        return value.startsWith('/') ? value : `/${value.replace(/^\.\//, '')}`;
    };

    const PAYMENT_MARKS = {
        pix: { logo: '/img/icon-pix.svg' },
        cartao: { logo: '/img/icon-cartoes.svg' },
        mercado_pago: { logo: '/img/mercado-pago-wallet-logo.svg' },
        dinheiro: { icon: 'payments' },
        prazo: { icon: 'calendar_month' },
        boleto: { icon: 'description' },
    };

    const CARTAO_LOGO_HTML =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 24" width="44" height="24" class="resumo-option__logo resumo-option__logo--cartao" aria-hidden="true">' +
        '<rect x="0" y="2" width="36" height="20" rx="3" fill="#1A1F71"/>' +
        '<text x="18" y="15.5" fill="#FFFFFF" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="700" text-anchor="middle">VISA</text>' +
        '<circle cx="55" cy="12" r="8" fill="#EB001B"/>' +
        '<circle cx="65" cy="12" r="8" fill="#F79E1B" opacity="0.95"/>' +
        '</svg>';

    const enrichPaymentMethod = (method) => {
        const mark = PAYMENT_MARKS[method.id] || {};
        const rawLogo = mark.logo || method.logo || '';
        return {
            ...method,
            icon: method.icon || mark.icon,
            logo: rawLogo ? assetUrl(rawLogo) : '',
        };
    };

    const paymentMethods = () => {
        const base = [
            enrichPaymentMethod({
                id: 'mercado_pago',
                label: 'Mercado Pago',
                hint: 'Pix, crédito e débito',
            }),
            enrichPaymentMethod({
                id: 'dinheiro',
                label: 'Dinheiro',
                hint: 'Na entrega ou retirada',
            }),
        ];
        const s = session();
        if (!s?.paymentMethods?.length) return base;
        const extra = s.paymentMethods
            .filter((m) => !['pix', 'cartao', 'mercado_pago', 'dinheiro'].includes(m.id))
            .map((m) => enrichPaymentMethod(m));
        return extra.length ? [...base, ...extra] : base;
    };

    const paymentMethodIconHtml = (opt) => {
        const enriched = enrichPaymentMethod(opt);
        if (enriched.id === 'cartao') return CARTAO_LOGO_HTML;
        const logo = enriched.logo;
        if (logo) {
            const logoMod =
                enriched.id === 'pix'
                    ? ' resumo-option__logo--pix'
                    : enriched.id === 'mercado_pago'
                      ? ' resumo-option__logo--mp'
                      : ' resumo-option__logo--cartao';
            return `<img src="${esc(logo)}" alt="" class="resumo-option__logo${logoMod}" width="44" height="24" loading="lazy" decoding="async">`;
        }
        const icon =
            enriched.icon ||
            (enriched.id === 'dinheiro' ? 'payments' : enriched.id === 'prazo' ? 'calendar_month' : 'credit_card');
        return `<span class="material-symbols-outlined resumo-option__icon" aria-hidden="true">${icon}</span>`;
    };

    const paymentMethodSelectHtml = (methodId) => {
        if (!methodId) return esc('Selecionar método');
        const opt = paymentMethods().find((m) => m.id === methodId);
        if (!opt) return esc('Selecionar método');
        return `<span class="resumo-select-btn__payment">${paymentMethodIconHtml(opt)}<span>${esc(opt.label)}</span></span>`;
    };

    const isOnlinePayment = (method) => {
        const key = String(method || '').toLowerCase();
        return key === 'pix' || key === 'cartao' || key === 'mercado_pago';
    };

    const deliveryApi = window.LigeirinhoParceiroDelivery;

    const deliveryOptions = () => {
        const dias = session()?.datasEntrega || [];
        if (deliveryApi?.deliveryDateOptions) {
            return deliveryApi.deliveryDateOptions(dias);
        }
        return [];
    };

    const syncDeliveryDateWithHub = () => {
        const checkout = cartApi.loadCheckout();
        if (!checkout.deliveryDate) return;
        const dias = session()?.datasEntrega || [];
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
        if (!checkout.deliveryDate) {
            errors.deliveryDate = 'Selecione a data de entrega.';
        } else if (!opts.some((d) => d.value === checkout.deliveryDate)) {
            errors.deliveryDate = 'Selecione uma data de entrega válida.';
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

        const checkout = loadCheckoutState();
        const { units, subtotal } = cartApi.cartSummary(cart);
        const s = session();
        const errors = validateCheckout(checkout);
        const dateLabel =
            deliveryOptions().find((d) => d.value === checkout.deliveryDate)?.label || 'Selecionar data';
        const diasLabel = s?.datasEntrega?.length
            ? s?.diasEntregaLabel || deliveryApi?.rotuloDiasEntrega?.(s?.datasEntrega) || ''
            : '';
        const payLabel = paymentMethodSelectHtml(checkout.paymentMethod);

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
${cardHtml(
    'Data de entrega',
    `${diasLabel ? `<p class="resumo-field-hint">Dias de entrega: ${esc(diasLabel)}</p>` : '<p class="resumo-field-hint">Campo obrigatório</p>'}
<button type="button" class="resumo-select-btn${errors.deliveryDate ? ' resumo-select-btn--error' : ''}" data-open-picker="date">${esc(dateLabel)}</button>
${errors.deliveryDate ? `<p class="resumo-error">${esc(errors.deliveryDate)}</p>` : ''}`
)}
${cardHtml(
    'Método de pagamento',
    `<p class="resumo-field-hint">Campo obrigatório</p>
<button type="button" class="resumo-select-btn resumo-select-btn--payment${errors.paymentMethod ? ' resumo-select-btn--error' : ''}" data-open-picker="payment">${payLabel}</button>
${errors.paymentMethod ? `<p class="resumo-error">${esc(errors.paymentMethod)}</p>` : ''}`
)}
${cardHtml('Produtos', `${productsBody}${items.length > 3 ? `<p class="resumo-more">+ ${items.length - 3} itens</p>` : ''}`, String(units))}
${cardHtml(
    'Resumo do pedido',
    `<div class="resumo-total-row resumo-total-row--final"><span>Subtotal (${units} produtos)</span><strong>${formatPrice(subtotal)}</strong></div>
<div class="resumo-total-row"><span>Taxa de entrega</span><span class="resumo-free">Grátis</span></div>`
)}
</div>
<div class="resumo-footer resumo-footer--action">
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
        const checkout = loadCheckoutState();
        const title = pickerMode === 'date' ? 'Data de entrega' : 'Condições de pagamento';

        let body = '';
        const options = deliveryOptions();
        if (pickerMode === 'date') {
            body = options
                .map(
                    (opt) => `<button type="button" class="resumo-option${checkout.deliveryDate === opt.value ? ' resumo-option--active' : ''}" data-pick-date="${esc(opt.value)}">
<span class="resumo-option__date">${esc(opt.label)}</span>
<span class="resumo-option__meta">${esc(opt.type)} · ${esc(opt.weekday)}</span>
<span class="resumo-option__price">${esc(opt.priceLabel)}</span>
</button>`
                )
                .join('');
        } else {
            body = paymentMethods()
                .map(
                    (opt) => `<button type="button" class="resumo-option resumo-option--payment${checkout.paymentMethod === opt.id ? ' resumo-option--active' : ''}" data-pick-payment="${esc(opt.id)}">
${paymentMethodIconHtml(opt)}
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
                      const diasLabel =
                          session()?.datasEntrega?.length
                              ? session()?.diasEntregaLabel || ''
                              : '';
                      return diasLabel
                          ? `Escolha uma data de entrega (${diasLabel}).`
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
        const checkout = loadCheckoutState();
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

            if (isOnlinePayment(paymentMethod)) {
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
        render();
    };

    boot();
})();
