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
        `PED ${String(id || '')
            .slice(0, 8)
            .toUpperCase()
            .split('')
            .join(' ')}`;

    let pollTimer = null;
    let screenTimeout = null;
    let countdownTimer = null;
    const SCREEN_TIMEOUT_MS = 30000;

    const bindActions = () => {
        document.getElementById('totem-caixa-novo-pedido')?.addEventListener('click', goNovoPedido);
    };

    const clearTimers = () => {
        if (pollTimer) clearInterval(pollTimer);
        if (screenTimeout) clearTimeout(screenTimeout);
        if (countdownTimer) clearInterval(countdownTimer);
        pollTimer = null;
        screenTimeout = null;
        countdownTimer = null;
    };

    const goNovoPedido = () => {
        clearTimers();
        window.LigeirinhoCart?.saveCart?.({});
        window.location.replace('totem.html');
    };

    const startScreenTimeout = () => {
        let remaining = Math.round(SCREEN_TIMEOUT_MS / 1000);
        const countdownEl = document.getElementById('totem-caixa-countdown');

        const tick = () => {
            if (countdownEl) countdownEl.textContent = String(remaining);
            if (remaining <= 0 && countdownTimer) {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
            remaining -= 1;
        };

        tick();
        countdownTimer = window.setInterval(tick, 1000);
        screenTimeout = window.setTimeout(goNovoPedido, SCREEN_TIMEOUT_MS);
    };

    const showError = (msg) => {
        root.innerHTML = `<div class="lig-payment-card lig-payment-card--error totem-pay-card">
<h1 class="lig-payment-title">Não foi possível continuar</h1>
<p class="lig-payment-lead">${esc(msg)}</p>
<a href="totem.html" class="totem-btn totem-btn--primary totem-pay-back">Voltar ao totem</a>
</div>`;
    };

    const renderWaiting = (order) => {
        const code = formatDisplayCode(order.id);
        root.innerHTML = `<div class="lig-payment-card totem-pay-card totem-caixa-card">
<span class="material-symbols-outlined totem-pay-icon totem-caixa-card__icon" aria-hidden="true">storefront</span>
<h1 class="lig-payment-title">Dirija-se ao caixa</h1>
<p class="lig-payment-lead">Seu pedido entrou na fila do <strong>Ligeirinho Parceiros</strong>. Informe o código abaixo para o operador finalizar o pagamento.</p>
<p class="totem-success-code totem-caixa-card__code">${esc(code)}</p>
<div class="totem-caixa-card__meta">
<p class="totem-caixa-card__row"><span>Forma escolhida</span><span class="totem-caixa-card__value">${renderPaymentMethod(order.paymentMethod)}</span></p>
<p class="totem-caixa-card__row"><span>Total</span><strong class="totem-caixa-card__value">${formatPrice(order.total)}</strong></p>
</div>
<p class="lig-payment-hint totem-caixa-card__hint">
<span class="totem-caixa-pulse" aria-hidden="true"></span>
Aguardando confirmação no PDV…
</p>
<p class="totem-caixa-card__timeout" id="totem-caixa-timeout-wrap" aria-live="polite">
Nova tela em <strong id="totem-caixa-countdown">30</strong>s para o próximo cliente.
</p>
<button type="button" class="totem-btn totem-btn--primary totem-btn--xl totem-caixa-card__novo" id="totem-caixa-novo-pedido">
<span class="material-symbols-outlined" aria-hidden="true">add_shopping_cart</span>
<span>Novo pedido</span>
</button>
</div>`;

        bindActions();
        startScreenTimeout();
    };

    const startPolling = (id) => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = window.setInterval(async () => {
            try {
                const res = await fetch(`/api/orders/get?id=${encodeURIComponent(id)}`);
                if (!res.ok) return;
                const { order } = await res.json();
                if (order.status === 'paid') {
                    clearTimers();
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
