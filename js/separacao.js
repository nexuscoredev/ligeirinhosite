(function () {
    const fin = window.LigeirinhoFinance;
    const auth = window.LigeirinhoAuth;
    if (!fin || !auth) return;

    const root = document.getElementById('sep-root');
    let selectedId = null;
    let refreshTimer = null;

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const shortId = (id) => String(id || '').slice(0, 8).toUpperCase();

    const canAccess = () => {
        const s = auth.loadSession();
        const role = String(s?.role || '').toUpperCase();
        return role === 'ADMIN' || role === 'OPERADOR';
    };

    const renderLogin = () => {
        root.innerHTML = `<div class="fin-login">
<h1>Separação</h1>
<p>Fila de pedidos do totem — operadores e administradores.</p>
<form id="sep-login-form">
<input class="fin-field" id="sep-login-user" type="text" autocomplete="username" placeholder="Usuário Hub" required>
<input class="fin-field" id="sep-login-pass" type="password" autocomplete="current-password" placeholder="Senha" required>
<button type="submit" class="fin-btn fin-btn--primary w-full">Entrar</button>
<p id="sep-login-error" class="fin-error" hidden></p>
</form></div>`;
        document.getElementById('sep-login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errEl = document.getElementById('sep-login-error');
            errEl.hidden = true;
            try {
                await fin.login(
                    document.getElementById('sep-login-user').value.trim(),
                    document.getElementById('sep-login-pass').value
                );
                renderApp();
            } catch (err) {
                errEl.textContent = err.message;
                errEl.hidden = false;
            }
        });
    };

    const statusBadge = (status) => {
        if (status === 'pronto') return '<span class="fin-badge fin-badge--paid">Pronto</span>';
        return '<span class="fin-badge fin-badge--billing">Separando</span>';
    };

    const renderQueueItem = (o) => {
        const active = o.id === selectedId ? ' is-active' : '';
        const label = o.totem_label || o.customer_name || 'Totem';
        return `<button type="button" class="sep-queue__item${active}" data-order="${esc(o.id)}">
<strong>#${shortId(o.id)} · ${esc(label)}</strong>
<div class="sep-queue__meta">${fin.formatMoney(o.total)} · ${o.progress?.label || '—'} · ${statusBadge(o.separation_status || 'em_separacao')}</div>
</button>`;
    };

    const renderItemRow = (it) => {
        const done = it.status === 'feito' || it.picked_qty >= it.qty;
        const partial = it.status === 'parcial';
        const cls = done ? 'sep-item--done' : partial ? 'sep-item--partial' : '';
        const mark = done ? '✓' : partial ? `${it.picked_qty}` : '';
        const qtyLabel = it.qty > 1 ? `${it.picked_qty}/${it.qty}` : '';
        return `<button type="button" class="sep-item ${cls}" data-pick="${esc(it.id)}" ${done ? 'disabled' : ''}>
<span class="sep-item__check">${mark}</span>
<span class="sep-item__body">
<div class="sep-item__name">${esc(it.product_name)}</div>
<div class="sep-item__cat">${esc(it.category_name || '')}</div>
</span>
${qtyLabel ? `<span class="sep-item__qty">${qtyLabel}</span>` : ''}
</button>`;
    };

    const renderDetail = (data) => {
        if (!data) {
            return '<div class="sep-empty">Selecione um pedido na fila.</div>';
        }
        const { order, items, progress } = data;
        return `<div class="sep-detail">
<div class="sep-detail__head">
<div>
<h2 style="margin:0;font-size:1.125rem">#${shortId(order.id)}</h2>
<p class="text-sm text-on-surface-variant" style="margin:0.25rem 0 0">${esc(order.totemLabel || order.customerName || 'Totem')} · ${fin.formatMoney(order.total)}</p>
</div>
<div class="sep-progress">${progress?.label || '0/0'}</div>
</div>
<div class="fin-actions" style="margin-bottom:1rem">
<button type="button" class="fin-btn fin-btn--ghost fin-btn--sm" id="sep-export-btn">Exportar CSV</button>
<button type="button" class="fin-btn fin-btn--ghost fin-btn--sm" id="sep-refresh-btn">Atualizar</button>
</div>
<div class="sep-items">${items.map(renderItemRow).join('')}</div>
</div>`;
    };

    const loadDetail = async (orderId) => {
        if (!orderId) return null;
        return fin.separationOrder(orderId);
    };

    const renderApp = async () => {
        root.innerHTML = '<p class="fin-empty">Carregando fila…</p>';
        try {
            const { queue } = await fin.separationQueue();
            if (!selectedId && queue.length) selectedId = queue[0].id;

            const detail = selectedId ? await loadDetail(selectedId) : null;

            root.innerHTML = `<div class="fin-header">
<div><h1>Separação</h1><p class="text-sm text-on-surface-variant">Cervejas primeiro · ordem do catálogo Hub</p></div>
<div class="fin-actions">
<a href="caixa.html" class="fin-btn fin-btn--ghost">Caixa PDV</a>
<a href="financeiro.html" class="fin-btn fin-btn--ghost">Financeiro</a>
<button type="button" class="fin-btn fin-btn--ghost" id="sep-logout-btn">Sair</button>
</div>
</div>
<div class="sep-layout">
<aside class="sep-queue">
<div class="sep-queue__head">Fila (${queue.length})</div>
<div class="sep-queue__list">${queue.length ? queue.map(renderQueueItem).join('') : '<p class="sep-empty">Nenhum pedido pago aguardando.</p>'}</div>
</aside>
<section>${renderDetail(detail)}</section>
</div>`;

            root.querySelectorAll('[data-order]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    selectedId = btn.getAttribute('data-order');
                    await renderApp();
                });
            });

            root.querySelectorAll('[data-pick]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const itemId = btn.getAttribute('data-pick');
                    try {
                        await fin.separationPick(selectedId, itemId, 1);
                        await renderApp();
                    } catch (err) {
                        alert(err.message);
                    }
                });
            });

            document.getElementById('sep-export-btn')?.addEventListener('click', async () => {
                try {
                    await fin.separationExport(selectedId);
                } catch (err) {
                    alert(err.message);
                }
            });
            document.getElementById('sep-refresh-btn')?.addEventListener('click', () => renderApp());
            document.getElementById('sep-logout-btn')?.addEventListener('click', () => {
                fin.logout();
                selectedId = null;
                if (refreshTimer) clearInterval(refreshTimer);
                renderLogin();
            });
        } catch (err) {
            root.innerHTML = `<p class="fin-error">${esc(err.message)}</p>`;
        }
    };

    const boot = () => {
        if (!canAccess()) {
            window.location.replace('inicio.html');
            return;
        }
        if (fin.isLoggedIn()) renderApp();
        else renderLogin();
        if (refreshTimer) clearInterval(refreshTimer);
        refreshTimer = setInterval(() => {
            if (fin.isLoggedIn() && document.visibilityState === 'visible') renderApp();
        }, 30000);
    };

    boot();
})();
