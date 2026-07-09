import { normalizeStoreKey, requireTotemAdminAuth } from '../../../scripts/totem-admin-auth.mjs';
import {
    hideTotemStoreProduct,
    hubConfigForStore,
    listTotemStoreHidden,
    showTotemStoreProduct,
} from '../../../scripts/lib/totem-store-overrides.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');

    const auth = await requireTotemAdminAuth(req, process.env);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    if (!process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(503).json({ error: 'Backend do Totem indisponível.' });
    }

    const hub = hubConfigForStore(process.env);

    try {
        if (req.method === 'GET') {
            const storeKey = normalizeStoreKey(req.query?.store || auth.usuario?.login || 'default');
            const data = await listTotemStoreHidden(hub, storeKey);
            return res.status(200).json({ storeKey, productIds: data.productIds, items: data.items });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const storeKey = normalizeStoreKey(body.storeKey || body.store || auth.usuario?.login || 'default');
            const productId = String(body.productId || '').trim();
            if (!productId) return res.status(400).json({ error: 'Informe o produto.' });

            const hidden = body.hidden !== false && body.action !== 'show';
            if (hidden) {
                await hideTotemStoreProduct(hub, {
                    storeKey,
                    productId,
                    hubProductId: body.hubProductId || null,
                    productName: body.productName || null,
                    hiddenBy: auth.userId,
                });
            } else {
                await showTotemStoreProduct(hub, storeKey, productId);
            }

            const data = await listTotemStoreHidden(hub, storeKey);
            return res.status(200).json({
                ok: true,
                storeKey,
                hidden,
                productIds: data.productIds,
            });
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('[api/totem/admin/overrides]', err.message || err);
        return res.status(500).json({ error: err.message || 'Falha ao salvar.' });
    }
}
