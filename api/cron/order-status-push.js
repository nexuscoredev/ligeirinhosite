import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import { dbFromPaymentConfig, publicOrderView } from '../../scripts/supabase-orders.mjs';
import {
    fetchHubPedidoById,
    fetchHubPedidoByParceirosOrderId,
    buildOrderTracking,
} from '../../scripts/hub-order-tracking.mjs';
import {
    listOpenOrdersForStatusPush,
    listPushSubscriptionsByHubUserId,
    toWebPushSubscription,
    claimOrderTrackNotify,
    deletePushSubscriptionByEndpoint,
} from '../../scripts/push-subscriptions.mjs';
import {
    assertVapidConfigured,
    vapidConfig,
    trackKeyFromTracking,
    pushPayloadForTracking,
    sendPushNotification,
} from '../../scripts/web-push.mjs';

export const config = { maxDuration: 60 };

function authorizeCron(req, env = process.env) {
    const cronHeader = String(req.headers['x-vercel-cron'] || '');
    if (cronHeader === '1') return true;

    const secret = String(env.CRON_SECRET || '').trim();
    if (!secret) return false;
    const auth = String(req.headers.authorization || '');
    return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!authorizeCron(req, process.env)) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const payConfig = paymentEnv(process.env, origin);

    const vapidMissing = assertVapidConfigured(vapidConfig(process.env));
    if (vapidMissing.length) {
        return res.status(503).json({ error: 'VAPID ausente', missing: vapidMissing });
    }

    const backendMissing = assertOrderBackend(payConfig);
    if (backendMissing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing: backendMissing });
    }

    const db = dbFromPaymentConfig(payConfig);
    const summary = { checked: 0, notified: 0, skipped: 0, errors: 0, gone: 0 };

    try {
        const orders = await listOpenOrdersForStatusPush(db.url, db.key, { limit: 80 });
        const subCache = new Map();

        for (const order of orders) {
            summary.checked += 1;
            const hubUserId = String(order.hub_user_id || '').trim();
            if (!hubUserId) {
                summary.skipped += 1;
                continue;
            }

            let hubPedido = null;
            if (order.hub_pedido_id) {
                hubPedido = await fetchHubPedidoById(order.hub_pedido_id, process.env);
            }
            if (!hubPedido) {
                hubPedido = await fetchHubPedidoByParceirosOrderId(order.id, process.env);
            }

            const view = publicOrderView(order);
            const tracking = buildOrderTracking(view, hubPedido);
            const nextKey = trackKeyFromTracking(tracking);
            const prevKey = order.last_notified_track_key || null;

            if (prevKey == null || prevKey === '') {
                /* Primeira vez: só marca, sem notificar o status atual. */
                await claimOrderTrackNotify(db.url, db.key, order.id, prevKey, nextKey);
                summary.skipped += 1;
                continue;
            }

            if (prevKey === nextKey) {
                summary.skipped += 1;
                continue;
            }

            /* Pedido já finalizado/cancelado: marca e notifica uma última vez. */
            const claimed = await claimOrderTrackNotify(db.url, db.key, order.id, prevKey, nextKey);
            if (!claimed) {
                summary.skipped += 1;
                continue;
            }

            let subs = subCache.get(hubUserId);
            if (!subs) {
                subs = await listPushSubscriptionsByHubUserId(db.url, db.key, hubUserId);
                subCache.set(hubUserId, subs);
            }
            if (!subs.length) {
                summary.skipped += 1;
                continue;
            }

            const payload = pushPayloadForTracking(view, tracking);
            let sent = false;
            for (const row of subs) {
                const subscription = toWebPushSubscription(row);
                if (!subscription) continue;
                const result = await sendPushNotification(subscription, payload, process.env);
                if (result.ok) {
                    sent = true;
                } else if (result.gone) {
                    summary.gone += 1;
                    await deletePushSubscriptionByEndpoint(db.url, db.key, subscription.endpoint);
                } else {
                    summary.errors += 1;
                    console.error('order-status-push send', order.id, result.error);
                }
            }
            if (sent) summary.notified += 1;
            else summary.skipped += 1;

            if (tracking.cancelled || (tracking.step || 0) >= 4) {
                /* já marcado nextKey; nada mais */
            }
        }

        return res.status(200).json({ ok: true, ...summary });
    } catch (err) {
        console.error('cron/order-status-push', err);
        return res.status(500).json({
            error: err?.message || 'Falha no cron de status',
            hint: /push_subscriptions|last_notified_track_key|PGRST/i.test(String(err?.message || ''))
                ? 'Aplique scripts/push-schema-migration.sql no Supabase Parceiros.'
                : undefined,
            ...summary,
        });
    }
}
