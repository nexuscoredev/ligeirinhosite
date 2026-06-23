(function () {
    const root = document.getElementById('payment-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const isTotem =
        window.LIG_PAYMENT_MODE === 'totem' || document.body?.dataset?.page === 'totem-pagamento';
    const successUrl = (id) =>
        isTotem
            ? `totem-sucesso.html?order=${encodeURIComponent(id)}`
            : `pedido-confirmado.html?order=${encodeURIComponent(id)}`;
    const catalogUrl = isTotem ? 'totem.html' : 'pedidos.html';

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const showError = (msg) => {
        root.innerHTML = `<div class="lig-payment-card lig-payment-card--error">
<h1 class="lig-payment-title">Pagamento indisponível</h1>
<p class="lig-payment-lead">${esc(msg)}</p>
<a href="${catalogUrl}" class="lig-btn-primary w-full text-center mt-4">Voltar ao catálogo</a>
</div>`;
    };

    const renderSummary = (order) => {
        const itemsHtml = (order.items || [])
            .map(
                (item) =>
                    `<li><span>${item.qty}x ${esc(item.name)}</span><span>${formatPrice(item.price * item.qty)}</span></li>`
            )
            .join('');
        return `<div class="lig-payment-summary">
<h2 class="lig-payment-summary__title">Resumo do pedido</h2>
<ul class="lig-payment-summary__list">${itemsHtml}</ul>
<p class="lig-payment-summary__total"><span>Total</span><strong>${formatPrice(order.total)}</strong></p>
${order.deliveryType === 'entrega' && order.address ? `<p class="lig-payment-summary__meta">Entrega: ${esc(order.address)}</p>` : '<p class="lig-payment-summary__meta">Retirada na loja</p>'}
</div>`;
    };

    const renderPixPending = (order) => {
        const qr = order.pixQrBase64
            ? `<img class="lig-payment-pix__qr" src="data:image/png;base64,${order.pixQrBase64}" alt="QR Code Pix" width="220" height="220">`
            : '';
        const copy = order.pixQrCode
            ? `<div class="lig-payment-pix__copy">
<label class="lig-payment-label">Pix copia e cola</label>
<textarea class="lig-payment-pix__code" readonly rows="3">${esc(order.pixQrCode)}</textarea>
<button type="button" class="lig-btn-secondary w-full" id="pix-copy-btn">Copiar código Pix</button>
</div>`
            : '';
        root.innerHTML = `<div class="lig-payment-card">
<span class="material-symbols-outlined lig-payment-icon lig-payment-icon--pending">schedule</span>
<h1 class="lig-payment-title">Aguardando Pix</h1>
<p class="lig-payment-lead">Escaneie o QR Code ou copie o código. Atualizamos automaticamente quando o pagamento for confirmado.</p>
${renderSummary(order)}
<div class="lig-payment-pix">${qr}${copy}</div>
<p class="lig-payment-hint">Pedido <code>${esc(order.id.slice(0, 8))}</code></p>
</div>`;
        document.getElementById('pix-copy-btn')?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(order.pixQrCode);
            } catch {
                /* ignore */
            }
        });
    };

    const notifyOrderPaid = (order) => {
        window.LigeirinhoClientNotifications?.push?.({
            id: `order-${order.id}-paid`,
            title: 'Pagamento confirmado',
            body: `Pedido ${String(order.id).slice(0, 8)} recebido. Em breve confirmamos a entrega.`,
            href: successUrl(order.id),
            source: 'order',
        });
    };

    const renderPaid = (order) => {
        notifyOrderPaid(order);
        window.location.replace(successUrl(order.id));
    };

    const mountPixCheckout = async (order) => {
        root.innerHTML = `<div class="lig-payment-card">
<p class="lig-payment-lead">Gerando código Pix…</p>
${renderSummary(order)}
</div>`;
        try {
            const res = await fetch('/api/payments/pix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao gerar Pix');
            const merged = {
                ...order,
                ...(data.order || {}),
                pixQrCode: data.pix?.qr_code || data.order?.pixQrCode,
                pixQrBase64: data.pix?.qr_code_base64 || data.order?.pixQrBase64,
            };
            renderPixPending(merged);
            startPolling(order.id);
        } catch (err) {
            showError(err.message);
        }
    };

    const mountBrick = async (order, publicKey, { cardsOnly = false } = {}) => {
        const hint = cardsOnly
            ? 'Pagamento seguro via Mercado Pago · débito e crédito'
            : 'Pagamento seguro via Mercado Pago · Pix, crédito e débito';
        root.innerHTML = `${renderSummary(order)}<div id="payment-brick" class="lig-payment-brick"></div>
<p class="lig-payment-hint">${hint}</p>`;

        const mp = new MercadoPago(publicKey, { locale: 'pt-BR' });
        const bricks = mp.bricks();

        const paymentMethodsConfig = cardsOnly
            ? { creditCard: 'all', debitCard: 'all', maxInstallments: 12 }
            : {
                  creditCard: 'all',
                  debitCard: 'all',
                  ticket: 'all',
                  bankTransfer: 'all',
                  maxInstallments: 12,
              };

        await bricks.create('payment', 'payment-brick', {
            initialization: {
                amount: Number(order.total),
                payer: {
                    firstName: order.customerName?.split(' ')[0] || '',
                    lastName: order.customerName?.split(' ').slice(1).join(' ') || '',
                    email: order.customerEmail || undefined,
                },
            },
            customization: {
                visual: { style: { theme: 'default' } },
                paymentMethods: paymentMethodsConfig,
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
                                    notifyOrderPaid(order);
                                    window.location.href = successUrl(order.id);
                                    resolve();
                                    return;
                                }
                                if (data.status === 'pending' || data.status === 'in_process') {
                                    if (data.pix || data.order?.pixQrCode) {
                                        const merged = { ...order, ...(data.order || {}), pixQrCode: data.pix?.qr_code || data.order?.pixQrCode, pixQrBase64: data.pix?.qr_code_base64 || data.order?.pixQrBase64 };
                                        renderPixPending(merged);
                                        startPolling(order.id);
                                    }
                                    resolve();
                                    return;
                                }
                                throw new Error(data.statusDetail || 'Pagamento não aprovado');
                            })
                            .catch((err) => {
                                reject(err);
                            });
                    }),
                onError: (err) => {
                    console.error('Payment Brick error', err);
                },
            },
        });
    };

    let pollTimer = null;
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
                    notifyOrderPaid(order);
                    window.location.href = successUrl(id);
                }
            } catch {
                /* ignore */
            }
        }, 4000);
    };

    const init = async () => {
        if (!orderId) {
            showError('Pedido não informado. Volte ao caminhão e tente novamente.');
            return;
        }

        try {
            const [orderRes, configRes] = await Promise.all([
                fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`),
                fetch('/api/payments/config'),
            ]);

            const orderData = await orderRes.json();
            const configData = await configRes.json();

            if (!orderRes.ok) {
                showError(orderData.error || 'Pedido não encontrado');
                return;
            }
            if (!configRes.ok || !configData.publicKey) {
                const missing = (configData.missing || configData.capabilities?.missing?.card || []).join(', ');
                const webhook = configData.webhookUrl ? `\n\nWebhook MP: ${configData.webhookUrl}` : '';
                showError(
                    (configData.error || 'Pagamento online não configurado no servidor.') +
                        (missing ? ` (${missing})` : '') +
                        webhook
                );
                return;
            }

            const order = orderData.order;
            if (order.status === 'paid') {
                renderPaid(order);
                return;
            }
            if (order.status === 'pending_payment' && order.pixQrCode) {
                renderPixPending(order);
                startPolling(order.id);
                return;
            }

            const method = String(order.paymentMethod || '').toLowerCase();
            if (method === 'pix') {
                await mountPixCheckout(order);
                return;
            }
            if (method === 'cartao') {
                await mountBrick(order, configData.publicKey, { cardsOnly: true });
                return;
            }

            await mountBrick(order, configData.publicKey);
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
