(function () {
    const API_URL = '/api/catalog';
    const API_ME_URL = '/api/catalog/me';
    const FALLBACK_URL = '/data/catalogo.json';
    const CLIENT_TTL_MS = 5 * 60 * 1000;
    const STORAGE_KEY = 'ligeirinho-catalog-cache-v3';

    let cache = null;
    let cacheAt = 0;
    let inflight = null;
    let lastScope = 'public';

    const apiScopePart = (apiUrl = '') =>
        String(apiUrl || '')
            .replace(/\?.*$/, '')
            .replace(/\/+$/, '') || 'default';

    const buildScope = (personalized, data, apiUrl = '') => {
        const apiPart = apiScopePart(apiUrl);
        if (!personalized) return `public:${apiPart}`;
        const tableKey = data?.priceTableId || data?.priceTableCodigo || 'custom';
        const auth = window.LigeirinhoAuth;
        const session = auth?.loadSession?.();
        const userKey = session?.hubUserId || session?.sub || 'user';
        return `me:${userKey}:${tableKey}:${apiPart}`;
    };

    const resolveEndpoint = (options = {}) => {
        if (options.apiUrl) {
            return {
                url: options.apiUrl,
                personalized: options.apiUrl.includes('/catalog/me'),
            };
        }
        const auth = window.LigeirinhoAuth;
        const session = auth?.loadSession?.();
        if (
            auth?.isLoggedIn?.() &&
            (session?.hubUserId || session?.provider === 'hub' || session?.provider === 'google')
        ) {
            return { url: API_ME_URL, personalized: true };
        }
        return { url: API_URL, personalized: false };
    };

    const readStorageCache = (scope) => {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.data?.categories?.length) return null;
            if (parsed.scope !== scope) return null;
            if (Date.now() - parsed.savedAt > CLIENT_TTL_MS) return null;
            return parsed.data;
        } catch {
            return null;
        }
    };

    const writeStorageCache = (data, scope) => {
        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    savedAt: Date.now(),
                    exportedAt: data?.exportedAt || '',
                    scope,
                    data,
                }),
            );
        } catch {
            /* quota or private mode */
        }
    };

    const buildFetchUrl = (apiUrl, force) => {
        if (!force) return apiUrl;
        const sep = apiUrl.includes('?') ? '&' : '?';
        return `${apiUrl}${sep}sync=${Date.now()}`;
    };

    const buildFetchOptions = async (personalized, force) => {
        const opts = {
            credentials: 'same-origin',
            cache: force ? 'no-store' : 'default',
            headers: force ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {},
        };
        if (personalized) {
            const authHeaders = await window.LigeirinhoAuth?.buildAccountHeaders?.();
            if (authHeaders) {
                opts.headers = { ...opts.headers, ...authHeaders };
            }
        }
        return opts;
    };

    const loadPublicFallback = async (apiUrl, scope) => {
        const fallback = await fetch(FALLBACK_URL, { credentials: 'same-origin', cache: 'no-store' });
        if (!fallback.ok) throw new Error('Catálogo indisponível');
        const data = await fallback.json();
        cache = data;
        cacheAt = Date.now();
        lastScope = scope;
        writeStorageCache(data, scope);
        return data;
    };

    const load = async (options = {}) => {
        const force = Boolean(options.force);
        const endpoint = resolveEndpoint(options);
        const apiUrl = endpoint.url;
        const publicScope = `public:${apiScopePart(apiUrl)}`;
        let scope = endpoint.personalized ? 'me-pending' : publicScope;
        const now = Date.now();

        if (!force && cache && lastScope === scope && scope !== 'me-pending' && now - cacheAt < CLIENT_TTL_MS) {
            return cache;
        }

        if (!force && inflight && lastScope === scope) {
            return inflight;
        }

        if (!force && !endpoint.personalized) {
            const stored = readStorageCache(publicScope);
            if (stored) {
                cache = stored;
                cacheAt = Date.now();
                lastScope = publicScope;
                return stored;
            }
        }

        lastScope = scope;
        inflight = (async () => {
            const fetchUrl = buildFetchUrl(apiUrl, force);
            const fetchOpts = await buildFetchOptions(endpoint.personalized, force);
            try {
                const res = await fetch(fetchUrl, fetchOpts);
                if (endpoint.personalized && res.status === 204) {
                    window.LigeirinhoAuth?.patchSession?.({
                        usesPersonalPriceTable: false,
                        tabelaPrecoId: '',
                        tabelaPreco: 'padrao',
                    });
                    return load({ ...options, force, apiUrl: API_URL });
                }
                if (endpoint.personalized && res.status === 401) {
                    return load({ ...options, force, apiUrl: API_URL });
                }
                if (res.ok) {
                    const data = await res.json();
                    if (data?.categories?.length) {
                        scope = buildScope(endpoint.personalized, data, apiUrl);
                        cache = data;
                        cacheAt = Date.now();
                        lastScope = scope;
                        writeStorageCache(data, scope);
                        const authSession = window.LigeirinhoAuth?.loadSession?.();
                        if (endpoint.personalized && authSession) {
                            window.LigeirinhoAuth?.patchSession?.({
                                usesPersonalPriceTable: true,
                                tabelaPrecoId: data.priceTableId || '',
                                tabelaPreco: data.priceTableCodigo || '',
                            });
                        }
                        return data;
                    }
                    if (force) {
                        throw new Error(data?.error || 'Catálogo vazio ou indisponível.');
                    }
                } else if (force) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || `Catálogo indisponível (HTTP ${res.status}).`);
                }
            } catch (err) {
                if (force) {
                    throw err instanceof Error ? err : new Error('Catálogo indisponível.');
                }
                /* offline ou servidor estático local */
            }

            if (endpoint.personalized && apiUrl !== API_URL) {
                return load({ ...options, force, apiUrl: API_URL });
            }

            return loadPublicFallback(apiUrl, publicScope);
        })();

        try {
            return await inflight;
        } finally {
            inflight = null;
        }
    };

    const clear = () => {
        cache = null;
        cacheAt = 0;
        inflight = null;
        lastScope = 'public';
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* quota or private mode */
        }
    };

    window.addEventListener('ligeirinho-auth-changed', clear);

    window.LigeirinhoCatalogLoader = { load, clear, resolveEndpoint };
})();
