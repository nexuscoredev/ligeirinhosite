(function () {
    const STORAGE_KEY = 'ligeirinho-client-notifications-v1';
    const DISMISS_KEY = 'ligeirinho-client-notifications-dismissed';
    const HUB_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
    const HUB_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA';
    const POLL_MS = 90000;

    const SEED = [
        {
            id: 'seed-welcome',
            title: 'Bem-vindo ao Ligeirinho Parceiros',
            body: 'Peça em caixa e pallet com entrega rápida para revendedores.',
            href: 'inicio.html',
        },
        {
            id: 'seed-ofertas',
            title: 'Ofertas da semana',
            body: 'Confira descontos em cervejas, destilados e refrigerantes.',
            href: 'ofertas.html',
        },
        {
            id: 'seed-raios',
            title: 'Club Raios',
            body: 'Ganhe pontos a cada pedido pago e troque por benefícios.',
            href: 'raios.html',
        },
    ];

    let pollTimer = null;
    let mountedHost = null;
    let uiState = null;

    const escapeHtml = (str) =>
        String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const userKey = () => window.LigeirinhoAuth?.loadSession?.()?.sub || 'guest';

    const loadDismissed = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
            return new Set(raw[userKey()] || []);
        } catch {
            return new Set();
        }
    };

    const saveDismissed = (set) => {
        try {
            const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
            raw[userKey()] = [...set];
            localStorage.setItem(DISMISS_KEY, JSON.stringify(raw));
        } catch {
            /* ignore */
        }
    };

    const loadLocalStore = () => {
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return all[userKey()] || { items: [], seeded: false };
        } catch {
            return { items: [], seeded: false };
        }
    };

    const saveLocalStore = (store) => {
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            all[userKey()] = store;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch {
            /* ignore */
        }
    };

    const formatDateTime = (iso) => {
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
    };

    const badgeLabel = (count) => (count > 99 ? '99+' : String(count));

    const hubHeaders = (token) => ({
        apikey: HUB_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
    });

    const hubIndisponivel = (err) => {
        const msg = err?.message || String(err || '');
        return /hub_notifications|could not find|schema cache|PGRST205/i.test(msg);
    };

    async function getHubToken() {
        const auth = window.LigeirinhoAuth;
        if (!auth?.getHubAccessToken) return null;
        return auth.getHubAccessToken();
    }

    async function fetchHubJson(url, token, options = {}) {
        const res = await fetch(url, { ...options, headers: { ...hubHeaders(token), ...(options.headers || {}) } });
        const text = await res.text();
        if (!res.ok) {
            const err = new Error(text || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return text ? JSON.parse(text) : null;
    }

    async function fetchHubNotifications(token) {
        const session = window.LigeirinhoAuth?.loadSession?.();
        if (!session?.hubUserId) return [];

        const rows = await fetchHubJson(
            `${HUB_URL}/rest/v1/hub_notifications?select=id,title,body,read_at,created_at,sender_user_id&order=created_at.desc&limit=40`,
            token
        );
        if (!Array.isArray(rows) || !rows.length) return [];

        const senderIds = [...new Set(rows.map((r) => r.sender_user_id).filter(Boolean))];
        let senders = new Map();
        if (senderIds.length) {
            try {
                const perfis = await fetchHubJson(
                    `${HUB_URL}/rest/v1/usuarios?select=id,nome,cargo&id=in.(${senderIds.join(',')})`,
                    token
                );
                senders = new Map((perfis || []).map((p) => [p.id, p]));
            } catch {
                /* optional meta */
            }
        }

        return rows.map((row) => ({
            id: `hub:${row.id}`,
            hubId: row.id,
            title: row.title,
            body: row.body,
            readAt: row.read_at,
            createdAt: row.created_at,
            source: 'hub',
            meta: senders.get(row.sender_user_id)?.nome || '',
        }));
    }

    function ensureSeed() {
        const store = loadLocalStore();
        if (store.seeded) return;
        const dismissed = loadDismissed();
        const now = new Date().toISOString();
        SEED.forEach((item) => {
            if (dismissed.has(item.id)) return;
            if (store.items.some((n) => n.id === item.id)) return;
            store.items.push({
                ...item,
                readAt: null,
                createdAt: now,
                source: 'seed',
            });
        });
        store.seeded = true;
        store.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        saveLocalStore(store);
    }

    function pushLocal(entry) {
        ensureSeed();
        const store = loadLocalStore();
        const id = entry.id || `local:${Date.now()}`;
        const existing = store.items.findIndex((n) => n.id === id);
        const item = {
            id,
            title: entry.title || 'Notificação',
            body: entry.body || '',
            href: entry.href || '',
            meta: entry.meta || '',
            readAt: null,
            createdAt: entry.createdAt || new Date().toISOString(),
            source: entry.source || 'app',
        };
        if (existing >= 0) store.items[existing] = { ...store.items[existing], ...item };
        else store.items.unshift(item);
        store.items = store.items.slice(0, 60);
        saveLocalStore(store);
        window.dispatchEvent(new CustomEvent('ligeirinho-notifications-changed'));
        if (mountedHost && uiState) void refreshUi();
        return item;
    }

    function markLocalRead(id) {
        const store = loadLocalStore();
        const item = store.items.find((n) => n.id === id);
        if (item) {
            if (item.readAt) return false;
            item.readAt = new Date().toISOString();
            saveLocalStore(store);
            return true;
        }
        if (id.startsWith('broadcast:')) {
            const dismissed = loadDismissed();
            if (dismissed.has(id)) return false;
            dismissed.add(id);
            saveDismissed(dismissed);
            return true;
        }
        return false;
    }

    function markAllLocalRead() {
        const store = loadLocalStore();
        const dismissed = loadDismissed();
        const now = new Date().toISOString();
        let changed = false;
        store.items.forEach((n) => {
            if (!n.readAt) {
                n.readAt = now;
                changed = true;
            }
        });
        if (changed) saveLocalStore(store);
        if (uiState?.items) {
            uiState.items.forEach((n) => {
                if (n.id.startsWith('broadcast:') && !dismissed.has(n.id)) {
                    dismissed.add(n.id);
                    changed = true;
                }
            });
            if (changed) saveDismissed(dismissed);
        }
        return changed;
    }

    async function markHubRead(hubId) {
        const token = await getHubToken();
        if (!token) return;
        await fetchHubJson(`${HUB_URL}/rest/v1/hub_notifications?id=eq.${encodeURIComponent(hubId)}`, token, {
            method: 'PATCH',
            body: JSON.stringify({ read_at: new Date().toISOString() }),
        });
    }

    async function markAllHubRead() {
        const token = await getHubToken();
        const userId = window.LigeirinhoAuth?.loadSession?.()?.hubUserId;
        if (!token || !userId) return;
        await fetchHubJson(
            `${HUB_URL}/rest/v1/hub_notifications?recipient_user_id=eq.${encodeURIComponent(userId)}&read_at=is.null`,
            token,
            { method: 'PATCH', body: JSON.stringify({ read_at: new Date().toISOString() }) }
        );
    }

    async function loadBroadcasts() {
        try {
            const res = await fetch('data/client-notifications.json');
            if (!res.ok) return [];
            const data = await res.json();
            const now = Date.now();
            return (data.broadcasts || [])
                .filter((b) => {
                    if (!b.activeUntil) return true;
                    return new Date(b.activeUntil).getTime() >= now;
                })
                .map((b) => ({
                    id: `broadcast:${b.id}`,
                    title: b.title,
                    body: b.body,
                    href: b.href || '',
                    readAt: null,
                    createdAt: b.createdAt || new Date().toISOString(),
                    source: 'broadcast',
                }));
        } catch {
            return [];
        }
    }

    async function mergeNotifications() {
        ensureSeed();
        const dismissed = loadDismissed();
        const local = loadLocalStore().items.filter((n) => !dismissed.has(n.id));
        const broadcasts = (await loadBroadcasts()).filter((n) => !dismissed.has(n.id));

        let hub = [];
        try {
            const token = await getHubToken();
            if (token) hub = await fetchHubNotifications(token);
        } catch (err) {
            if (!hubIndisponivel(err)) console.error(err);
        }

        const map = new Map();
        [...broadcasts, ...local, ...hub].forEach((item) => {
            if (!dismissed.has(item.id)) map.set(item.id, item);
        });

        return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    function renderPanel(state) {
        const { open, loading, error, items } = state;
        if (!open) return '';

        const unread = items.filter((n) => !n.readAt).length;
        const listHtml =
            loading && !items.length
                ? '<p class="lig-notif-empty">Carregando…</p>'
                : !items.length
                  ? '<p class="lig-notif-empty">Nenhuma notificação por aqui.</p>'
                  : items
                        .map((item) => {
                            const unreadItem = !item.readAt;
                            const tag = item.href
                                ? 'a'
                                : 'button';
                            const attrs = item.href
                                ? ` href="${escapeHtml(item.href)}"`
                                : ` type="button"`;
                            return `<${tag} class="lig-notif-item${unreadItem ? ' lig-notif-item--unread' : ''}" data-notif-id="${escapeHtml(item.id)}" data-notif-unread="${unreadItem ? '1' : '0'}" data-notif-hub="${item.hubId || ''}"${attrs}>
<div class="lig-notif-item__head"><span class="lig-notif-item__title">${escapeHtml(item.title)}</span><time class="lig-notif-item__time" datetime="${item.createdAt}">${formatDateTime(item.createdAt)}</time></div>
<p class="lig-notif-item__body">${escapeHtml(item.body)}</p>
${item.meta ? `<div class="lig-notif-item__meta">${escapeHtml(item.meta)}</div>` : ''}
</${tag}>`;
                        })
                        .join('');

        return `<div class="lig-notif-panel" role="dialog" aria-label="Notificações">
<div class="lig-notif-panel__head">
<span class="lig-notif-panel__title">Notificações</span>
<button type="button" class="lig-notif-mark-all" data-notif-mark-all ${unread === 0 || loading ? 'disabled' : ''}>Marcar todas</button>
</div>
${error ? `<p class="lig-notif-error">${escapeHtml(error)}</p>` : ''}
<div class="lig-notif-list">${listHtml}</div>
</div>`;
    }

    function bindPanel(host, state) {
        host.querySelector('[data-notif-mark-all]')?.addEventListener('click', async (e) => {
            e.preventDefault();
            markAllLocalRead();
            try {
                await markAllHubRead();
            } catch (err) {
                console.error(err);
            }
            state.items = state.items.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }));
            render(host, state);
        });

        host.querySelectorAll('[data-notif-id]').forEach((el) => {
            const onActivate = async () => {
                if (el.getAttribute('data-notif-unread') !== '1') return;
                const id = el.getAttribute('data-notif-id');
                const hubId = el.getAttribute('data-notif-hub');
                if (id.startsWith('hub:') || hubId) {
                    try {
                        await markHubRead(hubId || id.replace(/^hub:/, ''));
                    } catch (err) {
                        console.error(err);
                    }
                } else {
                    markLocalRead(id);
                }
                state.items = state.items.map((n) =>
                    n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n
                );
                render(host, state);
            };

            el.addEventListener('click', (e) => {
                if (el.tagName === 'A' && el.getAttribute('data-notif-unread') === '1') {
                    void onActivate();
                    return;
                }
                if (el.tagName === 'BUTTON') {
                    e.preventDefault();
                    void onActivate();
                }
            });
        });
    }

    function render(host, state) {
        const unread = state.items.filter((n) => !n.readAt).length;
        host.innerHTML = `<div class="lig-notif-root">
<button type="button" class="lig-notif-bell${state.open ? ' lig-notif-bell--open' : ''}" aria-expanded="${state.open}" aria-haspopup="dialog" aria-label="${unread > 0 ? `Notificações — ${unread} não lidas` : 'Notificações'}" title="Notificações">
<span class="material-symbols-outlined lig-notif-bell__icon" aria-hidden="true">notifications</span>
${unread > 0 ? `<span class="lig-notif-badge" aria-hidden="true">${badgeLabel(unread)}</span>` : ''}
</button>
${renderPanel(state)}
</div>`;

        host.querySelector('.lig-notif-bell')?.addEventListener('click', () => {
            state.open = !state.open;
            render(host, state);
            bindPanel(host, state);
            if (state.open) void loadList(host, state);
        });

        bindPanel(host, state);
    }

    async function loadList(host, state) {
        state.loading = true;
        state.error = null;
        render(host, state);
        try {
            state.items = await mergeNotifications();
        } catch (err) {
            state.error = err.message || 'Erro ao carregar notificações.';
        } finally {
            state.loading = false;
            render(host, state);
        }
    }

    async function refreshUi() {
        if (!mountedHost || !uiState) return;
        uiState.items = await mergeNotifications();
        render(mountedHost, uiState);
    }

    async function mount(selector) {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }

        const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!host) return;

        mountedHost = host;
        uiState = { open: false, loading: false, error: null, items: [] };

        const onDocClick = (e) => {
            if (!uiState?.open) return;
            if (!host.contains(e.target)) {
                uiState.open = false;
                render(host, uiState);
            }
        };

        const onKey = (e) => {
            if (e.key === 'Escape' && uiState?.open) {
                uiState.open = false;
                render(host, uiState);
            }
        };

        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);

        window.addEventListener('ligeirinho-notifications-changed', refreshUi);
        window.addEventListener('ligeirinho-auth-changed', () => {
            ensureSeed();
            void refreshUi();
        });

        uiState.items = await mergeNotifications();
        render(host, uiState);

        pollTimer = setInterval(() => {
            void refreshUi();
        }, POLL_MS);
    }

    window.LigeirinhoClientNotifications = {
        mount,
        push: pushLocal,
        refresh: refreshUi,
    };

    window.LigeirinhoHubNotifications = {
        mount: (selector) => window.LigeirinhoClientNotifications.mount(selector),
    };
})();
