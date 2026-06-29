import { requireHubSession } from '../account/_require-hub-session.mjs';
import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import {
    listOrdersByHubUserId,
    publicOrderView,
    dbFromPaymentConfig,
} from '../../scripts/supabase-orders.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const payConfig = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await requireHubSession(req);
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const missing = assertOrderBackend(payConfig);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing });
    }

    try {
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 15));
        const db = dbFromPaymentConfig(payConfig);
        const rows = await listOrdersByHubUserId(db.url, db.key, session.userId, {
            limit,
            channel: 'parceiros',
        });
        return res.status(200).json({
            orders: rows.map((row) => publicOrderView(row)).filter(Boolean),
        });
    } catch (err) {
        console.error('orders/mine', err);
        return res.status(500).json({ error: err.message || 'Erro ao listar pedidos.' });
    }
}
