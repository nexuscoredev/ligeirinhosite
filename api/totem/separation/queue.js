import { paymentEnv, assertOrderBackend } from '../../../scripts/payment-env.mjs';
import { requireSeparationAuth } from '../../../scripts/separation-auth.mjs';
import { listSeparationQueue } from '../../../scripts/supabase-separation.mjs';
import { dbFromPaymentConfig } from '../../../scripts/supabase-orders.mjs';

export const config = { maxDuration: 25 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const auth = requireSeparationAuth(req, process.env);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const cfg = paymentEnv(process.env, host ? `${proto}://${host}` : null);
    const missing = assertOrderBackend(cfg);
    if (missing.length) return res.status(503).json({ error: 'Backend não configurado', missing });

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const db = dbFromPaymentConfig(cfg);
        const queue = await listSeparationQueue(db.url, db.key, { useRpc: db.useRpc });
        return res.status(200).json({ queue });
    } catch (err) {
        console.error('separation/queue', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro na fila' });
    }
}
