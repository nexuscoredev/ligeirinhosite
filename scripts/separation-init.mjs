import { fetchOrderById } from './supabase-orders.mjs';
import { ensureSeparationForOrder } from './supabase-separation.mjs';

export async function maybeInitSeparation(url, key, order, env = process.env, { useRpc = false } = {}) {
    if (!order || order.status !== 'paid') return null;
    if (String(order.channel || '').toLowerCase() !== 'totem') return null;
    try {
        return await ensureSeparationForOrder(url, key, order, env, { useRpc });
    } catch (err) {
        console.error('separation-init', err.message || err);
        return null;
    }
}

export async function maybeInitSeparationById(url, key, orderId, env = process.env, opts = {}) {
    const order = await fetchOrderById(url, key, orderId, { useRpc: opts.useRpc });
    if (!order) return null;
    return maybeInitSeparation(url, key, order, env, opts);
}
