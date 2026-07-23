const CARTAO_IDS = new Set(['cartao', 'cartao_debito', 'cartao_credito', 'credit', 'debit', 'credito', 'debito']);

export function itemEhPromocionalTotem(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.promoId || item.isPromo) return true;
    const discount = Number(item.discountPct ?? item.discount_pct);
    if (Number.isFinite(discount) && discount > 0) return true;
    const original = Number(item.originalPrice ?? item.original_price);
    const price = Number(item.price);
    return Number.isFinite(original) && Number.isFinite(price) && original > price + 0.009;
}

export function pedidoTemItemPromocionalTotem(order) {
    const items = order?.items;
    if (!Array.isArray(items) || !items.length) return false;
    return items.some(itemEhPromocionalTotem);
}

export function pagamentoTotemUsaCartao(method, paymentSplits) {
    if (Array.isArray(paymentSplits) && paymentSplits.length) {
        return paymentSplits.some((entry) => CARTAO_IDS.has(String(entry?.method || entry?.id || '').toLowerCase().trim()));
    }
    const raw = String(method || '').toLowerCase();
    if (!raw) return false;
    return raw.split('+').some((part) => CARTAO_IDS.has(part.trim()));
}

export function validarPagamentoTotemSemCartaoComPromo(order, method, paymentSplits) {
    if (!pedidoTemItemPromocionalTotem(order)) return { ok: true };
    if (!pagamentoTotemUsaCartao(method, paymentSplits)) return { ok: true };
    return {
        ok: false,
        error: 'Pedidos com promoção não aceitam cartão de crédito ou débito. Use Pix ou dinheiro.',
    };
}
