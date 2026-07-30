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
        { value: 'all', label: 'Todos', icon: 'list', tone: 'muted' },
        { value: 'pending', label: 'Aguardando', icon: 'wait', tone: 'wait' },
        { value: 'pending_payment', label: 'Pagamento', icon: 'pay', tone: 'info' },
        { value: 'accepted', label: 'Aceito', icon: 'check', tone: 'progress' },
        { value: 'separation', label: 'Em separação', icon: 'package', tone: 'progress' },
        { value: 'separated', label: 'Separado', icon: 'package', tone: 'progress' },
        { value: 'route', label: 'A caminho', icon: 'truck', tone: 'progress' },
        { value: 'done', label: 'Entregue', icon: 'check', tone: 'ok' },
        { value: 'cancelled', label: 'Cancelado', icon: 'cancel', tone: 'danger' },
    ];

    let pollTimer = null;

    const STATUS_GLYPHS = {
        list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z"/></svg>',
        wait: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 3h10v2H7zm1 3h8l1 2v2.2c0 1.6-.7 3-1.9 4L12 17l-3.1-2.8A5.2 5.2 0 0 1 7 10.2V8l1-2zm2 3v1.2c0 .7.3 1.4.8 1.8L12 13.5l1.2-1.5c.5-.4.8-1.1.8-1.8V9H10zm-1 11h6v2H9z"/></svg>',
        pay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5zm2 1.5v2h14V8zm0 5v4.5c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V13z"/></svg>',
        truck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 7h-2V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h.2a2.5 2.5 0 0 0 4.6 0h4.4a2.5 2.5 0 0 0 4.6 0H20a2 2 0 0 0 2-2v-4a4 4 0 0 0-4-4ZM6.5 17a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 6.5 17ZM4 13V5h10v8Zm11.5 4a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5Zm4.5-2h-2v-4h2a2 2 0 0 1 2 2Z"/></svg>',
        package: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 3 7v10l9 5 9-5V7zm0 2.2 6.5 3.6L12 11.4 5.5 7.8 12 4.2zM5 9.3l6 3.3v6.8l-6-3.3V9.3zm8 10.1v-6.8l6-3.3v6.8l-6 3.3z"/></svg>',
        check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.3 7.7-5 5a1 1 0 0 1-1.4 0l-2.2-2.2a1 1 0 0 1 1.4-1.4l1.5 1.49 4.3-4.29a1 1 0 0 1 1.4 1.4Z"/></svg>',
        cancel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm3.5 12.1a1 1 0 0 1-1.4 1.4L12 13.4l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1-2.1-2.1a1 1 0 0 1 1.4-1.4l2.1 2.1 2.1-2.1a1 1 0 0 1 1.4 1.4L13.4 12Z"/></svg>',
        help: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 15a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 12 17Zm1.6-5.35-.45.3A1.6 1.6 0 0 0 12.4 13.5v.2a.8.8 0 0 1-1.6 0v-.35a2.2 2.2 0 0 1 1.05-1.85l.55-.35A1.2 1.2 0 1 0 11.2 9a.8.8 0 0 1-1.6 0 2.8 2.8 0 1 1 4 2.65Z"/></svg>',
    };

    const statusGlyphHtml = (iconKey) =>
        `<span class="conta-order-detail__badge-glyph">${STATUS_GLYPHS[iconKey] || STATUS_GLYPHS.help}</span>`;

    const esc = (v) =>
        String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const session = () => auth?.loadSession?.() || null;
    const canPrintDav = () => window.LigeirinhoOrderDavPrint?.isDistribuidoraAccount?.(session());

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

    const STATUS_META_BY_KEY = {
        pending: { tone: 'wait', icon: 'wait' },
        pending_payment: { tone: 'info', icon: 'pay', shortLabel: 'Pagamento' },
        accepted: { tone: 'progress', icon: 'check' },
        separation: { tone: 'progress', icon: 'package' },
        separated: { tone: 'progress', icon: 'package', shortLabel: 'Separado' },
        route: { tone: 'progress', icon: 'truck' },
        done: { tone: 'ok', icon: 'check' },
        paid: { tone: 'ok', icon: 'check' },
        cancelled: { tone: 'danger', icon: 'cancel' },
        progress: { tone: 'progress', icon: 'truck' },
    };

    const orderStatusMeta = (order) => {
        if (!order) return { key: 'all', label: '—', tone: 'muted', icon: 'help' };

        const tracking = order.tracking;
        if (tracking?.filterKey) {
            const key = tracking.filterKey;
            const style = STATUS_META_BY_KEY[key] || STATUS_META_BY_KEY.progress;
            const label = tracking.stepLabel || style.label || 'Em andamento';
            return {
                key,
                label,
                shortLabel: style.shortLabel || label,
                tone: style.tone,
                icon: style.icon,
            };
        }

        if (order.status === 'paid') {
            return { key: 'paid', label: 'Confirmado', tone: 'ok', icon: 'check' };
        }
        if (order.status === 'cancelled') {
            return { key: 'cancelled', label: 'Cancelado', tone: 'danger', icon: 'cancel' };
        }
        if (order.status === 'pending_payment') {
            return {
                key: 'pending_payment',
                label: 'Aguardando pagamento',
                shortLabel: 'Pagamento',
                tone: 'info',
                icon: 'pay',
            };
        }
        if ((order.channel || 'parceiros') === 'parceiros' && order.status === 'pending') {
            return {
                key: 'pending',
                label: 'Aguardando confirmação',
                shortLabel: 'Aguardando',
                tone: 'wait',
                icon: 'wait',
            };
        }
        return { key: 'progress', label: 'Em andamento', tone: 'progress', icon: 'truck' };
    };

    const statusBadgeHtml = (status) => {
        const label = status.shortLabel || status.label;
        return `<span class="conta-order-detail__badge conta-order-detail__badge--${esc(status.tone)}" title="${esc(status.label)}">
${statusGlyphHtml(status.icon)}
<span class="conta-order-detail__badge-label">${esc(label)}</span>
</span>`;
    };

    const canCancelOrder = (order) => {
        if (order?.tracking && typeof order.tracking.canCancel === 'boolean') {
            return order.tracking.canCancel;
        }
        return Boolean(
            order?.id &&
                order.status === 'pending' &&
                (order.channel || 'parceiros') === 'parceiros',
        );
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

    const emptyOrdersHtml = ({ filtered = false } = {}) => {
        const title = filtered ? 'Nenhum pedido encontrado' : 'Você ainda não fez pedidos';
        const sub = filtered
            ? 'Ajuste a busca, o status ou a data e tente de novo.'
            : 'Faça seu primeiro pedido pelo catálogo.';
        const action = filtered
            ? `<button type="button" class="conta-btn conta-btn--outline meus-pedidos-empty__btn" id="meus-pedidos-clear-empty">Limpar filtros</button>`
            : `<a href="pedidos.html" class="conta-btn conta-btn--primary meus-pedidos-empty__btn">Ver catálogo</a>`;
        return `<div class="conta-empty meus-pedidos-empty" role="status">
<span class="material-symbols-outlined conta-empty__icon">${filtered ? 'filter_alt_off' : 'inventory_2'}</span>
<p class="conta-empty__title">${esc(title)}</p>
<p class="conta-empty__sub">${esc(sub)}</p>
${action}
</div>`;
    };

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
        const selectedStatus =
            STATUS_OPTIONS.find((opt) => opt.value === STATE.status) || STATUS_OPTIONS[0];
        const statusOpts = STATUS_OPTIONS.map(
            (opt) =>
                `<option value="${esc(opt.value)}"${STATE.status === opt.value ? ' selected' : ''}>${esc(opt.label)}</option>`,
        ).join('');
        return `<div class="meus-pedidos-filters" role="search">
<label class="meus-pedidos-filters__field meus-pedidos-filters__field--search">
<span class="material-symbols-outlined" aria-hidden="true">search</span>
<input type="search" id="meus-pedidos-q" value="${esc(STATE.q)}" placeholder="Nº do pedido" autocomplete="off" inputmode="search" aria-label="Buscar por número do pedido">
</label>
<label class="meus-pedidos-filters__field meus-pedidos-filters__field--status meus-pedidos-filters__field--tone-${esc(selectedStatus.tone)}">
<span class="meus-pedidos-filters__status-glyph" aria-hidden="true">${STATUS_GLYPHS[selectedStatus.icon] || STATUS_GLYPHS.list}</span>
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
<div class="conta-order-detail__topline">
<p class="conta-order-detail__code">Pedido <code>${esc(shortId)}</code></p>
${statusBadgeHtml(status)}
</div>
<p class="conta-order-detail__date">${esc(formatDateTime(createdAt))}</p>
<div class="conta-order-detail__summary-meta">
<span class="conta-order-detail__meta-copy">${itemCount} ${itemCount === 1 ? 'item' : 'itens'} · ${esc(deliveryLabel)}</span>
<strong class="conta-order-detail__meta-total">${formatPrice(order.total)}</strong>
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
        ? `<a href="pedido-confirmado.html?order=${encodeURIComponent(order.id)}" class="conta-btn conta-btn--outline">Acompanhar pedido</a>`
        : ''
}
${
    canPrintDav() && order.id
        ? `<button type="button" class="conta-btn conta-btn--outline" data-meus-pedidos-print-dav="${esc(order.id)}">Imprimir DAV</button>`
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
        root.querySelectorAll('[data-meus-pedidos-print-dav]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const orderId = btn.getAttribute('data-meus-pedidos-print-dav');
                if (!orderId) return;
                const prevLabel = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Preparando…';
                try {
                    await window.LigeirinhoOrderDavPrint.printOrderDav(orderId, session());
                } catch (err) {
                    window.alert(err?.message || 'Não foi possível imprimir o DAV.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = prevLabel;
                }
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
            mount.innerHTML = emptyOrdersHtml({ filtered: filtersActive() || STATE.orders.length > 0 });
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
            const bar = root.querySelector('.meus-pedidos-filters');
            if (bar) {
                const next = filtersHtml();
                bar.outerHTML = next;
                bindFilters();
            }
            renderOrdersList();
        });
        dateInput?.addEventListener('change', () => {
            STATE.date = dateInput.value || '';
            renderOrdersList();
        });
        root.querySelector('#meus-pedidos-clear')?.addEventListener('click', clearFilters);
    };

    const renderShell = (bodyHtml, { withFilters = false, empty = false } = {}) => {
        root.innerHTML = `<div class="meus-pedidos-shell${empty ? ' meus-pedidos-shell--empty' : ''}">
<header class="meus-pedidos-header">
<h1 class="meus-pedidos-header__title">Pedidos</h1>
<p class="meus-pedidos-header__lead">${empty ? 'Seus pedidos aparecerão aqui.' : 'Busque por número, status ou data do pedido.'}</p>
</header>
${withFilters ? filtersHtml() : ''}
<div class="meus-pedidos-body" id="meus-pedidos-root">${bodyHtml}</div>
</div>`;
        if (withFilters) bindFilters();
    };

    const hasOpenOrders = (orders) =>
        (orders || []).some((order) => {
            const tracking = order?.tracking;
            if (tracking) {
                return !tracking.cancelled && tracking.step < 4 && order.status !== 'pending_payment';
            }
            return ['pending', 'confirmed', 'pending_payment'].includes(order?.status);
        });

    const stopPolling = () => {
        if (pollTimer) window.clearInterval(pollTimer);
        pollTimer = null;
    };

    const startPolling = () => {
        stopPolling();
        if (!hasOpenOrders(STATE.orders)) return;
        pollTimer = window.setInterval(() => {
            void loadOrders({ keepFilters: true, silent: true });
        }, 30000);
    };

    const loadOrders = async ({ keepFilters = false, silent = false } = {}) => {
        const s = session();
        if (!auth?.isLoggedIn?.() && !auth?.getAccountSessionToken?.()) {
            renderShell(`<div class="conta-empty meus-pedidos-empty">
<span class="material-symbols-outlined conta-empty__icon">person</span>
<p class="conta-empty__title">Entre para ver seus pedidos</p>
<p class="conta-empty__sub">Faça login para acompanhar status e histórico.</p>
<a href="${LOGIN('meus-pedidos.html')}" class="conta-btn conta-btn--primary meus-pedidos-empty__btn">Entrar</a>
</div>`, { empty: true });
            return;
        }

        if (!keepFilters) {
            STATE.q = '';
            STATE.status = 'all';
            STATE.date = '';
        }

        if (!silent) {
            renderShell('<p class="conta-hint">Carregando pedidos…</p>', { withFilters: false });
        }

        const lastLocal = cart?.loadLastOrder?.();
        let orders = [];
        let loadError = '';

        try {
            const headers = await accountHeaders();
            if (s?.sub) headers['X-Auth-Sub'] = s.sub;
            if (s?.email) headers['X-Account-Email'] = s.email;
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = controller
                ? window.setTimeout(() => controller.abort(), 25000)
                : null;
            const res = await fetch('/api/orders/mine?limit=50', {
                headers,
                signal: controller?.signal,
            });
            if (timeoutId) window.clearTimeout(timeoutId);
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(data.orders)) {
                orders = data.orders;
            } else if (!res.ok) {
                loadError = data.error || `Erro ${res.status} ao carregar pedidos.`;
                console.warn('[meus-pedidos]', loadError);
            }
        } catch (err) {
            loadError =
                err?.name === 'AbortError'
                    ? 'A consulta demorou demais. Tente novamente.'
                    : err?.message || 'Não foi possível carregar os pedidos.';
            console.warn('[meus-pedidos]', loadError);
        }

        if (loadError) {
            stopPolling();
            renderShell(`<div class="conta-empty meus-pedidos-empty" role="alert">
<span class="material-symbols-outlined conta-empty__icon">error</span>
<p class="conta-empty__title">Não foi possível carregar pedidos</p>
<p class="conta-empty__sub">${esc(loadError)}</p>
<button type="button" class="conta-btn conta-btn--primary meus-pedidos-empty__btn" id="meus-pedidos-retry">Tentar novamente</button>
</div>`, { empty: true });
            root.querySelector('#meus-pedidos-retry')?.addEventListener('click', () => loadOrders());
            return;
        }

        STATE.orders = orders;
        STATE.reorderId = lastLocal?.orderId || orders[0]?.id || '';
        if (!STATE.expandedId && orders[0]?.id) STATE.expandedId = orders[0].id;

        if (!orders.length) {
            stopPolling();
            renderShell(emptyOrdersHtml(), { withFilters: false, empty: true });
            return;
        }

        if (silent) {
            renderOrdersList();
            startPolling();
            return;
        }

        renderShell('', { withFilters: true });
        renderOrdersList();
        startPolling();
    };

    window.addEventListener('ligeirinho-auth-changed', () => loadOrders());
    window.addEventListener('ligeirinho-cart-changed', () => loadOrders({ keepFilters: true }));
    window.addEventListener('pagehide', stopPolling);
    loadOrders();
})();
