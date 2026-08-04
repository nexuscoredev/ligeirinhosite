(function () {
    /** @type {Map<string, number>} */
    let orderTablePriceLookup = new Map();
    let orderTablePriceLookupId = '';
    /** @type {Map<string, number>} */
    let editOrderPriceSnapshot = new Map();

    const priceFromLookup = (lookup, line) => {
        if (!lookup?.size || !line) return null;
        return (
            resolveCartItemCatalogPrice(line, lookup) ??
            (() => {
                for (const k of [line.cartKey, line.key, line.id, line.hubId]) {
                    if (!k) continue;
                    const v = lookup.get(String(k));
                    if (v != null && Number.isFinite(v) && v > 0) return v;
                }
                return null;
            })()
        );
    };

    const buildCatalogPriceLookup = (catalog) => {
        const map = new Map();
        const pricing = window.LigeirinhoPricing;
        if (pricing?.buildGroups && catalog?.categories?.length) {
            const groups = pricing.buildGroups(catalog);
            for (const group of groups.values()) {
                for (const tier of ['unidade', 'caixa', 'pallet']) {
                    const variant = pricing.getVariant(group, tier);
                    if (!variant?.id) continue;
                    const price = Number(variant.price);
                    if (!Number.isFinite(price) || price <= 0) continue;
                    const cartKey = tier === 'unidade' ? String(variant.id) : `${variant.id}::${tier}`;
                    map.set(cartKey, price);
                    map.set(`${variant.id}::${tier}`, price);
                    if (variant.hubId) map.set(`${variant.hubId}::${tier}`, price);
                    if (tier === 'unidade') {
                        map.set(String(variant.id), price);
                        if (variant.hubId) map.set(String(variant.hubId), price);
                    }
                }
            }
            return map;
        }
        for (const cat of catalog?.categories || []) {
            for (const product of cat.products || []) {
                if (product.id) map.set(String(product.id), Number(product.price));
                if (product.hubId) map.set(String(product.hubId), Number(product.price));
            }
        }
        return map;
    };

    const resolveCartItemCatalogPrice = (item, lookup) => {
        if (!lookup?.size || !item) return null;
        const packType = String(item.packType || 'caixa').toLowerCase();
        const keys = [
            item.cartKey,
            item.key,
            `${item.id}::${packType}`,
            item.hubId ? `${item.hubId}::${packType}` : '',
            packType === 'unidade' ? item.id : '',
            packType === 'unidade' ? item.hubId : '',
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);
        for (const key of keys) {
            const price = lookup.get(key);
            if (price != null && Number.isFinite(price) && price > 0) return price;
        }
        return null;
    };

    const setOrderTablePriceLookup = (tabelaPrecoId, catalog) => {
        const id = String(tabelaPrecoId || '').trim();
        if (!id) {
            orderTablePriceLookup = new Map();
            orderTablePriceLookupId = '';
            return;
        }
        orderTablePriceLookupId = id;
        orderTablePriceLookup = buildCatalogPriceLookup(catalog);
    };

    const clearOrderTablePriceLookup = () => {
        orderTablePriceLookup = new Map();
        orderTablePriceLookupId = '';
    };

    const snapshotEditOrderPrices = (cart) => {
        editOrderPriceSnapshot = new Map();
        const entries = Object.values(cart || {}).filter((item) => item?.qty > 0);
        for (const item of entries) {
            const key = String(item.cartKey || item.id || '');
            if (!key) continue;
            editOrderPriceSnapshot.set(key, Number(item.price));
            if (item.id) editOrderPriceSnapshot.set(String(item.id), Number(item.price));
            if (item.hubId) editOrderPriceSnapshot.set(String(item.hubId), Number(item.price));
        }
    };

    const clearEditOrderPriceSnapshot = () => {
        editOrderPriceSnapshot = new Map();
    };

    const resolveAddToCartPrice = (line) => {
        const cartApi = window.LigeirinhoCart;
        const catalogPrice = Number(line?.price);
        const checkout = cartApi?.loadCheckout?.() || {};
        const editing = cartApi?.isEditingOrder?.() ?? false;

        if (editing && editOrderPriceSnapshot.size) {
            const snap = priceFromLookup(editOrderPriceSnapshot, line);
            if (snap != null) return snap;
        }

        const tableId = String(checkout.orderTabelaPrecoId || '').trim();
        if (tableId && orderTablePriceLookupId === tableId && orderTablePriceLookup.size) {
            const tablePrice = priceFromLookup(orderTablePriceLookup, line);
            if (tablePrice != null) return tablePrice;
        }

        return catalogPrice;
    };

    const shouldLockPriceOnAdd = () => {
        return Boolean(window.LigeirinhoCart?.isEditingOrder?.());
    };

    window.LigeirinhoCartPrice = {
        buildCatalogPriceLookup,
        resolveCartItemCatalogPrice,
        setOrderTablePriceLookup,
        clearOrderTablePriceLookup,
        snapshotEditOrderPrices,
        clearEditOrderPriceSnapshot,
        resolveAddToCartPrice,
        shouldLockPriceOnAdd,
    };
})();
