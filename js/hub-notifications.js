(function () {
    const HUB_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
    const HUB_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA';

    const POLL_MS = 90000;
    let pollTimer = null;
    let mountedRoot = null;

    function hubHeaders(token) {
        return {
            apikey: HUB_ANON_KEY,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        };
    }

    function formatDateTime(iso) {
        try {
            return new Date(iso).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return '';
        }
    }

    function indisponivel(err) {
        const msg = err?.message || String(err || '');
        return /hub_notifications|could not find|schema cache|PGRST205/i.test(msg);
    }

    async function getAccessToken() {
        const auth = window.LigeirinhoAuth;
        if (!auth?.getHubAccessToken) return null;
        return auth.getHubAccessToken();
    }

    async function fetchJson(url, token, options = {}) {
        const res = await fetch(url, { ...options, headers: { ...hubHeaders(token), ...(options.headers || {}) } });
        const text = await res.text();
        if (!res.ok) {
            const err = new Error(text || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return text ? JSON.parse(text) : null;
    }

    async function contarNaoLidas(token) {
        const url = `${HUB_URL}/rest/v1/hub_notifications?select=id&read_at=is.null`;
        const res = await fetch(url, {
            headers: { ...hubHeaders(token), Prefer: 'count=exact' },
        });
        if (!res.ok) return 0;
        const range = res.headers.get('content-range') || '';
        const match = range.match(/\/(\d+)$/);
        return match ? Number(match[1]) : 0;
    }

    async function listar(token) {
        const rows = await fetchJson(
            `${HUB_URL}/rest/v1/hub_notifications?select=id,recipient_user_id,sender_user_id,title,body,read_at,created_at&order=created_at.desc&limit=50`,
            token
        );
        if (!Array.isArray(rows) || !rows.length) return [];

        const senderIds = [...new Set(rows.map((r) => r.sender_user_id))];
        const perfis = await fetchJson(
            `${HUB_URL}/rest/v1/usuarios?select=id,nome,cargo&id=in.(${senderIds.join(',')})`,
            token
        );
        const senders = new Map((perfis || []).map((p) => [p.id, p]));

        return rows.map((row) => ({
            ...row,
            sender: senders.get(row.sender_user_id) || null,
        }));
    }

    async function marcarLida(token, id) {
        await fetchJson(`${HUB_URL}/rest/v1/hub_notifications?id=eq.${encodeURIComponent(id)}`, token, {
            method: 'PATCH',
            body: JSON.stringify({ read_at: new Date().toISOString() }),
        });
    }

    async function marcarTodas(token) {
        const userId = window.LigeirinhoAuth.loadSession()?.hubUserId;
        if (!userId) return;
        await fetchJson(
            `${HUB_URL}/rest/v1/hub_notifications?recipient_user_id=eq.${encodeURIComponent(userId)}&read_at=is.null`,
            token,
            { method: 'PATCH', body: JSON.stringify({ read_at: new Date().toISOString() }) }
        );
    }

    function renderPanel(state) {
        const { open, loading, error, items, naoLidas } = state;
        if (!open) return '';

        const listHtml = loading && !items.length
            ? '<p class="lig-notif-empty">Carregando…</p>'
            : !items.length
              ? '<p class="lig-notif-empty">Nenhuma notificação.</p>'
              : items
                    .map((item) => {
                        const unread = !item.read_at;
                        const meta = item.sender?.nome
                            ? `${item.sender.nome}${item.sender.cargo ? ` · ${item.sender.cargo}` : ''}`
                            : '';
                        return `<button type="button" class="lig-notif-item${unread ? ' lig-notif-item--unread' : ''}" data-notif-id="${item.id}" data-notif-unread="${unread ? '1' : '0'}">
<div class="lig-notif-item__head"><span class="lig-notif-item__title">${escapeHtml(item.title)}</span><time class="lig-notif-item__time" datetime="${item.created_at}">${formatDateTime(item.created_at)}</time></div>
<p class="lig-notif-item__body">${escapeHtml(item.body)}</p>
${meta ? `<div class="lig-notif-item__meta">${escapeHtml(meta)}</div>` : ''}
</button>`;
                    })
                    .join('');

        return `<div class="lig-notif-panel" role="dialog" aria-label="Notificações">
<div class="lig-notif-panel__head">
<span class="lig-notif-panel__title">Notificações</span>
<button type="button" class="lig-notif-mark-all" data-notif-mark-all ${naoLidas === 0 || loading ? 'disabled' : ''}>Marcar todas</button>
</div>
${error ? `<p class="lig-notif-error">${escapeHtml(error)}</p>` : ''}
<div class="lig-notif-list">${listHtml}</div>
</div>`;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function badgeLabel(count) {
        return count > 99 ? '99+' : String(count);
    }

    async function mount(selector) {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }

        const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!host) return;

        const token = await getAccessToken();
        const session = window.LigeirinhoAuth?.loadSession?.();
        if (!token || !session?.hubUserId) {
            host.innerHTML = '';
            return;
        }

        mountedRoot = host;
        const state = { open: false, loading: false, error: null, items: [], naoLidas: 0 };

        const render = () => {
            host.innerHTML = `<div class="lig-notif-root">
<button type="button" class="lig-notif-bell${state.open ? ' lig-notif-bell--open' : ''}" aria-expanded="${state.open}" aria-haspopup="dialog" aria-label="${state.naoLidas > 0 ? `Notificações — ${state.naoLidas} não lidas` : 'Notificações'}" title="Notificações">
<span class="material-symbols-outlined lig-notif-bell__icon" aria-hidden="true">notifications</span>
${state.naoLidas > 0 ? `<span class="lig-notif-badge" aria-hidden="true">${badgeLabel(state.naoLidas)}</span>` : ''}
</button>
${renderPanel(state)}
</div>`;

            host.querySelector('.lig-notif-bell')?.addEventListener('click', () => {
                state.open = !state.open;
                render();
                if (state.open) void carregarLista();
            });

            host.querySelector('[data-notif-mark-all]')?.addEventListener('click', async (e) => {
                e.preventDefault();
                const t = await getAccessToken();
                if (!t) return;
                try {
                    await marcarTodas(t);
                    const now = new Date().toISOString();
                    state.items = state.items.map((n) => ({ ...n, read_at: n.read_at || now }));
                    state.naoLidas = 0;
                    render();
                } catch (err) {
                    console.error(err);
                }
            });

            host.querySelectorAll('[data-notif-id]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (btn.getAttribute('data-notif-unread') !== '1') return;
                    const t = await getAccessToken();
                    if (!t) return;
                    const id = btn.getAttribute('data-notif-id');
                    try {
                        await marcarLida(t, id);
                        state.items = state.items.map((n) =>
                            n.id === id ? { ...n, read_at: new Date().toISOString() } : n
                        );
                        state.naoLidas = Math.max(0, state.naoLidas - 1);
                        render();
                    } catch (err) {
                        console.error(err);
                    }
                });
            });
        };

        const atualizarBadge = async () => {
            try {
                const t = await getAccessToken();
                if (!t) return;
                state.naoLidas = await contarNaoLidas(t);
                if (mountedRoot === host) render();
            } catch (err) {
                if (!indisponivel(err)) console.error(err);
            }
        };

        const carregarLista = async () => {
            state.loading = true;
            state.error = null;
            render();
            try {
                const t = await getAccessToken();
                if (!t) throw new Error('Sessão expirada. Entre novamente.');
                state.items = await listar(t);
                state.naoLidas = state.items.filter((n) => !n.read_at).length;
            } catch (err) {
                state.error = err.message || 'Erro ao carregar notificações.';
                if (indisponivel(err)) state.items = [];
            } finally {
                state.loading = false;
                render();
            }
        };

        const onDocClick = (e) => {
            if (!state.open) return;
            if (!host.contains(e.target)) {
                state.open = false;
                render();
            }
        };

        const onKey = (e) => {
            if (e.key === 'Escape' && state.open) {
                state.open = false;
                render();
            }
        };

        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);

        render();
        await atualizarBadge();

        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => {
            void atualizarBadge();
        }, POLL_MS);
    }

    window.LigeirinhoHubNotifications = { mount };
})();
