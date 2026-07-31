import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { isDistribuidoraAccount } from '../../scripts/lib/distribuidora-account.mjs';
import { fetchCatalogFromHub } from '../../scripts/lib/hub-catalog.mjs';
import { resolveCatalogDistribuidoraId } from '../../scripts/lib/distribuidora-scope.mjs';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(503).json({ error: 'Hub indisponível.' });
    }

    let session;
    try {
        session = await requireAccountSession(req);
    } catch (err) {
        console.error('[api/catalog/by-table]', err);
        return res.status(503).json({ error: 'Falha ao validar sessão.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const usuario = session.usuario || {};
    if (!isDistribuidoraAccount(usuario)) {
        return res.status(403).json({ error: 'Recurso exclusivo da conta Distribuidora.' });
    }

    const tabelaPrecoId = String(req.query?.tabelaPrecoId || '').trim();
    const tabelaPrecoCodigo = String(req.query?.tabelaPrecoCodigo || '').trim();
    if (!tabelaPrecoId && !tabelaPrecoCodigo) {
        return res.status(400).json({ error: 'Informe tabelaPrecoId ou tabelaPrecoCodigo.' });
    }

    try {
        const distribuidoraId = resolveCatalogDistribuidoraId(
            usuario.distribuidora_id || session.distribuidoraId,
        );
        const catalog = await fetchCatalogFromHub(process.env, {
            syncMode: 'live',
            channel: 'parceiros',
            tabelaPrecoId: tabelaPrecoId || undefined,
            tabelaPrecoCodigo: tabelaPrecoCodigo || undefined,
            distribuidoraId,
        });

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
        return res.status(200).json(catalog);
    } catch (err) {
        console.error('[api/catalog/by-table]', err.message || err);
        return res.status(502).json({ error: 'Falha ao carregar catálogo da tabela.' });
    }
}
