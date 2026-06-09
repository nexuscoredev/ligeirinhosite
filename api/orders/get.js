import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import { fetchOrderById, publicOrderView } from '../../scripts/supabase-orders.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const id = String(req.query.id || '').trim();
    if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    const missing = assertPaymentBackend(config);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing });
    }

    try {
        const order = await fetchOrderById(config.supabaseUrl, config.supabaseServiceKey, id);
        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }
        return res.status(200).json({ order: publicOrderView(order) });
    } catch (err) {
        console.error('orders/get', err);
        return res.status(500).json({ error: 'Erro ao buscar pedido' });
    }
}
