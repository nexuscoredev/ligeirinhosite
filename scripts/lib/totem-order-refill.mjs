import {
    formatTotemCode,
    lookupTotemOrderByCode,
    normalizeTotemCode,
} from '../hub-totem-pedido.mjs';

export { parseTotemOrderCode } from '../totem-order-code.mjs';

/** Resposta enxuta para montar carrinho — sem dados do cliente nem vínculo ao pedido anterior. */
export function publicTotemRefillView(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const mapped = items
        .map((item) => {
            const cartKey = String(item.cartKey || item.id || '').trim();
            const id = String(item.id || cartKey).trim();
            if (!cartKey && !id) return null;
            const payCard = String(cartKey).endsWith('::pay-card') || item.payMode === 'card';
            return {
                id: id || cartKey,
                cartKey: cartKey || id,
                name: String(item.name || 'Item').slice(0, 200),
                qty: Math.max(1, Math.min(99, Number(item.qty) || 1)),
                packType: String(item.packType || 'caixa').toLowerCase(),
                payMode: payCard ? 'card' : 'pix',
                promoId: item.promoId ? String(item.promoId) : null,
            };
        })
        .filter(Boolean);

    const itemCount = mapped.reduce((sum, item) => sum + item.qty, 0);

    return {
        code: formatTotemCode(order.id),
        codeRaw: normalizeTotemCode(order.id).toUpperCase(),
        itemCount,
        lineCount: mapped.length,
        items: mapped,
        createdAt: order.created_at || null,
    };
}

export async function lookupTotemOrderForRefill(parceirosUrl, parceirosKey, code) {
    const order = await lookupTotemOrderByCode(parceirosUrl, parceirosKey, code);
    if (!order?.id) {
        const err = new Error('Pedido não encontrado.');
        err.status = 404;
        throw err;
    }
    if (String(order.channel || '').toLowerCase() !== 'totem') {
        const err = new Error('Este código não pertence a um pedido do Totem.');
        err.status = 404;
        throw err;
    }
    return publicTotemRefillView(order);
}
