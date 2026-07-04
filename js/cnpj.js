(function () {
    const normalizeCnpjDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 14);

    const formatCnpj = (value) => {
        const d = normalizeCnpjDigits(value);
        if (d.length <= 2) return d;
        if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
        if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
        if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
        return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    };

    const isValidCnpj = (value) => {
        const c = normalizeCnpjDigits(value);
        if (c.length !== 14) return false;
        if (/^(\d)\1{13}$/.test(c)) return false;

        const checkDigit = (base) => {
            let sum = 0;
            let pos = base.length - 7;
            for (let i = base.length; i >= 1; i -= 1) {
                sum += Number(c[base.length - i]) * pos;
                pos -= 1;
                if (pos < 2) pos = 9;
            }
            const mod = sum % 11;
            return mod < 2 ? 0 : 11 - mod;
        };

        return checkDigit(c.slice(0, 12)) === Number(c[12]) && checkDigit(c.slice(0, 13)) === Number(c[13]);
    };

    window.LigeirinhoCnpj = { normalizeCnpjDigits, formatCnpj, isValidCnpj };
})();
