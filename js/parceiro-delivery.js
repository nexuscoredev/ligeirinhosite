(function () {
    const DIAS_ENTREGA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const formatLocalDateKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const deliveryDateOptions = (datasEntrega, opts = {}) => {
        const count = opts.count ?? 12;
        const horizonDays = opts.horizonDays ?? 56;
        const allowed = new Set(
            (datasEntrega || [])
                .map(Number)
                .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        );
        if (!allowed.size) return [];

        const options = [];
        const anchor = new Date();
        anchor.setHours(12, 0, 0, 0);

        for (let i = 1; i <= horizonDays && options.length < count; i += 1) {
            const d = new Date(anchor);
            d.setDate(d.getDate() + i);
            const dow = d.getDay();
            if (!allowed.has(dow)) continue;

            const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
            options.push({
                value: formatLocalDateKey(d),
                label,
                weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
                dayOfWeek: dow,
                type: 'Regular',
                priceLabel: 'Grátis',
            });
        }

        return options;
    };

    const rotuloDiasEntrega = (dias) => {
        if (!dias?.length) return '';
        return dias
            .slice()
            .sort((a, b) => a - b)
            .map((d) => DIAS_ENTREGA_LABELS[d] ?? String(d))
            .join(', ');
    };

    const isDeliveryDateAllowed = (deliveryDate, datasEntrega) => {
        const value = String(deliveryDate || '').trim();
        if (!value) return false;
        return deliveryDateOptions(datasEntrega).some((opt) => opt.value === value);
    };

    window.LigeirinhoParceiroDelivery = {
        deliveryDateOptions,
        rotuloDiasEntrega,
        isDeliveryDateAllowed,
    };
})();
