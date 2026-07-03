(function () {
    const normalizeCpfDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 11);

    const formatCpf = (value) => {
        const d = normalizeCpfDigits(value);
        if (d.length <= 3) return d;
        if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
        if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
        return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    };

    const isValidCpf = (value) => {
        const cpf = normalizeCpfDigits(value);
        if (cpf.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cpf)) return false;

        const calc = (base) => {
            let sum = 0;
            for (let i = 0; i < base.length; i += 1) {
                sum += Number(base[i]) * (base.length + 1 - i);
            }
            const mod = (sum * 10) % 11;
            return mod === 10 ? 0 : mod;
        };

        const d1 = calc(cpf.slice(0, 9));
        if (d1 !== Number(cpf[9])) return false;
        const d2 = calc(cpf.slice(0, 10));
        return d2 === Number(cpf[10]);
    };

    window.LigeirinhoCpf = { normalizeCpfDigits, formatCpf, isValidCpf };
})();
