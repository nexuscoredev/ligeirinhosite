/**
 * Lógica compartilhada: preço ao adicionar/re-adicionar item no caminhão.
 * Espelha js/cart-price-context.js — manter sincronizado.
 */

/** @param {Map<string, number>} lookup @param {{ id?: string, hubId?: string, cartKey?: string, key?: string }} line */
export function priceFromLookup(lookup, line) {
    if (!lookup?.size || !line) return null;
    for (const k of [line.id, line.hubId, line.cartKey, line.key]) {
        if (!k) continue;
        const v = lookup.get(String(k));
        if (v != null && Number.isFinite(v) && v > 0) return v;
    }
    return null;
}

export function buildCatalogPriceLookup(catalog) {
    const map = new Map();
    for (const cat of catalog?.categories || []) {
        for (const product of cat.products || []) {
            if (product.id) map.set(String(product.id), Number(product.price));
            if (product.hubId) map.set(String(product.hubId), Number(product.price));
        }
    }
    return map;
}

/**
 * @param {object} line
 * @param {{ editing?: boolean, orderTabelaPrecoId?: string, tablePriceLookup?: Map|null, tablePriceLookupId?: string, editPriceSnapshot?: Map|null }} ctx
 */
export function resolveAddToCartPrice(line, ctx = {}) {
    const catalogPrice = Number(line?.price);

    if (ctx.editing && ctx.editPriceSnapshot) {
        const snap = priceFromLookup(ctx.editPriceSnapshot, line);
        if (snap != null) return snap;
    }

    const tableId = String(ctx.orderTabelaPrecoId || '').trim();
    if (tableId && ctx.tablePriceLookupId === tableId && ctx.tablePriceLookup) {
        const tablePrice = priceFromLookup(ctx.tablePriceLookup, line);
        if (tablePrice != null) return tablePrice;
    }

    return catalogPrice;
}

export function shouldLockPriceOnAdd({ editing = false } = {}) {
    return Boolean(editing);
}

/** Espelha addProduct em pedidos.js / home.js */
export function simulateAddProduct(cart, line, ctx) {
    const existing = cart[line.key];
    const price = resolveAddToCartPrice(line, ctx);
    const lock = shouldLockPriceOnAdd(ctx);

    if (!existing) {
        cart[line.key] = {
            ...line,
            price,
            qty: 0,
            ...(lock ? { priceLocked: true } : {}),
        };
    } else if (!ctx.editing && !existing.priceLocked) {
        cart[line.key].price = price;
    }
    cart[line.key].qty += 1;
    return {
        price: cart[line.key].price,
        priceLocked: Boolean(cart[line.key].priceLocked),
    };
}

export function simulateRemoveProduct(cart, key) {
    if (!cart[key]) return;
    cart[key].qty -= 1;
    if (cart[key].qty <= 0) delete cart[key];
}

export function simulateApplyOrderPriceTable(cart, lookup, { unlockPrices = false } = {}) {
    for (const key of Object.keys(cart)) {
        const item = cart[key];
        if (!item || item.isDeliveryFee) continue;
        if (item.priceLocked && !unlockPrices) continue;
        const next = priceFromLookup(lookup, item);
        if (next != null && Number.isFinite(next) && next > 0) {
            cart[key] = {
                ...item,
                price: next,
                ...(unlockPrices ? { priceLocked: false } : {}),
            };
        }
    }
}
