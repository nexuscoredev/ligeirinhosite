import { requireFinanceToken } from './finance-auth.mjs';

export function isDenis(user) {
    const login = String(user?.login || '').toLowerCase();
    return login === 'denis' || String(user?.role || '').toUpperCase() === 'ADMIN';
}

export function requireSeparationAuth(req, env) {
    return requireFinanceToken(req, env);
}
