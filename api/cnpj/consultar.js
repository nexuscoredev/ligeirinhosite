import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { consultarEmpresaPorCnpj } from '../../scripts/lib/consultar-publicas.mjs';

export const config = { maxDuration: 30 };

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
        console.error('[api/cnpj/consultar] session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    try {
        const cnpj = req.body?.cnpj ?? '';
        const empresa = await consultarEmpresaPorCnpj(cnpj);
        if (!empresa) {
            return res.status(404).json({ error: 'CNPJ não encontrado na Receita Federal.' });
        }
        return res.status(200).json({ empresa });
    } catch (err) {
        console.error('[api/cnpj/consultar]', err);
        return res.status(400).json({ error: err.message || 'Falha ao consultar CNPJ.' });
    }
}
