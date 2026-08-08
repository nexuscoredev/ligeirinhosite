import { loginTotemCustomer } from '../../../scripts/lib/totem-customer-auth.mjs';
import { fetchTotemCustomerByPessoaId } from '../../../scripts/lib/totem-customer-lookup.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = req.body || {};
        const login = String(body.login || body.query || '').trim();
        const password = String(body.password || '');
        if (!login || !password) {
            return res.status(400).json({ error: 'Informe seu contato e senha.' });
        }

        const session = await loginTotemCustomer(process.env, { login, password });
        const customer = await fetchTotemCustomerByPessoaId(process.env, session.pessoaId, 'login');
        if (!customer) {
            return res.status(404).json({ error: 'Cadastro não encontrado após login.' });
        }

        return res.status(200).json({
            customer: { ...customer, hasLogin: true, suggestedLogin: login },
        });
    } catch (err) {
        console.error('totem/customer/login', err);
        const status = err.status || 500;
        const message =
            status === 401
                ? 'Contato ou senha incorretos.'
                : err.message || 'Não foi possível entrar. Tente novamente.';
        return res.status(status).json({ error: message });
    }
}
