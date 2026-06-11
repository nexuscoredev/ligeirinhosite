import crypto from 'crypto';
import { paymentEnv, assertPaymentBackend } from '../../scripts/payment-env.mjs';
import { requireFinanceToken } from '../../scripts/finance-auth.mjs';
import { fetchOrderById, patchOrder } from '../../scripts/supabase-orders.mjs';
import {
    insertCharge,
    patchCharge,
    chargeView,
    fetchCustomerById,
} from '../../scripts/supabase-finance.mjs';
import {
    mpCreatePixPayment,
    mpCreatePreference,
    extractPixFromPayment,
} from '../../scripts/mercadopago-api.mjs';

export const config = { maxDuration: 30 };

const CHARGEABLE = new Set(['pendente', 'vencido', 'em_cobranca']);

function dueDateIso(dateStr) {
    if (!dateStr) return null;
    return `${dateStr}T23:59:59.000-03:00`;
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = requireFinanceToken(req, process.env);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const cfg = paymentEnv(process.env, origin);
    const missing = assertPaymentBackend(cfg);
    if (missing.length) return res.status(503).json({ error: 'Mercado Pago não configurado', missing });

    try {
        const orderId = req.body?.orderId;
        if (!orderId) return res.status(400).json({ error: 'orderId obrigatório' });

        const order = await fetchOrderById(cfg.supabaseUrl, cfg.supabaseServiceKey, orderId);
        if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

        const fs = order.financial_status || 'pendente';
        if (fs === 'pago') return res.status(400).json({ error: 'Pedido já está pago.' });
        if (fs === 'cancelado') return res.status(400).json({ error: 'Pedido cancelado.' });
        if (!CHARGEABLE.has(fs) && order.status !== 'pending' && order.status !== 'pending_payment') {
            return res.status(400).json({ error: 'Status financeiro não permite cobrança.' });
        }

        const mode = String(req.body?.mode || 'both').toLowerCase();
        const notificationUrl = `${cfg.appBaseUrl}/api/payments/webhook`;
        const successUrl = `${cfg.appBaseUrl}/pedido-confirmado.html?order=${encodeURIComponent(order.id)}`;
        const idempotencyKey = crypto.randomUUID();

        let pixPayment = null;
        let preference = null;

        if (mode === 'pix' || mode === 'both') {
            pixPayment = await mpCreatePixPayment(cfg.mpAccessToken, order, notificationUrl, idempotencyKey);
        }
        if (mode === 'link' || mode === 'both') {
            preference = await mpCreatePreference(cfg.mpAccessToken, {
                order,
                notificationUrl,
                successUrl,
                dueDateIso: dueDateIso(order.due_date),
            });
        }

        const pix = pixPayment ? extractPixFromPayment(pixPayment) : null;
        const paymentLink = preference?.init_point || preference?.sandbox_init_point || null;

        const charge = await insertCharge(cfg.supabaseUrl, cfg.supabaseServiceKey, {
            order_id: order.id,
            customer_id: order.customer_id || null,
            amount: Number(order.total),
            due_date: order.due_date || null,
            status: 'pending',
            mp_payment_id: pixPayment?.id || null,
            mp_preference_id: preference?.id || null,
            payment_link: paymentLink,
            pix_qr_code: pix?.qr_code || null,
            pix_qr_base64: pix?.qr_code_base64 || null,
            created_by: auth.user.login || auth.user.name,
        });

        await patchOrder(cfg.supabaseUrl, cfg.supabaseServiceKey, order.id, {
            financial_status: 'em_cobranca',
            latest_charge_id: charge.id,
            mp_payment_id: pixPayment?.id || order.mp_payment_id,
            pix_qr_code: pix?.qr_code || order.pix_qr_code,
            pix_qr_base64: pix?.qr_code_base64 || order.pix_qr_base64,
            payment_method: 'mercado_pago',
        });

        return res.status(201).json({
            charge: chargeView(charge),
            paymentLink,
            pixQrCode: pix?.qr_code || null,
            pixQrBase64: pix?.qr_code_base64 || null,
            whatsappMessage: buildWhatsAppMessage(order, paymentLink || pix?.ticket_url),
        });
    } catch (err) {
        console.error('finance/charges/create', err);
        return res.status(err.status || 500).json({
            error: err.message || 'Erro ao gerar cobrança.',
            details: err.details || undefined,
        });
    }
}

function buildWhatsAppMessage(order, link) {
    const num = String(order.id).slice(0, 8).toUpperCase();
    const valor = Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const venc = order.due_date
        ? new Date(order.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
        : '—';
    return `Olá, segue o link para pagamento do pedido #${num}.\nValor: ${valor}\nVencimento: ${venc}\nLink: ${link || '(PIX gerado no painel)'}`;
}
