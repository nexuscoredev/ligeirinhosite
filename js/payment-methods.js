(function () {
    const OPTIONS = [
        {
            id: 'boleto',
            label: 'Boleto para 20 dias.',
            hint: 'Taxas podem ser aplicadas.',
            icon: 'description',
        },
        {
            id: 'dinheiro',
            label: 'Dinheiro',
            hint: '',
            icon: 'payments',
        },
        {
            id: 'mercado_pago',
            label: 'Mercado Pago',
            hint: 'PIX, cartão de crédito ou débito',
            icon: 'account_balance_wallet',
        },
    ];

    const labelById = (id) => {
        const opt = OPTIONS.find((o) => o.id === id);
        if (!opt) return '';
        if (opt.id === 'boleto') return 'Boleto para 20 dias';
        return opt.label.replace(/\.$/, '');
    };

    window.LigeirinhoPaymentMethods = {
        OPTIONS,
        label: labelById,
        isOnlinePayment: (id) => id === 'mercado_pago',
    };
})();
