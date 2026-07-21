/**
 * Concede admin do Totem a um usuário existente no Hub, sem alterar o cargo.
 * Requer HUB_SUPABASE_SERVICE_ROLE_KEY (ex.: ligeirinhohub/.env.local).
 *
 * Uso:
 *   node scripts/grant-totem-admin.mjs Patricia
 *   node scripts/grant-totem-admin.mjs Patricia 11989482901
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hubConfig, resolveHubLogin } from './hub-auth.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LOGIN = (process.argv[2] || process.env.TOTEM_LOGIN || 'Patricia').trim();
const PASSWORD = (process.argv[3] || process.env.TOTEM_PASSWORD || '').trim();
const hub = hubConfig();

function loadHubServiceKey() {
    if (process.env.HUB_SUPABASE_SERVICE_ROLE_KEY) return process.env.HUB_SUPABASE_SERVICE_ROLE_KEY;
    const hubEnv = resolve(__dirname, '../../ligeirinhohub/.env.local');
    if (!existsSync(hubEnv)) return '';
    const text = readFileSync(hubEnv, 'utf8');
    const match = text.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    return match?.[1]?.trim() || '';
}

const SUPABASE_URL = 'https://liszpwocwvkytzyaxvit.supabase.co';
const SERVICE_KEY = loadHubServiceKey();

if (!SERVICE_KEY) {
    console.error('HUB_SUPABASE_SERVICE_ROLE_KEY não encontrada.');
    process.exit(1);
}

function adminHeaders(extra = {}) {
    return {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        ...extra,
    };
}

function loginParaEmail(login) {
    const emailLocal = login
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    return `${emailLocal}@hub.ligeirinho.com`;
}

async function findUsuarioByLogin(login) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?select=id,login,email,nome,cargo,ativo,admin_totem&login=ilike.${encodeURIComponent(login)}&limit=1`,
        { headers: adminHeaders() },
    );
    const rows = await res.json();
    if (!res.ok) throw new Error(rows?.message || `usuarios ${res.status}`);
    return Array.isArray(rows) ? rows[0] : null;
}

async function patchUsuario(id, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: adminHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `PATCH usuarios ${res.status}`);
    return Array.isArray(data) ? data[0] : data;
}

async function updateAuthUser(userId, { password, email }) {
    const body = { email_confirm: true };
    if (password) body.password = password;
    if (email) body.email = email;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.msg || data?.message || `auth user ${res.status}`);
    return data;
}

async function testLoginWithEmail(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            apikey: hub.anonKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: data.error_description || data.msg || 'Login falhou' };
}

async function main() {
    const usuario = await findUsuarioByLogin(LOGIN);
    if (!usuario?.id) {
        throw new Error(`Usuário "${LOGIN}" não encontrado no Hub.`);
    }
    if (!usuario.ativo) {
        throw new Error(`Usuário "${LOGIN}" está inativo no Hub.`);
    }

    const email = String(usuario.email || loginParaEmail(usuario.login || LOGIN)).trim().toLowerCase();
    const patchBody = { admin_totem: true };
    if (!usuario.email) patchBody.email = email;

    const updated = await patchUsuario(usuario.id, patchBody);
    console.log('Admin Totem concedido:', {
        id: updated.id,
        login: updated.login,
        nome: updated.nome,
        cargo: updated.cargo,
        email: updated.email || email,
        admin_totem: updated.admin_totem === true,
    });

    if (PASSWORD) {
        await updateAuthUser(usuario.id, { password: PASSWORD, email: updated.email || email });
        console.log('Senha de acesso atualizada.');

        let loginOk = await testLoginWithEmail(updated.email || email, PASSWORD);
        if (!loginOk.ok) {
            const fallback = await resolveHubLogin(
                { url: SUPABASE_URL, anonKey: hub.anonKey, serviceKey: SERVICE_KEY },
                updated.login || LOGIN,
                PASSWORD,
            );
            loginOk = fallback.error ? { ok: false, error: fallback.error } : { ok: true };
        }
        if (!loginOk.ok) {
            throw new Error(`Teste de login falhou: ${loginOk.error}`);
        }
        console.log('Login test OK.');
    }

    console.log('');
    console.log('Peça para a Patricia sair e entrar de novo no Totem.');
    console.log('Login:', updated.login || LOGIN);
    if (PASSWORD) console.log('Senha:', PASSWORD);
    console.log('PIN para sair do Totem (5 toques no logo): 11989482901');
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});
