import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import { dbFromPaymentConfig, publicOrderView, fetchOrderById } from '../../scripts/supabase-orders.mjs';
import { ensureHubPedidoForTotem } from '../../scripts/hub-totem-pedido.mjs';
import { selectTotemPayment, normalizeTotemPaymentMethod } from '../../scripts/supabase-caixa.mjs';
import { validarPagamentoTotemSemCartaoComPromo } from '../../scripts/lib/totem-promo-payment.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const config = paymentEnv(process.env, host ? `${proto}://${host}` : null);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const missing = assertOrderBackend(config);
    if (missing.length) {
        return res.status(503).json({ error: 'Pedidos não configurados', missing });
    }

    try {
        const { orderId, method, paymentMethod, paymentSplits } = req.body || {};
        const id = String(orderId || '').trim();
        if (!id) {
            return res.status(400).json({ error: 'Informe o pedido' });
        }

        const rawMethod = method || paymentMethod;
        if (!rawMethod && !(Array.isArray(paymentSplits) && paymentSplits.length >= 1)) {
            return res.status(400).json({ error: 'Informe a forma de pagamento' });
        }

        const db = dbFromPaymentConfig(config);
        const orderPreview = await fetchOrderById(db.url, db.key, id, { useRpc: db.useRpc });
        if (!orderPreview) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }
        const promoCheck = validarPagamentoTotemSemCartaoComPromo(orderPreview, rawMethod, paymentSplits);
        if (!promoCheck.ok) {
            return res.status(400).json({ error: promoCheck.error });
        }

        const order = await selectTotemPayment(db.url, db.key, id, rawMethod, {
            useRpc: db.useRpc,
            paymentSplits,
        });
        if (!order?.id) {
            return res.status(500).json({ error: 'Pedido não retornado após registrar pagamento' });
        }
        await ensureHubPedidoForTotem(order, process.env);

        return res.status(200).json({
            orderId: order.id,
            paymentMethod: normalizeTotemPaymentMethod(order.payment_method),
            order: publicOrderView(order),
        });
    } catch (err) {
        console.error('orders/select-payment', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao registrar pagamento' });
    }
}
