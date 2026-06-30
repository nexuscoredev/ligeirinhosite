import { paymentEnv, assertPixBackend } from '../../scripts/payment-env.mjs';
import { fetchOrderById, patchOrder, publicOrderView, dbFromPaymentConfig } from '../../scripts/supabase-orders.mjs';
import { createPixCharge } from '../../scripts/pix-provider.mjs';
import { maybeInitSeparation } from '../../scripts/separation-init.mjs';

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

    const missing = assertPixBackend(config, process.env);
    if (missing.length) {
        return res.status(503).json({ error: 'PIX indisponível', missing });
    }

    try {
        const { orderId } = req.body || {};
        const id = String(orderId || '').trim();
        if (!UUID_RE.test(id)) {
            return res.status(400).json({ error: 'Pedido inválido' });
        }

        const db = dbFromPaymentConfig(config);
        const order = await fetchOrderById(db.url, db.key, id, { useRpc: db.useRpc });
        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }
        if (order.status === 'paid') {
            return res.status(200).json({ status: 'approved', order: publicOrderView(order) });
        }
        if (order.status === 'pending_payment' && order.pix_qr_code) {
            return res.status(200).json({
                status: 'pending',
                provider: order.pix_provider || config.pixProvider,
                order: publicOrderView(order),
                pix: {
                    qr_code: order.pix_qr_code,
                    qr_code_base64: order.pix_qr_base64,
                },
            });
        }
        if (!['pending', 'failed'].includes(order.status)) {
            return res.status(409).json({ error: 'Pedido não pode receber PIX neste status' });
        }

        const notificationUrl =
            config.pixProvider === 'santander'
                ? `${config.appBaseUrl}/api/payments/webhook-santander`
                : `${config.appBaseUrl}/api/payments/webhook`;

        const charge = await createPixCharge({
            env: process.env,
            config,
            order,
            notificationUrl,
        });

        const orderStatus = charge.orderStatus;
        const patch = {
            status: orderStatus,
            payment_method: 'pix',
            pix_provider: charge.provider,
            pix_txid: charge.txid || null,
            pix_qr_code: charge.pix?.qr_code || null,
            pix_qr_base64: charge.pix?.qr_code_base64 || null,
            ...(orderStatus === 'paid' ? { paid_at: new Date().toISOString() } : {}),
        };

        if (charge.provider === 'mercadopago') {
            patch.mp_payment_id = charge.mpPaymentId;
            patch.mp_status = charge.providerStatus;
            patch.mp_status_detail = charge.providerStatusDetail;
        }

        const updated = await patchOrder(db.url, db.key, order.id, patch, { useRpc: db.useRpc });

        if (orderStatus === 'paid') {
            await maybeInitSeparation(db.url, db.key, updated, process.env, { useRpc: db.useRpc });
        }

        return res.status(200).json({
            status: charge.providerStatus,
            provider: charge.provider,
            order: publicOrderView(updated),
            pix: charge.pix || undefined,
        });
    } catch (err) {
        console.error('payments/pix', err.details || err);
        return res.status(err.status || 500).json({
            error: err.message || 'Erro ao gerar PIX',
            details: err.details?.cause || err.details || undefined,
        });
    }
}
