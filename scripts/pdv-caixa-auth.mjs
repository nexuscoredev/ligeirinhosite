import { requireFinanceToken, isFinanceRole } from './finance-auth.mjs';
import { hubConfig } from './hub-auth.mjs';
import { fetchUsuarioById } from './hub-parceiro.mjs';

const PDV_CARGOS = new Set([
    'DESENVOLVEDOR',
    'ADMINISTRADOR',
    'ADMIN',
    'GERENTE',
    'CAIXA',
    'CAIXA (PDV)',
    'OPERADOR',
    'CEO',
]);

function cargoPermitePdv(cargo) {
    const c = String(cargo || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    if (PDV_CARGOS.has(c)) return true;
    if (c.includes('CAIXA') || c.includes('OPERADOR') || c.includes('ADMIN')) return true;
    return false;
}

function paginasPermitemPdv(paginas) {
    if (!Array.isArray(paginas) || !paginas.length) return false;
    return paginas.some((rota) => {
        const p = String(rota || '').trim();
        return p === '/pdv/caixa' || p.startsWith('/pdv/');
    });
}

async function usuarioTemAcessoPdvRpc(config, token) {
    try {
        const res = await fetch(`${config.url}/rest/v1/rpc/usuario_tem_acesso_pdv`, {
            method: 'POST',
            headers: {
                apikey: config.anonKey,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: '{}',
        });
        if (!res.ok) return false;
        const ok = await res.json();
        return ok === true;
    } catch {
        return false;
    }
}

async function usuarioTemAcessoPdv(config, token, usuario) {
    if (cargoPermitePdv(usuario?.cargo)) return true;
    if (paginasPermitemPdv(usuario?.paginas_permitidas)) return true;
    return usuarioTemAcessoPdvRpc(config, token);
}

async function requireHubSession(req, env) {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return { error: 'Não autenticado.', status: 401 };

    const config = hubConfig(env);
    const res = await fetch(`${config.url}/auth/v1/user`, {
        headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${token}`,
        },
    });
    const user = await res.json();
    if (!res.ok || !user?.id) {
        return { error: 'Sessão inválida. Entre novamente no Hub.', status: 401 };
    }

    const usuario = await fetchUsuarioById(config, user.id, token);
    if (!usuario?.ativo) {
        return { error: 'Usuário inativo.', status: 403 };
    }
    if (!(await usuarioTemAcessoPdv(config, token, usuario))) {
        return { error: 'Seu perfil não tem acesso ao caixa/PDV.', status: 403 };
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
            role: usuario.cargo,
        },
    };
}

/** Aceita token financeiro (caixa.html) ou sessão Supabase do Hub (PDV). */
export async function requireCaixaAuth(req, env = process.env) {
    const finance = requireFinanceToken(req, env);
    if (!finance.error && finance.user?.sub) {
        return finance;
    }
    return requireHubSession(req, env);
}

export { cargoPermitePdv, isFinanceRole, paginasPermitemPdv, usuarioTemAcessoPdv };
