(function () {
    const SPLIT_MARKER = '[[lig-payment-splits:';
    const SPLIT_MARKER_END = ']]';

    const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

    const parseMoneyInput = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return 0;
        const normalized = raw.includes(',')
            ? raw.replace(/\./g, '').replace(',', '.')
            : raw.replace(/[^\d.]/g, '');
        const n = Number(normalized);
        return Number.isFinite(n) ? roundMoney(Math.max(0, n)) : 0;
    };

    const formatMoneyInput = (value) => {
        const n = roundMoney(value);
        if (!n) return '';
        return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const normalizeMethodId = (id) => String(id || '').toLowerCase().trim();

    const normalizeSplits = (splits, { total = null } = {}) => {
        if (!Array.isArray(splits)) return [];
        const seen = new Set();
        const out = [];
        splits.forEach((entry) => {
            const method = normalizeMethodId(entry?.method || entry?.id);
            const amount =
                typeof entry?.amount === 'number' && Number.isFinite(entry.amount)
                    ? roundMoney(entry.amount)
                    : parseMoneyInput(entry?.amount);
            if (!method || amount <= 0 || seen.has(method)) return;
            seen.add(method);
            out.push({ method, amount });
        });
        if (total != null && out.length === 1) {
            out[0].amount = roundMoney(total);
        }
        return out;
    };

    const splitsFromCheckout = (checkout, total = null) => {
        const stored = normalizeSplits(checkout?.paymentSplits || []);
        if (stored.length >= 2) return stored;
        const method = normalizeMethodId(checkout?.paymentMethod || checkout?.payment);
        if (!method) return [];
        if (total == null) return [{ method, amount: 0 }];
        return [{ method, amount: roundMoney(total) }];
    };

    const isMultiPayment = (checkout) => normalizeSplits(checkout?.paymentSplits || []).length >= 2;

    const selectedMethodIds = (checkout) => {
        const splits = normalizeSplits(checkout?.paymentSplits || []);
        if (splits.length >= 2) return splits.map((s) => s.method);
        const single = normalizeMethodId(checkout?.paymentMethod || checkout?.payment);
        return single ? [single] : [];
    };

    const isCashMethod = (id) => normalizeMethodId(id) === 'dinheiro';

    /** Dinheiro pode exceder o total (troco); Pix/Cartão não. */
    const analyzeSplits = (splits, total) => {
        const normalized = normalizeSplits(splits);
        const expected = roundMoney(total);
        const cash = normalized.find((s) => isCashMethod(s.method)) || null;
        const nonCashSum = roundMoney(
            normalized.filter((s) => !isCashMethod(s.method)).reduce((acc, s) => acc + s.amount, 0),
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
    };

    const computeCashChange = (splits, total) => analyzeSplits(splits, total).troco;

    const validateSplits = (splits, total, labelFn = (id) => id) => {
        const analysis = analyzeSplits(splits, total);
        if (analysis.splits.length < 2) {
            const methods = new Set(
                (Array.isArray(splits) ? splits : [])
                    .map((entry) => normalizeMethodId(entry?.method || entry?.id))
                    .filter(Boolean),
            );
            if (methods.size >= 2) {
                return {
                    ok: false,
                    error: 'Preencha o valor das formas de pagamento para finalizar.',
                };
            }
            return { ok: false, error: 'Selecione pelo menos duas formas de pagamento.' };
        }
        if (analysis.splits.some((item) => !labelFn(item.method))) {
            return { ok: false, error: 'Forma de pagamento inválida.' };
        }
        for (const item of analysis.splits) {
            if (!isCashMethod(item.method) && item.amount > analysis.expected + 0.009) {
                return {
                    ok: false,
                    error: `${labelFn(item.method)} não pode ser maior que o total do pedido.`,
                };
            }
        }
        if (analysis.hasCash) {
            if (analysis.nonCashSum > analysis.expected + 0.009) {
                return {
                    ok: false,
                    error: 'A soma das outras formas não pode ultrapassar o total do pedido.',
                };
            }
            if (analysis.cashTendered + 0.009 < analysis.neededFromCash) {
                const falta = roundMoney(analysis.neededFromCash - analysis.cashTendered);
                return {
                    ok: false,
                    error: `Dinheiro insuficiente. Falta ${falta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
                };
            }
            return {
                ok: true,
                splits: analysis.splits,
                sum: analysis.tenderedSum,
                troco: analysis.troco,
            };
        }
        if (Math.abs(analysis.tenderedSum - analysis.expected) > 0.009) {
            return {
                ok: false,
                error: `A soma (${analysis.tenderedSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) deve ser igual ao total (${analysis.expected.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`,
            };
        }
        return { ok: true, splits: analysis.splits, sum: analysis.tenderedSum, troco: 0 };
    };

    const validateCheckoutPayment = (checkout, total, labelFn) => {
        if (isMultiPayment(checkout)) {
            return validateSplits(checkout.paymentSplits, total, labelFn);
        }
        const method = normalizeMethodId(checkout?.paymentMethod || checkout?.payment);
        if (!method) return { ok: false, error: 'Selecione o método de pagamento.' };
        return { ok: true, splits: [{ method, amount: roundMoney(total) }] };
    };

    const formatSplitSummary = (splits, labelFn, formatMoney) => {
        const normalized = normalizeSplits(splits);
        if (!normalized.length) return '';
        return normalized
            .map((item) => `${labelFn(item.method)} ${formatMoney(item.amount)}`)
            .join(' + ');
    };

    const encodeSplitsInNotes = (notes, splits) => {
        const base = String(notes || '')
            .replace(new RegExp(`\\s*${SPLIT_MARKER.replace(/[[\]]/g, '\\$&')}[\\s\\S]*?${SPLIT_MARKER_END}`), '')
            .trim();
        const normalized = normalizeSplits(splits);
        if (normalized.length < 2) return base || null;
        const payload = JSON.stringify(normalized);
        const human = normalized
            .map((item) => `${item.method.toUpperCase()} R$ ${item.amount.toFixed(2).replace('.', ',')}`)
            .join('; ');
        const suffix = `Pagamento dividido: ${human} ${SPLIT_MARKER}${payload}${SPLIT_MARKER_END}`;
        const prefix = base ? `${base} · ` : '';
        const combined = `${prefix}${suffix}`;
        if (combined.length <= 2000) return combined;
        const maxBase = Math.max(0, 2000 - suffix.length - 3);
        const trimmedBase = base.slice(0, maxBase);
        return `${trimmedBase ? `${trimmedBase} · ` : ''}${suffix}`;
    };

    const parseSplitsFromNotes = (notes) => {
        const text = String(notes || '');
        const start = text.indexOf(SPLIT_MARKER);
        if (start === -1) return [];
        const end = text.indexOf(SPLIT_MARKER_END, start);
        if (end === -1) return [];
        try {
            return normalizeSplits(JSON.parse(text.slice(start + SPLIT_MARKER.length, end)));
        } catch {
            return [];
        }
    };

    const parseSplitsFromNotesHuman = (notes) => {
        const text = String(notes || '');
        const match = text.match(/Pagamento dividido(?: no totem)?:\s*([^[\n]+)/i);
        if (!match) return [];
        const chunks = match[1].split(/\s*\+\s*|\s*;\s*/);
        const out = [];
        chunks.forEach((chunk) => {
            const part = chunk.trim();
            const m = part.match(/^(.+?)\s+R\$\s*([\d.,]+)$/i);
            if (!m) return;
            const label = String(m[1] || '').toLowerCase().trim();
            let method = normalizeMethodId(label);
            if (label.includes('pix')) method = 'pix';
            else if (label.includes('cart') || label.includes('cartão') || label.includes('cartao')) method = 'cartao';
            else if (label.includes('dinheiro')) method = 'dinheiro';
            const amount = parseMoneyInput(m[2]);
            if (method && amount > 0) out.push({ method, amount });
        });
        return out.length >= 2 ? out : [];
    };

    const preferCashTendered = (a, b) => {
        const cashOf = (splits) => {
            if (!splits?.length) return 0;
            const cash = splits.find((s) => s.method === 'dinheiro');
            return cash ? cash.amount : 0;
        };
        if (!a?.length) return b || [];
        if (!b?.length) return a;
        if (a.length >= 2 && b.length < 2) return a;
        if (b.length >= 2 && a.length < 2) return b;
        return cashOf(b) > cashOf(a) + 0.009 ? b : a;
    };

    const resolveOrderSplits = (order) => {
        let fromColumn = [];
        if (Array.isArray(order?.paymentSplits) && order.paymentSplits.length >= 1) {
            fromColumn = normalizeSplits(order.paymentSplits);
        } else if (Array.isArray(order?.payment_splits) && order.payment_splits.length >= 1) {
            fromColumn = normalizeSplits(order.payment_splits);
        }
        if (fromColumn.length >= 2) return fromColumn;

        const fromJson = parseSplitsFromNotes(order?.notes);
        if (fromJson.length >= 2) return fromJson;
        const fromHuman = parseSplitsFromNotesHuman(order?.notes);
        if (fromHuman.length >= 2) return fromHuman;

        // Só dinheiro: preferir notes se tiverem valor entregue (troco) maior.
        return preferCashTendered(fromColumn, fromJson);
    };

    window.LigeirinhoPaymentSplits = {
        roundMoney,
        parseMoneyInput,
        formatMoneyInput,
        normalizeSplits,
        splitsFromCheckout,
        isMultiPayment,
        selectedMethodIds,
        isCashMethod,
        analyzeSplits,
        computeCashChange,
        validateSplits,
        validateCheckoutPayment,
        formatSplitSummary,
        encodeSplitsInNotes,
        parseSplitsFromNotes,
        resolveOrderSplits,
    };
})();
