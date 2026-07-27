import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import { dbFromPaymentConfig } from '../../scripts/supabase-orders.mjs';
import { deletePushSubscriptionByEndpoint } from '../../scripts/push-subscriptions.mjs';

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

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const endpoint = String(body.endpoint || body.subscription?.endpoint || '').trim();
    if (!endpoint) {
        return res.status(400).json({ error: 'endpoint obrigatório' });
    }

    try {
        const db = dbFromPaymentConfig(payConfig);
        await deletePushSubscriptionByEndpoint(db.url, db.key, endpoint);
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('push/unsubscribe', err);
        return res.status(500).json({ error: err?.message || 'Falha ao remover inscrição.' });
    }
}
