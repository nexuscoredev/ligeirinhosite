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
    raw.forEach((entry) => {
        const method = normalizeMethodId(entry?.method || entry?.id);
        const amount = roundMoney(entry?.amount);
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
    return [];
}

export function isSplitPayment(order) {
    return resolveOrderSplits(order).length >= 2;
}
