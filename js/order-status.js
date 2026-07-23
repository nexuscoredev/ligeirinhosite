(function () {
    const root = document.getElementById('order-status-root');
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    let pollTimer = null;
    let summaryExpanded = false;
    const auth = window.LigeirinhoAuth;

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const session = () => auth?.loadSession?.() || null;

    const accountHeaders = async () => {
        const headers = { 'Content-Type': 'application/json' };
        const hubToken = await auth?.getHubAccessToken?.();
        if (hubToken) {
            headers.Authorization = `Bearer ${hubToken}`;
            return headers;
        }

        let accountToken = auth?.getAccountSessionToken?.();
        if (!accountToken) {
            accountToken = await auth?.ensureAccountSession?.();
        }
        if (accountToken) {
            headers['X-Account-Session'] = accountToken;
            return headers;
        }

        const googleCred = auth?.getGoogleCredential?.();
        if (googleCred) {
            headers['X-Google-Credential'] = googleCred;
            const s = session();
            if (s?.hubUserId) headers['X-Hub-User-Id'] = s.hubUserId;
            return headers;
        }

        const s = session();
        if (s?.provider === 'google' && s?.email) {
            headers['X-Auth-Provider'] = 'google';
            headers['X-Account-Email'] = s.email;
            if (s.hubUserId) headers['X-Hub-User-Id'] = s.hubUserId;
            return headers;
        }

        throw new Error('Entre na conta para cancelar o pedido.');
    };
    const formatDate = (value) => {
        if (!value) return '';
        return new Date(String(value).includes('T') ? value : `${value}T12:00:00`).toLocaleDateString(
            'pt-BR',
            { weekday: 'short', day: '2-digit', month: 'short' },
        );
    };

    const paymentLabelSingle = (id) => {
        const methods = window.LigeirinhoPaymentMethods;
        if (methods?.label?.(id)) return methods.label(id);
        const key = String(id || '').toLowerCase();
        if (key === 'pix') return 'PIX';
        if (key === 'mercado_pago') return 'Mercado Pago';
        if (key === 'dinheiro') return 'Dinheiro';
        return id || '—';
    };

    const paymentLabel = (orderOrId) => {
        if (orderOrId && typeof orderOrId === 'object') {
            const splitsApi = window.LigeirinhoPaymentSplits;
            const splits = splitsApi?.resolveOrderSplits?.(orderOrId) || [];
            if (splits.length >= 2) {
                return splitsApi.formatSplitSummary(splits, paymentLabelSingle, formatPrice);
            }
            return paymentLabelSingle(orderOrId.paymentMethod);
        }
        return paymentLabelSingle(orderOrId);
    };

    const itemDetailLine = (item) => {
        const pack = item.packType === 'caixa' ? 'Caixa' : 'Unidade';
        const boxMatch = String(item.name || '').match(/\(Caixa c\/\s*(\d+)\)/i);
        if (boxMatch) return `1 ${pack} · Caixa contém ${boxMatch[1]} unidades`;
        const unitPrice = formatPrice(item.price || 0);
        return `1 ${pack} · ${unitPrice}`;
    };

    const itemDisplayName = (item) => {
        const name = String(item.name || '');
        return name.replace(/\s*\(Caixa c\/\s*\d+\)/i, '').trim() || name;
    };

    const timelineHtml = (tracking) => {
        const active = Number(tracking?.step) || 0;
        const steps = tracking?.steps || [];
        const segments = steps.length - 1;
        const progress = segments > 0 ? Math.min(100, (active / segments) * 100) : 0;
        return `<div class="order-track__timeline" aria-label="Progresso do pedido">
<div class="order-track__timeline-bar" style="--order-track-progress:${progress}%"></div>
<ol class="order-track__steps">
${steps
    .map((step, index) => {
        const state = index < active ? 'done' : index === active ? 'active' : 'pending';
        return `<li class="order-track__step order-track__step--${state}">
<span class="material-symbols-outlined order-track__step-icon" aria-hidden="true">${esc(step.icon)}</span>
<span class="order-track__step-label">${esc(step.label)}</span>
</li>`;
    })
    .join('')}
</ol>
</div>`;
    };

    const notifyBannerHtml = () => {
        if (!('Notification' in window) || Notification.permission !== 'default') return '';
        return `<div class="order-track__notify" id="order-track-notify">
<p>Ative as notificações para receber atualizações do pedido.</p>
<button type="button" class="order-track__notify-btn" id="order-track-notify-btn">Habilitar</button>
<button type="button" class="order-track__notify-close" id="order-track-notify-close" aria-label="Fechar">×</button>
</div>`;
    };

    const receiptItemsHtml = (order) =>
        (order.items || [])
            .map(
                (item) => `<li class="order-track__receipt-item">
<p class="order-track__receipt-item-title">${item.qty} × ${esc(itemDisplayName(item))}</p>
<p class="order-track__receipt-item-meta">${esc(itemDetailLine(item))}</p>
</li>`,
            )
            .join('');

    const render = (order, tracking) => {
        const shortId = String(order.id || '').slice(0, 8).toUpperCase();
        const eta = order.deliveryDate ? formatDate(order.deliveryDate) : '';
        const headerTitle = tracking?.headerTitle || tracking?.stepLabel || 'Acompanhar pedido';
        const deliveryHeading =
            order.deliveryType === 'retirada'
                ? 'Retirada: Loja'
                : order.customerName
                  ? `Entrega: ${order.customerName}`
                  : 'Entrega';

        root.innerHTML = `<div class="order-track">
<header class="order-track__top">
<button type="button" class="order-track__back" id="order-track-back" aria-label="Voltar">
<span class="material-symbols-outlined">arrow_back</span>
</button>
<h1 class="order-track__top-title">${esc(headerTitle)}</h1>
<a href="conta.html#ajuda" class="order-track__help">
<span class="material-symbols-outlined" aria-hidden="true">headset_mic</span>
<span>Ajuda</span>
</a>
</header>

<div class="order-track__card order-track__card--compact">
${
    eta
        ? `<div class="order-track__eta">
<span class="material-symbols-outlined" aria-hidden="true">schedule</span>
<div>
<p class="order-track__eta-label">Entrega prevista</p>
<p class="order-track__eta-value">${esc(eta)}</p>
</div>
</div>`
        : ''
}
${timelineHtml(tracking)}
<p class="order-track__message">${esc(tracking?.message || 'Acompanhe o status do seu pedido.')}</p>
<p class="order-track__code">Pedido #${esc(shortId)}${tracking?.hubNumero ? ` · Nº Hub ${esc(String(tracking.hubNumero))}` : ''}</p>
</div>

${notifyBannerHtml()}

<section class="order-track__section order-track__section--flat">
<div class="order-track__section-head">
<span class="material-symbols-outlined order-track__section-icon" aria-hidden="true">home</span>
<div>
<p class="order-track__section-label">${esc(deliveryHeading)}</p>
<p class="order-track__section-value">${esc(order.deliveryType === 'retirada' ? 'Retirada no ponto Ligeirinho' : order.address || '—')}</p>
</div>
</div>
</section>

<a href="inicio.html" class="order-track__merchant">
<span class="order-track__merchant-logo" aria-hidden="true">LG</span>
<span class="order-track__merchant-name">Ligeirinho Distribuição</span>
<span class="material-symbols-outlined order-track__merchant-chev" aria-hidden="true">chevron_right</span>
</a>

<article class="order-track__receipt" id="order-track-receipt">
<div class="order-track__receipt-edge order-track__receipt-edge--top" aria-hidden="true"></div>
<div class="order-track__receipt-body">
<div class="order-track__receipt-total">
<span>Total</span>
<strong>${formatPrice(order.total)}</strong>
</div>
<ul class="order-track__receipt-items${summaryExpanded ? '' : ' order-track__receipt-items--collapsed'}">${receiptItemsHtml(order)}</ul>
${
    (order.items || []).length > 2
        ? `<button type="button" class="order-track__receipt-more" id="order-track-summary-toggle" aria-expanded="${summaryExpanded ? 'true' : 'false'}">
Resumo do pedido <span class="material-symbols-outlined" aria-hidden="true">chevron_right</span>
</button>`
        : ''
}
</div>
<div class="order-track__receipt-edge order-track__receipt-edge--bottom" aria-hidden="true"></div>
</article>

<section class="order-track__meta-strip">
<div class="order-track__meta-row">
<span class="order-track__meta-label">Pagamento</span>
<span class="order-track__meta-value">${esc(paymentLabel(order))}</span>
</div>
</section>

<div class="order-track__support">
<a href="conta.html#ajuda" class="order-track__support-link">
<span class="material-symbols-outlined order-track__support-icon" aria-hidden="true">verified_user</span>
<div class="order-track__support-copy">
<strong>Entrega combinada</strong>
<span>Data prevista conforme seleção no pedido</span>
</div>
<span class="material-symbols-outlined order-track__support-chev" aria-hidden="true">chevron_right</span>
</a>
<a href="contato.html" class="order-track__support-link">
<span class="material-symbols-outlined order-track__support-icon" aria-hidden="true">headset_mic</span>
<div class="order-track__support-copy">
<strong>Suporte</strong>
<span>Fale com a equipe Ligeirinho</span>
</div>
<span class="material-symbols-outlined order-track__support-chev" aria-hidden="true">chevron_right</span>
</a>
</div>

<div class="order-track__actions">
${
    tracking?.canCancel
        ? `<button type="button" class="lig-btn-secondary w-full text-center order-track__cancel-btn" id="order-track-cancel">Cancelar solicitação</button>`
        : ''
}
<a href="meus-pedidos.html" class="lig-btn-primary w-full text-center">Ir para pedidos</a>
<a href="pedidos.html" class="lig-btn-secondary w-full text-center mt-3">Fazer novo pedido</a>
</div>
</div>`;

        root.querySelector('#order-track-back')?.addEventListener('click', () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = 'meus-pedidos.html';
        });

        root.querySelector('#order-track-summary-toggle')?.addEventListener('click', () => {
            summaryExpanded = !summaryExpanded;
            const list = root.querySelector('.order-track__receipt-items');
            const btn = root.querySelector('#order-track-summary-toggle');
            list?.classList.toggle('order-track__receipt-items--collapsed', !summaryExpanded);
            if (btn) btn.setAttribute('aria-expanded', summaryExpanded ? 'true' : 'false');
            if (summaryExpanded) {
                root.querySelector('#order-track-receipt')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        root.querySelector('#order-track-notify-btn')?.addEventListener('click', async () => {
            try {
                await Notification.requestPermission();
            } catch {
                /* ignore */
            }
            root.querySelector('#order-track-notify')?.remove();
        });
        root.querySelector('#order-track-notify-close')?.addEventListener('click', () => {
            root.querySelector('#order-track-notify')?.remove();
        });

        root.querySelector('#order-track-cancel')?.addEventListener('click', async (event) => {
            const button = event.currentTarget;
            const shortId = String(order.id || '').slice(0, 8).toUpperCase();
            const ok = window.confirm(
                `Cancelar a solicitação do pedido ${shortId}?\n\nSó é possível enquanto o pedido ainda aguarda confirmação da loja.`,
            );
            if (!ok) return;
            const prev = button.textContent;
            button.disabled = true;
            button.textContent = 'Cancelando…';
            try {
                const headers = await accountHeaders();
                const s = session();
                if (s?.sub) headers['X-Auth-Sub'] = s.sub;
                if (s?.email) headers['X-Account-Email'] = s.email;
                const res = await fetch('/api/orders/cancel', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ orderId: order.id }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Não foi possível cancelar o pedido.');
                if (pollTimer) {
                    window.clearInterval(pollTimer);
                    pollTimer = null;
                }
                render(data.order || { ...order, status: 'cancelled' }, data.tracking);
            } catch (err) {
                window.alert(err?.message || 'Não foi possível cancelar o pedido.');
                button.disabled = false;
                button.textContent = prev;
            }
        });
    };

    const loadOrder = async () => {
        const res = await fetch(`/api/orders/get?id=${encodeURIComponent(orderId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
    };

    const init = async () => {
        root.classList.add('order-track-page');
        if (!orderId) {
            root.innerHTML = '<p class="lig-payment-lead">Pedido não encontrado.</p>';
            return;
        }
        try {
            const data = await loadOrder();
            render(data.order, data.tracking);
            if (data.order.status === 'paid') {
                window.LigeirinhoClientNotifications?.push?.({
                    id: `order-${data.order.id}-paid`,
                    title: 'Pagamento confirmado',
                    body: `Pedido ${String(data.order.id).slice(0, 8)} recebido.`,
                    href: `pedido-confirmado.html?order=${encodeURIComponent(data.order.id)}`,
                    source: 'order',
                });
            }
            const done = (data.tracking?.step || 0) >= 4 || data.tracking?.cancelled;
            if (!done && !pollTimer) {
                pollTimer = window.setInterval(async () => {
                    try {
                        const fresh = await loadOrder();
                        render(fresh.order, fresh.tracking);
                        if ((fresh.tracking?.step || 0) >= 4 || fresh.tracking?.cancelled) {
                            window.clearInterval(pollTimer);
                            pollTimer = null;
                        }
                    } catch {
                        /* keep last render */
                    }
                }, 30000);
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
