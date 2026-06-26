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

    const formatCategoryLabel = (id, name) => {
        if (name) return String(name);
        const raw = String(id || '')
            .replace(/[-_]+/g, ' ')
            .trim();
        if (!raw || raw === 'outros') return 'Outros';
        return raw
            .toLowerCase()
            .split(/\s+/)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const inferCategoryFromName = (name) => {
        const n = String(name || '').toUpperCase();
        if (/\bCERVEJA\b|\bCHOPP\b|\bCHOP\b|\bLAGER\b|\bPILSEN\b/.test(n)) {
            return { id: 'cervejas', label: 'Cervejas' };
        }
        if (/\bGIN\b/.test(n)) return { id: 'gins', label: 'Gins' };
        if (/\bVODKA\b/.test(n)) return { id: 'vodkas', label: 'Vodkas' };
        if (/\bWHISKY\b|\bWHISKEY\b/.test(n)) return { id: 'whiskys', label: 'Whiskys' };
        if (/\bVINHO\b|\bWINE\b/.test(n)) return { id: 'vinhos', label: 'Vinhos' };
        if (/\bREFRIG\b|\bSUCO\b|\bAGUA\b|\bÁGUA\b/.test(n)) return { id: 'refrigerantes', label: 'Refrigerantes' };
        if (/\bDESTILAD/.test(n) || /\bRUM\b|\bTEQUILA\b|\bCACHACA\b|\bCACHAÇA\b/.test(n)) {
            return { id: 'destilados', label: 'Destilados' };
        }
        return { id: 'outros', label: 'Outros' };
    };

    const resolveItemCategory = (item) => {
        if (item.categoryId || item.categoryName) {
            const id = String(item.categoryId || item.categoryName).toLowerCase();
            return {
                id,
                label: formatCategoryLabel(item.categoryId, item.categoryName),
            };
        }
        return inferCategoryFromName(item.name);
    };

    const groupItemsByCategory = (items) => {
        const groups = new Map();
        (items || []).forEach((item) => {
            const { id, label } = resolveItemCategory(item);
            if (!groups.has(id)) {
                groups.set(id, { id, label, items: [] });
            }
            groups.get(id).items.push(item);
        });
        return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
    };

    const renderSummary = (order) => {
        const groups = groupItemsByCategory(order.items || []);
        const groupsHtml = groups
            .map((group) => {
                const lines = group.items
                    .map(
                        (item) =>
                            `<li><span class="totem-pay-summary__item-name">${item.qty}x ${esc(item.name)}</span><span class="totem-pay-summary__item-price">${formatPrice(item.price * item.qty)}</span></li>`
                    )
                    .join('');
                return `<section class="totem-pay-summary__group">
<h3 class="totem-pay-summary__cat">${esc(group.label)}</h3>
<ul class="lig-payment-summary__list totem-pay-summary__list">${lines}</ul>
</section>`;
            })
            .join('');
        return `<div class="lig-payment-summary totem-pay-summary">
<h2 class="lig-payment-summary__title">Resumo do pedido</h2>
<div class="totem-pay-summary__scroll" tabindex="0" aria-label="Itens do pedido">${groupsHtml}</div>
<p class="lig-payment-summary__total totem-pay-summary__total"><span>Total</span><strong>${formatPrice(order.total)}</strong></p>
</div>`;
    };

    const renderMethodPicker = (order) => {
        root.innerHTML = `<div class="lig-payment-card totem-pay-card totem-pay-card--picker">
<div class="totem-pay-card__head">
<h1 class="lig-payment-title">Formas de pagamento</h1>
<p class="lig-payment-lead">Selecione a forma de pagamento</p>
</div>
${renderSummary(order)}
<div class="totem-pay-card__footer">
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
<a href="totem.html" class="totem-btn totem-btn--ghost totem-pay-back" data-totem-back-cart>Cancelar</a>
</div>
</div>
</div>`;

        root.querySelectorAll('[data-method]').forEach((btn) => {
            btn.addEventListener('click', () => selectMethod(order.id, btn.dataset.method, btn));
        });
    };

    const selectMethod = async (id, method, btn) => {
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
            window.location.replace(caixaUrl(id));
        } catch (err) {
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
