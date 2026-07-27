(function () {
    const DEFAULT_FEE = 100;

    const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

    const parseTaxaEntrega = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0) return null;
        return roundMoney(n);
    };

    const resolveFee = (session, checkout) => {
        if (checkout?.deliveryType === 'retirada') return 0;
        const parsed = parseTaxaEntrega(session?.taxaEntrega);
        if (parsed === 0) return 0;
        if (parsed != null) return parsed;
        return DEFAULT_FEE;
    };

    const feeLabel = (fee, formatMoney) => {
        if (!fee || fee <= 0) return 'Grátis';
        return formatMoney ? formatMoney(fee) : `R$ ${fee.toFixed(2).replace('.', ',')}`;
    };

    const orderTotal = (subtotal, fee) => roundMoney(Number(subtotal || 0) + Number(fee || 0));

    window.LigeirinhoDeliveryFee = {
        DEFAULT_FEE,
        resolveFee,
        feeLabel,
        orderTotal,
    };
})();
