/**
 * Valida sessão Hub (Bearer do Ligeirinho Hub) para APIs internas Hub → Parceiros.
 * Espelha a lógica de api/account/_require-hub-session.mjs (requireHubSession).
 */
import { hubConfig } from '../../scripts/hub-auth.mjs';
import { fetchUsuarioById } from '../../scripts/hub-parceiro.mjs';

async function safeFetchUsuarioById(config, userId, token) {
    try {
        return await fetchUsuarioById(config, userId, token);
    } catch (err) {
        console.error('[hub/_require-hub-session] fetchUsuarioById', err?.message || err);
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
        const user = await res.json().catch(() => null);
        if (!res.ok || !user?.id) {
            return { error: 'Sessão inválida. Entre novamente.', status: 401 };
        }

        const usuario = await safeFetchUsuarioById(config, user.id, token);
        if (!usuario?.ativo) {
            return { error: 'Usuário inativo.', status: 403 };
        }

        return { config, token, userId: user.id, usuario, authUser: user };
    } catch (err) {
        console.error('[hub/_require-hub-session]', err);
        return { error: 'Falha ao validar sessão. Tente novamente.', status: 503 };
    }
}
