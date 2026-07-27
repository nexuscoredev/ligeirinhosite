import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import {
    dbFromPaymentConfig,
    fetchOrderById,
    publicOrderView,
} from '../../scripts/supabase-orders.mjs';
import {
    fetchHubPedidoById,
    fetchHubPedidoByParceirosOrderId,
    buildOrderTracking,
} from '../../scripts/hub-order-tracking.mjs';
import {
    normalizeSubscription,
    upsertPushSubscription,
    seedOrderTrackKey,
} from '../../scripts/push-subscriptions.mjs';
import { trackKeyFromTracking, assertVapidConfigured, vapidConfig } from '../../scripts/web-push.mjs';

export const config = { maxDuration: 15 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const payConfig = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const vapidMissing = assertVapidConfigured(vapidConfig(process.env));
    if (vapidMissing.length) {
        return res.status(503).json({
            error: 'Notificações push ainda não configuradas no servidor.',
            missing: vapidMissing,
        });
    }

    const backendMissing = assertOrderBackend(payConfig);
    if (backendMissing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing: backendMissing });
    }

    let session;
    try {
        session = await requireAccountSession(req);
        if (session?.error) {
            return res.status(session.status || 401).json({ error: session.error });
        }
    } catch (err) {
        return res.status(401).json({ error: err?.message || 'Não autenticado.' });
    }

    const hubUserId = String(session.userId || '').trim();
    if (!hubUserId) {
        return res.status(401).json({ error: 'Sessão sem usuário Hub.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const subscription = normalizeSubscription(body.subscription || body);
    if (!subscription) {
        return res.status(400).json({ error: 'Subscription inválida.' });
    }

    const orderId = String(body.orderId || '').trim();
    if (orderId && !UUID_RE.test(orderId)) {
        return res.status(400).json({ error: 'orderId inválido.' });
    }

    try {
        const db = dbFromPaymentConfig(payConfig);
        await upsertPushSubscription(db.url, db.key, {
            hubUserId,
            subscription,
            userAgent: String(req.headers['user-agent'] || ''),
        });

        if (orderId) {
            const order = await fetchOrderById(db.url, db.key, orderId, { useRpc: db.useRpc });
            if (order) {
                const view = publicOrderView(order);
                let hubPedido = null;
                if (view.hubPedidoId) {
                    hubPedido = await fetchHubPedidoById(view.hubPedidoId, process.env);
                }
                if (!hubPedido) {
                    hubPedido = await fetchHubPedidoByParceirosOrderId(view.id, process.env);
                }
                const tracking = buildOrderTracking(view, hubPedido);
                await seedOrderTrackKey(db.url, db.key, orderId, trackKeyFromTracking(tracking));
            }
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('push/subscribe', err);
        const hint = /push_subscriptions|schema cache|PGRST/i.test(String(err?.message || ''))
            ? 'Aplique scripts/push-schema-migration.sql no Supabase Parceiros.'
            : undefined;
        return res.status(500).json({
            error: err?.message || 'Não foi possível salvar a inscrição.',
            hint,
        });
    }
}
