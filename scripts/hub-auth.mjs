import {
    buildParceiroExtras,
    buildParceiroExtrasFromPessoa,
    resolveLoginEmailExtended,
    resolveParceiroDisplayName,
    resolveParceiroEmail,
    resolveParceiroHubContact,
    syncParceiroContactLink,
} from './hub-parceiro.mjs';

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

export function isTotemAdminUsuario(usuario) {
    if (!usuario?.ativo) return false;
    if (usuario.admin_totem === true) return true;
    const cargo = String(usuario.cargo || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return cargo === 'DESENVOLVEDOR';
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
        'id,email,nome,cargo,ativo,login,telefone,must_change_password,admin_totem';
    const url = `${config.url}/rest/v1/usuarios?select=${encodeURIComponent(select)}&id=eq.${encodeURIComponent(userId)}&limit=1`;
    let res = await fetch(url, { headers: hubHeaders(config.anonKey, accessToken) });
    let rows = await res.json();
    if (!res.ok && /must_change_password|admin_totem/i.test(rows?.message || '')) {
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

const TOTEM_LOGINS = new Set([
    'totem',
    'totem_device',
    'totem-loja',
    'totemloja',
    'tablet1',
    'tablet2',
    'tablet3',
    'patricia',
]);

function isTotemLoginKey(loginKey) {
    const key = String(loginKey || '')
        .trim()
        .toLowerCase();
    if (!key) return false;
    return TOTEM_LOGINS.has(key) || key.startsWith('totem') || key.startsWith('tablet');
}

function resolveRoleFromUsuario(usuario) {
    const loginKey = String(usuario?.login || '')
        .trim()
        .toLowerCase();
    if (isTotemLoginKey(loginKey)) {
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
        totemAdmin: isTotemAdminUsuario(usuario),
        ...extras,
    };
}

function finalizeParceiroProfile(profile, { provider, authEmail, authName, usuario, pessoa } = {}) {
    if (!profile) return profile;
    const cnpjDigits = profile.cnpjDigits || '';
    return {
        ...profile,
        email: resolveParceiroEmail({
            provider,
            authEmail,
            usuario,
            pessoa,
            cnpjDigits,
        }),
        name: resolveParceiroDisplayName({
            provider,
            authName,
            usuario,
            pessoa,
            cnpjDigits,
        }),
        provider: provider || profile.provider,
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

    const profile = finalizeParceiroProfile(
        profileFromUsuario(usuario, { provider: 'hub', ...parceiro }),
        { provider: 'hub', usuario },
    );
    if (!profile) return { error: 'Usuário inativo.' };

    return { profile, accessToken: auth.accessToken, refreshToken: auth.refreshToken };
}

export async function resolveProfileByEmail(config, email, extras = {}) {
    const emailNorm = String(email || '').trim().toLowerCase();
    const provider = extras.provider || 'google';
    const contact = await resolveParceiroHubContact(config, {
        email: emailNorm,
        phone: extras.phone,
    });

    if (!contact?.cliente) {
        return {
            sub: extras.sub || emailNorm,
            email: emailNorm,
            name: extras.name || '',
            phone: extras.phone || '',
            role: 'PARCEIRO',
            provider,
            picture: extras.picture || '',
        };
    }

    await syncParceiroContactLink(config, {
        usuario: contact.usuario,
        pessoa: contact.pessoa,
        email: emailNorm,
        phone: extras.phone,
    });

    if (contact.usuario) {
        const parceiro = await buildParceiroExtras(config, contact.usuario);
        const profile = profileFromUsuario(contact.usuario, {
            ...extras,
            email: emailNorm,
            phone: extras.phone || contact.usuario.telefone || '',
            provider,
            ...parceiro,
        });
        return (
            finalizeParceiroProfile(profile, {
                provider,
                authEmail: emailNorm,
                authName: extras.name,
                usuario: contact.usuario,
                pessoa: contact.pessoa,
            }) || {
                sub: extras.sub || emailNorm,
                email: emailNorm,
                name: extras.name || '',
                role: 'PARCEIRO',
                provider,
                picture: extras.picture || '',
            }
        );
    }

    const parceiro = await buildParceiroExtrasFromPessoa(config, contact.pessoa);
    return finalizeParceiroProfile(
        {
            sub: extras.sub || emailNorm,
            email: emailNorm,
            name: extras.name || '',
            phone: extras.phone || contact.pessoa?.telefone || '',
            role: 'PARCEIRO',
            provider,
            picture: extras.picture || '',
            ...parceiro,
        },
        {
            provider,
            authEmail: emailNorm,
            authName: extras.name,
            pessoa: contact.pessoa,
        },
    );
}

export async function resolveProfileByPhone(config, phone, name) {
    const normalizedPhone = String(phone || '').trim();
    const authName = String(name || '').trim();
    const provider = 'phone';
    const contact = await resolveParceiroHubContact(config, { phone: normalizedPhone });

    if (!contact?.cliente) {
        return {
            sub: `phone:${normalizedPhone}`,
            email: '',
            name: authName,
            phone: normalizedPhone,
            role: 'PARCEIRO',
            provider,
        };
    }

    await syncParceiroContactLink(config, {
        usuario: contact.usuario,
        pessoa: contact.pessoa,
        phone: normalizedPhone,
    });

    if (contact.usuario) {
        const parceiro = await buildParceiroExtras(config, contact.usuario);
        const profile = profileFromUsuario(contact.usuario, {
            phone: normalizedPhone,
            name: authName,
            provider,
            ...parceiro,
        });
        return (
            finalizeParceiroProfile(profile, {
                provider,
                authName,
                usuario: contact.usuario,
                pessoa: contact.pessoa,
            }) || {
                sub: `phone:${normalizedPhone}`,
                name: authName,
                phone: normalizedPhone,
                role: 'PARCEIRO',
                provider,
            }
        );
    }

    const parceiro = await buildParceiroExtrasFromPessoa(config, contact.pessoa);
    return finalizeParceiroProfile(
        {
            sub: `phone:${normalizedPhone}`,
            email: '',
            name: authName,
            phone: normalizedPhone,
            role: 'PARCEIRO',
            provider,
            ...parceiro,
        },
        {
            provider,
            authName,
            pessoa: contact.pessoa,
        },
    );
}
