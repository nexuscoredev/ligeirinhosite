import { requireHubSession } from './_require-hub-session.mjs';
import {
    changePasswordWithToken,
    clearMustChangePassword,
    verifyHubPassword,
} from '../../scripts/hub-parceiro.mjs';

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const session = await requireHubSession(req);
    if (session.error) {
        return res.status(session.status).json({ error: session.error });
    }

    try {
        const body = req.body || {};
        const currentPassword = String(body.currentPassword || '');
        const newPassword = String(body.newPassword || '').trim();
        const confirmPassword = String(body.confirmPassword || newPassword).trim();
        const isFirstAccess = Boolean(body.firstAccess || session.usuario.must_change_password);

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'A confirmação da senha não confere.' });
        }

        if (!isFirstAccess) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Informe a senha atual.' });
            }
            const ok = await verifyHubPassword(session.config, session.usuario.email, currentPassword);
            if (!ok) {
                return res.status(401).json({ error: 'Senha atual incorreta.' });
            }
        }

        await changePasswordWithToken(session.config, session.token, newPassword);
        await clearMustChangePassword(session.config, session.userId);

        return res.status(200).json({
            ok: true,
            mustChangePassword: false,
            message: isFirstAccess
                ? 'Senha definida com sucesso. Você já pode usar o app.'
                : 'Senha alterada com sucesso.',
        });
    } catch (err) {
        console.error('account/password', err);
        return res.status(500).json({ error: err.message || 'Erro ao alterar senha.' });
    }
}
