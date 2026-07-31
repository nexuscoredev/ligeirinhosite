import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { isDistribuidoraAccount } from '../../scripts/lib/distribuidora-account.mjs';
import { listActivePriceTables } from '../../scripts/lib/hub-catalog.mjs';
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
        console.error('[api/catalog/tabelas]', err);
        return res.status(503).json({ error: 'Falha ao validar sessão.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    const usuario = session.usuario || {};
    if (!isDistribuidoraAccount(usuario)) {
        return res.status(403).json({ error: 'Recurso exclusivo da conta Distribuidora.' });
    }

    try {
        const hub = {
            url: session.config.url,
            anonKey: session.config.anonKey,
            token: session.config.serviceKey,
        };
        const distribuidoraId = resolveCatalogDistribuidoraId(
            usuario.distribuidora_id || session.distribuidoraId,
        );
        const tabelas = await listActivePriceTables(hub, distribuidoraId);
        const rows = (tabelas || []).map((row) => ({
            id: row.id,
            codigo: row.codigo || '',
            nome: row.nome || row.codigo || '',
            padrao: Boolean(row.padrao),
        }));

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'private, max-age=60, must-revalidate');
        return res.status(200).json({ tabelas: rows });
    } catch (err) {
        console.error('[api/catalog/tabelas]', err.message || err);
        return res.status(502).json({ error: 'Falha ao listar tabelas de preço.' });
    }
}
