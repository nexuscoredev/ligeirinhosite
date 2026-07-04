import { registerTotemCustomer } from '../../../scripts/lib/totem-customer-register.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = req.body || {};
        const customer = await registerTotemCustomer(process.env, {
            name: body.name,
            phone: body.phone,
            email: body.email,
            cpf: body.cpf,
            pessoaId: body.pessoaId,
        });

        return res.status(200).json({ customer, saved: true });
    } catch (err) {
        console.error('totem/customer/register', err);
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao salvar cadastro' });
    }
}
