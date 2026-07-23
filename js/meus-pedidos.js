(function () {
    const root = document.getElementById('meus-pedidos-app');
    if (!root) return;

    const cart = window.LigeirinhoCart;
    const auth = window.LigeirinhoAuth;
    const LOGIN = (next) => `/?next=${encodeURIComponent(next || 'meus-pedidos.html')}`;

    const STATE = {
        orders: [],
        reorderId: '',
        q: '',
        status: 'all',
        date: '',
        expandedId: '',
    };

    const STATUS_OPTIONS = [
        { value: 'all', label: 'Todos os status' },
        { value: 'pending', label: 'Aguardando confirmação' },
        { value: 'pending_payment', label: 'Aguardando pagamento' },
        { value: 'progress', label: 'Em andamento' },
        { value: 'paid', label: 'Confirmado' },
        { value: 'cancelled', label: 'Cancelado' },
    ];

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

    const orderCreatedAt = (order) => order?.createdAt || order?.savedAt || null;

    const orderDateKey = (order) => {
        const raw = orderCreatedAt(order);
        if (!raw) return '';
        const d = new Date(String(raw).includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const orderShortId = (order) => String(order?.id || '').replace(/-/g, '').slice(0, 8).toUpperCase();

    const orderStatusMeta = (order) => {
        if (!order) return { key: 'all', label: '—', tone: 'muted' };
        if (order.status === 'paid') return { key: 'paid', label: 'Confirmado', tone: 'ok' };
        if (order.status === 'cancelled') return { key: 'cancelled', label: 'Cancelado', tone: 'muted' };
        if (order.status === 'pending_payment') {
            return { key: 'pending_payment', label: 'Aguardando pagamento', tone: 'wait' };
        }
        if ((order.channel || 'parceiros') === 'parceiros' && order.status === 'pending') {
            return { key: 'pending', label: 'Aguardando confirmação', tone: 'wait' };
        }
        return { key: 'progress', label: 'Em andamento', tone: 'wait' };
    };

    const canCancelOrder = (order) =>
        Boolean(
            order?.id &&
                order.status === 'pending' &&
                (order.channel || 'parceiros') === 'parceiros',
        );

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

    const paymentMethodLabel = (order) => {
        const splitsApi = window.LigeirinhoPaymentSplits;
        const splits = splitsApi?.resolveOrderSplits?.(order) || [];
        if (splits.length >= 2) {
            return splitsApi.formatSplitSummary(splits, paymentMethodLabelSingle, formatPrice);
        }
        return paymentMethodLabelSingle(order.paymentMethod);
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

    const filtersActive = () => Boolean(STATE.q.trim() || STATE.status !== 'all' || STATE.date);

    const filterOrders = (orders) => {
        const q = STATE.q.trim().toLowerCase().replace(/[^a-z0-9]/gi, '');
        return orders.filter((order) => {
            const status = orderStatusMeta(order);
            if (STATE.status !== 'all' && status.key !== STATE.status) return false;
            if (STATE.date && orderDateKey(order) !== STATE.date) return false;
            if (q) {
                const id = String(order.id || '')
                    .toLowerCase()
                    .replace(/-/g, '');
                const short = orderShortId(order).toLowerCase();
                if (!id.includes(q) && !short.includes(q)) return false;
            }
            return true;
        });
    };

    const filtersHtml = () => {
        const statusOpts = STATUS_OPTIONS.map(
            (opt) =>
                `<option value="${esc(opt.value)}"${STATE.status === opt.value ? ' selected' : ''}>${esc(opt.label)}</option>`,
        ).join('');
        return `<div class="meus-pedidos-filters" role="search">
<label class="meus-pedidos-filters__field meus-pedidos-filters__field--search">
<span class="material-symbols-outlined" aria-hidden="true">search</span>
<input type="search" id="meus-pedidos-q" value="${esc(STATE.q)}" placeholder="Nº do pedido" autocomplete="off" inputmode="search" aria-label="Buscar por número do pedido">
</label>
<label class="meus-pedidos-filters__field">
<span class="sr-only">Status</span>
<select id="meus-pedidos-status" aria-label="Filtrar por status">${statusOpts}</select>
</label>
<label class="meus-pedidos-filters__field meus-pedidos-filters__field--date">
<span class="material-symbols-outlined" aria-hidden="true">calendar_month</span>
<input type="date" id="meus-pedidos-date" value="${esc(STATE.date)}" aria-label="Filtrar por data do pedido">
</label>
${
    filtersActive()
        ? `<button type="button" class="meus-pedidos-filters__clear" id="meus-pedidos-clear">Limpar</button>`
        : ''
}
</div>`;
    };

    const orderCardHtml = (order, { showReorder = false, expanded = false } = {}) => {
        const status = orderStatusMeta(order);
        const shortId = orderShortId(order);
        const deliveryLabel =
            order.deliveryType === 'retirada'
                ? 'Retirada na loja'
                : order.deliveryDate
                  ? `Entrega · ${formatDateOnly(order.deliveryDate)}`
                  : 'Entrega';
        const createdAt = orderCreatedAt(order);
        const itemCount = (order.items || []).reduce((sum, item) => sum + (Number(item.qty) || 1), 0);

        return `<article class="conta-order-detail${expanded ? ' conta-order-detail--open' : ''}" data-order-id="${esc(order.id || '')}">
<button type="button" class="conta-order-detail__summary" data-meus-pedidos-toggle="${esc(order.id || '')}" aria-expanded="${expanded ? 'true' : 'false'}">
<div class="conta-order-detail__head">
<div class="conta-order-detail__head-main">
<p class="conta-order-detail__code">Pedido <code>${esc(shortId)}</code></p>
<p class="conta-order-detail__date">${esc(formatDateTime(createdAt))}</p>
</div>
<span class="conta-order-detail__badge conta-order-detail__badge--${status.tone}">${esc(status.label)}</span>
</div>
<div class="conta-order-detail__summary-meta">
<span>${itemCount} ${itemCount === 1 ? 'item' : 'itens'} · ${esc(deliveryLabel)}</span>
<strong>${formatPrice(order.total)}</strong>
<span class="material-symbols-outlined conta-order-detail__chev" aria-hidden="true">${expanded ? 'expand_less' : 'expand_more'}</span>
</div>
</button>
<div class="conta-order-detail__panel"${expanded ? '' : ' hidden'}>
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
        ? `<button type="button" class="conta-btn conta-btn--primary" data-meus-pedidos-reorder>Repetir pedido</button>`
        : ''
}
${
    order.id
        ? `<a href="pedido-confirmado.html?order=${encodeURIComponent(order.id)}" class="conta-btn conta-btn--outline">Ver confirmação</a>`
        : ''
}
<button type="button" class="conta-btn conta-btn--outline" data-meus-pedidos-open-cart>Ir ao caminhão</button>
${
    canCancelOrder(order)
        ? `<button type="button" class="conta-btn conta-btn--danger" data-meus-pedidos-cancel="${esc(order.id)}">Cancelar solicitação</button>`
        : ''
}
</div>
</div>
</article>`;
    };

    const orderFromLocal = (last) => {
        const checkout = last.checkout || {};
        const total = last.items.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);
        return {
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
    };

    const cancelOrder = async (orderId, button) => {
        const shortId = String(orderId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
        const ok = window.confirm(
            `Cancelar a solicitação do pedido ${shortId}?\n\nSó é possível enquanto o pedido ainda aguarda confirmação da loja.`,
        );
        if (!ok) return;

        const prevLabel = button?.textContent;
        if (button) {
            button.disabled = true;
            button.textContent = 'Cancelando…';
        }

        try {
            const headers = await accountHeaders();
            const s = session();
            if (s?.sub) headers['X-Auth-Sub'] = s.sub;
            if (s?.email) headers['X-Account-Email'] = s.email;
            const res = await fetch('/api/orders/cancel', {
                method: 'POST',
                headers,
                body: JSON.stringify({ orderId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Não foi possível cancelar o pedido.');
            }
            await loadOrders({ keepFilters: true });
        } catch (err) {
            window.alert(err?.message || 'Não foi possível cancelar o pedido.');
            if (button) {
                button.disabled = false;
                button.textContent = prevLabel || 'Cancelar solicitação';
            }
        }
    };

    const bindListActions = () => {
        root.querySelectorAll('[data-meus-pedidos-toggle]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-meus-pedidos-toggle') || '';
                STATE.expandedId = STATE.expandedId === id ? '' : id;
                renderOrdersList();
            });
        });
        root.querySelectorAll('[data-meus-pedidos-reorder]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (cart?.restoreLastOrder?.()) {
                    window.LigeirinhoCartUI?.render?.();
                    openCaminhao();
                }
            });
        });
        root.querySelectorAll('[data-meus-pedidos-open-cart]').forEach((btn) => {
            btn.addEventListener('click', openCaminhao);
        });
        root.querySelectorAll('[data-meus-pedidos-cancel]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const orderId = btn.getAttribute('data-meus-pedidos-cancel');
                if (orderId) cancelOrder(orderId, btn);
            });
        });
    };

    const renderOrdersList = () => {
        const mount = root.querySelector('#meus-pedidos-root');
        if (!mount) return;

        const filtered = filterOrders(STATE.orders);
        const total = STATE.orders.length;
        syncClearButton();

        if (!filtered.length) {
            mount.innerHTML = `<div class="conta-empty">
<span class="material-symbols-outlined conta-empty__icon">filter_alt_off</span>
<p class="conta-empty__title">Nenhum pedido encontrado</p>
<p class="conta-empty__sub">${
                filtersActive()
                    ? 'Ajuste a busca, o status ou a data e tente de novo.'
                    : 'Faça seu primeiro pedido pelo catálogo.'
            }</p>
${
    filtersActive()
        ? `<button type="button" class="conta-btn conta-btn--outline" id="meus-pedidos-clear-empty">Limpar filtros</button>`
        : `<a href="pedidos.html" class="conta-btn conta-btn--primary">Ver catálogo</a>`
}
</div>`;
            root.querySelector('#meus-pedidos-clear-empty')?.addEventListener('click', () => {
                clearFilters();
            });
            return;
        }

        if (!STATE.expandedId || !filtered.some((o) => o.id === STATE.expandedId)) {
            STATE.expandedId = filtered[0]?.id || '';
        }

        const countLabel =
            filtered.length === total
                ? `${total} ${total === 1 ? 'pedido' : 'pedidos'}`
                : `${filtered.length} de ${total} pedidos`;

        mount.innerHTML = `<p class="meus-pedidos-count" id="meus-pedidos-count">${esc(countLabel)}</p>
<div class="meus-pedidos-list">${filtered
            .map((order) =>
                orderCardHtml(order, {
                    showReorder: Boolean(STATE.reorderId && order.id === STATE.reorderId),
                    expanded: order.id === STATE.expandedId,
                }),
            )
            .join('')}</div>`;

        bindListActions();
    };

    const syncClearButton = () => {
        const bar = root.querySelector('.meus-pedidos-filters');
        if (!bar) return;
        let clearBtn = root.querySelector('#meus-pedidos-clear');
        if (filtersActive()) {
            if (!clearBtn) {
                clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = 'meus-pedidos-filters__clear';
                clearBtn.id = 'meus-pedidos-clear';
                clearBtn.textContent = 'Limpar';
                clearBtn.addEventListener('click', clearFilters);
                bar.appendChild(clearBtn);
            }
        } else if (clearBtn) {
            clearBtn.remove();
        }
    };

    const clearFilters = () => {
        STATE.q = '';
        STATE.status = 'all';
        STATE.date = '';
        const qInput = root.querySelector('#meus-pedidos-q');
        const statusSelect = root.querySelector('#meus-pedidos-status');
        const dateInput = root.querySelector('#meus-pedidos-date');
        if (qInput) qInput.value = '';
        if (statusSelect) statusSelect.value = 'all';
        if (dateInput) dateInput.value = '';
        renderOrdersList();
    };

    const bindFilters = () => {
        const qInput = root.querySelector('#meus-pedidos-q');
        const statusSelect = root.querySelector('#meus-pedidos-status');
        const dateInput = root.querySelector('#meus-pedidos-date');

        let searchTimer = null;
        qInput?.addEventListener('input', () => {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = window.setTimeout(() => {
                STATE.q = qInput.value || '';
                renderOrdersList();
            }, 140);
        });
        statusSelect?.addEventListener('change', () => {
            STATE.status = statusSelect.value || 'all';
            renderOrdersList();
        });
        dateInput?.addEventListener('change', () => {
            STATE.date = dateInput.value || '';
            renderOrdersList();
        });
        root.querySelector('#meus-pedidos-clear')?.addEventListener('click', clearFilters);
    };

    const renderShell = (bodyHtml, { withFilters = false } = {}) => {
        root.innerHTML = `<div class="meus-pedidos-shell">
<header class="meus-pedidos-header">
<h1 class="meus-pedidos-header__title">Pedidos</h1>
<p class="meus-pedidos-header__lead">Busque por número, status ou data do pedido.</p>
</header>
${withFilters ? filtersHtml() : ''}
<div class="meus-pedidos-body" id="meus-pedidos-root">${bodyHtml}</div>
</div>`;
        if (withFilters) bindFilters();
    };

    const loadOrders = async ({ keepFilters = false } = {}) => {
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

        if (!keepFilters) {
            STATE.q = '';
            STATE.status = 'all';
            STATE.date = '';
        }

        renderShell('<p class="conta-hint">Carregando pedidos…</p>', { withFilters: false });

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
            orders = [orderFromLocal(lastLocal)];
        }

        STATE.orders = orders;
        STATE.reorderId = lastLocal?.orderId || orders[0]?.id || '';
        if (!STATE.expandedId && orders[0]?.id) STATE.expandedId = orders[0].id;

        if (!orders.length) {
            renderShell(`<div class="conta-empty">
<span class="material-symbols-outlined conta-empty__icon">inventory_2</span>
<p class="conta-empty__title">Nenhum pedido recente</p>
<p class="conta-empty__sub">Faça seu primeiro pedido pelo catálogo.</p>
<a href="pedidos.html" class="conta-btn conta-btn--primary">Ver catálogo</a>
</div>`);
            return;
        }

        renderShell('', { withFilters: true });
        renderOrdersList();
    };

    window.addEventListener('ligeirinho-auth-changed', () => loadOrders());
    window.addEventListener('ligeirinho-cart-changed', () => loadOrders({ keepFilters: true }));
    loadOrders();
})();
