import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import {
    fetchOrderById,
    fetchOrderByMpPaymentId,
    patchOrder,
    dbFromPaymentConfig,
} from '../../scripts/supabase-orders.mjs';
import {
    mpGetPayment,
    mapMpStatusToOrder,
    mapMpStatusToFinancial,
    extractPixFromPayment,
} from '../../scripts/mercadopago-api.mjs';
import {
    fetchChargeByMpPaymentId,
    patchCharge,
    releaseCredit,
    getFinanceSettings,
    getOrCreateWallet,
    walletTransaction,
    insertPaymentEvent,
} from '../../scripts/supabase-finance.mjs';
import { maybeInitSeparation } from '../../scripts/separation-init.mjs';
import { maybeEnqueueParceiroNf } from '../../scripts/parceiro-nf-queue.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function applyCashback(config, order) {
    if (!order.customer_id) return;
    try {
        const settings = await getFinanceSettings(config.supabaseUrl, config.supabaseServiceKey);
        const pct = Number(settings?.cashback_percent_default) || 0;
        if (pct <= 0) return;
        const amount = Math.round(Number(order.total) * (pct / 100) * 100) / 100;
        if (amount <= 0) return;
        const wallet = await getOrCreateWallet(
            config.supabaseUrl,
            config.supabaseServiceKey,
            order.customer_id,
            order.hub_user_id
        );
        await walletTransaction(config.supabaseUrl, config.supabaseServiceKey, {
            walletId: wallet.id,
            type: 'cashback',
            amount,
            description: `Cashback ${pct}% pedido #${String(order.id).slice(0, 8).toUpperCase()}`,
            orderId: order.id,
            createdBy: 'webhook',
        });
    } catch (err) {
        console.error('cashback', err);
    }
}

async function syncPayment(config, paymentId, reqBody) {
    const payment = await mpGetPayment(config.mpAccessToken, paymentId);
    const orderId = payment.external_reference;
    const db = dbFromPaymentConfig(config);
    let order = null;

    if (orderId && UUID_RE.test(orderId)) {
        order = await fetchOrderById(db.url, db.key, orderId, { useRpc: db.useRpc });
    }
    if (!order) {
        order = await fetchOrderByMpPaymentId(db.url, db.key, paymentId, { useRpc: db.useRpc });
    }
    if (!order) return null;

    const pix = extractPixFromPayment(payment);
    const orderStatus = mapMpStatusToOrder(payment.status);
    const financialStatus = mapMpStatusToFinancial(payment.status);
    const paidAt = payment.status === 'approved' ? new Date().toISOString() : order.paid_at;

    const patch = {
        status: orderStatus,
        financial_status: financialStatus,
        mp_payment_id: payment.id,
        mp_status: payment.status,
        mp_status_detail: payment.status_detail || null,
        mp_transaction_id: String(payment.id),
        pix_qr_code: pix?.qr_code || order.pix_qr_code,
        pix_qr_base64: pix?.qr_code_base64 || order.pix_qr_base64,
    };
    if (paidAt) patch.paid_at = paidAt;

    await patchOrder(db.url, db.key, order.id, patch, { useRpc: db.useRpc });

    if (payment.status === 'approved') {
        await maybeInitSeparation(db.url, db.key, {
            ...order,
            status: orderStatus,
            paid_at: paidAt,
        }, process.env, { useRpc: db.useRpc });
        await maybeEnqueueParceiroNf(
            {
                ...order,
                status: orderStatus,
                financial_status: financialStatus,
                paid_at: paidAt,
            },
            process.env,
            db,
        );
    }

    let charge = await fetchChargeByMpPaymentId(config.supabaseUrl, config.supabaseServiceKey, paymentId);
    if (charge) {
        await patchCharge(config.supabaseUrl, config.supabaseServiceKey, charge.id, {
            status: payment.status === 'approved' ? 'approved' : charge.status,
            paid_at: payment.status === 'approved' ? paidAt : charge.paid_at,
            mp_transaction_id: String(payment.id),
        });
    }

    if (payment.status === 'approved' && order.customer_id) {
        await releaseCredit(config.supabaseUrl, config.supabaseServiceKey, order.customer_id, Number(order.total));
        await applyCashback(config, order);
    }

    await insertPaymentEvent(config.supabaseUrl, config.supabaseServiceKey, {
        source: 'mercadopago',
        event_type: payment.status,
        mp_payment_id: payment.id,
        order_id: order.id,
        charge_id: charge?.id || null,
        payload: { status: payment.status, status_detail: payment.status_detail, body: reqBody || null },
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
            await syncPayment(config, paymentId, req.body);
        } else if (req.body?.action?.startsWith('payment.') && req.body?.data?.id) {
            await syncPayment(config, req.body.data.id, req.body);
        }

        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error('payments/webhook', err);
        return res.status(200).json({ ok: true });
    }
}
