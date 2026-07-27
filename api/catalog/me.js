import { fetchCatalogFromHub } from '../../scripts/lib/hub-catalog.mjs';
import { getCachedOrCompute, invalidateCache } from '../../scripts/lib/server-cache.mjs';
import { requireAccountSession } from '../account/_require-hub-session.mjs';
import {
    clienteUsesPersonalPriceTable,
    resolveClientePriceTable,
} from '../../scripts/hub-parceiro.mjs';

const CACHE_SECONDS = Number(process.env.CATALOG_ME_CACHE_SECONDS || 60);
const MEM_TTL_MS = Number(process.env.CATALOG_ME_MEM_CACHE_MS || 60_000);

function cacheKeyFor(userId, priceMeta) {
    const tableKey =
        priceMeta?.tabelaPrecoId ||
        String(priceMeta?.tabelaPrecoCodigo || 'padrao').toLowerCase();
    return `catalog:parceiros:${userId}:${tableKey}`;
}

function setPrivateCacheHeaders(res, req, seconds) {
    if (req.query?.sync != null) {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
        return;
    }
    res.setHeader('Cache-Control', `private, max-age=${seconds}, must-revalidate`);
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

    let session;
    try {
        session = await requireAccountSession(req);
    } catch (err) {
        console.error('[api/catalog/me] session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    try {
        const priceMeta = await resolveClientePriceTable(session.config, session.usuario);
        if (!priceMeta?.clienteId) {
            return res.status(404).json({
                error: 'Cliente não vinculado à conta.',
                hint: 'Use /api/catalog para preços padrão.',
            });
        }

        if (!clienteUsesPersonalPriceTable(priceMeta)) {
            return res.status(204).end();
        }

        const cacheKey = cacheKeyFor(session.userId, priceMeta);
        const sync = req.query?.sync != null;
        if (sync) invalidateCache(cacheKey);

        const buildCatalog = () =>
            fetchCatalogFromHub(process.env, {
                syncMode: 'live',
                channel: 'parceiros',
                personalized: true,
                tabelaPrecoId: priceMeta.tabelaPrecoId,
                tabelaPrecoCodigo: priceMeta.tabelaPrecoCodigo,
            });

        const catalog = sync
            ? await buildCatalog()
            : await getCachedOrCompute(cacheKey, MEM_TTL_MS, buildCatalog);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        setPrivateCacheHeaders(res, req, CACHE_SECONDS);
        return res.status(200).json({
            ...catalog,
            clienteId: priceMeta.clienteId,
        });
    } catch (err) {
        console.error('[api/catalog/me]', err.message || err);
        return res.status(502).json({
            error: 'Falha ao carregar catálogo personalizado.',
            detail: err.message || String(err),
        });
    }
}
