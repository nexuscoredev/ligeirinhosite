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

    const splitsApi = window.LigeirinhoPaymentSplits;

    const methodLabelShort = (m) => {
        const key = String(m || '').toLowerCase();
        if (key === 'pix') return 'Pix';
        if (key === 'cartao') return 'Cartão';
        return 'Dinheiro';
    };

    const methodIconHtml = (m) => {
        const key = String(m || '').toLowerCase();
        if (key === 'pix') {
            return '<img src="img/icon-pix.svg" class="totem-caixa-pay-item__pix" width="52" height="20" alt="Pix">';
        }
        const icon = key === 'cartao' ? 'credit_card' : 'payments';
        return `<span class="material-symbols-outlined totem-caixa-pay-item__icon" aria-hidden="true">${icon}</span>`;
    };

    const paymentLinesFromOrder = (order) => {
        const splits = splitsApi?.resolveOrderSplits?.(order) || [];
        if (splits.length >= 1) return splits;

        const raw = String(order?.paymentMethod || '').toLowerCase();
        const methods = raw
            .split('+')
            .map((part) => part.trim())
            .filter(Boolean);
        const total = Number(order.total) || 0;

        if (methods.length >= 2) {
            return methods.map((method) => ({ method, amount: null }));
        }
        if (raw) return [{ method: raw, amount: total }];
        return [];
    };

    const renderPaymentLine = (line) => {
        const label = methodLabelShort(line.method);
        const amountHtml =
            line.amount != null && Number.isFinite(Number(line.amount))
                ? `<span class="totem-caixa-pay-item__amount">${formatPrice(line.amount)}</span>`
                : `<span class="totem-caixa-pay-item__amount totem-caixa-pay-item__amount--pending">—</span>`;
        return `<li class="totem-caixa-pay-item">
<span class="totem-caixa-pay-item__method">${methodIconHtml(line.method)}<span class="totem-caixa-pay-item__label">${esc(label)}</span></span>
${amountHtml}
</li>`;
    };

    const renderPaymentBlock = (order) => {
        const lines = paymentLinesFromOrder(order);
        const isSplit = lines.length >= 2;
        const isCashTender =
            lines.length === 1 && String(lines[0]?.method || '').toLowerCase() === 'dinheiro';
        const title = isSplit ? 'Formas de pagamento' : 'Forma de pagamento';
        const listHtml = lines.length
            ? `<ul class="totem-caixa-pay-list" aria-label="${esc(title)}">${lines.map(renderPaymentLine).join('')}</ul>`
            : `<p class="totem-caixa-card__empty-pay">Forma não informada</p>`;
        const troco =
            (isSplit || isCashTender) && splitsApi?.computeCashChange
                ? splitsApi.computeCashChange(lines, order.total)
                : 0;
        const trocoHtml =
            troco > 0.009
                ? `<div class="totem-caixa-pay-total totem-caixa-pay-total--troco">
<span>Troco</span>
<strong>${formatPrice(troco)}</strong>
</div>`
                : '';

        return `<section class="totem-caixa-card__section totem-caixa-card__section--payment">
<h2 class="totem-caixa-card__section-title">${esc(title)}</h2>
${listHtml}
<div class="totem-caixa-pay-total">
<span>Total do pedido</span>
<strong>${formatPrice(order.total)}</strong>
</div>
${trocoHtml}
</section>`;
    };

    const renderCustomerSection = (order) => {
        const rows = [];
        const name = String(order.customerName || '').trim();
        const phone = String(order.customerPhone || '').trim();
        if (!name && !phone) return '';

        if (name) {
            rows.push(
                `<p class="totem-caixa-card__row"><span>Nome</span><strong class="totem-caixa-card__value">${esc(name)}</strong></p>`
            );
        }
        if (phone) {
            rows.push(
                `<p class="totem-caixa-card__row"><span>Telefone</span><span class="totem-caixa-card__value">${esc(phone)}</span></p>`
            );
        }

        return `<section class="totem-caixa-card__section totem-caixa-card__section--customer">
<h2 class="totem-caixa-card__section-title">Cliente</h2>
${rows.join('')}
</section>`;
    };

    const receipt = window.LigeirinhoTotemReceipt;
    const formatDisplayCode = (id) => receipt?.formatCode?.(id) ?? String(id || '').replace(/[^a-fA-F0-9]/gi, '').slice(0, 4).toUpperCase();
    const compactDisplayCode = (id) => receipt?.compactCode?.(id) ?? formatDisplayCode(id);

    let pollTimer = null;
    let screenTimeout = null;
    let unbindActivity = null;
    let currentOrder = null;
    let totemLabel = 'Ligeirinho Totem';
    let autoPrintEnabled = false;
    let autoPrintTriggered = false;
    let printMode = 'kiosk';
    let IDLE_BEFORE_MS = 15000;
    let COUNTDOWN_MS = 10000;

    const bindActions = () => {
        document.getElementById('totem-caixa-novo-pedido')?.addEventListener('click', goNovoPedido);
        document.getElementById('totem-caixa-reprint')?.addEventListener('click', async () => {
            bumpScreenIdle();
            if (!currentOrder) return;
            let orderToPrint = currentOrder;
            try {
                orderToPrint = await fetchFreshOrder(currentOrder.id);
                currentOrder = orderToPrint;
            } catch {
                /* usa pedido em cache */
            }
            await receipt?.printOrderReceipt?.(orderToPrint, {
                force: true,
                totemLabel,
                printMode: 'kiosk',
            });
            showPrintNote();
            bumpScreenIdle();
        });

        const activity = window.LigeirinhoTotemActivity;
        unbindActivity?.();
        unbindActivity = activity?.bind?.(bumpScreenIdle, document);
    };

    const showPrintNote = () => {
        const note = document.getElementById('totem-caixa-print-note');
        if (note) note.hidden = false;
    };

    const fetchFreshOrder = async (id) => {
        const res = await fetch(`/api/orders/get?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Pedido não encontrado');
        return data.order;
    };

    const triggerAutoPrint = async (order) => {
        if (!receipt?.printOrderReceipt || autoPrintTriggered || !autoPrintEnabled) return;
        autoPrintTriggered = true;
        let orderToPrint = order;
        try {
            orderToPrint = await fetchFreshOrder(order.id);
            currentOrder = orderToPrint;
        } catch {
            /* usa pedido em cache */
        }
        const printed = await receipt.printOrderReceipt(orderToPrint, {
            auto: true,
            totemLabel,
            printMode,
        });
        if (printed) showPrintNote();
    };

    const clearTimers = () => {
        if (pollTimer) clearInterval(pollTimer);
        screenTimeout?.cancel();
        pollTimer = null;
        screenTimeout = null;
    };

    const goNovoPedido = () => {
        clearTimers();
        unbindActivity?.();
        window.LigeirinhoCart?.clearTotemSession?.();
        window.location.replace('totem.html');
    };

    const hideCountdown = () => {
        const wrap = document.getElementById('totem-caixa-timeout-wrap');
        if (wrap) wrap.hidden = true;
    };

    const showCountdown = () => {
        const wrap = document.getElementById('totem-caixa-timeout-wrap');
        if (wrap) wrap.hidden = false;
    };

    const updateCountdownTick = (remaining) => {
        const el = document.getElementById('totem-caixa-countdown');
        if (el) el.textContent = String(Math.max(0, remaining));
    };

    const bumpScreenIdle = () => {
        screenTimeout?.bump();
    };

    const startScreenTimeout = () => {
        const activity = window.LigeirinhoTotemActivity;
        screenTimeout?.cancel();
        screenTimeout = activity?.createCountdownTimeout?.({
            idleBeforeCountdownMs: IDLE_BEFORE_MS,
            countdownMs: COUNTDOWN_MS,
            onReset: hideCountdown,
            onCountdownStart: showCountdown,
            onTick: updateCountdownTick,
            onComplete: goNovoPedido,
        });
        screenTimeout?.arm();
        hideCountdown();
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
${renderCustomerSection(order)}
${renderPaymentBlock(order)}
</div>
<p class="lig-payment-hint totem-caixa-card__hint">
<span class="totem-caixa-pulse" aria-hidden="true"></span>
Aguardando confirmação no PDV…
</p>
<button type="button" class="totem-btn totem-btn--ghost totem-caixa-card__reprint" id="totem-caixa-reprint">
<span class="material-symbols-outlined" aria-hidden="true">print</span>
Imprimir comprovante
</button>
<p class="totem-caixa-card__timeout" id="totem-caixa-timeout-wrap" hidden aria-live="polite">
Nova tela em <strong id="totem-caixa-countdown">${Math.round(COUNTDOWN_MS / 1000)}</strong>s para o próximo cliente.
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
            const [res, receiptConfig, totemCfg] = await Promise.all([
                fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`),
                receipt?.loadReceiptConfig?.() ?? Promise.resolve(null),
                fetch('data/totem-units.json').then((r) => r.json()).catch(() => null),
            ]);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Pedido não encontrado');

            const cfg = totemCfg?.defaults || {};
            IDLE_BEFORE_MS = Number(cfg.idleBeforeCountdownMs) || 15000;
            COUNTDOWN_MS = Number(cfg.countdownMs) || 10000;

            if (receiptConfig) {
                autoPrintEnabled = receiptConfig.autoPrint === true;
                totemLabel = receiptConfig.totemLabel || totemLabel;
                printMode = receiptConfig.printMode || printMode;
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
