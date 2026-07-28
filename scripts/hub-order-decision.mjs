import { hubConfig } from './hub-auth.mjs';
import {
    fetchOrderById,
    patchOrder,
    publicOrderView,
} from './supabase-orders.mjs';
import {
    buildOrderTracking,
    fetchHubPedidoById,
    fetchHubPedidoByParceirosOrderId,
} from './hub-order-tracking.mjs';
import {
    claimOrderTrackNotify,
    deletePushSubscriptionByEndpoint,
    listPushSubscriptionsByHubUserId,
    toWebPushSubscription,
} from './push-subscriptions.mjs';
import {
    pushPayloadForTracking,
    sendPushNotification,
    trackKeyFromTracking,
    vapidConfig,
    assertVapidConfigured,
} from './web-push.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hubHeaders(config, token) {
    return {
        apikey: config.anonKey || config.serviceKey,
        Authorization: `Bearer ${token || config.serviceKey}`,
        'Content-Type': 'application/json',
    };
}

export async function assertPodeAlterarPedidoHub(config, token) {
    if (!config?.url || !token) return false;
    const res = await fetch(`${config.url}/rest/v1/rpc/pode_alterar_pedido`, {
        method: 'POST',
        headers: hubHeaders(config, token),
        body: '{}',
    });
    const data = await res.json().catch(() => null);
    return res.ok && data === true;
}

