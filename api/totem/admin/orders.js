import { paymentEnv, assertOrderBackend } from '../../../scripts/payment-env.mjs';
import { requireTotemAdminAuth } from '../../../scripts/totem-admin-auth.mjs';
import {
    dbFromPaymentConfig,
    listTotemPendingOrders,
    publicOrderView,
} from '../../../scripts/supabase-orders.mjs';

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    const auth = await requireTotemAdminAuth(req, process.env);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const cfg = paymentEnv(process.env, host ? `${proto}://${host}` : null);
    const missing = assertOrderBackend(cfg);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend não configurado', missing });
    }

    try {
        const db = dbFromPaymentConfig(cfg);
        const unitId = String(req.query?.unitId || req.query?.unit || '').trim() || null;
        const limit = Number(req.query?.limit) || 50;
        const rows = await listTotemPendingOrders(db.url, db.key, {
            limit,
            unitId,
            useRpc: db.useRpc,
        });
        const orders = rows.map((row) => publicOrderView(row)).filter(Boolean);
        return res.status(200).json({ orders, count: orders.length });
    } catch (err) {
        console.error('[api/totem/admin/orders]', err.message || err);
        return res.status(err.status || 500).json({ error: err.message || 'Falha ao listar pedidos.' });
    }
}
