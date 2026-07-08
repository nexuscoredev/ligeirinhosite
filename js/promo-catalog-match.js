(function () {
    const CACHE_MS = 60_000;

    const normalizeName = (value) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+C\/\d+\s*$/i, '')
            .replace(/\s+CX\s*$/i, '')
            .replace(/^CAIXA\s+/i, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();

    const normalizeSku = (value) => String(value || '').trim().toLowerCase();

    const productSku = (product) => normalizeSku(product?.sku);

    const isIndefinidoSku = (sku) => !sku || sku === 'indefinido';

    const preferVarejoItem = (hits = []) => {
        if (hits.length <= 1) return hits[0] || null;
        const unHit = hits.find((item) => /\bUN\b/i.test(item.product?.name || ''));
        if (unHit) return unHit;
        const nonCxHit = hits.find((item) => !/\bC\/\d+\b/i.test(item.product?.name || '') && !/\bCX\b/i.test(item.product?.name || ''));
        if (nonCxHit) return nonCxHit;
        return hits[0];
    };

    const resolveDisplayItem = (promo, catalogItems = []) => {
        const hubProductId = String(promo.hubProductId || promo.produtoId || '').trim();
        const sku = normalizeSku(promo.sku);
        const catalogId = String(promo.catalogProductId || '').trim().toLowerCase();
        const promoName = normalizeName(promo.name || promo.hubProductName);

        if (hubProductId) {
            const hit = catalogItems.find((item) => String(item.product?.hubId || '').trim() === hubProductId);
            if (hit) return hit;
        }

        if (!isIndefinidoSku(sku)) {
            const skuHits = catalogItems.filter((item) => productSku(item.product) === sku);
            const hit = preferVarejoItem(skuHits);
            if (hit) return hit;
        }

        if (catalogId) {
            const hit = catalogItems.find((item) => String(item.product?.id || '').toLowerCase() === catalogId);
            if (hit) return hit;

            for (const item of catalogItems) {
                const group = item.group || null;
                const product = item.product;
                if (!group) continue;
                if (group.primaryId === catalogId) return item;
                if (group.variants) {
                    for (const variant of Object.values(group.variants)) {
                        if (variant?.id === catalogId) return item;
                    }
                }
                if (product?.id === catalogId) return item;
            }
        }

        if (promoName) {
            const exactHits = catalogItems.filter((item) => normalizeName(item.product?.name) === promoName);
            const hit = preferVarejoItem(exactHits);
            if (hit) return hit;
        }

        return null;
    };

    const buildPromoEntries = (promocoes, catalogItems, { matchedOnly = false } = {}) => {
        const entries = (promocoes || []).map((promo, index) => ({
            promo,
            item: resolveDisplayItem(promo, catalogItems),
            hubIndex: index,
        }));
        const filtered = matchedOnly ? entries.filter((e) => e.item) : entries;
        return filtered.sort((a, b) => a.hubIndex - b.hubIndex);
    };

    const formatValidade = (promo) => {
        const iso = String(promo?.validTo || '').slice(0, 10);
        if (!iso) return 'Oferta por tempo limitado';
        const parts = iso.split('-').map(Number);
        const y = parts[0];
        const m = parts[1];
        const d = parts[2];
        if (!y || !m || !d) return 'Oferta por tempo limitado';
        const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        return `Até ${d} de ${meses[m - 1]}.`;
    };

    const createHubPromoLoader = (apiUrl = '/api/promocoes') => {
        let hubPromos = [];
        let promosLoadedAt = 0;
        let fetchError = false;

        const load = async (force = false) => {
            const now = Date.now();
            if (!force && hubPromos.length && now - promosLoadedAt < CACHE_MS) {
                fetchError = false;
                return hubPromos;
            }
            try {
                const fetchUrl = force
                    ? `${apiUrl}${apiUrl.includes('?') ? '&' : '?'}sync=${Date.now()}`
                    : apiUrl;
                const res = await fetch(fetchUrl, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: force ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : undefined,
                });
                if (!res.ok) throw new Error('fetch failed');
                const data = await res.json();
                hubPromos = Array.isArray(data?.promocoes) ? data.promocoes : [];
                promosLoadedAt = now;
                fetchError = false;
            } catch {
                fetchError = true;
                if (!hubPromos.length) hubPromos = [];
            }
            return hubPromos;
        };

        return {
            load,
            hadError: () => fetchError,
            clear: () => {
                hubPromos = [];
                promosLoadedAt = 0;
                fetchError = false;
            },
        };
    };

    window.LigeirinhoPromoCatalog = {
        CACHE_MS,
        normalizeName,
        normalizeSku,
        productSku,
        resolveDisplayItem,
        buildPromoEntries,
        formatValidade,
        createHubPromoLoader,
    };
})();
