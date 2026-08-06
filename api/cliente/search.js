import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { isDistribuidoraAccount } from '../../scripts/lib/distribuidora-account.mjs';
import { searchDistribuidoraClientes } from '../../scripts/lib/distribuidora-cliente-final.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let session;
    try {
        session = await requireAccountSession(req);
    } catch (err) {
        console.error('cliente/search session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    if (!isDistribuidoraAccount(session.usuario)) {
        return res.status(403).json({ error: 'Recurso disponível apenas para Ligeirinho Distribuidora.' });
    }

    try {
        const query = String(req.body?.query || req.body?.q || '').trim();
        if (query.length < 2) {
            return res.status(400).json({ error: 'Digite pelo menos 2 caracteres para buscar.' });
        }

        const limitRaw = Number(req.body?.limit);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(12, Math.floor(limitRaw))) : 8;
        const results = await searchDistribuidoraClientes(process.env, query, { limit });

        return res.status(200).json({ results });
    } catch (err) {
        console.error('cliente/search', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao buscar clientes' });
    }
}
