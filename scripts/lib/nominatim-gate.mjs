/**
 * Fila + intervalo mínimo para Nominatim (~1 req/s) e cache curto de respostas iguais.
 * Protege contra ban/429 quando muitos parceiros abrem o seletor de endereço juntos.
 */

const MIN_GAP_MS = Number(process.env.NOMINATIM_MIN_GAP_MS || 1100);
const CACHE_TTL_MS = Number(process.env.NOMINATIM_CACHE_MS || 90_000);
const MAX_CACHE = 240;

let lastAt = 0;
let chain = Promise.resolve();
const resultCache = new Map();

function pruneCache() {
    while (resultCache.size > MAX_CACHE) {
        const first = resultCache.keys().next().value;
        resultCache.delete(first);
    }
}

/**
 * @template T
 * @param {string} cacheKey
 * @param {() => Promise<T>} fetchFn
 * @returns {Promise<T>}
 */
export function gatedNominatim(cacheKey, fetchFn) {
    const cached = resultCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return Promise.resolve(cached.data);
    }

    const run = chain.then(async () => {
        const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastAt));
        if (wait) await new Promise((r) => setTimeout(r, wait));
        lastAt = Date.now();
        const data = await fetchFn();
        resultCache.set(cacheKey, { at: Date.now(), data });
        pruneCache();
        return data;
    });

    chain = run.then(
        () => undefined,
        () => undefined,
    );
    return run;
}
