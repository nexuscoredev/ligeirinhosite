import { fetchCatalogFromHub } from './lib/hub-catalog.mjs';
import { fetchOrderById, patchOrder } from './supabase-orders.mjs';
import { buildPickLines, pickProgress, nextPickStatus, buildProductCategoryIndex } from './separation-utils.mjs';

async function sbFetch(url, key, path, options = {}) {
    const res = await fetch(`${url}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: options.prefer || 'return=representation',
            ...(options.headers || {}),
        },
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    if (!res.ok) {
        const err = new Error(data?.message || data?.error || text || `Supabase ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

async function sbRpc(url, key, fn, body) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    if (!res.ok) {
        const err = new Error(data?.message || data?.error || text || `Supabase RPC ${fn}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

export async function fetchPickItems(url, key, orderId, { useRpc = false } = {}) {
    if (useRpc) {
        const rows = await sbRpc(url, key, 'rpc_fetch_pick_items', { p_order_id: orderId });
        return Array.isArray(rows) ? rows : [];
    }
    const rows = await sbFetch(
        url,
        key,
        `order_pick_items?order_id=eq.${encodeURIComponent(orderId)}&order=beer_priority.asc,sort_order.asc,line_index.asc`
    );
    return Array.isArray(rows) ? rows : [];
}

export async function ensureSeparationForOrder(url, key, order, env = process.env, { useRpc = false } = {}) {
    if (!order?.id || order.status !== 'paid') return null;

    const existing = await fetchPickItems(url, key, order.id, { useRpc });
    if (existing.length) return existing;

    let categoryIndex = { byId: new Map(), byName: new Map() };
    try {
        const catalog = await fetchCatalogFromHub(env);
        categoryIndex = buildProductCategoryIndex({
            categories: catalog.categories.map((c, idx) => ({
                id: c.id,
                name: c.name,
                sortOrder: idx,
                products: c.products,
            })),
        });
    } catch {
        /* ordenação por nome se catálogo indisponível */
    }

    const lines = buildPickLines(order.items, categoryIndex);
    if (!lines.length) return [];

    if (useRpc) {
        await sbRpc(url, key, 'rpc_insert_pick_items', { p_order_id: order.id, p_lines: lines });
        await patchOrder(
            url,
            key,
            order.id,
            {
                separation_status: 'em_separacao',
                separation_started_at: new Date().toISOString(),
            },
            { useRpc }
        );
        return fetchPickItems(url, key, order.id, { useRpc });
    }

    const inserted = await sbFetch(url, key, 'order_pick_items', {
        method: 'POST',
        body: JSON.stringify(lines.map((l) => ({ ...l, order_id: order.id }))),
    });

    await sbFetch(url, key, `orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({
            separation_status: 'em_separacao',
            separation_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }),
    });

    return Array.isArray(inserted) ? inserted : await fetchPickItems(url, key, order.id);
}

export async function listSeparationQueue(url, key, { limit = 30, useRpc = false } = {}) {
    if (useRpc) {
        const list = await sbRpc(url, key, 'rpc_list_separation_queue', { p_limit: limit });
        const orders = Array.isArray(list) ? list : [];
        const enriched = [];
        for (const o of orders) {
            const items = await fetchPickItems(url, key, o.id, { useRpc });
            enriched.push({ ...o, progress: pickProgress(items) });
        }
        return enriched;
    }

    const orders = await sbFetch(
        url,
        key,
        `orders?status=eq.paid&channel=eq.totem&or=(separation_status.is.null,separation_status.in.(em_separacao,pronto))&order=created_at.asc&limit=${limit}&select=id,total,customer_name,totem_label,created_at,separation_status,separation_started_at`
    );
    const list = Array.isArray(orders) ? orders : [];
    const enriched = [];
    for (const o of list) {
        let items = await fetchPickItems(url, key, o.id);
        if (!items.length && !o.separation_status) {
            const full = await fetchOrderById(url, key, o.id, { useRpc });
            if (full) {
                await ensureSeparationForOrder(url, key, full, process.env, { useRpc });
                items = await fetchPickItems(url, key, o.id, { useRpc });
            }
        }
        enriched.push({ ...o, progress: pickProgress(items) });
    }
    return enriched;
}

export async function pickItem(url, key, { orderId, itemId, pickedBy, delta = 1, useRpc = false }) {
    const rows = await fetchPickItems(url, key, orderId, { useRpc });
    const item = rows.find((r) => r.id === itemId);
    if (!item) throw new Error('Item não encontrado');

    const picked_qty = Math.min(item.qty, Math.max(0, item.picked_qty + delta));
    const status = nextPickStatus(item.qty, picked_qty);
    const now = picked_qty > item.picked_qty ? new Date().toISOString() : item.picked_at;

    let updated;
    if (useRpc) {
        updated = await sbRpc(url, key, 'rpc_patch_pick_item', {
            p_item_id: itemId,
            p_patch: { picked_qty, status, picked_at: now, picked_by: pickedBy || null },
        });
    } else {
        [updated] = await sbFetch(url, key, `order_pick_items?id=eq.${encodeURIComponent(itemId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                picked_qty,
                status,
                picked_at: now,
                picked_by: pickedBy || null,
            }),
        });
    }

    const all = await fetchPickItems(url, key, orderId, { useRpc });
    const progress = pickProgress(all);
    if (progress.done === progress.total && progress.total > 0) {
        if (useRpc) {
            await patchOrder(
                url,
                key,
                orderId,
                {
                    separation_status: 'pronto',
                    separation_ready_at: new Date().toISOString(),
                },
                { useRpc }
            );
        } else {
            await sbFetch(url, key, `orders?id=eq.${encodeURIComponent(orderId)}`, {
                method: 'PATCH',
                prefer: 'return=minimal',
                body: JSON.stringify({
                    separation_status: 'pronto',
                    separation_ready_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }),
            });
        }
    }

    return { item: updated, progress, items: all };
}

export function exportPickCsv(order, items) {
    const header = 'ordem;categoria;produto;quantidade;separado;status\n';
    const rows = items
        .map(
            (it, i) =>
                `${i + 1};${it.category_name || ''};${(it.product_name || '').replace(/;/g, ',')};${it.qty};${it.picked_qty};${it.status}`
        )
        .join('\n');
    const meta = `# Pedido ${order.id}\n# Total ${order.total}\n# Código ${String(order.id).slice(0, 8).toUpperCase()}\n`;
    return meta + header + rows;
}
