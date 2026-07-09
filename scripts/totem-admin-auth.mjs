import { hubConfig, isTotemAdminUsuario } from './hub-auth.mjs';
import { fetchUsuarioById } from './hub-parceiro.mjs';

export { isTotemAdminUsuario };

function hubHeaders(config, token) {
    return {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export async function requireTotemAdminAuth(req, env = process.env) {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return { error: 'Não autenticado.', status: 401 };

    const config = hubConfig(env);
    const res = await fetch(`${config.url}/auth/v1/user`, {
        headers: hubHeaders(config, token),
    });
    const user = await res.json();
    if (!res.ok || !user?.id) {
        return { error: 'Sessão inválida. Entre novamente no Totem.', status: 401 };
    }

    const usuario = await fetchUsuarioById(config, user.id, token);
    if (!usuario?.ativo) {
        return { error: 'Usuário inativo.', status: 403 };
    }
    if (!isTotemAdminUsuario(usuario)) {
        return { error: 'Seu perfil não tem permissão de Admin do Totem.', status: 403 };
    }

    return {
        config,
        token,
        userId: user.id,
        usuario,
        user: {
            sub: user.id,
            name: usuario.nome || user.email,
            login: usuario.login || user.email,
            totemAdmin: true,
        },
    };
}

export function normalizeStoreKey(value) {
    const key = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');
    return key || 'default';
}
