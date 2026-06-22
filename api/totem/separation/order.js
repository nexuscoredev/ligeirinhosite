import { paymentEnv, assertOrderBackend } from '../../../scripts/payment-env.mjs';
import { requireSeparationAuth } from '../../../scripts/separation-auth.mjs';
import { fetchPickItems, pickItem } from '../../../scripts/supabase-separation.mjs';
import { fetchOrderById } from '../../../scripts/supabase-orders.mjs';
import { pickProgress } from '../../../scripts/separation-utils.mjs';
import { maybeInitSeparation } from '../../../scripts/separation-init.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const orderId = String(req.query.id || req.body?.orderId || '').trim();
    if (!UUID_RE.test(orderId)) {
        return res.status(400).json({ error: 'Pedido inválido' });
    }

    try {
        if (req.method === 'GET') {
            let order = await fetchOrderById(cfg.supabaseUrl, cfg.supabaseServiceKey, orderId);
            if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
            await maybeInitSeparation(cfg.supabaseUrl, cfg.supabaseServiceKey, order, process.env);
            const items = await fetchPickItems(cfg.supabaseUrl, cfg.supabaseServiceKey, orderId);
            order = await fetchOrderById(cfg.supabaseUrl, cfg.supabaseServiceKey, orderId);
            return res.status(200).json({
                order: {
                    id: order.id,
                    total: order.total,
                    customerName: order.customer_name,
                    totemLabel: order.totem_label,
                    separationStatus: order.separation_status,
                    createdAt: order.created_at,
                },
                items,
                progress: pickProgress(items),
            });
        }

        if (req.method === 'POST') {
            const { itemId, delta } = req.body || {};
            if (!itemId) return res.status(400).json({ error: 'itemId obrigatório' });
            const result = await pickItem(cfg.supabaseUrl, cfg.supabaseServiceKey, {
                orderId,
                itemId,
                pickedBy: auth.user.name || auth.user.login,
                delta: Number(delta) || 1,
            });
            return res.status(200).json(result);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('separation/order', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro na separação' });
    }
}
