import { paymentEnv, assertOrderBackend } from '../../../scripts/payment-env.mjs';
import { requireCaixaAuth } from '../../../scripts/pdv-caixa-auth.mjs';
import { confirmCaixaPayment } from '../../../scripts/supabase-caixa.mjs';
import { dbFromPaymentConfig, publicOrderView } from '../../../scripts/supabase-orders.mjs';

export const config = { maxDuration: 25 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const auth = await requireCaixaAuth(req, process.env);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const cfg = paymentEnv(process.env, host ? `${proto}://${host}` : null);
    const missing = assertOrderBackend(cfg);
    if (missing.length) return res.status(503).json({ error: 'Backend não configurado', missing });

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { orderId, pdvMethod, paymentMethod } = req.body || {};
        const id = String(orderId || '').trim();
        if (!id) return res.status(400).json({ error: 'Informe o pedido' });

        const db = dbFromPaymentConfig(cfg);
        const order = await confirmCaixaPayment(db.url, db.key, id, {
            pdvMethod: pdvMethod || paymentMethod,
            operator: auth.user?.login || auth.user?.name,
            env: process.env,
            useRpc: db.useRpc,
        });

        const hubPedido = order._hubPedido || null;

        return res.status(200).json({
            orderId: order.id,
            order: publicOrderView(order),
            hubPedidoNumero: hubPedido?.numero ?? null,
            hubPedidoId: hubPedido?.id ?? null,
        });
    } catch (err) {
        console.error('caixa/pay', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao confirmar pagamento' });
    }
}
