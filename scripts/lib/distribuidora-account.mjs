/** CNPJ da conta Ligeirinho Distribuidora (pedidos internos / vitrine própria). */
export const DISTRIBUIDORA_CNPJ = '45028186000125';

export function normalizeAccountDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

export function isDistribuidoraAccount(source) {
    if (!source) return false;
    if (typeof source === 'string') {
        return normalizeAccountDigits(source) === DISTRIBUIDORA_CNPJ;
    }
    const digits = normalizeAccountDigits(
        source.cnpj || source.cpf_cnpj_digits || source.cpf_cnpj || source.login || '',
    );
    return digits === DISTRIBUIDORA_CNPJ;
}
