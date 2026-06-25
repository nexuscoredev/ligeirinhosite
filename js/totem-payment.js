(function () {
    const root = document.getElementById('payment-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const caixaUrl = (id) => `totem-caixa.html?order=${encodeURIComponent(id)}`;

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const loading = window.LigeirinhoTotemLoading;

    const showError = (msg) => {
        root.innerHTML = `<div class="lig-payment-card lig-payment-card--error totem-pay-card">
<h1 class="lig-payment-title">Não foi possível continuar</h1>
<p class="lig-payment-lead">${esc(msg)}</p>
<a href="totem.html" class="totem-btn totem-btn--primary totem-pay-back" data-totem-cancel>Voltar ao totem</a>
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
</div>`;
    };

    const renderMethodPicker = (order) => {
        root.innerHTML = `<div class="lig-payment-card totem-pay-card">
<h1 class="lig-payment-title">Formas de pagamento</h1>
<p class="lig-payment-lead">Selecione a forma de pagamento</p>
${renderSummary(order)}
<h2 class="totem-pay-methods__title">Escolha uma forma</h2>
<div class="totem-pay-methods" role="group" aria-label="Formas de pagamento">
<button type="button" class="totem-pay-method" data-method="pix" aria-label="Pix">
<img src="img/icon-pix.svg" class="totem-pay-mark totem-pay-mark--pix totem-pay-method__brand" width="72" height="26" alt="">
<span class="totem-pay-method__label">Pix</span>
</button>
<button type="button" class="totem-pay-method" data-method="cartao" aria-label="Cartão">
<span class="material-symbols-outlined" aria-hidden="true">credit_card</span>
<span class="totem-pay-method__label">Cartão</span>
</button>
<button type="button" class="totem-pay-method" data-method="dinheiro" aria-label="Dinheiro">
<span class="material-symbols-outlined" aria-hidden="true">payments</span>
<span class="totem-pay-method__label">Dinheiro</span>
</button>
</div>
<div class="totem-pay-actions">
<a href="totem.html" class="totem-btn totem-btn--ghost totem-pay-back" data-totem-cancel>Cancelar</a>
</div>
</div>`;

        root.querySelectorAll('[data-method]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const printWin = openPrintWindow();
                selectMethod(order.id, btn.dataset.method, btn, printWin);
            });
        });
    };

    let cachedOrder = null;

    const openPrintWindow = () => {
        try {
            return window.open(
                'about:blank',
                'lig_totem_print',
                'width=1,height=1,left=-9999,top=-9999,toolbar=no,menubar=no,scrollbars=no'
            );
        } catch {
            return null;
        }
    };

    const selectMethod = async (id, method, btn, printWin) => {
        if (btn) {
            btn.disabled = true;
        }
        loading?.mountPreset?.(root, 'paymentConfirm');
        try {
            const res = await fetch('/api/orders/select-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: id, method }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Não foi possível registrar o pagamento');

            const orderForPrint = {
                ...(cachedOrder || {}),
                id,
                paymentMethod: method,
                paymentChosen: true,
                ...(data.order || {}),
            };
            void window.LigeirinhoTotemReceipt?.printOrderReceipt?.(orderForPrint, {
                auto: true,
                delayMs: 0,
                printWindow: printWin || undefined,
            });

            window.location.replace(caixaUrl(id));
        } catch (err) {
            try {
                printWin?.close();
            } catch {
                /* ignore */
            }
            showError(err.message || 'Erro ao continuar');
        }
    };

    const init = async () => {
        loading?.mountPreset?.(root, 'payment');

        if (!orderId) {
            showError('Pedido não informado.');
            return;
        }

        try {
            const orderRes = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`);
            const orderData = await orderRes.json();

            if (!orderRes.ok) {
                showError(orderData.error || 'Pedido não encontrado');
                return;
            }

            const order = orderData.order;
            cachedOrder = order;
            void window.LigeirinhoTotemReceipt?.prewarmPrint?.();

            if (order.status === 'paid') {
                window.location.replace(`totem-sucesso.html?order=${encodeURIComponent(order.id)}`);
                return;
            }

            if (order.paymentChosen && order.paymentMethod) {
                window.location.replace(caixaUrl(order.id));
                return;
            }

            renderMethodPicker(order);
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