async function fetchOrderByHubPedidoId(supabaseUrl, apiKey, hubPedidoId) {
    if (!UUID_RE.test(hubPedidoId)) return null;
    const url =
        `${supabaseUrl}/rest/v1/orders?hub_pedido_id=eq.${encodeURIComponent(hubPedidoId)}` +
        `&select=*&order=created_at.desc&limit=1`;
    const res = await fetch(url, {
        headers: {
            apikey: apiKey,
            Authorization: `Bearer ${apiKey}`,
        },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    return Array.isArray(data) ? data[0] || null : data;
}

async function insertHubNotification(hub, { recipientUserId, senderUserId, title, body }) {
    if (!hub?.serviceKey || !recipientUserId || !title || !body) return false;
    const res = await fetch(`${hub.url}/rest/v1/hub_notifications`, {
        method: 'POST',
        headers: {
            apikey: hub.serviceKey,
            Authorization: `Bearer ${hub.serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({
            recipient_user_id: recipientUserId,
            sender_user_id: senderUserId || null,
            title: String(title).slice(0, 200),
            body: String(body).slice(0, 2000),
        }),
    });
    return res.ok;
}

async function notifyPartnerPush(db, order, tracking, env) {
    const hubUserId = String(order?.hub_user_id || '').trim();
    if (!hubUserId) return { pushed: false, reason: 'sem_hub_user' };

    const missing = assertVapidConfigured(vapidConfig(env));
    if (missing.length) return { pushed: false, reason: 'vapid_ausente' };

    const nextKey = trackKeyFromTracking(tracking);
    const prevKey = order.last_notified_track_key || null;
    if (prevKey === nextKey) return { pushed: false, reason: 'ja_notificado' };

    const claimed = await claimOrderTrackNotify(db.url, db.key, order.id, prevKey, nextKey);
    if (!claimed) return { pushed: false, reason: 'lock_falhou' };

    const subs = await listPushSubscriptionsByHubUserId(db.url, db.key, hubUserId);
    if (!subs.length) return { pushed: false, reason: 'sem_subscription', trackKey: nextKey };

    const view = publicOrderView(order);
    const payload = pushPayloadForTracking(view, tracking);
    let sent = false;
    for (const row of subs) {
        const subscription = toWebPushSubscription(row);
        if (!subscription) continue;
        const result = await sendPushNotification(subscription, payload, env);
        if (result.ok) sent = true;
        else if (result.gone) {
            await deletePushSubscriptionByEndpoint(db.url, db.key, subscription.endpoint);
        }
    }
    return { pushed: sent, trackKey: nextKey };
}

/**
 * Aplica aceite/recusa do Hub no pedido Parceiros e notifica o parceiro.
 */
export async function applyHubOrderDecision(
    {
        acao,
        orderId,
        hubPedidoId,
        hubPedidoNumero,
        justificativa,
        senderUserId,
    },
    db,
    env = process.env,
) {
    const hub = hubConfig(env);
    let order = null;

    if (orderId && UUID_RE.test(orderId)) {
        order = await fetchOrderById(db.url, db.key, orderId, { useRpc: db.useRpc });
    }
    if (!order && hubPedidoId && UUID_RE.test(hubPedidoId)) {
        order = await fetchOrderByHubPedidoId(db.url, db.key, hubPedidoId);
    }
    if (!order) {
        const err = new Error('Pedido Parceiros não encontrado.');
        err.status = 404;
        throw err;
    }

    if ((order.channel || 'parceiros') === 'totem') {
        const err = new Error('Pedidos Totem não usam este fluxo.');
        err.status = 400;
        throw err;
    }

    const patch = {};
    let hubPedido = null;

    if (hubPedidoId && !order.hub_pedido_id) {
        patch.hub_pedido_id = hubPedidoId;
    }

    if (acao === 'aceitar') {
        if (order.status === 'pending') {
            patch.status = 'confirmed';
        }
        if (Object.keys(patch).length) {
            order = (await patchOrder(db.url, db.key, order.id, patch, { useRpc: db.useRpc })) || {
                ...order,
                ...patch,
            };
        }
        hubPedido =
            (order.hub_pedido_id && (await fetchHubPedidoById(order.hub_pedido_id, env))) ||
            (await fetchHubPedidoByParceirosOrderId(order.id, env)) ||
            {
                id: order.hub_pedido_id || hubPedidoId || null,
                numero: hubPedidoNumero ?? null,
                status: 'em_andamento',
            };
    } else if (acao === 'recusar') {
        if (order.status !== 'cancelled') {
            patch.status = 'cancelled';
            patch.financial_status = 'cancelado';
            if (justificativa) {
                const note = String(justificativa).trim().slice(0, 500);
                const prev = String(order.notes || '').trim();
                patch.notes = prev
                    ? `${prev}\n\n[Recusa Hub] ${note}`
                    : `[Recusa Hub] ${note}`;
            }
            order = (await patchOrder(db.url, db.key, order.id, patch, { useRpc: db.useRpc })) || {
                ...order,
                ...patch,
            };
        }
        hubPedido = {
            id: order.hub_pedido_id || hubPedidoId || null,
            numero: hubPedidoNumero ?? null,
            status: 'cancelado',
        };
    } else {
        const err = new Error('Ação inválida.');
        err.status = 400;
        throw err;
    }

    const view = publicOrderView(order);
    const tracking = buildOrderTracking(view, hubPedido);
    const numeroLabel =
        hubPedidoNumero != null
            ? `#${hubPedidoNumero}`
            : tracking.hubNumero != null
              ? `#${tracking.hubNumero}`
              : String(order.id || '')
                    .replace(/-/g, '')
                    .slice(0, 8)
                    .toUpperCase();

    const notif =
        acao === 'aceitar'
            ? {
                  title: 'Pedido aceito',
                  body: `Seu pedido ${numeroLabel} foi aceito e já está em andamento no Ligeirinho.`,
              }
            : {
                  title: 'Pedido recusado',
                  body: justificativa?.trim()
                      ? `Seu pedido ${numeroLabel} foi recusado: ${justificativa.trim().slice(0, 280)}`
                      : `Seu pedido ${numeroLabel} foi recusado pela loja.`,
              };

    const hubNotified = await insertHubNotification(hub, {
        recipientUserId: order.hub_user_id,
        senderUserId,
        title: notif.title,
        body: notif.body,
    });

    const push = await notifyPartnerPush(db, order, tracking, env).catch((err) => {
        console.warn('hub-order-decision push', err?.message || err);
        return { pushed: false, reason: 'erro_push' };
    });

    return {
        order: view,
        tracking,
        notified: { hub: hubNotified, push: Boolean(push?.pushed), pushReason: push?.reason || null },
    };
}
