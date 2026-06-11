import { authenticateFinanceUser } from '../../scripts/finance-auth.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { login, password } = req.body || {};
        if (!login || !password) {
            return res.status(400).json({ error: 'Informe usuário e senha.' });
        }
        const result = await authenticateFinanceUser(process.env, login, password);
        if (result.error) return res.status(401).json({ error: result.error });
        return res.status(200).json({
            token: result.token,
            profile: {
                name: result.profile.name,
                login: result.profile.login,
                role: result.profile.role,
            },
        });
    } catch (err) {
        console.error('finance/auth', err);
        return res.status(500).json({ error: err.message || 'Erro ao autenticar.' });
    }
}
