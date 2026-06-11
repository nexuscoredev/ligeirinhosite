const headers = (serviceKey, extra = {}) => ({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra,
});

export async function insertOrder(supabaseUrl, serviceKey, row) {
    const res = await fetch(`${supabaseUrl}/rest/v1/orders`, {
        method: 'POST',
        headers: headers(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify(row),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText;
        throw new Error(`Supabase insert failed: ${msg}`);
    }
    return Array.isArray(data) ? data[0] : data;
}

export async function fetchOrderById(supabaseUrl, serviceKey, id) {
    const url = `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
    const res = await fetch(url, { headers: headers(serviceKey) });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || 'Supabase fetch failed');
    }
    return Array.isArray(data) ? data[0] : null;
}

export async function patchOrder(supabaseUrl, serviceKey, id, patch) {
    const res = await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: headers(serviceKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || 'Supabase patch failed');
    }
    return Array.isArray(data) ? data[0] : data;
}

export async function fetchOrderByMpPaymentId(supabaseUrl, serviceKey, mpPaymentId) {
    const url = `${supabaseUrl}/rest/v1/orders?mp_payment_id=eq.${encodeURIComponent(String(mpPaymentId))}&select=*&limit=1`;
    const res = await fetch(url, { headers: headers(serviceKey) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    return Array.isArray(data) ? data[0] : null;
}

export function publicOrderView(order) {
    if (!order) return null;
    return {
        id: order.id,
        status: order.status,
        total: Number(order.total),
        deliveryType: order.delivery_type,
        address: order.address,
        notes: order.notes,
        customerName: order.customer_name,
        channel: order.channel || 'parceiros',
        totemId: order.totem_id || null,
        totemLabel: order.totem_label || null,
        unitId: order.unit_id || null,
        items: order.items,
        mpStatus: order.mp_status,
        pixQrCode: order.pix_qr_code || null,
        pixQrBase64: order.pix_qr_base64 || null,
        createdAt: order.created_at,
    };
}
