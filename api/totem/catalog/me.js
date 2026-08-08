import { fetchCatalogFromHub } from '../../../scripts/lib/hub-catalog.mjs';
import { getCachedOrCompute, invalidateCache } from '../../../scripts/lib/server-cache.mjs';
import { requireHubSession } from '../../hub/_require-hub-session.mjs';
import {
    clienteUsesPersonalPriceTable,
    resolveClientePriceTableFromPessoaId,
} from '../../../scripts/hub-parceiro.mjs';
import { resolveTotemDistribuidoraId } from '../../../scripts/lib/totem-distribuidora.mjs';
import { resolveCatalogDistribuidoraId } from '../../../scripts/lib/distribuidora-scope.mjs';

const CACHE_SECONDS = Number(process.env.TOTEM_CATALOG_ME_CACHE_SECONDS || 60);
const MEM_TTL_MS = Number(process.env.TOTEM_CATALOG_ME_MEM_CACHE_MS || 45_000);

function cacheKeyFor(pessoaId, priceMeta, distribuidoraId) {
    const tableKey =
        priceMeta?.tabelaPrecoId ||
        String(priceMeta?.tabelaPrecoCodigo || 'padrao').toLowerCase();
    const dist = String(distribuidoraId || '').trim() || 'legada';
    return `catalog:totem:me:${pessoaId}:${tableKey}:${dist}`;
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

    const session = await requireHubSession(req);
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const pessoaId = String(req.query?.pessoaId || '').trim();
    if (!pessoaId) {
        return res.status(400).json({ error: 'Informe pessoaId.' });
    }

    try {
        const priceMeta = await resolveClientePriceTableFromPessoaId(session.config, pessoaId);
        if (!priceMeta?.clienteId) {
            return res.status(404).json({
                error: 'Cliente não encontrado.',
                hint: 'Use /api/totem/catalog para preços padrão.',
            });
        }

        if (!clienteUsesPersonalPriceTable(priceMeta)) {
            return res.status(204).end();
        }

        const distribuidoraId = await resolveTotemDistribuidoraId(req);
        const cacheKey = cacheKeyFor(pessoaId, priceMeta, distribuidoraId);
        const sync = req.query?.sync != null;
        if (sync) invalidateCache(cacheKey);

        const buildCatalog = () =>
            fetchCatalogFromHub(process.env, {
                syncMode: 'live',
                storeName: 'Ligeirinho Totem',
                channel: 'totem',
                personalized: true,
                tabelaPrecoId: priceMeta.tabelaPrecoId,
                tabelaPrecoCodigo: priceMeta.tabelaPrecoCodigo,
                distribuidoraId: resolveCatalogDistribuidoraId(distribuidoraId),
            });

        const catalog = sync
            ? await buildCatalog()
            : await getCachedOrCompute(cacheKey, MEM_TTL_MS, buildCatalog);

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        setPrivateCacheHeaders(res, req, CACHE_SECONDS);
        return res.status(200).json({
            ...catalog,
            clienteId: priceMeta.clienteId,
            pessoaId,
        });
    } catch (err) {
        console.error('[api/totem/catalog/me]', err.message || err);
        return res.status(502).json({
            error: 'Falha ao carregar catálogo personalizado.',
        });
    }
}
