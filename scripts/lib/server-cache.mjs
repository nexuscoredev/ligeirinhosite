/**
 * Cache em memória + singleflight para instâncias serverless quentes.
 * Evita N rebuilds do Hub quando muitos usuários batem o mesmo endpoint ao mesmo tempo.
 * Cada instância tem o próprio Map — o CDN (s-maxage) cobre o resto entre usuários/regiões.
 */

const stores = new Map();

/**
 * @template T
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<T>} compute
 * @param {{ staleMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export function getCachedOrCompute(key, ttlMs, compute, opts = {}) {
    const staleMs = Number.isFinite(opts.staleMs) ? opts.staleMs : ttlMs * 3;
    const now = Date.now();
    const entry = stores.get(key);

    if (entry?.value != null && entry.expiresAt > now) {
        return Promise.resolve(entry.value);
    }

    const softOk = entry?.value != null && entry.expiresAt + staleMs > now;

    if (entry?.inflight) {
        return softOk ? Promise.resolve(entry.value) : entry.inflight;
    }

    const inflight = Promise.resolve()
        .then(compute)
        .then((value) => {
            stores.set(key, {
                value,
                expiresAt: Date.now() + ttlMs,
                inflight: null,
            });
            return value;
        })
        .catch((err) => {
            const cur = stores.get(key);
            if (cur?.inflight === inflight) {
                if (cur.value != null) {
                    stores.set(key, {
                        value: cur.value,
                        expiresAt: cur.expiresAt,
                        inflight: null,
                    });
                } else {
                    stores.delete(key);
                }
            }
            throw err;
        });

    stores.set(key, {
        value: entry?.value ?? null,
        expiresAt: entry?.expiresAt ?? 0,
        inflight,
    });

    if (softOk) return Promise.resolve(entry.value);
    return inflight;
}

export function invalidateCache(key) {
    stores.delete(key);
}
