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

    const receipt = window.LigeirinhoTotemReceipt;
    const formatDisplayCode = (id) => receipt?.formatCode?.(id) ?? String(id || '').replace(/[^a-fA-F0-9]/gi, '').slice(0, 4).toUpperCase();
    const compactDisplayCode = (id) => receipt?.compactCode?.(id) ?? formatDisplayCode(id);

    let pollTimer = null;
    let screenTimeout = null;
    let countdownTimer = null;
    let currentOrder = null;
    let totemLabel = 'Ligeirinho Totem';
    let autoPrintEnabled = false;
    let autoPrintTriggered = false;
    const SCREEN_TIMEOUT_MS = 10000;

    const bindActions = () => {
        document.getElementById('totem-caixa-novo-pedido')?.addEventListener('click', goNovoPedido);
        document.getElementById('totem-caixa-reprint')?.addEventListener('click', async () => {
            if (!currentOrder) return;
            await receipt?.printOrderReceipt?.(currentOrder, {
                force: true,
                totemLabel,
                printMode: 'kiosk',
            });
            showPrintNote();
        });
    };

    const showPrintNote = () => {
        const note = document.getElementById('totem-caixa-print-note');
        if (note) note.hidden = false;
    };

    const triggerAutoPrint = async (order) => {
        if (!receipt?.printOrderReceipt || autoPrintTriggered || !autoPrintEnabled) return;
        autoPrintTriggered = true;
        const printed = await receipt.printOrderReceipt(order, { auto: true, totemLabel });
        if (printed) showPrintNote();
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
        window.LigeirinhoCart?.clearTotemSession?.();
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
<a href="totem.html" class="totem-btn totem-btn--primary totem-pay-back" data-totem-cancel>Voltar ao totem</a>
</div>`;
    };

    const renderWaiting = (order) => {
        currentOrder = order;
        const code = formatDisplayCode(order.id);
        const copyCode = compactDisplayCode(order.id);
        const printNoteHtml = autoPrintEnabled
            ? `<p class="totem-caixa-card__print-note" id="totem-caixa-print-note" hidden>
<span class="material-symbols-outlined" aria-hidden="true">print</span>
Comprovante enviado para a impressora padrão
</p>`
            : '';
        root.innerHTML = `<div class="lig-payment-card totem-pay-card totem-caixa-card">
<span class="material-symbols-outlined totem-pay-icon totem-caixa-card__icon" aria-hidden="true">storefront</span>
<h1 class="lig-payment-title">Dirija-se ao caixa</h1>
<p class="lig-payment-lead">Seu pedido entrou na fila do <strong>Ligeirinho Parceiros</strong>. Informe o código abaixo para o operador finalizar o pagamento.</p>
<button type="button" class="totem-success-code totem-caixa-card__code" data-totem-copy-code data-copy-text="${esc(copyCode)}" aria-label="Copiar código do pedido">${esc(code)}</button>
${printNoteHtml}
<div class="totem-caixa-card__meta">
<p class="totem-caixa-card__row"><span>Forma escolhida</span><span class="totem-caixa-card__value">${renderPaymentMethod(order.paymentMethod)}</span></p>
<p class="totem-caixa-card__row"><span>Total</span><strong class="totem-caixa-card__value">${formatPrice(order.total)}</strong></p>
</div>
<p class="lig-payment-hint totem-caixa-card__hint">
<span class="totem-caixa-pulse" aria-hidden="true"></span>
Aguardando confirmação no PDV…
</p>
<button type="button" class="totem-btn totem-btn--ghost totem-caixa-card__reprint" id="totem-caixa-reprint">
<span class="material-symbols-outlined" aria-hidden="true">print</span>
Imprimir comprovante
</button>
<p class="totem-caixa-card__timeout" id="totem-caixa-timeout-wrap" aria-live="polite">
Nova tela em <strong id="totem-caixa-countdown">${Math.round(SCREEN_TIMEOUT_MS / 1000)}</strong>s para o próximo cliente.
</p>
<button type="button" class="totem-btn totem-btn--primary totem-btn--xl totem-caixa-card__novo" id="totem-caixa-novo-pedido">
<span class="material-symbols-outlined" aria-hidden="true">add_shopping_cart</span>
<span>Novo pedido</span>
</button>
</div>`;

        bindActions();
        startScreenTimeout();
        void triggerAutoPrint(order);
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
                    window.LigeirinhoCart?.clearTotemSession?.();
                    window.location.replace(successUrl(id));
                }
            } catch {
                /* ignore */
            }
        }, 3000);
    };

    const init = async () => {
        if (routing && !routing.guardPageAccess()) return;

        window.LigeirinhoTotemLoading?.mountPreset?.(root, 'caixa');

        if (!orderId) {
            showError('Pedido não informado.');
            return;
        }

        try {
            const [res, receiptConfig] = await Promise.all([
                fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`),
                receipt?.loadReceiptConfig?.() ?? Promise.resolve(null),
            ]);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Pedido não encontrado');

            if (receiptConfig) {
                autoPrintEnabled = receiptConfig.autoPrint === true;
                totemLabel = receiptConfig.totemLabel || totemLabel;
            }

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
