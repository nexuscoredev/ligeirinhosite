(function () {
    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const output = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
        return output;
    };

    const accountHeaders = async () => {
        const auth = window.LigeirinhoAuth;
        const headers = { 'Content-Type': 'application/json' };
        const hubToken = await auth?.getHubAccessToken?.();
        if (hubToken) {
            headers.Authorization = `Bearer ${hubToken}`;
            return headers;
        }
        let accountToken = auth?.getAccountSessionToken?.();
        if (!accountToken) accountToken = await auth?.ensureAccountSession?.();
        if (accountToken) {
            headers['X-Account-Session'] = accountToken;
            return headers;
        }
        const googleCred = auth?.getGoogleCredential?.();
        const session = auth?.loadSession?.();
        if (googleCred) {
            headers['X-Google-Credential'] = googleCred;
            if (session?.hubUserId) headers['X-Hub-User-Id'] = session.hubUserId;
            return headers;
        }
        if (session?.provider === 'google' && session?.email) {
            headers['X-Auth-Provider'] = 'google';
            headers['X-Account-Email'] = session.email;
            if (session.hubUserId) headers['X-Hub-User-Id'] = session.hubUserId;
            return headers;
        }
        throw new Error('Entre na conta para ativar notificações.');
    };

    const supported = () =>
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

    async function fetchPublicKey() {
        const res = await fetch('/api/push/vapid-public-key');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.publicKey) {
            throw new Error(data.error || 'Chave VAPID indisponível.');
        }
        return data.publicKey;
    }

    async function ensureSwRegistration() {
        const existing = await navigator.serviceWorker.getRegistration('/');
        if (existing) return existing;
        return navigator.serviceWorker.register('/js/sw.js', { scope: '/' });
    }

    /**
     * Pede permissão, assina Web Push e envia subscription ao backend.
     * @param {{ orderId?: string, silent?: boolean }} [opts]
     */
    async function enableOrderStatusPush(opts = {}) {
        if (!supported()) {
            throw new Error('Este aparelho não suporta notificações push.');
        }

        if (Notification.permission === 'denied') {
            throw new Error('Notificações bloqueadas neste aparelho. Libere nas configurações do navegador.');
        }

        if (opts.silent && Notification.permission !== 'granted') {
            return { ok: false, reason: 'needs_permission' };
        }

        const permission =
            Notification.permission === 'granted'
                ? 'granted'
                : await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permissão de notificação negada.');
        }

        const reg = await ensureSwRegistration();
        await navigator.serviceWorker.ready;

        const publicKey = await fetchPublicKey();
        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
            subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });
        }

        const headers = await accountHeaders();
        const res = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                orderId: opts.orderId || undefined,
            }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || data.hint || 'Não foi possível ativar as notificações.');
        }
        return { ok: true, subscription };
    }

    /** Reenvia subscription se a permissão já foi concedida (sem prompt). */
    async function ensureSubscribed(opts = {}) {
        try {
            return await enableOrderStatusPush({ ...opts, silent: true });
        } catch {
            return { ok: false };
        }
    }

    async function showLocalOrderStatus(tracking, order) {
        if (!supported() || Notification.permission !== 'granted') return;
        const shortId = String(order?.id || '')
            .replace(/-/g, '')
            .slice(0, 8)
            .toUpperCase();
        const title = tracking?.cancelled
            ? 'Pedido cancelado'
            : tracking?.headerTitle || tracking?.stepLabel || 'Atualização do pedido';
        const body = tracking?.message || `Pedido ${shortId}`;
        const reg = await navigator.serviceWorker.getRegistration('/');
        const opts = {
            body,
            icon: 'img/app-icon-light-192.png',
            badge: 'img/app-icon-light-192.png',
            tag: order?.id
                ? `order-${order.id}-${Date.now()}`
                : `order-local-${Date.now()}`,
            renotify: true,
            data: {
                url: order?.id
                    ? `pedido-confirmado.html?order=${encodeURIComponent(order.id)}`
                    : 'meus-pedidos.html',
            },
        };
        if (reg?.showNotification) {
            await reg.showNotification(`Ligeirinho · ${title}`, opts);
            return;
        }
        // eslint-disable-next-line no-new
        new Notification(`Ligeirinho · ${title}`, opts);
    }

    /** Notificação de sistema (cascata) para itens do hub/app. */
    async function showSystemNotification({ id, title, body, url }) {
        if (!supported() || Notification.permission !== 'granted') return false;
        const reg = await navigator.serviceWorker.getRegistration('/');
        const opts = {
            body: body || '',
            icon: '/img/app-icon-light-192.png',
            badge: '/img/app-icon-light-192.png',
            tag: `parceiros-${id || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            renotify: true,
            data: { url: url || '/meus-pedidos' },
        };
        if (reg?.showNotification) {
            await reg.showNotification(title || 'Ligeirinho Parceiros', opts);
            return true;
        }
        // eslint-disable-next-line no-new
        new Notification(title || 'Ligeirinho Parceiros', opts);
        return true;
    }

    window.LigeirinhoPush = {
        supported,
        enableOrderStatusPush,
        ensureSubscribed,
        showLocalOrderStatus,
        showSystemNotification,
        permission: () => (supported() ? Notification.permission : 'unsupported'),
    };
})();
