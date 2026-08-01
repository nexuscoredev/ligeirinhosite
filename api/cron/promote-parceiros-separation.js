import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import { dbFromPaymentConfig } from '../../scripts/supabase-orders.mjs';
import { syncParceirosSeparationQueue } from '../../scripts/hub-parceiro-pedido.mjs';

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
    const missing = assertOrderBackend(payConfig);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing });
    }

    try {
        const db = dbFromPaymentConfig(payConfig);
        const summary = await syncParceirosSeparationQueue(db, process.env, { limit: 150 });
        return res.status(200).json({ ok: true, ...summary });
    } catch (err) {
        console.error('cron/promote-parceiros-separation', err);
        return res.status(500).json({ error: err?.message || 'Falha ao sincronizar fila de separação.' });
    }
}
