export function normalizeContactDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

export function looksLikePhoneDigits(digits) {
    const d = normalizeContactDigits(digits);
    if (d.length === 10) return true;
    if (d.length === 11 && d[2] === '9') return true;
    return false;
}

/** Evita gravar/exibir CPF ou CNPJ no campo de telefone. */
export function sanitizeCustomerPhone(phone, { cpf = '', cnpj = '' } = {}) {
    const raw = String(phone || '').trim();
    const phoneDigits = normalizeContactDigits(raw);
    if (!phoneDigits || !looksLikePhoneDigits(phoneDigits)) return '';
    const cpfDigits = normalizeContactDigits(cpf);
    const cnpjDigits = normalizeContactDigits(cnpj);
    if (cpfDigits && phoneDigits === cpfDigits) return '';
    if (cnpjDigits && phoneDigits === cnpjDigits) return '';
    return raw;
}
