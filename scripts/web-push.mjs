import webpush from 'web-push';

/** Chave pública VAPID (pode ser sobrescrita por VAPID_PUBLIC_KEY). */
export const DEFAULT_VAPID_PUBLIC_KEY =
    'BF7bC0DoevFBew0cTc3n_yN8DRGgAhaepK64RlAvIvdnOireOCvsqH9-Tz_Trx5PMh38ZgbesR4dl_sLpWzBOvw';

export function vapidConfig(env = process.env) {
    const publicKey = String(env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY).trim();
    const privateKey = String(env.VAPID_PRIVATE_KEY || '').trim();
    const subject = String(env.VAPID_SUBJECT || 'mailto:parceiros@ligeirinho.app').trim();
    return { publicKey, privateKey, subject };
}

export function assertVapidConfigured(config = vapidConfig()) {
    const missing = [];
    if (!config.publicKey) missing.push('VAPID_PUBLIC_KEY');
    if (!config.privateKey) missing.push('VAPID_PRIVATE_KEY');
    return missing;
}

let configuredKey = '';

function ensureWebPush(config = vapidConfig()) {
    const missing = assertVapidConfigured(config);
    if (missing.length) {
        const err = new Error(`Web Push não configurado: ${missing.join(', ')}`);
        err.code = 'VAPID_MISSING';
        throw err;
    }
    const stamp = `${config.subject}|${config.publicKey}|${config.privateKey}`;
    if (configuredKey !== stamp) {
        webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
        configuredKey = stamp;
    }
}

export function trackKeyFromTracking(tracking) {
    const step = Number(tracking?.step) || 0;
    const hubStatus = String(tracking?.hubStatus || '').toLowerCase();
    const cancelled = tracking?.cancelled ? '1' : '0';
    return `${step}:${hubStatus}:${cancelled}`;
}

export function pushPayloadForTracking(order, tracking) {
    const shortId = String(order?.id || '')
        .replace(/-/g, '')
        .slice(0, 8)
        .toUpperCase();
    const title = tracking?.cancelled
        ? 'Pedido cancelado'
        : tracking?.headerTitle || tracking?.stepLabel || 'Atualização do pedido';
    const body =
        tracking?.message ||
        `Pedido ${shortId} · ${tracking?.stepLabel || 'Status atualizado'}`;
    const url = order?.id
        ? `/pedido-confirmado?order=${encodeURIComponent(order.id)}`
        : '/meus-pedidos';
    const trackKey = trackKeyFromTracking(tracking);
    return {
        title: `Ligeirinho · ${title}`,
        body,
        url,
        // Tag única por status → notificações em cascata (não substituem a anterior).
        tag: order?.id ? `order-${order.id}-${trackKey}` : `order-${trackKey}-${Date.now()}`,
        orderId: order?.id || null,
    };
}

/**
 * @returns {{ ok: boolean, gone?: boolean, error?: string }}
 */
export async function sendPushNotification(subscription, payload, env = process.env) {
    const config = vapidConfig(env);
    ensureWebPush(config);
    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), {
            TTL: 60 * 60 * 12,
            urgency: 'high',
        });
        return { ok: true };
    } catch (err) {
        const statusCode = Number(err?.statusCode || err?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
            return { ok: false, gone: true, error: err?.message || 'subscription gone' };
        }
        return { ok: false, error: err?.message || 'send failed' };
    }
}
