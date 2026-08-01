(function () {
    const DISTRIBUIDORA_CNPJ = '45028186000125';
    const EDIT_REQUEST_TAG = 'lig-edit-request';
    const EDIT_GRANTED_TAG = 'lig-edit-granted';

    const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

    const isDistribuidoraAccount = (source) => {
        if (!source) return false;
        if (typeof source === 'string') return normalizeDigits(source) === DISTRIBUIDORA_CNPJ;
        const session = source;
        const digits = normalizeDigits(session?.cnpj || session?.login || '');
        return digits === DISTRIBUIDORA_CNPJ;
    };

    const todayIsoInSaoPaulo = (date = new Date()) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);

    const orderDeliveryDateIso = (order) => {
        const raw = order?.deliveryDate || order?.delivery_date || '';
        const value = String(raw).slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    };

    const isOrderDeliveryDayToday = (order, today = todayIsoInSaoPaulo()) => {
        const deliveryDate = orderDeliveryDateIso(order);
        return Boolean(deliveryDate && deliveryDate === today);
    };

    const hasEditPermissionGranted = (order) =>
        new RegExp(`\\[\\[${EDIT_GRANTED_TAG}:`, 'i').test(String(order?.notes || ''));

    const hasEditPermissionRequested = (order) =>
        new RegExp(`\\[\\[${EDIT_REQUEST_TAG}:`, 'i').test(String(order?.notes || ''));

    const hubStatusCancelable = (hubStatus) => {
        const hs = String(hubStatus || '').toLowerCase().trim();
        return hs === 'pendente' || hs === 'aguardando_aceite' || !hs;
    };

    const baseOrderEditable = (order, hubStatus) => {
        if (!order || order.status === 'cancelled') return false;
        if ((order.channel || 'parceiros') !== 'parceiros') return false;
        if (order.status !== 'pending') return false;
        if (order.financialStatus === 'pago' || order.financial_status === 'pago') return false;
        if (order.financialStatus === 'em_cobranca' || order.financial_status === 'em_cobranca') return false;
        return hubStatusCancelable(hubStatus || order?.tracking?.hubStatus);
    };

    const evaluateOrderEditPolicy = (order, options = {}) => {
        const session = options.session || null;
        const accountCnpj = normalizeDigits(
            options.accountCnpj ||
                session?.cnpj ||
                session?.login ||
                (String(order?.notes || '').match(/CNPJ:\s*([0-9./-]+)/i)?.[1] || ''),
        );
        const hubStatus = options.hubStatus ?? order?.tracking?.hubStatus ?? '';
        const deliveryToday = isOrderDeliveryDayToday(order, options.today);
        const editPermissionGranted = hasEditPermissionGranted(order);
        const editPermissionRequested = hasEditPermissionRequested(order);
        const alwaysEditAccount = accountCnpj === DISTRIBUIDORA_CNPJ;
        const base = baseOrderEditable(order, hubStatus);

        if (!base) {
            return {
                canEdit: false,
                canRequestEdit: false,
                deliveryToday,
                editPermissionRequested,
                editPermissionGranted,
                alwaysEditAccount,
                editBlockedReason: 'status',
            };
        }

        if (alwaysEditAccount) {
            return {
                canEdit: true,
                canRequestEdit: false,
                deliveryToday,
                editPermissionRequested,
                editPermissionGranted,
                alwaysEditAccount: true,
            };
        }

        if (deliveryToday && !editPermissionGranted) {
            return {
                canEdit: false,
                canRequestEdit: !editPermissionRequested,
                deliveryToday,
                editPermissionRequested,
                editPermissionGranted,
                editBlockedReason: 'delivery_day',
            };
        }

        return {
            canEdit: true,
            canRequestEdit: false,
            deliveryToday,
            editPermissionRequested,
            editPermissionGranted,
            alwaysEditAccount: false,
        };
    };

    window.LigeirinhoOrderEditPolicy = {
        DISTRIBUIDORA_CNPJ,
        evaluateOrderEditPolicy,
        isOrderDeliveryDayToday,
        isDistribuidoraAccount,
    };
})();
