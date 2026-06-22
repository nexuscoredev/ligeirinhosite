(function () {
    const fin = window.LigeirinhoFinance;
    const auth = window.LigeirinhoAuth;
    if (!fin || !auth) return;

    const root = document.getElementById('caixa-root');
    let selectedId = null;
    let selectedMethod = 'pix';
    let refreshTimer = null;
    let queue = [];

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const shortId = (id) => String(id || '').slice(0, 8).toUpperCase();

    const methodLabel = (m) => {
        const key = String(m || '').toLowerCase();
        if (key === 'pix') return 'Pix';
        if (key === 'cartao') return 'Cartão';
        return 'Dinheiro';
    };

    const canAccess = () => {
        const s = auth.loadSession();
        const role = String(s?.role || '').toUpperCase();
        return role === 'ADMIN' || role === 'OPERADOR';
    };

    const renderLogin = () => {
        root.innerHTML = `<div class="fin-login">
<h1>Caixa PDV</h1>
<p>Fila de pagamento do totem — conectado ao Ligeirinho Hub e Parceiros.</p>
<form id="caixa-login-form">
<input class="fin-field" id="caixa-login-user" type="text" autocomplete="username" placeholder="Usuário Hub" required>
<input class="fin-field" id="caixa-login-pass" type="password" autocomplete="current-password" placeholder="Senha" required>
<button type="submit" class="fin-btn fin-btn--primary w-full">Entrar</button>
<p id="caixa-login-error" class="fin-error" hidden></p>
</form></div>`;
        document.getElementById('caixa-login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errEl = document.getElementById('caixa-login-error');
            errEl.hidden = true;
            try {
                await fin.login(
                    document.getElementById('caixa-login-user').value.trim(),
                    document.getElementById('caixa-login-pass').value
                );
                renderApp();
            } catch (err) {
                errEl.textContent = err.message;
                errEl.hidden = false;
            }
        });
    };

    const renderQueueItem = (o) => {
        const active = o.id === selectedId ? ' is-active' : '';
        const label = o.totem_label || o.customer_name || 'Totem';
        return `<button type="button" class="caixa-queue__item${active}" data-order="${esc(o.id)}">
<strong>#${shortId(o.id)} · ${esc(label)}</strong>
<div class="caixa-queue__meta">${fin.formatMoney(o.total)} · ${esc(methodLabel(o.payment_method))}</div>
</button>`;
    };

    const renderPdv = () => {
        const order = queue.find((o) => o.id === selectedId);
        if (!order) {
            return `<div class="caixa-pdv__empty">Selecione um pedido na fila para abrir no PDV.</div>`;
        }

        const items = (order.items || [])
            .map(
                (it) =>
                    `<li><span>${it.qty}x ${esc(it.name)}</span><span>${fin.formatMoney(
                        Number(it.price) * Number(it.qty)
                    )}</span></li>`
            )
            .join('');

        const methods = ['pix', 'cartao', 'dinheiro']
            .map((m) => {
                const active = selectedMethod === m ? ' is-active' : '';
                const icon =
                    m === 'pix' ? 'qr_code_2' : m === 'cartao' ? 'credit_card' : 'payments';
                return `<button type="button" class="caixa-pdv__method${active}" data-pdv-method="${m}">
<span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
${esc(methodLabel(m))}
</button>`;
            })
            .join('');

        return `<div class="caixa-pdv__body">
<p class="caixa-pdv__code">#${shortId(order.id)}</p>
<p class="fin-muted" style="text-align:center;margin:0 0 1rem">${esc(order.totem_label || 'Totem')} · escolheu ${esc(methodLabel(order.payment_method))}</p>
<ul class="caixa-pdv__items">${items}</ul>
<div class="caixa-pdv__total"><span>Total a receber</span><strong>${fin.formatMoney(order.total)}</strong></div>
<p class="fin-muted" style="margin:0 0 0.5rem;font-size:0.8125rem">Confirmar forma de recebimento no PDV:</p>
<div class="caixa-pdv__methods">${methods}</div>
<button type="button" class="fin-btn fin-btn--primary w-full" id="caixa-confirm-pay">Confirmar pagamento e liberar separação</button>
</div>`;
    };

    const renderApp = async () => {
        if (!fin.isLoggedIn()) {
            renderLogin();
            return;
        }

        try {
            const data = await fin.caixaQueue();
            queue = data.queue || [];
            if (!selectedId && queue[0]) selectedId = queue[0].id;
            if (selectedId && !queue.find((o) => o.id === selectedId)) {
                selectedId = queue[0]?.id || null;
            }
            const sel = queue.find((o) => o.id === selectedId);
            if (sel?.payment_method) selectedMethod = String(sel.payment_method).toLowerCase();
        } catch (err) {
            root.innerHTML = `<div class="fin-login"><p class="fin-error">${esc(err.message)}</p>
<button type="button" class="fin-btn fin-btn--ghost" id="caixa-retry">Tentar novamente</button></div>`;
            document.getElementById('caixa-retry')?.addEventListener('click', renderApp);
            return;
        }

        root.innerHTML = `<div class="fin-header">
<div><h1>Caixa PDV</h1><p class="text-sm text-on-surface-variant">Fila do totem · pagamento no balcão · Ligeirinho Hub</p></div>
<div class="fin-actions">
<a href="separacao.html" class="fin-btn fin-btn--ghost">Separação</a>
<a href="financeiro.html" class="fin-btn fin-btn--ghost">Financeiro</a>
<button type="button" class="fin-btn fin-btn--ghost" id="caixa-logout-btn">Sair</button>
</div>
</div>
<div class="caixa-layout">
<aside class="caixa-queue">
<div class="caixa-queue__head">
<h2>Fila do caixa</h2>
<span class="fin-badge">${queue.length}</span>
</div>
<div class="caixa-queue__list">${queue.length ? queue.map(renderQueueItem).join('') : '<p class="caixa-pdv__empty">Nenhum cliente aguardando.</p>'}</div>
</aside>
<section class="caixa-pdv">
<div class="caixa-pdv__head">
<h2>PDV — Pagamento</h2>
<button type="button" class="fin-btn fin-btn--ghost" id="caixa-refresh">Atualizar</button>
</div>
${renderPdv()}
</section>
</div>`;

        root.querySelectorAll('.caixa-queue__item').forEach((btn) => {
            btn.addEventListener('click', () => {
                selectedId = btn.dataset.order;
                const o = queue.find((x) => x.id === selectedId);
                if (o?.payment_method) selectedMethod = String(o.payment_method).toLowerCase();
                renderApp();
            });
        });

        root.querySelectorAll('[data-pdv-method]').forEach((btn) => {
            btn.addEventListener('click', () => {
                selectedMethod = btn.dataset.pdvMethod;
                root.querySelectorAll('[data-pdv-method]').forEach((b) =>
                    b.classList.toggle('is-active', b.dataset.pdvMethod === selectedMethod)
                );
            });
        });

        document.getElementById('caixa-refresh')?.addEventListener('click', renderApp);

        document.getElementById('caixa-logout-btn')?.addEventListener('click', () => {
            fin.logout();
            renderLogin();
        });

        document.getElementById('caixa-confirm-pay')?.addEventListener('click', async () => {
            const btn = document.getElementById('caixa-confirm-pay');
            if (!selectedId || !btn) return;
            btn.disabled = true;
            btn.textContent = 'Confirmando…';
            try {
                await fin.caixaPay(selectedId, selectedMethod);
                selectedId = null;
                await renderApp();
            } catch (err) {
                window.alert(err.message || 'Erro ao confirmar pagamento');
                btn.disabled = false;
                btn.textContent = 'Confirmar pagamento e liberar separação';
            }
        });

        clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(renderApp, 12000);
    };

    const init = () => {
        if (!canAccess() && !fin.isLoggedIn()) {
            renderLogin();
            return;
        }
        renderApp();
    };

    init();
})();
