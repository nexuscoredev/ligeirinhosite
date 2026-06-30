import { hubConfig } from '../../scripts/hub-auth.mjs';
import {
    ensureUsuarioForGoogleParceiro,
    fetchUsuarioByEmail,
    fetchUsuarioById,
} from '../../scripts/hub-parceiro.mjs';
import { issueAccountSession, verifyAccountSession } from '../../scripts/account-session.mjs';

export const config = { maxDuration: 15 };

function googleUsuarioMatchesEmail(usuario, email) {
    const emailNorm = String(email || '').trim().toLowerCase();
    const usuarioEmail = String(usuario?.email || '').trim().toLowerCase();
    if (!emailNorm || !usuario?.id) return false;
    if (usuarioEmail === emailNorm) return true;
    if (usuarioEmail.endsWith('@ligeirinho.app')) {
        const login = String(usuario.login || '').trim().toLowerCase();
        if (login === emailNorm) return true;
    }
    return false;
}

async function sessionFromUsuario(config, usuario, provider = 'google') {
    if (!usuario?.id || !usuario.ativo) return null;
    return {
        config,
        token: config.serviceKey,
        userId: usuario.id,
        usuario,
        authUser: { id: usuario.id, email: usuario.email },
        provider,
    };
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const config = hubConfig(process.env);
    if (!config.serviceKey) {
        return res.status(503).json({ error: 'Serviço de conta indisponível.' });
    }

    try {
        const body = req.body || {};
        const email = String(body.email || '').trim().toLowerCase();
        const hubUserId = String(body.hubUserId || '').trim();
        const provider = String(body.provider || 'google').toLowerCase();

        if (!email) {
            return res.status(400).json({ error: 'E-mail da sessão ausente.' });
        }

        let usuario = null;
        if (hubUserId) {
            usuario = await fetchUsuarioById(config, hubUserId, config.serviceKey);
        }
        if (!usuario?.id) {
            usuario = await fetchUsuarioByEmail(config, email);
        }
        if (!usuario?.id && provider === 'google') {
            usuario = await ensureUsuarioForGoogleParceiro(config, {
                email,
                name: String(body.name || '').trim(),
            });
        }

        if (!googleUsuarioMatchesEmail(usuario, email)) {
            return res.status(403).json({ error: 'Sessão inválida para esta conta.' });
        }

        const accountSession = issueAccountSession({
            userId: usuario.id,
            email,
            provider,
        });

        if (!accountSession?.token) {
            return res.status(500).json({ error: 'Não foi possível renovar a sessão.' });
        }

        return res.status(200).json({ accountSession });
    } catch (err) {
        console.error('[api/auth/account-session]', err);
        return res.status(500).json({ error: err.message || 'Erro ao renovar sessão.' });
    }
}
