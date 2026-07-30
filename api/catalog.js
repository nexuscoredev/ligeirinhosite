import { fetchCatalogFromHub } from '../scripts/lib/hub-catalog.mjs';
import { resolveCatalogDistribuidoraId } from '../scripts/lib/distribuidora-scope.mjs';
import { getCachedOrCompute, invalidateCache } from '../scripts/lib/server-cache.mjs';

const CACHE_SECONDS = Number(process.env.CATALOG_CACHE_SECONDS || 300);
const MEM_TTL_MS = Number(process.env.CATALOG_MEM_CACHE_MS || 60_000);

function setLiveCacheHeaders(res, req, seconds) {
    if (req.query?.sync != null) {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
        return;
    }
    res.setHeader(
        'Cache-Control',
        `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`,
    );
}

async function buildCatalog() {
    const distribuidoraId = resolveCatalogDistribuidoraId(null);
    return fetchCatalogFromHub(process.env, {
        syncMode: 'live',
        channel: 'parceiros',
        distribuidoraId,
    });
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
        const distribuidoraId = resolveCatalogDistribuidoraId(null);
        const cacheKey = `catalog:parceiros:${distribuidoraId}`;
        const sync = req.query?.sync != null;
        if (sync) invalidateCache(cacheKey);

        const catalog = sync
            ? await buildCatalog()
            : await getCachedOrCompute(cacheKey, MEM_TTL_MS, buildCatalog);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        setLiveCacheHeaders(res, req, CACHE_SECONDS);
        return res.status(200).json(catalog);
    } catch (err) {
        console.error('[api/catalog]', err.message || err);
        return res.status(502).json({
            error: 'Falha ao carregar catálogo do Hub.',
            detail: err.message || String(err),
        });
    }
}
