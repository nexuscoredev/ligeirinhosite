const SPLIT_MARKER = '[[lig-payment-splits:';

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

const parseMoneyBr = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return 0;
    const normalized = text.includes(',')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/[^\d.]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? roundMoney(Math.max(0, n)) : 0;
};

const normalizeMethodId = (id) => String(id || '').toLowerCase().trim();

export function paymentMethodLabelShort(method) {
    const key = normalizeMethodId(method);
    if (key === 'pix') return 'Pix';
    if (key === 'cartao') return 'Cartão';
    return 'Dinheiro';
}

function mapHumanLabelToMethod(label) {
    const text = String(label || '').toLowerCase().trim();
    if (text.includes('pix')) return 'pix';
    if (text.includes('cart') || text.includes('cartao') || text.includes('cartão')) return 'cartao';
    if (text.includes('dinheiro')) return 'dinheiro';
    return normalizeMethodId(text);
}

function coalesceSplitArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function normalizeSplits(raw) {
    const list = coalesceSplitArray(raw);
    if (!list.length) return [];
    const seen = new Set();
    const out = [];
    list.forEach((entry) => {
        const method = normalizeMethodId(entry?.method || entry?.id);
        const amount =
            typeof entry?.amount === 'number' && Number.isFinite(entry.amount)
                ? roundMoney(entry.amount)
                : parseMoneyBr(entry?.amount);
        if (!method || amount <= 0 || seen.has(method)) return;
        seen.add(method);
        out.push({ method, amount });
    });
    return out;
}

function parseSplitsFromNotesJson(notes) {
    const text = String(notes || '');
    const start = text.indexOf(SPLIT_MARKER);
    if (start === -1) return [];
    const end = text.indexOf(']]', start);
    if (end === -1) return [];
    try {
        return normalizeSplits(JSON.parse(text.slice(start + SPLIT_MARKER.length, end)));
    } catch {
        return [];
    }
}

function parseSplitsFromNotesHuman(notes) {
    const text = String(notes || '');
    const match = text.match(/Pagamento dividido(?: no totem)?:\s*([^[\n]+)/i);
    if (!match) return [];
    const chunks = match[1].split(/\s*\+\s*|\s*;\s*/);
    const out = [];
    chunks.forEach((chunk) => {
        const part = chunk.trim();
        const m = part.match(/^(.+?)\s+R\$\s*([\d.,]+)$/i);
        if (!m) return;
        const method = mapHumanLabelToMethod(m[1]);
        const amount = parseMoneyBr(m[2]);
        if (method && amount > 0) out.push({ method, amount });
    });
    return out.length >= 2 ? out : [];
}

export function resolveOrderSplits(order) {
    if (!order) return [];
    const fromColumn = normalizeSplits(order.payment_splits || order.paymentSplits);
    if (fromColumn.length >= 2) return fromColumn;

    const fromJson = parseSplitsFromNotesJson(order.notes);
    if (fromJson.length >= 2) return fromJson;

    const fromHuman = parseSplitsFromNotesHuman(order.notes);
    if (fromHuman.length >= 2) return fromHuman;

    if (fromColumn.length === 1) return fromColumn;
    if (fromJson.length === 1) return fromJson;
    return [];
}

export function isSplitPayment(order) {
    return resolveOrderSplits(order).length >= 2;
}

/** Dinheiro pode exceder o total (troco); demais formas não. */
export function analyzePaymentSplits(splits, total) {
    const normalized = normalizeSplits(splits);
    const expected = roundMoney(total);
    const cash = normalized.find((s) => s.method === 'dinheiro') || null;
    const nonCashSum = roundMoney(
        normalized.filter((s) => s.method !== 'dinheiro').reduce((acc, s) => acc + s.amount, 0),
    );
    const cashTendered = cash ? cash.amount : 0;
    const neededFromCash = cash ? roundMoney(Math.max(0, expected - nonCashSum)) : 0;
    const troco = cash ? roundMoney(Math.max(0, cashTendered - neededFromCash)) : 0;
    const tenderedSum = roundMoney(nonCashSum + cashTendered);
    return {
        splits: normalized,
        expected,
        hasCash: Boolean(cash),
        nonCashSum,
        cashTendered,
        neededFromCash,
        troco,
        tenderedSum,
    };
}

export function computeCashChange(splits, total) {
    return analyzePaymentSplits(splits, total).troco;
}

export function validatePaymentSplits(raw, total) {
    const analysis = analyzePaymentSplits(raw, total);
    if (analysis.splits.length === 1 && analysis.splits[0].method === 'dinheiro') {
        if (analysis.cashTendered + 0.009 < analysis.expected) {
            const falta = roundMoney(analysis.expected - analysis.cashTendered);
            return {
                ok: false,
                error: `Dinheiro insuficiente. Falta ${falta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
                status: 400,
            };
        }
        return {
            ok: true,
            splits: analysis.splits,
            sum: analysis.tenderedSum,
            troco: analysis.troco,
        };
    }
    if (analysis.splits.length < 2) {
        return { ok: false, error: 'Informe ao menos duas formas de pagamento.', status: 400 };
    }

    for (const item of analysis.splits) {
        if (item.method !== 'dinheiro' && item.amount > analysis.expected + 0.009) {
            return {
                ok: false,
                error: `${paymentMethodLabelShort(item.method)} não pode ser maior que o total do pedido.`,
                status: 400,
            };
        }
    }

    if (analysis.hasCash) {
        if (analysis.nonCashSum > analysis.expected + 0.009) {
            return {
                ok: false,
                error: 'A soma das outras formas não pode ultrapassar o total do pedido.',
                status: 400,
            };
        }
        if (analysis.cashTendered + 0.009 < analysis.neededFromCash) {
            const falta = roundMoney(analysis.neededFromCash - analysis.cashTendered);
            return {
                ok: false,
                error: `Dinheiro insuficiente. Falta ${falta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
                status: 400,
            };
        }
        return {
            ok: true,
            splits: analysis.splits,
            troco: analysis.troco,
            sum: analysis.tenderedSum,
        };
    }

    if (Math.abs(analysis.tenderedSum - analysis.expected) > 0.009) {
        return {
            ok: false,
            error: 'A soma dos pagamentos deve ser igual ao total do pedido.',
            status: 400,
        };
    }

    return { ok: true, splits: analysis.splits, troco: 0, sum: analysis.tenderedSum };
}
