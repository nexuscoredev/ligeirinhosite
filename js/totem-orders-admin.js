(function () {
    let deps = {};
    let orders = [];
    let loading = false;
    let errorMessage = '';

    const modal = () => document.getElementById('totem-orders-admin-modal');
    const listEl = () => document.getElementById('totem-orders-admin-list');
    const statusEl = () => document.getElementById('totem-orders-admin-status');
    const errorEl = () => document.getElementById('totem-orders-admin-error');

    const esc = (value) =>
        String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');

    const formatPrice = (value) =>
        Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatDateTime = (iso) => {
        const d = iso ? new Date(iso) : null;
        if (!d || Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    };

    const formatOrderCode = (orderId) =>
        window.LigeirinhoTotemReceipt?.compactCode?.(orderId) ||
        String(orderId || '')
            .replace(/[^a-fA-F0-9]/gi, '')
            .slice(0, 4)
            .toUpperCase();

    const itemCount = (order) =>
        (order?.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

    const isTotemAdmin = () => Boolean(deps.session?.()?.totemAdmin);

    const statusLabel = (order) => {
        if (order.financialStatus === 'aguardando_caixa') return 'Aguardando caixa';
        if (order.paymentMethod) return 'Pagamento escolhido';
        return 'Sem pagamento';
    };

    const canContinue = (order) => {
        const status = String(order?.status || '').toLowerCase();
        if (status !== 'pending' && status !== 'pending_payment') return false;
        if (order.financialStatus === 'aguardando_caixa') return true;
        return Boolean(order?.id);
    };

    const canRedo = (order) => {
        const status = String(order?.status || '').toLowerCase();
        if (status !== 'pending' && status !== 'pending_payment') return false;
        return order.financialStatus === 'pendente' || !order.paymentMethod;
    };

    const continueOrder = (order) => {
        if (!order?.id) return;
        if (order.financialStatus === 'aguardando_caixa') {
            window.location.href = `totem-caixa.html?order=${encodeURIComponent(order.id)}`;
            return;
        }
        window.location.href = `totem-pagamento.html?order=${encodeURIComponent(order.id)}`;
    };

    const redoOrder = (order) => {
        if (!order?.items?.length) return;
        const cartApi = window.LigeirinhoCart;
        if (!cartApi?.loadOrderIntoCart) return;

        cartApi.loadOrderIntoCart(order);
        try {
            sessionStorage.setItem(
                'lig_totem_redo_customer',
                JSON.stringify({
                    name: order.customerName || '',
                    phone: order.customerPhone || '',
                    cpf: order.customerCpf || '',
                }),
            );
        } catch {
            /* ignore */
        }
        closePanel();
        window.location.href = 'totem.html?cart=open&redo=1';
    };

    const showError = (message) => {
        errorMessage = String(message || '').trim();
        const el = errorEl();
        if (!el) return;
        if (!errorMessage) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = errorMessage;
    };

    const setStatus = (message) => {
        const el = statusEl();
        if (!el) return;
        el.textContent = message || '';
    };

    const renderList = () => {
        const el = listEl();
        if (!el) return;

        if (loading) {
            el.innerHTML =
                '<p class="totem-orders-admin__empty">Carregando pedidos pendentes…</p>';
            return;
        }

        if (!orders.length) {
            el.innerHTML =
                '<p class="totem-orders-admin__empty">Nenhum pedido pendente no Totem.</p>';
            return;
        }

        el.innerHTML = orders
            .map((order) => {
                const actions = [];
                if (canContinue(order)) {
                    actions.push(
                        `<button type="button" class="totem-btn totem-btn--primary totem-btn--sm" data-totem-order-continue="${esc(order.id)}">Continuar</button>`,
                    );
                }
                if (canRedo(order)) {
                    actions.push(
                        `<button type="button" class="totem-btn totem-btn--ghost totem-btn--sm" data-totem-order-redo="${esc(order.id)}">Refazer</button>`,
                    );
                }
                const customer = String(order.customerName || '').trim() || 'Cliente não informado';
                const unit = String(order.unitId || order.totemLabel || '').trim();
                return `<article class="totem-orders-admin__item">
<div class="totem-orders-admin__item-head">
<strong class="totem-orders-admin__code">${esc(formatOrderCode(order.id))}</strong>
<span class="totem-orders-admin__badge">${esc(statusLabel(order))}</span>
</div>
<p class="totem-orders-admin__customer">${esc(customer)}</p>
<div class="totem-orders-admin__meta">
<span>${esc(formatDateTime(order.createdAt))}</span>
<span>${itemCount(order)} itens · ${esc(formatPrice(order.total))}</span>
${unit ? `<span>${esc(unit)}</span>` : ''}
</div>
<div class="totem-orders-admin__actions">${actions.join('')}</div>
</article>`;
            })
            .join('');
    };

    const fetchOrders = async () => {
        const token = await deps.auth?.getHubAccessToken?.();
        if (!token) {
            throw new Error('Sessão expirada. Saia e entre novamente no Totem.');
        }

        const res = await fetch('/api/totem/admin/orders', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Não foi possível carregar os pedidos.');
        orders = Array.isArray(data.orders) ? data.orders : [];
    };

    const refreshOrders = async () => {
        loading = true;
        showError('');
        setStatus('Atualizando…');
        renderList();
        try {
            await fetchOrders();
            setStatus(`${orders.length} pedido${orders.length === 1 ? '' : 's'} pendente${orders.length === 1 ? '' : 's'}`);
        } catch (err) {
            orders = [];
            setStatus('');
            showError(err.message || 'Falha ao carregar pedidos.');
        } finally {
            loading = false;
            renderList();
        }
    };

    const openPanel = async () => {
        if (!isTotemAdmin()) return;
        const el = modal();
        if (!el) return;
        el.classList.add('totem-orders-admin-modal--open');
        el.setAttribute('aria-hidden', 'false');
        deps.onBumpIdle?.();
        await refreshOrders();
    };

    const closePanel = () => {
        const el = modal();
        if (!el) return;
        window.LigeirinhoTotemActivity?.suppressGhostClicks?.(360);
        el.classList.remove('totem-orders-admin-modal--open');
        el.setAttribute('aria-hidden', 'true');
        showError('');
        setStatus('');
        deps.onBumpIdle?.();
    };

    const handleListClick = (event) => {
        const continueBtn = event.target.closest('[data-totem-order-continue]');
        const redoBtn = event.target.closest('[data-totem-order-redo]');
        const orderId = continueBtn?.dataset?.totemOrderContinue || redoBtn?.dataset?.totemOrderRedo;
        if (!orderId) return;

        const order = orders.find((entry) => String(entry.id) === String(orderId));
        if (!order) return;

        event.preventDefault();
        deps.onBumpIdle?.();
        if (continueBtn) continueOrder(order);
        else if (redoBtn) redoOrder(order);
    };

    const updateAdminChrome = () => {
        const show = Boolean(isTotemAdmin());
        if (deps.ordersBtn) {
            deps.ordersBtn.hidden = !show;
        }
    };

    const bindEvents = () => {
        deps.ordersBtn?.addEventListener('click', () => {
            void openPanel();
        });
        document.getElementById('totem-orders-admin-close')?.addEventListener('click', closePanel);
        document.getElementById('totem-orders-admin-refresh')?.addEventListener('click', () => {
            void refreshOrders();
        });
        modal()?.querySelector('.totem-orders-admin-modal__backdrop')?.addEventListener('click', closePanel);
        listEl()?.addEventListener('click', handleListClick);

        document.addEventListener('keydown', (event) => {
            const el = modal();
            if (event.key === 'Escape' && el?.classList.contains('totem-orders-admin-modal--open')) {
                closePanel();
            }
        });
    };

    const init = (nextDeps) => {
        deps = nextDeps || {};
        closePanel();
        bindEvents();
        updateAdminChrome();
    };

    window.LigeirinhoTotemOrdersAdmin = {
        init,
        isTotemAdmin,
        openPanel,
        closePanel,
        refreshOrders,
        updateAdminChrome,
    };
})();
