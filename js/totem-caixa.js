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

    const renderPaymentMethod = (m) => {
        const key = String(m || '').toLowerCase();
        if (key === 'pix') {
            return `<img src="img/icon-pix.svg" class="totem-pay-mark totem-pay-mark--pix" width="64" height="23" alt="Pix">`;
        }
        return `<strong>${esc(methodLabel(m))}</strong>`;
    };

    const formatDisplayCode = (id) =>
        String(id || '')
            .slice(0, 8)
            .toUpperCase()
            .split('')
            .join(' ');

    let currentOrder = null;

    const printReceipt = async (order, { force = false } = {}) => {
        const receipt = window.LigeirinhoTotemReceipt;
        if (!receipt?.printOrderReceipt) return false;

        let autoPrint = true;
        try {
            const res = await fetch('data/totem-units.json');
            const cfg = await res.json();
            autoPrint = cfg.defaults?.autoPrintReceipt !== false;
        } catch {
            /* use default */
        }
        if (!force && !autoPrint) return false;

        const session = window.LigeirinhoAuth?.loadSession?.();
        return receipt.printOrderReceipt(order, {
            force,
            totemLabel: order.totemLabel || session?.totemLabel,
        });
    };

    const bindReprint = () => {
        document.getElementById('totem-reprint-receipt')?.addEventListener('click', () => {
            if (currentOrder) printReceipt(currentOrder, { force: true });
        });
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
        currentOrder = order;
        const code = formatDisplayCode(order.id);
        root.innerHTML = `<div class="lig-payment-card totem-pay-card totem-caixa-card">
<span class="material-symbols-outlined totem-pay-icon totem-caixa-card__icon" aria-hidden="true">storefront</span>
<h1 class="lig-payment-title">Dirija-se ao caixa</h1>
<p class="lig-payment-lead">Seu pedido entrou na fila do <strong>Ligeirinho Parceiros</strong>. Apresente o <strong>comprovante impresso</strong> ou o código abaixo para o operador finalizar o pagamento.</p>
<p class="totem-caixa-card__print-note" id="totem-print-status" role="status">
<span class="material-symbols-outlined" aria-hidden="true">print</span>
<span>Imprimindo comprovante…</span>
</p>
<p class="totem-success-code totem-caixa-card__code">${esc(code)}</p>
<div class="totem-caixa-card__meta">
<p class="totem-caixa-card__row"><span>Forma escolhida</span><span class="totem-caixa-card__value">${renderPaymentMethod(order.paymentMethod)}</span></p>
<p class="totem-caixa-card__row"><span>Total</span><strong class="totem-caixa-card__value">${formatPrice(order.total)}</strong></p>
</div>
<p class="lig-payment-hint totem-caixa-card__hint">
<span class="totem-caixa-pulse" aria-hidden="true"></span>
Aguardando confirmação no PDV…
</p>
<button type="button" class="totem-btn totem-btn--ghost totem-caixa-card__reprint" id="totem-reprint-receipt">
<span class="material-symbols-outlined" aria-hidden="true">print</span>
Imprimir comprovante novamente
</button>
</div>`;

        bindReprint();
        printReceipt(order).then((printed) => {
            const status = document.getElementById('totem-print-status');
            if (!status) return;
            const text = status.querySelector('span:last-child');
            if (!text) return;
            text.textContent = printed
                ? 'Comprovante impresso. Leve ao caixa.'
                : 'Retire o comprovante na impressora ou use o botão abaixo.';
        });
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
            if (!order.paymentChosen || !order.paymentMethod) {
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
