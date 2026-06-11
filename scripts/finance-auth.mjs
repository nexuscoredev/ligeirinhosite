import { hubConfig, resolveHubLogin, normalizeRole } from './hub-auth.mjs';
import { signFinanceToken, verifyFinanceToken, financeJwtSecret } from './finance-jwt.mjs';

const FINANCE_ROLES = new Set(['ADMIN', 'OPERADOR']);

export function isFinanceRole(role) {
    return FINANCE_ROLES.has(String(role || '').toUpperCase());
}

export async function authenticateFinanceUser(env, login, password) {
    const hub = hubConfig(env);
    const result = await resolveHubLogin(hub, login, password);
    if (result.error) return { error: result.error };
    const profile = result.profile;
    if (!isFinanceRole(profile.role)) {
        return { error: 'Acesso financeiro restrito a administradores e operadores.' };
    }
    const secret = financeJwtSecret(env);
    const token = signFinanceToken(
        {
            sub: profile.hubUserId || profile.sub,
            name: profile.name,
            login: profile.login,
            role: profile.role,
        },
        secret
    );
    return { token, profile };
}

export function requireFinanceToken(req, env) {
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const secret = financeJwtSecret(env);
    const payload = verifyFinanceToken(token, secret);
    if (!payload?.sub || !isFinanceRole(payload.role)) {
        return { error: 'Não autorizado. Faça login no módulo financeiro.', status: 401 };
    }
    return { user: payload };
}

export { FINANCE_ROLES, normalizeRole };
