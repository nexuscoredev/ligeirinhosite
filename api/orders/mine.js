import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { collectParceiroOrderLookup } from '../../scripts/hub-parceiro.mjs';
import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import {
    listParceiroOrders,
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

    let session;
    try {
        session = await requireAccountSession(req);
    } catch (err) {
        console.error('orders/mine session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const missing = assertOrderBackend(payConfig);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing });
    }

    try {
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
        const db = dbFromPaymentConfig(payConfig);
        const authEmail = String(
            session.authUser?.email || session.usuario?.email || req.headers['x-account-email'] || '',
        ).trim();
        const lookup = await collectParceiroOrderLookup(session.config, session.usuario, {
            email: authEmail,
            sub: String(req.headers['x-auth-sub'] || req.query.sub || '').trim(),
        });
        const rows = await listParceiroOrders(db.url, db.key, lookup, {
            limit,
            channel: 'parceiros',
            useRpc: db.useRpc,
        });
        return res.status(200).json({
            orders: rows.map((row) => publicOrderView(row)).filter(Boolean),
        });
    } catch (err) {
        console.error('orders/mine', err);
        return res.status(500).json({ error: err.message || 'Erro ao listar pedidos.' });
    }
}
