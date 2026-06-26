function headers(apiKey, extra = {}) {
    return {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

async function parseJson(res) {
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText;
        throw new Error(`Supabase failed: ${msg}`);
    }
    return data;
}

export async function insertOrder(supabaseUrl, apiKey, row, { useRpc = false } = {}) {
    if (useRpc) {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_create_order`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({ p: row }),
        });
        return parseJson(res);
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/orders`, {
        method: 'POST',
        headers: headers(apiKey, { Prefer: 'return=representation' }),
        body: JSON.stringify(row),
    });
    const data = await parseJson(res);
    return Array.isArray(data) ? data[0] : data;
}

export async function fetchOrderById(supabaseUrl, apiKey, id, { useRpc = false } = {}) {
    if (useRpc) {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_get_order`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({ p_id: id }),
        });
        const data = await parseJson(res);
        return data || null;
    }

    const url = `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
    const res = await fetch(url, { headers: headers(apiKey) });
    const data = await parseJson(res);
    return Array.isArray(data) ? data[0] : null;
}

export async function patchOrder(supabaseUrl, apiKey, id, patch, { useRpc = false } = {}) {
    if (useRpc) {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_patch_order`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({ p_id: id, p_patch: { ...patch, updated_at: new Date().toISOString() } }),
        });
        return parseJson(res);
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: headers(apiKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    const data = await parseJson(res);
    return Array.isArray(data) ? data[0] : data;
}

export async function fetchOrderByMpPaymentId(supabaseUrl, apiKey, mpPaymentId, { useRpc = false } = {}) {
    if (useRpc) {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_fetch_order_by_mp`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({ p_mp_payment_id: Number(mpPaymentId) }),
        });
        const data = await parseJson(res);
        return data || null;
    }

    const url = `${supabaseUrl}/rest/v1/orders?mp_payment_id=eq.${encodeURIComponent(String(mpPaymentId))}&select=*&limit=1`;
    const res = await fetch(url, { headers: headers(apiKey) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    return Array.isArray(data) ? data[0] : null;
}

export async function fetchOrderByPixTxid(supabaseUrl, apiKey, txid, { useRpc = false } = {}) {
    if (useRpc) {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_fetch_order_by_pix_txid`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({ p_pix_txid: String(txid) }),
        });
        const data = await parseJson(res);
        return data || null;
    }

    const url = `${supabaseUrl}/rest/v1/orders?pix_txid=eq.${encodeURIComponent(String(txid))}&select=*&limit=1`;
    const res = await fetch(url, { headers: headers(apiKey) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    return Array.isArray(data) ? data[0] : null;
}

export function publicOrderView(order) {
    if (!order) return null;
    return {
        id: order.id,
        status: order.status,
        financialStatus: order.financial_status || 'pendente',
        total: Number(order.total),
        deliveryType: order.delivery_type,
        deliveryDate: order.delivery_date || null,
        address: order.address,
        notes: order.notes,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        paymentMethod: order.payment_method,
        paymentChosen: order.financial_status === 'aguardando_caixa',
        dueDate: order.due_date,
        paidAt: order.paid_at,
        channel: order.channel || 'parceiros',
        totemId: order.totem_id || null,
        totemLabel: order.totem_label || null,
        unitId: order.unit_id || null,
        items: order.items,
        mpStatus: order.mp_status,
        pixQrCode: order.pix_qr_code || null,
        pixQrBase64: order.pix_qr_base64 || null,
        pixTxid: order.pix_txid || null,
        pixProvider: order.pix_provider || null,
        createdAt: order.created_at,
        wantsInvoice: Boolean(order.wants_invoice),
        nfQueueStatus: order.nf_queue_status || null,
        hubPedidoId: order.hub_pedido_id || null,
    };
}

export function dbFromPaymentConfig(config) {
    return {
        url: config.supabaseUrl,
        key: config.supabaseApiKey || config.supabaseServiceKey,
        useRpc: Boolean(config.supabaseUseRpc),
    };
}

export function supabaseOrderOpts(config) {
    return dbFromPaymentConfig(config);
}
