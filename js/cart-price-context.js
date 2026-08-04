(function () {
    /** @type {Map<string, number>} */
    let orderTablePriceLookup = new Map();
    let orderTablePriceLookupId = '';
    /** @type {Map<string, number>} */
    let editOrderPriceSnapshot = new Map();

    const priceFromLookup = (lookup, line) => {
        if (!lookup?.size || !line) return null;
        for (const k of [line.id, line.hubId, line.cartKey, line.key]) {
            if (!k) continue;
            const v = lookup.get(String(k));
            if (v != null && Number.isFinite(v) && v > 0) return v;
        }
        return null;
    };

    const buildCatalogPriceLookup = (catalog) => {
        const map = new Map();
        for (const cat of catalog?.categories || []) {
            for (const product of cat.products || []) {
                if (product.id) map.set(String(product.id), Number(product.price));
                if (product.hubId) map.set(String(product.hubId), Number(product.price));
            }
        }
        return map;
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
        setOrderTablePriceLookup,
        clearOrderTablePriceLookup,
        snapshotEditOrderPrices,
        clearEditOrderPriceSnapshot,
        resolveAddToCartPrice,
        shouldLockPriceOnAdd,
    };
})();
