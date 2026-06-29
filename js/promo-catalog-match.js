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

    const resolveDisplayItem = (promo, displayItems = []) => {
        const sku = normalizeSku(promo.sku);
        const catalogId = String(promo.catalogProductId || '').trim().toLowerCase();
        const promoName = normalizeName(promo.name || promo.hubProductName);

        for (const item of displayItems) {
            const group = item.group || null;
            const product = item.product;

            if (catalogId) {
                if (product.id === catalogId || group?.primaryId === catalogId) return item;
                if (group?.variants) {
                    for (const variant of Object.values(group.variants)) {
                        if (variant?.id === catalogId) return item;
                    }
                }
            }

            if (sku) {
                if (productSku(product) === sku) return item;
                if (group?.variants) {
                    for (const variant of Object.values(group.variants)) {
                        if (productSku(variant) === sku) return item;
                    }
                }
                if (product.id === sku || product.id.includes(sku)) return item;
            }

            const base = normalizeName(group?.baseName || product.name);
            if (promoName && base && (base === promoName || base.includes(promoName) || promoName.includes(base))) {
                return item;
            }
        }
        return null;
    };

    const buildPromoEntries = (promocoes, displayItems, { matchedOnly = false } = {}) => {
        const entries = (promocoes || []).map((promo) => ({
            promo,
            item: resolveDisplayItem(promo, displayItems),
        }));
        const filtered = matchedOnly ? entries.filter((e) => e.item) : entries;
        return filtered.sort((a, b) => {
            const aMatch = a.item ? 1 : 0;
            const bMatch = b.item ? 1 : 0;
            if (bMatch !== aMatch) return bMatch - aMatch;
            return (b.promo.discountPct || 0) - (a.promo.discountPct || 0);
        });
    };

    const formatValidade = (promo) => {
        if (!promo?.validTo) return '';
        try {
            const d = new Date(`${promo.validTo}T12:00:00`);
            return `Até ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
        } catch {
            return '';
        }
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
                const res = await fetch(apiUrl, { credentials: 'same-origin' });
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
