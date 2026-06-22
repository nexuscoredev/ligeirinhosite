import { paymentEnv, assertOrderBackend } from '../../../scripts/payment-env.mjs';
import { requireCaixaAuth } from '../../../scripts/pdv-caixa-auth.mjs';
import { lookupTotemOrderByCode, enrichTotemLookup } from '../../../scripts/hub-totem-pedido.mjs';
import { dbFromPaymentConfig } from '../../../scripts/supabase-orders.mjs';

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const auth = await requireCaixaAuth(req, process.env);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const cfg = paymentEnv(process.env, host ? `${proto}://${host}` : null);
    const missing = assertOrderBackend(cfg);
    if (missing.length) return res.status(503).json({ error: 'Backend não configurado', missing });

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const code = String(req.query?.code || req.query?.q || '').trim();
        if (!code) return res.status(400).json({ error: 'Informe o código do pedido' });

        const db = dbFromPaymentConfig(cfg);
        const order = await lookupTotemOrderByCode(db.url, db.key, code);
        const view = await enrichTotemLookup(order, process.env);

        return res.status(200).json({ order: view });
    } catch (err) {
        console.error('caixa/lookup', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao buscar pedido' });
    }
}
