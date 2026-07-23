import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { collectParceiroOrderLookup } from '../../scripts/hub-parceiro.mjs';
import { cancelHubPedidoForParceiros } from '../../scripts/hub-parceiro-pedido.mjs';
import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import {
    fetchOrderById,
    patchOrder,
    publicOrderView,
    dbFromPaymentConfig,
} from '../../scripts/supabase-orders.mjs';
import { releaseCredit } from '../../scripts/supabase-finance.mjs';
import {
    fetchHubPedidoById,
    fetchHubPedidoByParceirosOrderId,
    buildOrderTracking,
} from '../../scripts/hub-order-tracking.mjs';

export const config = { maxDuration: 15 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CREDIT_METHODS = new Set(['fiado', 'credito', 'boleto', 'prazo']);

function orderOwnedByLookup(order, lookup) {
    if (!order) return false;
    const hubIds = new Set(
        [...(lookup.hubUserIds || []), ...(lookup.legacyHubUserIds || [])]
            .map((id) => String(id || '').trim())
            .filter(Boolean),
    );
    const emails = new Set(
        (lookup.emails || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean),
    );

    const orderHub = String(order.hub_user_id || '').trim();
    if (orderHub && hubIds.has(orderHub)) return true;

    const orderEmail = String(order.customer_email || '').trim().toLowerCase();
    if (orderEmail && emails.has(orderEmail)) return true;

    return false;
}

function orderUsesCredit(order) {
    const method = String(order.payment_method || '').toLowerCase();
    if (CREDIT_METHODS.has(method)) return true;
    const splits = Array.isArray(order.payment_splits) ? order.payment_splits : [];
    return splits.some((entry) => CREDIT_METHODS.has(String(entry?.method || '').toLowerCase()));
}

async function cancelPendingCharges(supabaseUrl, serviceKey, orderId) {
    if (!supabaseUrl || !serviceKey || !orderId) return;
    const url = `${supabaseUrl}/rest/v1/mp_charges?order_id=eq.${encodeURIComponent(orderId)}&status=eq.pending`;
    await fetch(url, {
        method: 'PATCH',
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() }),
    }).catch(() => null);
}

export default async function handler(req, res) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const origin = host ? `${proto}://${host}` : null;
    const payConfig = paymentEnv(process.env, origin);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let session;
    try {
        session = await requireAccountSession(req);
    } catch (err) {
        console.error('orders/cancel session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const missing = assertOrderBackend(payConfig);
    if (missing.length) {
        return res.status(503).json({ error: 'Backend indisponível', missing });
    }

    const body = req.body || {};
    const orderId = String(body.orderId || body.id || req.query?.id || '').trim();
    if (!UUID_RE.test(orderId)) {
        return res.status(400).json({ error: 'ID de pedido inválido' });
    }

    try {
        const db = dbFromPaymentConfig(payConfig);
        const order = await fetchOrderById(db.url, db.key, orderId, { useRpc: db.useRpc });
        if (!order) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        const authEmail = String(
            session.authUser?.email || session.usuario?.email || req.headers['x-account-email'] || '',
        ).trim();
        const lookup = await collectParceiroOrderLookup(session.config, session.usuario, {
            email: authEmail,
            sub: String(req.headers['x-auth-sub'] || body.sub || '').trim(),
        });

        if (!orderOwnedByLookup(order, lookup)) {
            return res.status(403).json({ error: 'Você não pode cancelar este pedido.' });
        }

        if ((order.channel || 'parceiros') !== 'parceiros') {
            return res.status(400).json({ error: 'Este pedido não pode ser cancelado por aqui.' });
        }

        if (order.status === 'cancelled') {
            const view = publicOrderView(order);
            const hubPedido =
                (view.hubPedidoId && (await fetchHubPedidoById(view.hubPedidoId))) ||
                (await fetchHubPedidoByParceirosOrderId(view.id));
            return res.status(200).json({
                order: view,
                tracking: buildOrderTracking(view, hubPedido),
                alreadyCancelled: true,
            });
        }

        if (order.status !== 'pending') {
            return res.status(409).json({
                error:
                    order.status === 'paid'
                        ? 'Pedido já confirmado. Fale com o suporte para cancelar.'
                        : 'Este pedido não está mais aguardando confirmação.',
            });
        }

        if (order.financial_status === 'pago') {
            return res.status(409).json({
                error: 'Pedido já pago. Fale com o suporte para cancelar.',
            });
        }

        const hubResult = await cancelHubPedidoForParceiros(order);
        if (!hubResult.ok) {
            return res.status(409).json({ error: hubResult.message, code: hubResult.code });
        }

        const updated = await patchOrder(
            db.url,
            db.key,
            order.id,
            {
                status: 'cancelled',
                financial_status: 'cancelado',
            },
            { useRpc: db.useRpc },
        );

        if (order.customer_id && orderUsesCredit(order) && order.financial_status !== 'cancelado') {
            try {
                await releaseCredit(
                    payConfig.supabaseUrl,
                    payConfig.supabaseServiceKey,
                    order.customer_id,
                    Number(order.total) || 0,
                );
            } catch (creditErr) {
                console.warn('orders/cancel releaseCredit', creditErr?.message || creditErr);
            }
        }

        await cancelPendingCharges(payConfig.supabaseUrl, payConfig.supabaseServiceKey, order.id);

        const view = publicOrderView(updated || { ...order, status: 'cancelled', financial_status: 'cancelado' });
        const tracking = buildOrderTracking(view, hubResult.hubPedido);
        return res.status(200).json({ order: view, tracking });
    } catch (err) {
        console.error('orders/cancel', err);
        return res.status(500).json({ error: err.message || 'Erro ao cancelar pedido.' });
    }
}
