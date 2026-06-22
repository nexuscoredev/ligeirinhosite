import { buildParceiroExtras, resolveLoginEmailExtended } from './hub-parceiro.mjs';

const DEFAULT_HUB_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
const DEFAULT_HUB_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3pwd29jd3ZreXR6eWF4dml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MjczNzUsImV4cCI6MjA5NTMwMzM3NX0.rMfpheVgAKQ4HelKB0ZoNDZXiU_3XQdv7ujLHxgdjEA';

export const TOTEM_ROLES = new Set(['TOTEM', 'TOTEM_DEVICE']);

export function hubConfig(env = process.env) {
    return {
        url: (env.HUB_SUPABASE_URL || DEFAULT_HUB_URL).replace(/\/$/, ''),
        anonKey: env.HUB_SUPABASE_ANON_KEY || DEFAULT_HUB_ANON_KEY,
        serviceKey: env.HUB_SUPABASE_SERVICE_ROLE_KEY || '',
    };
}

export function normalizeRole(cargo) {
    const raw = String(cargo || '')
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    if (raw === 'TOTEM_DEVICE') return 'TOTEM_DEVICE';
    if (raw === 'TOTEM' || raw.includes('TOTEM')) return 'TOTEM';
    if (raw === 'ADMINISTRADOR' || raw === 'ADMIN') return 'ADMIN';
    if (raw === 'OPERADOR' || raw === 'CAIXA') return 'OPERADOR';
    return 'PARCEIRO';
}

export function isTotemRole(role) {
    return TOTEM_ROLES.has(String(role || '').toUpperCase());
}

function hubHeaders(key, token) {
    return {
        apikey: key,
        Authorization: `Bearer ${token || key}`,
        'Content-Type': 'application/json',
    };
}

async function hubRpc(config, name, body, token) {
    const res = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: hubHeaders(config.anonKey, token),
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `RPC ${name} failed`);
    if (!text) return null;
    return JSON.parse(text);
}

async function hubSignIn(config, login, password) {
    const email = await resolveLoginEmailExtended(config, login);
    if (!email || typeof email !== 'string') {
        return { error: 'Usuário, CNPJ ou senha incorretos.' };
    }

    const res = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: hubHeaders(config.anonKey),
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
        return { error: data.error_description || data.msg || 'Usuário ou senha incorretos.' };
    }

    return { accessToken: data.access_token, refreshToken: data.refresh_token, userId: data.user?.id, email };
}

async function fetchUsuarioByAuthId(config, userId, accessToken) {
    const select =
        'id,email,nome,cargo,ativo,login,telefone,must_change_password';
    const url = `${config.url}/rest/v1/usuarios?select=${encodeURIComponent(select)}&id=eq.${encodeURIComponent(userId)}&limit=1`;
    let res = await fetch(url, { headers: hubHeaders(config.anonKey, accessToken) });
    let rows = await res.json();
    if (!res.ok && /must_change_password/i.test(rows?.message || '')) {
        const fallbackUrl = `${config.url}/rest/v1/usuarios?select=id,email,nome,cargo,ativo,login,telefone&id=eq.${encodeURIComponent(userId)}&limit=1`;
        res = await fetch(fallbackUrl, { headers: hubHeaders(config.anonKey, accessToken) });
        rows = await res.json();
    }
    if (!res.ok) throw new Error(rows?.message || 'Falha ao carregar perfil');
    return Array.isArray(rows) ? rows[0] : null;
}

async function fetchUsuarioByEmail(config, email) {
    if (!config.serviceKey) return null;
    const url = `${config.url}/rest/v1/usuarios?select=id,email,nome,cargo,ativo,login,telefone,must_change_password&email=eq.${encodeURIComponent(email)}&limit=1`;
    const res = await fetch(url, { headers: hubHeaders(config.serviceKey) });
    const rows = await res.json();
    if (!res.ok) return null;
    return Array.isArray(rows) ? rows[0] : null;
}

