import { requireAccountSession } from '../account/_require-hub-session.mjs';
import { isDistribuidoraAccount } from '../../scripts/lib/distribuidora-account.mjs';
import { lookupDistribuidoraClienteFinal } from '../../scripts/lib/distribuidora-cliente-final.mjs';
import { normalizeDocDigits } from '../../scripts/hub-parceiro.mjs';

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
        console.error('cliente/lookup session', err);
        return res.status(503).json({ error: 'Falha ao validar sessão. Tente novamente.' });
    }
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    if (!isDistribuidoraAccount(session.usuario)) {
        return res.status(403).json({ error: 'Recurso disponível apenas para Ligeirinho Distribuidora.' });
    }

    try {
        const docDigits = normalizeDocDigits(String(req.body?.doc || req.body?.docDigits || '')).slice(0, 14);
        if (docDigits.length !== 11 && docDigits.length !== 14) {
            return res.status(400).json({ error: 'Informe um CPF ou CNPJ válido.' });
        }

        const hit = await lookupDistribuidoraClienteFinal(process.env, docDigits);
        if (!hit?.found) {
            return res.status(200).json({ found: false, clienteAPrazo: false });
        }

        return res.status(200).json(hit);
    } catch (err) {
        console.error('cliente/lookup', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao buscar cadastro' });
    }
}
