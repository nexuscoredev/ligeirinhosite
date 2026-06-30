import { hubConfig } from '../../scripts/hub-auth.mjs';
import {
    ensureUsuarioForGoogleParceiro,
    fetchUsuarioByEmail,
    fetchUsuarioById,
} from '../../scripts/hub-parceiro.mjs';
import { verifyAccountSession } from '../../scripts/account-session.mjs';

function parseGoogleJwt(credential) {
    try {
        const base64 = credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

async function safeFetchUsuarioById(config, userId, token) {
    try {
        return await fetchUsuarioById(config, userId, token);
    } catch (err) {
        console.error('[requireAccountSession] fetchUsuarioById', err?.message || err);
        return null;
    }
}

async function safeFetchUsuarioByEmail(config, email) {
    try {
        return await fetchUsuarioByEmail(config, email);
    } catch (err) {
        console.error('[requireAccountSession] fetchUsuarioByEmail', err?.message || err);
        return null;
    }
}

export async function requireHubSession(req) {
    try {
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

        const usuario = await safeFetchUsuarioById(config, user.id, token);
        if (!usuario?.ativo) {
            return { error: 'Usuário inativo.', status: 403 };
        }

        return { config, token, userId: user.id, usuario, authUser: user };
    } catch (err) {
        console.error('[requireHubSession]', err);
        return { error: 'Falha ao validar sessão. Tente novamente.', status: 503 };
    }
}

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

async function sessionFromGoogleUsuario(config, usuario, email, provider = 'google') {
    if (!usuario?.id || !usuario.ativo) {
        return { error: 'Usuário inativo.', status: 403 };
    }
    if (!googleUsuarioMatchesEmail(usuario, email)) {
        return { error: 'Este e-mail Google não corresponde à conta no Hub.', status: 403 };
    }
    return {
        config,
        token: config.serviceKey,
        userId: usuario.id,
        usuario,
        authUser: { id: usuario.id, email },
        provider,
    };
}

/** Sessão Hub (senha) ou Google (credencial ID token) para alterar dados da conta. */
export async function requireAccountSession(req) {
    try {
        const hub = await requireHubSession(req);
        if (!hub.error) return { ...hub, provider: 'hub' };

        const config = hubConfig(process.env);
        if (!config.serviceKey) {
            return { error: 'Serviço de conta indisponível.', status: 503 };
        }

        const accountToken = String(req.headers['x-account-session'] || '').trim();
        if (accountToken) {
            const payload = verifyAccountSession(accountToken);
            if (payload?.userId) {
                const usuario = await safeFetchUsuarioById(config, payload.userId, config.serviceKey);
                const session = await sessionFromGoogleUsuario(
                    config,
                    usuario,
                    payload.email,
                    payload.provider || 'google',
                );
                if (!session.error) return session;
            }
        }

        const body = req.body || {};
        const credential = String(
            req.headers['x-google-credential'] || body.googleCredential || '',
        ).trim();
        if (credential) {
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

            const email = String(payload.email).trim().toLowerCase();
            const hubUserId = String(req.headers['x-hub-user-id'] || body.hubUserId || '').trim();

            let usuario = null;
            if (hubUserId) {
                usuario = await safeFetchUsuarioById(config, hubUserId, config.serviceKey);
            }
            if (!usuario?.id) {
                usuario = await safeFetchUsuarioByEmail(config, email);
            }
            if (!usuario?.id) {
                try {
                    usuario = await ensureUsuarioForGoogleParceiro(config, {
                        email,
                        name: String(payload.name || '').trim(),
                    });
                } catch (err) {
                    return {
                        error: err.message || 'Não foi possível vincular conta Google.',
                        status: 500,
                    };
                }
            }

            const session = await sessionFromGoogleUsuario(config, usuario, email, 'google');
            if (session.error) return session;
            return session;
        }

        const provider = String(req.headers['x-auth-provider'] || body.provider || '').toLowerCase();
        const email = String(req.headers['x-account-email'] || body.email || '').trim().toLowerCase();
        const hubUserId = String(req.headers['x-hub-user-id'] || body.hubUserId || '').trim();

        if (provider === 'google' && email) {
            let usuario = null;
            if (hubUserId) {
                usuario = await safeFetchUsuarioById(config, hubUserId, config.serviceKey);
            }
            if (!usuario?.id) {
                usuario = await safeFetchUsuarioByEmail(config, email);
            }
            if (!usuario?.id) {
                try {
                    usuario = await ensureUsuarioForGoogleParceiro(config, { email });
                } catch (err) {
                    return {
                        error: err.message || 'Não foi possível vincular conta Google.',
                        status: 500,
                    };
                }
            }

            const session = await sessionFromGoogleUsuario(config, usuario, email, 'google');
            if (!session.error) return session;
            return session;
        }

        return hub.error ? hub : { error: 'Não autenticado.', status: 401 };
    } catch (err) {
        console.error('[requireAccountSession]', err);
        return { error: 'Falha ao validar sessão. Tente novamente.', status: 503 };
    }
}
