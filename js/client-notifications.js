(function () {
    const STORAGE_KEY = 'ligeirinho-client-notifications-v1';
    const DISMISS_KEY = 'ligeirinho-client-notifications-dismissed';
    const HUB_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
    const HUB_ANON_KEY =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA';
    const POLL_MS = 180000;

    const SEED = [
        {
            id: 'seed-welcome',
            title: 'Bem-vindo ao Ligeirinho Parceiros',
            body: 'Peça em caixa e pallet com entrega rápida para revendedores.',
            href: 'inicio.html',
        },
        {
            id: 'seed-ofertas',
            title: 'Promoções da semana',
            body: 'Confira descontos em cervejas, destilados e refrigerantes.',
            href: 'ofertas.html',
        },
    ];

    let pollTimer = null;
    let mountedHost = null;
    let uiState = null;
    let panelPositionHandler = null;
    let broadcastsCache = null;
    /** Timestamp da última sync — só dispara push de sistema para itens novos depois disso. */
    let lastSyncAt = 0;
    const PUSHED_KEY = 'ligeirinho-notif-system-pushed-v1';

    const userKey = () => window.LigeirinhoAuth?.loadSession?.()?.sub || 'guest';

    const loadPushedIds = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(PUSHED_KEY) || '{}');
            return new Set(raw[userKey()] || []);
        } catch {
            return new Set();
        }
    };

    const savePushedIds = (set) => {
        try {
            const raw = JSON.parse(localStorage.getItem(PUSHED_KEY) || '{}');
            const list = [...set].slice(-80);
            raw[userKey()] = list;
            localStorage.setItem(PUSHED_KEY, JSON.stringify(raw));
        } catch {
            /* ignore */
        }
    };

    async function cascadeSystemNotifications(items) {
        const pushApi = window.LigeirinhoPush;
        if (!pushApi?.showSystemNotification || pushApi.permission() !== 'granted') return;
        if (!lastSyncAt) return;

        const pushed = loadPushedIds();
        const fresh = items.filter((n) => {
            if (n.readAt || pushed.has(n.id)) return false;
            if (n.source === 'seed' || n.source === 'broadcast') return false;
            const created = new Date(n.createdAt).getTime();
            return Number.isFinite(created) && created > lastSyncAt - 5000;
        });

        for (const item of fresh.slice(0, 6)) {
            pushed.add(item.id);
            try {
                await pushApi.showSystemNotification({
                    id: item.id,
                    title: item.title,
                    body: item.body,
                    url: item.href || '/meus-pedidos',
                });
            } catch {
                /* ignore */
            }
        }
        if (fresh.length) savePushedIds(pushed);
    }

    const escapeHtml = (str) =>
        String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

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
        const seedItems = window.LigeirinhoAuth?.usesPersonalPriceTable?.()
            ? SEED.filter((item) => item.id !== 'seed-ofertas')
            : SEED;
        seedItems.forEach((item) => {
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
        if (broadcastsCache) return broadcastsCache;
        try {
            const res = await fetch('data/client-notifications.json');
            if (!res.ok) return [];
            const data = await res.json();
            const now = Date.now();
            broadcastsCache = (data.broadcasts || [])
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
            return broadcastsCache;
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
                            const statusTag = unreadItem
                                ? '<span class="lig-notif-tag lig-notif-tag--unread">Não lido</span>'
                                : '<span class="lig-notif-tag lig-notif-tag--read">Lido</span>';
                            return `<${tag} class="lig-notif-item${unreadItem ? ' lig-notif-item--unread' : ' lig-notif-item--read'}" data-notif-id="${escapeHtml(item.id)}" data-notif-unread="${unreadItem ? '1' : '0'}" data-notif-hub="${item.hubId || ''}"${attrs}>
<div class="lig-notif-item__head"><span class="lig-notif-item__title">${escapeHtml(item.title)}</span><time class="lig-notif-item__time" datetime="${item.createdAt}">${formatDateTime(item.createdAt)}</time></div>
<p class="lig-notif-item__body">${escapeHtml(item.body)}</p>
<div class="lig-notif-item__foot">${statusTag}${item.meta ? `<span class="lig-notif-item__meta">${escapeHtml(item.meta)}</span>` : ''}</div>
</${tag}>`;
                        })
                        .join('');

        const pushApi = window.LigeirinhoPush;
        const pushNeedsEnable =
            pushApi?.supported?.() &&
            pushApi.permission() !== 'granted' &&
            pushApi.permission() !== 'denied';

        return `<div class="lig-notif-panel" role="dialog" aria-label="Notificações">
<div class="lig-notif-panel__head">
<span class="lig-notif-panel__title">Notificações</span>
<button type="button" class="lig-notif-mark-all" data-notif-mark-all ${unread === 0 || loading ? 'disabled' : ''}>Marcar todas</button>
</div>
${
    pushNeedsEnable
        ? `<div class="lig-notif-push-banner">
<p>Ative alertas no celular para receber avisos na tela de notificações do aparelho.</p>
<button type="button" class="lig-notif-push-btn" data-notif-enable-push>Ativar alertas</button>
</div>`
        : ''
}
${error ? `<p class="lig-notif-error">${escapeHtml(error)}</p>` : ''}
<div class="lig-notif-list">${listHtml}</div>
</div>`;
    }

    function bindPanel(host, state) {
        host.querySelector('[data-notif-enable-push]')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = 'Ativando…';
            try {
                await window.LigeirinhoPush.enableOrderStatusPush();
                render(host, state);
            } catch (err) {
                btn.disabled = false;
                btn.textContent = 'Ativar alertas';
                window.alert(err?.message || 'Não foi possível ativar as notificações.');
            }
        });

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

    const PANEL_WIDTH_PX = 352;

    function clearPanelPositionListeners() {
        if (!panelPositionHandler) return;
        window.removeEventListener('resize', panelPositionHandler);
        window.removeEventListener('scroll', panelPositionHandler, true);
        panelPositionHandler = null;
    }

    function positionNotifPanel(host) {
        const panel = host?.querySelector('.lig-notif-panel');
        const bell = host?.querySelector('.lig-notif-bell');
        if (!panel || !bell) return;

        if (!window.matchMedia('(min-width: 768px)').matches) {
            panel.removeAttribute('style');
            return;
        }

        const rect = bell.getBoundingClientRect();
        const width = Math.min(PANEL_WIDTH_PX, window.innerWidth - 24);
        let left = rect.right - width;
        left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
        const top = Math.round(rect.bottom + 8);
        const maxHeight = Math.max(160, Math.min(448, window.innerHeight - top - 16));

        panel.style.position = 'fixed';
        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.style.right = 'auto';
        panel.style.width = `${width}px`;
        panel.style.maxHeight = `${maxHeight}px`;
    }

    function syncPanelPosition(host, state) {
        if (!state?.open) {
            clearPanelPositionListeners();
            return;
        }
        positionNotifPanel(host);
        if (panelPositionHandler) return;
        panelPositionHandler = () => {
            if (uiState?.open && mountedHost) positionNotifPanel(mountedHost);
        };
        window.addEventListener('resize', panelPositionHandler);
        window.addEventListener('scroll', panelPositionHandler, true);
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
        syncPanelPosition(host, state);
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
        const items = await mergeNotifications();
        await cascadeSystemNotifications(items);
        lastSyncAt = Date.now();
        uiState.items = items;
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
            void window.LigeirinhoPush?.ensureSubscribed?.();
            void refreshUi();
        });

        // Baseline: não dispara cascata para o histórico já existente.
        uiState.items = await mergeNotifications();
        lastSyncAt = Date.now();
        render(host, uiState);

        void window.LigeirinhoPush?.ensureSubscribed?.();

        pollTimer = setInterval(() => {
            if (document.hidden) return;
            void refreshUi();
        }, POLL_MS);

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) void refreshUi();
        });
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
