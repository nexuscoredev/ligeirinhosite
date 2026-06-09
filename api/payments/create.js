import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import { fetchOrderById, patchOrder, publicOrderView } from '../../scripts/supabase-orders.mjs';
import {
    mpCreatePayment,
    buildPaymentBody,
    mapMpStatusToOrder,
    extractPixFromPayment,
} from '../../scripts/mercadopago-api.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const missing = assertPaymentBackend(config);
    if (missing.length) {
        return res.status(503).json({ error: 'Pagamento não configurado', missing });
    }

    try {
        const { orderId, formData } = req.body || {};
        const id = String(orderId || '').trim();
        if (!UUID_RE.test(id)) {
            return res.status(400).json({ error: 'Pedido inválido' });
        }
        if (!formData?.payment_method_id) {
            return res.status(400).json({ error: 'Dados de pagamento incompletos' });
        }

        const order = await fetchOrderById(config.supabaseUrl, config.supabaseServiceKey, id);
        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }
        if (order.status === 'paid') {
            return res.status(200).json({ status: 'approved', order: publicOrderView(order) });
        }
        if (!['pending', 'pending_payment', 'failed'].includes(order.status)) {
            return res.status(409).json({ error: 'Pedido não pode ser pago neste status' });
        }

        const notificationUrl = `${config.appBaseUrl}/api/payments/webhook`;
        const paymentBody = buildPaymentBody(order, formData, notificationUrl);

        const payment = await mpCreatePayment(
            config.mpAccessToken,
            paymentBody,
            `lig-order-${order.id}-${Date.now()}`
        );

        const pix = extractPixFromPayment(payment);
        const orderStatus = mapMpStatusToOrder(payment.status);

        const updated = await patchOrder(config.supabaseUrl, config.supabaseServiceKey, order.id, {
            status: orderStatus,
            mp_payment_id: payment.id,
            mp_status: payment.status,
            mp_status_detail: payment.status_detail || null,
            pix_qr_code: pix?.qr_code || null,
            pix_qr_base64: pix?.qr_code_base64 || null,
        });

        return res.status(200).json({
            status: payment.status,
            statusDetail: payment.status_detail,
            paymentId: payment.id,
            order: publicOrderView(updated),
            pix: pix || undefined,
        });
    } catch (err) {
        console.error('payments/create', err.details || err);
        return res.status(err.status || 500).json({
            error: err.message || 'Erro ao processar pagamento',
            details: err.details?.cause || undefined,
        });
    }
}
