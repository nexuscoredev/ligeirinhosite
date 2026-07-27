(function () {
    const auth = window.LigeirinhoAuth;
    const cart = window.LigeirinhoCart;
    const CACHE_KEY = 'lig-has-orders-v2';
    const CACHE_TTL_MS = 5 * 60 * 1000;

    const readCache = () => {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.at > CACHE_TTL_MS) return null;
            return Boolean(data.has);
        } catch {
            return null;
        }
    };

    const writeCache = (has) => {
        try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ has: Boolean(has), at: Date.now() }));
        } catch {
            /* ignore */
        }
    };

    const clearCache = () => {
        try {
            sessionStorage.removeItem(CACHE_KEY);
        } catch {
            /* ignore */
        }
    };

    const session = () => auth?.loadSession?.() || null;

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

        throw new Error('Sessão expirada.');
    };

    const fetchHasOrders = async () => {
        const s = session();
        if (!s?.sub && !s?.email && !auth?.getAccountSessionToken?.()) return false;

        try {
            const headers = await accountHeaders();
            if (s?.sub) headers['X-Auth-Sub'] = s.sub;
            if (s?.email) headers['X-Account-Email'] = s.email;
            const res = await fetch('/api/orders/mine?limit=1', { headers });
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(data.orders)) {
                const has = data.orders.length > 0;
                writeCache(has);
                return has;
            }
        } catch {
            /* ignore */
        }

        const lastLocal = cart?.loadLastOrder?.();
        if (lastLocal?.orderId) {
            try {
                const res = await fetch(`/api/orders/get?id=${encodeURIComponent(lastLocal.orderId)}`);
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.order) {
                    writeCache(true);
                    return true;
                }
            } catch {
                /* ignore */
            }
        }

        writeCache(false);
        return false;
    };

    let pending = null;

    const hasOrders = () => {
        const cached = readCache();
        if (cached !== null) return Promise.resolve(cached);
        if (!pending) {
            pending = fetchHasOrders().finally(() => {
                pending = null;
            });
        }
        return pending;
    };

    window.LigeirinhoOrdersAccess = {
        hasOrders,
        fetchHasOrders,
        clearCache,
        redirectContaIfEmpty: async () => false,
    };

    window.addEventListener('ligeirinho-auth-changed', clearCache);
    window.addEventListener('ligeirinho-cart-changed', clearCache);
})();
