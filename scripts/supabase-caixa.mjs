import { fetchOrderById, patchOrder } from './supabase-orders.mjs';
import { maybeInitSeparation } from './separation-init.mjs';
import { confirmHubPedidoForTotem } from './hub-totem-pedido.mjs';
import { resolveOrderSplits } from './lib/payment-splits.mjs';

async function sbFetch(url, key, path, options = {}) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
            ...(options.headers || {}),
        },
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    if (!res.ok) {
        const err = new Error(data?.message || data?.error || text || `Supabase ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

async function sbRpc(url, key, fn, body) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    if (!res.ok) {
        const err = new Error(data?.message || data?.error || text || `Supabase RPC ${fn}`);
        err.status = res.status;
        throw err;
    }
    return data;
}


export function normalizeTotemPaymentMethod(raw) {
    const m = String(raw || '').toLowerCase().trim();
    if (m === 'card' || m === 'debito' || m === 'credito') return 'cartao';
    if (m === 'balcao' || m === 'caixa') return 'dinheiro';
    if (m === 'pix' || m === 'cartao' || m === 'dinheiro') return m;
    return 'dinheiro';
}

export function paymentMethodLabel(method) {
    const m = normalizeTotemPaymentMethod(method);
    if (m === 'pix') return 'Pix';
    if (m === 'cartao') return 'Cartão';
    return 'Dinheiro';
}

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

function normalizePaymentSplits(raw, total) {
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const splits = raw
        .map((entry) => ({
            method: normalizeTotemPaymentMethod(entry?.method || entry?.id),
            amount: roundMoney(entry?.amount),
        }))
        .filter((entry) => entry.method && entry.amount > 0);
    if (splits.length < 2) return null;
    const sum = roundMoney(splits.reduce((acc, item) => acc + item.amount, 0));
    if (Math.abs(sum - roundMoney(total)) > 0.009) {
        const err = new Error('A soma dos pagamentos deve ser igual ao total do pedido.');
        err.status = 400;
        throw err;
    }
    return splits;
}

function encodeSplitsInNotes(notes, splits) {
    const base = String(notes || '')
        .replace(/\s*\[\[lig-payment-splits:[\s\S]*?\]\]/g, '')
        .trim();
    const human = splits
        .map((item) => `${paymentMethodLabel(item.method)} R$ ${item.amount.toFixed(2).replace('.', ',')}`)
        .join('; ');
    const payload = JSON.stringify(splits);
    const suffix = `Pagamento dividido no totem: ${human} [[lig-payment-splits:${payload}]]`;
    const prefix = base ? `${base} · ` : '';
    const combined = `${prefix}${suffix}`;
    if (combined.length <= 2000) return combined;
    const maxBase = Math.max(0, 2000 - suffix.length - 3);
    const trimmedBase = base.slice(0, maxBase);
    return `${trimmedBase ? `${trimmedBase} · ` : ''}${suffix}`;
}

export async function listCaixaQueue(url, key, { limit = 40, useRpc = false } = {}) {
    if (useRpc) {
        const list = await sbRpc(url, key, 'rpc_list_caixa_queue', { p_limit: limit });
        return Array.isArray(list) ? list : [];
    }

    const orders = await sbFetch(
        url,
        key,
        `orders?channel=eq.totem&status=in.(pending,pending_payment)&financial_status=eq.aguardando_caixa&payment_method=not.is.null&order=created_at.asc&limit=${limit}&select=id,total,customer_name,totem_label,unit_id,created_at,payment_method,items,notes`
    );
    return Array.isArray(orders) ? orders : [];
}

export async function selectTotemPayment(url, key, orderId, method, { useRpc = false, paymentSplits = null } = {}) {
    const order = await fetchOrderById(url, key, orderId, { useRpc });
    if (!order) {
        const err = new Error('Pedido não encontrado');
        err.status = 404;
        throw err;
    }
    if (order.status === 'paid') {
        return order;
    }
    if (String(order.channel || '').toLowerCase() !== 'totem') {
        const err = new Error('Pedido não é do totem');
        err.status = 400;
        throw err;
    }
    const incomingSplits = normalizePaymentSplits(paymentSplits, order.total);
    if (order.financial_status === 'aguardando_caixa' && order.payment_method) {
        const existingSplits = resolveOrderSplits(order);
        if (!incomingSplits?.length || existingSplits.length >= 2) {
            return order;
        }
    }

    const splits = incomingSplits;
    let payment_method;
    let notes;
    if (splits?.length) {
        payment_method = splits.map((item) => item.method).join('+');
        notes = encodeSplitsInNotes(order.notes, splits);
    } else {
        if (!method) {
            const err = new Error('Informe a forma de pagamento');
            err.status = 400;
            throw err;
        }
        payment_method = normalizeTotemPaymentMethod(method);
        notes = [order.notes, `Forma escolhida no totem: ${paymentMethodLabel(payment_method)}`]
            .filter(Boolean)
            .join(' · ')
            .slice(0, 1000);
    }

    const patch = {
        payment_method,
        status: 'pending',
        financial_status: 'aguardando_caixa',
        notes,
    };
    if (splits?.length) {
        patch.payment_splits = splits;
    }

    let updated;
    try {
        updated = await patchOrder(url, key, orderId, patch, { useRpc });
    } catch (patchErr) {
        if (splits?.length && /column|payment_splits/i.test(String(patchErr.message || ''))) {
            const { payment_splits: _drop, ...patchWithoutSplits } = patch;
            updated = await patchOrder(url, key, orderId, patchWithoutSplits, { useRpc });
        } else {
            throw patchErr;
        }
    }
    if (!updated?.id) {
        updated = await fetchOrderById(url, key, orderId, { useRpc });
    }
    if (!updated?.id && order?.id) {
        updated = { ...order, ...patch };
    }
    if (!updated?.id) {
        const err = new Error('Pedido não retornado após registrar pagamento');
        err.status = 500;
        throw err;
    }
    return updated;
}

export async function confirmCaixaPayment(
    url,
    key,
    orderId,
    { pdvMethod, operator, env, useRpc = false } = {}
) {
    const order = await fetchOrderById(url, key, orderId, { useRpc });
    if (!order) {
        const err = new Error('Pedido não encontrado');
        err.status = 404;
        throw err;
    }
    if (order.status === 'paid') {
        return order;
    }
    if (String(order.channel || '').toLowerCase() !== 'totem') {
        const err = new Error('Pedido não é do totem');
        err.status = 400;
        throw err;
    }
    if (!['pending', 'pending_payment'].includes(order.status)) {
        const err = new Error('Pedido não está aguardando pagamento no caixa');
        err.status = 400;
        throw err;
    }

    const paidAt = new Date().toISOString();
    const method = normalizeTotemPaymentMethod(pdvMethod || order.payment_method);
    const op = String(operator || '').trim().slice(0, 64);

    const patch = {
        status: 'paid',
        financial_status: 'pago',
        payment_method: method,
        paid_at: paidAt,
        notes: [order.notes, op ? `PDV: ${op} (${paymentMethodLabel(method)})` : `PDV: ${paymentMethodLabel(method)}`]
            .filter(Boolean)
            .join(' · ')
            .slice(0, 1000),
    };

    const updated = await patchOrder(url, key, orderId, patch, { useRpc });
    await maybeInitSeparation(url, key, updated, env, { useRpc });
    let hubPedido = null;
    try {
        hubPedido = await confirmHubPedidoForTotem(updated, env, op);
    } catch (hubErr) {
        console.error('confirmHubPedidoForTotem', hubErr.message || hubErr);
    }
    if (hubPedido) updated._hubPedido = hubPedido;
    return updated;
}
