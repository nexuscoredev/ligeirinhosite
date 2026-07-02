(function () {
    const root = document.getElementById('meus-pedidos-app');
    if (!root) return;

    const cart = window.LigeirinhoCart;
    const auth = window.LigeirinhoAuth;
    const LOGIN = (next) => `/?next=${encodeURIComponent(next || 'meus-pedidos.html')}`;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const session = () => auth?.loadSession?.() || null;

    const openCaminhao = () => {
        if (window.matchMedia('(min-width: 1024px)').matches) {
            window.LigeirinhoCartUI?.open?.();
        } else {
            window.location.href = 'caminhao.html';
        }
    };

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

        throw new Error('Sessão expirada. Saia e entre novamente.');
    };

    const formatDateTime = (value) => {
        if (!value) return '—';
        const d = new Date(String(value).includes('T') ? value : `${value}T12:00:00`);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDateOnly = (value) => {
        if (!value) return '—';
        return new Date(String(value).includes('T') ? value : `${value}T12:00:00`).toLocaleDateString(
            'pt-BR',
        );
    };

    const paymentMethodLabel = (order) => {
        const splitsApi = window.LigeirinhoPaymentSplits;
        const splits = splitsApi?.resolveOrderSplits?.(order) || [];
        if (splits.length >= 2) {
            return splitsApi.formatSplitSummary(splits, paymentMethodLabelSingle, formatPrice);
        }
        return paymentMethodLabelSingle(order.paymentMethod);
    };

    const paymentMethodLabelSingle = (id) => {
        const methods = window.LigeirinhoPaymentMethods;
        if (methods?.label?.(id)) return methods.label(id);
        const key = String(id || '').toLowerCase();
        if (key === 'pix') return 'PIX';
        if (key === 'mercado_pago') return 'Mercado Pago';
        if (key === 'dinheiro') return 'Dinheiro';
        if (key === 'boleto' || key === 'prazo') return 'A prazo';
        return id || '—';
    };

    const orderStatusMeta = (order) => {
        if (!order) return { label: '—', tone: 'muted' };
        if (order.status === 'paid') return { label: 'Confirmado', tone: 'ok' };
        if (order.status === 'cancelled') return { label: 'Cancelado', tone: 'muted' };
        if (order.status === 'pending_payment') return { label: 'Aguardando pagamento', tone: 'wait' };
        if ((order.channel || 'parceiros') === 'parceiros' && order.status === 'pending') {
            return { label: 'Aguardando confirmação', tone: 'wait' };
        }
        return { label: 'Em andamento', tone: 'wait' };
    };

    const orderItemsHtml = (items = []) =>
        items
            .map((item) => {
                const qty = Number(item.qty) || 1;
                const lineTotal = formatPrice((Number(item.price) || 0) * qty);
                return `<li class="conta-order-detail__item">
<span class="conta-order-detail__item-name">${qty}x ${esc(item.name)}</span>
<span class="conta-order-detail__item-price">${lineTotal}</span>
</li>`;
            })
            .join('');

    const orderFact = (label, value) =>
        value && value !== '—'
            ? `<div class="conta-order-detail__fact">
<dt>${esc(label)}</dt>
<dd>${esc(value)}</dd>
</div>`
            : '';

    const orderCardHtml = (order, { showReorder = false } = {}) => {
        const status = orderStatusMeta(order);
        const shortId = String(order.id || '').slice(0, 8).toUpperCase();
        const deliveryLabel =
            order.deliveryType === 'retirada'
                ? 'Retirada na loja'
                : order.deliveryDate
                  ? `Entrega · ${formatDateOnly(order.deliveryDate)}`
                  : 'Entrega';
        const createdAt = order.createdAt || order.savedAt || null;

        return `<article class="conta-order-detail" data-order-id="${esc(order.id || '')}">
<header class="conta-order-detail__head">
<div class="conta-order-detail__head-main">
<p class="conta-order-detail__code">Pedido <code>${esc(shortId)}</code></p>
<p class="conta-order-detail__date">${esc(formatDateTime(createdAt))}</p>
</div>
<span class="conta-order-detail__badge conta-order-detail__badge--${status.tone}">${esc(status.label)}</span>
</header>
<dl class="conta-order-detail__facts">
${orderFact('Modalidade', deliveryLabel)}
${orderFact('Endereço', order.deliveryType === 'entrega' ? order.address : '')}
${orderFact('Pagamento', paymentMethodLabel(order))}
${orderFact('Cliente', order.customerName)}
</dl>
<ul class="conta-order-detail__items" aria-label="Itens do pedido">${orderItemsHtml(order.items || [])}</ul>
<footer class="conta-order-detail__foot">
<span class="conta-order-detail__total-label">Total do pedido</span>
<strong class="conta-order-detail__total">${formatPrice(order.total)}</strong>
</footer>
<div class="conta-order-detail__actions">
${
    showReorder
        ? `<button type="button" class="conta-btn conta-btn--primary" id="meus-pedidos-reorder-btn">Repetir pedido</button>`
        : ''
}
${
    order.id
        ? `<a href="pedido-confirmado.html?order=${encodeURIComponent(order.id)}" class="conta-btn conta-btn--outline">Ver confirmação</a>`
        : ''
}
<button type="button" class="conta-btn conta-btn--outline" data-meus-pedidos-open-cart>Ir ao caminhão</button>
</div>
</article>`;
    };

    const orderCardFromLocal = (last) => {
        const checkout = last.checkout || {};
        const total = last.items.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);
        const order = {
            id: last.orderId || '',
            status: 'pending',
            channel: 'parceiros',
            total,
            items: last.items,
            deliveryType: checkout.deliveryType,
            deliveryDate: checkout.deliveryDate,
            address: checkout.address,
            paymentMethod: checkout.paymentMethod || checkout.payment,
            createdAt: last.savedAt ? new Date(last.savedAt).toISOString() : null,
            savedAt: last.savedAt,
        };
        return orderCardHtml(order, { showReorder: true });
    };

    const bindActions = () => {
        root.querySelector('#meus-pedidos-reorder-btn')?.addEventListener('click', () => {
            if (cart?.restoreLastOrder?.()) {
                window.LigeirinhoCartUI?.render?.();
                openCaminhao();
            }
        });
        root.querySelectorAll('[data-meus-pedidos-open-cart]').forEach((btn) => {
            btn.addEventListener('click', openCaminhao);
        });
    };

    const renderShell = (bodyHtml) => {
        root.innerHTML = `<div class="meus-pedidos-shell">
<header class="meus-pedidos-header">
<h1 class="meus-pedidos-header__title">Pedidos</h1>
<p class="meus-pedidos-header__lead">Acompanhe status e histórico dos seus pedidos.</p>
</header>
<div class="meus-pedidos-body" id="meus-pedidos-root">${bodyHtml}</div>
</div>`;
    };

    const loadOrders = async () => {
        const s = session();
        if (!s?.sub && !s?.email && !auth?.getAccountSessionToken?.()) {
            renderShell(`<div class="conta-empty">
<span class="material-symbols-outlined conta-empty__icon">person</span>
<p class="conta-empty__title">Entre para ver seus pedidos</p>
<p class="conta-empty__sub">Faça login para acompanhar status e histórico.</p>
<a href="${LOGIN('meus-pedidos.html')}" class="conta-btn conta-btn--primary">Entrar</a>
</div>`);
            return;
        }

        renderShell('<p class="conta-hint">Carregando pedidos…</p>');
        const mount = root.querySelector('#meus-pedidos-root');
        if (!mount) return;

        const lastLocal = cart?.loadLastOrder?.();
        let orders = [];
        let apiLoaded = false;

        try {
            const headers = await accountHeaders();
            if (s?.sub) headers['X-Auth-Sub'] = s.sub;
            if (s?.email) headers['X-Account-Email'] = s.email;
            const res = await fetch('/api/orders/mine?limit=50', { headers });
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(data.orders)) {
                orders = data.orders;
                apiLoaded = true;
            } else if (!res.ok) {
                console.warn('[meus-pedidos]', data.error || res.status);
            }
        } catch (err) {
            console.warn('[meus-pedidos]', err?.message || err);
        }

        if (!apiLoaded && lastLocal?.orderId) {
            try {
                const res = await fetch(`/api/orders/get?id=${encodeURIComponent(lastLocal.orderId)}`);
                const data = await res.json();
                if (res.ok && data.order) orders = [data.order];
            } catch {
                /* fallback local */
            }
        }

        if (!orders.length && lastLocal?.items?.length) {
            mount.innerHTML = orderCardFromLocal(lastLocal);
            bindActions();
            return;
        }

        if (!orders.length) {
            mount.innerHTML = `<div class="conta-empty">
<span class="material-symbols-outlined conta-empty__icon">inventory_2</span>
<p class="conta-empty__title">Nenhum pedido recente</p>
<p class="conta-empty__sub">Faça seu primeiro pedido pelo catálogo.</p>
<a href="pedidos.html" class="conta-btn conta-btn--primary">Ver catálogo</a>
</div>`;
            return;
        }

        const reorderId = lastLocal?.orderId || orders[0]?.id || '';
        mount.innerHTML = orders
            .map((order) =>
                orderCardHtml(order, { showReorder: Boolean(reorderId && order.id === reorderId) }),
            )
            .join('');
        bindActions();
    };

    window.addEventListener('ligeirinho-auth-changed', loadOrders);
    window.addEventListener('ligeirinho-cart-changed', loadOrders);
    loadOrders();
})();
