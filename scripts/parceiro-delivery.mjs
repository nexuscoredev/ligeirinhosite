/** Dias da semana no Hub: 0=dom … 6=sáb (igual a Date#getDay). */
export const DIAS_ENTREGA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DEFAULT_DELIVERY_START_DAYS = 2;
export const DISTRIBUIDORA_CNPJ = '45028186000125';

export function isDistribuidoraCnpj(value) {
    return String(value || '').replace(/\D/g, '') === DISTRIBUIDORA_CNPJ;
}

function minDayOffset(datasEntrega, { startDays = DEFAULT_DELIVERY_START_DAYS, allowSameDay = false } = {}) {
    if (allowSameDay) return 0;
    const allowed = new Set(
        (datasEntrega || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    );
    if (!allowed.size) return startDays;
    return 1;
}

export function formatLocalDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function optionFromDate(d) {
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
}

export function defaultDeliveryDateOptions({ count = 12, startDays = DEFAULT_DELIVERY_START_DAYS } = {}) {
    const options = [];
    const anchor = new Date();
    anchor.setHours(12, 0, 0, 0);

    for (let i = startDays; options.length < count; i += 1) {
        const d = new Date(anchor);
        d.setDate(d.getDate() + i);
        options.push(optionFromDate(d));
    }

    return options;
}

export function clienteParceirosFromPessoa(pessoa) {
    const clientes = Array.isArray(pessoa?.clientes)
        ? pessoa.clientes
        : pessoa?.clientes
          ? [pessoa.clientes]
          : [];
    return clientes.find((c) => c?.canal_cliente === 'parceiros' && c?.ativo !== false) || null;
}

export function resolveDatasEntregaParceiro(pessoa) {
    const cliente = clienteParceirosFromPessoa(pessoa);
    const fromCliente = Array.isArray(cliente?.datas_entrega) ? cliente.datas_entrega : [];
    if (fromCliente.length) {
        return fromCliente.map(Number).filter((n) => n >= 0 && n <= 6);
    }
    const fromPessoa = Array.isArray(pessoa?.datas_entrega) ? pessoa.datas_entrega : [];
    return fromPessoa.map(Number).filter((n) => n >= 0 && n <= 6);
}

export function resolveParceiroClienteFields(pessoa) {
    const cliente = clienteParceirosFromPessoa(pessoa);
    const pickArray = (clienteValue, pessoaValue) => {
        if (Array.isArray(clienteValue) && clienteValue.length) return clienteValue;
        return Array.isArray(pessoaValue) ? pessoaValue : [];
    };
    const pickText = (clienteValue, pessoaValue) => {
        const c = String(clienteValue || '').trim();
        if (c) return c;
        return String(pessoaValue || '').trim();
    };
    const pickTaxaEntrega = (clienteValue, pessoaValue) => {
        if (clienteValue != null && clienteValue !== '') {
            const n = Number(clienteValue);
            if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100;
        }
        if (pessoaValue != null && pessoaValue !== '') {
            const n = Number(pessoaValue);
            if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100;
        }
        return null;
    };

    const clienteAPrazo =
        cliente?.cliente_a_prazo != null
            ? Boolean(cliente.cliente_a_prazo)
            : Boolean(pessoa?.cliente_a_prazo);

    return {
        condicaoPagamento: pickText(cliente?.condicao_pagamento, pessoa?.condicao_pagamento),
        parcelasVencimento: pickText(cliente?.parcelas_vencimento, pessoa?.parcelas_vencimento),
        formasPagamentoIds: pickArray(cliente?.formas_pagamento_ids, pessoa?.formas_pagamento_ids),
        datasEntrega: resolveDatasEntregaParceiro(pessoa),
        taxaEntrega: pickTaxaEntrega(cliente?.taxa_entrega, pessoa?.taxa_entrega),
        clienteAPrazo,
    };
}

export function rotuloDiasEntrega(dias = []) {
    if (!dias.length) return '';
    return dias
        .slice()
        .sort((a, b) => a - b)
        .map((d) => DIAS_ENTREGA_LABELS[d] ?? String(d))
        .join(', ');
}

export function deliveryDateOptions(
    datasEntrega = [],
    { count = 12, horizonDays = 56, startDays = DEFAULT_DELIVERY_START_DAYS, allowSameDay = false } = {},
) {
    const minOffset = minDayOffset(datasEntrega, { startDays, allowSameDay });
    const allowed = new Set(
        (datasEntrega || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
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
}

export function isDeliveryDateAllowed(deliveryDate, datasEntrega = [], opts = {}) {
    const value = String(deliveryDate || '').trim();
    if (!value) return false;
    return deliveryDateOptions(datasEntrega, opts).some((opt) => opt.value === value);
}
