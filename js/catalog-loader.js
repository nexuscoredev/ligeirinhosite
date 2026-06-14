(function () {
    const API_URL = '/api/catalog';
    const FALLBACK_URL = '/data/catalogo.json';
    const CLIENT_TTL_MS = 5 * 60 * 1000;

    let cache = null;
    let cacheAt = 0;
    let inflight = null;

    const load = async (options = {}) => {
        const force = Boolean(options.force);
        const now = Date.now();

        if (!force && cache && now - cacheAt < CLIENT_TTL_MS) {
            return cache;
        }

        if (!force && inflight) {
            return inflight;
        }

        inflight = (async () => {
            try {
                const res = await fetch(API_URL, { credentials: 'same-origin' });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.categories?.length) {
                        cache = data;
                        cacheAt = Date.now();
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
