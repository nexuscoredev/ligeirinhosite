import { paymentEnv, assertOrderBackend } from '../../../scripts/payment-env.mjs';
import { lookupTotemOrderForRefill } from '../../../scripts/lib/totem-order-refill.mjs';
import { dbFromPaymentConfig } from '../../../scripts/supabase-orders.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
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
        const code = String(req.query?.code || req.query?.q || '').trim();
        if (!code) {
            return res.status(400).json({ error: 'Informe o código do pedido (ex.: PED 4F4F).' });
        }

        const db = dbFromPaymentConfig(cfg);
        const view = await lookupTotemOrderForRefill(db.url, db.key, code);
        return res.status(200).json({ order: view });
    } catch (err) {
        console.error('totem/order/items', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao buscar pedido' });
    }
}
