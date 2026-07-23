(function () {
    const API_URL = '/api/catalog';
    const FALLBACK_URL = '/data/catalogo.json';
    const CLIENT_TTL_MS = 5 * 60 * 1000;
    const STORAGE_KEY = 'ligeirinho-catalog-cache-v2';

    let cache = null;
    let cacheAt = 0;
    let inflight = null;
    let lastApiUrl = API_URL;

    const readStorageCache = (apiUrl) => {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.data?.categories?.length) return null;
            if (parsed.apiUrl && parsed.apiUrl !== apiUrl) return null;
            if (Date.now() - parsed.savedAt > CLIENT_TTL_MS) return null;
            return parsed.data;
        } catch {
            return null;
        }
    };

    const writeStorageCache = (data, apiUrl) => {
        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    savedAt: Date.now(),
                    exportedAt: data?.exportedAt || '',
                    apiUrl,
                    data,
                })
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

    const load = async (options = {}) => {
        const force = Boolean(options.force);
        const apiUrl = String(options.apiUrl || API_URL);
        const now = Date.now();

        if (!force && cache && lastApiUrl === apiUrl && now - cacheAt < CLIENT_TTL_MS) {
            return cache;
        }

        if (!force && inflight && lastApiUrl === apiUrl) {
            return inflight;
        }

        if (!force) {
            const stored = readStorageCache(apiUrl);
            if (stored) {
                cache = stored;
                cacheAt = Date.now();
                lastApiUrl = apiUrl;
                return stored;
            }
        }

        lastApiUrl = apiUrl;
        inflight = (async () => {
            const fetchUrl = buildFetchUrl(apiUrl, force);
            try {
                const res = await fetch(fetchUrl, {
                    credentials: 'same-origin',
                    cache: force ? 'no-store' : 'default',
                    headers: force ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : undefined,
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.categories?.length) {
                        cache = data;
                        cacheAt = Date.now();
                        writeStorageCache(data, apiUrl);
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

            const fallback = await fetch(FALLBACK_URL, { credentials: 'same-origin', cache: 'no-store' });
            if (!fallback.ok) throw new Error('Catálogo indisponível');
            const data = await fallback.json();
            cache = data;
            cacheAt = Date.now();
            writeStorageCache(data, apiUrl);
            return data;
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
        lastApiUrl = API_URL;
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch {
            /* quota or private mode */
        }
    };

    window.LigeirinhoCatalogLoader = { load, clear };
})();
