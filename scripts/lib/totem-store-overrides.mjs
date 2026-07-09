import { hubConfig } from '../hub-auth.mjs';

function hubHeaders(config, token) {
    return {
        apikey: config.anonKey,
        Authorization: `Bearer ${token || config.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
    };
}

export async function listTotemStoreHidden(config, storeKey) {
    const key = encodeURIComponent(storeKey);
    const url = `${config.url}/rest/v1/totem_loja_ocultos?select=product_id,hub_product_id,product_name,hidden_at&store_key=eq.${key}&order=hidden_at.desc`;
    const res = await fetch(url, { headers: hubHeaders(config) });
    const rows = await res.json();
    if (!res.ok) {
        if (res.status === 404 || /totem_loja_ocultos/i.test(rows?.message || '')) {
            return { productIds: [], items: [], unavailable: true };
        }
        throw new Error(rows?.message || `totem_loja_ocultos ${res.status}`);
    }
    const items = Array.isArray(rows) ? rows : [];
    return {
        productIds: items.map((r) => String(r.product_id || '').trim()).filter(Boolean),
        items,
        unavailable: false,
    };
}

export async function hideTotemStoreProduct(config, { storeKey, productId, hubProductId, productName, hiddenBy }) {
    const url = `${config.url}/rest/v1/totem_loja_ocultos`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            ...hubHeaders(config),
            Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({
            store_key: storeKey,
            product_id: productId,
            hub_product_id: hubProductId || null,
            product_name: productName || null,
            hidden_by: hiddenBy || null,
            hidden_at: new Date().toISOString(),
        }),
    });
    const row = await res.json();
    if (!res.ok) throw new Error(row?.message || `hide ${res.status}`);
    return Array.isArray(row) ? row[0] : row;
}

export async function showTotemStoreProduct(config, storeKey, productId) {
    const url =
        `${config.url}/rest/v1/totem_loja_ocultos?store_key=eq.${encodeURIComponent(storeKey)}` +
        `&product_id=eq.${encodeURIComponent(productId)}`;
    const res = await fetch(url, {
        method: 'DELETE',
        headers: hubHeaders(config),
    });
    if (!res.ok) {
        const row = await res.json().catch(() => ({}));
        throw new Error(row?.message || `show ${res.status}`);
    }
    return true;
}

export function hubConfigForStore(env = process.env) {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        throw new Error('HUB_SUPABASE_SERVICE_ROLE_KEY ausente.');
    }
    return { ...config, token: config.serviceKey };
}
