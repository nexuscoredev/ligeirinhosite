/** Prefixo do código de pedido totem — evita conflito com SKU/EAN no PDV. */
export const TOTEM_PEDIDO_PREFIX = 'PED';

/** Quantidade de caracteres hex exibidos no comprovante (PED XXXX). */
export const TOTEM_CODE_HEX_LENGTH = 4;

function stripPrefix(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!s.startsWith(TOTEM_PEDIDO_PREFIX)) return s;
    return s.slice(TOTEM_PEDIDO_PREFIX.length).replace(/^[\s\-:.]*/, '');
}

/** Extrai os primeiros hex do UUID (com ou sem prefixo PED). */
export function normalizeTotemCode(raw) {
    const hex = stripPrefix(raw)
        .replace(/[^a-fA-F0-9]/g, '')
        .toLowerCase();
    if (hex.length < TOTEM_CODE_HEX_LENGTH) return '';
    return hex.slice(0, TOTEM_CODE_HEX_LENGTH);
}

/** Exibição: PED 4 F 4 F */
export function formatTotemCode(orderId) {
    const hex = String(orderId || '')
        .replace(/[^a-fA-F0-9]/gi, '')
        .slice(0, TOTEM_CODE_HEX_LENGTH)
        .toUpperCase();
    return `${TOTEM_PEDIDO_PREFIX} ${hex.split('').join(' ')}`;
}

/** Compacto: PED 4F4F */
export function compactTotemCode(orderId) {
    const hex = String(orderId || '')
        .replace(/[^a-fA-F0-9]/gi, '')
        .slice(0, TOTEM_CODE_HEX_LENGTH)
        .toUpperCase();
    return hex ? `${TOTEM_PEDIDO_PREFIX} ${hex}` : '';
}

/** Campo de leitor do PDV: só pedido totem se começar com PED. */
export function isTotemOrderCodeScannerInput(raw) {
    const s = String(raw || '').trim().toUpperCase();
    if (!s.startsWith(TOTEM_PEDIDO_PREFIX)) return false;
    return normalizeTotemCode(raw).length === TOTEM_CODE_HEX_LENGTH;
}

export function parseTotemOrderCode(raw) {
    const code = normalizeTotemCode(raw);
    return code.length === TOTEM_CODE_HEX_LENGTH ? code : null;
}
