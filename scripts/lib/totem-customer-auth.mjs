import { hubConfig } from '../hub-auth.mjs';
import { normalizeDocDigits, resolveLoginEmailExtended, verifyHubPassword } from '../hub-parceiro.mjs';
import { phoneLocalDigits } from './phone-match.mjs';

const MIN_PASSWORD_LENGTH = 6;

function hubHeaders(config, extra = {}) {
    return {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

async function hubRest(config, path, options = {}) {
    if (!config.serviceKey) return null;
    const res = await fetch(`${config.url}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: hubHeaders(config, options.headers || {}),
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }
    if (!res.ok) {
        const err = new Error(data?.message || data?.error || text || `Hub ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

export function validateTotemPassword(password) {
    const value = String(password || '').trim();
    if (value.length < MIN_PASSWORD_LENGTH) {
        const err = new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        err.status = 400;
        throw err;
    }
    return value;
}

export function loginParaEmail(login) {
    const emailLocal = String(login || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    if (!emailLocal) {
        const err = new Error('Login inválido para criar acesso.');
        err.status = 400;
        throw err;
    }
    return `${emailLocal}@hub.ligeirinho.com`;
}

export function resolveTotemAuthEmail(login) {
    const trimmed = String(login || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;
    return loginParaEmail(trimmed.replace(/\D/g, '') || trimmed);
}

/** Login único derivado do contato principal (prioridade: CNPJ > CPF > telefone > e-mail). */
export function deriveTotemLogin({ phone, email, cpf, cnpj } = {}) {
    const cnpjDigits = normalizeDocDigits(cnpj);
    if (cnpjDigits.length === 14) return cnpjDigits;
    const cpfDigits = normalizeDocDigits(cpf);
    if (cpfDigits.length === 11) return cpfDigits;
    const phoneLocal = phoneLocalDigits(phone);
    if (phoneLocal) return phoneLocal;
    const emailNorm = String(email || '').trim().toLowerCase();
    if (emailNorm && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) return emailNorm;
    return null;
}

export function deriveTotemLoginFromQuery(query, { type } = {}) {
    const raw = String(query || '').trim();
    if (type === 'email' || raw.includes('@')) {
        const email = raw.toLowerCase();
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
    }
    const digits = normalizeDocDigits(raw);
    if (digits.length >= 10) return digits;
    return null;
}

async function fetchUsuarioByLogin(config, login) {
    const trimmed = String(login || '').trim();
    if (!trimmed) return null;
    const rows = await hubRest(
        config,
        `usuarios?select=id,email,login,nome,cargo,ativo,telefone,pessoa_id&login=ilike.${encodeURIComponent(trimmed)}&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function fetchUsuarioByPessoaId(config, pessoaId) {
    if (!pessoaId) return null;
    const rows = await hubRest(
        config,
        `usuarios?select=id,email,login,nome,cargo,ativo,telefone,pessoa_id&pessoa_id=eq.${encodeURIComponent(pessoaId)}&ativo=eq.true&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function pessoaHasTotemLogin(config, pessoaId) {
    if (!config?.serviceKey || !pessoaId) return false;
    const usuario = await fetchUsuarioByPessoaId(config, pessoaId);
    return Boolean(usuario?.id);
}

async function updateAuthPassword(config, userId, password) {
    const res = await fetch(`${config.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: hubHeaders(config),
        body: JSON.stringify({ password, email_confirm: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(
            data.msg || data.message || data.error_description || 'Não foi possível definir a senha.',
        );
        err.status = res.status === 400 ? 400 : 502;
        throw err;
    }
}

async function createAuthUser(config, { authEmail, password, nome, login }) {
    const res = await fetch(`${config.url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: hubHeaders(config),
        body: JSON.stringify({
            email: authEmail,
            password,
            email_confirm: true,
            user_metadata: { nome, login },
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
        return data.id || data.user?.id || null;
    }
    const msg = String(data.msg || data.message || data.error_description || '');
    if (/already been registered|already exists|duplicate/i.test(msg)) {
        return null;
    }
    const err = new Error(msg || 'Não foi possível criar login.');
    err.status = 502;
    throw err;
}

async function fetchAuthUserIdByEmail(config, email) {
    try {
        const id = await hubRest(config, 'rpc/hub_auth_user_id_by_email', {
            method: 'POST',
            body: { p_email: email },
        });
        return id || null;
    } catch {
        return null;
    }
}

/**
 * Cria ou atualiza login Hub (cargo Clientes) vinculado à pessoa do Totem.
 */
export async function provisionTotemCustomerUsuario(
    config,
    { pessoaId, nome, login, password, phone, email } = {},
) {
    if (!config?.serviceKey) {
        const err = new Error('Cadastro indisponível no momento.');
        err.status = 503;
        throw err;
    }

    const loginValue = String(login || '').trim();
    const senha = validateTotemPassword(password);
    if (!pessoaId || !loginValue) {
        const err = new Error('Informe contato válido para criar login.');
        err.status = 400;
        throw err;
    }

    const authEmail = resolveTotemAuthEmail(loginValue);
    const displayName = String(nome || loginValue).trim().slice(0, 120) || loginValue;
    const phoneLocal = phoneLocalDigits(phone);
    const emailNorm = String(email || '').trim().toLowerCase();

    const byPessoa = await fetchUsuarioByPessoaId(config, pessoaId);
    const byLogin = await fetchUsuarioByLogin(config, loginValue);

    if (byLogin?.id && byLogin.pessoa_id && byLogin.pessoa_id !== pessoaId) {
        const err = new Error('Este contato já possui login em outra conta.');
        err.status = 409;
        throw err;
    }

    let userId = byPessoa?.id || byLogin?.id || null;

    if (!userId) {
        userId = await createAuthUser(config, {
            authEmail,
            password: senha,
            nome: displayName,
            login: loginValue,
        });
        if (!userId) {
            userId = await fetchAuthUserIdByEmail(config, authEmail);
        }
    }

    if (!userId) {
        const err = new Error('Não foi possível criar login. Tente outro contato ou fale com o suporte.');
        err.status = 502;
        throw err;
    }

    await updateAuthPassword(config, userId, senha);

    const profilePatch = {
        email: authEmail,
        login: loginValue,
        nome: displayName,
        cargo: 'Clientes',
        ativo: true,
        pessoa_id: pessoaId,
    };
    if (phoneLocal) profilePatch.telefone = phoneLocal;
    if (emailNorm && loginValue.includes('@')) profilePatch.email = authEmail;

    try {
        await hubRest(config, `usuarios?id=eq.${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: profilePatch,
        });
    } catch (patchErr) {
        try {
            await hubRest(config, 'usuarios', {
                method: 'POST',
                headers: { Prefer: 'return=minimal' },
                body: { id: userId, ...profilePatch },
            });
        } catch (insertErr) {
            console.warn('provisionTotemCustomerUsuario usuarios', insertErr?.message || patchErr?.message);
        }
    }

    return { userId, login: loginValue };
}

export async function loginTotemCustomer(env, { login, password } = {}) {
    const config = hubConfig(env);
    if (!config.serviceKey) {
        const err = new Error('Login indisponível no momento.');
        err.status = 503;
        throw err;
    }

    const loginValue = String(login || '').trim();
    const senha = String(password || '');
    if (!loginValue || !senha) {
        const err = new Error('Informe seu contato e senha.');
        err.status = 400;
        throw err;
    }

    const authEmail = await resolveLoginEmailExtended(config, loginValue);
    if (!authEmail) {
        const err = new Error('Contato ou senha incorretos.');
        err.status = 401;
        throw err;
    }

    const ok = await verifyHubPassword(config, authEmail, senha);
    if (!ok) {
        const err = new Error('Contato ou senha incorretos.');
        err.status = 401;
        throw err;
    }

    const usuario =
        (await fetchUsuarioByLogin(config, loginValue)) ||
        (await fetchUsuarioByLogin(config, normalizeDocDigits(loginValue)));
    if (!usuario?.id) {
        const err = new Error('Conta encontrada, mas perfil incompleto. Fale com o suporte.');
        err.status = 404;
        throw err;
    }
    if (!usuario.pessoa_id) {
        const err = new Error('Cadastro sem vínculo. Use Novo cliente para definir uma senha.');
        err.status = 404;
        throw err;
    }

    return { usuario, pessoaId: usuario.pessoa_id };
}
