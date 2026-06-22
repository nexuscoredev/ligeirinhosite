(function () {
    const root = document.getElementById('totem-caixa-root');
    if (!root) return;

    const routing = window.LigeirinhoAuthRouting;
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

    const methodLabel = (m) => {
        const key = String(m || '').toLowerCase();
        if (key === 'pix') return 'Pix';
        if (key === 'cartao') return 'Cartão débito/crédito';
        return 'Dinheiro';
    };

    let pollTimer = null;

    const showError = (msg) => {
        root.innerHTML = `<div class="lig-payment-card lig-payment-card--error totem-pay-card">
<h1 class="lig-payment-title">Não foi possível continuar</h1>
<p class="lig-payment-lead">${esc(msg)}</p>
<a href="totem.html" class="totem-btn totem-btn--primary totem-pay-back">Voltar ao totem</a>
</div>`;
    };

    const renderWaiting = (order) => {
        const code = String(order.id).slice(0, 8).toUpperCase();
        const pay = methodLabel(order.paymentMethod);
        root.innerHTML = `<div class="lig-payment-card totem-pay-card totem-caixa-card">
<span class="material-symbols-outlined totem-pay-icon totem-caixa-card__icon" aria-hidden="true">storefront</span>
<h1 class="lig-payment-title">Dirija-se ao caixa</h1>
<p class="lig-payment-lead">Seu pedido entrou na fila do <strong>Ligeirinho Parceiros</strong>. Apresente o código abaixo para o operador finalizar o pagamento.</p>
<p class="totem-success-code totem-caixa-card__code">${esc(code)}</p>
<div class="totem-caixa-card__meta">
<p><span>Forma escolhida</span><strong>${esc(pay)}</strong></p>
<p><span>Total</span><strong>${formatPrice(order.total)}</strong></p>
</div>
<p class="lig-payment-hint totem-caixa-card__hint">
<span class="totem-caixa-pulse" aria-hidden="true"></span>
Aguardando confirmação no PDV…
</p>
</div>`;
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
        }, 3000);
    };

    const init = async () => {
        if (routing && !routing.guardPageAccess()) return;

        if (!orderId) {
            showError('Pedido não informado.');
            return;
        }

        try {
            const res = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Pedido não encontrado');

            const order = data.order;
            if (order.status === 'paid') {
                window.location.replace(successUrl(order.id));
                return;
            }
            if (!order.paymentMethod) {
                window.location.replace(`totem-pagamento.html?order=${encodeURIComponent(orderId)}`);
                return;
            }

            renderWaiting(order);
            startPolling(order.id);
        } catch (err) {
            showError(err.message || 'Erro ao carregar pedido');
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
