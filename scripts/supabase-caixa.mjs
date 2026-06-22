import { fetchOrderById, patchOrder } from './supabase-orders.mjs';
import { maybeInitSeparation } from './separation-init.mjs';

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

export async function selectTotemPayment(url, key, orderId, method, { useRpc = false } = {}) {
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
    if (order.financial_status === 'aguardando_caixa' && order.payment_method) {
        return order;
    }

    const payment_method = normalizeTotemPaymentMethod(method);
    const patch = {
        payment_method,
        status: 'pending',
        financial_status: 'aguardando_caixa',
        notes: [order.notes, `Forma escolhida no totem: ${paymentMethodLabel(payment_method)}`]
            .filter(Boolean)
            .join(' · ')
            .slice(0, 1000),
    };

    return patchOrder(url, key, orderId, patch, { useRpc });
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
    return updated;
}
