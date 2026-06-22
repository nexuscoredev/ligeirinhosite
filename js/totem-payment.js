(function () {
    const root = document.getElementById('payment-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const successUrl = (id) => `totem-sucesso.html?order=${encodeURIComponent(id)}`;

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    let pollTimer = null;
    let currentOrder = null;

    const showError = (msg, back = true) => {
        root.innerHTML = `<div class="lig-payment-card lig-payment-card--error totem-pay-card">
<h1 class="lig-payment-title">Não foi possível continuar</h1>
<p class="lig-payment-lead">${esc(msg)}</p>
${back ? '<a href="totem.html" class="totem-btn totem-btn--primary totem-pay-back">Voltar ao totem</a>' : ''}
</div>`;
    };

    const renderSummary = (order) => {
        const itemsHtml = (order.items || [])
            .map(
                (item) =>
                    `<li><span>${item.qty}x ${esc(item.name)}</span><span>${formatPrice(item.price * item.qty)}</span></li>`
            )
            .join('');
        return `<div class="lig-payment-summary totem-pay-summary">
<h2 class="lig-payment-summary__title">Resumo do pedido</h2>
<ul class="lig-payment-summary__list">${itemsHtml}</ul>
<p class="lig-payment-summary__total"><span>Total</span><strong>${formatPrice(order.total)}</strong></p>
<p class="lig-payment-summary__meta">Retirada no balcão</p>
</div>`;
    };

    const renderPixPending = (order) => {
        const qr = order.pixQrBase64
            ? `<img class="lig-payment-pix__qr totem-pay-pix__qr" src="data:image/png;base64,${order.pixQrBase64}" alt="QR Code Pix" width="240" height="240">`
            : '';
        const copy = order.pixQrCode
            ? `<div class="lig-payment-pix__copy">
<label class="lig-payment-label">Pix copia e cola</label>
<textarea class="lig-payment-pix__code" readonly rows="3">${esc(order.pixQrCode)}</textarea>
<button type="button" class="totem-btn totem-btn--ghost w-full" id="pix-copy-btn">Copiar código Pix</button>
</div>`
            : '';
        root.innerHTML = `<div class="lig-payment-card totem-pay-card">
<span class="material-symbols-outlined totem-pay-icon totem-pay-icon--pix" aria-hidden="true">qr_code_2</span>
<h1 class="lig-payment-title">Pague com Pix</h1>
<p class="lig-payment-lead">Escaneie o QR Code no app do seu banco. Confirmamos automaticamente.</p>
${renderSummary(order)}
<div class="lig-payment-pix totem-pay-pix">${qr}${copy}</div>
<p class="lig-payment-hint">Código <code>${esc(String(order.id).slice(0, 8).toUpperCase())}</code></p>
</div>`;
        document.getElementById('pix-copy-btn')?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(order.pixQrCode);
            } catch {
                /* ignore */
            }
        });
        startPolling(order.id);
    };

    const renderMethodPicker = (order, payConfig) => {
        const pixOk = payConfig?.methods?.pix;
        const cardOk = payConfig?.methods?.card;
        root.innerHTML = `<div class="lig-payment-card totem-pay-card">
<h1 class="lig-payment-title">Como deseja pagar?</h1>
<p class="lig-payment-lead">Escolha Pix para pagar na hora ou cartão na maquininha integrada.</p>
${renderSummary(order)}
<div class="totem-pay-methods">
<button type="button" class="totem-pay-method${pixOk ? '' : ' totem-pay-method--disabled'}" data-method="pix" ${pixOk ? '' : 'disabled'}>
<span class="material-symbols-outlined" aria-hidden="true">qr_code_2</span>
<span class="totem-pay-method__label">Pix</span>
<span class="totem-pay-method__hint">QR Code na tela</span>
</button>
<button type="button" class="totem-pay-method${cardOk ? '' : ' totem-pay-method--disabled'}" data-method="card" ${cardOk ? '' : 'disabled'}>
<span class="material-symbols-outlined" aria-hidden="true">credit_card</span>
<span class="totem-pay-method__label">Cartão</span>
<span class="totem-pay-method__hint">Crédito ou débito</span>
</button>
</div>
${!pixOk && !cardOk ? '<p class="totem-pay-unavail">Pagamento online em configuração. Peça ajuda no balcão.</p>' : ''}
<a href="totem.html" class="totem-btn totem-btn--ghost totem-pay-back">Cancelar</a>
</div>`;

        root.querySelector('[data-method="pix"]')?.addEventListener('click', () => startPix(order));
        root.querySelector('[data-method="card"]')?.addEventListener('click', () => startCard(order, payConfig));
    };

    const startPolling = (id) => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = window.setInterval(async () => {
            try {
                const res = await fetch(`/api/orders/get?id=${encodeURIComponent(id)}`);
                if (!res.ok) return;
                const { order } = await res.json();
                if (order.status === 'paid') {
                    clearInterval(pollTimer);
                    window.LigeirinhoCart?.saveCart?.({});
                    window.location.replace(successUrl(id));
                }
            } catch {
                /* ignore */
            }
        }, 4000);
    };

    const startPix = async (order) => {
        root.innerHTML = `<div class="lig-payment-card totem-pay-card"><p class="lig-payment-lead">Gerando Pix…</p></div>`;
        try {
            const res = await fetch('/api/payments/pix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Pix indisponível');
            const merged = {
                ...order,
                ...(data.order || {}),
                pixQrCode: data.pix?.qr_code || data.order?.pixQrCode,
                pixQrBase64: data.pix?.qr_code_base64 || data.order?.pixQrBase64,
            };
            currentOrder = merged;
            renderPixPending(merged);
        } catch (err) {
            showError(err.message || 'Erro ao gerar Pix');
        }
    };

    const loadMpSdk = () =>
        new Promise((resolve, reject) => {
            if (window.MercadoPago) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://sdk.mercadopago.com/js/v2';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('SDK de cartão indisponível'));
            document.head.appendChild(script);
        });

    const startCard = async (order, payConfig) => {
        if (!payConfig?.publicKey) {
            showError('Cartão não configurado neste totem.');
            return;
        }
        root.innerHTML = `<div class="lig-payment-card totem-pay-card"><p class="lig-payment-lead">Preparando pagamento com cartão…</p></div>`;
        try {
            await loadMpSdk();
            root.innerHTML = `${renderSummary(order)}
<div class="totem-pay-card-head">
<span class="material-symbols-outlined totem-pay-icon" aria-hidden="true">credit_card</span>
<h1 class="lig-payment-title">Cartão de crédito ou débito</h1>
</div>
<div id="payment-brick" class="lig-payment-brick"></div>
<p class="lig-payment-hint">Pagamento seguro · aproxime ou insira o cartão</p>
<a href="#" class="totem-btn totem-btn--ghost totem-pay-back" id="totem-pay-change-method">Trocar forma de pagamento</a>`;

            document.getElementById('totem-pay-change-method')?.addEventListener('click', (e) => {
                e.preventDefault();
                renderMethodPicker(order, payConfig);
            });

            const mp = new MercadoPago(payConfig.publicKey, { locale: 'pt-BR' });
            await mp.bricks().create('payment', 'payment-brick', {
                initialization: {
                    amount: Number(order.total),
                    payer: { email: order.customerEmail || 'totem@ligeirinho.com.br' },
                },
                customization: {
                    paymentMethods: {
                        creditCard: 'all',
                        debitCard: 'all',
                        bankTransfer: 'none',
                        ticket: 'none',
                        maxInstallments: 6,
                    },
                },
                callbacks: {
                    onReady: () => {},
                    onSubmit: ({ formData }) =>
                        new Promise((resolve, reject) => {
                            fetch('/api/payments/create', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orderId: order.id, formData }),
                            })
                                .then(async (res) => {
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data.error || 'Pagamento recusado');
                                    if (data.status === 'approved') {
                                        window.LigeirinhoCart?.saveCart?.({});
                                        window.location.href = successUrl(order.id);
                                        resolve();
                                        return;
                                    }
                                    if (data.status === 'pending' || data.status === 'in_process') {
                                        startPolling(order.id);
                                        resolve();
                                        return;
                                    }
                                    throw new Error(data.statusDetail || 'Pagamento não aprovado');
                                })
                                .catch(reject);
                        }),
                    onError: (err) => console.error('Card payment', err),
                },
            });
        } catch (err) {
            showError(err.message || 'Erro ao carregar cartão');
        }
    };

    const init = async () => {
        if (!orderId) {
            showError('Pedido não informado.');
            return;
        }

        try {
            const [orderRes, configRes] = await Promise.all([
                fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`),
                fetch('/api/payments/config?channel=totem'),
            ]);

            const orderData = await orderRes.json();
            const payConfig = await configRes.json();

            if (!orderRes.ok) {
                showError(orderData.error || 'Pedido não encontrado');
                return;
            }

            const order = orderData.order;
            currentOrder = order;

            if (order.status === 'paid') {
                window.location.replace(successUrl(order.id));
                return;
            }
            if (order.status === 'pending_payment' && order.pixQrCode) {
                renderPixPending(order);
                return;
            }

            if (!payConfig.methods?.pix && !payConfig.methods?.card) {
                showError('Pix e cartão ainda não estão disponíveis neste totem.');
                return;
            }

            renderMethodPicker(order, payConfig);
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
