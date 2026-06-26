(function () {
    const root = document.getElementById('order-status-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const render = (order) => {
        const paid = order.status === 'paid';
        const pending = order.status === 'pending_payment';
        const icon = paid ? 'check_circle' : pending ? 'schedule' : 'info';
        const title = paid ? 'Pedido confirmado!' : pending ? 'Aguardando pagamento' : 'Status do pedido';
        const lead = paid
            ? 'Recebemos seu pagamento. Em breve entraremos em contato para confirmar a entrega.'
            : pending
              ? 'Assim que o Pix for compensado, confirmaremos automaticamente.'
              : 'Acompanhe o status abaixo.';

        const nfQueued = order.wantsInvoice && order.nfQueueStatus === 'queued';
        const nfWaitingPay = order.wantsInvoice && order.nfQueueStatus === 'pending_payment';
        let nfHtml = '';
        if (nfQueued) {
            nfHtml = `<div class="lig-nf-notice" role="status">
<span class="material-symbols-outlined lig-nf-notice__icon" aria-hidden="true">receipt_long</span>
<div>
<p class="lig-nf-notice__title">NF/DANFE em emissão</p>
<p class="lig-nf-notice__lead">Sua nota fiscal foi solicitada e está em processo de emissão no Ligeirinho Hub. Você será avisado quando estiver pronta.</p>
</div>
</div>`;
        } else if (nfWaitingPay && pending) {
            nfHtml = `<div class="lig-nf-notice lig-nf-notice--muted" role="status">
<span class="material-symbols-outlined lig-nf-notice__icon" aria-hidden="true">receipt_long</span>
<div>
<p class="lig-nf-notice__title">NF/DANFE solicitada</p>
<p class="lig-nf-notice__lead">Após a confirmação do pagamento, sua nota entrará na fila de emissão.</p>
</div>
</div>`;
        } else if (order.wantsInvoice && !pending && !nfQueued) {
            nfHtml = `<div class="lig-nf-notice" role="status">
<span class="material-symbols-outlined lig-nf-notice__icon" aria-hidden="true">receipt_long</span>
<div>
<p class="lig-nf-notice__title">NF/DANFE em emissão</p>
<p class="lig-nf-notice__lead">Sua nota fiscal foi solicitada e está em processo de emissão no Ligeirinho Hub.</p>
</div>
</div>`;
        }

        const itemsHtml = (order.items || [])
            .map((item) => `<li>${item.qty}x ${esc(item.name)}</li>`)
            .join('');

        root.innerHTML = `<div class="lig-payment-card ${paid ? 'lig-payment-card--success' : ''}">
<span class="material-symbols-outlined lig-payment-icon ${paid ? 'lig-payment-icon--ok' : ''}">${icon}</span>
<h1 class="lig-payment-title">${title}</h1>
<p class="lig-payment-lead">${lead}</p>
${nfHtml}
<div class="lig-payment-summary">
<p class="lig-payment-summary__meta">Pedido <code>${esc(String(order.id).slice(0, 8))}</code> · ${formatPrice(order.total)}</p>
<ul class="lig-payment-summary__list lig-payment-summary__list--compact">${itemsHtml}</ul>
</div>
<div class="lig-payment-actions">
<a href="inicio.html" class="lig-btn-primary w-full text-center">Voltar ao início</a>
<a href="pedidos.html" class="lig-btn-secondary w-full text-center mt-3">Fazer novo pedido</a>
</div>
</div>`;
    };

    const init = async () => {
        if (!orderId) {
            root.innerHTML = '<p class="lig-payment-lead">Pedido não encontrado.</p>';
            return;
        }
        try {
            const res = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            render(data.order);
            if (data.order.status === 'paid') {
                window.LigeirinhoClientNotifications?.push?.({
                    id: `order-${data.order.id}-paid`,
                    title: 'Pagamento confirmado',
                    body: `Pedido ${String(data.order.id).slice(0, 8)} recebido. Em breve confirmamos a entrega.`,
                    href: `pedido-confirmado.html?order=${encodeURIComponent(data.order.id)}`,
                    source: 'order',
                });
            }
            if (data.order.status === 'pending_payment') {
                window.setInterval(async () => {
                    const r = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`);
                    const d = await r.json();
                    if (d.order?.status === 'paid') {
                        render(d.order);
                    }
                }, 5000);
            }
        } catch (err) {
            root.innerHTML = `<p class="lig-payment-lead">${esc(err.message)}</p>`;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
