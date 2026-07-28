(function () {
    const DIAS_ENTREGA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const DEFAULT_DELIVERY_START_DAYS = 2;
    const DISTRIBUIDORA_CNPJ = '45028186000125';

    const isDistribuidoraCnpj = (value) => String(value || '').replace(/\D/g, '') === DISTRIBUIDORA_CNPJ;

    const minDayOffset = (datasEntrega, { startDays = DEFAULT_DELIVERY_START_DAYS, allowSameDay = false } = {}) => {
        if (allowSameDay) return 0;
        const allowed = new Set(
            (datasEntrega || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
        );
        if (!allowed.size) return startDays;
        return 1;
    };

    const formatLocalDateKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const optionFromDate = (d) => {
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
        return {
            value: formatLocalDateKey(d),
            label,
            weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
            dayOfWeek: d.getDay(),
            type: 'Regular',
            priceLabel: 'Grátis',
        };
    };

    const defaultDeliveryDateOptions = ({ count = 12, startDays = DEFAULT_DELIVERY_START_DAYS } = {}) => {
        const options = [];
        const anchor = new Date();
        anchor.setHours(12, 0, 0, 0);

        for (let i = startDays; options.length < count; i += 1) {
            const d = new Date(anchor);
            d.setDate(d.getDate() + i);
            options.push(optionFromDate(d));
        }

        return options;
    };

    const deliveryDateOptions = (datasEntrega, opts = {}) => {
        const count = opts.count ?? 12;
        const horizonDays = opts.horizonDays ?? 56;
        const startDays = opts.startDays ?? DEFAULT_DELIVERY_START_DAYS;
        const allowSameDay = opts.allowSameDay ?? false;
        const minOffset = minDayOffset(datasEntrega, { startDays, allowSameDay });
        const allowed = new Set(
            (datasEntrega || [])
                .map(Number)
                .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        );
        if (!allowed.size) {
            return defaultDeliveryDateOptions({ count, startDays: minOffset });
        }

        const options = [];
        const anchor = new Date();
        anchor.setHours(12, 0, 0, 0);

        for (let i = minOffset; i <= horizonDays && options.length < count; i += 1) {
            const d = new Date(anchor);
            d.setDate(d.getDate() + i);
            const dow = d.getDay();
            if (!allowed.has(dow)) continue;
            options.push(optionFromDate(d));
        }

        if (!options.length) {
            return defaultDeliveryDateOptions({ count, startDays: minOffset });
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

    const isDeliveryDateAllowed = (deliveryDate, datasEntrega, opts = {}) => {
        const value = String(deliveryDate || '').trim();
        if (!value) return false;
        return deliveryDateOptions(datasEntrega, opts).some((opt) => opt.value === value);
    };

    window.LigeirinhoParceiroDelivery = {
        deliveryDateOptions,
        rotuloDiasEntrega,
        isDeliveryDateAllowed,
        isDistribuidoraCnpj,
    };
})();
