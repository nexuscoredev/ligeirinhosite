import { normalizeStoreKey } from '../../scripts/totem-admin-auth.mjs';
import { hubConfigForStore, listTotemStoreHidden } from '../../scripts/lib/totem-store-overrides.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(503).json({ error: 'Overrides indisponíveis.', productIds: [] });
    }

    try {
        const storeKey = normalizeStoreKey(req.query?.store || req.query?.storeKey || 'default');
        const hub = hubConfigForStore(process.env);
        const data = await listTotemStoreHidden(hub, storeKey);
        return res.status(200).json({
            storeKey,
            productIds: data.productIds,
            items: data.items,
            unavailable: data.unavailable,
        });
    } catch (err) {
        console.error('[api/totem/store/overrides]', err.message || err);
        return res.status(200).json({ storeKey: 'default', productIds: [], items: [], unavailable: true });
    }
}
