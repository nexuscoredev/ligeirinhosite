import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import {
    fetchOrderById,
    fetchOrderByMpPaymentId,
    patchOrder,
} from '../../scripts/supabase-orders.mjs';
import { mpGetPayment, mapMpStatusToOrder, extractPixFromPayment } from '../../scripts/mercadopago-api.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function syncPayment(config, paymentId) {
    const payment = await mpGetPayment(config.mpAccessToken, paymentId);
    const orderId = payment.external_reference;
    let order = null;

    if (orderId && UUID_RE.test(orderId)) {
        order = await fetchOrderById(config.supabaseUrl, config.supabaseServiceKey, orderId);
    }
    if (!order) {
        order = await fetchOrderByMpPaymentId(config.supabaseUrl, config.supabaseServiceKey, paymentId);
    }
    if (!order) return null;

    const pix = extractPixFromPayment(payment);
    await patchOrder(config.supabaseUrl, config.supabaseServiceKey, order.id, {
        status: mapMpStatusToOrder(payment.status),
        mp_payment_id: payment.id,
        mp_status: payment.status,
        mp_status_detail: payment.status_detail || null,
        pix_qr_code: pix?.qr_code || order.pix_qr_code,
        pix_qr_base64: pix?.qr_code_base64 || order.pix_qr_base64,
    });

    return order.id;
}

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const config = paymentEnv(process.env, origin);

    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const missing = assertPaymentBackend(config);
    if (missing.length) {
        return res.status(503).json({ ok: false, missing });
    }

    try {
        const topic = req.query.topic || req.query.type || req.body?.type;
        const paymentId =
            req.query.id ||
            req.query['data.id'] ||
            req.body?.data?.id ||
            req.body?.id;

        if (topic === 'payment' && paymentId) {
            await syncPayment(config, paymentId);
        } else if (req.body?.action?.startsWith('payment.') && req.body?.data?.id) {
            await syncPayment(config, req.body.data.id);
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('payments/webhook', err);
        return res.status(200).json({ ok: true });
    }
}
