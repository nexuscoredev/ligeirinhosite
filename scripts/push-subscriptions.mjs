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
        const msg = data?.message || data?.error || data?.hint || res.statusText;
        const err = new Error(`Supabase push: ${msg}`);
        err.status = res.status;
        err.body = data;
        throw err;
    }
    return data;
}

export function normalizeSubscription(input) {
    const endpoint = String(input?.endpoint || '').trim();
    const p256dh = String(input?.keys?.p256dh || input?.p256dh || '').trim();
    const auth = String(input?.keys?.auth || input?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) return null;
    return { endpoint, keys: { p256dh, auth } };
}

export async function upsertPushSubscription(
    supabaseUrl,
    apiKey,
    { hubUserId, subscription, userAgent = '' },
) {
    const normalized = normalizeSubscription(subscription);
    if (!normalized || !hubUserId) {
        throw new Error('Subscription ou hubUserId inválido');
    }

    const row = {
        hub_user_id: String(hubUserId),
        endpoint: normalized.endpoint,
        p256dh: normalized.keys.p256dh,
        auth: normalized.keys.auth,
        user_agent: String(userAgent || '').slice(0, 400) || null,
        updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
        method: 'POST',
        headers: headers(apiKey, {
            Prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(row),
    });
    const data = await parseJson(res);
    return Array.isArray(data) ? data[0] : data;
}

export async function deletePushSubscriptionByEndpoint(supabaseUrl, apiKey, endpoint) {
    if (!endpoint) return;
    const res = await fetch(
        `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
        {
            method: 'DELETE',
            headers: headers(apiKey, { Prefer: 'return=minimal' }),
        },
    );
    if (!res.ok && res.status !== 404) {
        await parseJson(res);
    }
}

export async function listPushSubscriptionsByHubUserId(supabaseUrl, apiKey, hubUserId) {
    if (!hubUserId) return [];
    const url =
        `${supabaseUrl}/rest/v1/push_subscriptions?hub_user_id=eq.${encodeURIComponent(hubUserId)}` +
        `&select=id,hub_user_id,endpoint,p256dh,auth,updated_at`;
    const res = await fetch(url, { headers: headers(apiKey) });
    if (res.status === 404) return [];
    const data = await parseJson(res);
    return Array.isArray(data) ? data : [];
}

export function toWebPushSubscription(row) {
    if (!row?.endpoint || !row?.p256dh || !row?.auth) return null;
    return {
        endpoint: row.endpoint,
        keys: {
            p256dh: row.p256dh,
            auth: row.auth,
        },
    };
}

export async function listOpenOrdersForStatusPush(supabaseUrl, apiKey, { limit = 80 } = {}) {
    const safeLimit = Math.min(120, Math.max(1, Number(limit) || 80));
    const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
        select: 'id,status,financial_status,hub_user_id,hub_pedido_id,last_notified_track_key,channel,created_at',
        status: 'not.in.(cancelled)',
        channel: 'eq.parceiros',
        hub_user_id: 'not.is.null',
        created_at: `gte.${since}`,
        order: 'created_at.desc',
        limit: String(safeLimit),
    });
    const res = await fetch(`${supabaseUrl}/rest/v1/orders?${params}`, {
        headers: headers(apiKey),
    });
    const data = await parseJson(res);
    const rows = Array.isArray(data) ? data : [];
    return rows.filter((row) => {
        const fs = String(row.financial_status || '').toLowerCase();
        if (fs === 'cancelado') return false;
        const key = String(row.last_notified_track_key || '');
        /* Já notificou entregue/cancelado e não mudou mais — evita varrer eterno. */
        if (/:(1)$/.test(key) && key.startsWith('0:')) return false;
        if (/^4:/.test(key)) return false;
        return true;
    });
}

/**
 * Atualiza last_notified_track_key só se ainda for o valor antigo (evita duplicar push).
 * @returns {boolean} true se ganhou o "lock" e deve enviar
 */
export async function claimOrderTrackNotify(
    supabaseUrl,
    apiKey,
    orderId,
    previousKey,
    nextKey,
) {
    if (!orderId || !nextKey || previousKey === nextKey) return false;

    let url = `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`;
    if (previousKey == null || previousKey === '') {
        url += '&last_notified_track_key=is.null';
    } else {
        url += `&last_notified_track_key=eq.${encodeURIComponent(previousKey)}`;
    }

    const res = await fetch(url, {
        method: 'PATCH',
        headers: headers(apiKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({
            last_notified_track_key: nextKey,
            updated_at: new Date().toISOString(),
        }),
    });
    const data = await parseJson(res);
    const row = Array.isArray(data) ? data[0] : data;
    return Boolean(row?.id);
}

export async function seedOrderTrackKey(supabaseUrl, apiKey, orderId, trackKey) {
    if (!orderId || !trackKey) return;
    await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: headers(apiKey, { Prefer: 'return=minimal' }),
        body: JSON.stringify({
            last_notified_track_key: trackKey,
            updated_at: new Date().toISOString(),
        }),
    });
}
