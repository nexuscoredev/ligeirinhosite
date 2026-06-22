import { fetchOrderById } from './supabase-orders.mjs';
import { ensureSeparationForOrder } from './supabase-separation.mjs';

export async function maybeInitSeparation(url, key, order, env = process.env) {
    if (!order || order.status !== 'paid') return null;
    if (String(order.channel || '').toLowerCase() !== 'totem') return null;
    try {
        return await ensureSeparationForOrder(url, key, order, env);
    } catch (err) {
        console.error('separation-init', err.message || err);
        return null;
    }
}

export async function maybeInitSeparationById(url, key, orderId, env = process.env) {
    const order = await fetchOrderById(url, key, orderId);
    if (!order) return null;
    return maybeInitSeparation(url, key, order, env);
}
