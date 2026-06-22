/** Dias da semana no Hub: 0=dom … 6=sáb (igual a Date#getDay). */
export const DIAS_ENTREGA_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function formatLocalDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

    return {
        condicaoPagamento: pickText(cliente?.condicao_pagamento, pessoa?.condicao_pagamento),
        parcelasVencimento: pickText(cliente?.parcelas_vencimento, pessoa?.parcelas_vencimento),
        formasPagamentoIds: pickArray(cliente?.formas_pagamento_ids, pessoa?.formas_pagamento_ids),
        datasEntrega: resolveDatasEntregaParceiro(pessoa),
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

export function deliveryDateOptions(datasEntrega = [], { count = 12, horizonDays = 56 } = {}) {
    const allowed = new Set(
        (datasEntrega || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
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
}

export function isDeliveryDateAllowed(deliveryDate, datasEntrega = []) {
    const value = String(deliveryDate || '').trim();
    if (!value) return false;
    return deliveryDateOptions(datasEntrega).some((opt) => opt.value === value);
}
