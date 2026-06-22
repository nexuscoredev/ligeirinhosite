/** Prefixo do código de pedido totem — evita conflito com SKU/EAN no PDV. */
export const TOTEM_PEDIDO_PREFIX = 'PED';

function stripPrefix(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!s.startsWith(TOTEM_PEDIDO_PREFIX)) return s;
    return s.slice(TOTEM_PEDIDO_PREFIX.length).replace(/^[\s\-:.]*/, '');
}

/** Extrai os 8 primeiros hex do UUID (com ou sem prefixo PED). */
export function normalizeTotemCode(raw) {
    const hex = stripPrefix(raw)
        .replace(/[^a-fA-F0-9]/g, '')
        .toLowerCase();
    if (hex.length < 8) return '';
    return hex.slice(0, 8);
}

/** Exibição: PED 4 F 4 F 9 2 3 6 */
export function formatTotemCode(orderId) {
    const hex = String(orderId || '')
        .replace(/[^a-fA-F0-9]/gi, '')
        .slice(0, 8)
        .toUpperCase();
    return `${TOTEM_PEDIDO_PREFIX} ${hex.split('').join(' ')}`;
}

/** Campo de leitor do PDV: só pedido totem se começar com PED. */
export function isTotemOrderCodeScannerInput(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!s.startsWith(TOTEM_PEDIDO_PREFIX)) return false;
    return normalizeTotemCode(raw).length === 8;
}

export function parseTotemOrderCode(raw) {
    const code = normalizeTotemCode(raw);
    return code.length === 8 ? code : null;
}