async function fetchUsuarioByPhone(config, phone) {
    if (!config.serviceKey) return null;
    const digits = String(phone || '').replace(/\D/g, '');
    const url = `${config.url}/rest/v1/usuarios?select=id,email,nome,cargo,ativo,login,telefone,must_change_password&telefone=eq.${encodeURIComponent(digits)}&limit=1`;
    const res = await fetch(url, { headers: hubHeaders(config.serviceKey) });
    const rows = await res.json();
    if (!res.ok) return null;
    return Array.isArray(rows) ? rows[0] : null;
}

const TOTEM_LOGINS = new Set(['totem', 'totem_device', 'totem-loja', 'totemloja']);

function resolveRoleFromUsuario(usuario) {
    const loginKey = String(usuario?.login || '')
        .trim()
        .toLowerCase();
    if (TOTEM_LOGINS.has(loginKey) || loginKey.startsWith('totem')) {
        return loginKey.includes('device') ? 'TOTEM_DEVICE' : 'TOTEM';
    }
    return normalizeRole(usuario.cargo);
}

function profileFromUsuario(usuario, extras = {}) {
    if (!usuario?.ativo) return null;
    const role = resolveRoleFromUsuario(usuario);
    return {
        sub: usuario.id,
        email: usuario.email || extras.email || '',
        name: usuario.nome || extras.name || '',
        phone: usuario.telefone || extras.phone || '',
        login: usuario.login || extras.login || '',
        role,
        cargo: usuario.cargo || '',
        hubUserId: usuario.id,
        mustChangePassword: Boolean(usuario.must_change_password || extras.mustChangePassword),
        ...extras,
    };
}

export async function resolveHubLogin(config, login, password) {
    const auth = await hubSignIn(config, login, password);
    if (auth.error) return { error: auth.error };

    const usuario = await fetchUsuarioByAuthId(config, auth.userId, auth.accessToken);
    if (!usuario) return { error: 'Perfil não encontrado no Hub.' };

    const parceiro = await buildParceiroExtras(config, usuario);
    if (parceiro.bloqueadoPedido) {
        return { error: 'Sua conta está bloqueada para novos pedidos. Fale com o comercial.' };
    }

    const profile = profileFromUsuario(usuario, { provider: 'hub', ...parceiro });
    if (!profile) return { error: 'Usuário inativo.' };

    return { profile, accessToken: auth.accessToken, refreshToken: auth.refreshToken };
}

export async function resolveProfileByEmail(config, email, extras = {}) {
    const usuario = await fetchUsuarioByEmail(config, email);
    if (!usuario) {
        return {
            sub: extras.sub || email,
            email,
            name: extras.name || '',
            phone: extras.phone || '',
            role: 'PARCEIRO',
            provider: extras.provider || 'google',
        };
    }
    const parceiro = await buildParceiroExtras(config, usuario);
    return profileFromUsuario(usuario, { ...extras, email, provider: extras.provider || 'google', ...parceiro }) || {
        sub: extras.sub || email,
        email,
        role: 'PARCEIRO',
        provider: extras.provider || 'google',
    };
}

export async function resolveProfileByPhone(config, phone, name) {
    const usuario = await fetchUsuarioByPhone(config, phone);
    const normalizedPhone = String(phone || '').trim();
    if (!usuario) {
        return {
            sub: `phone:${normalizedPhone}`,
            email: '',
            name: name || '',
            phone: normalizedPhone,
            role: 'PARCEIRO',
            provider: 'phone',
        };
    }
    return (
        profileFromUsuario(usuario, {
            phone: normalizedPhone,
            name: name || usuario.nome,
            provider: 'phone',
            ...(await buildParceiroExtras(config, usuario)),
        }) || {
            sub: `phone:${normalizedPhone}`,
            name: name || '',
            phone: normalizedPhone,
            role: 'PARCEIRO',
            provider: 'phone',
        }
    );
}
