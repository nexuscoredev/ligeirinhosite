import { patchOrder } from './supabase-orders.mjs';
import { ensureHubPedidoNfParceiros } from './hub-parceiro-pedido.mjs';

const ONLINE_METHODS = new Set(['pix', 'mercado_pago', 'cartao']);

function orderNeedsPayment(order) {
    if (order.status === 'paid') return false;
    const method = String(order.payment_method || '').toLowerCase();
    if (ONLINE_METHODS.has(method)) return true;
    return String(order.financial_status || '') === 'em_cobranca';
}

export function initialNfQueueStatus(order) {
    if (!order?.wants_invoice) return 'none';
    if (orderNeedsPayment(order)) return 'pending_payment';
    return 'pending';
}

export async function maybeEnqueueParceiroNf(order, env = process.env, db = null) {
    if (!order?.wants_invoice) return null;
    if (String(order.channel || 'parceiros').toLowerCase() === 'totem') return null;
    if (order.nf_queue_status === 'queued' && order.hub_pedido_id) {
        return { id: order.hub_pedido_id };
    }

    if (orderNeedsPayment(order)) {
        if (db && order.nf_queue_status !== 'pending_payment') {
            await patchOrder(db.url, db.key, order.id, { nf_queue_status: 'pending_payment' }, { useRpc: db.useRpc });
        }
        return null;
    }

    try {
        const hubPedido = await ensureHubPedidoNfParceiros(order, env);
        if (!hubPedido?.id) {
            if (db) {
                await patchOrder(db.url, db.key, order.id, { nf_queue_status: 'failed' }, { useRpc: db.useRpc });
            }
            return null;
        }

        if (db) {
            await patchOrder(
                db.url,
                db.key,
                order.id,
                {
                    hub_pedido_id: hubPedido.id,
                    nf_queue_status: 'queued',
                },
                { useRpc: db.useRpc },
            );
        }

        return hubPedido;
    } catch (err) {
        console.error('maybeEnqueueParceiroNf', err);
        if (db) {
            try {
                await patchOrder(db.url, db.key, order.id, { nf_queue_status: 'failed' }, { useRpc: db.useRpc });
            } catch {
                /* ignore */
            }
        }
        return null;
    }
}
