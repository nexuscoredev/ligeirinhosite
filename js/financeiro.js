(function () {
    const fin = window.LigeirinhoFinance;
    const auth = window.LigeirinhoAuth;
    const routing = window.LigeirinhoAuthRouting;
    if (!fin || !auth) return;

    const root = document.getElementById('finance-root');
    const modal = document.getElementById('fin-charge-modal');
    const modalBody = document.getElementById('fin-charge-modal-body');
    const modalClose = document.getElementById('fin-charge-modal-close');

    let activeTab = 'orders';
    let lastCharge = null;

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const shortId = (id) => String(id || '').slice(0, 8).toUpperCase();

    const canAccessFinance = () => {
        const s = auth.loadSession();
        const role = String(s?.role || '').toUpperCase();
        return role === 'ADMIN' || role === 'OPERADOR';
    };

    const renderLogin = () => {
        root.innerHTML = `<div class="fin-login">
<h1>Financeiro</h1>
<p>Acesso restrito a administradores e operadores do Hub.</p>
<form id="fin-login-form">
<input class="fin-field" id="fin-login-user" type="text" autocomplete="username" placeholder="Usuário Hub" required>
<input class="fin-field" id="fin-login-pass" type="password" autocomplete="current-password" placeholder="Senha" required>
<button type="submit" class="fin-btn fin-btn--primary w-full">Entrar</button>
<p id="fin-login-error" class="fin-error" hidden></p>
</form></div>`;
        document.getElementById('fin-login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errEl = document.getElementById('fin-login-error');
            errEl.hidden = true;
            try {
                await fin.login(
                    document.getElementById('fin-login-user').value.trim(),
                    document.getElementById('fin-login-pass').value
                );
                renderApp();
            } catch (err) {
                errEl.textContent = err.message;
                errEl.hidden = false;
            }
        });
    };

    const statCard = (label, value, extra = '') =>
        `<div class="fin-stat ${extra}"><div class="fin-stat__label">${esc(label)}</div><div class="fin-stat__value">${value}</div></div>`;

    const orderRow = (o) => {
        const fs = o.financialStatus || 'pendente';
        const canCharge = fs === 'pendente' || fs === 'vencido' || fs === 'em_cobranca';
        return `<tr>
<td><strong>#${shortId(o.id)}</strong></td>
<td>${esc(o.customerName || '—')}</td>
<td>${fin.formatMoney(o.total)}</td>
<td>${esc(o.paymentMethod || '—')}</td>
<td>${fin.formatDate(o.dueDate)}</td>
<td><span class="fin-badge ${fin.statusClass[fs] || ''}">${esc(fin.statusLabel[fs] || fs)}</span></td>
<td class="fin-actions">
${canCharge ? `<button type="button" class="fin-btn fin-btn--primary fin-btn--sm" data-charge="${esc(o.id)}">Gerar Cobrança MP</button>` : ''}
${o.customerPhone ? `<button type="button" class="fin-btn fin-btn--wa fin-btn--sm" data-wa-order="${esc(o.id)}" data-phone="${esc(o.customerPhone)}" hidden>WhatsApp</button>` : ''}
</td>
</tr>`;
    };

    const renderApp = async () => {
        root.innerHTML = '<p class="fin-empty">Carregando painel…</p>';
        try {
            const [{ stats }, { orders: orderList }, settingsData] = await Promise.all([
                fin.dashboard(),
                fin.orders(),
                fin.settings().catch(() => ({ settings: {} })),
            ]);

            const tabs = [
                { id: 'orders', label: 'Pedidos' },
                { id: 'charges', label: 'Cobranças MP' },
                { id: 'customers', label: 'Clientes' },
                { id: 'settings', label: 'Configurações' },
            ];

            root.innerHTML = `<div class="fin-header">
<div><h1>Painel Financeiro</h1><p class="text-sm text-on-surface-variant">Mercado Pago · Crédito · Cashback</p></div>
<div class="fin-actions">
<button type="button" class="fin-btn fin-btn--ghost" id="fin-logout-btn">Sair</button>
<a href="separacao.html" class="fin-btn fin-btn--ghost">Separação</a>
</div>
</div>
<div class="fin-stats">
${statCard('Em aberto', fin.formatMoney(stats.openTotal))}
${statCard('Recebido', fin.formatMoney(stats.receivedTotal), 'fin-stat--ok')}
${statCard('Vencido', fin.formatMoney(stats.overdueTotal), 'fin-stat--warn')}
${statCard('Inadimplentes', String(stats.delinquentCount))}
${statCard('Cobranças MP', String(stats.chargesCount))}
</div>
<div class="fin-tabs">${tabs.map((t) => `<button type="button" class="fin-tab${activeTab === t.id ? ' fin-tab--active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
<div id="fin-tab-content"></div>`;

            document.getElementById('fin-logout-btn')?.addEventListener('click', () => {
                fin.logout();
                renderLogin();
            });

            root.querySelectorAll('[data-tab]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    activeTab = btn.dataset.tab;
                    renderApp();
                });
            });

            const content = document.getElementById('fin-tab-content');
            if (activeTab === 'orders') {
                content.innerHTML = `<div class="fin-panel"><div class="fin-table-wrap"><table class="fin-table"><thead><tr>
<th>Pedido</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Vencimento</th><th>Status</th><th>Ações</th>
</tr></thead><tbody>${(orderList || []).map(orderRow).join('') || '<tr><td colspan="7" class="fin-empty">Nenhum pedido</td></tr>'}</tbody></table></div></div>`;
                bindOrderActions(orderList || []);
            } else if (activeTab === 'charges') {
                const { charges: chargeList } = await fin.charges();
                content.innerHTML = `<div class="fin-panel"><div class="fin-table-wrap"><table class="fin-table"><thead><tr>
<th>Pedido</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Link</th>
</tr></thead><tbody>${(chargeList || [])
                    .map(
                        (c) => `<tr>
<td>#${shortId(c.orderId)}</td>
<td>${fin.formatMoney(c.amount)}</td>
<td>${fin.formatDate(c.dueDate)}</td>
<td>${esc(c.status)}</td>
<td>${c.paymentLink ? `<a href="${esc(c.paymentLink)}" target="_blank" rel="noopener">Abrir</a>` : '—'}</td>
</tr>`
                    )
                    .join('')}</tbody></table></div></div>`;
            } else if (activeTab === 'customers') {
                const { customers: list } = await fin.customers();
                content.innerHTML = `<div class="fin-customer-grid">${(list || [])
                    .map(
                        (c) => `<article class="fin-customer-card" data-customer="${esc(c.id)}">
<strong>${esc(c.name)}</strong>
<p class="text-sm text-on-surface-variant mt-1">${esc(c.email || c.phone || '—')}</p>
<p class="text-sm mt-2">Limite: ${fin.formatMoney(c.creditLimit)} · Usado: ${fin.formatMoney(c.creditUsed)} · Disp.: <strong>${fin.formatMoney(c.creditAvailable)}</strong></p>
</article>`
                    )
                    .join('') || '<p class="fin-empty">Nenhum cliente cadastrado</p>'}</div>`;
                content.querySelectorAll('[data-customer]').forEach((el) => {
                    el.addEventListener('click', () => openCustomerDetail(el.dataset.customer));
                });
            } else if (activeTab === 'settings') {
                const s = settingsData.settings || {};
                content.innerHTML = `<div class="fin-panel" style="padding:1.25rem">
<p class="text-sm mb-4">Mercado Pago: ${s.mpConfigured ? `<span class="fin-badge fin-badge--paid">Configurado</span> (${esc(s.mpPublicKey || '')})` : '<span class="fin-badge fin-badge--overdue">Não configurado</span> — defina MP_PUBLIC_KEY e MP_ACCESS_TOKEN no Vercel.'}</p>
<form id="fin-settings-form" class="fin-settings-row">
<label>Cashback padrão (%)<input type="number" name="cashback" min="0" max="100" step="0.5" value="${Number(s.cashbackPercentDefault) || 0}"></label>
<label>Prazo padrão (dias)<input type="number" name="dueDays" min="1" max="365" value="${Number(s.defaultDueDays) || 30}"></label>
<button type="submit" class="fin-btn fin-btn--primary">Salvar</button>
</form>
<p class="text-xs text-on-surface-variant">Credenciais MP ficam nas variáveis de ambiente (Vercel). Rode <code>scripts/finance-schema-migration.sql</code> no Supabase Parceiros.</p>
</div>`;
                document.getElementById('fin-settings-form')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.target);
                    await fin.updateSettings({
                        cashbackPercentDefault: Number(fd.get('cashback')),
                        defaultDueDays: Number(fd.get('dueDays')),
                    });
                    renderApp();
                });
            }
        } catch (err) {
            root.innerHTML = `<p class="fin-empty fin-error">${esc(err.message)}</p>`;
            if (err.message.includes('expirada') || err.message.includes('autorizado')) renderLogin();
        }
    };

    const bindOrderActions = (orders) => {
        root.querySelectorAll('[data-charge]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = 'Gerando…';
                try {
                    const data = await fin.createCharge(btn.dataset.charge);
                    lastCharge = data;
                    showChargeModal(data);
                    const order = orders.find((o) => o.id === btn.dataset.charge);
                    const waBtn = root.querySelector(`[data-wa-order="${btn.dataset.charge}"]`);
                    if (waBtn && data.whatsappMessage) {
                        waBtn.hidden = false;
                        waBtn.onclick = () => {
                            window.open(fin.whatsAppUrl(waBtn.dataset.phone, data.whatsappMessage), '_blank');
                        };
                    }
                } catch (err) {
                    window.alert(err.message);
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Gerar Cobrança MP';
                }
            });
        });
    };

    const showChargeModal = (data) => {
        if (!modal || !modalBody) return;
        modalBody.innerHTML = `<h2>Cobrança gerada</h2>
${data.pixQrBase64 ? `<img class="fin-charge-qr" src="data:image/png;base64,${data.pixQrBase64}" alt="QR Code PIX">` : ''}
${data.paymentLink ? `<p class="fin-link-box"><a href="${esc(data.paymentLink)}" target="_blank" rel="noopener">${esc(data.paymentLink)}</a></p>` : ''}
${data.pixQrCode ? `<p class="text-xs fin-link-box">${esc(data.pixQrCode)}</p>` : ''}
<div class="fin-actions mt-4">
${data.whatsappMessage ? `<button type="button" class="fin-btn fin-btn--wa" id="fin-modal-wa">Enviar Cobrança WhatsApp</button>` : ''}
<button type="button" class="fin-btn fin-btn--ghost" id="fin-modal-close-btn">Fechar</button>
</div>`;
        modal.classList.add('fin-modal--open');
        document.getElementById('fin-modal-wa')?.addEventListener('click', () => {
            const phone = lastCharge?.order?.customerPhone;
            window.open(fin.whatsAppUrl(phone || '5511970924909', data.whatsappMessage), '_blank');
        });
        document.getElementById('fin-modal-close-btn')?.addEventListener('click', closeModal);
    };

    const closeModal = () => modal?.classList.remove('fin-modal--open');
    modalClose?.addEventListener('click', closeModal);

    const openCustomerDetail = async (customerId) => {
        activeTab = 'customers';
        const data = await fin.customerHistory(customerId);
        const c = data.customer;
        root.innerHTML = `<div class="fin-header">
<button type="button" class="fin-btn fin-btn--ghost" id="fin-back-btn">← Voltar</button>
<h1>${esc(c.name)}</h1>
</div>
<div class="fin-stats fin-stats--customer">
${statCard('Limite', fin.formatMoney(c.creditLimit))}
${statCard('Utilizado', fin.formatMoney(c.creditUsed))}
${statCard('Disponível', fin.formatMoney(c.creditAvailable))}
${statCard('Cashback', fin.formatMoney(data.wallet?.balance || 0), 'fin-stat--ok')}
</div>
<div class="fin-panel" style="padding:1rem;margin-bottom:1rem">
<form id="fin-credit-form" class="fin-settings-row">
<label>Novo limite<input type="number" name="limit" min="0" step="0.01" value="${c.creditLimit}"></label>
<label><input type="checkbox" name="blocked" ${c.isBlocked ? 'checked' : ''}> Bloquear pedidos</label>
<button type="submit" class="fin-btn fin-btn--primary fin-btn--sm">Atualizar</button>
</form></div>
<h2 class="text-lg font-bold mb-2">Pedidos</h2>
<div class="fin-panel mb-4"><div class="fin-table-wrap"><table class="fin-table"><thead><tr><th>Pedido</th><th>Total</th><th>Status</th><th>Vencimento</th></tr></thead>
<tbody>${(data.orders || []).map((o) => `<tr><td>#${shortId(o.id)}</td><td>${fin.formatMoney(o.total)}</td><td><span class="fin-badge ${fin.statusClass[o.financialStatus]}">${esc(fin.statusLabel[o.financialStatus])}</span></td><td>${fin.formatDate(o.dueDate)}</td></tr>`).join('')}</tbody></table></div></div>
<h2 class="text-lg font-bold mb-2">Cobranças</h2>
<div class="fin-panel mb-4"><div class="fin-table-wrap"><table class="fin-table"><thead><tr><th>Valor</th><th>Status</th><th>Data</th></tr></thead>
<tbody>${(data.charges || []).map((ch) => `<tr><td>${fin.formatMoney(ch.amount)}</td><td>${esc(ch.status)}</td><td>${fin.formatDate(ch.createdAt)}</td></tr>`).join('') || '<tr><td colspan="3" class="fin-empty">Nenhuma cobrança</td></tr>'}</tbody></table></div></div>
<h2 class="text-lg font-bold mb-2">Cashback</h2>
<div class="fin-panel"><div class="fin-table-wrap"><table class="fin-table"><thead><tr><th>Tipo</th><th>Valor</th><th>Saldo</th><th>Data</th></tr></thead>
<tbody>${(data.walletTransactions || []).map((t) => `<tr><td>${esc(t.type)}</td><td>${fin.formatMoney(t.amount)}</td><td>${fin.formatMoney(t.balance_after)}</td><td>${fin.formatDate(t.created_at)}</td></tr>`).join('') || '<tr><td colspan="4" class="fin-empty">Sem movimentações</td></tr>'}</tbody></table></div></div>`;
        document.getElementById('fin-back-btn')?.addEventListener('click', renderApp);
        document.getElementById('fin-credit-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await fin.updateCustomer(customerId, {
                creditLimit: Number(fd.get('limit')),
                isBlocked: fd.get('blocked') === 'on',
            });
            openCustomerDetail(customerId);
        });
    };

    const init = () => {
        if (routing && !routing.guardPageAccess()) return;
        if (!canAccessFinance()) {
            root.innerHTML = `<div class="fin-empty"><p>Acesso restrito a administradores e operadores.</p><p class="mt-2"><a href="/">Fazer login</a></p></div>`;
            return;
        }
        if (fin.isLoggedIn()) renderApp();
        else renderLogin();
    };

    init();
})();
