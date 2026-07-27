(function () {
    const normalizePhoneBR = (raw) => {
        const digits = String(raw || '').replace(/\D/g, '');
        if (digits.length === 11) return `+55${digits}`;
        if (digits.length === 13 && digits.startsWith('55')) return `+${digits}`;
        if (digits.length === 10) return `+55${digits}`;
        return null;
    };

    const formatPhoneDisplay = (e164) => {
        if (!e164) return '';
        const value = String(e164).trim();
        if (!value.startsWith('+55')) return value;
        const digits = value.slice(3);
        if (digits.length === 11) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        }
        if (digits.length === 10) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        }
        return value;
    };

    const maskPhoneInput = (raw) => {
        const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 2) return digits.length ? `(${digits}` : '';
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    const normalizeName = (raw) => String(raw || '').trim().replace(/\s+/g, ' ');

    const isValidName = (name) => normalizeName(name).length >= 2;

    const normalizeCompanyName = (raw) => normalizeName(raw);

    const isValidCompanyName = (name) => normalizeCompanyName(name).length >= 2;

    const normalizeCnpj = (raw) => String(raw || '').replace(/\D/g, '').slice(0, 14);

    const maskCnpjInput = (raw) => {
        const digits = normalizeCnpj(raw);
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
        if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
        if (digits.length <= 12) {
            return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
        }
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    };

    const isValidCnpj = (raw) => normalizeCnpj(raw).length === 14;

    window.LigeirinhoPhoneAuth = {
        normalizePhoneBR,
        formatPhoneDisplay,
        maskPhoneInput,
        normalizeName,
        isValidName,
        normalizeCompanyName,
        isValidCompanyName,
        normalizeCnpj,
        maskCnpjInput,
        isValidCnpj,
    };
})();
