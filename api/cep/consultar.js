import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { consultarEnderecoPorCep } from '../../scripts/lib/consultar-publicas.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let session;
    try {
        session = await requireAccountSession(req);
    } catch (err) {
        console.error('[api/cep/consultar] session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    try {
        const cep = req.body?.cep ?? '';
        const endereco = await consultarEnderecoPorCep(cep);
        return res.status(200).json({ endereco });
    } catch (err) {
        console.error('[api/cep/consultar]', err);
        return res.status(400).json({ error: err.message || 'Falha ao consultar CEP.' });
    }
}
