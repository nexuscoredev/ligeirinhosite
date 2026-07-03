import { lookupTotemCustomer } from '../../../scripts/lib/totem-customer-lookup.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const query = String(req.body?.query || req.body?.q || '').trim();
        const type = String(req.body?.type || '').trim().toLowerCase();
        if (!query) {
            return res.status(400).json({ error: 'Informe telefone, CPF, CNPJ ou e-mail.' });
        }

        const customer = await lookupTotemCustomer(process.env, query, {
            type: type === 'email' ? 'email' : 'contact',
        });
        if (!customer) {
            return res.status(404).json({ error: 'Cadastro não encontrado. Você pode continuar como novo cliente.' });
        }

        return res.status(200).json({ customer });
    } catch (err) {
        console.error('totem/customer/lookup', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao buscar cadastro' });
    }
}
