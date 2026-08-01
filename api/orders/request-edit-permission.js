import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { collectParceiroOrderLookup } from '../../scripts/hub-parceiro.mjs';
import { hubConfig } from '../../scripts/hub-auth.mjs';
import { paymentEnv, assertOrderBackend } from '../../scripts/payment-env.mjs';
import {
    fetchOrderById,
    patchOrder,
    publicOrderView,
    dbFromPaymentConfig,
} from '../../scripts/supabase-orders.mjs';
import {
    fetchHubPedidoById,
    fetchHubPedidoByParceirosOrderId,
    buildOrderTracking,
} from '../../scripts/hub-order-tracking.mjs';
import {
    appendEditRequestNote,
    evaluateOrderEditPolicy,
    resolveAccountCnpj,
} from '../../scripts/lib/order-edit-policy.mjs';

export const config = { maxDuration: 15 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function appendHubEditRequest(order, env) {
    const hub = hubConfig(env);
    if (!hub.serviceKey || !order?.id) return null;

    let hubPedido = null;
    if (order.hub_pedido_id) {
        const url =
            `${hub.url}/rest/v1/pedidos?select=id,observacoes` +
            `&id=eq.${encodeURIComponent(order.hub_pedido_id)}&limit=1`;
        const res = await fetch(url, {
            headers: { apikey: hub.anonKey, Authorization: `Bearer ${hub.serviceKey}` },
        });
        const rows = res.ok ? await res.json() : [];
        hubPedido = Array.isArray(rows) ? rows[0] : null;
    }
    if (!hubPedido) {
        const url =
            `${hub.url}/rest/v1/pedidos?select=id,observacoes` +
            `&parceiros_order_id=eq.${encodeURIComponent(order.id)}&limit=1`;
        const res = await fetch(url, {
            headers: { apikey: hub.anonKey, Authorization: `Bearer ${hub.serviceKey}` },
        });
        const rows = res.ok ? await res.json() : [];
        hubPedido = Array.isArray(rows) ? rows[0] : null;
    }
    if (!hubPedido?.id) return null;

    const stamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const suffix = `Cliente solicitou permissão para editar pedido (${stamp})`;
    const observacoes = `${String(hubPedido.observacoes || '').trim()} · ${suffix}`.trim().slice(0, 2000);

    const patchUrl = `${hub.url}/rest/v1/pedidos?id=eq.${encodeURIComponent(hubPedido.id)}`;
    await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
            apikey: hub.anonKey,
            Authorization: `Bearer ${hub.serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ observacoes }),
    }).catch(() => null);

    return hubPedido;
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
        console.error('orders/request-edit-permission session', err);
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
    const orderId = String(body.orderId || body.id || '').trim();
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
            return res.status(403).json({ error: 'Você não pode solicitar edição deste pedido.' });
        }

        const hubPedido =
            (order.hub_pedido_id && (await fetchHubPedidoById(order.hub_pedido_id))) ||
            (await fetchHubPedidoByParceirosOrderId(order.id));
        const accountCnpj = resolveAccountCnpj(lookup.cnpjDigits || session.usuario, order);
        const policy = evaluateOrderEditPolicy(order, {
            accountCnpj,
            hubStatus: hubPedido?.status,
        });

        if (policy.canEdit) {
            return res.status(200).json({
                ok: true,
                alreadyAllowed: true,
                message: 'Este pedido já pode ser editado.',
            });
        }

        if (!policy.canRequestEdit) {
            const message =
                policy.editPermissionRequested
                    ? 'Solicitação já enviada. Aguarde a liberação da loja.'
                    : policy.editBlockedReason === 'delivery_day'
                      ? 'Não é possível solicitar edição deste pedido hoje.'
                      : 'Este pedido não pode ser editado.';
            return res.status(409).json({ error: message, policy });
        }

        const notes = appendEditRequestNote(order.notes);
        const updated = await patchOrder(db.url, db.key, order.id, { notes }, { useRpc: db.useRpc });
        await appendHubEditRequest(updated || { ...order, notes }, process.env);

        const view = publicOrderView(updated || { ...order, notes });
        const tracking = buildOrderTracking(view, hubPedido, { accountCnpj });
        return res.status(200).json({
            ok: true,
            message: 'Solicitação enviada. A loja vai analisar e liberar a edição se necessário.',
            order: view,
            tracking,
        });
    } catch (err) {
        console.error('orders/request-edit-permission', err);
        return res.status(500).json({ error: err.message || 'Erro ao solicitar permissão.' });
    }
}
