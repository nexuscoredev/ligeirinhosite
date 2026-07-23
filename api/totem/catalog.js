import { fetchCatalogFromHub } from '../../scripts/lib/hub-catalog.mjs';

const CACHE_SECONDS = Number(process.env.TOTEM_CATALOG_CACHE_SECONDS || 60);

function setLiveCacheHeaders(res, req, seconds) {
    if (req.query?.sync != null) {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
        return;
    }
    res.setHeader(
        'Cache-Control',
        `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}`,
    );
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(503).json({
            error: 'Catálogo ao vivo indisponível.',
            hint: 'Configure HUB_SUPABASE_SERVICE_ROLE_KEY no Vercel.',
        });
    }

    try {
        const catalog = await fetchCatalogFromHub(process.env, {
            syncMode: 'live',
            storeName: 'Ligeirinho Totem',
            channel: 'totem',
        });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        setLiveCacheHeaders(res, req, CACHE_SECONDS);
        return res.status(200).json(catalog);
    } catch (err) {
        console.error('[api/totem/catalog]', err.message || err);
        return res.status(502).json({
            error: 'Falha ao carregar catálogo do Totem.',
            detail: err.message || String(err),
        });
    }
}
