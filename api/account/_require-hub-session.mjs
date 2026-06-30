import { hubConfig } from '../../scripts/hub-auth.mjs';
import {
    ensureUsuarioForGoogleParceiro,
    fetchUsuarioByEmail,
    fetchUsuarioById,
} from '../../scripts/hub-parceiro.mjs';

function parseGoogleJwt(credential) {
    try {
        const base64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

export async function requireHubSession(req) {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) {
        return { error: 'Não autenticado.', status: 401 };
    }

    const config = hubConfig(process.env);
    const res = await fetch(`${config.url}/auth/v1/user`, {
        headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${token}`,
        },
    });
    const user = await res.json();
    if (!res.ok || !user?.id) {
        return { error: 'Sessão inválida. Entre novamente.', status: 401 };
    }

    const usuario = await fetchUsuarioById(config, user.id, token);
    if (!usuario?.ativo) {
        return { error: 'Usuário inativo.', status: 403 };
    }

    return { config, token, userId: user.id, usuario, authUser: user };
}

/** Sessão Hub (senha) ou Google (credencial ID token) para alterar dados da conta. */
export async function requireAccountSession(req) {
    const hub = await requireHubSession(req);
    if (!hub.error) return { ...hub, provider: 'hub' };

    const body = req.body || {};
    const credential = String(
        req.headers['x-google-credential'] || body.googleCredential || '',
    ).trim();
    if (!credential) return hub;

    const payload = parseGoogleJwt(credential);
    if (!payload?.email) {
        return { error: 'Credencial Google inválida.', status: 401 };
    }
    if (payload.exp && payload.exp * 1000 < Date.now() - 60_000) {
        return {
            error: 'Sessão Google expirada. Saia e entre novamente com Google.',
            status: 401,
        };
    }

    const config = hubConfig(process.env);
    if (!config.serviceKey) {
        return { error: 'Serviço de conta indisponível.', status: 503 };
    }

    const email = String(payload.email).trim().toLowerCase();
    const hubUserId = String(req.headers['x-hub-user-id'] || body.hubUserId || '').trim();

    let usuario = null;
    if (hubUserId) {
        usuario = await fetchUsuarioById(config, hubUserId, config.serviceKey);
    }
    if (!usuario?.id) {
        usuario = await fetchUsuarioByEmail(config, email);
    }
    if (!usuario?.id) {
        try {
            usuario = await ensureUsuarioForGoogleParceiro(config, {
                email,
                name: String(payload.name || '').trim(),
            });
        } catch (err) {
            return { error: err.message || 'Não foi possível vincular conta Google.', status: 500 };
        }
    }

    const usuarioEmail = String(usuario.email || '').trim().toLowerCase();
    if (usuarioEmail && usuarioEmail !== email && !usuarioEmail.endsWith('@ligeirinho.app')) {
        return { error: 'Este e-mail Google não corresponde à conta no Hub.', status: 403 };
    }

    if (!usuario?.ativo) {
        return { error: 'Usuário inativo.', status: 403 };
    }

    return {
        config,
        token: config.serviceKey,
        userId: usuario.id,
        usuario,
        authUser: { id: usuario.id, email },
        provider: 'google',
    };
}
