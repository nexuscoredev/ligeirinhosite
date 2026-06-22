import { paymentEnv, assertOrderBackend } from '../../../scripts/payment-env.mjs';
import { requireSeparationAuth } from '../../../scripts/separation-auth.mjs';
import { fetchPickItems, exportPickCsv } from '../../../scripts/supabase-separation.mjs';
import { fetchOrderById, dbFromPaymentConfig } from '../../../scripts/supabase-orders.mjs';
import { maybeInitSeparation } from '../../../scripts/separation-init.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
    const auth = requireSeparationAuth(req, process.env);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const cfg = paymentEnv(process.env, host ? `${proto}://${host}` : null);
    const missing = assertOrderBackend(cfg);
    if (missing.length) return res.status(503).json({ error: 'Backend não configurado', missing });

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const orderId = String(req.query.id || '').trim();
    if (!UUID_RE.test(orderId)) return res.status(400).json({ error: 'Pedido inválido' });

    try {
        const db = dbFromPaymentConfig(cfg);
        let order = await fetchOrderById(db.url, db.key, orderId, { useRpc: db.useRpc });
        if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
        await maybeInitSeparation(db.url, db.key, order, process.env, { useRpc: db.useRpc });
        const items = await fetchPickItems(db.url, db.key, orderId, { useRpc: db.useRpc });
        const csv = exportPickCsv(order, items);
        const code = String(order.id).slice(0, 8).toUpperCase();
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="separacao-${code}.csv"`);
        return res.status(200).send('\ufeff' + csv);
    } catch (err) {
        console.error('separation/export', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro na exportação' });
    }
}
