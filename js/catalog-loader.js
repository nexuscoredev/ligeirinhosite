(function () {
    const API_URL = '/api/catalog';
    const FALLBACK_URL = '/data/catalogo.json';
    const CLIENT_TTL_MS = 5 * 60 * 1000;
    const STORAGE_KEY = 'ligeirinho-catalog-cache-v1';

    let cache = null;
    let cacheAt = 0;
    let inflight = null;

    const readStorageCache = () => {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.data?.categories?.length) return null;
            if (Date.now() - parsed.savedAt > CLIENT_TTL_MS) return null;
            return parsed.data;
        } catch {
            return null;
        }
    };

    const writeStorageCache = (data) => {
        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    savedAt: Date.now(),
                    exportedAt: data?.exportedAt || '',
                    data,
                })
            );
        } catch {
            /* quota or private mode */
        }
    };

    const load = async (options = {}) => {
        const force = Boolean(options.force);
        const now = Date.now();

        if (!force && cache && now - cacheAt < CLIENT_TTL_MS) {
            return cache;
        }

        if (!force && inflight) {
            return inflight;
        }

        if (!force) {
            const stored = readStorageCache();
            if (stored) {
                cache = stored;
                cacheAt = Date.now();
                return stored;
            }
        }

        inflight = (async () => {
            try {
                const res = await fetch(API_URL, { credentials: 'same-origin' });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.categories?.length) {
                        cache = data;
                        cacheAt = Date.now();
                        writeStorageCache(data);
                        return data;
                    }
                }
            } catch {
                /* offline ou servidor estático local */
            }

            const fallback = await fetch(FALLBACK_URL, { credentials: 'same-origin' });
            if (!fallback.ok) throw new Error('Catálogo indisponível');
            const data = await fallback.json();
            cache = data;
            cacheAt = Date.now();
            writeStorageCache(data);
            return data;
        })();

        try {
            return await inflight;
        } finally {
            inflight = null;
        }
    };

    window.LigeirinhoCatalogLoader = { load };
})();
