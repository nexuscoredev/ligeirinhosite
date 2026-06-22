import { hubConfig } from '../../scripts/hub-auth.mjs';
import { fetchUsuarioById } from '../../scripts/hub-parceiro.mjs';

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
